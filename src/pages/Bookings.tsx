import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  BOOKING_STATUS_LABELS,
  formatDateTime,
  formatDuration,
  formatRelative,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { CalendarClock, Clock, NotebookPen, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function Bookings() {
  const bookings = useQuery(api.bookings.listMine, {});
  const create = useMutation(api.bookings.create);
  const cancel = useMutation(api.bookings.cancel);

  const defaultStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return toLocalInputValue(d);
  }, []);

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [startAt, setStartAt] = useState(defaultStart);
  const [duration, setDuration] = useState("30");
  const [saving, setSaving] = useState(false);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const ts = new Date(startAt).getTime();
    if (!Number.isFinite(ts)) {
      toast.error("Pick a valid date and time.");
      return;
    }
    setSaving(true);
    try {
      await create({
        title,
        notes: notes.trim() ? notes : undefined,
        startAt: ts,
        durationMinutes: Number(duration),
      });
      toast.success("Slot reserved", {
        description: `${title} — ${formatDateTime(ts)}`,
      });
      setTitle("");
      setNotes("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reserve the slot.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (id: Id<"bookings">) => {
    try {
      await cancel({ bookingId: id });
      toast("Booking cancelled.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not cancel booking.");
    }
  };

  const sorted = useMemo(() => {
    const list = bookings ?? [];
    const now = Date.now();
    const upcoming = list
      .filter((b) => b.status === "scheduled" && b.startAt + b.durationMinutes * 60_000 >= now)
      .sort((a, b) => a.startAt - b.startAt);
    const past = list.filter((b) => !upcoming.includes(b));
    return { upcoming, past };
  }, [bookings]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
        <p className="eyebrow">Bookings</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Shared team calendar
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          Reserve delivery or pickup slots so gear arrives when someone is around.
          Slots run between 08:00 and 20:00 and can&apos;t overlap.
        </p>

        <div className="mt-10 grid items-start gap-12 lg:grid-cols-[380px_1fr]">
          {/* New booking */}
          <form
            onSubmit={handleCreate}
            className="space-y-4 rounded-lg border border-border/70 p-6"
          >
            <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <NotebookPen className="size-4 text-muted-foreground" />
              Reserve a slot
            </h2>
            <div className="space-y-1.5">
              <Label htmlFor="bk-title">Title</Label>
              <Input
                id="bk-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Receive order EK-…"
                required
                maxLength={120}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="bk-start">Starts</Label>
                <Input
                  id="bk-start"
                  type="datetime-local"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bk-duration">Duration</Label>
                <select
                  id="bk-duration"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {["15", "30", "45", "60", "90", "120"].map((m) => (
                    <option key={m} value={m}>
                      {formatDuration(Number(m))}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bk-notes">Notes (optional)</Label>
              <Textarea
                id="bk-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Dock entrance, second floor…"
                rows={3}
              />
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              <CalendarClock className="mr-2 size-4" />
              {saving ? "Reserving…" : "Reserve slot"}
            </Button>
          </form>

          {/* List */}
          <div className="space-y-10">
            <section>
              <h2 className="text-sm font-medium tracking-tight">Upcoming</h2>
              <div className="mt-4 space-y-3">
                {bookings === undefined ? (
                  Array.from({ length: 2 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-lg" />
                  ))
                ) : sorted.upcoming.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground">
                    Nothing scheduled. Reserve a slot to get started.
                  </p>
                ) : (
                  sorted.upcoming.map((b) => (
                    <BookingRow key={b._id} booking={b} onCancel={handleCancel} />
                  ))
                )}
              </div>
            </section>

            {sorted.past.length > 0 && (
              <section>
                <h2 className="text-sm font-medium tracking-tight">
                  Past &amp; cancelled
                </h2>
                <div className="mt-4 space-y-3">
                  {sorted.past.map((b) => (
                    <BookingRow key={b._id} booking={b} onCancel={handleCancel} muted />
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function BookingRow({
  booking,
  onCancel,
  muted = false,
}: {
  booking: {
    _id: Id<"bookings">;
    title: string;
    notes?: string;
    startAt: number;
    durationMinutes: number;
    status: "scheduled" | "completed" | "cancelled";
  };
  onCancel: (id: Id<"bookings">) => void;
  muted?: boolean;
}) {
  const scheduled = booking.status === "scheduled";
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 rounded-lg border px-5 py-4",
        scheduled ? "border-border/70" : "border-border/40 opacity-70",
      )}
    >
      <div className="min-w-0">
        <p className={cn("truncate text-sm font-medium", muted && "text-muted-foreground")}>
          {booking.title}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" />
            {formatDateTime(booking.startAt)} · {formatDuration(booking.durationMinutes)}
          </span>
          {scheduled && booking.startAt > Date.now() && (
            <span>{formatRelative(booking.startAt)}</span>
          )}
          {!scheduled && (
            <span className="rounded-full border border-border px-2 py-0.5">
              {BOOKING_STATUS_LABELS[booking.status]}
            </span>
          )}
        </p>
        {booking.notes && (
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground/80">
            {booking.notes}
          </p>
        )}
      </div>
      {scheduled && (
        <button
          type="button"
          aria-label={`Cancel ${booking.title}`}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
          onClick={() => onCancel(booking._id)}
        >
          <Trash2 className="size-4" />
        </button>
      )}
    </div>
  );
}
