/**
 * Design-system public API. Import primitives from `@ui`:
 *
 *   import { Badge, Button, Drawer } from '@ui';
 *
 * Re-exports only — the primitives are side-effect-free class definitions, so
 * esbuild tree-shakes anything not referenced in a component's `imports`. The
 * CSS side (tokens, global `.v-*` sheets) is composed by `ui/index.css`.
 */

export { Badge } from './badge/badge';
export type { BadgeVariant, BadgeAppearance, BadgeSize } from './badge/badge';

export { Button } from './button/button';
export type { ButtonVariant, ButtonSize } from './button/button';

export { CloseButton } from './close-button/close-button';
export type { CloseButtonAppearance } from './close-button/close-button';

export { Drawer } from './drawer/drawer';
