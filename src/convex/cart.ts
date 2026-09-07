import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getOrCreateCart, requireUserId } from "./helpers";

const MAX_QTY = 99;

/** The signed-in customer's cart with product details and totals. */
export const get = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const cart = await ctx.db
      .query("carts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!cart) return { items: [], subtotal: 0, count: 0 };
    const rows = await ctx.db
      .query("cartItems")
      .withIndex("by_cart", (q) => q.eq("cartId", cart._id))
      .collect();
    rows.sort((a, b) => a._creationTime - b._creationTime);
    const items = [];
    for (const row of rows) {
      const product = await ctx.db.get(row.productId);
      if (!product || !product.isActive) continue;
      items.push({
        _id: row._id,
        productId: product._id,
        name: product.name,
        price: product.price,
        stockQuantity: product.stockQuantity,
        quantity: row.quantity,
        lineTotal: product.price * row.quantity,
      });
    }
    const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0);
    const count = items.reduce((sum, i) => sum + i.quantity, 0);
    return { items, subtotal, count };
  },
});

/** Add a product (merges with an existing line, clamped to stock). */
export const add = mutation({
  args: { productId: v.id("products"), quantity: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const product = await ctx.db.get(args.productId);
    if (!product || !product.isActive) {
      throw new Error("This product is not available.");
    }
    const quantity = Math.max(1, args.quantity ?? 1);
    const cart = await getOrCreateCart(ctx, userId);
    const existing = await ctx.db
      .query("cartItems")
      .withIndex("by_cart_product", (q) =>
        q.eq("cartId", cart._id).eq("productId", args.productId),
      )
      .first();
    const nextQty = Math.min(
      (existing?.quantity ?? 0) + quantity,
      product.stockQuantity,
      MAX_QTY,
    );
    if (nextQty <= 0) throw new Error("This product is out of stock.");
    if (existing) {
      await ctx.db.patch(existing._id, { quantity: nextQty });
    } else {
      await ctx.db.insert("cartItems", {
        cartId: cart._id,
        productId: args.productId,
        quantity: nextQty,
      });
    }
  },
});

/** Set an exact quantity; 0 removes the line. */
export const setQuantity = mutation({
  args: { itemId: v.id("cartItems"), quantity: v.number() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const item = await ctx.db.get(args.itemId);
    if (!item) return;
    const cart = await ctx.db.get(item.cartId);
    if (!cart || cart.userId !== userId) {
      throw new Error("This cart item is not yours.");
    }
    if (args.quantity <= 0) {
      await ctx.db.delete(args.itemId);
      return;
    }
    const product = await ctx.db.get(item.productId);
    const max = product ? Math.min(product.stockQuantity, MAX_QTY) : 0;
    if (max <= 0) {
      await ctx.db.delete(args.itemId);
      return;
    }
    await ctx.db.patch(args.itemId, {
      quantity: Math.min(Math.round(args.quantity), max),
    });
  },
});

/** Remove a single line. */
export const remove = mutation({
  args: { itemId: v.id("cartItems") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const item = await ctx.db.get(args.itemId);
    if (!item) return;
    const cart = await ctx.db.get(item.cartId);
    if (!cart || cart.userId !== userId) {
      throw new Error("This cart item is not yours.");
    }
    await ctx.db.delete(args.itemId);
  },
});

/** Empty the cart. */
export const clear = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const cart = await ctx.db
      .query("carts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!cart) return;
    const rows = await ctx.db
      .query("cartItems")
      .withIndex("by_cart", (q) => q.eq("cartId", cart._id))
      .collect();
    for (const row of rows) {
      await ctx.db.delete(row._id);
    }
  },
});
