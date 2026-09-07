import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./helpers";

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
    return products.map((p) => ({
      ...p,
      categoryName: p.categoryId ? (nameById.get(p.categoryId) ?? null) : null,
    }));
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
    return { ...product, categoryName: category?.name ?? null };
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
    return products
      .filter(
        (p) => p.categoryId === args.categoryId && p._id !== args.id,
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 3);
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
    return products
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => ({
        ...p,
        categoryName: p.categoryId
          ? (nameById.get(p.categoryId) ?? null)
          : null,
      }));
  },
});

const productFields = {
  name: v.string(),
  description: v.optional(v.string()),
  price: v.number(), // minor units (cents)
  stockQuantity: v.number(),
  imageUrl: v.optional(v.string()),
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

/** Admin: delete a product when it has no cart or order references. */
export const adminRemove = mutation({
  args: { id: v.id("products") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
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
    await ctx.db.delete(args.id);
  },
});
