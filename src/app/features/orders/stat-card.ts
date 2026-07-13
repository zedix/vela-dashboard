import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * One aggregate KPI: an uppercase caption over a large tabular figure. The
 * value is **projected**, so the caller controls formatting and sign colouring.
 *
 * Semantics: a native `<figure>` / `<figcaption>` — a self-contained
 * measurement bound to its label — not an `<article>` (a KPI is not
 * independently syndicable content). The host is `display: contents`, so the
 * `<figure>` itself is the grid item, not a redundant wrapper box.
 *
 * Presentational and feature-local (single consumer: the aggregates row);
 * promotable to `ui/` if a second feature ever needs a stat card.
 */
@Component({
  selector: 'vela-stat-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `<figure class="m-0 rounded-xl border border-default bg-surface-raised px-4 py-3.5">
    <figcaption class="text-xs uppercase tracking-[0.05em] text-secondary">
      {{ label() }}
    </figcaption>
    <p class="mt-1 text-2xl font-semibold tabular-nums"><ng-content /></p>
  </figure>`,
})
export class StatCard {
  readonly label = input.required<string>();
}
