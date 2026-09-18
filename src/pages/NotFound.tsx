import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Link } from "react-router";

export default function NotFound() {
  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-foreground"
    >
      <p className="eyebrow">404</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        This page doesn&apos;t exist.
      </h1>
      <p className="mt-2 max-w-sm text-center text-sm leading-6 text-muted-foreground">
        The link may be outdated. The catalog is a good place to pick things back
        up.
      </p>
      <div className="mt-8 flex gap-3">
        <Button asChild>
          <Link to="/catalog">Browse the catalog</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/">Back home</Link>
        </Button>
      </div>
    </motion.main>
  );
}
