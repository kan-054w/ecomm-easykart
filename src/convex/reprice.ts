import { internalMutation } from "./_generated/server";

/**
 * One-time migration: existing prices were entered at dollar scale (minor
 * units of USD). The store now prices in INR, so multiply every product price
 * by 10 (e.g. $129.00 → ₹1,290.00). Idempotence is the caller's concern; run
 * once via `bunx convex run reprice:scalePrices --identity '{"name":"Setup"}'`.
 */
export const scalePrices = internalMutation({
  args: {},
  handler: async (ctx) => {
    const products = await ctx.db.query("products").collect();
    let changed = 0;
    for (const product of products) {
      await ctx.db.patch(product._id, { price: product.price * 10 });
      changed++;
    }
    return { repriced: changed };
  },
});
