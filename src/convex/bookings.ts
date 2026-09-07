import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { bookingStatusValidator } from "./schema";
import { requireAdmin, requireUserId } from "./helpers";

const MIN_MINUTES = 15;
const MAX_MINUTES = 240;
const START_HOUR = 8; // earliest slot start, local time
const END_HOUR = 20; // latest slot start, local time

/**
 * Book a time slot on the shared team calendar. Slots are 15–240 minutes,
 * must be in the future, must start between 08:00 and 20:00, and cannot
 * overlap another scheduled slot.
 */
export const create = mutation({
  args: {
    title: v.string(),
    notes: v.optional(v.string()),
    startAt: v.number(),
    durationMinutes: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const title = args.title.trim();
    if (!title) throw new Error("Give the booking a title.");
    if (title.length > 120) throw new Error("Keep the title under 120 characters.");

    const duration = Math.round(args.durationMinutes);
    if (duration < MIN_MINUTES || duration > MAX_MINUTES) {
      throw new Error(
        `Choose a duration between ${MIN_MINUTES} and ${MAX_MINUTES} minutes.`,
      );
    }

    const now = Date.now();
    if (args.startAt < now) throw new Error("Pick a time in the future.");

    const startHour = new Date(args.startAt).getHours();
    if (startHour < START_HOUR || startHour >= END_HOUR) {
      throw new Error(
        `Bookings must start between ${START_HOUR}:00 and ${END_HOUR}:00.`,
      );
    }

    const end = args.startAt + duration * 60_000;
    const scheduled = await ctx.db.query("bookings").collect();
    for (const b of scheduled) {
      if (b.status !== "scheduled") continue;
      const bEnd = b.startAt + b.durationMinutes * 60_000;
      if (args.startAt < bEnd && b.startAt < end) {
        throw new Error(
          "That slot overlaps another booking. Pick a different time.",
        );
      }
    }

    return await ctx.db.insert("bookings", {
      userId,
      title,
      notes: args.notes?.trim() ? args.notes.trim() : undefined,
      startAt: args.startAt,
      durationMinutes: duration,
      status: "scheduled",
    });
  },
});

/** The signed-in user's bookings, newest first. */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    bookings.sort((a, b) => b.startAt - a.startAt);
    return bookings;
  },
});

/** Owner cancels one of their scheduled bookings. */
export const cancel = mutation({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const booking = await ctx.db.get(args.bookingId);
    if (!booking || booking.userId !== userId) {
      throw new Error("Booking not found.");
    }
    if (booking.status !== "scheduled") {
      throw new Error("Only scheduled bookings can be cancelled.");
    }
    await ctx.db.patch(args.bookingId, { status: "cancelled" });
  },
});

/** Admin: every booking with the booker's name and email. */
export const adminList = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const bookings = await ctx.db.query("bookings").collect();
    bookings.sort((a, b) => b.startAt - a.startAt);
    const result = [];
    for (const b of bookings) {
      const user = await ctx.db.get(b.userId);
      result.push({
        ...b,
        userName: user?.name ?? user?.email ?? "Unknown",
        userEmail: user?.email ?? null,
      });
    }
    return result;
  },
});

/** Admin: mark a booking completed or cancelled. */
export const adminSetStatus = mutation({
  args: { bookingId: v.id("bookings"), status: bookingStatusValidator },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) throw new Error("Booking not found.");
    await ctx.db.patch(args.bookingId, { status: args.status });
  },
});
