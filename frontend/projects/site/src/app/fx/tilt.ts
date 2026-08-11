import { DestroyRef, Directive, ElementRef, NgZone, afterNextRender, inject } from '@angular/core';
import { hasFinePointer, prefersReducedMotion } from './motion';

/** 3D tilt with moving glow highlight on hover — desktop pointers only. */
@Directive({ selector: '[fxTilt]', host: { class: 'tilt' } })
export class Tilt {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      if (!hasFinePointer() || prefersReducedMotion()) {
        return;
      }
      const host = this.el.nativeElement;
      const onMove = (event: PointerEvent) => {
        const rect = host.getBoundingClientRect();
        const px = (event.clientX - rect.left) / rect.width;
        const py = (event.clientY - rect.top) / rect.height;
        host.style.transform = `rotateX(${(0.5 - py) * 7}deg) rotateY(${(px - 0.5) * 9}deg)`;
        host.style.setProperty('--gx', `${px * 100}%`);
        host.style.setProperty('--gy', `${py * 100}%`);
      };
      const onLeave = () => {
        host.style.transform = '';
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
