// Regression tests for BUG-001 (root route collision) and BUG-004
// (router.back() crashing when there's no history, e.g. a direct URL load —
// the same situation as a deep link from a notification or shared link).
import { expect, test } from "@playwright/test";

import { login } from "./helpers";

test("BUG-001: root route resolves to exactly one screen per auth state", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL("/welcome");
  await expect(page.getByText("Settle up.")).toBeVisible();

  // login() itself lands on "/" and asserts the Home screen shows — a second
  // hard page.goto("/") here would do a full reload and wipe the fake,
  // in-memory auth state, which isn't what this test is checking.
  await login(page);
  await expect(page.getByText("Hey, You")).toBeVisible();
});

test("BUG-004: a direct deep link into add-expense can still navigate away without crashing", async ({ page }) => {
  await login(page);

  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  // Simulates a deep link: load the URL directly with no prior in-app
  // navigation, so Expo Router's history stack is empty.
  await page.goto("/expense/add?groupId=g-flat");
  await page.getByRole("button", { name: "Cancel" }).click();

  await expect(page).toHaveURL(/\/group\/g-flat$/);
  expect(errors.some((e) => e.includes("GO_BACK was not handled"))).toBe(false);
});
