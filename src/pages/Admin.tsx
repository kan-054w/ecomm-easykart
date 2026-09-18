import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { OrderStatus } from "@/convex/schema";
import { ImageDropzone } from "@/components/ImageDropzone";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { RequireAdmin } from "@/components/RequireAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  ORDER_STATUS_LABELS,
  formatCurrency,
  formatDateTime,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  CalendarClock,
  ClipboardList,
  Megaphone,
  Package,
  Plus,
  ReceiptText,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const PRICE_RE = /^\d+(\.\d{1,2})?$/;

export default function AdminPage() {
  return (
    <RequireAdmin>
      <AdminConsole />
    </RequireAdmin>
  );
}

function AdminConsole() {
  const stats = useQuery(api.admin.stats, {});
  const products = useQuery(api.products.listAll, {});
  const orders = useQuery(api.orders.adminList, {});
  const users = useQuery(api.admin.listUsers, {});
  const bookings = useQuery(api.bookings.adminList, {});
  const posts = useQuery(api.admin.listPosts, {});
  const categories = useQuery(api.categories.list, {});

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
        <p className="eyebrow">Admin</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Store console
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          Products, orders, people, bookings, and announcements — managed from
          one place.
        </p>

        {/* Stats */}
        <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            icon={Package}
            label="Products"
            value={stats?.activeProductCount}
            hint={
              stats
                ? `${stats.productCount} total · ${stats.productCount - stats.activeProductCount} hidden`
                : undefined
            }
          />
          <StatCard
            icon={ReceiptText}
            label="Orders"
            value={stats?.orderCount}
            hint={stats ? `${stats.pendingOrderCount} pending` : undefined}
          />
          <StatCard
            icon={ShieldCheck}
            label="Revenue (paid)"
            value={stats ? formatCurrency(stats.revenueCents) : undefined}
            hint={stats ? `${stats.paidOrderCount} paid orders` : undefined}
          />
          <StatCard
            icon={Users}
            label="People"
            value={stats?.userCount}
            hint={stats ? `${stats.adminCount} admin${stats.adminCount === 1 ? "" : "s"}` : undefined}
          />
        </div>

        <Tabs defaultValue="products" className="mt-12">
          <TabsList className="h-9 bg-muted/60">
            <TabsTrigger value="products" className="text-xs">
              <Package className="mr-1.5 size-3.5" />
              Products
            </TabsTrigger>
            <TabsTrigger value="orders" className="text-xs">
              <ReceiptText className="mr-1.5 size-3.5" />
              Orders
            </TabsTrigger>
            <TabsTrigger value="users" className="text-xs">
              <Users className="mr-1.5 size-3.5" />
              People
            </TabsTrigger>
            <TabsTrigger value="bookings" className="text-xs">
              <CalendarClock className="mr-1.5 size-3.5" />
              Bookings
            </TabsTrigger>
            <TabsTrigger value="posts" className="text-xs">
              <Megaphone className="mr-1.5 size-3.5" />
              Posts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="mt-6">
            <ProductsTab
              products={products}
              categories={categories?.map((c) => ({ id: c._id, name: c.name })) ?? []}
            />
          </TabsContent>

          <TabsContent value="orders" className="mt-6">
            <OrdersTab orders={orders} />
          </TabsContent>

          <TabsContent value="users" className="mt-6">
            <UsersTab users={users} />
          </TabsContent>

          <TabsContent value="bookings" className="mt-6">
            <BookingsTab bookings={bookings} />
          </TabsContent>

          <TabsContent value="posts" className="mt-6">
            <PostsTab posts={posts} />
          </TabsContent>
        </Tabs>
      </main>
      <SiteFooter />
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value?: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border/70 px-5 py-4">
      <Icon className="size-4 text-muted-foreground" strokeWidth={1.5} />
      <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight">
        {value ?? "—"}
      </p>
      <p className="text-sm font-medium">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/* ---------------------------------- Products --------------------------------- */

interface ProductRow {
  _id: Id<"products">;
  name: string;
  description?: string;
  price: number;
  stockQuantity: number;
  imageUrl?: string | null;
  imageStorageId?: Id<"_storage">;
  categoryId?: Id<"categories">;
  categoryName?: string | null;
  isActive: boolean;
}

function ProductsTab({
  products,
  categories,
}: {
  products?: ProductRow[];
  categories: { id: Id<"categories">; name: string }[];
}) {
  const create = useMutation(api.products.adminCreate);
  const update = useMutation(api.products.adminUpdate);
  const remove = useMutation(api.products.adminRemove);
  const createCategory = useMutation(api.categories.adminCreate);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<Id<"products"> | null>(null);
  const editing = products?.find((p) => p._id === editingId) ?? null;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("0");
  const [imageUrl, setImageUrl] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [isActive, setIsActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newCategory, setNewCategory] = useState("");

  const openNew = () => {
    setEditingId(null);
    setName("");
    setDescription("");
    setPrice("");
    setStock("0");
    setImageUrl("");
    setCategoryId("");
    setIsActive(true);
    setFormOpen(true);
  };

  const openEdit = (p: ProductRow) => {
    setEditingId(p._id);
    setName(p.name);
    setDescription(p.description ?? "");
    setPrice((p.price / 100).toFixed(2));
    setStock(String(p.stockQuantity));
    // p.imageUrl can be a storage URL when an uploaded photo exists; the
    // external-URL field should only ever hold the external fallback.
    setImageUrl(p.imageStorageId ? "" : (p.imageUrl ?? ""));
    setCategoryId(p.categoryId ?? "");
    setIsActive(p.isActive);
    setFormOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!PRICE_RE.test(price)) {
      toast.error("Enter a price like 12.99.");
      return;
    }
    setBusy(true);
    const fields = {
      name,
      description: description.trim() ? description : undefined,
      price: Math.round(parseFloat(price) * 100),
      stockQuantity: Math.max(0, Math.round(Number(stock) || 0)),
      imageUrl: imageUrl.trim() ? imageUrl : undefined,
      categoryId: categoryId ? (categoryId as Id<"categories">) : undefined,
      isActive,
    };
    try {
      if (editingId) {
        await update({ id: editingId, ...fields });
        toast.success("Product updated.");
      } else {
        await create(fields);
        toast.success("Product created.");
      }
      setFormOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save product.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium tracking-tight">
          Product catalog ({products?.length ?? "…"})
        </h2>
        <div className="flex items-center gap-2">
          <Input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="New category name"
            className="h-8 w-44 text-xs"
          />
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            disabled={!newCategory.trim()}
            onClick={async () => {
              try {
                await createCategory({ name: newCategory });
                toast.success(`Category “${newCategory}” added.`);
                setNewCategory("");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not add category.");
              }
            }}
          >
            <Plus className="mr-1 size-3.5" />
            Category
          </Button>
          <Button size="sm" className="h-8 text-xs" onClick={openNew}>
            <Plus className="mr-1 size-3.5" />
            Product
          </Button>
        </div>
      </div>
      <Separator className="my-4" />

      {formOpen && (
        <form
          onSubmit={submit}
          className="mb-6 space-y-4 rounded-lg border border-border/70 p-5"
        >
          <h3 className="text-sm font-semibold tracking-tight">
            {editing ? `Edit “${editing.name}”` : "New product"}
          </h3>
          {editingId && editing ? (
            <div>
              <Label>Product photo</Label>
              <div className="mt-2">
                <ImageDropzone
                  productId={editingId}
                  imageUrl={editing.imageUrl}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Uploaded photos take precedence over the external image URL
                below.
              </p>
            </div>
          ) : (
            <p className="rounded-md border border-dashed border-border px-4 py-3 text-xs text-muted-foreground">
              Save the product first — then you can drag a photo straight onto
              this form.
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="p-name">Name</Label>
              <Input
                id="p-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-price">Price (USD)</Label>
              <Input
                id="p-price"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="19.99"
                inputMode="decimal"
                required
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="p-desc">Description</Label>
              <Textarea
                id="p-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-stock">Stock quantity</Label>
              <Input
                id="p-stock"
                type="number"
                min={0}
                value={stock}
                onChange={(e) => setStock(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={categoryId || "none"}
                onValueChange={(v) => setCategoryId(v === "none" ? "" : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No category</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="p-image">Image URL (optional)</Label>
              <Input
                id="p-image"
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://…"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="size-4 accent-foreground"
            />
            Visible in the catalog
          </label>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={busy}>
              {editing ? "Save changes" : "Create product"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {products === undefined ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground">
          No products yet. Create the first one.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border/70">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Product</th>
                <th className="px-4 py-2.5 font-medium">Category</th>
                <th className="px-4 py-2.5 text-right font-medium">Price</th>
                <th className="px-4 py-2.5 text-right font-medium">Stock</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {products.map((p) => (
                <tr key={p._id} className={cn(!p.isActive && "opacity-50")}>
                  <td className="max-w-[240px] truncate px-4 py-3 font-medium">
                    {p.name}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.categoryName ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatCurrency(p.price)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {p.stockQuantity}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {p.isActive ? "Active" : "Hidden"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => openEdit(p)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="ml-3 text-xs text-muted-foreground hover:text-destructive"
                      onClick={async () => {
                        try {
                          await remove({ id: p._id });
                          toast("Product deleted.");
                        } catch (err) {
                          toast.error(
                            err instanceof Error ? err.message : "Could not delete.",
                          );
                        }
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- Orders ----------------------------------- */

function OrdersTab({
  orders,
}: {
  orders?: {
    _id: Id<"orders">;
    code: string;
    status: string;
    totalAmount: number;
    _creationTime: number;
    customerName: string;
    customerEmail: string | null;
    paymentStatus: string | null;
    paymentMethod: string | null;
  }[];
}) {
  const setStatus = useMutation(api.orders.adminSetStatus);
  const markPaid = useMutation(api.orders.adminMarkPaid);

  return (
    <div>
      <h2 className="text-sm font-medium tracking-tight">
        Orders ({orders?.length ?? "…"})
      </h2>
      <Separator className="my-4" />
      {orders === undefined ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground">
          No orders yet.
        </p>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div
              key={o._id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border/70 px-5 py-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {o.code}
                  <span className="ml-3 text-xs font-normal text-muted-foreground">
                    {o.customerName}
                    {o.customerEmail ? ` · ${o.customerEmail}` : ""}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatDateTime(o._creationTime)} · {formatCurrency(o.totalAmount)} ·{" "}
                  {o.paymentMethod === "cash_on_delivery" ? "Cash on delivery" : "Card"} ·{" "}
                  {o.paymentStatus ?? "no payment"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {o.status === "pending" && o.paymentStatus === "pending" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={async () => {
                      try {
                        await markPaid({ orderId: o._id });
                        toast.success(`${o.code} marked paid.`);
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Failed.");
                      }
                    }}
                  >
                    Mark paid
                  </Button>
                )}
                <Select
                  value={o.status}
                  onValueChange={async (v) => {
                    try {
                      await setStatus({
                        orderId: o._id,
                        status: v as OrderStatus,
                      });
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Failed.");
                    }
                  }}
                >
                  <SelectTrigger className="h-7 w-36 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- People ----------------------------------- */

function UsersTab({
  users,
}: {
  users?: {
    _id: Id<"users">;
    name: string | null;
    email: string | null;
    role: string;
    isAnonymous: boolean;
    _creationTime: number;
  }[];
}) {
  const setRole = useMutation(api.admin.setUserRole);
  return (
    <div>
      <h2 className="text-sm font-medium tracking-tight">
        People ({users?.length ?? "…"})
      </h2>
      <Separator className="my-4" />
      {users === undefined ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border/70">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Person</th>
                <th className="px-4 py-2.5 font-medium">Joined</th>
                <th className="px-4 py-2.5 font-medium">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {users.map((u) => (
                <tr key={u._id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{u.name ?? "Unnamed"}</p>
                    <p className="text-xs text-muted-foreground">
                      {u.email ?? (u.isAnonymous ? "Guest session" : "No email")}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatDateTime(u._creationTime)}
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      value={u.role}
                      onValueChange={async (v) => {
                        try {
                          await setRole({
                            userId: u._id,
                            role: v as "admin" | "user" | "member",
                          });
                          toast.success("Role updated.");
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Failed.");
                        }
                      }}
                    >
                      <SelectTrigger className="h-7 w-28 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- Bookings ---------------------------------- */

function BookingsTab({
  bookings,
}: {
  bookings?: {
    _id: Id<"bookings">;
    title: string;
    startAt: number;
    durationMinutes: number;
    status: string;
    userName: string;
  }[];
}) {
  const setStatus = useMutation(api.bookings.adminSetStatus);
  return (
    <div>
      <h2 className="text-sm font-medium tracking-tight">
        Bookings ({bookings?.length ?? "…"})
      </h2>
      <Separator className="my-4" />
      {bookings === undefined ? (
        <Skeleton className="h-24 w-full rounded-lg" />
      ) : bookings.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground">
          No bookings yet.
        </p>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => (
            <div
              key={b._id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border/70 px-5 py-4"
            >
              <div>
                <p className="text-sm font-medium">{b.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatDateTime(b.startAt)} · {b.userName}
                </p>
              </div>
              <Select
                value={b.status}
                onValueChange={async (v) => {
                  try {
                    await setStatus({
                      bookingId: b._id,
                      status: v as "scheduled" | "completed" | "cancelled",
                    });
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Failed.");
                  }
                }}
              >
                <SelectTrigger className="h-7 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ----------------------------------- Posts ------------------------------------ */

function PostsTab({
  posts,
}: {
  posts?: {
    _id: Id<"posts">;
    title: string;
    status: string;
    _creationTime: number;
    authorName: string;
  }[];
}) {
  return (
    <div>
      <h2 className="text-sm font-medium tracking-tight">
        Posts ({posts?.length ?? "…"})
      </h2>
      <Separator className="my-4" />
      {posts === undefined ? (
        <Skeleton className="h-24 w-full rounded-lg" />
      ) : posts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground">
          No posts yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border/70">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Title</th>
                <th className="px-4 py-2.5 font-medium">Author</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Posted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {posts.map((p) => (
                <tr key={p._id}>
                  <td className="max-w-[280px] truncate px-4 py-3 font-medium">
                    {p.title}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.authorName}</td>
                  <td className="px-4 py-3 text-xs">{p.status}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatDateTime(p._creationTime)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
