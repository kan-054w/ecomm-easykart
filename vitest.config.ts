import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["src/test/**/*.test.{ts,tsx}"],
    environment: "node",
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
