import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import { api } from "@/convex/_generated/api";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ArrowRight,
  CalendarClock,
  CreditCard,
  MessagesSquare,
  Package,
  ShieldCheck,
  Megaphone,
} from "lucide-react";
import { Link } from "react-router";

const FEATURES = [
  {
    icon: Package,
    title: "Curated catalog",
    body: "A small, deliberate range of equipment the team actually uses — searchable, categorized, and always current.",
  },
  {
    icon: CreditCard,
    title: "Straightforward checkout",
    body: "Card payments through Stripe or cash on delivery, with every order tracked from placement to delivery.",
  },
  {
    icon: CalendarClock,
    title: "Scheduled deliveries",
    body: "Reserve a delivery or pickup slot on the shared team calendar, so gear arrives when someone is around.",
  },
  {
    icon: Megaphone,
    title: "Team announcements",
    body: "Publish notes about new arrivals, stock changes, or office picks — with room for comments and questions.",
  },
  {
    icon: MessagesSquare,
    title: "Direct messages",
    body: "Ask about an order or an item without leaving the store. Unread messages are flagged in the header.",
  },
  {
    icon: ShieldCheck,
    title: "Full admin console",
    body: "Products, categories, orders, users, bookings, and posts — all managed from one restrained dashboard.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Sign in with your work email",
    body: "We send a six-digit code to verify it's you. No passwords to forget.",
  },
  {
    n: "02",
    title: "Fill your cart and check out",
    body: "Pick your items, choose how to pay, and add a delivery address.",
  },
  {
    n: "03",
    title: "Reserve a delivery slot",
    body: "Book a time on the shared calendar and track the order in your dashboard.",
  },
];

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.55, ease: "easeOut" as const },
};

export default function Landing() {
  const products = useQuery(api.products.list, {}) ?? [];
  const preview = products.slice(0, 4);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto w-full max-w-6xl px-6 pb-20 pt-24 sm:pt-32">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="max-w-2xl"
          >
            <p className="eyebrow">Internal storefront</p>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
              Everything your team needs.
              <br />
              <span className="text-muted-foreground">
                Nothing it doesn&apos;t.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground">
              easykart is our internal store — a curated catalog of equipment,
              straightforward checkout, delivery scheduling, and the place where
              the team shares what&apos;s new. Built for us, used by us.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="h-11 px-6 text-sm">
                <Link to="/catalog">
                  Browse the catalog
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-11 px-6 text-sm"
              >
                <Link to="/auth?returnTo=%2Fcatalog">Sign in</Link>
              </Button>
            </div>
          </motion.div>

          {/* Catalog preview */}
          <motion.div {...fadeUp} className="mt-24">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-medium tracking-tight">
                From the catalog
              </h2>
              <Link
                to="/catalog"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                View all
              </Link>
            </div>
            <Separator className="my-5" />
            {products.length === 0 ? (
              <p className="py-10 text-sm text-muted-foreground">
                The catalog is being stocked. Check back shortly.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
                {preview.map((p) => (
                  <ProductCard key={p._id} product={p} />
                ))}
              </div>
            )}
          </motion.div>
        </section>

        {/* Features */}
        <section className="border-y border-border/70 bg-muted/40">
          <div className="mx-auto w-full max-w-6xl px-6 py-20">
            <motion.div {...fadeUp} className="max-w-xl">
              <p className="eyebrow">What&apos;s inside</p>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
                A store, a calendar, and a bulletin board — kept deliberately
                quiet.
              </h2>
            </motion.div>
            <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <motion.div key={f.title} {...fadeUp}>
                  <f.icon className="size-5 text-foreground" strokeWidth={1.5} />
                  <h3 className="mt-4 text-sm font-semibold tracking-tight">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {f.body}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto w-full max-w-6xl px-6 py-20">
          <motion.div {...fadeUp} className="max-w-xl">
            <p className="eyebrow">How it works</p>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
              Three steps from sign-in to delivered.
            </h2>
          </motion.div>
          <div className="mt-12 grid gap-10 sm:grid-cols-3">
            {STEPS.map((s) => (
              <motion.div key={s.n} {...fadeUp} className="border-t border-foreground/15 pt-5">
                <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground">
                  {s.n}
                </p>
                <h3 className="mt-3 text-sm font-semibold tracking-tight">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {s.body}
                </p>
              </motion.div>
            ))}
          </div>

          <motion.div
            {...fadeUp}
            className="mt-20 flex flex-col items-start justify-between gap-6 rounded-lg border border-border/70 bg-muted/40 px-8 py-10 sm:flex-row sm:items-center"
          >
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Ready when the team is.
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Sign in with your work email and the store opens up.
              </p>
            </div>
            <Button asChild className="shrink-0">
              <Link to="/auth?returnTo=%2Fdashboard">
                Get started
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </motion.div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
