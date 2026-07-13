# Technical decisions — decision log (ADR)

Kept as a real ADR log, for the maintainers who come next — same audience as the
code, so **English** (French stays only for the domain's ubiquitous language —
the OF fields — and the UI strings). Each entry: what was chosen, the
alternatives, and why, in a few lines.

---

## 1. Reactivity & rendering

### 1.1 Zoneless + signals (no Zone.js)

- **Choice**: `provideZonelessChangeDetection()`, no zone.js polyfill.
- **Alternatives**: classic Zone.js (the historical default).
- **Why**: with an event every 500 ms–2 s, Zone.js would re-run change detection
  over the _whole_ tree on every timer/event. Zoneless re-renders only the
  components whose read signals changed — the recommended v22 default, and
  exactly the profile (frequent feed) where it pays off. The trade-off is
  deliberate: any state change must go through a signal, which forces the
  unidirectional flow.

### 1.2 `OnPush` everywhere

- **Choice**: `ChangeDetectionStrategy.OnPush` on every component.
- **Alternatives**: `Default`.
- **Why**: consistent with zoneless + signals; a component re-renders only when
  its inputs/signals change. Explicit perf requirement of the brief.

### 1.3 The signals ↔ RxJS boundary (the most-scrutinised point)

- **Choice**: **RxJS for the feed** (asynchronous events over time), **signals
  for state and derivations** (list, filters, sort, aggregates). The seam: the
  feed service exposes an Observable; the store converts it to signal state once;
  everything else is `computed()`.
- **Alternatives**:
  - _All RxJS_ (`combineLatest` of subjects + `async` pipe): works, but verbose,
    glitch-prone ordering, and against the framework's direction.
  - _All signals_ (generate events with `setInterval` + `effect`): possible, but
    RxJS is the right tool to compose **time** (random delays, clean
    cancellation) — a signal is a _current value_, not an event.
- **In one line**: _RxJS models what happens over time, signals model what is true
  now. The feed is time, the dashboard is state, and the conversion happens in
  exactly one place._

---

## 2. State & architecture

### 2.1 Hand-rolled signal store (no NgRx)

- **Choice**: a `@Injectable({providedIn: 'root'})` store — private writable
  `signal()`s exposed `.asReadonly()`, derivations as `computed()`, mutations
  encapsulated in methods.
- **Alternatives**: NgRx (actions/reducers), NgRx SignalStore, component-local
  state.
- **Why**: one feature, one incoming feed → NgRx would add ceremony for no
  benefit. The hand-rolled pattern gives the same useful guarantees (read-only
  from the UI, traced mutations, testable) and migrates to NgRx SignalStore almost
  mechanically if the app grows (same philosophy: state + computed + methods).

### 2.2 Business logic = pure functions outside Angular

- **Choice**: `computeMargin`, `computeAggregates`, `filterOrders`, `sortOrders`
  in `core/domain/pnl.ts`, no Angular import. The store — and thin component
  view-models (§4.5) — compose them in `computed()`s; components implement no
  formulas of their own.
- **Alternatives**: math in the store, in components, or in pipes.
- **Why**: testable without TestBed (fast, simple tests), reusable (a real backend
  could share the spec), and readable — the margin formula is the business
  contract and deserves its own file. The brief insists: "the exact formula
  matters little; its readability and testability do."

### 2.3 Aggregates over the **filtered** list, single pass

- **Choice**: `computeAggregates(filteredOrders)` — one loop (margin, in-progress
  count, scrap sum).
- **Alternatives**: three chained `.filter().reduce()` passes.
- **Why**: brief requirement ("aggregates reflect the active filter") → wiring the
  aggregate onto the filtered `computed` makes consistency structural, not
  hand-synchronised. One pass: O(n) instead of 3×O(n) per event.

### 2.4 Sorting: pure function in the domain, state in the store

- **Choice**: `sortOrders(orders, sort)` **pure** in `pnl.ts` (like the filter) — a
  per-column accessor table, margin sortable via `computeMargin`; a `compareValues`
  helper narrows both operands (no casts). The sort **state** lives in the store;
  `toggleSort`: first click asc, re-click flips.
- **Details**: strings compared with the `fr` locale (`localeCompare`) so "Étrier"
  sorts under E; `Array.prototype.sort` is spec-stable (equal rows keep feed
  order); defensive copy (`[...orders].sort`).
