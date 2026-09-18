import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router";

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="size-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
      </main>
    );
  }

  if (!isAuthenticated) {
    const returnTo = `${location.pathname}${location.search}`;
    return (
      <Navigate
        to={`/auth?returnTo=${encodeURIComponent(returnTo)}`}
        replace
      />
    );
  }

  if (user?.role !== "admin") {
    return (
      <main className="flex min-h-[70vh] items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto flex size-11 items-center justify-center rounded-full border border-border/70">
            <ShieldCheck className="size-5 text-muted-foreground" />
          </div>
          <h1 className="mt-4 text-lg font-semibold tracking-tight">
            Admin access required
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            This console is limited to store administrators. If you should have
            access, ask an existing admin to update your role.
          </p>
          <Button asChild variant="outline" className="mt-5">
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </main>
    );
  }

  return children;
}
