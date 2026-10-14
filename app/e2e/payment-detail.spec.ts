// Payment detail/edit — the settle-up equivalent of expense/[id].tsx.
// Friend detail now lists past payments alongside shared expenses, and
// tapping one opens this screen to cancel it.
import { expect, test } from "@playwright/test";

import { login } from "./helpers";

test("cancelling a payment removes it from the friend's balance", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: /^Dev Malhotra,/ }).click();
  // Home's row for Dev matches "you get back" too and stays mounted
  // off-screen (Expo Router's native-stack) — this page's own is last in DOM order.
  await expect(page.getByText("you get back").last()).toBeVisible();

  await page.getByText("Dev Malhotra paid you").click();
  await expect(page.getByText("₹5,000").last()).toBeVisible();
  await expect(page.getByText("Dev Malhotra paid you").last()).toBeVisible();

  await page.getByRole("button", { name: "Cancel this payment" }).click();
  // Confirmed via the in-app ConfirmDialogHost, not a native browser dialog.
  await expect(page.getByText("Cancel this payment?")).toBeVisible();
  await page.getByRole("button", { name: "Cancel payment" }).click();
  await expect(page.getByText("This payment was cancelled.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel this payment" })).toHaveCount(0);

  // Cancelling the payment removes its ₹5,000 credit, raising the balance
  // Dev still owes back toward the pre-payment total.
  await page.goBack();
  await expect(page.getByText("₹13,933.33").last()).toBeVisible();
  await expect(page.getByText("cancelled").last()).toBeVisible();
});
