"use node";

import Stripe from "stripe";
import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";

/**
 * Create a Stripe Checkout session for a pending order.
 * Requires STRIPE_SECRET_KEY; the resulting payment is confirmed by the
 * `checkout.session.completed` webhook (see stripeWebhook.ts).
 */
export const createCheckoutSession = action({
  args: { orderId: v.id("orders"), origin: v.string() },
  handler: async (ctx, args) => {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
      throw new Error(
        "Stripe is not configured. Add STRIPE_SECRET_KEY in the environment settings.",
      );
    }
    const stripe = new Stripe(secret);

    const order = await ctx.runQuery(api.orders.getForCheckout, {
      orderId: args.orderId,
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: order.items.map((item) => ({
        quantity: item.quantity,
        price_data: {
          currency: "usd",
          unit_amount: item.unitPrice,
          product_data: { name: item.productName },
        },
      })),
      metadata: { orderId: args.orderId },
      success_url: `${args.origin}/orders?placed=${encodeURIComponent(order.code)}`,
      cancel_url: `${args.origin}/checkout?canceled=1`,
    });

    return { url: session.url };
  },
});

/**
 * Verify a webhook payload with the Stripe SDK and mark the order paid on
 * `checkout.session.completed`. Called by the HTTP action in stripeWebhook.ts
 * (internal — not reachable from the client).
 */
export const verifyAndMarkPaid = internalAction({
  args: { payload: v.string(), signature: v.string() },
  handler: async (_ctx, args) => {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secretKey || !webhookSecret) {
      throw new Error("Stripe is not configured.");
    }
    const stripe = new Stripe(secretKey);

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        args.payload,
        args.signature,
        webhookSecret,
      );
    } catch (err) {
      throw new Error(
        `Signature verification failed: ${err instanceof Error ? err.message : "unknown error"}`,
      );
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId;
      if (orderId) {
        await _ctx.runMutation(internal.orders.markPaidFromWebhook, { orderId });
      }
    }
  },
});
