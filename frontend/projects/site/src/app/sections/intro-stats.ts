import { Component } from '@angular/core';
import { CV } from '../content/cv-data';
import { computeStats } from '../content/cv-format';
import { UI } from '../ui/ui-text';
import { Counter } from '../fx/counter';
import { Reveal } from '../fx/reveal';

@Component({
  selector: 'app-intro-stats',
  imports: [Counter, Reveal],
  templateUrl: './intro-stats.html',
})
export class IntroStats {
  protected readonly ui = UI;
  // The hero shows the tagline, so the full intro belongs to this section.
  protected readonly intro = CV.profile.intro;
  protected readonly stats = computeStats(CV, new Date());
}
