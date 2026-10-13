import type { Page } from "@playwright/test";

/** Logs in with the fake auth (any email/password works) and lands on Home. */
export async function login(page: Page, email = "test@example.com") {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("whatever123");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("/");
}
