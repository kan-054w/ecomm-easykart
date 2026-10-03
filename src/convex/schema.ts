import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

export const orderStatusValidator = v.union(
  v.literal("pending"),
  v.literal("paid"),
  v.literal("shipped"),
  v.literal("delivered"),
  v.literal("cancelled"),
);
export type OrderStatus = Infer<typeof orderStatusValidator>;

export const paymentStatusValidator = v.union(
  v.literal("pending"),
  v.literal("paid"),
  v.literal("failed"),
  v.literal("refunded"),
);

export const paymentMethodValidator = v.union(
  v.literal("card"),
  v.literal("cash_on_delivery"),
);

export const bookingStatusValidator = v.union(
  v.literal("scheduled"),
  v.literal("completed"),
  v.literal("cancelled"),
);
export type BookingStatus = Infer<typeof bookingStatusValidator>;

export const postStatusValidator = v.union(
  v.literal("draft"),
  v.literal("published"),
);

// ERD entity: User → (Customer | Admin) discriminated by `role`
// ERD entity: Address (customer shipping addresses)
// ERD entity: Category, Product, Cart, CartItem, Orders, OrderItem, Payment
const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user (Customer | Admin). do not remove
      phone: v.optional(v.string()), // Customer.phone from the ERD
    }).index("email", ["email"]), // index for the email. do not remove or modify

    addresses: defineTable({
      userId: v.id("users"),
      label: v.string(), // "Home", "Studio", ...
      fullName: v.string(),
      street: v.string(),
      city: v.string(),
      state: v.string(),
      postalCode: v.string(),
      country: v.string(),
      isDefault: v.boolean(),
    }).index("by_user", ["userId"]),

    categories: defineTable({
      name: v.string(),
      description: v.optional(v.string()),
    }).index("by_name", ["name"]),

    products: defineTable({
      name: v.string(),
      description: v.optional(v.string()),
      price: v.number(), // minor units (paise)
      stockQuantity: v.number(),
      imageUrl: v.optional(v.string()),
      imageStorageId: v.optional(v.id("_storage")), // uploaded product photo
      categoryId: v.optional(v.id("categories")),
      isActive: v.boolean(),
    })
      .index("by_category", ["categoryId"])
      .index("by_active", ["isActive"]),

    carts: defineTable({
      userId: v.id("users"), // one cart per customer
    }).index("by_user", ["userId"]),

    cartItems: defineTable({
      cartId: v.id("carts"),
      productId: v.id("products"),
      quantity: v.number(),
    })
      .index("by_cart", ["cartId"])
      .index("by_cart_product", ["cartId", "productId"]),

    orders: defineTable({
      userId: v.id("users"),
      code: v.string(), // human readable ORDER_ID, e.g. MO-8F3K2A
      status: orderStatusValidator,
      totalAmount: v.number(),
      shippingAddress: v.object({
        fullName: v.string(),
        street: v.string(),
        city: v.string(),
        state: v.string(),
        postalCode: v.string(),
        country: v.string(),
      }),
      paymentId: v.optional(v.id("payments")),
    })
      .index("by_user", ["userId"])
      .index("by_code", ["code"])
      .index("by_status", ["status"]),

    orderItems: defineTable({
      orderId: v.id("orders"),
      productId: v.id("products"),
      productName: v.string(), // snapshot at purchase time
      unitPrice: v.number(), // price_at_purchase snapshot (paise)
      quantity: v.number(),
    }).index("by_order", ["orderId"]),

    payments: defineTable({
      orderId: v.id("orders"),
      amount: v.number(),
      status: paymentStatusValidator,
      method: paymentMethodValidator,
      paidAt: v.optional(v.number()),
    }).index("by_order", ["orderId"]),

    // ERD entity: Booking (team scheduling — pickups, equipment returns, etc.)
    bookings: defineTable({
      userId: v.id("users"),
      title: v.string(),
      notes: v.optional(v.string()),
      startAt: v.number(), // epoch ms
      durationMinutes: v.number(),
      status: bookingStatusValidator,
    })
      .index("by_user", ["userId"])
      .index("by_start", ["startAt"]),

    // ERD entity: Post (team-authored content) + PostComment
    posts: defineTable({
      authorId: v.id("users"),
      title: v.string(),
      body: v.string(),
      imageUrl: v.optional(v.string()),
      status: postStatusValidator,
    })
      .index("by_author", ["authorId"])
      .index("by_status", ["status"]),

    postComments: defineTable({
      postId: v.id("posts"),
      authorId: v.id("users"),
      body: v.string(),
    }).index("by_post", ["postId"]),

    // ERD entity: Message (direct messages between team members)
    messages: defineTable({
      senderId: v.id("users"),
      recipientId: v.id("users"),
      body: v.string(),
      readAt: v.optional(v.number()),
    })
      .index("by_sender", ["senderId"])
      .index("by_recipient", ["recipientId"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
