import { DestroyRef, Directive, ElementRef, NgZone, afterNextRender, inject } from '@angular/core';
import { hasFinePointer, prefersReducedMotion } from './motion';

/** Moving glow highlight following the cursor on hover — desktop pointers only.
    Replaced the 3D tilt on 12.08.2026; the tilt felt too gimmicky. */
@Directive({ selector: '[fxGlow]', host: { class: 'glow' } })
export class Glow {
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
        host.style.setProperty('--gx', `${((event.clientX - rect.left) / rect.width) * 100}%`);
        host.style.setProperty('--gy', `${((event.clientY - rect.top) / rect.height) * 100}%`);
      };
      this.zone.runOutsideAngular(() => {
        host.addEventListener('pointermove', onMove, { passive: true });
      });
      this.destroyRef.onDestroy(() => {
        host.removeEventListener('pointermove', onMove);
      });
    });
  }
}
