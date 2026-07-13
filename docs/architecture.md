# Architecture decisions and trade-offs

> Deep dive behind the [README digest](../README.md#2-architecture). Each choice
> states its trade-off — the point of listing them rather than just showing the
> final state. The UI/design-system decisions live in [ui.md](ui.md).

## Layout

```
🗂 src/app
├── 🗂 core
│   ├── 🗂 models       ← ManufacturingOrder, OrderEvent (discriminated unions, readonly)
│   ├── 🗂 domain       ← pnl.ts: margin, aggregates, filter, sort — PURE functions, tested
│   ├── 🗂 data         ← plausible order generator (demo data)
│   ├── 🗂 stream       ← OrdersStream: RxJS simulator (plays the backend role)
│   └── 🗂 store        ← OrdersStore: signal state + computed chain
├── 🗂 ui               ← self-contained mini design system (tokens, primitives, @theme bridge)
├── 🗂 features
│   └── 🗂 orders       ← table, filters, aggregates, <dialog> detail, status badge
└── 🗂 shared
    └── 🗂 utils        ← format.ts (Intl) + strings.ts + random.ts, barrel (@shared/utils)
```

One-way flow with a single RxJS→signals seam:

```
OrdersStream (RxJS)  ──events$──▶  OrdersStore (signals)  ──▶  components (read-only)
core/stream/                       core/store/                 features/orders/
```

## Structuring choices

- **Zoneless + `OnPush` everywhere**: change detection is driven by signals.
  With an event every 500ms–2s, Zone.js would re-check the whole tree on every
  tick; zoneless re-renders only what depends on the signals that changed.
  _Trade-off_: every state mutation must go through a signal — an accepted
  constraint that enforces unidirectional data flow.
- **Business logic = pure functions outside Angular** (`core/domain/pnl.ts`):
  margin, aggregates, filtering and sorting are testable without TestBed and
  reusable. Components implement no math. _Trade-off_: one more file, but it
  is the product's "business contract" — it deserves to stand alone.
- **Hand-rolled signal store** (no NgRx): private `signal` → `.asReadonly()`,
  derivations as `computed`, mutations encapsulated in methods. _Trade-off_:
  fewer guarantees than NgRx SignalStore (no devtools), but zero ceremony for
  a single feature — and mechanically migratable if the app grows.
- **The simulator plays the backend**: `OrdersStream` owns its own truth
  (internal mirror) and only exposes `initialOrders` + `events$`, where each
  event carries the **full order snapshot** (not a delta) — so the store
  applies events as idempotent upserts by id, insensitive to ordering.
  _Trade-off_: duplicated state between simulator and store — the price of a
  real client/server topology: plugging a real WebSocket in changes only this
  service.
- **Memoized computed chain** in the store:
  `_orders → allOrders → filteredOrders → {visibleOrders, aggregates}`. Table
  and header aggregates derive from the **same** `filteredOrders`, so they can
  never disagree with the active filter; each stage only recomputes when its
  actual inputs change (a filter keystroke never re-reads the feed).
- **Home-made table, `@for (…; track order.id)`**: tracking reuses the DOM
  element of any row whose order did not change — only touched rows re-render.
  **~1s update highlight**: a `Set` of "recent" ids in the store, one timer per
  id (reset if the order changes again), purged in `DestroyRef.onDestroy` — no
  timer accumulation possible. _Trade-off_: highlight state lives in the store
  (assumed UI state) rather than pure CSS — a CSS animation does not replay
  when `track` reuses the element.
- **Detail as a native `<dialog>`, not a route**: `OrderDetail` is a _dumb
  component_ (`input()`/`output()`) projecting into the reusable `vela-drawer`
  primitive (native `<dialog>` + `showModal()`: top-layer, real `::backdrop`,
  focus trap for free). The parent hands it `store.selectedOrder()` — a
  `computed` derived by id, so the panel **keeps updating in real time** with
  zero synchronisation. `order()` is the single source of truth: an `effect`
  alone opens/closes the dialog, so it can never desync from the selection.
  _Trade-off_: no shareable URL to an order (a `/of/:id` route would allow it)
  — accepted: the user keeps the table context.

## Naming conventions

Identifiers and comments in English (international-first codebase); the
brief-mandated fields and values stay verbatim in French (`quantitePrevue`,
`en_cours`… = the end users' ubiquitous language), with a JSDoc glossary in
`order.model.ts`. UI strings are French (French plant managers).

## Starting point

The project began from a personal Angular v22 boilerplate (shell, zoneless
config); its demo domain was removed in the first commit. Luxen UI (a Web
Components kit) was trialled and then removed — see the
[UI doc](ui.md#why-no-ui-library) for the post-mortem.
