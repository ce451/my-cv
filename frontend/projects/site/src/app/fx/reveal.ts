import { DestroyRef, Directive, ElementRef, afterNextRender, inject, signal } from '@angular/core';
import { prefersReducedMotion } from './motion';

/**
 * Reveals the host once it scrolls into view. The hidden initial state only
 * applies under `html.js` (see styles.scss), so prerendered HTML stays
 * readable without JavaScript.
 */
@Directive({
  selector: '[fxReveal]',
  host: { class: 'rv', '[class.in]': 'shown()' },
})
export class Reveal {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly shown = signal(false);

  constructor() {
    afterNextRender(() => {
      if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
        this.shown.set(true);
        return;
      }
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              this.shown.set(true);
              observer.disconnect();
            }
          }
        },
        { threshold: 0.16 },
      );
      observer.observe(this.el.nativeElement);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}
