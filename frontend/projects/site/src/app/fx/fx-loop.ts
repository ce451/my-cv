import { Injectable, NgZone, inject } from '@angular/core';

/**
 * Single rAF loop shared by all continuous effects. Runs outside Angular,
 * skips work while the tab is hidden and stops when no callbacks remain.
 */
@Injectable({ providedIn: 'root' })
export class FxLoop {
  private readonly zone = inject(NgZone);
  private readonly callbacks = new Set<() => void>();
  private running = false;

  register(callback: () => void): () => void {
    this.callbacks.add(callback);
    this.ensureRunning();
    return () => this.callbacks.delete(callback);
  }

  private ensureRunning(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.zone.runOutsideAngular(() => requestAnimationFrame(this.tick));
  }

  private readonly tick = (): void => {
    if (this.callbacks.size === 0) {
      this.running = false;
      return;
    }
    if (typeof document === 'undefined' || !document.hidden) {
      this.callbacks.forEach((callback) => callback());
    }
    requestAnimationFrame(this.tick);
  };
}
