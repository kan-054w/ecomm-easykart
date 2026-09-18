import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { ProductCard } from "@/components/ProductCard";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function Catalog() {
  const products = useQuery(api.products.list, {});
  const categories = useQuery(api.categories.list, {});
  const seed = useMutation(api.admin.seedCatalog);

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const seedAttempted = useRef(false);

  // One-time: stock a small sample catalog while the store is empty.
  useEffect(() => {
    if (
      !seedAttempted.current &&
      products !== undefined &&
      products.length === 0 &&
      categories !== undefined &&
      categories.length === 0
    ) {
      seedAttempted.current = true;
      seed()
        .then((result) => {
          if (result === "seeded") {
            toast("Sample catalog stocked", {
              description:
                "We added a starter range so you can try the store. Edit it in the admin console.",
            });
          }
        })
        .catch(() => undefined);
    }
  }, [products, categories, seed]);

  const filtered = (products ?? []).filter((p) => {
    if (categoryId && p.categoryId !== categoryId) return false;
    if (!search.trim()) return true;
    const needle = search.trim().toLowerCase();
    return (
      p.name.toLowerCase().includes(needle) ||
      (p.description ?? "").toLowerCase().includes(needle)
    );
  });

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow">Catalog</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Browse the range
            </h1>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products…"
              className="pl-9"
            />
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategoryId(null)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
              categoryId === null
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
            )}
          >
            All
          </button>
          {(categories ?? []).map((c) => (
            <button
              key={c._id}
              type="button"
              onClick={() => setCategoryId(c._id)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                categoryId === c._id
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
              )}
            >
              {c.name}
              <span className="ml-1.5 opacity-60">{c.productCount}</span>
            </button>
          ))}
        </div>

        <div className="mt-10">
          {products === undefined ? (
            <div className="grid grid-cols-2 gap-6 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-[4/3] animate-pulse rounded-md bg-muted"
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-24 text-center">
              <p className="text-sm font-medium">No products found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try a different search or clear the category filter.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-3">
              {filtered.map((p) => (
                <ProductCard key={p._id} product={p} />
              ))}
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
