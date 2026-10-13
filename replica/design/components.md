# Component specs

Built against `tokens.json` / `tokens.css`. Every component is a real native
element under the hood (no `<div onClick>` equivalents) with a visible
`focus-visible` ring (2px, `accent`) and a loading state that keeps its label
for screen readers rather than swapping to a bare spinner.

```
Button
  variants  primary (bg accent), primary-strong (bg accent-strong, for the
            single irreversible "commit" action per flow — e.g. "Settle up",
            final "Join group" — a pattern the original uses even though it
            otherwise sticks to one brand colour), secondary (bg surface,
            border border), ghost (transparent, text accent), danger (bg danger)
  sizes     sm 32px, md 40px, lg 48px
  states    default, hover (web only), pressed, focus-visible (2px ring,
            accent, 2px offset), disabled (40% opacity, no pointer events),
            loading (spinner replaces icon slot only, label text stays)
  tokens    bg accent/accent-strong/surface/danger, text on-accent or text,
            radius md, font sm/600, padding-x space-4, padding-y space-2
  a11y      real <Pressable>/<button>; accessibilityRole="button";
            accessibilityState.disabled set; loading announces "Loading" via
            accessibilityLiveRegion, not just a visual spin
  used on   all screens

Input (text / amount)
  variants  text, numeric (amount — always shows the active currency as a
            fixed prefix, never a placeholder, so it can't be mistaken for a
            typed value), search
  sizes     md 44px height (matches the measured signup-form input)
  states    default (border border-input), focus (border accent, 2px ring),
            filled, error (border danger + helper text in danger), disabled
  tokens    bg bg, border border-input, radius sm, text text, placeholder
            text-muted, font base
  a11y      paired <label>, error text linked via accessibilityDescribedBy,
            numeric inputs use inputMode="decimal" not a bare text keyboard
  used on   S02, S03, S06, S07, S09, S12, S13

Segmented control (split-type picker)
  variants  equal / exact / percentage / shares / adjustment / itemized
  states    selected (bg accent, text on-accent), unselected (text text-muted),
            error (the active segment's per-person total doesn't sum to the
            expense amount — shown as a danger-colored remainder line below
            the control, not a toast, so it stays visible while the user fixes it)
  tokens    bg surface (track), bg accent (thumb/selected), radius pill,
            font sm/600
  a11y      role="tablist" / role="tab" with aria-selected; remainder total
            announced via a live region on every keystroke
  used on   S07

Balance chip
  variants  owed-to-you (success), you-owe (danger), settled (text-muted)
  sizes     sm (list rows), md (detail headers)
  states    default only — colour alone never carries the meaning; always
            paired with "you get back" / "you owe" / "settled up" text
  tokens    bg = 10%-opacity tint of the state colour, text = the full state
            colour, radius pill, font xs/500
  a11y      the text label is the accessible name, not the colour
  used on   S04, S05, S10

Avatar
  variants  photo, initials-fallback (bg derived deterministically from user
            id so the same person is always the same colour), group (stacked
            cluster of up to 3 + "+N")
  sizes     xs 20px, sm 28px, md 40px, lg 56px
  states    default, with unread-activity dot (accent, top-right)
  tokens    radius pill, font xs/600 (initials), border 1px border on photo
  a11y      accessibilityLabel is the person's name, never "avatar"
  used on   everywhere

Group / friend row
  variants  group (cover photo left, name + member count), friend (avatar
            left, name)
  states    default, pressed, unread (bold name + accent dot)
  tokens    bg bg, border-bottom border, padding space-4, balance chip right-aligned
  a11y      whole row is one Pressable (not nested touch targets); accessible
            name includes the balance ("Goa Trip, you owe ₹1,240")
  used on   S04

Expense row
  variants  standard, recurring (small repeat icon), deleted (struck-through,
            shown only in a "recently deleted" filter, not the default feed)
  states    default, pressed
  tokens    bg bg, icon chip bg surface, radius sm (icon), font sm (description)
            + xs text-muted (meta line: who paid, date)
  a11y      accessible name states amount and who paid: "Dinner, ₹600, you paid"
  used on   S05, S08

Bottom sheet / modal
  variants  sheet (mobile — slides from bottom, used for split options,
            settle-up method), dialog (centered, used for destructive
            confirmations like "delete group")
  states    entering/exiting (motion-base, motion-ease), open
  tokens    bg bg, radius lg (top corners only on sheet), shadow pop,
            scrim rgba(0,0,0,.4)
  a11y      focus trapped inside while open; dismiss returns focus to the
            trigger; swipe-to-dismiss has an equivalent close button for
            screen-reader and keyboard users
  used on   S06 (split sheet), S09 (payment method), group/account settings
            destructive actions

Toggle row (settings)
  variants  single toggle (e.g. "Simplify Debts"), with description line
  states    on (bg accent), off (bg border), disabled
  tokens    track radius pill, thumb bg on-accent, label font base, helper
            text-muted
  a11y      role="switch", aria-checked, label is tappable (not just the
            thumb)
  used on   S12, S13

Toast / snackbar
  variants  default (surface), success (success-tinted left border), danger
            (e.g. "Payment failed")
  states    entering, visible (auto-dismiss 4s unless it has an action),
            exiting
  tokens    bg text (dark surface regardless of light/dark theme, so it
            reads as a system-level notice), text on-accent, radius md,
            shadow pop
  a11y      role="status" (polite) for success/info, role="alert" (assertive)
            for danger; never the only indicator — the underlying screen
            state also changes (e.g. the expense actually disappears)
  used on   global (undo-delete, payment sent, offline-queued)

Empty state
  variants  no groups yet, no expenses in this group, fully settled up, no
            search results
  tokens    icon from the open set (not copied from the original), heading
            lg, body sm text-muted, optional primary Button
  a11y      heading is a real heading element for screen-reader navigation,
            not styled body text
  used on   S04, S05, S11

Paywall / upgrade card
  variants  inline (within a could-have screen like charts/OCR, explains
            what's locked), full-screen (S18 comparison)
  states    locked, unlocked
  tokens    bg surface, border border, radius lg, accent used only for the
            CTA button — never used to gate a must-have flow (see
            architecture.md: no cap on core expense entry)
  a11y      locked state is still readable by screen readers (not hidden
            content with a blur-only visual cue)
  used on   S15, S16, S18
```

## Notes carried from recon

- The original uses **two CTA intensities** on the same brand hue in the wild
  (a softer tone for marketing/nav actions, a punchier one for the actual
  form-submit button) — captured here as `accent` / `accent-strong` rather
  than inventing a second brand colour, so `/replica-brand` only has to pick
  one hue family.
- Balance colour (green/red) is never the only signal — every balance chip
  carries text too, since colour alone fails for colour-blind users on a
  product whose entire job is "who owes who."
- No admin/permission role exists anywhere in the component set (recon
  source #9) — there's no "owner" badge, no locked-row state for non-owners,
  because the original genuinely doesn't have one.

## Primitives to build first (before any screen)

Button, Input, Avatar, Balance chip, Bottom sheet — these five appear on
almost every screen in the recon map. Build them in isolation first (a
`/design` route in the Expo app, or Storybook), screenshot them in both light
and dark, and confirm the contrast report is still zero failures before
`/replica-build` starts on real screens.
