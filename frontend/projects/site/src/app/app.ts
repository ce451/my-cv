import {
  Component,
  DestroyRef,
  NgZone,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
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

  private readonly scrolled = signal(false);
  private readonly onSubpage = signal(false);
  /** Nav shows after scrolling on the home page, immediately on subpages. */
  protected readonly navVisible = computed(() => this.scrolled() || this.onSubpage());

  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  constructor() {
    // Canonical, description, OG tags and JSON-LD come per route from PageHead
    // (see ui/page-head.ts), called in the page components.
    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.onSubpage.set(!event.urlAfterRedirects.split('#')[0].match(/^\/?$/));
      }
    });

    afterNextRender(() => {
      const onScroll = () => this.scrolled.set(scrollY > innerHeight * 0.55);
      onScroll();
      this.zone.runOutsideAngular(() => addEventListener('scroll', onScroll, { passive: true }));
      this.destroyRef.onDestroy(() => removeEventListener('scroll', onScroll));
    });
  }
}
