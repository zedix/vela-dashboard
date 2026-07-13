import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { formatSignedPrice } from '@shared/utils';

/** Fixed internal coordinate system; the SVG stretches to its container. */
const WIDTH = 600;
const HEIGHT = 72;

/**
 * Real-time total-margin sparkline — hand-made SVG, zero dependency.
 *
 * The brief's attention point (no full redraw per event) is answered
 * structurally: the `<path>` elements are created ONCE; on every new point
 * Angular only rewrites their `d` attribute (a computed string over ≤
 * `capacity` points). No DOM node is ever destroyed/recreated, no chart
 * library repaints a whole canvas.
 *
 * The sliding window is the input itself: the store hands us its bounded
 * ring buffer. X positions use a FIXED per-point step (capacity-based), so
 * the line grows rightward until the window is full, then slides.
 */
@Component({
  selector: 'vela-margin-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block rounded-xl border border-default bg-surface-raised px-4 pt-3.5 pb-2.5' },
  templateUrl: './margin-chart.html',
  styleUrl: './margin-chart.css',
})
export class MarginChart {
  /** Margin samples, oldest first (already capped by the producer). */
  readonly points = input.required<readonly number[]>();

  /** Window size used for the fixed x-step (must match the producer's cap). */
  readonly capacity = input(120);

  protected readonly WIDTH = WIDTH;
  protected readonly HEIGHT = HEIGHT;

  protected readonly current = computed(() => this.points().at(-1) ?? 0);

  /** Y scale bounds, padded so a flat series doesn't divide by zero. */
  private readonly bounds = computed(() => {
    const points = this.points();
    if (points.length === 0) return { min: 0, max: 1 };
    let min = Math.min(...points);
    let max = Math.max(...points);
    if (min === max) {
      min -= 1;
      max += 1;
    }
    // 8% vertical padding so the line never kisses the edges.
    const pad = (max - min) * 0.08;
    return { min: min - pad, max: max + pad };
  });

  private readonly stepX = computed(() => WIDTH / (this.capacity() - 1));

  private y(value: number): number {
    const { min, max } = this.bounds();
    return HEIGHT - ((value - min) / (max - min)) * HEIGHT;
  }

  /** "M x,y L x,y …" over the current points — the ONLY thing that changes. */
  protected readonly linePath = computed(() => {
    const step = this.stepX();
    return this.points()
      .map(
        (value, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${this.y(value).toFixed(1)}`,
      )
      .join(' ');
  });

  /** Same polyline, closed down to the bottom edge for the soft fill. */
  protected readonly areaPath = computed(() => {
    const points = this.points();
    if (points.length < 2) return '';
    const step = this.stepX();
    const lastX = ((points.length - 1) * step).toFixed(1);
    return `${this.linePath()} L${lastX},${HEIGHT} L0,${HEIGHT} Z`;
  });

  /** Dashed zero line, only when the margin crosses sign within the window. */
  protected readonly zeroY = computed<number | null>(() => {
    const { min, max } = this.bounds();
    return min < 0 && max > 0 ? this.y(0) : null;
  });

  protected readonly formatSignedPrice = formatSignedPrice;
}
