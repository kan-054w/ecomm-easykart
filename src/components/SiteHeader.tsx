import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import logo from "@/assets/logo.svg";
import {
  CalendarClock,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  MessagesSquare,
  Package,
  ShieldCheck,
  ShoppingCart,
} from "lucide-react";
import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router";
import { useQuery } from "convex/react";

const NAV_ITEMS = [
  { to: "/catalog", label: "Catalog", icon: Package },
  { to: "/community", label: "Community", icon: MessagesSquare },
  { to: "/bookings", label: "Bookings", icon: CalendarClock },
  { to: "/messages", label: "Messages", icon: Mail },
];

function BrandMark() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <img src={logo} alt="" className="size-7 rounded-[7px]" />
      <span className="text-[15px] font-semibold tracking-tight">easykart</span>
    </Link>
  );
}

function navLinkClass({ isActive }: { isActive: boolean }) {
  return `text-sm transition-colors ${
    isActive
      ? "font-medium text-foreground"
      : "text-muted-foreground hover:text-foreground"
  }`;
}

export function SiteHeader() {
  const { isLoading, isAuthenticated, user, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const cart = useQuery(
    api.cart.get,
    isAuthenticated ? {} : "skip",
  ) as { count: number } | null | undefined;
  const unread = useQuery(
    api.messages.unreadCount,
    isAuthenticated ? {} : "skip",
  ) as number | undefined;

  const cartCount = cart?.count ?? 0;

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-8">
          <BrandMark />
          <nav className="hidden items-center gap-6 md:flex">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} className={navLinkClass}>
                {item.label}
                {item.to === "/messages" && unread ? (
                  <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                    {unread}
                  </span>
                ) : null}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-1.5">
          <Link
            to="/cart"
            aria-label="Cart"
            className="relative rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ShoppingCart className="size-[18px]" />
            {cartCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                {cartCount}
              </span>
            )}
          </Link>

          {isLoading ? (
            <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
          ) : isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label="Account"
                  className="flex size-8 items-center justify-center rounded-full border border-border/80 text-xs font-semibold uppercase transition-colors hover:bg-muted"
                >
                  {(user?.name ?? user?.email ?? "U").charAt(0).toUpperCase()}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <p className="truncate text-sm font-medium">
                    {user?.name ?? "Teammate"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {user?.email ?? "Anonymous session"}
                  </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => navigate("/dashboard")}
                >
                  <LayoutDashboard className="mr-2 size-4" />
                  Dashboard
                </DropdownMenuItem>
                {user?.role === "admin" && (
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => navigate("/admin")}
                  >
                    <ShieldCheck className="mr-2 size-4" />
                    Admin console
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-destructive focus:text-destructive"
                  onClick={handleSignOut}
                >
                  <LogOut className="mr-2 size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button size="sm" asChild className="ml-1">
              <Link to="/auth">Sign in</Link>
            </Button>
          )}

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Menu"
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 px-4">
              <SheetHeader>
                <SheetTitle className="text-left">
                  <BrandMark />
                </SheetTitle>
              </SheetHeader>
              <nav className="mt-2 flex flex-col gap-1">
                {NAV_ITEMS.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-md px-3 py-2 text-sm ${
                        isActive
                          ? "bg-muted font-medium text-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`
                    }
                  >
                    <item.icon className="size-4" />
                    {item.label}
                    {item.to === "/messages" && unread ? (
                      <span className="ml-auto rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                        {unread}
                      </span>
                    ) : null}
                  </NavLink>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border/70">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-xs text-muted-foreground sm:flex-row">
        <p>easykart — the internal storefront for your team.</p>
        <div className="flex items-center gap-5">
          <Link to="/catalog" className="hover:text-foreground">
            Catalog
          </Link>
          <Link to="/community" className="hover:text-foreground">
            Community
          </Link>
          <Link to="/bookings" className="hover:text-foreground">
            Bookings
          </Link>
        </div>
      </div>
    </footer>
  );
}