- **Why**: same doctrine as the filter — pure, tested logic; the store composes it
  (`visibleOrders = sort(filtered)`), the UI only triggers `toggleSort`.

---

## 3. Model & conventions

### 3.1 `tauxRebut` stored as a 0–1 ratio (not a %)

- **Choice**: `tauxRebut: 0.04` = 4 %; the "%" conversion happens only at display.
- **Alternatives**: store `4` (as the brief's "(%)" suggests).
- **Why**: the brief's own formula uses `(1 − tauxRebut)`, so the calculation
  expects a ratio. Storing the ratio avoids scattered `/100` (and double-conversion
  bugs). Documented in the model's JSDoc.

### 3.2 Naming: English engineering, French domain fields

- **Choice**: everything engineering-facing is **English** — identifiers
  (`ManufacturingOrder` — the standard ERP/MES term —, `computeMargin`), comments,
  JSDoc, tests, README, **this log**. **French** stays only for the brief's fields
  and values (`quantitePrevue`, `tauxRebut`, `en_cours`… with a JSDoc glossary in
  the model) and the **UI strings** (French end users).
- **Alternatives**: all French; mixed (French comments, English code).
- **Why**: one rule, no exception — the reader of the code, the docs and this log
  is the same (a future, possibly non-francophone dev), so they share a language.
  But the model fields are the brief's contract and the users' _ubiquitous
  language_ (DDD): factory managers say "OF", "rebut", "taux". Translating them
  would drift from the spec and lose the domain vocabulary; the JSDoc glossary
  bridges it.

### 3.3 Immutability: everything `readonly`

- **Choice**: interfaces are 100 % `readonly`; a feed update produces a **new**
  order object.
- **Alternatives**: mutable objects updated in place.
- **Why**: Angular `computed()`s re-evaluate on **reference** change — mutating in
  place would silently break reactivity. Immutability also makes the table's
  `track` reliable (stable `id`, new object = re-rendered row).

### 3.4 **Simple** (unweighted) scrap average

- **Choice**: arithmetic mean of `tauxRebut`.
- **Alternatives**: weighted by produced quantities (industrially more accurate).
- **Why**: the most readable "order health" indicator for a dashboard; the brief
  doesn't specify. The point is that the calculation is **encapsulated in a
  documented pure function** — swapping in the weighted version is a one-line
  change that doesn't touch the UI.

---

## 4. UI & dependencies

### 4.1 No UI component library — a hand-made design system

- **Choice**: no UI dependency. Badge, filter controls and the detail panel are
  hand-made (~50 lines of CSS + a native `<dialog>`); the table, reactivity and
  math already were.
- **Alternatives**: a Web Components library; a Material/PrimeNG kit.
- **Why**: (1) the table + reactivity are exactly the **surface the brief
  evaluates** — delegating them to a library would hide what it wants to see. (2) A
  real trap with shadow-DOM Web Components under `@angular/build`: their styles are
  imported via `./x.css?inline` (a **Vite** convention) which the production esbuild
  misroutes to **global** CSS, where `:host` means nothing → the component renders
  unstyled **in prod only**. Hand-made light-DOM CSS sidesteps it. The net footprint
  of a kit here would be a badge, a few styled inputs and a drawer — not worth the
  risk.

### 4.2 Tailwind v4, standalone (CSS-first)

- **Choice**: Tailwind v4 (CSS-first, `.postcssrc.json` with `@tailwindcss/postcss`,
  no `tailwind.config`), no preset.
- **Alternatives**: drop it too; pure scoped CSS.
- **Why**: velocity for throwaway layout, with a single source of tokens — Tailwind
  is only a syntax over the `--v-*` tokens (see §4.11 for the bridge).

### 4.3 Hand-made HTML table (no data-table component)

- **Choice**: a native `<table>` + `@for (…; track order.id)`.
- **Alternatives**: a library data-table (Material `mat-table`, AG Grid…).
- **Why**: the table is the **evaluated object** (trackBy, OnPush, highlight, sort)
  — a library would hide exactly that, and AG Grid is oversized (50–100 rows) and
  opaque.

### 4.4 ~1 s highlight: `Set<id>` signal in the store + one timer per id

- **Choice**: the store keeps `recentlyUpdated: Signal<ReadonlySet<string>>`.
  `apply()` adds the id and (re)arms a 1 s timer that removes it; a new event on
  the same order **resets** its timer. All timers are cleared in
  `DestroyRef.onDestroy`. CSS: `.updated` with `transition: none` on entry (instant
  flash) and `transition 0.6s` on exit (soft fade).
- **Alternatives**: a CSS-only animation (impossible cleanly — `track id` reuses the
  DOM node, so it doesn't replay on data change); an `updatedAt` field (pollutes the
  domain with a UI concern).
- **Why**: "recently updated" is UI state → it lives in the store, as a signal,
  testable, with an explicit timer lifecycle (the "leak" disqualifier met head-on:
  one timer per id, reset, purged on destroy).

### 4.5 Thin component, view-model in `computed`

- **Choice**: a single `Orders` page, no sub-components. A view-model
  `rows = computed(() => visibleOrders().map(o => ({order, margin})))` computes each
  margin once. Columns are declared as data (`COLUMNS`) — both the header and the
  body cells iterate them, so their order can't drift.
- **Alternatives**: split into aggregate-bar / filters / table dumb components —
  legitimate, but premature here.
- **Why**: the brief evaluates _relevant_ splitting, not file count. The rule: I
  split when a piece has its own state, a reuse, or a useful re-render boundary —
  here the page is a direct projection of the store. The detail drawer does get its
  own component (own state: open/closed, reuse target).

### 4.6 Domain component `vela-status-badge`

- **Choice**: `StatusBadge` (`input status`) maps the status to its `variant`
  (colour) + label and renders a `<vela-badge>`. The labels (`STATUS_LABELS`) live
  at the **domain** level (`order.model.ts`), consumed by the badge, the filter
  `<option>` and the panel; the status→variant map lives in the component.
- **Why**: it adds business meaning (status → appearance) and centralises the
  knowledge — extracted at the second consumer, because it's business knowledge,
  not an accidental resemblance. The labels have a third consumer (the filter), so
  they sit in the domain, not the badge, to avoid a duplicate.

### 4.7 Design system: `ui/` (generic) vs `features/` (domain)

- **Choice**: presentational primitives live in `src/app/ui/`, each colocated in
  its folder and styled **only** from the `--v-*` tokens (§4.8). Their _nature_
  varies by role (§4.10): `ui/badge`, `ui/drawer`, `ui/close-button` are components,
  `ui/button`/`ui/progress` are directives. Domain components consume them.
- **Dependency rule**: `ui/` knows only the `--v-*` tokens; it **never** imports
  `core/` or `features/`. That's what makes it a design system: reusable, testable
  in isolation, replaceable. It owns its tokens, a CSS manifest (`ui/index.css`) and
  a barrel (`ui/index.ts`, imported via `@ui`). It would graduate to an Angular
  library in a real product — same boundary, different packaging.
- **Why**: each component mixed two levels (primitive + domain). Splitting keeps the
  _mechanism_ (modal `<dialog>`, showModal, backdrop, focus trap) apart from the
  _content_ (an order's mini-P&L); the mechanism lives once and every new modal
  reuses it by content projection.
- **Note (TS 6)**: the `@ui` alias needs `baseUrl` for esbuild path resolution, and
  `baseUrl` is deprecated in TS 6 → `ignoreDeprecations: "6.0"` (a transient
  workaround).

### 4.8 Design tokens, two layers (`--v-*`)

- **Choice**: `ui/tokens/`, two layers — **primitives** (a Tailwind v4 OKLCH palette +
  spacing/radius/text scales) and **semantic aliases** (`--v-color-text-*`,
  `--v-color-surface`, `--v-color-bg-fill-*`, `--v-focus-ring`…) resolved per scheme
  via `light-dark()`. Components use only the semantic tokens → re-theming means
  editing one file.
- **Spacing single-source**: `--v-spacing` is the unit; each step is `calc()`-ed from
  it, and the `calc()` stays in the CSS output so overriding the unit propagates the
  whole scale.
- **Inter, self-hosted**: `@fontsource-variable/inter`, bundled (no external request
  — consistent with "no external services"; only the `latin` subsets fetched via
  unicode-range). A **variable** font (weight axis) rather than static files: one
  file for all weights, worth it from ~3 weights; here there are 4 (400/500/600/700).
- **Dark pinned, both branches defined**: `color-scheme: dark` on `:root`, but both
  `light-dark()` branches exist → switching to light themes the app without touching
  components.
- **Why two layers**: the semantic layer decouples intent from value — a component
  says "surface" / "danger-subtle", not "gray-900" / "red-100". That's what makes a
  design system re-themable.

### 4.9 Detail: a native `<dialog>` driven by the store (not a route)

- **Choice**: a hand-made panel on a native `<dialog>` opened with `showModal()`,
  fed by `store.selectedOrder()` (a `computed` on the selected id → keeps updating in
  real time for free).
- **Why native `<dialog>`**: the platform gives, for free, what an `<aside>` would
  re-implement — top-layer rendering, a real `::backdrop`, a focus trap. Here the CSS
  is ours (no `?inline` shadow), so it works in dev and prod.
- **Opening single-source, dismissal through the native `<dialog>`**: the `open`
  input (from `order()`) drives opening via an `effect` (`showModal()`/`close()`).
  Every dismissal goes through the native dialog — Esc closes it natively, the ✕ and
  the backdrop call `dialog.close()` — and the native `close` event emits `closed`
  **after the exit animation** (`getAnimations()`, which resolves immediately when
  nothing animates, unlike `transitionend` at 0 s). Emitting before the animation
  would clear `order()` too early and unmount the `@if (order())` content
  mid-slide-out (empty panel); emitting after keeps it mounted. No desync: `open` is
  a derived boolean (`order() !== null`) that stays `true` for the whole close
  window, so the effect never re-opens.
- **Note (NG0951)**: a `viewChild.required` read inside the `effect` throws `NG0951`
  → non-`required` `viewChild` + a guard; the effect re-runs when the ref arrives.
- **Alternatives**: a `/of/:id` route (shareable URL, loses the overlay); a hand-made
  `<aside>` + backdrop (re-implements Esc/focus-trap/top-layer).
- **Trade-off**: no shareable URL (listed in README §4).

### 4.10 Directive vs Component vs Class for a primitive

- **Rule** — by the primitive's _role_:
  - **Directive** on a native element for a **leaf control being enhanced**:
    `velaButton` on `<button>`/`<a>` — no wrapper.
  - **Component** for a **container with projected content + logic**: `vela-drawer`
    wraps an internal `<dialog>` and projects via `<ng-content>`.
  - **CSS class** for a purely native control with no TS: `.field` (input/select).
- **Why not all components**: a component always has a host tag → `<vela-button>`
  would wrap the `<button>` (an extra node). The directive gives typing without a
  wrapper — Angular Material's `<button mat-button>` approach.
- **Why the drawer is a component, not a directive**: a directive on `<dialog>` would
  collide with the native `open` attribute (vs an `open` input); a component host has
  no such attribute → a clean `open` input.
- **Selectors**: components kebab-case (`vela-drawer`), directives camelCase
  (`velaButton`). CSS class prefix follows scope: global class → `v-` (`.v-button`);
  component-internal → unprefixed (`.drawer`).

### 4.11 Tailwind maximised via a `@theme` bridge (hybrid)

- **Choice**: a `ui/tailwind-bridge.css` `@theme inline` that maps the semantic
  `--v-*` tokens onto Tailwind v4 namespaces (`bg-*`, `text-*`, `border-*`,
  `radius-*`…), imported after `tailwindcss`. Features are **utility-first** in the
  templates (host layout via `host: { class: '…' }`); primitives **keep scoped CSS**
  where utilities express things poorly (`:host`, `::backdrop`, `@starting-style` +
  `allow-discrete`, `mask`, `:host([data-…])`).
- **`@theme inline` (not `@theme`)**: crucial — the utility emits `var(--v-color-…)`
  at the point of use instead of freezing the value, so `light-dark()` keeps
  resolving per scheme.
- **Alternatives**: all-utilities including primitives (loses the DS narrative, forces
  arbitrary values for masks/`::backdrop`); stay full scoped CSS (misses the Tailwind
  v4 demonstration).
- **In one line**: the mature Angular + Tailwind pattern is _hybrid_ — a `@theme` that
  makes utilities speak the tokens, utilities in pages, scoped CSS for primitives.

### 4.12 Folder structure by role/boundary, not by file type

- **Choice**: top-level folders are **dependency boundaries** (nx
  `feature`/`ui`/`util`): `core/` (models, domain, stream, data, store); `ui/`
  (domain-free design system, `@ui` barrel, forbidden to import `core/`/`features/`);
  `shared/utils/` (non-component reusables, `@shared/utils` barrel); `features/`
  (smart components).
- **Alternative**: a `shared/{components,directives,pipes}` `SharedModule` grab-bag —
  sorts by file type, so `shared/components` mixes a generic primitive with app chrome
  and quasi-domain widgets.
- **Why**: separating the **design system** (`ui/`) from **utils** (`shared/`)
  distinguishes two concerns "shared" conflates; the boundary is explicit and the
  public API too (`@ui`). The modern standalone Angular style guide no longer
  prescribes a `shared/` grab-bag.

### 4.13 Styles: a single entry point (`styles/styles.css`)

- **Choice**: `angular.json` declares **one** stylesheet, composing everything by
  `@import` in the intended cascade order (Tailwind → `@theme` bridge → DS → base).
  The DS exposes its own CSS manifest (`ui/index.css`).
- **Why**: the Angular convention (the CLI scaffolds a single `styles.css`) and the
  Tailwind v4 pattern (one entry, `@import 'tailwindcss'` first). The cascade order
  becomes reviewable, commented code; `angular.json` stops changing per primitive.
  Zero runtime effect.

### 4.14 Intra-feature colocation: a folder once there are multiple files

- **Choice**: inside a feature, a component gets **its folder** as soon as it has
  **multiple files**; a single-file leaf stays flat. `features/orders/`:
  `orders.{ts,html,css}` (feature root), `status-badge.ts` (shared leaf, flat),
  `order-detail/` (panel + `order-detail-row.ts`,
  nested with its only consumer).
- **Why**: modern Angular guidance (folder when multiple files) + the repo's
  anti-over-folding stance. **Deliberate contrast with `ui/`**, which folds everything
  because it's a _library_ layer; a feature folds only when a component earns it.
  Cohesion over symmetry: `order-detail-row` lives inside `order-detail/` because it
  exists only for it.

### 4.15 Formatting: pure `Intl` functions, not the Angular pipes

- **Choice**: a `shared/utils/format.ts` of **pure functions** (`formatPrice`,
  `formatSignedPrice`, `formatRate`) over `Intl.NumberFormat` (formatters memoised by
  `(locale, currency, sign)`), rather than the `| currency` / `| percent` pipes.
- **Why**: (1) the **`+` sign** decides it — `CurrencyPipe` has no `signDisplay`, so
  it never prefixes `+` on a positive; the dashboard shows signed margins
  (`+72 000 €`), and `Intl` does it via `signDisplay: 'exceptZero'`. (2) **No locale
  ceremony** — the pipes need `LOCALE_ID` + `registerLocaleData`, or format en-US
  silently; `Intl.NumberFormat` uses the runtime ICU. (3) **Usable outside templates**
  — pure functions work in TS and are testable without Angular.
- **Concession**: `PercentPipe` alone would cover `formatRate`, but fragmenting would
  be inconsistent (and still need the locale registered).

---

## 5. Quality

### 5.1 `strict: true` + `strictTemplates`

- **Choice**: both enabled.
- **Why**: explicit brief requirement; `strictTemplates` extends the rigour to
  template bindings (where UI bugs live).

### 5.2 Tests: Vitest, pure functions, no TestBed

- **Choice**: ~12 targeted assertions on revenue / margin / aggregates / filtering /
  sort, via a `makeOrder(overrides)` factory, plus two shell contract tests (the brand
  home-link and the router-outlet). No UI-behaviour tests.
- **Alternatives**: component tests (TestBed + DOM), e2e, broad coverage.
- **Why**: the brief says it — "3–5 well-chosen tests > 30 shallow ones", "no need to
  cover the UI". The critical logic is pure, so tests are fast, deterministic,
  readable. Cases chosen for value: **negative** margin (business reality), empty list
  (no NaN), accent-insensitive search (FR i18n), filter+status combination, the
  no-filter referential-identity contract (keeps the computeds memoized), and a
  raw-numeric sort.
- **Why the store isn't tested directly**: the brief _defines_ the scope — "critical
  logic (margin, aggregates, filtering)" — which is exactly the pure core already
  covered. The store **composes** those functions and holds the framework **seam**;
  testing it would need TestBed + a feed mock to re-verify what the domain tests
  cover, and would test the Angular wiring the brief says not to cover. What the store
  leaves untested is deliberate: the `apply → visibleOrders` seam is a one-line
  idempotent upsert into an already-tested chain; the highlight timers' real risk (the leak) is closed by
  construction. If the store gained its own business logic (optimistic updates, undo),
  that would earn tests.

### 5.3 Verification in the real browser (not just build + tests)

- **Choice**: every UI piece was verified in the browser with measurable proof — a
  filter recomputing the aggregates, a margin sort checked on displayed values, the
  highlight sampled on the `.updated` rows, the drawer showing post-event values.
- **Why**: green build + green tests prove neither smoothness nor the absence of a
  full redraw — the brief's perf requirements only test at runtime. A method that
  _demonstrates_ rather than asserts.

### 5.4 Versioned agent documentation (AGENTS.md, docs/)

- **Choice**: the repo ships `AGENTS.md` (the agent's standing instructions —
  vendor-neutral [agents.md](https://agents.md), with `CLAUDE.md` a symlink), this
  decision log, and `docs/agent-workflow.md`. `.claude/` is versioned too: a
  permissions allowlist, an `/adr` command, a reviewer agent, and a project-specific
  `vela-verify` skill (green build+tests+prettier, then exercise the change on the
  **prod** bundle).
- **Why**: the brief explicitly asks for "the .md files used when working with an
  agent". This is the structural answer to the "mass-generated code without
  understanding" disqualifier — the agent is driven by written conventions and every
  choice is recorded with its alternatives.

### 5.5 Commit history + git hooks

- **Choice**: atomic commits in build order (core → feed → store → UI → docs), build +
  tests green at each. Git hooks (husky v9): `commit-msg` → commitlint (Conventional
  Commits); `pre-commit` → lint-staged (`prettier --write` on staged files only).
- **Why**: the brief reads the history — the order tells the story, the convention
  keeps it parseable. The hooks keep every commit's message and formatting clean by
  construction.

### 5.6 README hub + `docs/` (no monolithic README)

- **Choice**: a short "hub" README (static badges, pitch, getting started,
  architecture digest) + a `docs/` folder (`architecture.md`, `ui.md`) for the long
  dives.
- **Guardrail (the brief's literal requirements)**: they stay _in_ the README, in full
  — the `npm install && npm start` instructions, the **signals vs RxJS** rationale, and
  the "deliberately left out" list. Only long developments are externalised.
- **Badges**: static only — a dynamic status badge is added only once its source is
  live on the remote (a badge that 404s is worse than none).

---

## 6. Simulated real-time feed

### 6.1 Random cadence: `timer` + `expand` (not `interval`, not `setInterval`)

- **Choice**: `timer(randomDelay()).pipe(expand(() => timer(randomDelay())))` — each
  emission re-schedules the next tick with a **new** random delay.
- **Alternatives**: `interval(1000)` (fixed period); bare `setInterval`/`setTimeout`
  (imperative, manual cleanup = the "leak" disqualifier, not composable).
- **Why**: everything stays declarative and cancellable in one unsubscribe — the timer
  chain tears itself down. The archetypal RxJS argument: composing time.

### 6.2 Events as a discriminated union carrying the full snapshot

- **Choice**: `OrderEvent = {kind:'created'} | {kind:'updated', change: …}`, each event
  carrying the **full updated order** (not a delta).
- **Alternatives**: deltas (`{id, field, value}`); emit the whole list per tick.
- **Why**: the full snapshot makes the store side trivial (replace by `id`) and
  **order/loss-insensitive** — one event is truth. Deltas would force the store to
  duplicate the simulator's business logic; the whole list would break targeted
  updates. It's the shape a real WebSocket payload would have.

### 6.3 The simulator holds the truth (backend role), the store materialises

- **Choice**: `OrdersStream` keeps an internal `Map<id, OF>` to generate coherent
  events (production capped at plan, `termine` terminal, creation fallback). The store
  keeps its own state from `initialOrders` + `events$`.
- **Why**: it reproduces the real client/server topology — the day a real backend
  arrives, `OrdersStream` is replaced by a WebSocket client of the same `OrdersFeed`
  contract (§6.6) and **nothing else changes**. The state duplication is the price of
  that boundary.

### 6.4 `share()` and a cold feed (nuance: a **stateful** multicast)

- **Choice**: `events$` is cold (nothing runs without a subscriber) and multicast
  (`share()`).
- **Why**: no ghost work if nobody listens (no leak by construction); a second
  subscriber wouldn't spawn a second timer chain. Cleanup is the single real
  consumer's job (the store subscribes with `takeUntilDestroyed`).
- **Honest nuance**: "cold" applies to the timer activation, not to a pure/replayable
  stream. The class carries mutable state (`orders`, `nextSeq`) that survives a
  resubscription → it's a **stateful multicast** simulator: a new subscriber
  _continues_ the simulation, it doesn't _replay_ it.

### 6.5 No tests on the simulator

- **Choice**: zero tests on `orders-stream.ts` / `order-generator.ts`.
- **Why**: random output, and outside the brief's "critical logic". Testing the
  simulator = testing the mock. If the feed became production code, plausibility would
  be tested via invariants (production ≤ plan, costs ≥ 0) with an injected RNG. Listed
  as deliberately left out in the README.

### 6.6 An explicit feed contract: `OrdersFeed` (abstract class + DI token)

- **Choice**: the store depends on an **abstract class** `OrdersFeed` (`initialOrders` +
  `events$`), not the concrete class. `OrdersStream` implements it;
  `{ provide: OrdersFeed, useExisting: OrdersStream }` wires them in `app.config.ts`.
  The store does `inject(OrdersFeed)`.
- **Alternatives**: inject `OrdersStream` directly (a structural, implicit contract); a
  TS `interface` + a separate `InjectionToken`.
- **Why**: the design's central claim is "swappable for a real WebSocket of the same
  interface" (§6.3). An abstract class **materialises** that contract _and_ doubles as
  the DI token (Angular idiom, cf. `ErrorHandler`) → a `WebSocketOrdersFeed` drops in by
  changing one provider line; and a store test could inject a fake feed. Preferred to
  interface + token (two artifacts): an abstract class is both the type and the token.
- **Trade-off**: one DI indirection for a single implementation today — the only
  abstraction that directly serves the "swappable backend" thesis, not speculative.

---

## 7. The RxJS → signal seam

### 7.1 Explicit subscription + private reducer (not `toSignal` + `scan`)

- **Choice**: in `OrdersStore`, one subscription
  `events$.pipe(takeUntilDestroyed()).subscribe(evt => this.apply(evt))`; `apply()` is
  a private reducer doing an idempotent upsert by `id`.
- **Alternative**: `toSignal(events$.pipe(scan(applyEvent, initial)))` — equally
  correct.
- **Why the explicit subscription**: (1) **visible cleanup** — `takeUntilDestroyed()`
  proves the subscription dies with the store (against the "unclean subscriptions"
  disqualifier); (2) **extensible to non-feed mutations** — a future user action is one
  more method on the same signal, whereas `scan` would force merging an action Subject;
  (3) **readability** — `apply(evt)` is a named, pointable reducer.
- **General rule**: components never subscribe; the feed never crosses a template; the
  conversion happens in one place, the store.

### 7.2 No feed error handling (deliberate, not an oversight)

- **Choice**: the subscription has only a `next` handler — no `error`, no `complete`.
- **Why it's correct here**: (1) **no error source** — `OrdersStream` is a
  100 %-client simulator with zero I/O; an `Observable` only errors on a failing
  operation, so an `error:` handler would be dead, untestable code. (2) **Resilience
  belongs at the seam, not the reducer** — with a real WebSocket, errors are handled in
  the stream pipe (`retry` + `catchError`) plus a `connectionStatus` signal and a stale
  banner; `apply()` wouldn't change (listed in README §4). (3) **Fail-loud is
  intended** — the real dev risk is a bug in `apply()`; unhandled, it surfaces loudly
  (console / `ErrorHandler`), whereas a token `error:` handler would swallow it and
  freeze the feed silently.
