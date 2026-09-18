import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Banknote,
  Check,
  CreditCard,
  MapPin,
  Package,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";

interface AddressDraft {
  id?: Id<"addresses">;
  isDefault: boolean;
  label: string;
  fullName: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

const EMPTY_DRAFT: AddressDraft = {
  isDefault: false,
  label: "",
  fullName: "",
  street: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
};

export default function Checkout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const canceled = searchParams.get("canceled") === "1";

  const cart = useQuery(api.cart.get, {});
  const addresses = useQuery(api.addresses.listMine, {});
  const stripeConfigured = useQuery(api.orders.stripeConfigured, {});
  const placeOrder = useMutation(api.orders.placeOrder);
  const markPaid = useMutation(api.orders.markPaid);
  const saveAddress = useMutation(api.addresses.save);
  const removeAddress = useMutation(api.addresses.remove);
  const createCheckoutSession = useAction(api.stripe.createCheckoutSession);

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<AddressDraft>(EMPTY_DRAFT);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "cash_on_delivery">("card");
  const [placing, setPlacing] = useState(false);

  const ready = cart !== undefined && addresses !== undefined && stripeConfigured !== undefined;

  const chosen =
    addresses?.find((a) => a._id === selectedAddressId) ??
    addresses?.find((a) => a.isDefault) ??
    addresses?.[0] ??
    null;

  const startNewAddress = () => {
    setDraft({ ...EMPTY_DRAFT });
    setEditorOpen(true);
  };

  const startEditAddress = (a: NonNullable<typeof addresses>[number]) => {
    setDraft({
      id: a._id,
      isDefault: a.isDefault,
      label: a.label,
      fullName: a.fullName,
      street: a.street,
      city: a.city,
      state: a.state,
      postalCode: a.postalCode,
      country: a.country,
    });
    setEditorOpen(true);
  };

