import { getAuthUserId } from "@convex-dev/auth/server";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { orderStatusValidator, paymentMethodValidator } from "./schema";
import { requireAdmin, requireUserId } from "./helpers";

/** Human-readable order code, e.g. EK-3F9K2A. */
function generateOrderCode(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  return `EK-${stamp.slice(-6).padStart(6, "0")}`;
}

const shippingAddressValidator = v.object({
  fullName: v.string(),
  street: v.string(),
  city: v.string(),
  state: v.string(),
  postalCode: v.string(),
  country: v.string(),
});

/** Mark an order's payment as received and promote the order to "paid". */
async function applyPaid(ctx: MutationCtx, order: Doc<"orders">) {
  if (order.paymentId) {
    const payment = await ctx.db.get(order.paymentId);
    if (payment && payment.status === "pending") {
      await ctx.db.patch(order.paymentId, {
        status: "paid",
        paidAt: Date.now(),
      });
    }
  }
  if (order.status === "pending") {
    await ctx.db.patch(order._id, { status: "paid" });
  }
}

async function loadOrderItems(
  ctx: QueryCtx | MutationCtx,
  orderId: Id<"orders">,
) {
  return ctx.db
    .query("orderItems")
    .withIndex("by_order", (q) => q.eq("orderId", orderId))
    .collect();
}

/** Place an order from the signed-in user's cart. Stock is reserved and the cart is emptied. */
export const placeOrder = mutation({
  args: {
    shippingAddress: shippingAddressValidator,
    paymentMethod: paymentMethodValidator,
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const cart = await ctx.db
      .query("carts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!cart) throw new Error("Your cart is empty.");
    const rows = await ctx.db
      .query("cartItems")
      .withIndex("by_cart", (q) => q.eq("cartId", cart._id))
      .collect();
    if (rows.length === 0) throw new Error("Your cart is empty.");

    const lines: { row: Doc<"cartItems">; product: Doc<"products"> }[] = [];
    for (const row of rows) {
      const product = await ctx.db.get(row.productId);
      if (!product || !product.isActive) {
        throw new Error("A product in your cart is no longer available.");
      }
      if (product.stockQuantity < row.quantity) {
        throw new Error(
          `Only ${product.stockQuantity} left of ${product.name}. Adjust your cart and try again.`,
        );
      }
      lines.push({ row, product });
    }

    const totalAmount = lines.reduce(
      (sum, l) => sum + l.product.price * l.row.quantity,
      0,
    );
    const address = args.shippingAddress;
    const code = generateOrderCode();
    const orderId = await ctx.db.insert("orders", {
      userId,
      code,
      status: "pending",
      totalAmount,
      shippingAddress: {
        fullName: address.fullName.trim(),
        street: address.street.trim(),
        city: address.city.trim(),
        state: address.state.trim(),
        postalCode: address.postalCode.trim(),
        country: address.country.trim(),
      },
    });
    for (const l of lines) {
      await ctx.db.insert("orderItems", {
        orderId,
        productId: l.product._id,
        productName: l.product.name,
        unitPrice: l.product.price,
        quantity: l.row.quantity,
      });
      await ctx.db.patch(l.product._id, {
        stockQuantity: l.product.stockQuantity - l.row.quantity,
      });
    }
    const paymentId = await ctx.db.insert("payments", {
      orderId,
      amount: totalAmount,
      status: "pending",
      method: args.paymentMethod,
    });
    await ctx.db.patch(orderId, { paymentId });
    for (const l of lines) {
      await ctx.db.delete(l.row._id);
    }
    return { orderId, code, totalAmount };
  },
});

/** Owner-readable checkout payload (used by the Stripe action). */
export const getForCheckout = query({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in to continue.");
    const order = await ctx.db.get(args.orderId);
    if (!order || order.userId !== userId) throw new Error("Order not found.");
    const items = await loadOrderItems(ctx, args.orderId);
    return {
      code: order.code,
      items: items.map((i) => ({
        productName: i.productName,
        unitPrice: i.unitPrice,
        quantity: i.quantity,
      })),
    };
  },
});

/**
 * Test-mode card payment: only allowed while this deployment has no Stripe key.
 * With a live Stripe key, payments are confirmed by the webhook instead.
 */
