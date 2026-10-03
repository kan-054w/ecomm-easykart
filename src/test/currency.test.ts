import { describe, expect, it } from "vitest";
import { formatCurrency } from "../lib/format.js";
import { SEED_PRICES } from "../convex/admin.js";

describe("formatCurrency (INR)", () => {
  it("formats paise as rupees with the ₹ symbol", () => {
    expect(formatCurrency(249000)).toBe("₹2,490.00");
    expect(formatCurrency(18000)).toBe("₹180.00");
  });

  it("uses Indian digit grouping for large amounts", () => {
    // Indian grouping: lakh digits split as 1,00,000
    expect(formatCurrency(10000000)).toBe("₹1,00,000.00");
  });

  it("handles zero and small paise values", () => {
    expect(formatCurrency(0)).toBe("₹0.00");
    expect(formatCurrency(50)).toBe("₹0.50");
  });
});

describe("seed catalog prices are rupee-scale", () => {
  it("keeps seed prices in the realistic INR band (₹100 – ₹2,500)", () => {
    for (const price of SEED_PRICES) {
      expect(price / 100).toBeGreaterThanOrEqual(100);
      expect(price / 100).toBeLessThanOrEqual(2500);
    }
  });
});
