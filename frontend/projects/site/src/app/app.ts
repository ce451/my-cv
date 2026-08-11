import {
  Component,
  DestroyRef,
  DOCUMENT,
  NgZone,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { CV } from './content/cv-data';
import { buildJsonLd } from './content/schema';
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
    // Runs during prerender too, so the JSON-LD ends up in the static HTML.
    const doc = inject(DOCUMENT);
    if (!doc.getElementById('cv-jsonld')) {
      const script = doc.createElement('script');
      script.id = 'cv-jsonld';
      script.type = 'application/ld+json';
      script.text = JSON.stringify(buildJsonLd(CV));
      doc.head.appendChild(script);
    }

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

  protected print(): void {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }
}
