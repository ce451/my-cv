import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CV } from '../content/cv-data';
import { UI } from '../ui/ui-text';
import { Reveal } from '../fx/reveal';
import { Tilt } from '../fx/tilt';

@Component({
  selector: 'app-projects',
  imports: [Reveal, Tilt, RouterLink],
  templateUrl: './projects.html',
})
export class Projects {
  protected readonly ui = UI;
  protected readonly projects = CV.projects;

  protected index(i: number): string {
    return String(i + 1).padStart(2, '0');
  }

  /** "https://github.com/ce451/my-cv" → "my-cv" */
  protected repoName(url: string): string {
    return url.split('/').filter(Boolean).pop() ?? url;
  }
}