  const handleSaveAddress = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const id = await saveAddress(draft);
      setSelectedAddressId(id);
      setEditorOpen(false);
      toast("Address saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save address.");
    }
  };

  const handleRemoveAddress = async (id: Id<"addresses">) => {
    try {
      await removeAddress({ id });
      if (selectedAddressId === id) setSelectedAddressId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove address.");
    }
  };

  const handlePlaceOrder = async () => {
    if (!chosen) {
      setEditorOpen(true);
      toast.error("Add a delivery address first.");
      return;
    }
    if (!cart || cart.items.length === 0) return;
    setPlacing(true);
    try {
      const result = await placeOrder({
        shippingAddress: {
          fullName: chosen.fullName,
          street: chosen.street,
          city: chosen.city,
          state: chosen.state,
          postalCode: chosen.postalCode,
          country: chosen.country,
        },
        paymentMethod,
      });
      if (paymentMethod === "card" && stripeConfigured) {
        const origin = window.location.origin;
        const { url } = await createCheckoutSession({
          orderId: result.orderId,
          origin,
        });
        if (url) {
          window.location.href = url;
          return;
        }
        toast.error("Stripe did not return a checkout URL. Try again.");
      }
      if (paymentMethod === "card") {
        await markPaid({ orderId: result.orderId });
        toast.success(`Order ${result.code} placed`, {
          description: "Test-mode payment recorded.",
        });
      } else {
        toast.success(`Order ${result.code} placed`, {
          description: "Pay the courier on delivery.",
        });
      }
      navigate(`/orders?placed=${encodeURIComponent(result.code)}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Checkout failed.");
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
        <Link
          to="/cart"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to cart
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Checkout</h1>
        {canceled && (
          <p className="mt-4 rounded-md border border-border/70 bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
            Payment was canceled — your order is still pending. Retry the card
            payment from your orders page.
          </p>
        )}

        {!ready ? (
          <div className="mt-10 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : !cart || cart.items.length === 0 ? (
          <div className="py-24 text-center">
            <Package className="mx-auto size-8 text-muted-foreground/50" strokeWidth={1.25} />
            <p className="mt-4 text-sm font-medium">Nothing to check out</p>
            <p className="mt-1 text-sm text-muted-foreground">Your cart is empty.</p>
            <Button asChild className="mt-6">
              <Link to="/catalog">Browse the catalog</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-10 grid items-start gap-12 lg:grid-cols-[1fr_340px]">
            <div className="space-y-12">
              {/* Delivery address */}
              <section>
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                    <MapPin className="size-4 text-muted-foreground" />
                    Delivery address
                  </h2>
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={startNewAddress}>
                    <Plus className="mr-1 size-3.5" />
                    New address
                  </Button>
                </div>
                <Separator className="my-4" />

                {addresses.length === 0 && !editorOpen ? (
                  <div className="rounded-lg border border-dashed border-border px-6 py-8 text-center">
                    <p className="text-sm font-medium">No saved addresses</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Add one and it will be remembered for next time.
                    </p>
                    <Button variant="outline" className="mt-4" onClick={startNewAddress}>
                      <Plus className="mr-2 size-4" />
                      Add an address
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {addresses.map((a) => {
                      const active = chosen?._id === a._id;
                      return (
                        <div
                          key={a._id}
                          className={cn(
                            "relative rounded-lg border p-4 text-left transition-colors",
                            active ? "border-foreground" : "border-border/70 hover:border-foreground/40",
                          )}
                        >
                          <button type="button" className="w-full text-left" onClick={() => setSelectedAddressId(a._id)}>
                            <span className="flex items-center gap-2">
                              <span className="text-sm font-medium">{a.label}</span>
                              {a.isDefault && <span className="eyebrow text-[10px]">Default</span>}
                            </span>
                            <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                              {a.fullName}
                              <br />
                              {a.street}, {a.city}
                              {a.state ? `, ${a.state}` : ""} {a.postalCode}
                              <br />
                              {a.country}
                            </span>
                          </button>
                          {active && (
                            <span className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-foreground text-background">
                              <Check className="size-3" />
                            </span>
                          )}
                          <div className="mt-3 flex gap-3 text-xs text-muted-foreground">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 hover:text-foreground"
                              onClick={() => startEditAddress(a)}
                            >
                              <Pencil className="size-3" />
                              Edit
                            </button>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 hover:text-destructive"
                              onClick={() => handleRemoveAddress(a._id)}
                            >
                              <Trash2 className="size-3" />
                              Remove
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {editorOpen && (
                  <form
                    onSubmit={handleSaveAddress}
                    className="mt-4 space-y-4 rounded-lg border border-border/70 p-5"
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="addr-label">Label</Label>
                        <Input
                          id="addr-label"
                          value={draft.label}
                          onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                          placeholder="Home, Studio…"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="addr-name">Full name</Label>
                        <Input
                          id="addr-name"
                          value={draft.fullName}
                          onChange={(e) => setDraft({ ...draft, fullName: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="addr-street">Street address</Label>
                        <Input
                          id="addr-street"
                          value={draft.street}
                          onChange={(e) => setDraft({ ...draft, street: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="addr-city">City</Label>
                        <Input
                          id="addr-city"
                          value={draft.city}
                          onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="addr-state">State / region</Label>
                        <Input
                          id="addr-state"
                          value={draft.state}
                          onChange={(e) => setDraft({ ...draft, state: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="addr-zip">Postal code</Label>
                        <Input
                          id="addr-zip"
                          value={draft.postalCode}
                          onChange={(e) => setDraft({ ...draft, postalCode: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="addr-country">Country</Label>
                        <Input
                          id="addr-country"
                          value={draft.country}
                          onChange={(e) => setDraft({ ...draft, country: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={draft.isDefault}
                        onChange={(e) => setDraft({ ...draft, isDefault: e.target.checked })}
                        className="size-4 accent-foreground"
                      />
                      Make this my default address
                    </label>
                    <div className="flex gap-2">
                      <Button type="submit" size="sm">
                        Save address
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setEditorOpen(false)}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}
              </section>

              {/* Payment */}
              <section>
                <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                  <CreditCard className="size-4 text-muted-foreground" />
                  Payment
                </h2>
                <Separator className="my-4" />
                <div className="space-y-3">
                  <PaymentOption
                    active={paymentMethod === "card"}
                    onSelect={() => setPaymentMethod("card")}
                    icon={<CreditCard className="size-4" strokeWidth={1.5} />}
                    title="Card"
                    description={
                      stripeConfigured
                        ? "Pay securely through Stripe Checkout."
                        : "Test mode — no Stripe key configured, so the payment is recorded directly."
                    }
                    badge={
                      stripeConfigured ? undefined : (
                        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                          Test mode
                        </span>
                      )
                    }
                  />
                  <PaymentOption
                    active={paymentMethod === "cash_on_delivery"}
                    onSelect={() => setPaymentMethod("cash_on_delivery")}
                    icon={<Banknote className="size-4" strokeWidth={1.5} />}
                    title="Cash on delivery"
                    description="Pay the courier when your order arrives. An admin confirms receipt."
                  />
                </div>
              </section>
            </div>

            {/* Summary */}
            <aside className="h-fit rounded-lg border border-border/70 p-6 lg:sticky lg:top-20">
              <h2 className="text-sm font-semibold tracking-tight">Order summary</h2>
              <Separator className="my-4" />
              <ul className="space-y-3">
                {cart!.items.map((item) => (
                  <li key={item._id} className="flex items-baseline justify-between gap-4 text-sm">
                    <span className="min-w-0 truncate text-muted-foreground">
                      {item.quantity} × {item.name}
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">
                      {formatCurrency(item.lineTotal)}
                    </span>
                  </li>
                ))}
              </ul>
              <Separator className="my-4" />
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="text-lg font-semibold tabular-nums">
                  {formatCurrency(cart!.subtotal)}
                </span>
              </div>
              <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
                After payment you can reserve a delivery slot on the team calendar.
              </p>
              <Button
                className="mt-6 w-full"
                size="lg"
                disabled={placing || !chosen}
                onClick={handlePlaceOrder}
              >
                {placing
                  ? "Placing order…"
                  : paymentMethod === "card"
                    ? stripeConfigured
                      ? "Pay with card"
                      : "Place order (test payment)"
                    : "Place order"}
              </Button>
            </aside>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function PaymentOption({
  active,
  onSelect,
  icon,
  title,
  description,
  badge,
}: {
  active: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors",
        active ? "border-foreground" : "border-border/70 hover:border-foreground/40",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-5 items-center justify-center rounded-full border transition-colors",
          active ? "border-foreground bg-foreground text-background" : "border-border",
        )}
      >
        {active && <Check className="size-3" />}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-sm font-medium">
          {icon}
          {title}
          {badge}
        </span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}
