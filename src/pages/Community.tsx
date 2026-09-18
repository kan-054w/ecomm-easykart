import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  MessageSquare,
  Megaphone,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface PostSummary {
  _id: Id<"posts">;
  title: string;
  body: string;
  imageUrl?: string;
  status: "draft" | "published";
  authorName: string;
  commentCount: number;
  _creationTime: number;
}

export default function Community() {
  const posts = useQuery(api.posts.listPublished, {});
  const mine = useQuery(api.posts.listMine, {});
  const remove = useMutation(api.posts.remove);
  const [selectedId, setSelectedId] = useState<Id<"posts"> | null>(null);

  const selected = posts?.find((p) => p._id === selectedId) ?? null;

  const draftIds = new Set((mine ?? []).filter((p) => p.status === "draft").map((p) => p._id));
  const myPublished = (mine ?? []).filter((p) => p.status === "published");

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
        <p className="eyebrow">Community</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Team bulletin board
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          Announce new arrivals, share picks, and ask questions. Everyone on the
          team can publish and comment.
        </p>

        <div className="mt-10 grid items-start gap-12 lg:grid-cols-[1fr_360px]">
          {/* Feed / detail */}
          <div>
            {selected ? (
              <PostDetail
                postId={selected._id}
                onBack={() => setSelectedId(null)}
                canDelete={
                  myPublished.some((p) => p._id === selected._id) ||
                  draftIds.has(selected._id)
                }
                onDelete={async () => {
                  try {
                    await remove({ id: selected._id });
                    setSelectedId(null);
                    toast("Post deleted.");
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Could not delete post.");
                  }
                }}
              />
            ) : (
              <>
                <h2 className="text-sm font-medium tracking-tight">Latest posts</h2>
                <Separator className="my-4" />
                {posts === undefined ? (
                  <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-24 w-full rounded-lg" />
                    ))}
                  </div>
                ) : posts.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
                    <Megaphone
                      className="mx-auto size-8 text-muted-foreground/50"
                      strokeWidth={1.25}
                    />
                    <p className="mt-4 text-sm font-medium">No posts yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Write the first announcement for the team.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/70 border-y border-border/70">
                    {posts.map((post) => (
                      <button
                        key={post._id}
                        type="button"
                        onClick={() => setSelectedId(post._id)}
                        className="block w-full px-1 py-5 text-left transition-colors hover:bg-muted/40"
                      >
                        <p className="text-sm font-medium">{post.title}</p>
                        <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                          {post.body}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground/80">
                          {post.authorName} · {formatRelative(post._creationTime)} ·{" "}
                          {post.commentCount} comment{post.commentCount === 1 ? "" : "s"}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Composer + drafts */}
          <aside className="space-y-8">
            <Composer />
            {(mine?.length ?? 0) > 0 && (
              <section>
                <h2 className="text-sm font-medium tracking-tight">Your posts</h2>
                <Separator className="my-4" />
                <ul className="space-y-3">
                  {(mine ?? []).map((p) => (
                    <li
                      key={p._id}
                      className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{p.title}</p>
                        <p
                          className={cn(
                            "mt-0.5 text-xs",
                            p.status === "draft"
                              ? "text-amber-600"
                              : "text-muted-foreground",
                          )}
                        >
                          {p.status === "draft" ? "Draft" : "Published"} ·{" "}
                          {formatRelative(p._creationTime)}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label={`Delete ${p.title}`}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                        onClick={async () => {
                          try {
                            await remove({ id: p._id });
                            if (selectedId === p._id) setSelectedId(null);
                            toast("Post deleted.");
                          } catch (err) {
                            toast.error(
                              err instanceof Error ? err.message : "Could not delete post.",
                            );
                          }
                        }}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Composer() {
  const create = useMutation(api.posts.create);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (publish: boolean) => {
    setSaving(true);
    try {
      await create({
        title,
        body,
        imageUrl: imageUrl.trim() ? imageUrl : undefined,
        publish,
      });
      toast.success(publish ? "Published" : "Draft saved");
      setTitle("");
      setBody("");
      setImageUrl("");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the post.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <Button className="w-full" onClick={() => setOpen(true)}>
        <Plus className="mr-2 size-4" />
        New post
      </Button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit(true);
      }}
      className="space-y-4 rounded-lg border border-border/70 p-5"
    >
      <h2 className="text-sm font-semibold tracking-tight">Write a post</h2>
      <div className="space-y-1.5">
        <Label htmlFor="post-title">Title</Label>
        <Input
          id="post-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What's new?"
          maxLength={140}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="post-body">Body</Label>
        <Textarea
          id="post-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="post-image">Image URL (optional)</Label>
        <Input
          id="post-image"
          type="url"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://…"
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          Publish
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={saving}
          onClick={() => void submit(false)}
        >
          Save draft
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function PostDetail({
  postId,
  onBack,
  canDelete,
  onDelete,
}: {
  postId: Id<"posts">;
  onBack: () => void;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const post = useQuery(api.posts.get, { id: postId });
  const addComment = useMutation(api.posts.addComment);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);

  if (post === undefined) {
    return <Skeleton className="h-64 w-full rounded-lg" />;
  }
  if (post === null) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm font-medium">Post not found</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={onBack}>
          <ArrowLeft className="mr-2 size-3.5" />
          Back to the feed
        </Button>
      </div>
    );
  }

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      await addComment({ postId, body: comment });
      setComment("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not comment.");
    } finally {
      setSending(false);
    }
  };

  return (
    <article>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        All posts
      </button>
      <h2 className="mt-4 text-2xl font-semibold tracking-tight">{post.title}</h2>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
        <span>{post.authorName}</span>
        <span>{formatRelative(post._creationTime)}</span>
        {post.status === "draft" && (
          <span className="rounded-full border border-border px-2 py-0.5">Draft</span>
        )}
      </p>
      {post.imageUrl && (
        <img
          src={post.imageUrl}
          alt=""
          className="mt-6 max-h-96 w-full rounded-lg border border-border/60 object-cover"
        />
      )}
      <div className="mt-6 whitespace-pre-line text-sm leading-7 text-foreground/90">
        {post.body}
      </div>
      {canDelete && (
        <div className="mt-6 flex gap-2">
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2 className="mr-1.5 size-3.5" />
            Delete post
          </Button>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Pencil className="size-3" />
            Editing lives in your posts list
          </span>
        </div>
      )}

      <Separator className="my-8" />
      <h3 className="flex items-center gap-2 text-sm font-medium tracking-tight">
        <MessageSquare className="size-4 text-muted-foreground" />
        {post.comments.length} comment{post.comments.length === 1 ? "" : "s"}
      </h3>
      <div className="mt-4 space-y-4">
        {post.comments.map((c) => (
          <div key={c._id} className="rounded-lg border border-border/60 px-4 py-3">
            <p className="text-xs text-muted-foreground">
              {c.authorName} · {formatRelative(c._creationTime)}
            </p>
            <p className="mt-1.5 whitespace-pre-line text-sm leading-6">{c.body}</p>
          </div>
        ))}
      </div>
      <form onSubmit={submitComment} className="mt-6 space-y-3">
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Add a comment…"
          rows={3}
          required
        />
        <Button type="submit" size="sm" disabled={sending || !comment.trim()}>
          {sending ? "Posting…" : "Comment"}
        </Button>
      </form>
    </article>
  );
}
