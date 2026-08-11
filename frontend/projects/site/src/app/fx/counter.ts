import { DestroyRef, Directive, ElementRef, afterNextRender, inject, input } from '@angular/core';
import { formatNumber } from '../content/cv-format';
import { prefersReducedMotion } from './motion';

/**
 * Counts the number up from zero once visible. The template renders the final
 * value (SEO/no-JS); the animation replaces it in the browser.
 */
@Directive({ selector: '[fxCount]' })
export class Counter {
  readonly fxCount = input.required<number>();
  readonly fxCountDecimals = input(0);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      const host = this.el.nativeElement;
      const target = this.fxCount();
      const decimals = this.fxCountDecimals();
      const render = (value: number) => {
        host.textContent = formatNumber(value, decimals);
      };
      if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
        render(target);
        return;
      }
      const observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) {
            return;
          }
          observer.disconnect();
          let startTime: number | null = null;
          const step = (time: number) => {
            startTime ??= time;
            const progress = Math.min((time - startTime) / 1300, 1);
            render(target * (1 - Math.pow(1 - progress, 3)));
            if (progress < 1) {
              requestAnimationFrame(step);
            }
          };
          requestAnimationFrame(step);
        },
        { threshold: 0.6 },
      );
      observer.observe(host);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}
