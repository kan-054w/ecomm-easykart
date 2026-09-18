import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ArrowLeft, Mail, Send, UserPlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export default function Messages() {
  const threads = useQuery(api.messages.listThreads, {});
  const teammates = useQuery(api.users.listTeammates, {});

  const [activeId, setActiveId] = useState<Id<"users"> | null>(null);

  const activeThread = threads?.find((t) => t.partnerId === activeId) ?? null;
  const activePartner = activeThread
    ? { name: activeThread.partnerName }
    : teammates?.find((t) => t._id === activeId)
      ? { name: teammates.find((t) => t._id === activeId)!.name ?? "Teammate" }
      : null;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
        <p className="eyebrow">Messages</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Direct messages
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          Ask about an order or an item without leaving the store.
        </p>

        <div className="mt-10 grid gap-8 md:grid-cols-[300px_1fr]">
          {/* Thread list */}
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-medium tracking-tight">Conversations</h2>
              <div className="mt-4 space-y-2">
                {threads === undefined ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                  ))
                ) : threads.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
                    No conversations yet.
                  </p>
                ) : (
                  threads.map((t) => (
                    <button
                      key={t.partnerId}
                      type="button"
                      onClick={() => setActiveId(t.partnerId)}
                      className={cn(
                        "block w-full rounded-lg border px-4 py-3 text-left transition-colors",
                        activeId === t.partnerId
                          ? "border-foreground"
                          : "border-border/60 hover:border-foreground/40",
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">
                          {t.partnerName}
                        </span>
                        {t.unread > 0 && (
                          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                            {t.unread}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {t.lastBody}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-medium tracking-tight">
                Start a new one
              </h2>
              <div className="mt-4 space-y-2">
                {teammates === undefined ? null : teammates.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No teammates to message yet.
                  </p>
                ) : (
                  teammates
                    .filter((t) => !threads?.some((th) => th.partnerId === t._id))
                    .map((t) => (
                      <button
                        key={t._id}
                        type="button"
                        onClick={() => setActiveId(t._id)}
                        className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <span className="flex size-7 items-center justify-center rounded-full border border-border/70 text-[11px] font-semibold uppercase">
                          {(t.name ?? t.email ?? "?").charAt(0).toUpperCase()}
                        </span>
                        <span className="truncate">{t.name ?? t.email}</span>
                        <UserPlus className="ml-auto size-3.5 opacity-50" />
                      </button>
                    ))
                )}
              </div>
            </div>
          </div>

          {/* Thread view */}
          <div className="min-h-[420px] rounded-lg border border-border/70">
            {activeId && activePartner ? (
              <ThreadView
                key={activeId}
                partnerId={activeId}
                partnerName={activePartner.name}
                onBack={() => setActiveId(null)}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center px-6 py-20 text-center">
                <Mail
                  className="size-8 text-muted-foreground/50"
                  strokeWidth={1.25}
                />
                <p className="mt-4 text-sm font-medium">Select a conversation</p>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                  Pick a teammate from the left to start a conversation.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function ThreadView({
  partnerId,
  partnerName,
  onBack,
}: {
  partnerId: Id<"users">;
  partnerName: string;
  onBack: () => void;
}) {
  const messages = useQuery(api.messages.thread, { partnerId });
  const send = useMutation(api.messages.send);
  const markRead = useMutation(api.messages.markThreadRead);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    markRead({ partnerId }).catch(() => undefined);
  }, [partnerId, markRead, messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setSending(true);
    try {
      await send({ recipientId: partnerId, body: text });
      setBody("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border/70 px-5 py-3.5">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
          aria-label="Back"
        >
          <ArrowLeft className="size-4" />
        </button>
        <span className="flex size-8 items-center justify-center rounded-full border border-border/80 text-xs font-semibold uppercase">
          {partnerName.charAt(0).toUpperCase()}
        </span>
        <p className="text-sm font-medium">{partnerName}</p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-5">
        {messages === undefined ? (
          <Skeleton className="h-20 w-2/3 rounded-lg" />
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No messages yet — say hello.
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m._id}
              className={cn(
                "max-w-[75%] rounded-lg px-4 py-2.5 text-sm leading-6",
                m.senderId === partnerId
                  ? "border border-border/60 bg-muted/50"
                  : "ml-auto bg-foreground text-background",
              )}
            >
              <p className="whitespace-pre-line">{m.body}</p>
              <p
                className={cn(
                  "mt-1 text-[10px]",
                  m.senderId === partnerId ? "text-muted-foreground" : "text-background/60",
                )}
              >
                {formatRelative(m._creationTime)}
              </p>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="border-t border-border/70 p-4">
        <div className="flex items-end gap-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend(e);
              }
            }}
            placeholder={`Message ${partnerName}…`}
            rows={2}
            className="min-h-0 flex-1 resize-none"
          />
          <Button type="submit" size="icon" disabled={sending || !body.trim()} aria-label="Send">
            <Send className="size-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
