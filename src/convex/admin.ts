import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { roleValidator } from "./schema";
import { requireAdmin, requireUserId } from "./helpers";

/** Snapshot of store activity for the admin overview. */
export const stats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const [products, orders, users, bookings, posts] = await Promise.all([
      ctx.db.query("products").collect(),
      ctx.db.query("orders").collect(),
      ctx.db.query("users").collect(),
      ctx.db.query("bookings").collect(),
      ctx.db.query("posts").collect(),
    ]);
    const payments = await ctx.db.query("payments").collect();
    const revenueCents = payments
      .filter((p) => p.status === "paid")
      .reduce((sum, p) => sum + p.amount, 0);
    const now = Date.now();
    return {
      productCount: products.length,
      activeProductCount: products.filter((p) => p.isActive).length,
      orderCount: orders.length,
      pendingOrderCount: orders.filter((o) => o.status === "pending").length,
      paidOrderCount: orders.filter((o) => o.status === "paid").length,
      revenueCents,
      userCount: users.length,
      adminCount: users.filter((u) => u.role === "admin").length,
      upcomingBookingCount: bookings.filter(
        (b) => b.status === "scheduled" && b.startAt >= now,
      ).length,
      publishedPostCount: posts.filter((p) => p.status === "published").length,
    };
  },
});

/** Admin: every user with their role. */
export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").collect();
    return users
      .map((u) => ({
        _id: u._id,
        name: u.name ?? null,
        email: u.email ?? null,
        image: u.image ?? null,
        role: u.role ?? "user",
        isAnonymous: u.isAnonymous ?? false,
        _creationTime: u._creationTime,
      }))
      .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  },
});

/** Admin: promote or demote a teammate. You cannot change your own role here. */
export const setUserRole = mutation({
  args: { userId: v.id("users"), role: roleValidator },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    if (args.userId === adminId) {
      throw new Error("You cannot change your own role. Ask another admin.");
    }
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found.");
    await ctx.db.patch(args.userId, { role: args.role });
  },
});

/** Admin: every post including drafts, for moderation. */
export const listPosts = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const posts = await ctx.db.query("posts").collect();
    posts.sort((a, b) => b._creationTime - a._creationTime);
    const result = [];
    for (const post of posts) {
      const author = await ctx.db.get(post.authorId);
      result.push({
        _id: post._id,
        title: post.title,
        status: post.status,
        _creationTime: post._creationTime,
        authorName: author?.name ?? author?.email ?? "Unknown",
      });
    }
    return result;
  },
});

const SEED_CATEGORIES: { name: string; description: string }[] = [
  { name: "Workspace", description: "Desks, lighting, and everything around them." },
  { name: "Tech", description: "Computing and audio equipment." },
  { name: "Everyday Carry", description: "Bags, bottles, and small essentials." },
  { name: "Stationery", description: "Notebooks and writing tools." },
];

const SEED_PRODUCTS: {
  category: string;
  name: string;
  description: string;
  price: number; // cents
  stockQuantity: number;
}[] = [
  { category: "Tech", name: "Mechanical Keyboard — Tactile", description: "Tenkeyless board with tactile switches, white PBT keycaps, and a detachable USB-C cable.", price: 12900, stockQuantity: 14 },
  { category: "Tech", name: "Noise-Cancelling Headphones", description: "Over-ear, closed-back headphones with adaptive noise cancelling and a 30-hour battery.", price: 24900, stockQuantity: 8 },
  { category: "Tech", name: "USB-C Docking Station", description: "Eleven-port dock with dual 4K display output and 100 W passthrough charging.", price: 15900, stockQuantity: 11 },
  { category: "Tech", name: "4K Conference Webcam", description: "Auto-framing webcam with a physical privacy shutter and beam-forming microphones.", price: 9900, stockQuantity: 16 },
  { category: "Workspace", name: "Brass Desk Lamp", description: "Articulated lamp with a weighted brass base and a warm, dimmable LED.", price: 11900, stockQuantity: 9 },
  { category: "Workspace", name: "Linen Desk Mat", description: "Stitched-edge mat in washed linen with an anti-slip backing, 80 × 40 cm.", price: 4900, stockQuantity: 22 },
  { category: "Workspace", name: "Monitor Riser — Oak", description: "Solid oak riser that lifts a display to eye level and clears cable clutter.", price: 8900, stockQuantity: 12 },
  { category: "Workspace", name: "Cable Organizer Set", description: "Six magnetic cable clips and two under-desk trays in matte steel.", price: 2400, stockQuantity: 30 },
  { category: "Everyday Carry", name: "Steel Water Bottle — 750 ml", description: "Double-walled, vacuum-sealed bottle that keeps drinks cold for 24 hours.", price: 3900, stockQuantity: 26 },
  { category: "Everyday Carry", name: "Leather Card Holder", description: "Slim four-pocket card holder in vegetable-tanned leather.", price: 6900, stockQuantity: 18 },
  { category: "Everyday Carry", name: "Commuter Backpack — 18 L", description: "Water-resistant backpack with a padded 16-inch laptop sleeve.", price: 13900, stockQuantity: 10 },
  { category: "Stationery", name: "Field Notebook — Set of 3", description: "Dot-grid notebooks with 120 gsm paper and thread-bound spines.", price: 1800, stockQuantity: 40 },
];

/**
 * Fill the catalog with a small sample range. Runs only while the store is
 * completely empty, so it is safe to call from anywhere (e.g. the landing page).
 */
export const seedCatalog = mutation({
  args: {},
  handler: async (ctx) => {
    const existingProducts = await ctx.db.query("products").collect();
    if (existingProducts.length > 0) return "already_seeded";
    const existingCategories = await ctx.db.query("categories").collect();
    if (existingCategories.length > 0) return "already_seeded";

    const categoryIds = new Map<string, Id<"categories">>();
    for (const category of SEED_CATEGORIES) {
      const id = await ctx.db.insert("categories", {
        name: category.name,
        description: category.description,
      });
      categoryIds.set(category.name, id);
    }
    for (const product of SEED_PRODUCTS) {
      await ctx.db.insert("products", {
        name: product.name,
        description: product.description,
        price: product.price,
        stockQuantity: product.stockQuantity,
        categoryId: categoryIds.get(product.category),
        isActive: true,
      });
    }
    return "seeded";
  },
});

/** Guard used by pages to decide whether to show admin affordances. */
export const isCurrentUserAdmin = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const user = await ctx.db.get(userId);
    return user?.role === "admin";
  },
});
