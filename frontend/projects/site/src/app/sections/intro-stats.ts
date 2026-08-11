import { Component } from '@angular/core';
import { CV } from '../content/cv-data';
import { computeStats, formatNumber, splitIntro } from '../content/cv-format';
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
  protected readonly rest = splitIntro(CV.profile.intro).rest;
  protected readonly stats = computeStats(CV, new Date());
  protected readonly tenureText = formatNumber(this.stats.longestTenureYears, 1);
}
