import { Component } from '@angular/core';
import { CV } from '../content/cv-data';
import { splitIntro } from '../content/cv-format';
import { UI } from '../ui/ui-text';
import { Letters } from '../fx/letters';

@Component({
  selector: 'app-hero',
  imports: [Letters],
  templateUrl: './hero.html',
})
export class Hero {
  protected readonly cv = CV;
  protected readonly ui = UI;
  protected readonly tagline = CV.profile.tagline ?? splitIntro(CV.profile.intro).lead;
  protected readonly contactLinks = CV.profile.contacts.filter((c) => c.url);
  protected readonly highlightsLine = CV.profile.highlights.join(' · ');
}
