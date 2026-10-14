// F01-E4 / non-group (one-off) expense — add-expense opened from Home with
// no groupId falls back to a friend picker instead of a group member list.
import { expect, test } from "@playwright/test";

import { login } from "./helpers";

test.describe("non-group expense", () => {
  test.beforeEach(async ({ page }) => {
    page.on("console", (msg) => {
      if (msg.type() === "error" && !msg.text().includes("Slow network")) {
        throw new Error(`console error: ${msg.text()}`);
      }
    });
    await login(page);
    await page.getByRole("button", { name: "Add expense" }).click();
  });

  test("F01-E4 blocks save with no friends selected", async ({ page }) => {
    await page.getByLabel("Description").fill("Solo snack");
    await page.getByLabel("Amount").fill("200");
    await page.getByRole("button", { name: "Save expense" }).click();
    await expect(page.getByText("Add at least one other person to split with.")).toBeVisible();
    await expect(page).toHaveURL(/\/expense\/add$/);
  });

  test("splitting with a friend updates their balance", async ({ page }) => {
    await page.getByRole("checkbox", { name: /Rhea Kapoor/ }).click();
    await page.getByLabel("Description").fill("Solo snack");
    await page.getByLabel("Amount").fill("200");
    await page.getByRole("button", { name: "Save expense" }).click();

    await expect(page).toHaveURL("/");
    await expect(page.getByRole("button", { name: /^Rhea Kapoor,/ })).toContainText("₹2,100");
  });
});
