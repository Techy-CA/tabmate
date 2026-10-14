// Expense edit — the last open must-have from parity.md. Reuses the
// add-expense screen with ?editId=, always reopening as an exact-amounts
// split pre-filled with current owed shares (see the comment in add.tsx for
// why the original split type isn't round-tripped).
import { expect, test } from "@playwright/test";

import { login } from "./helpers";

test.describe("edit expense", () => {
  test.beforeEach(async ({ page }) => {
    page.on("console", (msg) => {
      if (msg.type() === "error" && !msg.text().includes("Slow network")) {
        throw new Error(`console error: ${msg.text()}`);
      }
    });
  });

  test("changing the amount updates the group balance", async ({ page }) => {
    await login(page);
    await page.getByRole("button", { name: /^Indiranagar Flat,/ }).click();
    await page.getByRole("button", { name: /Wifi bill,/ }).click();

    await page.getByRole("button", { name: "Edit expense" }).click();
    await expect(page.getByText("Edit expense")).toBeVisible();
    await page.getByLabel("Amount", { exact: true }).fill("1500");
    // Pre-filled exact shares (400/400/400) no longer sum to the new 1500
    // total — the save must be blocked until the user fixes the split.
    await expect(page.getByText(/left to assign/)).toBeVisible();

    await page.getByLabel(/Amount for you/).fill("500");
    await page.getByLabel(/Amount for Dev/).fill("500");
    await page.getByLabel(/Amount for Ayaan/).fill("500");
    await page.getByRole("button", { name: "Update the tab" }).click();

    await expect(page).toHaveURL(/\/expense\//);
    await expect(page.getByText("paid ₹1,500 · owes ₹500")).toBeVisible();
  });

  test("delete then restore keeps the expense recoverable", async ({ page }) => {
    await login(page);
    await page.getByRole("button", { name: /^Indiranagar Flat,/ }).click();
    await page.getByRole("button", { name: /BigBasket groceries,/ }).click();

    await page.getByRole("button", { name: "Delete expense" }).click();
    // Confirmed via the in-app ConfirmDialogHost, not a native browser dialog.
    await expect(page.getByText("Remove this from the tab?")).toBeVisible();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByText("This expense was deleted.")).toBeVisible();

    await page.getByRole("button", { name: "Restore expense" }).click();
    await expect(page.getByText("This expense was deleted.")).toHaveCount(0);
  });
});
