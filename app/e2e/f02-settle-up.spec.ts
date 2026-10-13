// F02 — settle up. Also a regression test for BUG-005: the screen must
// frame the flow correctly in both directions (you owe them / they owe you),
// not always assume "you pay".
import { expect, test } from "@playwright/test";

import { login } from "./helpers";

test("F02-H1 recording a received payment (friend owes current user)", async ({ page }) => {
  await login(page);
  // In seed data the current user is owed money by Ayaan in g-flat — this
  // is the direction the old bug got backwards.
  await page.goto("/settle/u-ayaan?groupId=g-flat");

  await expect(page.getByText("Record that you were paid by")).toBeVisible();
  await expect(page.getByLabel("Amount")).toHaveValue("23533.33");

  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Payment recorded")).toBeVisible();

  await page.getByRole("button", { name: "Done" }).click();
  await expect(page).toHaveURL(/\/group\/g-flat$/);
  await expect(page.getByText("settled up")).toBeVisible();
});

test("F02-E1 confirm is disabled at a zero amount", async ({ page }) => {
  await login(page);
  await page.goto("/settle/u-ayaan?groupId=g-flat");
  await page.getByLabel("Amount").fill("0");
  await expect(page.getByRole("button", { name: "Confirm" })).toBeDisabled();
});
