import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./helpers";

/** Which roles the current signed-in user holds. */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return {
      _id: user._id,
      name: user.name ?? null,
      email: user.email ?? null,
      role: user.role ?? "user",
      isAnonymous: user.isAnonymous ?? false,
    };
  },
});

/**
 * True when anyone may claim the first admin slot (no admin exists yet).
 * The claim mutation then flips this off, so exactly one team member gets it.
 */
export const canClaimAdmin = query({
  args: {},
  handler: async (ctx) => {
    const admin = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), "admin"))
      .first();
    return admin === null;
  },
});

/** Bootstrap: the first signed-in user may claim the admin role. */
export const claimAdmin = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const user = await ctx.db.get(userId);
    if (user?.role === "admin") return;
    const admin = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), "admin"))
      .first();
    if (admin !== null) {
      throw new Error("An admin already exists. Ask them to update your role.");
    }
    await ctx.db.patch(userId, { role: "admin" });
  },
});
