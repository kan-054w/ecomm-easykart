import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { requireUserId } from "./helpers";

const MAX_TITLE = 140;
const MAX_BODY = 5000;
const MAX_COMMENT = 1000;

/** Best-effort display name for a user. */
async function authorName(
  ctx: QueryCtx,
  authorId: Id<"users">,
): Promise<string> {
  const user = await ctx.db.get(authorId);
  return user?.name ?? user?.email ?? "Teammate";
}

/** Published posts, newest first, with author and comment counts. */
export const listPublished = query({
  args: {},
  handler: async (ctx) => {
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .collect();
    posts.sort((a, b) => b._creationTime - a._creationTime);
    const result = [];
    for (const post of posts) {
      const comments = await ctx.db
        .query("postComments")
        .withIndex("by_post", (q) => q.eq("postId", post._id))
        .collect();
      result.push({
        ...post,
        authorName: await authorName(ctx, post.authorId),
        commentCount: comments.length,
      });
    }
    return result;
  },
});

/** One post with its comments. Drafts are visible only to the author or an admin. */
export const get = query({
  args: { id: v.id("posts") },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.id);
    if (!post) return null;
    const userId = await getAuthUserId(ctx);
    const isAuthor = userId !== null && post.authorId === userId;
    let isAdmin = false;
    if (userId !== null) {
      const user = await ctx.db.get(userId);
      isAdmin = user?.role === "admin";
    }
    if (post.status === "draft" && !isAuthor && !isAdmin) return null;
    const comments = await ctx.db
      .query("postComments")
      .withIndex("by_post", (q) => q.eq("postId", args.id))
      .collect();
    comments.sort((a, b) => a._creationTime - b._creationTime);
    return {
      ...post,
      isAuthor,
      canModerate: isAuthor || isAdmin,
      authorName: await authorName(ctx, post.authorId),
      comments: await Promise.all(
        comments.map(async (c) => ({
          ...c,
          authorName: await authorName(ctx, c.authorId),
        })),
      ),
    };
  },
});

/** Create a post, optionally saving it as a draft. */
export const create = mutation({
  args: {
    title: v.string(),
    body: v.string(),
    imageUrl: v.optional(v.string()),
    publish: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const title = args.title.trim();
    const body = args.body.trim();
    if (!title) throw new Error("Give the post a title.");
    if (title.length > MAX_TITLE) {
      throw new Error(`Keep the title under ${MAX_TITLE} characters.`);
    }
    if (!body) throw new Error("Write something before saving.");
    if (body.length > MAX_BODY) {
      throw new Error(`Keep the post under ${MAX_BODY} characters.`);
    }
    let imageUrl: string | undefined = undefined;
    if (args.imageUrl?.trim()) {
      const url = args.imageUrl.trim();
      if (!/^https?:\/\//.test(url)) {
        throw new Error("The image link must start with http:// or https://.");
      }
      imageUrl = url;
    }
    return await ctx.db.insert("posts", {
      authorId: userId,
      title,
      body,
      imageUrl,
      status: args.publish ? "published" : "draft",
    });
  },
});

/** Update a post you wrote (or one you moderate). */
export const update = mutation({
  args: {
    id: v.id("posts"),
    title: v.string(),
    body: v.string(),
    imageUrl: v.optional(v.string()),
    publish: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const post = await ctx.db.get(args.id);
    if (!post) throw new Error("Post not found.");
    const user = await ctx.db.get(userId);
    if (post.authorId !== userId && user?.role !== "admin") {
      throw new Error("You can only edit your own posts.");
    }
    const title = args.title.trim();
    const body = args.body.trim();
    if (!title || !body) throw new Error("Title and body are required.");
    if (title.length > MAX_TITLE) {
      throw new Error(`Keep the title under ${MAX_TITLE} characters.`);
    }
    if (body.length > MAX_BODY) {
      throw new Error(`Keep the post under ${MAX_BODY} characters.`);
    }
    await ctx.db.patch(args.id, {
      title,
      body,
      imageUrl: args.imageUrl?.trim() ? args.imageUrl.trim() : undefined,
      status: args.publish ? "published" : "draft",
    });
  },
});

/** Delete a post (author or admin) along with its comments. */
export const remove = mutation({
  args: { id: v.id("posts") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const post = await ctx.db.get(args.id);
    if (!post) return;
    const user = await ctx.db.get(userId);
    if (post.authorId !== userId && user?.role !== "admin") {
      throw new Error("You can only delete your own posts.");
    }
    const comments = await ctx.db
      .query("postComments")
      .withIndex("by_post", (q) => q.eq("postId", args.id))
      .collect();
    for (const c of comments) {
      await ctx.db.delete(c._id);
    }
    await ctx.db.delete(args.id);
  },
});

/** Comment on a published (or your own draft) post. */
export const addComment = mutation({
  args: { postId: v.id("posts"), body: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const post = await ctx.db.get(args.postId);
    if (!post) throw new Error("Post not found.");
    const body = args.body.trim();
    if (!body) throw new Error("Write a comment first.");
    if (body.length > MAX_COMMENT) {
      throw new Error(`Keep comments under ${MAX_COMMENT} characters.`);
    }
    await ctx.db.insert("postComments", {
      postId: args.postId,
      authorId: userId,
      body,
    });
  },
});

/** Delete a comment (comment author or admin). */
export const removeComment = mutation({
  args: { commentId: v.id("postComments") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const comment = await ctx.db.get(args.commentId);
    if (!comment) return;
    const user = await ctx.db.get(userId);
    if (comment.authorId !== userId && user?.role !== "admin") {
      throw new Error("You can only delete your own comments.");
    }
    await ctx.db.delete(args.commentId);
  },
});
