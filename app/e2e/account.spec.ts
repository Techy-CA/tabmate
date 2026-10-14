// S13 — Account settings. Also a regression test for BUG-009: "Overall
// balance" only summed group balances, silently excluding non-group
// (friend-only) expenses and payments.
import { expect, test } from "@playwright/test";

import { login } from "./helpers";

test("overall balance includes non-group expenses (BUG-009 regression)", async ({ page }) => {
  await login(page);
  await page.getByRole("tab", { name: "Account" }).click();

  // Expected: g-flat (₹23,533.33) + g-goa (₹10,000) - the ₹800 owed on the
  // non-group lunch with Nisha = ₹32,733.33. The old bug omitted that last
  // term entirely, showing ₹33,533.33 instead.
  await expect(page.getByText("Overall balance")).toBeVisible();
  await expect(page.getByText("₹32,733.33")).toBeVisible();
  await expect(page.getByText("₹33,533.33")).toHaveCount(0);
});
