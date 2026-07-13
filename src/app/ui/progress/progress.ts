import { Directive } from '@angular/core';

/**
 * Progress — an **attribute directive** on a native `<progress>`, not a
 * component: no wrapper element, the native element IS the bar. Its `value` /
 * `max` are native attributes and ARIA `progressbar` comes for free; omit
 * `value` for an indeterminate bar.
 *
 *   <progress velaProgress [value]="produced" [max]="planned"></progress>
 *
 * Mirrors `velaButton`: a native leaf control enhanced in place, styled by the
 * global class stylesheet `progress.css` (loaded via angular.json). The
 * directive is pure presentation — it only applies the `.v-progress` class.
 */
@Directive({
  selector: 'progress[velaProgress]',
  host: { class: 'v-progress' },
})
export class Progress {}
