import path from "path";
import { convexTest } from "convex-test";
import { expect, vi } from "vitest";
import { internal } from "../convex/_generated/api.js";
import schema from "../convex/schema.js";

/**
 * Load all Convex modules via Vite's glob import. This must live outside
 * `src/convex/` because the Convex bundler cannot handle `import.meta.glob`.
 * convex-test derives the module path prefix from any `_generated` key, so
 * the modules here map correctly onto the real function paths.
 */
export const modules = import.meta.glob("../convex/**/*.*s");

export function setupTest() {
  const t = convexTest(schema, modules);
  return t;
}

export { expect, vi, internal };
