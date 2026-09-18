import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { Package } from "lucide-react";
import { Link } from "react-router";

export interface ProductCardProduct {
  _id: string;
  name: string;
  price: number;
  imageUrl?: string | null;
  categoryName?: string | null;
  stockQuantity: number;
}

function stockHint(stock: number) {
  if (stock <= 0) return { label: "Out of stock", tone: "text-muted-foreground" };
  if (stock <= 5) return { label: "Low stock", tone: "text-muted-foreground" };
  return { label: "In stock", tone: "text-muted-foreground" };
}

export function ProductCard({ product }: { product: ProductCardProduct }) {
  const stock = stockHint(product.stockQuantity);
  return (
    <Link
      to={`/products/${product._id}`}
      className="group flex flex-col gap-3 rounded-lg border border-transparent p-2 transition-colors hover:bg-muted/60"
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-md border border-border/60 bg-muted">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground/50">
            <Package className="size-8" strokeWidth={1.25} />
          </div>
        )}
        {product.stockQuantity <= 0 && (
          <Badge
            variant="secondary"
            className="absolute left-3 top-3 bg-background/90"
          >
            Sold out
          </Badge>
        )}
      </div>
      <div className="space-y-1 px-1 pb-1">
        {product.categoryName && (
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            {product.categoryName}
          </p>
        )}
        <h3 className="text-sm font-medium leading-snug group-hover:underline">
          {product.name}
        </h3>
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-semibold">
            {formatCurrency(product.price)}
          </p>
          <p className={`text-xs ${stock.tone}`}>{stock.label}</p>
        </div>
      </div>
    </Link>
  );
}
