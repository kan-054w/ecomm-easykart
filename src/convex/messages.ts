import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { requireUserId } from "./helpers";

const MAX_BODY = 2000;

/** Conversation rows for the signed-in user: partner, last message, unread count. */
export const listThreads = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const sent = await ctx.db
      .query("messages")
      .withIndex("by_sender", (q) => q.eq("senderId", userId))
      .collect();
    const received = await ctx.db
      .query("messages")
      .withIndex("by_recipient", (q) => q.eq("recipientId", userId))
      .collect();
    const combined = [...sent, ...received];
    combined.sort((a, b) => a._creationTime - b._creationTime);

    const threads = new Map<
      Id<"users">,
      { partnerId: Id<"users">; lastBody: string; lastAt: number; unread: number }
    >();
    for (const m of combined) {
      const partnerId = m.senderId === userId ? m.recipientId : m.senderId;
      const existing = threads.get(partnerId);
      const unreadInc = m.recipientId === userId && m.readAt === undefined ? 1 : 0;
      if (!existing) {
        threads.set(partnerId, {
          partnerId,
          lastBody: m.body,
          lastAt: m._creationTime,
          unread: unreadInc,
        });
      } else {
        existing.unread += unreadInc;
        existing.lastBody = m.body;
        existing.lastAt = m._creationTime;
      }
    }

    const result = [];
    const sorted = [...threads.values()].sort((a, b) => b.lastAt - a.lastAt);
    for (const t of sorted) {
      const partner = await ctx.db.get(t.partnerId);
      result.push({
        partnerId: t.partnerId,
        partnerName: partner?.name ?? partner?.email ?? "Teammate",
        partnerImage: partner?.image ?? null,
        lastBody: t.lastBody,
        lastAt: t.lastAt,
        unread: t.unread,
      });
    }
    return result;
  },
});

/** All messages between the signed-in user and a partner, oldest first. */
export const thread = query({
  args: { partnerId: v.id("users") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const sent = await ctx.db
      .query("messages")
      .withIndex("by_sender", (q) => q.eq("senderId", userId))
      .filter((q) => q.eq(q.field("recipientId"), args.partnerId))
      .collect();
    const received = await ctx.db
      .query("messages")
      .withIndex("by_recipient", (q) => q.eq("recipientId", userId))
      .filter((q) => q.eq(q.field("senderId"), args.partnerId))
      .collect();
    const combined = [...sent, ...received];
    combined.sort((a, b) => a._creationTime - b._creationTime);
    return combined;
  },
});

/** Mark every unread message from a partner as read. */
export const markThreadRead = mutation({
  args: { partnerId: v.id("users") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const unread = await ctx.db
      .query("messages")
      .withIndex("by_recipient", (q) => q.eq("recipientId", userId))
      .filter((q) => q.eq(q.field("senderId"), args.partnerId))
      .filter((q) => q.eq(q.field("readAt"), undefined))
      .collect();
    const now = Date.now();
    for (const m of unread) {
      await ctx.db.patch(m._id, { readAt: now });
    }
  },
});

/** Send a direct message to a teammate. */
export const send = mutation({
  args: { recipientId: v.id("users"), body: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const body = args.body.trim();
    if (!body) throw new Error("Write a message first.");
    if (body.length > MAX_BODY) {
      throw new Error(`Keep messages under ${MAX_BODY} characters.`);
    }
    if (args.recipientId === userId) {
      throw new Error("You cannot message yourself.");
    }
    const recipient = await ctx.db.get(args.recipientId);
    if (!recipient) throw new Error("That teammate no longer exists.");
    await ctx.db.insert("messages", {
      senderId: userId,
      recipientId: args.recipientId,
      body,
    });
  },
});

/** Total unread messages for the signed-in user (header badge). */
export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return 0;
    const unread = await ctx.db
      .query("messages")
      .withIndex("by_recipient", (q) => q.eq("recipientId", userId))
      .filter((q) => q.eq(q.field("readAt"), undefined))
      .collect();
    return unread.length;
  },
});
