import { Component, DestroyRef, ElementRef, afterNextRender, inject, viewChild } from '@angular/core';
import { FxLoop } from './fx-loop';
import { hasFinePointer, prefersReducedMotion } from './motion';

interface Electron {
  angle: number;
  speed: number;
  plane: number;
  precession: number;
  wobbleFreq: number;
  wobblePhase: number;
  rx: number;
  ry: number;
  trail: { x: number; y: number }[];
}

/** Trail length while the pointer moves … */
const TRAIL_MOVING = 12;
/** … and while it rests — the atom "settles" and draws longer tails. */
const TRAIL_RESTING = 30;

/**
 * Custom cursor as a tiny atom (desktop only): the teal nucleus sits on the
 * pointer, three white electrons orbit a trailing anchor on tilted, slowly
 * precessing elliptical paths and drag a fading tail behind them (canvas).
 * While active, the native cursor is hidden via a class on <html>
 * (see styles.scss).
 */
@Component({
  selector: 'fx-cursor',
  template: `
    <div class="dot" #dot aria-hidden="true"></div>
    <canvas #canvas aria-hidden="true"></canvas>
  `,
  styles: `
    :host { display: contents; }
    .dot {
      position: fixed; top: 0; left: 0; z-index: 60;
      width: 8px; height: 8px; border-radius: 50%;
      background: var(--teal);
      box-shadow: 0 0 10px rgba(63, 208, 192, 0.75), 0 0 26px rgba(63, 208, 192, 0.3);
      pointer-events: none; display: none;
      transform: translate(-50%, -50%);
      transition: width 0.2s, height 0.2s;
    }
    canvas {
      /* Explizite CSS-Größe: ohne sie würde das Canvas in Attributgröße
         (Viewport × dpr) dargestellt und alles ab dpr > 1 verschoben. */
      position: fixed; inset: 0; width: 100%; height: 100%; z-index: 59;
      pointer-events: none; display: none;
    }
    :host(.active) .dot, :host(.active) canvas { display: block; }
    :host(.link) .dot { width: 14px; height: 14px; }
  `,
})
export class Cursor {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly dot = viewChild.required<ElementRef<HTMLElement>>('dot');
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly loop = inject(FxLoop);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      if (!hasFinePointer() || prefersReducedMotion()) {
        return;
      }
      const hostEl = this.host.nativeElement;
      const dotEl = this.dot().nativeElement;
      const canvas = this.canvasRef().nativeElement;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return;
      }

      let appliedDpr = 0;
      const resize = () => {
        appliedDpr = Math.min(devicePixelRatio || 1, 2);
        canvas.width = innerWidth * appliedDpr;
        canvas.height = innerHeight * appliedDpr;
        ctx.setTransform(appliedDpr, 0, 0, appliedDpr, 0, 0);
      };
      resize();
      addEventListener('resize', resize, { passive: true });

      // Three orbital planes ~60° apart, each with its own tilt, direction,
      // speed wobble and slow precession — regular enough to read as an atom,
      // irregular enough to feel alive.
      const electrons: Electron[] = Array.from({ length: 3 }, (_, i) => ({
        angle: Math.random() * Math.PI * 2,
        speed: (0.03 + Math.random() * 0.02) * (i % 2 ? -1 : 1),
        plane: (Math.PI / 3) * i + (Math.random() - 0.5) * 0.5,
        precession: (0.002 + Math.random() * 0.004) * (i % 2 ? 1 : -1),
        wobbleFreq: 0.5 + Math.random(),
        wobblePhase: Math.random() * Math.PI * 2,
        rx: 18 + i * 8,
        ry: (18 + i * 8) * (0.34 + Math.random() * 0.14),
        trail: [],
      }));

      let targetX = innerWidth / 2;
      let targetY = innerHeight / 2;
      let coreX = targetX;
      let coreY = targetY;
      let prevX = targetX;
      let prevY = targetY;
      let trailMax = TRAIL_MOVING;
      const onMove = (event: PointerEvent) => {
        hostEl.classList.add('active');
        document.documentElement.classList.add('cursor-hidden');
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
        // Monitorwechsel am Dock kann die Pixeldichte ohne resize-Event ändern.
        if (Math.min(devicePixelRatio || 1, 2) !== appliedDpr) {
          resize();
        }
        dotEl.style.left = `${targetX}px`;
        dotEl.style.top = `${targetY}px`;
        coreX += (targetX - coreX) * 0.14;
        coreY += (targetY - coreY) * 0.14;
        ctx.clearRect(0, 0, innerWidth, innerHeight);
        if (!hostEl.classList.contains('active')) {
          return;
        }
        const t = performance.now() / 1000;
        const moving = Math.hypot(targetX - prevX, targetY - prevY) > 0.4;
        prevX = targetX;
        prevY = targetY;
        trailMax += ((moving ? TRAIL_MOVING : TRAIL_RESTING) - trailMax) * 0.04;
        for (const electron of electrons) {
          electron.angle +=
            electron.speed * (1 + 0.3 * Math.sin(t * electron.wobbleFreq + electron.wobblePhase));
          electron.plane += electron.precession;
          const cos = Math.cos(electron.plane);
          const sin = Math.sin(electron.plane);
          const px = Math.cos(electron.angle) * electron.rx;
          const py = Math.sin(electron.angle) * electron.ry;
          const x = coreX + px * cos - py * sin;
          const y = coreY + px * sin + py * cos;
          electron.trail.unshift({ x, y });
          while (electron.trail.length > Math.round(trailMax)) {
            electron.trail.pop();
          }
          ctx.lineCap = 'round';
          for (let k = 0; k + 1 < electron.trail.length; k++) {
            const fade = 1 - k / electron.trail.length;
            ctx.beginPath();
            ctx.moveTo(electron.trail[k].x, electron.trail[k].y);
            ctx.lineTo(electron.trail[k + 1].x, electron.trail[k + 1].y);
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.36 * fade * fade})`;
            ctx.lineWidth = 2.2 * fade;
            ctx.stroke();
          }
          ctx.beginPath();
          ctx.arc(x, y, 2.6, 0, 6.2832);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
          ctx.fill();
        }
      });

      this.destroyRef.onDestroy(() => {
        unregister();
        removeEventListener('pointermove', onMove);
        removeEventListener('resize', resize);
        document.removeEventListener('pointerover', onOver);
        document.documentElement.classList.remove('cursor-hidden');
      });
    });
  }
}
