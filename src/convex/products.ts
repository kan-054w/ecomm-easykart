import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAdmin } from "./helpers";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4 MB

/** Best available image for a product: uploaded photo, else external URL. */
async function resolveImageUrl(
  ctx: QueryCtx | MutationCtx,
  product: Doc<"products">,
): Promise<string | null> {
  if (product.imageStorageId) {
    return await ctx.storage.getUrl(product.imageStorageId);
  }
  return product.imageUrl ?? null;
}

/** Public catalog: active products with their category name attached. */
export const list = query({
  args: {
    categoryId: v.optional(v.id("categories")),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let products = await ctx.db
      .query("products")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    if (args.categoryId !== undefined) {
      products = products.filter((p) => p.categoryId === args.categoryId);
    }
    if (args.search) {
      const needle = args.search.toLowerCase();
      products = products.filter((p) =>
        p.name.toLowerCase().includes(needle),
      );
    }
    products.sort((a, b) => a.name.localeCompare(b.name));
    const categories = await ctx.db.query("categories").collect();
    const nameById = new Map(categories.map((c) => [c._id, c.name]));
    return Promise.all(
      products.map(async (p) => ({
        ...p,
        imageUrl: await resolveImageUrl(ctx, p),
        categoryName: p.categoryId ? (nameById.get(p.categoryId) ?? null) : null,
      })),
    );
  },
});

/** Public product detail. */
export const get = query({
  args: { id: v.id("products") },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.id);
    if (!product || !product.isActive) return null;
    const category = product.categoryId
      ? await ctx.db.get(product.categoryId)
      : null;
    return {
      ...product,
      imageUrl: await resolveImageUrl(ctx, product),
      categoryName: category?.name ?? null,
    };
  },
});

/** Up to 3 other active products in the same category. */
export const getRelated = query({
  args: { id: v.id("products"), categoryId: v.optional(v.id("categories")) },
  handler: async (ctx, args) => {
    if (args.categoryId === undefined) return [];
    const products = await ctx.db
      .query("products")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    const related = products
      .filter(
        (p) => p.categoryId === args.categoryId && p._id !== args.id,
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 3);
    return Promise.all(
      related.map(async (p) => ({ ...p, imageUrl: await resolveImageUrl(ctx, p) })),
    );
  },
});

/** Admin: every product, including inactive ones. */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const products = await ctx.db.query("products").collect();
    const categories = await ctx.db.query("categories").collect();
    const nameById = new Map(categories.map((c) => [c._id, c.name]));
    return Promise.all(
      products
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(async (p) => ({
          ...p,
          imageUrl: await resolveImageUrl(ctx, p),
          categoryName: p.categoryId
            ? (nameById.get(p.categoryId) ?? null)
            : null,
        })),
    );
  },
});

const productFields = {
  name: v.string(),
  description: v.optional(v.string()),
  price: v.number(), // minor units (cents)
  stockQuantity: v.number(),
  imageUrl: v.optional(v.string()),
  imageStorageId: v.optional(v.id("_storage")),
  categoryId: v.optional(v.id("categories")),
  isActive: v.boolean(),
};

/** Admin: create a product. */
export const adminCreate = mutation({
  args: productFields,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (args.price < 0 || args.stockQuantity < 0) {
      throw new Error("Price and stock must be non-negative.");
    }
    const name = args.name.trim();
    if (!name) throw new Error("Name is required.");
    return await ctx.db.insert("products", { ...args, name });
  },
});

/** Admin: update a product. */
export const adminUpdate = mutation({
  args: { id: v.id("products"), ...productFields },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { id, ...fields } = args;
    const product = await ctx.db.get(id);
    if (!product) throw new Error("Product not found.");
    const name = fields.name.trim();
    if (!name) throw new Error("Name is required.");
    await ctx.db.patch(id, { ...fields, name });
  },
});

/**
 * Admin: short-lived upload URL for a product photo. The client PUTs the file,
 * then calls `attachImage` with the returned storage id.
 */
export const generateImageUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Admin: attach an uploaded photo to a product, replacing any previous one
 * (old file is deleted from storage). `clear` removes the photo entirely.
 */
export const attachImage = mutation({
  args: {
    productId: v.id("products"),
    storageId: v.id("_storage"),
    clear: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found.");

    const metadata = await ctx.storage.getMetadata(args.storageId);
    if (!metadata) throw new Error("Upload not found. Try again.");
    if (!metadata.contentType?.startsWith("image/")) {
      await ctx.storage.delete(args.storageId);
      throw new Error("Only image files can be attached.");
    }
    if (metadata.size > MAX_IMAGE_BYTES) {
      await ctx.storage.delete(args.storageId);
      throw new Error("Keep images under 4 MB.");
    }

    const previousId = product.imageStorageId;
    await ctx.db.patch(args.productId, { imageStorageId: args.storageId });
    if (previousId && previousId !== args.storageId) {
      await ctx.storage.delete(previousId);
    }
  },
});

/** Admin: remove a product's uploaded photo (external URL, if any, is kept). */
export const removeImage = mutation({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found.");
    const previousId = product.imageStorageId;
    await ctx.db.patch(args.productId, { imageStorageId: undefined });
    if (previousId) {
      await ctx.storage.delete(previousId);
    }
  },
});

/** Admin: delete a product when it has no cart or order references. */
export const adminRemove = mutation({
  args: { id: v.id("products") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const product = await ctx.db.get(args.id);
    if (!product) throw new Error("Product not found.");
    const inCart = await ctx.db
      .query("cartItems")
      .filter((q) => q.eq(q.field("productId"), args.id))
      .first();
    if (inCart) {
      throw new Error("Product is in a customer cart. Clear it first.");
    }
    const ordered = await ctx.db
      .query("orderItems")
      .filter((q) => q.eq(q.field("productId"), args.id))
      .first();
    if (ordered) {
      throw new Error("Product has order history. Deactivate it instead.");
    }
    if (product.imageStorageId) {
      await ctx.storage.delete(product.imageStorageId);
    }
    await ctx.db.delete(args.id);
  },
});
