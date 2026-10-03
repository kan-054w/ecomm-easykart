import { convexTest, type TestConvexForDataModel } from "convex-test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../convex/_generated/api.js";
import type { DataModel, Id } from "../convex/_generated/dataModel.js";
import schema from "../convex/schema.js";
import { modules } from "./setup.js";

/** Schema-typed data model so `t.run` knows table indexes and id brands. */
type TestConvexType = TestConvexForDataModel<DataModel>;

/** Create a user row + matching identity (subject parses as userId via "|"). */
async function asUser(
  t: TestConvexType,
  user: { role?: "admin" | "user" | "member" } = {},
) {
  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      ...(user.role !== undefined && { role: user.role }),
    }),
  );
  return { t: t.withIdentity({ subject: userId }), userId };
}

/** Insert one active product and return its id. */
async function insertProduct(
  t: TestConvexType,
  price: number,
  stockQuantity = 10,
): Promise<Id<"products">> {
  return t.run(async (ctx) =>
    ctx.db.insert("products", { name: "Test item", price, stockQuantity, isActive: true }),
  );
}

/** Put quantity of a product into the user's cart (creating it lazily). */
async function addToCart(
  t: TestConvexType,
  userId: Id<"users">,
  productId: Id<"products">,
  quantity: number,
) {
  await t.run(async (ctx) => {
    const cart = await ctx.db
      .query("carts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const cartId = cart?._id ?? (await ctx.db.insert("carts", { userId }));
    await ctx.db.insert("cartItems", { cartId, productId, quantity });
  });
}

describe("orders.placeOrder", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("totals use the stored price and empty the cart", async () => {
    const t = convexTest(schema, modules);
    const { t: tUser, userId } = await asUser(t);
    const headphonePrice = 249000; // ₹2,490.00 in paise
    const productId = await insertProduct(t, headphonePrice, 10);
    await addToCart(t, userId, productId, 2);

    const result = await tUser.mutation(api.orders.placeOrder, {
      shippingAddress: {
        fullName: "Ada",
        street: "1 MG Road",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        country: "India",
      },
      paymentMethod: "cash_on_delivery",
    });

    expect(result.totalAmount).toBe(498000); // ₹4,980.00
    expect(result.code).toMatch(/^EK-/);

    const cartCount = await t.run(async (ctx) => {
      const cart = await ctx.db
        .query("carts")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first();
      if (!cart) return 0;
      return (await ctx.db
        .query("cartItems")
        .withIndex("by_cart", (q) => q.eq("cartId", cart._id))
        .collect()).length;
    });
    expect(cartCount).toBe(0);
  });

  it("reserves stock and records the pending payment", async () => {
    const t = convexTest(schema, modules);
    const { t: tUser, userId } = await asUser(t);
    const productId = await insertProduct(t, 18000, 5);
    await addToCart(t, userId, productId, 3);

    const result = await tUser.mutation(api.orders.placeOrder, {
      shippingAddress: {
        fullName: "Ada",
        street: "1 MG Road",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        country: "India",
      },
      paymentMethod: "cash_on_delivery",
    });

    const { stockQuantity, product } = await t.run(async (ctx) => {
      const product = await ctx.db.get(productId);
      return { stockQuantity: product!.stockQuantity, product };
    });
    expect(stockQuantity).toBe(2);

    const payment = await t.run(async (ctx) => {
      const order = await ctx.db.get(result.orderId);
      return order?.paymentId ? ctx.db.get(order.paymentId) : null;
    });
    expect(payment?.status).toBe("pending");
    expect(payment?.amount).toBe(54000); // 3 × ₹180.00
  });

  it("rejects ordering more than the available stock", async () => {
    const t = convexTest(schema, modules);
    const { t: tUser, userId } = await asUser(t);
    const productId = await insertProduct(t, 18000, 1);
    await addToCart(t, userId, productId, 2);

    await expect(
      tUser.mutation(api.orders.placeOrder, {
        shippingAddress: {
          fullName: "Ada",
          street: "1 MG Road",
          city: "Bengaluru",
          state: "Karnataka",
          postalCode: "560001",
          country: "India",
        },
        paymentMethod: "cash_on_delivery",
      }),
    ).rejects.toThrow(/Only 1 left/);
  });

  it("refuses signed-out callers", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.orders.placeOrder, {
        shippingAddress: {
          fullName: "Ada",
          street: "1 MG Road",
          city: "Bengaluru",
          state: "Karnataka",
          postalCode: "560001",
          country: "India",
        },
        paymentMethod: "cash_on_delivery",
      }),
    ).rejects.toThrow(/Sign in to continue/);
  });
});

describe("orders.access control", () => {
  it("hides other users' orders from listMine", async () => {
    const t = convexTest(schema, modules);
    const { t: tUser, userId } = await asUser(t);
    const productId = await insertProduct(t, 18000, 5);
    await addToCart(t, userId, productId, 1);
    await tUser.mutation(api.orders.placeOrder, {
      shippingAddress: {
        fullName: "Ada",
        street: "1 MG Road",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        country: "India",
      },
      paymentMethod: "cash_on_delivery",
    });

    const { t: tOther } = await asUser(t);
    const others = await tOther.query(api.orders.listMine, {});
    expect(others).toHaveLength(0);
    const mine = await tUser.query(api.orders.listMine, {});
    expect(mine).toHaveLength(1);
  });

  it("blocks a customer from cancelling someone else's order", async () => {
    const t = convexTest(schema, modules);
    const { t: tUser, userId } = await asUser(t);
    const productId = await insertProduct(t, 18000, 5);
    await addToCart(t, userId, productId, 1);
    const result = await tUser.mutation(api.orders.placeOrder, {
      shippingAddress: {
        fullName: "Ada",
        street: "1 MG Road",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        country: "India",
      },
      paymentMethod: "cash_on_delivery",
    });

    const { t: tOther } = await asUser(t);
    await expect(
      tOther.mutation(api.orders.cancelMine, { orderId: result.orderId }),
    ).rejects.toThrow(/Order not found/);
  });
});
