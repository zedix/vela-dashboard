import { booleanAttribute, Directive, ElementRef, inject, input } from '@angular/core';

export type ButtonVariant = 'secondary' | 'primary' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Button — an **attribute directive** on a native `<button>`/`<a>`, not a
 * component: no wrapper element, the native element IS the button (click,
 * focus, `disabled` all native). It applies the `.v-button` class and reflects
 * typed inputs to `data-*`:
 *
 *   <button velaButton variant="primary" block>Fermer</button>
 *
 * A `<button>` with no explicit `type` defaults to `submit`; the directive
 * forces `type="button"` so it never submits a form by accident — an explicit
 * `type` (e.g. `type="submit"`) is left untouched.
 *
 * The visual styling is the global class stylesheet `button.css` (loaded via
 * angular.json). `data-*` are omitted for the defaults (secondary/md) to keep
 * the DOM clean.
 */
@Directive({
  selector: 'button[velaButton], a[velaButton]',
  host: {
    class: 'v-button',
    '[attr.data-variant]': "variant() === 'secondary' ? null : variant()",
    '[attr.data-size]': "size() === 'md' ? null : size()",
    '[attr.data-block]': "block() ? '' : null",
  },
})
export class Button {
  readonly variant = input<ButtonVariant>('secondary');
  readonly size = input<ButtonSize>('md');
  readonly block = input(false, { transform: booleanAttribute });

  constructor() {
    const el = inject(ElementRef).nativeElement;
    if (el instanceof HTMLButtonElement && !el.hasAttribute('type')) {
      el.type = 'button';
    }
  }
}
