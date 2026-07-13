# Vela — Real-time manufacturing orders dashboard

![Angular](https://img.shields.io/badge/Angular-22_·_zoneless-dd0031?logo=angular&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6.0_·_strict-3178c6?logo=typescript&logoColor=white)
![RxJS](https://img.shields.io/badge/RxJS-7.8-b7178c?logo=reactivex&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?logo=tailwindcss&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-14_tests-6da13f?logo=vitest&logoColor=white)

Fullstack Engineer case study: a **real-time** P&L dashboard for a factory's
manufacturing orders (French: « ordres de fabrication », OF) — simulated feed
(50 orders + one event every 500ms–2s), live aggregates, filtering, sorting,
order detail. No backend: everything is simulated
client-side behind a WebSocket-shaped service.

Docs: **[Architecture & trade-offs](docs/architecture.md)** ·
**[UI / design system](docs/ui.md)** ·
**[Decision log (ADR)](docs/decisions.md)** ·
**[Agent workflow](docs/agent-workflow.md)**

## 1. Getting started

Requirements: Node 22.22.3+ (or 24.15+ / 26+). No environment variables, no external services.

```bash
npm install
npm start            # ng serve → http://localhost:4200/
```

Other commands:

```bash
npm test             # unit tests (Vitest)
npm run build        # production build (Vite/esbuild) → dist/
npm run format:check # Prettier check (use `npx prettier --write .` to fix)
```

## 2. Architecture

One-way flow with a single RxJS→signals seam:

```
OrdersStream (RxJS)  ──events$──▶  OrdersStore (signals)  ──▶  components (read-only)
core/stream/                       core/store/                 features/orders/
```

The structuring choices, in one line each — full rationale and trade-offs in
[docs/architecture.md](docs/architecture.md):

- **Zoneless + `OnPush` + signals**: only what depends on changed state
  re-renders — no tree-wide checks at one event per 500ms–2s.
- **Pure domain core** (`core/domain/pnl.ts`): margin, aggregates, filter,
  sort as Angular-free functions — the tested "business contract".
- **Hand-rolled signal store**: private `signal` → `.asReadonly()`, memoized
  computed chain `_orders → filteredOrders → {visibleOrders, aggregates}` —
  table and header aggregates derive from the same source, so they can never
  disagree with the active filter.
- **Simulator plays the backend**: events carry full order snapshots →
  idempotent upserts by id; swapping in a real WebSocket touches one service.
- **Detail = native `<dialog>`** driven by `store.selectedOrder()` (derived by
  id → keeps updating live); ~1s row highlight via per-id reset-able timers.
- **Hand-made UI**: a small self-contained design system (`ui/` — tokens,
  primitives) bridged to Tailwind v4 utilities via `@theme` — see
  [docs/ui.md](docs/ui.md).

## 3. Signals vs RxJS: what, where, and why

The division of labour is deliberate: **RxJS carries events over time, signals
hold the current state derived from them, and the two meet in exactly one
place.**

- **Feed (`core/stream/`) → RxJS.** Order events arrive at a random cadence and
  need clean cancellation — the semantics of an `Observable`. `timer` + `expand`
  schedule each event's delay, and a single unsubscribe tears the whole chain
  down. A signal holds a value, not an event, so it is not the right primitive
  for the feed.

- **State and derivations (`core/store/`) → signals.** The current list, filter,
  sort and aggregates are state. The computed chain
  `_orders → filteredOrders → {visibleOrders, aggregates}` is memoized per
  stage: a filter keystroke never re-reads the feed, and a stream event only
  re-sorts when needed. Change detection stays targeted (zoneless), and no
  component subscribes to anything.

- **The seam is a single place** — the store constructor:

  ```ts
  events$.pipe(takeUntilDestroyed()).subscribe((evt) => this.apply(evt));
  ```

  It is the only Observable-to-signal conversion in the app, and no Observable
  reaches a template. An explicit subscription is preferred over
  `toSignal` + `scan`: cleanup is visible through `takeUntilDestroyed`,
  `apply()` is a named reducer, and a future non-feed mutation is one more
  method rather than another stream to merge.

Two alternatives were considered and rejected: all-RxJS (`combineLatest` + the
`async` pipe), more verbose and prone to emission-ordering glitches; and
all-signals (driving the random cadence with `setInterval` + `effect`), which
gives up the cancellable, composable scheduling that RxJS provides.

## 4. What was deliberately left out, and how I would have done it

Ordered by how soon a real product would need it.

- **Feed resilience (reconnection, error states)**: the simulator never fails,
  so the store assumes a happy path. With a real WebSocket: RxJS
  `retry({ delay: exponentialBackoff })` at the seam (the one place the feed
  is consumed), a `connectionStatus` signal in the store, and a stale-data
  banner — components would keep reading the same signals, untouched.
- **Shareable URL for the order detail**: the panel keeps table context but
  owns no URL. _How_: sync `selectedId` with a query param (`?of=of-42`) —
  an `effect` writing `Router.navigate` on select, and
  `withComponentInputBinding()` (already enabled) reading it back on load.
  Full `/of/:id` route only if deep-linking becomes a primary flow.
- **Simulator tests** (`orders-stream`, `order-generator`): random output,
  outside the brief's "critical logic". _How_: inject the RNG (deterministic
  seed) and assert invariants — production ≤ plan, costs ≥ 0, `termine` is
  terminal — rather than exact values.
- **Filter/sort persistence** across reloads: _how_: same query-param sync as
  the detail URL (one `effect` serializing `filter`/`sort` signals), or
  `localStorage` for cross-session stickiness.
- **Search debounce**: filtering is synchronous over ≤ a few hundred rows, so
  immediate keystrokes are cheap (memoized computed chain). If the search ever
  goes server-side: `debounceTime` in RxJS at the new seam — a textbook case
  of "time belongs to RxJS". Same scale note: the accent/case normalization
  runs per row per recompute — fine here, but at thousands of rows I would
  precompute a normalized `searchKey` (in a view-model or the store) rather than
  re-normalize inside the filter.
- **Table virtualization / pagination**: pointless at 50–100 rows; DOM cost
  would only matter around ~500+. _How_: CDK `<cdk-virtual-scroll-viewport>`
  with fixed row height — `visibleOrders()` plugs in as-is.
- **Arrow-key row navigation (ARIA `grid` pattern)**: rows are Tab-navigable
  real buttons today (keyboard-operable, WCAG-conformant). Full grid semantics
  — roving `tabindex`, `role="grid/row/gridcell"`, `@angular/cdk/a11y`
  `ListKeyManager` for ↑/↓/Home/End — would suit a dense data table. _Deferred_
  because the real cost is not the key handling but keeping the roving focus
  index correct across live inserts, re-sorts and filter changes; done
  half-way (arrows without grid roles) it would degrade accessibility.
- **Quantity-weighted scrap average** (industrially more accurate than the
  simple average shown): a one-line substitution inside `computeAggregates`,
  no UI impact — documented in its JSDoc.
- **i18n**: UI strings are hardcoded French (the target users). _How_: status
  labels are already centralized; extract them plus template strings to
  Angular's built-in `$localize` once a second locale exists.
- **E2E smoke test**: unit tests cover the logic, live behaviour was verified
  manually in the browser. _How_: one Playwright scenario — load, filter,
  sort, open the detail panel, assert aggregates change.
- **Dev-only npm advisories (2 low)**: `npm audit` flags two low-severity
  issues in `@angular/build` (a dev-only build tool, transitive via
  `@babel/core` — GHSA-4x5r-pxfx-6jf8) — never in the shipped bundle. Left
  as-is on purpose: the only remediation (`npm audit fix --force`) downgrades
  `@angular/build` to v21, a framework downgrade far worse than a low dev-only
  advisory. `npm audit --audit-level=high` is clean; it resolves upstream once
  `@angular/build` bumps `@babel/core`.

---

**Starting point**: the project began from a personal Angular v22 boilerplate
(shell, zoneless config). A UI library (Luxen) was trialled then removed —
post-mortem in [docs/ui.md](docs/ui.md#why-no-ui-library).
