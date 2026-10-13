// Regression test for BUG-003: friend balances must be pairwise, not the
// current user's whole-group net position repeated for every groupmate.
// Expected values hand-calculated from app/src/lib/data/seed.ts — see
// replica/bugs.md BUG-003 for the full derivation.
import { expect, test } from "@playwright/test";

import { login } from "./helpers";

test("friend balances are pairwise, not duplicated across groupmates", async ({ page }) => {
  await login(page);

  const devRow = page.getByRole("button", { name: /^Dev Malhotra,/ });
  const ayaanRow = page.getByRole("button", { name: /^Ayaan Sheikh,/ });
  const rheaRow = page.getByRole("button", { name: /^Rhea Kapoor,/ });
  const nishaRow = page.getByRole("button", { name: /^Nisha Rao,/ });

  await expect(devRow).toContainText("₹8,933.33");
  await expect(ayaanRow).toContainText("₹14,600");
  await expect(rheaRow).toContainText("₹2,000");
  await expect(nishaRow).toContainText("₹7,200");

  // The old bug made Dev and Ayaan show the same number (the current user's
  // full group balance) — assert they're actually different.
  const devText = await devRow.textContent();
  const ayaanText = await ayaanRow.textContent();
  expect(devText).not.toEqual(ayaanText);
});
