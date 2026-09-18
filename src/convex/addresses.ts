import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireUserId } from "./helpers";

const addressFields = {
  isDefault: v.boolean(),
  label: v.string(),
  fullName: v.string(),
  street: v.string(),
  city: v.string(),
  state: v.string(),
  postalCode: v.string(),
  country: v.string(),
};

/** The signed-in user's saved addresses, default first. */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const addresses = await ctx.db
      .query("addresses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    addresses.sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return a._creationTime - b._creationTime;
    });
    return addresses;
  },
});

/** Save an address. First address becomes the default automatically. */
export const save = mutation({
  args: { id: v.optional(v.id("addresses")), ...addressFields },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const label = args.label.trim();
    const fullName = args.fullName.trim();
    const street = args.street.trim();
    const city = args.city.trim();
    const state = args.state.trim();
    const postalCode = args.postalCode.trim();
    const country = args.country.trim();
    if (!label || !fullName || !street || !city || !postalCode || !country) {
      throw new Error("Fill in every address field.");
    }

    const existing = await ctx.db
      .query("addresses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const isFirst = existing.length === 0;

    if (args.id) {
      const address = await ctx.db.get(args.id);
      if (!address || address.userId !== userId) {
        throw new Error("Address not found.");
      }
      await ctx.db.patch(args.id, {
        label,
        fullName,
        street,
        city,
        state,
        postalCode,
        country,
      });
      if (args.isDefault) {
        for (const other of existing) {
          if (other._id !== args.id && other.isDefault) {
            await ctx.db.patch(other._id, { isDefault: false });
          }
        }
        await ctx.db.patch(args.id, { isDefault: true });
      }
      return args.id;
    }

    const id = await ctx.db.insert("addresses", {
      userId,
      label,
      fullName,
      street,
      city,
      state,
      postalCode,
      country,
      isDefault: isFirst || Boolean(args.isDefault),
    });
    if (!isFirst && args.isDefault) {
      for (const other of existing) {
        if (other.isDefault) await ctx.db.patch(other._id, { isDefault: false });
      }
    }
    return id;
  },
});

/** Delete one of your addresses. */
export const remove = mutation({
  args: { id: v.id("addresses") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const address = await ctx.db.get(args.id);
    if (!address || address.userId !== userId) {
      throw new Error("Address not found.");
    }
    await ctx.db.delete(args.id);
    if (address.isDefault) {
      const remaining = await ctx.db
        .query("addresses")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      if (remaining[0]) {
        await ctx.db.patch(remaining[0]._id, { isDefault: true });
      }
    }
  },
});
