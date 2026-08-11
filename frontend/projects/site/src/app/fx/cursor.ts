import { Component, DestroyRef, ElementRef, afterNextRender, inject, viewChild } from '@angular/core';
import { FxLoop } from './fx-loop';
import { hasFinePointer, prefersReducedMotion } from './motion';

/**
 * Custom cursor: dot plus trailing ring with a small orbiting "planet"
 * (desktop only). While active, the native cursor is hidden via a class
 * on <html> (see styles.scss).
 */
@Component({
  selector: 'fx-cursor',
  template: `
    <div class="dot" #dot aria-hidden="true"></div>
    <div class="ring" #ring aria-hidden="true"><i class="planet"></i></div>
  `,
  styles: `
    :host { display: contents; }
    .dot, .ring {
      position: fixed; top: 0; left: 0; z-index: 60;
      border-radius: 50%; pointer-events: none;
      transform: translate(-50%, -50%);
      display: none;
    }
    .dot { width: 8px; height: 8px; background: var(--teal); }
    .ring {
      width: 42px; height: 42px;
      border: 1px solid rgba(63, 208, 192, 0.5);
      transition: width 0.2s, height 0.2s;
    }
    .planet {
      position: absolute; top: 50%; left: 50%;
      width: 5px; height: 5px; margin: -2.5px 0 0 -2.5px;
      border-radius: 50%; background: var(--amber);
      animation: fx-orbit 2.6s linear infinite;
    }
    @keyframes fx-orbit {
      from { transform: rotate(0turn) translateX(14px); }
      to { transform: rotate(1turn) translateX(14px); }
    }
    :host(.active) .dot, :host(.active) .ring { display: block; }
    :host(.link) .ring { width: 66px; height: 66px; }
  `,
})
export class Cursor {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly dot = viewChild.required<ElementRef<HTMLElement>>('dot');
  private readonly ring = viewChild.required<ElementRef<HTMLElement>>('ring');
  private readonly loop = inject(FxLoop);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      if (!hasFinePointer() || prefersReducedMotion()) {
        return;
      }
      const hostEl = this.host.nativeElement;
      const dotEl = this.dot().nativeElement;
      const ringEl = this.ring().nativeElement;
      let targetX = innerWidth / 2;
      let targetY = innerHeight / 2;
      let ringX = targetX;
      let ringY = targetY;
      const docEl = document.documentElement;
      const onMove = (event: PointerEvent) => {
        hostEl.classList.add('active');
        docEl.classList.add('cursor-hidden');
        targetX = event.clientX;
        targetY = event.clientY;
      };
      const onOver = (event: Event) => {
        const interactive = (event.target as Element | null)?.closest('a, button');
        hostEl.classList.toggle('link', interactive != null);
      };
      addEventListener('pointermove', onMove, { passive: true });
      document.addEventListener('pointerover', onOver, { passive: true });
      const unregister = this.loop.register(() => {
        dotEl.style.left = `${targetX}px`;
        dotEl.style.top = `${targetY}px`;
        ringX += (targetX - ringX) * 0.14;
        ringY += (targetY - ringY) * 0.14;
        ringEl.style.left = `${ringX}px`;
        ringEl.style.top = `${ringY}px`;
      });
      this.destroyRef.onDestroy(() => {
        unregister();
        removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerover', onOver);
        docEl.classList.remove('cursor-hidden');
      });
    });
  }
}
