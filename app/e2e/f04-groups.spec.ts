// F04 — group lifecycle: create, invite, join, remove a member.
// Also a regression test for BUG-007: Share.share() threw an uncaught
// error on web with no fallback, so the invite code was never shown.
import { expect, test } from "@playwright/test";

import { login } from "./helpers";

test.describe("group lifecycle", () => {
  test.beforeEach(async ({ page }) => {
    page.on("console", (msg) => {
      if (msg.type() === "error" && !msg.text().includes("Slow network")) {
        throw new Error(`console error: ${msg.text()}`);
      }
    });
  });

  test("F01-H3 create a group lands on its (empty) detail screen", async ({ page }) => {
    await login(page);
    await page.getByRole("button", { name: "Create a group" }).click();
    await page.getByLabel("Group name").fill("Weekend Trip");
    await page.getByRole("button", { name: "Create group" }).click();

    await expect(page.getByText("No expenses yet")).toBeVisible();
    await expect(page.getByTestId("group-balance")).toContainText("settled up");
  });

  test("F04-H1 generate an invite code and join with it (BUG-007 regression)", async ({ page }) => {
    await login(page);
    await page.getByRole("button", { name: "Create a group" }).click();
    await page.getByLabel("Group name").fill("Weekend Trip");
    await page.getByRole("button", { name: "Create group" }).click();

    await page.getByRole("button", { name: "Group settings" }).click();
    await page.getByRole("button", { name: "Invite via link" }).click();

    // BUG-007: Share.share() used to throw uncaught on web with zero
    // feedback. The code must now always be visible in-app regardless.
    const codeText = await page.getByText(/Invite code: [A-Z0-9]{6}/).textContent();
    const code = codeText?.match(/[A-Z0-9]{6}/)?.[0];
    expect(code).toBeTruthy();

    // Navigate via browser history (SPA-internal, no document reload) rather
    // than page.goto, which hard-reloads and wipes the in-memory fake data
    // layer — including the invite code just created. Also sidesteps
    // ambiguous "Back" button matches from Expo Router's stack keeping prior
    // screens mounted off-screen.
    await page.goBack();
    await page.goBack();
    await page.getByRole("button", { name: "Join a group" }).click();
    await page.getByLabel("Invite code").fill(code!);
    await expect(page.getByTestId("join-preview")).toContainText("You're about to join");
    await expect(page.getByTestId("join-preview")).toContainText("Weekend Trip");
  });

  test("F04-N1 an invalid invite code is rejected", async ({ page }) => {
    await login(page);
    await page.goto("/group/join");
    await page.getByLabel("Invite code").fill("NOTREAL");
    await page.getByRole("button", { name: "Join group" }).click();
    await expect(page.getByText("That invite code is invalid or has expired.")).toBeVisible();
    await expect(page).toHaveURL(/\/group\/join/);
  });

  test("groups: remove a member keeps balances intact", async ({ page }) => {
    await login(page);
    await page.getByRole("button", { name: /^Indiranagar Flat,/ }).click();
    await page.getByRole("button", { name: "Group settings" }).click();
    await page.getByRole("button", { name: "Remove Ayaan Sheikh" }).click();
    await expect(page.getByRole("button", { name: "Remove Ayaan Sheikh" })).toHaveCount(0);

    // Browser-back (not page.goto) to keep the in-memory removal intact.
    await page.goBack();
    // Removing a member must not erase their historical debt from the ledger.
    await expect(page.getByTestId("group-balance")).toContainText("₹23,533.33");
    await expect(page.getByText(/Ayaan Sheikh paid/)).toBeVisible();
  });
});
