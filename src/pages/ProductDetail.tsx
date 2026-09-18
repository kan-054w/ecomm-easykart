import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format";
import {
  ArrowLeft,
  Minus,
  Package,
  Plus,
  ShoppingCart,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const product = useQuery(
    api.products.get,
    id ? { id } : "skip",
  );
  const related = useQuery(
    api.products.getRelated,
    product?.categoryId
      ? { id: product._id, categoryId: product.categoryId }
      : "skip",
  );
  const addToCart = useMutation(api.cart.add);

  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);

  if (product === undefined) {
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <SiteHeader />
        <main className="mx-auto grid w-full max-w-6xl flex-1 gap-10 px-6 py-12 md:grid-cols-2">
          <Skeleton className="aspect-square rounded-lg" />
          <div className="space-y-4 pt-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-3/4" />
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-20 w-full" />
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (product === null) {
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <SiteHeader />
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-6 py-24 text-center">
          <Package className="size-8 text-muted-foreground/60" strokeWidth={1.25} />
          <h1 className="mt-4 text-lg font-semibold tracking-tight">
            Product not found
          </h1>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            This item may have been removed from the catalog.
          </p>
          <Button asChild variant="outline" className="mt-6">
            <Link to="/catalog">
              <ArrowLeft className="mr-2 size-4" />
              Back to catalog
            </Link>
          </Button>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const outOfStock = product.stockQuantity <= 0;
  const maxQty = Math.min(product.stockQuantity, 99);

  const handleAdd = async () => {
    setAdding(true);
    try {
      await addToCart({ productId: product._id, quantity });
      toast(`Added ${quantity} × ${product.name}`, {
        action: { label: "View cart", onClick: () => navigate("/cart") },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add to cart.");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
        <Link
          to="/catalog"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Catalog
        </Link>

        <div className="mt-8 grid gap-12 md:grid-cols-2">
          {/* Image */}
          <div className="aspect-square overflow-hidden rounded-lg border border-border/60 bg-muted">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="size-full object-cover"
              />
            ) : (
              <div className="flex size-full items-center justify-center text-muted-foreground/40">
                <Package className="size-14" strokeWidth={1} />
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex flex-col">
            {product.categoryName && (
              <p className="eyebrow">{product.categoryName}</p>
            )}
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">
              {product.name}
            </h1>
            <p className="mt-4 text-xl font-semibold">
              {formatCurrency(product.price)}
            </p>
            <Separator className="my-6" />
            <p className="text-sm leading-7 text-muted-foreground">
              {product.description ?? "No description provided."}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <div className="flex items-center rounded-md border border-border">
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  className="flex size-9 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40"
                  disabled={quantity <= 1}
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                >
                  <Minus className="size-3.5" />
                </button>
                <Input
                  type="number"
                  value={quantity}
                  min={1}
                  max={maxQty}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v)) {
                      setQuantity(Math.min(Math.max(1, Math.round(v)), maxQty));
                    }
                  }}
                  className="h-9 w-14 border-0 text-center [appearance:textfield] focus-visible:ring-0 [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  aria-label="Increase quantity"
                  className="flex size-9 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40"
                  disabled={quantity >= maxQty}
                  onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
              <Button
                size="lg"
                className="h-10 flex-1 sm:flex-none sm:px-8"
                disabled={outOfStock || adding}
                onClick={handleAdd}
              >
                <ShoppingCart className="mr-2 size-4" />
                {outOfStock ? "Out of stock" : "Add to cart"}
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {outOfStock
                ? "We'll restock soon — check back or message the team."
                : `${product.stockQuantity} in stock · ships from the office`}
            </p>
          </div>
        </div>

        {related !== undefined && related.length > 0 && (
          <section className="mt-20">
            <h2 className="text-sm font-medium tracking-tight">
              More in {product.categoryName}
            </h2>
            <Separator className="my-5" />
            <div className="grid grid-cols-2 gap-6 lg:grid-cols-3">
              {related.map((p) => (
                <ProductCard key={p._id} product={p} />
              ))}
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
