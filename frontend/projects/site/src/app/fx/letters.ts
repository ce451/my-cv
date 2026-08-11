import { Directive, ElementRef, afterNextRender, inject } from '@angular/core';
import { prefersReducedMotion } from './motion';

/**
 * Splits the host's text into per-letter spans for the hero rise animation.
 * Prerendered HTML keeps the plain text (SEO); the split happens in the browser.
 */
@Directive({ selector: '[fxLetters]' })
export class Letters {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    afterNextRender(() => {
      const host = this.el.nativeElement;
      if (!prefersReducedMotion()) {
        let index = 0;
        host.innerHTML = (host.textContent ?? '')
          .trim()
          .split(/\s+/)
          .map(
            (word) =>
              `<span class="word">${word
                .split('')
                .map((ch) => `<span class="l" style="--i:${index++}">${ch}</span>`)
                .join('')}</span>`,
          )
          .join(' ');
      }
      host.classList.add('split');
    });
  }
}
