# Brand: Tabmate

Date: 2026-10-14. Angle (no `replica/fixes.md` exists yet — `/replica-entrepreneur`
hasn't run — so this draws on recon.md's own research instead): Splitwise's
most-complained-about behavior is a free tier recently capped at a small
number of expenses/day (see recon.md source #12, F05). Tabmate's answer is
already built: no cap, ever (features.csv, "Unlimited free expense entry").
The name and voice lean into the other half of the angle — Splitwise is a
utility; Tabmate is about the people, not just the ledger.

## Step 1: 20 candidates

Descriptive: Dues, Tally, EvenUp, Kharcha, Squarely
Compound: Billmate, Payshare, GroupTab, **Tabmate**, Duesday
Invented: Chippin, PaisaWaisa, Funditto, Thikana
Metaphor: Barabar, Common Pot, Ledger Lane, Fairshare, Kitty, Saathi
Verb: Chip In, Settle, Pitch In

## Step 2: the checks — run, not assumed

Five were shortlisted and screened before the user picked. Screening used
live web search (not a formal trademark-office search — see the caveat
below), done this session:

| name | result | source |
| --- | --- | --- |
| Hisaab | **cut** — an existing Splitwise-alternative app, "Hisab" (one *a*), and a second product, "The Hisaab," both already live in this exact category | web search, 2026-10-14 |
| Chippin | **cut** — an existing Turkish fintech/cashback app with this exact name, same broad payments space | web search, 2026-10-14 |
| Kitty | **cut** — "Kittysplit" is an existing, actively-maintained bill-splitting app (Android + iOS) | web search, 2026-10-14 |
| Saathi | **cut** — an existing travel-and-expense-splitting app with this exact name | web search, 2026-10-14 |
| Halves | **cut** — too close in sound/meaning to two existing splitting apps, "Halvy" and "Halfsie" | web search, 2026-10-14 |
| Kharcha | clear — no splitting app found under this name | web search, 2026-10-14 |
| Barabar | clear — no app found under this name | web search, 2026-10-14 |
| PaisaWaisa | clear — no app found under this name; "Paisa" alone is used by unrelated personal-finance trackers | web search, 2026-10-14 |
| **Tabmate** (chosen) | clear — only a Chrome tab-management extension and an unrelated hardware product share the name; no mobile expense/bill app found | web search, 2026-10-14 |

**Domain** (Namecheap live search, 2026-10-14):
- `tabmate.com` — registered as a premium resale listing (~$9,899/yr, not a
  normal registration).
- `tabmate.app` — registered (2021).
- **`gettabmate.com` — available, normal price (~$10.98/yr).** Recommended.
- `tabmate.io` / `tabmate.co` — not checked yet, worth a follow-up look.

**Not run this session** (do before spending money on the name):
- US trademark (tmsearch.uspto.gov, classes 9 and 42)
- EU trademark (euipo.europa.eu eSearch)
- Canada (ised-isde.canada.ca)
- WIPO Global Brand Database
- App Store / Play Store exact-listing search (web search found no conflict,
  but didn't load the store listings directly — Play Store access was
  blocked in this session's browser)
- X / Instagram / TikTok / GitHub handle availability

These are screening checks. Before spending money on the name, a trademark
lawyer should do a proper search, per the skill's own standing caveat.

## Step 3: palette

Kept the palette `/replica-design` already measured as role placeholders,
now made official — it already satisfies the "different hue family than the
original's" rule (Splitwise's marketing uses teal/mint-green; Tabmate's
accent is indigo-violet, nowhere near that family), and it already passed
`contrast.py` with zero AA failures.

| role | value | why |
| --- | --- | --- |
| accent | `#5b5fef` | primary brand hue — indigo-violet, distinct from Splitwise's teal and from common fintech blues (PayPal, Venmo) |
| accent-strong | `#4338ca` | the "commit" intensity (Settle up, final Join) — same hue, darker |
| success | `#15803d` | "you get back" / confirmed states |
| danger | `#dc2626` | "you owe" / destructive actions |
| warning | `#b45309` | pending states |

Splitwise's own marketing colors (`#3dbe98` mint, `#2e333d` navy, `#f2703d`
orange) are recorded in `replica/brand.json` so `sweep.py` catches any that
survive. Ran clean on 2026-10-14.

