# UI — hand-made design system + Tailwind bridge

> The brief evaluates structure, not design — this doc exists because the UI
> layer ended up _being_ structure: a self-contained mini design system
> (`src/app/ui/`) and a deliberate hybrid with Tailwind v4.

## The `ui/` layer

Generic, presentational, **domain-free** primitives — never importing `core/`
or `features/` — each colocated in its folder, exported through a barrel and
consumed via the `@ui` alias:

```
🗂 src/app/ui
├── 🗂 badge            ← <vela-badge>        (component)
├── 🗂 button           ← velaButton          (directive on native <button>/<a>)
├── 🗂 close-button     ← <vela-close-button> (component)
├── 🗂 drawer           ← <vela-drawer>       (component over native <dialog>)
├── 🗂 logo             ← <vela-logo>         (component, inline SVG wordmark)
├── 🗂 progress         ← velaProgress        (directive on native <progress>)
├── 🗂 tokens           ← design tokens (--v-*): palette + dimensions + semantic
├── tailwind-bridge.css   ← Tailwind @theme bridge (imported by styles/styles.css)
├── index.css           ← CSS manifest: tokens + global .v-* sheets, one import
└── index.ts            ← barrel: import { Button, Drawer } from '@ui'
```

## Design tokens: two layers (`tokens/`)

Split by layer so the architecture is visible in the tree — `tokens/index.css`
composes them (primitives first):

- **primitives** — `palette.css` (Tailwind v4 OKLCH) + `dimensions.css` (radius,
  spacing, type scale, weights, fonts, control sizes). Never referenced by
  components.
- **semantic aliases** — `semantic.css`: intent-named tokens (`--v-color-text-*`,
  `--v-color-surface*`, `--v-color-bg-fill-*`, `--v-shadow-*`, `--v-focus-ring`…)
  resolved per colour scheme with `light-dark()`. Components use ONLY these, so
  re-theming happens here.

The app is pinned dark (`color-scheme: dark`) but both branches are defined —
flipping to `light dark` would light-theme the app for free.

## Tailwind v4: a deliberate hybrid

**Features are utility-first; primitives keep scoped CSS.** The mature pattern
in Angular + Tailwind is not "all utilities":

- **`tailwind-bridge.css` — the `@theme inline` bridge** maps the semantic `--v-*`
  tokens onto Tailwind's per-property namespaces, so utilities _speak our
  tokens_: `text-secondary`, `bg-surface-raised`, `border-default`,
  `rounded-md`, `p-4`… all resolve to `var(--v-*)`. `inline` is deliberate:
  the utility references the variable at the use-site instead of freezing the
  value, so `light-dark()` still resolves per scheme.
- **Feature layer** (app shell, orders table/stats/filters, detail
  layout): utility classes in the templates; host-level layout via
  `host: { class: '…' }`, never a wrapper element.
- **Primitives** keep their own CSS for what utilities express poorly:
  `:host([data-…])` variants, `::backdrop` and `::-webkit-progress-*`
  pseudo-elements, `@starting-style` + `transition-behavior: allow-discrete`
  (the drawer's in/out animation), masked-SVG icons, `color-mix()`.

## Primitive nature follows role

- **Directive** — a native _leaf control enhanced in place_, no wrapper:
  `velaButton` on `<button>`/`<a>` (applies `.v-button` + `data-*`, defaults
  `type="button"`), `velaProgress` on `<progress>` (native `value`/`max`,
  ARIA for free). Styled by global `.v-*` stylesheets.
- **Component** — a _container with projected content or logic_:
  `vela-drawer` (wraps a native `<dialog>`; one `effect` is the only code
  opening/closing it, dismiss paths just emit `closed`), `vela-badge`,
  `vela-close-button` (owns its ✕ icon), `vela-logo`. Inputs are reflected to
  `data-*` attributes and the CSS selects on them (`:host([data-variant])`) —
  the visual logic stays in CSS.
- **Class** — a pure native control: `.field` for the filter input/select.

Selector convention: components are kebab-case (`vela-drawer`), directives
camelCase (`velaButton`). CSS naming: scope dictates the prefix — `.v-*` for
global/public classes, unprefixed for component-scoped internals.

## Why no UI library

Luxen UI was trialled then fully removed: its shadow-DOM elements import CSS
via Vite-only `./x.css?inline`, which `@angular/build`'s esbuild misroutes to
global CSS — `:host` rules become inert and the drawer shipped unstyled in the
prod build (dev looked fine; the bug was prod-only). The app used almost
nothing from it, with zero design-token coupling, so removing it dropped the
dependency, the white-label plumbing and every `CUSTOM_ELEMENTS_SCHEMA` —
and full template type-checking came back everywhere.

Lesson kept: before adopting a Web Components library under `@angular/build`,
verify `?inline` CSS handling **in the production build**.
