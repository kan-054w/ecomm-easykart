import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

type Ctx = QueryCtx | MutationCtx;

/** Throws unless the caller is signed in; returns their user id. */
export async function requireUserId(ctx: Ctx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new Error("Sign in to continue.");
  }
  return userId;
}

/** Throws unless the caller is signed in with the admin role. */
export async function requireAdmin(ctx: Ctx): Promise<Id<"users">> {
  const userId = await requireUserId(ctx);
  const user = await ctx.db.get(userId);
  if (user?.role !== "admin") {
    throw new Error("Admin access required.");
  }
  return userId;
}

/** True if at least one user has the admin role (bootstrap guard). */
export async function anyAdminExists(ctx: Ctx): Promise<boolean> {
  const admin = await ctx.db
    .query("users")
    .filter((q) => q.eq(q.field("role"), "admin"))
    .first();
  return admin !== null;
}

/** Each customer has exactly one cart; creates it lazily. */
export async function getOrCreateCart(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<Doc<"carts">> {
  const cart = await ctx.db
    .query("carts")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  if (cart) return cart;
  const cartId = await ctx.db.insert("carts", { userId });
  const created = await ctx.db.get(cartId);
  return created!;
}
