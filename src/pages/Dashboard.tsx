import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ORDER_STATUS_LABELS,
  formatCurrency,
  formatDateTime,
  formatRelative,
} from "@/lib/format";
import {
  ArrowRight,
  CalendarClock,
  CreditCard,
  MessageSquare,
  Package,
  ShieldCheck,
  ShoppingCart,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

export default function Dashboard() {
  const cart = useQuery(api.cart.get, {});
  const orders = useQuery(api.orders.listMine, {});
  const bookings = useQuery(api.bookings.listMine, {});
  const canClaimAdmin = useQuery(api.session.canClaimAdmin, {});
  const claimAdmin = useMutation(api.session.claimAdmin);

  const stats = {
    pendingOrders:
      orders?.filter((o) => o.status === "pending").length ?? 0,
    paidOrders: orders?.filter((o) => o.status === "paid").length ?? 0,
    upcomingBookings:
      bookings?.filter(
        (b) => b.status === "scheduled" && b.startAt >= Date.now(),
      ).length ?? 0,
    cartCount: cart?.count ?? 0,
  };

  const nextBooking = bookings
    ?.filter((b) => b.status === "scheduled" && b.startAt >= Date.now())
    .sort((a, b) => a.startAt - b.startAt)[0];

  const latestOrder = orders?.[0];

  const [claiming, setClaiming] = useState(false);
  const handleClaim = async () => {
    setClaiming(true);
    try {
      await claimAdmin();
      toast.success("You are now the store admin.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not claim admin.");
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
        <p className="eyebrow">Dashboard</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Good to see you.
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          Your orders, deliveries, and conversations — the whole store at a glance.
        </p>

        {canClaimAdmin && (
          <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-lg border border-foreground/20 bg-muted/50 px-6 py-5 sm:flex-row sm:items-center">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                <ShieldCheck className="size-4" />
                Claim the admin role
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                No administrator has been set up yet. The first person to claim
                this becomes the store admin.
              </p>
            </div>
            <Button onClick={handleClaim} disabled={claiming} className="shrink-0">
              {claiming ? "Claiming…" : "Claim admin"}
            </Button>
          </div>
        )}

        {/* Stat tiles */}
        <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile
            to="/cart"
            icon={ShoppingCart}
            label="In your cart"
            value={String(stats.cartCount)}
            hint={stats.cartCount === 0 ? "Cart is empty" : "Ready to check out"}
          />
          <StatTile
            to="/orders"
            icon={Package}
            label="Pending orders"
            value={String(stats.pendingOrders)}
            hint={`${stats.paidOrders} paid in total`}
          />
          <StatTile
            to="/bookings"
            icon={CalendarClock}
            label="Upcoming slots"
            value={String(stats.upcomingBookings)}
            hint={nextBooking ? formatDateTime(nextBooking.startAt) : "Nothing scheduled"}
          />
          <StatTile
            to="/messages"
            icon={MessageSquare}
            label="Conversations"
            hint="Message the team"
          />
        </div>

        <div className="mt-12 grid gap-12 lg:grid-cols-2">
          {/* Latest order */}
          <section>
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-medium tracking-tight">Latest order</h2>
              <Link
                to="/orders"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                All orders
              </Link>
            </div>
            <Separator className="my-4" />
            {orders === undefined ? (
              <Skeleton className="h-28 w-full rounded-lg" />
            ) : !latestOrder ? (
              <EmptyHint
                icon={CreditCard}
                text="No orders yet. The catalog is a good place to start."
                cta={{ to: "/catalog", label: "Browse the catalog" }}
              />
            ) : (
              <Link
                to="/orders"
                className="block rounded-lg border border-border/70 px-5 py-4 transition-colors hover:bg-muted/40"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">{latestOrder.code}</p>
                  <span className="rounded-full border border-border px-2.5 py-1 text-xs font-medium">
                    {ORDER_STATUS_LABELS[latestOrder.status] ?? latestOrder.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {latestOrder.items.length} item
                  {latestOrder.items.length === 1 ? "" : "s"} ·{" "}
                  {formatCurrency(latestOrder.totalAmount)} ·{" "}
                  {formatRelative(latestOrder._creationTime)}
                </p>
              </Link>
            )}
          </section>

          {/* Next booking */}
          <section>
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-medium tracking-tight">
                Next delivery slot
              </h2>
              <Link
                to="/bookings"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Calendar
              </Link>
            </div>
            <Separator className="my-4" />
            {bookings === undefined ? (
              <Skeleton className="h-28 w-full rounded-lg" />
            ) : !nextBooking ? (
              <EmptyHint
                icon={CalendarClock}
                text="No upcoming slots. Reserve a time to receive a delivery."
                cta={{ to: "/bookings", label: "Reserve a slot" }}
              />
            ) : (
              <div className="rounded-lg border border-border/70 px-5 py-4">
                <p className="text-sm font-semibold">{nextBooking.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDateTime(nextBooking.startAt)} ·{" "}
                  {formatRelative(nextBooking.startAt)}
                </p>
              </div>
            )}
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function StatTile({
  to,
  icon: Icon,
  label,
  value,
  hint,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value?: string;
  hint?: string;
}) {
  return (
    <Link
      to={to}
      className="group rounded-lg border border-border/70 px-5 py-4 transition-colors hover:bg-muted/40"
    >
      <Icon className="size-4 text-muted-foreground" strokeWidth={1.5} />
      {value !== undefined && (
        <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight">
          {value}
        </p>
      )}
      <p className="text-sm font-medium">{label}</p>
      {hint && (
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
          {hint}
          <ArrowRight className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
        </p>
      )}
    </Link>
  );
}

function EmptyHint({
  icon: Icon,
  text,
  cta,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  text: string;
  cta: { to: string; label: string };
}) {
  return (
    <div className="rounded-lg border border-dashed border-border px-6 py-8 text-center">
      <Icon className="mx-auto size-5 text-muted-foreground/60" strokeWidth={1.25} />
      <p className="mx-auto mt-3 max-w-xs text-sm text-muted-foreground">{text}</p>
      <Button asChild variant="outline" size="sm" className="mt-4">
        <Link to={cta.to}>{cta.label}</Link>
      </Button>
    </div>
  );
}
