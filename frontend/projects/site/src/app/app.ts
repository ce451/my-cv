import { Component, DestroyRef, NgZone, afterNextRender, inject, signal } from '@angular/core';
import { CV } from './content/cv-data';
import { UI } from './ui/ui-text';
import { Cursor } from './fx/cursor';
import { Particles } from './fx/particles';
import { Contact } from './sections/contact';
import { Education } from './sections/education';
import { Hero } from './sections/hero';
import { IntroStats } from './sections/intro-stats';
import { Projects } from './sections/projects';
import { Skills } from './sections/skills';
import { Timeline } from './sections/timeline';

@Component({
  selector: 'app-root',
  imports: [Particles, Cursor, Hero, IntroStats, Timeline, Projects, Skills, Education, Contact],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly ui = UI;
  protected readonly name = CV.profile.fullName;
  protected readonly year = new Date().getFullYear();
  protected readonly scrolled = signal(false);

  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
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
