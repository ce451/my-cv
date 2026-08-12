import { Component } from '@angular/core';
import { CV } from '../content/cv-data';
import { splitIntro } from '../content/cv-format';
import { UI } from '../ui/ui-text';
import { EmailLink } from '../ui/email-link';
import { Letters } from '../fx/letters';

@Component({
  selector: 'app-hero',
  imports: [Letters, EmailLink],
  templateUrl: './hero.html',
})
export class Hero {
  protected readonly cv = CV;
  protected readonly ui = UI;
  protected readonly tagline = CV.profile.tagline ?? splitIntro(CV.profile.intro).lead;
  protected readonly hasEmail = CV.profile.contacts.some((c) => c.type === 'email');
  protected readonly contactLinks = CV.profile.contacts.filter((c) => c.url && c.type !== 'email');
  protected readonly highlightsLine = CV.profile.highlights.join(' · ');
}
