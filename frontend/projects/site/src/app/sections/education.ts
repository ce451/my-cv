import { Component } from '@angular/core';
import { CvEducation } from 'content-model';
import { CV } from '../content/cv-data';
import { formatPeriod } from '../content/cv-format';
import { UI } from '../ui/ui-text';
import { Reveal } from '../fx/reveal';

@Component({
  selector: 'app-education',
  imports: [Reveal],
  templateUrl: './education.html',
})
export class Education {
  protected readonly ui = UI;
  protected readonly education = CV.education;
  protected readonly internships = CV.internships;

  protected period(entry: CvEducation): string {
    return formatPeriod(entry.start, entry.end, this.ui.present);
  }
}
