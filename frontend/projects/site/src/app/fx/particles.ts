import { Component, DestroyRef, ElementRef, afterNextRender, inject, viewChild } from '@angular/core';
import { FxLoop } from './fx-loop';
import { prefersReducedMotion } from './motion';

interface Dot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

/** Decorative constellation background (specs: docs/design-system.md). */
@Component({
  selector: 'fx-particles',
  template: '<canvas #canvas aria-hidden="true"></canvas>',
  styles: `
    :host { position: fixed; inset: 0; z-index: 0; display: block; pointer-events: none; }
    canvas { display: block; width: 100%; height: 100%; }
  `,
})
export class Particles {
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly loop = inject(FxLoop);
  private readonly destroyRef = inject(DestroyRef);
  private dots: Dot[] = [];
  private readonly mouse = { x: -9999, y: -9999 };

  constructor() {
    afterNextRender(() => {
      if (prefersReducedMotion()) {
        return;
      }
      const canvas = this.canvasRef().nativeElement;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return;
      }
      let lastWidth = 0;
      const resize = () => {
        const dpr = Math.min(devicePixelRatio || 1, 2);
        canvas.width = innerWidth * dpr;
        canvas.height = innerHeight * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        // Mobile browsers fire resize when the URL bar collapses; height-only
        // changes keep the existing constellation so nothing visibly jumps.
        if (innerWidth === lastWidth && this.dots.length > 0) {
          return;
        }
        lastWidth = innerWidth;
        const count = Math.min(90, Math.floor(innerWidth / 16));
        this.dots = Array.from({ length: count }, () => ({
          x: Math.random() * innerWidth,
          y: Math.random() * innerHeight,
          vx: (Math.random() - 0.5) * 0.22,
          vy: (Math.random() - 0.5) * 0.22,
          r: Math.random() * 1.4 + 0.4,
        }));
      };
      const onPointer = (event: PointerEvent) => {
        this.mouse.x = event.clientX;
        this.mouse.y = event.clientY;
      };
      resize();
      addEventListener('resize', resize, { passive: true });
      addEventListener('pointermove', onPointer, { passive: true });
      const unregister = this.loop.register(() => this.draw(ctx));
      this.destroyRef.onDestroy(() => {
        unregister();
        removeEventListener('resize', resize);
        removeEventListener('pointermove', onPointer);
      });
    });
  }

  private draw(ctx: CanvasRenderingContext2D): void {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    const dots = this.dots;
    for (let i = 0; i < dots.length; i++) {
      const dot = dots[i];
      dot.x += dot.vx;
      dot.y += dot.vy;
      const dx = dot.x - this.mouse.x;
      const dy = dot.y - this.mouse.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 130 && dist > 0.01) {
        dot.x += (dx / dist) * 0.6;
        dot.y += (dy / dist) * 0.6;
      }
      if (dot.x < -20) dot.x = innerWidth + 20;
      if (dot.x > innerWidth + 20) dot.x = -20;
      if (dot.y < -20) dot.y = innerHeight + 20;
      if (dot.y > innerHeight + 20) dot.y = -20;
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, dot.r, 0, 6.2832);
      ctx.fillStyle = 'rgba(132, 212, 205, 0.62)';
      ctx.fill();
      for (let j = i + 1; j < dots.length; j++) {
        const other = dots[j];
        const ddx = dot.x - other.x;
        const ddy = dot.y - other.y;
        const dd = ddx * ddx + ddy * ddy;
        if (dd < 16900) {
          ctx.beginPath();
          ctx.moveTo(dot.x, dot.y);
          ctx.lineTo(other.x, other.y);
          ctx.strokeStyle = `rgba(108, 190, 183, ${0.16 * (1 - dd / 16900)})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }
  }
}
