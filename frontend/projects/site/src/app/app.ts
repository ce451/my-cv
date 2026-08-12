import {
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { CV } from './content/cv-data';
import { UI } from './ui/ui-text';
import { Cursor } from './fx/cursor';
import { Particles } from './fx/particles';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, Particles, Cursor],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly ui = UI;
  protected readonly name = CV.profile.fullName;
  protected readonly year = new Date().getFullYear();
  protected readonly email = CV.profile.contacts.find((c) => c.type === 'email' && c.url);

  /** The back-to-top button appears once the page is scrolled a bit. */
  protected readonly topVisible = signal(false);
  private readonly toTop = viewChild.required<ElementRef<HTMLElement>>('toTop');

  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    // Canonical, description, OG tags and JSON-LD come per route from PageHead
    // (see ui/page-head.ts), called in the page components.
    afterNextRender(() => {
      const buttonEl = this.toTop().nativeElement;
      const onScroll = () => {
        this.topVisible.set(scrollY > innerHeight * 0.6);
        const range = document.documentElement.scrollHeight - innerHeight;
        buttonEl.style.setProperty('--p', String(range > 0 ? Math.min(1, scrollY / range) : 0));
      };
      onScroll();
      this.zone.runOutsideAngular(() => addEventListener('scroll', onScroll, { passive: true }));
      this.destroyRef.onDestroy(() => removeEventListener('scroll', onScroll));
    });
  }

  protected scrollTop(): void {
    // scroll-behavior: smooth on <html> animates this; reduced motion keeps it instant.
    scrollTo({ top: 0 });
  }
}
