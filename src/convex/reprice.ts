import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * One-off repair: the reprice migration ran a second time and inflated the
 * catalog again (₹2,490 became ₹24,900). This divides every product price by
 * the given factor to restore the intended rupee-scale prices.
 *
 * Divide by 10 to undo one accidental extra run.
 */
export const scalePrices = internalMutation({
  args: { divide: v.number() },
  handler: async (ctx, args) => {
    const products = await ctx.db.query("products").collect();
    for (const product of products) {
      await ctx.db.patch(product._id, {
        price: Math.round(product.price / args.divide),
      });
    }
    return { repriced: products.length, dividedBy: args.divide };
  },
});
