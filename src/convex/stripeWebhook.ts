import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Stripe webhook receiver (default runtime — http actions cannot run in Node).
 * The raw payload and signature are forwarded to a Node action that verifies
 * them with the Stripe SDK. Register at POST /webhooks/stripe (see http.ts).
 */
export const stripeWebhook = httpAction(async (ctx, request) => {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return new Response("Stripe is not configured.", { status: 501 });
  }

  const signature = request.headers.get("stripe-signature");
  const payload = await request.text();

  try {
    await ctx.runAction(internal.stripe.verifyAndMarkPaid, {
      payload,
      signature: signature ?? "",
    });
  } catch (err) {
    return new Response(
      `Webhook error: ${err instanceof Error ? err.message : "unknown error"}`,
      { status: 400 },
    );
  }

  return new Response(null, { status: 200 });
});
