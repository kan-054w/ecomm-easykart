import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  formatCurrency,
  formatDateTime,
} from "@/lib/format";
import { ArrowLeft, CalendarClock, Package, ReceiptText } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";

export default function Orders() {
  const [searchParams] = useSearchParams();
  const justPlaced = searchParams.get("placed");

  const orders = useQuery(api.orders.listMine, {});
  const markPaid = useMutation(api.orders.markPaid);
  const cancelMine = useMutation(api.orders.cancelMine);
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Dashboard
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Your orders</h1>

        {justPlaced && (
          <p className="mt-4 rounded-md border border-border/70 bg-muted/50 px-4 py-3 text-sm">
            <span className="font-medium">Order {justPlaced} placed.</span>{" "}
            <span className="text-muted-foreground">
              Reserve a delivery slot on the bookings page so someone is around to
              receive it.
            </span>
          </p>
        )}

        <div className="mt-10 space-y-6">
          {orders === undefined ? (
            Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full rounded-lg" />
            ))
          ) : orders.length === 0 ? (
            <div className="py-24 text-center">
              <ReceiptText
                className="mx-auto size-8 text-muted-foreground/50"
                strokeWidth={1.25}
              />
              <p className="mt-4 text-sm font-medium">No orders yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                When you check out, orders appear here with their payment status.
              </p>
              <Button asChild className="mt-6">
                <Link to="/catalog">Browse the catalog</Link>
              </Button>
            </div>
          ) : (
            orders.map((order) => (
              <article
                key={order._id}
                className="rounded-lg border border-border/70"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-5 py-4">
                  <div>
                    <p className="text-sm font-semibold tracking-tight">
                      {order.code}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDateTime(order._creationTime)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="rounded-full border border-border px-2.5 py-1 font-medium">
                      {ORDER_STATUS_LABELS[order.status] ?? order.status}
                    </span>
                    <span className="rounded-full border border-border px-2.5 py-1 text-muted-foreground">
                      {order.paymentMethod === "cash_on_delivery"
                        ? "Cash on delivery"
                        : "Card"}{" "}
                      ·{" "}
                      {PAYMENT_STATUS_LABELS[order.paymentStatus ?? "pending"] ??
                        "Payment pending"}
                    </span>
                  </div>
                </div>

                <div className="px-5 py-4">
                  <ul className="space-y-2">
                    {order.items.map((item, idx) => (
                      <li
                        key={idx}
                        className="flex items-baseline justify-between gap-4 text-sm"
                      >
                        <span className="text-muted-foreground">
                          {item.quantity} × {item.productName}
                        </span>
                        <span className="font-medium tabular-nums">
                          {formatCurrency(item.unitPrice * item.quantity)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Separator className="my-4" />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs leading-5 text-muted-foreground">
                      <Package className="mr-1 inline size-3.5" />
                      {order.shippingAddress.fullName} ·{" "}
                      {order.shippingAddress.street}, {order.shippingAddress.city}{" "}
                      {order.shippingAddress.postalCode}
                    </p>
                    <p className="text-sm font-semibold tabular-nums">
                      {formatCurrency(order.totalAmount)}
                    </p>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {order.status === "pending" &&
                      order.paymentStatus === "pending" &&
                      order.paymentMethod === "card" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === `pay-${order._id}`}
                          onClick={() =>
                            run(`pay-${order._id}`, async () => {
                              await markPaid({ orderId: order._id });
                              toast.success("Payment recorded.");
                            })
                          }
                        >
                          Retry card payment
                        </Button>
                      )}
                    {order.status === "pending" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        disabled={busy === `cancel-${order._id}`}
                        onClick={() =>
                          run(`cancel-${order._id}`, async () => {
                            await cancelMine({ orderId: order._id });
                            toast("Order cancelled.");
                          })
                        }
                      >
                        Cancel order
                      </Button>
                    )}
                    {order.status === "paid" && (
                      <Button asChild size="sm" variant="outline">
                        <Link to="/bookings">
                          <CalendarClock className="mr-2 size-3.5" />
                          Reserve a delivery slot
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
