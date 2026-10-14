// F01 — new user signs up, sees seeded groups/friends, adds an expense.
// Also a regression test for BUG-002 (NaN balance) and BUG-004 (GO_BACK crash).
import { expect, test } from "@playwright/test";

import { login } from "./helpers";

test.describe("F01 core loop", () => {
  test.beforeEach(async ({ page }) => {
    page.on("console", (msg) => {
      if (msg.type() === "error" && !msg.text().includes("Slow network")) {
        throw new Error(`console error: ${msg.text()}`);
      }
    });
    page.on("response", (res) => {
      if (res.status() >= 500) throw new Error(`${res.status()} on ${res.url()}`);
    });
  });

  test("F01-H1 sign up reaches Home with seeded groups and friends", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Your name").fill("Test User");
    await page.getByLabel("Email").fill("newuser@example.test");
    await page.getByRole("button", { name: "Count me in" }).click();
    await page.waitForURL("/");

    await expect(page.getByText("Indiranagar Flat")).toBeVisible();
    await expect(page.getByText("Goa Trip")).toBeVisible();
    await expect(page.getByText("Dev Malhotra")).toBeVisible();
  });

  test("F01-E1 create group blocks an empty name", async ({ page }) => {
    await login(page);
    await page.getByRole("button", { name: "Create a group" }).click();
    await page.getByRole("button", { name: "Create group" }).click();
    await expect(page.getByText("Give your group a name.")).toBeVisible();
    await expect(page).toHaveURL(/\/group\/create/);
  });

  test("F01-H2 add an equally-split expense updates the group balance, no crash on save", async ({ page }) => {
    await login(page);
    await page.getByRole("button", { name: /^Indiranagar Flat,/ }).click();
    // Expo Router's native-stack keeps the previous screen mounted
    // off-screen, so plain text matches can be ambiguous — scope to the
    // group-detail screen's own balance chip via its testID.
    await expect(page.getByTestId("group-balance")).toContainText("₹23,533.33");

    await page.getByRole("button", { name: "Add expense to this group" }).click();
    await page.getByLabel("Description").fill("Pizza night");
    await page.getByLabel("Amount").fill("900");
    await page.getByRole("button", { name: "Add to the tab" }).click();

    // BUG-004 regression: this must land back on the group screen, not throw
    // "GO_BACK was not handled".
    await page.waitForURL(/\/group\/g-flat$/);
    await expect(page.getByText("Pizza night")).toBeVisible();

    // BUG-002 regression: balance must be a real number, never NaN.
    await expect(page.getByText(/NaN/)).toHaveCount(0);
    await expect(page.getByTestId("group-balance")).toContainText("₹24,133.33");
  });

  test("F01-E2 zero-amount expense is rejected", async ({ page }) => {
    await login(page);
    await page.getByRole("button", { name: /^Indiranagar Flat,/ }).click();
    await page.getByRole("button", { name: "Add expense to this group" }).click();
    await page.getByLabel("Description").fill("Nothing");
    await page.getByRole("button", { name: "Add to the tab" }).click();
    await expect(page.getByText("Add a description and an amount greater than zero.")).toBeVisible();
    await expect(page).toHaveURL(/\/expense\/add/);
  });

  test("F01-E3 unequal exact split blocks save until it balances", async ({ page }) => {
    await login(page);
    await page.getByRole("button", { name: /^Indiranagar Flat,/ }).click();
    await page.getByRole("button", { name: "Add expense to this group" }).click();
    await page.getByLabel("Description").fill("Pizza night");
    await page.getByLabel("Amount").fill("900");
    // The button's accessible name includes the trailing chevron icon glyph,
    // so match on the prefix rather than an exact string.
    await page.getByRole("button", { name: /^Split equally/ }).click();
    await page.getByRole("tab", { name: "Exact" }).click();
    await page.getByRole("button", { name: "Add to the tab" }).click();
    await expect(page.getByText(/Fix the split before saving/)).toBeVisible();
    await expect(page).toHaveURL(/\/expense\/add/);
  });
});
