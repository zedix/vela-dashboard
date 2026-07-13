---
name: vela-verify
description: Verify a change in the Vela dashboard before committing — green build + tests + Prettier, then exercise the change in the real browser on the PRODUCTION bundle (the one bug that mattered here was prod-only). Use before every commit touching src/, and whenever asked to "verify", "check it works", or confirm a UI change.
---

# Vela — verify a change

The repo's rule: **build + tests + Prettier green, AND the change exercised in
the browser on the production bundle**, before every commit that touches
`src/`. Dev-only verification once shipped a broken drawer — a UI library routed
`:host` CSS to global scope, invisible under `ng serve`, broken in prod (see
`docs/ui.md`). So prod verification is not optional for UI.

## 1. Mechanical gates (always)

```bash
npx ng test          # Vitest — expect "12 passed" (or the current count)
npm run build        # production build — expect "Application bundle generation complete"
npx prettier --check "src/**/*.{ts,html,css}" "*.{json,md}" "docs/*.md"
```

All three must pass. A red gate blocks the commit — fix it, don't skip it.

## 2. Browser verification (when the change is observable)

Skip only if the change has no runtime surface (pure docs, types, tooling).
Otherwise, verify on the **prod** bundle — never rely on `ng serve` alone:

- Rebuild so `dist/` is current, then start the **`prod`** preview from
  `.claude/launch.json` (serves `dist/vela-dashboard/browser` on :4300).
- Prefer text-based checks over screenshots for facts: computed styles
  (`preview_inspect`), DOM (`preview_snapshot` / `preview_eval`),
  console / network. Use a screenshot only to confirm the final visual.
- Exercise the affected flow, e.g.:
  - **table** — filter (status + accent-insensitive search), sort a column,
    watch a row highlight (~1s), hover a row;
  - **detail** — click a row (or Tab to the reference button + Enter) → drawer
    opens and keeps updating; Esc / backdrop / Fermer close it;
  - **aggregates** follow the active filter; the margin sparkline grows, then
    slides.

## Gotchas

- **`ng serve` watcher stalls** — it sometimes serves a stale bundle after an
  edit. If the DOM/CSS doesn't reflect a change, **restart the server**; don't
  trust reload alone. The `prod` flow rebuilds from scratch, so it never stalls.
- **Always verify prod for UI**, per the Luxen post-mortem.
- Never ask the user to check manually — verify and report with evidence.
