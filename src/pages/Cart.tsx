import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format";
import {
  ArrowRight,
  Minus,
  Package,
  Plus,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { Link } from "react-router";
import { toast } from "sonner";

export default function Cart() {
  const cart = useQuery(api.cart.get, {});
  const setQuantity = useMutation(api.cart.setQuantity);
  const remove = useMutation(api.cart.remove);

  const updateQty = async (itemId: Id<"cartItems">, next: number) => {
    try {
      await setQuantity({ itemId, quantity: next });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update cart.");
    }
  };

  const removeLine = async (itemId: Id<"cartItems">, name: string) => {
    try {
      await remove({ itemId });
      toast(`Removed ${name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update cart.");
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
        <p className="eyebrow">Cart</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Your cart
        </h1>

        {cart === undefined ? (
          <div className="mt-10 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : cart.items.length === 0 ? (
          <div className="py-24 text-center">
            <ShoppingCart
              className="mx-auto size-8 text-muted-foreground/50"
              strokeWidth={1.25}
            />
            <p className="mt-4 text-sm font-medium">Your cart is empty</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Browse the catalog and add something you need.
            </p>
            <Button asChild className="mt-6">
              <Link to="/catalog">Browse the catalog</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_320px]">
            {/* Lines */}
            <div className="divide-y divide-border/70 border-y border-border/70">
              {cart.items.map((item) => (
                <div
                  key={item._id}
                  className="flex items-center gap-4 py-5"
                >
                  <div className="flex size-14 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted text-muted-foreground/50">
                    <Package className="size-5" strokeWidth={1.25} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/products/${item.productId}`}
                      className="truncate text-sm font-medium hover:underline"
                    >
                      {item.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatCurrency(item.price)} each
                      {item.quantity > item.stockQuantity && (
                        <span className="ml-2 text-destructive">
                          Only {item.stockQuantity} in stock
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center rounded-md border border-border">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      className="flex size-8 items-center justify-center text-muted-foreground hover:text-foreground"
                      onClick={() =>
                        updateQty(item._id, item.quantity - 1)
                      }
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <span className="w-8 text-center text-sm tabular-nums">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      className="flex size-8 items-center justify-center text-muted-foreground hover:text-foreground"
                      disabled={item.quantity >= item.stockQuantity}
                      onClick={() =>
                        updateQty(item._id, item.quantity + 1)
                      }
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                  <p className="w-20 text-right text-sm font-semibold tabular-nums">
                    {formatCurrency(item.lineTotal)}
                  </p>
                  <button
                    type="button"
                    aria-label={`Remove ${item.name}`}
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                    onClick={() => removeLine(item._id, item.name)}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="h-fit rounded-lg border border-border/70 p-6 lg:sticky lg:top-20">
              <h2 className="text-sm font-semibold tracking-tight">Summary</h2>
              <Separator className="my-4" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Subtotal · {cart.count} item{cart.count === 1 ? "" : "s"}
                </span>
                <span className="font-semibold tabular-nums">
                  {formatCurrency(cart.subtotal)}
                </span>
              </div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                Delivery is scheduled at checkout — you&apos;ll pick a slot on
                the team calendar in the next step.
              </p>
              <Button asChild className="mt-6 w-full">
                <Link to="/checkout">
                  Proceed to checkout
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
              <Button asChild variant="ghost" className="mt-2 w-full">
                <Link to="/catalog">Continue shopping</Link>
              </Button>
            </div>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
