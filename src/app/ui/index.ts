/**
 * Design-system public API. Import primitives from `@ui`:
 *
 *   import { Badge, Button, Drawer } from '@ui';
 *
 * Re-exports only — the primitives are side-effect-free class definitions, so
 * esbuild tree-shakes anything not referenced in a component's `imports`. The
 * CSS side (tokens, global `.v-*` sheets) is composed by `ui/index.css`.
 *
 * Empty for now: primitives are added here as they land (badge with the table,
 * drawer/button with the detail panel, …).
 */

export {};
