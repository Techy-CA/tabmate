// Percentage and adjustment split types, verified against hand-calculated
// expected values (see replica/test-plan.md). Exact split and equal split
// are already covered by f01-core-loop.spec.ts.
import { expect, test } from "@playwright/test";

import { login } from "./helpers";

test.describe("split types", () => {
  test.beforeEach(async ({ page }) => {
    page.on("console", (msg) => {
      if (msg.type() === "error" && !msg.text().includes("Slow network")) {
        throw new Error(`console error: ${msg.text()}`);
      }
    });
    await login(page);
    await page.getByRole("button", { name: /^Indiranagar Flat,/ }).click();
    await page.getByRole("button", { name: "Add expense to this group" }).click();
  });

  test("percentage split: 60/40 of ₹1000 gives ₹600/₹400", async ({ page }) => {
    await page.getByLabel("Description").fill("Internet upgrade");
    await page.getByLabel("Amount").fill("1000");
    await page.getByRole("button", { name: /^Split equally/ }).click();
    await page.getByRole("tab", { name: "%" }).click();
    await page.getByLabel("Amount for you").fill("60");
    await page.getByLabel("Amount for Dev Malhotra").fill("40");
    await expect(page.getByText("Splits add up to 100%.")).toBeVisible();
    await page.getByRole("button", { name: "Add to the tab" }).click();

    await page.getByRole("button", { name: /Internet upgrade,/ }).click();
    await expect(page.getByText("paid ₹1,000 · owes ₹600")).toBeVisible();
    await expect(page.getByText("paid ₹0 · owes ₹400")).toBeVisible();
  });

  test("shares split: 1/2/1 shares of ₹800 gives ₹200/₹400/₹200", async ({ page }) => {
    await page.getByLabel("Description").fill("Taxi to airport");
    await page.getByLabel("Amount").fill("800");
    await page.getByRole("button", { name: /^Split equally/ }).click();
    await page.getByRole("tab", { name: "Shares" }).click();
    await page.getByLabel("Amount for you").fill("1");
    await page.getByLabel("Amount for Dev Malhotra").fill("2");
    await page.getByLabel(/Amount for Ayaan/).fill("1");
    await page.getByRole("button", { name: "Add to the tab" }).click();

    await page.getByRole("button", { name: /Taxi to airport,/ }).click();
    await expect(page.getByText("paid ₹800 · owes ₹200")).toBeVisible();
    await expect(page.getByText("paid ₹0 · owes ₹400")).toBeVisible();
    await expect(page.getByText("paid ₹0 · owes ₹200")).toBeVisible();
  });

  test("adjustment split: +₹300 to Dev on ₹900 (3 members) gives ₹200/₹500/₹200", async ({ page }) => {
    // Indiranagar Flat has 3 members (You, Dev, Ayaan) in seed data. The
    // remaining amount after Dev's adjustment splits equally across all
    // three, not just the two people with a visible input.
    await page.getByLabel("Description").fill("Cleaning supplies");
    await page.getByLabel("Amount").fill("900");
    await page.getByRole("button", { name: /^Split equally/ }).click();
    await page.getByRole("tab", { name: "Adjust" }).click();
    await page.getByLabel("Amount for Dev Malhotra").fill("300");
    await page.getByRole("button", { name: "Add to the tab" }).click();

    await page.getByRole("button", { name: /Cleaning supplies,/ }).click();
    await expect(page.getByText("paid ₹900 · owes ₹200")).toBeVisible();
    await expect(page.getByText("paid ₹0 · owes ₹500")).toBeVisible();
    await expect(page.getByText("paid ₹0 · owes ₹200")).toBeVisible();
  });
});
