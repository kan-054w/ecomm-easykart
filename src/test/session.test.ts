import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../convex/_generated/api.js";
import schema from "../convex/schema.js";
import { modules } from "./setup.js";

type TestConvexType = ReturnType<typeof convexTest>;

/**
 * Helper: create a user row directly in the `users` table and produce a
 * convex-test identity whose subject resolves to that user id.
 *
 * getAuthUserId() parses `identity.subject.split("|")[0]` as the user id, so
 * withIdentity({ subject: `${userId}` }) makes function calls run "as" that
 * user. This mirrors how @convex-dev/auth issues subjects in production.
 *
 * NOTE: mutation results are JSON-serialized, so handlers that `return`
 * nothing resolve to `null` (never `undefined`) in tests — same as production.
 */
async function asUser(
  t: TestConvexType,
  user: {
    name?: string;
    email?: string;
    isAnonymous?: boolean;
    role?: "admin" | "user" | "member";
  },
) {
  const userId = await t.run(async (ctx) => {
    return ctx.db.insert("users", {
      ...(user.name !== undefined && { name: user.name }),
      ...(user.email !== undefined && { email: user.email }),
      ...(user.isAnonymous !== undefined && { isAnonymous: user.isAnonymous }),
      ...(user.role !== undefined && { role: user.role }),
    });
  });
  return { t: t.withIdentity({ subject: userId as string }), userId };
}

describe("session.canClaimAdmin / session.claimAdmin", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("allows the first signed-in non-anonymous user to claim admin", async () => {
    const t = convexTest(schema, modules);
    const { t: tUser, userId } = await asUser(t, {
      name: "Ada",
      email: "ada@team.test",
    });

    await expect(tUser.query(api.session.canClaimAdmin)).resolves.toBe(true);
    await expect(tUser.mutation(api.session.claimAdmin)).resolves.toBeNull();

    const role = await t.run(async (ctx) => {
      const user = await ctx.db.get(userId);
      return user?.role;
    });
    expect(role).toBe("admin");
  });

  it("rejects anonymous (guest) users from claiming admin", async () => {
    const t = convexTest(schema, modules);
    const { t: tGuest } = await asUser(t, {
      name: "Guest",
      isAnonymous: true,
    });

    await expect(tGuest.query(api.session.canClaimAdmin)).resolves.toBe(false);
    await expect(tGuest.mutation(api.session.claimAdmin)).rejects.toThrow(
      /Guest sessions cannot become admins/,
    );
  });

  it("rejects unauthenticated callers", async () => {
    const t = convexTest(schema, modules);

    await expect(t.query(api.session.canClaimAdmin)).resolves.toBe(false);
    await expect(t.mutation(api.session.claimAdmin)).rejects.toThrow(
      /Sign in to continue/,
    );
  });

  it("rejects a second claimer once an admin already exists", async () => {
    const t = convexTest(schema, modules);
    const { t: tAdmin } = await asUser(t, {
      name: "First Admin",
      email: "first@team.test",
      role: "admin",
    });
    const { t: tSecond } = await asUser(t, {
      name: "Second",
      email: "second@team.test",
    });

    // Sanity: the existing admin can still see their claim is moot.
    await expect(tAdmin.query(api.session.canClaimAdmin)).resolves.toBe(false);
    await expect(tSecond.query(api.session.canClaimAdmin)).resolves.toBe(false);
    await expect(tSecond.mutation(api.session.claimAdmin)).rejects.toThrow(
      /An admin already exists/,
    );
  });

  it("is idempotent for an existing admin", async () => {
    const t = convexTest(schema, modules);
    const { t: tAdmin } = await asUser(t, {
      name: "First Admin",
      email: "first@team.test",
      role: "admin",
    });

    await expect(tAdmin.mutation(api.session.claimAdmin)).resolves.toBeNull();
  });
});

describe("admin.setUserRole (admin-only management)", () => {
  it("blocks non-admins from changing roles", async () => {
    const t = convexTest(schema, modules);
    const { t: tUser, userId: targetId } = await asUser(t, {
      name: "Target",
      email: "target@team.test",
    });
    const { t: tOther } = await asUser(t, {
      name: "Peon",
      email: "peon@team.test",
    });

    await expect(
      tOther.mutation(api.admin.setUserRole, {
        userId: targetId,
        role: "admin",
      }),
    ).rejects.toThrow(/Admin access required/);

    const role = await t.run(async (ctx) => {
      const user = await ctx.db.get(targetId);
      return user?.role ?? null;
    });
    expect(role).toBeNull();
  });

  it("lets an admin promote and demote another user", async () => {
    const t = convexTest(schema, modules);
    const { t: tAdmin } = await asUser(t, {
      name: "Boss",
      email: "boss@team.test",
      role: "admin",
    });
    const { t: tMember, userId: memberId } = await asUser(t, {
      name: "Member",
      email: "member@team.test",
    });

    await tAdmin.mutation(api.admin.setUserRole, {
      userId: memberId,
      role: "admin",
    });
    let role = await t.run(async (ctx) => (await ctx.db.get(memberId))?.role);
    expect(role).toBe("admin");

    await tAdmin.mutation(api.admin.setUserRole, {
      userId: memberId,
      role: "user",
    });
    role = await t.run(async (ctx) => (await ctx.db.get(memberId))?.role);
    expect(role).toBe("user");
  });

  it("prevents an admin from changing their own role", async () => {
    const t = convexTest(schema, modules);
    const { t: tAdmin, userId: adminId } = await asUser(t, {
      name: "Boss",
      email: "boss@team.test",
      role: "admin",
    });

    await expect(
      tAdmin.mutation(api.admin.setUserRole, { userId: adminId, role: "user" }),
    ).rejects.toThrow(/You cannot change your own role/);
  });
});

describe("admin.isCurrentUserAdmin", () => {
  it("reflects the user's role", async () => {
    const t = convexTest(schema, modules);
    const { t: tAdmin } = await asUser(t, {
      name: "Boss",
      email: "boss@team.test",
      role: "admin",
    });
    const { t: tUser } = await asUser(t, {
      name: "Peon",
      email: "peon@team.test",
    });

    await expect(tAdmin.query(api.admin.isCurrentUserAdmin)).resolves.toBe(true);
    await expect(tUser.query(api.admin.isCurrentUserAdmin)).resolves.toBe(false);
  });
});
