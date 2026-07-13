# AGENTS.md

Guidance for coding agents working in this repository (vendor-neutral
[AGENTS.md](https://agents.md) standard). `CLAUDE.md` is a symlink to this file
so Claude Code picks it up too.

## What this app is

Real-time P&L dashboard for factory manufacturing orders ("ordres de
fabrication", OF): a live table of orders with computed margins, header
aggregates that follow the active filter, and a detail panel that keeps
updating from the feed. There is no backend yet — the feed is simulated
client-side by a service designed to be swapped for a real WebSocket client.

Angular v22, zoneless, standalone components, signals; hand-made UI (no
component library); Tailwind v4 — features are utility-first (utilities resolve
the `--v-*` tokens through a `@theme` bridge), the design-system primitives keep
their own scoped CSS; Vitest.

## Commands

```bash
npm start            # ng serve → http://localhost:4200
npm test             # all unit tests (Vitest via @angular/build:unit-test)
npm run build        # production build

npx ng test --include='src/app/core/domain/pnl.spec.ts'   # single spec file
npx ng test --filter='^computeMargin'                      # filter by suite/test name
```

Build + tests must be green before every commit. A preview server config
exists in `.claude/launch.json` (name: `dev`) for browser verification.

`docs/decisions.md` (versioned) is the architecture decision log: when making a
significant technical choice, record it there — the choice, the alternatives
considered, and why. `docs/agent-workflow.md` explains the whole agent setup
(instructions, skills, planning docs).

## Architecture

Unidirectional flow with a single RxJS→signals seam:

```
OrdersStream (RxJS)  ──events$──▶  OrdersStore (signals)  ──▶  components (read-only)
core/stream/                       core/store/                 features/orders/
```

- `core/stream/orders-stream.ts` — feed simulator that **plays the backend**:
  owns its own truth (internal Map), emits `OrderEvent`s every 500ms–2s
  (`timer`+`expand` for per-event random delay, `share()`). Cold until
  subscribed. Swappable for a real WebSocket client with the same interface
  (`initialOrders` + `events$`).
- `core/models/order-event.model.ts` — events carry the **full order
  snapshot**, not deltas → the store applies them as idempotent upserts by id,
  insensitive to ordering.
- `core/store/orders-store.ts` — the ONLY place RxJS meets signals:
  `events$.pipe(takeUntilDestroyed()).subscribe(evt => this.apply(evt))` in
  the constructor. Private writable signals exposed via `.asReadonly()`;
  memoized computed chain `_orders → allOrders → filteredOrders →
{visibleOrders, aggregates}`; mutations only through methods. Also owns the
  ~1s row-highlight state (`recentlyUpdated` Set, one reset-able timer per id,
  purged in `DestroyRef.onDestroy`).
- `core/domain/pnl.ts` — margin/aggregates/filter/sort as **pure functions,
  zero Angular imports**. This is the tested core (`pnl.spec.ts`, no TestBed).
  Components implement no business math; the store only composes these in
  computeds.
- `ui/` — the **self-contained** mini design system: **generic, presentational,
  domain-free** primitives, each colocated in its folder, styled ONLY from the
  semantic `--v-*` tokens, never importing `core/` or `features/`. It owns its
  tokens (`ui/tokens/`), its **CSS manifest** (`ui/index.css` — tokens +
  global `.v-*` sheets, one import for the app), the **Tailwind
  `@theme` bridge** (`ui/tailwind-bridge.css`, imported from `styles/styles.css`) that
  maps those tokens onto Tailwind's namespaces so utilities like `bg-surface` /
  `text-secondary` / `rounded-md` resolve to `--v-*`, and a barrel
  (`ui/index.ts`) — import via the **`@ui`** alias
  (`import { Button, Drawer } from '@ui'`). **Nature depends on role**:
  **directive** for a leaf control enhanced on a native
  element (`velaButton` on `<button>` — no wrapper, applies `.v-button` +
  `data-*` + a default `type="button"`, styling in the global `button/button.css`);
  **component** for a container with projected content + logic (`vela-drawer`
  wraps a native `<dialog>` with the single-source open/close `effect`;
  `vela-badge`, `vela-close-button`). Components reflect inputs to `data-*` and
  the CSS selects on them (`:host([data-variant='…'])`); content via
  `<ng-content>` (named slots via `<ng-content select="[slot=…]">`). Selector
  convention: components kebab-case, directives camelCase.
- `features/orders/` — `Orders` (smart, injects the store) renders aggregates,
  filters and the hand-made table; domain components **consume `ui/`**:
  `StatusBadge` maps `OrderStatus` → `vela-badge` variant + label; `OrderDetail`
  (dumb, `input()`/`output()`) projects the OF P&L content into `vela-drawer`,
  fed with `store.selectedOrder()`. `MarginChart` is a hand-made SVG sparkline.

Hard rules that follow from this design:

- **Zoneless** (`provideZonelessChangeDetection()`, no zone.js): every state
  change must go through a signal or nothing re-renders.
- **Immutability everywhere**: models are `readonly`; signals only react to
  reference changes (`new Map(...)`, spread — never in-place mutation).
- Components never subscribe to anything; Observables never appear in
  templates. The store is the single subscription point, and subscriptions
  and timers are always tied to a lifetime (`takeUntilDestroyed`,
  `DestroyRef.onDestroy`).
- TypeScript is `strict` + `strictTemplates`; DOM event casts happen once in
  component methods, not in templates.
- Tests target the pure domain logic (margin, aggregates, filtering, sorting)
  — few, meaningful cases over broad shallow coverage. The simulator's random
  output is deliberately untested.

## UI conventions (hand-made, no component library)

- **No UI dependency.** Luxen UI was trialled then removed: its shadow-DOM
  elements import CSS via Vite-only `./x.css?inline`, which `@angular/build`'s
  esbuild misroutes to global CSS (breaking `:host`) → the drawer was unstyled
  in prod. Don't reintroduce a Web Components library without checking
  `?inline` handling in the prod build first.
- **Detail panel** = native `<dialog>` opened with `showModal()` (top-layer,
  real `::backdrop`, focus trap for free). `order()` is the single source of
  truth: an `effect` is the only code that opens/closes it; dismiss actions
  (Esc via `(cancel)`+`preventDefault`, backdrop, buttons) only emit `closed`.
  Gotcha: read the dialog `viewChild` as non-`required` + guard — a `required`
  query read inside the effect throws `NG0951` before it resolves.
- **Design tokens** (`src/app/ui/tokens/`), two layers modelled on Luxen:
  **primitives** (Tailwind v4 OKLCH palette + spacing/radius/text scales) and
  **semantic aliases** (`--v-color-text-*`, `--v-color-surface`,
  `--v-color-bg-fill-*`, `--v-shadow-*`, `--v-focus-ring`…) resolved per scheme
  via `light-dark()`. Components use ONLY the semantic `--v-*` tokens. Pinned
  dark (`color-scheme: dark`) but both branches are defined.
- **CSS style**: logical properties, `color-mix(in oklab, …)`, `:host([data-…])`
  with reflected attributes, `@starting-style` + `transition-behavior:
allow-discrete` for the `<dialog>` in/out animation, `:focus-visible` rings,
  masked-SVG icons. Tailwind v4 (CSS-first, `.postcssrc.json`, no config): the
  **feature** layer (app shell, orders table/stats/filters, chart + detail
  layout) is **utility-first** in the templates, utilities resolving `--v-*` via
  the `ui/tailwind-bridge.css` `@theme` bridge; **primitives** keep scoped CSS for what
  utilities express poorly (`:host`, `::backdrop`/`::-webkit-progress-*`,
  `@starting-style`, masks, `:host([data-…])` variants). Host-level layout goes
  through `host: { class: '…' }`, not a wrapper.

## Language conventions

- Code identifiers, comments, JSDoc, test names, README, this decision log:
  **English**.
- Domain model fields/values stay **verbatim French** (`quantitePrevue`,
  `tauxRebut`, `en_cours`…) with a JSDoc glossary in `order.model.ts` — they
  are the end users' (French plant managers) ubiquitous language. UI strings
  are French.
