// F02 — settle up. Also a regression test for BUG-005: the screen must
// frame the flow correctly in both directions (you owe them / they owe you),
// not always assume "you pay".
import { expect, test } from "@playwright/test";

import { login } from "./helpers";

test("F02-H1 recording a received payment (friend owes current user)", async ({ page }) => {
  await login(page);
  // In seed data the current user is owed money by Ayaan in g-flat — this
  // is the direction the old bug got backwards. Reached through the real UI
  // (not a direct goto) — a BUG-006-class regression where "Settle up" only
  // appeared on the page for one balance direction would otherwise still
  // pass this test even with the entry point broken.
  await page.getByRole("button", { name: /^Ayaan Sheikh,/ }).click();
  await page.getByRole("button", { name: "Settle up" }).click();

  await expect(page.getByText("Record that you were paid by")).toBeVisible();
  // Ayaan's pairwise friend balance (not g-flat's group-wide total, which
  // sums across every member) — the correct number for a friend-to-friend
  // settle-up reached without a groupId in the URL.
  await expect(page.getByLabel("Amount")).toHaveValue("14600.00");

  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("All squared away")).toBeVisible();

  await page.getByRole("button", { name: "Done" }).click();
  await expect(page).toHaveURL(/\/friend\/u-ayaan$/);
  // Expo Router's native-stack keeps the Home screen mounted off-screen, so
  // more than one "settled up" can match — the foreground page's copy is
  // consistently the last one in DOM order.
  await expect(page.getByText("settled up").last()).toBeVisible();
  await expect(page.getByRole("button", { name: "Settle up" })).not.toBeVisible();
});

test("F02-E1 confirm is disabled at a zero amount", async ({ page }) => {
  await login(page);
  await page.goto("/settle/u-ayaan?groupId=g-flat");
  await page.getByLabel("Amount").fill("0");
  await expect(page.getByRole("button", { name: "Confirm" })).toBeDisabled();
});
