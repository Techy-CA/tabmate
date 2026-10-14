// Add a friend — the "user-plus" Home header icon, repurposed from
// group-join (which moved behind a link on this screen) to friend-adding.
import { expect, test } from "@playwright/test";

import { login } from "./helpers";

test("adding a friend by email makes them appear on Home", async ({ page }) => {
  await login(page);
  await expect(page.getByText("Priya Nair")).not.toBeVisible();

  await page.getByRole("button", { name: "Add a friend" }).click();
  await page.getByLabel("Email", { exact: true }).fill("priya@example.com");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Priya Nair added as a friend.")).toBeVisible();

  // Adding the same email again is a no-op, not a duplicate.
  await page.getByLabel("Email", { exact: true }).fill("priya@example.com");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("You're already friends.")).toBeVisible();

  await page.goBack();
  await expect(page.getByText("Priya Nair")).toBeVisible();
  // Expo Router's native-stack keeps prior screens mounted off-screen, so
  // more than one "settled up" can match — the foreground page's is last.
  await expect(page.getByText("settled up").last()).toBeVisible();
});

test("an email with no Tabmate account shows a clear not-found state", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "Add a friend" }).click();
  await page.getByLabel("Email", { exact: true }).fill("nobody@example.com");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText(/No Tabmate account found for nobody@example.com/)).toBeVisible();
});
