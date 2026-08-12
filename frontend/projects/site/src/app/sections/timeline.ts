import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  viewChild,
  viewChildren,
} from '@angular/core';
import { CvExperience } from 'content-model';
import { CV } from '../content/cv-data';
import { formatPeriod } from '../content/cv-format';
import { UI } from '../ui/ui-text';
import { FxLoop } from '../fx/fx-loop';
import { prefersReducedMotion } from '../fx/motion';
import { Reveal } from '../fx/reveal';

@Component({
  selector: 'app-timeline',
  imports: [Reveal],
  templateUrl: './timeline.html',
})
export class Timeline {
  protected readonly ui = UI;
  protected readonly experiences = CV.experiences;

  private readonly container = viewChild.required<ElementRef<HTMLElement>>('timeline');
  private readonly progress = viewChild.required<ElementRef<HTMLElement>>('progress');
  private readonly ghosts = viewChildren<ElementRef<HTMLElement>>('ghost');
  private readonly loop = inject(FxLoop);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      const reduced = prefersReducedMotion();
      const containerEl = this.container().nativeElement;
      const progressEl = this.progress().nativeElement;
      if (reduced) {
        progressEl.style.transform = 'scaleY(1)';
        return;
      }
      const unregister = this.loop.register(() => {
        const rect = containerEl.getBoundingClientRect();
        const p = Math.min(1, Math.max(0, (innerHeight * 0.8 - rect.top) / rect.height));
        progressEl.style.transform = `scaleY(${p})`;
        for (const ghost of this.ghosts()) {
          const el = ghost.nativeElement;
          const ghostRect = el.getBoundingClientRect();
          el.style.transform = `translateY(${(ghostRect.top - innerHeight / 2) * 0.12}px)`;
        }
      });
      this.destroyRef.onDestroy(unregister);
    });
  }

  protected period(experience: CvExperience): string {
    return formatPeriod(experience.start, experience.end, this.ui.present);
  }

  protected note(experience: CvExperience): string {
    return [experience.positionNote, experience.organizationNote].filter(Boolean).join(' · ');
  }

  protected year(experience: CvExperience): string {
    return experience.start.slice(0, 4);
  }
}
