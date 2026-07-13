import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';

import { CloseButton } from '../close-button/close-button';

/**
 * Drawer — a right-side modal panel with a header / body / footer structure
 * (modelled on Luxen's dialog). The consumer fills **named slots** and never
 * writes the chrome:
 *
 *   <vela-drawer [open]="isOpen()" (closed)="close()">
 *     <div slot="title">…</div>       <!-- header, next to the built-in ✕ -->
 *     …body content…                  <!-- default slot -->
 *     <button slot="footer" …>OK</button>
 *   </vela-drawer>
 *
 * The **header always includes a `vela-close-button`**, so callers don't
 * provide one. The footer row collapses when its slot is empty. Built on
 * `showModal()` (top-layer, real `::backdrop`, focus trap).
 *
 * **Opening** is driven by the `open` input: an `effect` calls
 * `showModal()`/`close()` to match it. **Dismissal routes through the native
 * `<dialog>`**: Esc closes it natively, the ✕ and the backdrop call
 * `dialog.close()` — every path lands on the dialog's `close` event, which
 * emits `closed` **after the exit animation finishes** (`getAnimations()`).
 * Emitting post-animation lets a consumer that conditionally renders content
 * keep it mounted for the whole slide-out; the caller then clears its state,
 * which the `open` input reflects back. (An earlier version had dismiss paths
 * emit `closed` directly and bypass the native close — wrong: the panel then
 * unmounted its content mid-animation.)
 */
@Component({
  selector: 'vela-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CloseButton],
  template: `
    <!-- All dismissals go through the native <dialog>: Esc closes it natively,
         the ✕ and the backdrop call dialog.close() — the (close) event then
         notifies. This backdrop click is a mouse-only convenience; Esc covers
         the keyboard, and focus is trapped by showModal(). -->
    <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
    <dialog #dialog class="drawer" (close)="onNativeClose()" (click)="onBackdropClick($event)">
      <header class="drawer__head">
        <div class="drawer__title"><ng-content select="[slot=title]" /></div>
        <vela-close-button [label]="closeLabel()" (click)="dialog.close()" />
      </header>
      <div class="drawer__body"><ng-content /></div>
      <footer class="drawer__foot"><ng-content select="[slot=footer]" /></footer>
    </dialog>
  `,
  styleUrl: './drawer.css',
})
export class Drawer {
  readonly open = input.required<boolean>();

  /** Accessible label for the built-in close button. */
  readonly closeLabel = input('Fermer');

  readonly closed = output<void>();

  private readonly dialogRef = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const dialog = this.dialogRef()?.nativeElement;
      if (!dialog) return;
      if (this.open()) {
        if (!dialog.open) dialog.showModal();
      } else if (dialog.open) {
        dialog.close();
      }
    });
  }

  /** A click whose target is the dialog element itself lands on the `::backdrop`. */
  protected onBackdropClick(event: MouseEvent): void {
    const dialog = this.dialogRef()?.nativeElement;
    if (dialog && event.target === dialog) dialog.close();
  }

  /**
   * The single dismissal funnel: Esc, the ✕ and the backdrop all reach the
   * native `<dialog>` `close` event. Emit `closed` only once the exit animation
   * has finished, so conditionally-rendered content survives the slide-out.
   * `getAnimations()` resolves immediately when nothing is animating
   * (reduced-motion, zeroed durations) — no `transitionend` fragility.
   */
  protected async onNativeClose(): Promise<void> {
    const dialog = this.dialogRef()?.nativeElement;
    if (!dialog) return;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await Promise.all(
      dialog.getAnimations().map((animation) => animation.finished.catch(() => {})),
    );
    this.closed.emit();
  }
}
