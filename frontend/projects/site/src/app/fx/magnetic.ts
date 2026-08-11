import { DestroyRef, Directive, ElementRef, NgZone, afterNextRender, inject } from '@angular/core';
import { hasFinePointer, prefersReducedMotion } from './motion';

/** Pulls the first child element towards the cursor while hovering the host. */
@Directive({ selector: '[fxMagnetic]', host: { class: 'magnetic' } })
export class Magnetic {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      if (!hasFinePointer() || prefersReducedMotion()) {
        return;
      }
      const host = this.el.nativeElement;
      const target = host.firstElementChild as HTMLElement | null;
      if (!target) {
        return;
      }
      const onMove = (event: PointerEvent) => {
        const rect = host.getBoundingClientRect();
        const dx = event.clientX - rect.left - rect.width / 2;
        const dy = event.clientY - rect.top - rect.height / 2;
        target.style.transform = `translate(${dx * 0.25}px, ${dy * 0.35}px)`;
      };
      const onLeave = () => {
        target.style.transition = 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)';
        target.style.transform = '';
        setTimeout(() => {
          target.style.transition = '';
        }, 400);
      };
      this.zone.runOutsideAngular(() => {
        host.addEventListener('pointermove', onMove, { passive: true });
        host.addEventListener('pointerleave', onLeave, { passive: true });
      });
      this.destroyRef.onDestroy(() => {
        host.removeEventListener('pointermove', onMove);
        host.removeEventListener('pointerleave', onLeave);
      });
    });
  }
}