export const markPaid = mutation({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    if (process.env.STRIPE_SECRET_KEY) {
      throw new Error(
        "Card payments are processed by Stripe. Complete checkout there.",
      );
    }
    const order = await ctx.db.get(args.orderId);
    if (!order || order.userId !== userId) {
      throw new Error("Order not found.");
    }
    if (order.status !== "pending") {
      throw new Error("Only pending orders can be paid.");
    }
    const payment = order.paymentId ? await ctx.db.get(order.paymentId) : null;
    if (!payment || payment.method !== "card") {
      throw new Error("Only pending card payments can be marked paid.");
    }
    await applyPaid(ctx, order);
  },
});

/** Called by the Stripe webhook (internal — not reachable from the client). */
export const markPaidFromWebhook = internalMutation({
  args: { orderId: v.string() },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId as Id<"orders">);
    if (!order) return;
    await applyPaid(ctx, order);
  },
});

/** Owner cancels an order that has not been paid yet. Stock is restored. */
export const cancelMine = mutation({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order || order.userId !== userId) throw new Error("Order not found.");
    if (order.status !== "pending") {
      throw new Error("Only pending orders can be cancelled. Ask an admin.");
    }
    await cancelOrder(ctx, order);
  },
});

/** Shared cancel logic: restore stock and refund a paid payment. */
async function cancelOrder(ctx: MutationCtx, order: Doc<"orders">) {
  const items = await loadOrderItems(ctx, order._id);
  for (const item of items) {
    const product = await ctx.db.get(item.productId);
    if (product) {
      await ctx.db.patch(product._id, {
        stockQuantity: product.stockQuantity + item.quantity,
      });
    }
  }
  if (order.paymentId) {
    const payment = await ctx.db.get(order.paymentId);
    if (payment && payment.status === "paid") {
      await ctx.db.patch(order.paymentId, { status: "refunded" });
    }
  }
  await ctx.db.patch(order._id, { status: "cancelled" });
}

/** The signed-in user's orders, newest first, with items and payment info. */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    orders.sort((a, b) => b._creationTime - a._creationTime);
    const result = [];
    for (const order of orders) {
      const items = await loadOrderItems(ctx, order._id);
      const payment = order.paymentId ? await ctx.db.get(order.paymentId) : null;
      result.push({
        ...order,
        items: items.map((i) => ({
          productName: i.productName,
          unitPrice: i.unitPrice,
          quantity: i.quantity,
        })),
        paymentStatus: payment?.status ?? null,
        paymentMethod: payment?.method ?? null,
      });
    }
    return result;
  },
});

/** Admin: every order with the customer's name and email. */
export const adminList = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const orders = await ctx.db.query("orders").collect();
    orders.sort((a, b) => b._creationTime - a._creationTime);
    const result = [];
    for (const order of orders) {
      const customer = await ctx.db.get(order.userId);
      const payment = order.paymentId ? await ctx.db.get(order.paymentId) : null;
      result.push({
        _id: order._id,
        code: order.code,
        status: order.status,
        totalAmount: order.totalAmount,
        _creationTime: order._creationTime,
        customerName: customer?.name ?? customer?.email ?? "Unknown",
        customerEmail: customer?.email ?? null,
        paymentStatus: payment?.status ?? null,
        paymentMethod: payment?.method ?? null,
      });
    }
    return result;
  },
});

/** Admin: update order status. Cancelling restores stock and refunds paid payments. */
export const adminSetStatus = mutation({
  args: { orderId: v.id("orders"), status: orderStatusValidator },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found.");
    if (order.status === args.status) return;
    if (args.status === "cancelled") {
      await cancelOrder(ctx, order);
      return;
    }
    if (args.status === "paid") {
      await applyPaid(ctx, order);
      return;
    }
    await ctx.db.patch(args.orderId, { status: args.status });
  },
});

/** Admin: confirm a cash-on-delivery payment. */
export const adminMarkPaid = mutation({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found.");
    const payment = order.paymentId ? await ctx.db.get(order.paymentId) : null;
    if (!payment) throw new Error("This order has no payment record.");
    if (payment.status === "paid") {
      throw new Error("This payment is already marked as paid.");
    }
    await applyPaid(ctx, order);
  },
});
