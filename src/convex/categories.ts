import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./helpers";

/** Public: categories with a count of active products in each. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const categories = await ctx.db.query("categories").collect();
    const products = await ctx.db
      .query("products")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    return categories
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => ({
        ...c,
        productCount: products.filter((p) => p.categoryId === c._id).length,
      }));
  },
});

const categoryFields = {
  name: v.string(),
  description: v.optional(v.string()),
};

/** Admin: create a category (names are unique). */
export const adminCreate = mutation({
  args: categoryFields,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const name = args.name.trim();
    if (!name) throw new Error("Name is required.");
    const dupe = await ctx.db
      .query("categories")
      .withIndex("by_name", (q) => q.eq("name", name))
      .first();
    if (dupe) throw new Error("A category with that name already exists.");
    return await ctx.db.insert("categories", { name, description: args.description });
  },
});

/** Admin: rename / re-describe a category. */
export const adminUpdate = mutation({
  args: { id: v.id("categories"), ...categoryFields },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { id, ...fields } = args;
    const category = await ctx.db.get(id);
    if (!category) throw new Error("Category not found.");
    const name = fields.name.trim();
    if (!name) throw new Error("Name is required.");
    const dupe = await ctx.db
      .query("categories")
      .withIndex("by_name", (q) => q.eq("name", name))
      .first();
    if (dupe && dupe._id !== id) {
      throw new Error("A category with that name already exists.");
    }
    await ctx.db.patch(id, { ...fields, name });
  },
});

/** Admin: delete a category only when no products reference it. */
export const adminRemove = mutation({
  args: { id: v.id("categories") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const used = await ctx.db
      .query("products")
      .withIndex("by_category", (q) => q.eq("categoryId", args.id))
      .first();
    if (used) {
      throw new Error("Category has products. Move them first.");
    }
    await ctx.db.delete(args.id);
  },
});