```
python3 ../replica-design/contrast.py replica/design/tokens.json
# 11 pairs, 0 failing AA (unchanged from replica-design's original pass)
```

## Step 4: logo brief

**Idea**: a monogram "T" in a rounded square, in `accent` — the same mark
already placed as a stand-in on the Welcome screen (`src/app/welcome.tsx`).
Ties to the name directly, and the rounded-square-with-letter format reads
clearly at tiny sizes.

- **Mark type**: monogram (a wordmark "Tabmate" is the fallback for
  contexts too wide for an icon, e.g. a marketing site header).
- **Must work at**: 16px (browser favicon) and as a 1024×1024 app icon with
  no transparency (iOS requirement).
- **Deliverables**: SVG monogram, 1024×1024 app icon (opaque background,
  `accent` fill), favicon set (16/32/48px), social share image (1200×630).
- **Must not resemble the original's mark**: Splitwise's logo is a
  faceted/triangulated "S" in teal-to-charcoal gradient tones. Tabmate's
  monogram shares no shape, no gradient, no letterform trick with it — a
  flat-color rounded square is a structurally different treatment.
- This brief describes what to build; no logo file has been generated this
  session — the "T" in the app today is a placeholder built from the design
  system's existing primitives, good enough to ship as v1 if no one gets to
  a real mark first.

## Step 5: voice

Three words: **friendly, not cutesy** · **direct, not blunt** · **confident,
not corporate**.

| do | don't |
| --- | --- |
| "You owe Dev ₹400." | "Outstanding balance: ₹400.00 payable to Dev Malhotra." |
| "No tabs open yet." | "There are currently no expense records associated with this group." |
| "Start one for a trip, a flat, or anything you split often." | "Get started by creating your inaugural transaction." |
| "All squared away." | "Transaction successfully completed." |
| "Add what it's for and how much." | "Please provide a valid description and a positive numeric amount." |

### The 10 most-seen strings, rewritten (applied this session)

| screen | before | after |
| --- | --- | --- |
| Welcome headline | "Split costs. Not friendships." | **"Settle up. Stay mates."** |
| Welcome subhead | "Track shared expenses with roommates, trips and friends — see who owes who, and settle up in a tap. No daily limits, ever." | **"Track what everyone chips in for — trips, rent, dinners — and settle up without the awkward maths. No caps on how much you can add, ever."** |
| Sign-up button | "Sign me up" | **"Count me in"** |
| Terms line | "…accept Splitsy's Terms…" | **"…accept Tabmate's Terms…"** |
| Home greeting | "Hi, {name}" | **"Hey, {name}"** |
| Empty groups (Home) | "No groups yet" / "Create a group for a trip, a flat or anything you split often." | **"No tabs open yet" / "Start one for a trip, a flat, or anything you split often."** |
| Add-expense button | "Save expense" | **"Add to the tab"** |
| Edit-expense button | "Save changes" | **"Update the tab"** |
| Settle-up confirmation | "Payment recorded" | **"All squared away"** |
| Delete-expense confirm | "Delete expense?" / "You can restore it later from this screen." | **"Remove this from the tab?" / "You can bring it back anytime from this screen."** |

All rewritten strings are fresh — none echo Splitwise's actual copy (which
was never read verbatim from the product in the first place; recon.md's
quotes came from the public help center, and the app's copy has always been
written from scratch per `/replica-build`'s clean-room rule).

## Step 6: the sweep

```
python3 sweep.py . --config replica/brand.json
Clean. Nothing of the original's name, domain or colours found.
```

Also renamed in code: `app.json` (`name`, `slug`, `scheme`,
`ios.bundleIdentifier`/`android.package` → `com.tabmate.app`),
`package.json` (`name`), every "Splitsy" placeholder string across
`src/app/`, and every `replica/*.md`/`.sql`/`.json` doc that still said
"Splitsy." Verified live in the browser (Welcome, Sign up) and by the full
e2e suite (22 specs — 6 updated to match the new button/copy text, 0 broken
by the rename).

## Output

This file, `replica/brand.json`, updated `replica/design/tokens.json`
(role comment only — values were already compliant), rewritten strings
across `src/app/`, renamed app identity in `app.json`/`package.json`, and a
clean sweep. **Not done yet**: an actual logo file (brief only), formal
trademark/handle checks, and registering `gettabmate.com`. Next: finish
those, or move to `/replica-launch`.
