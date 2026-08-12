import { Component } from '@angular/core';
import { CV } from '../content/cv-data';
import { UI } from '../ui/ui-text';
import { Reveal } from '../fx/reveal';
import { Glow } from '../fx/glow';

@Component({
  selector: 'app-projects',
  imports: [Reveal, Glow],
  templateUrl: './projects.html',
})
export class Projects {
  protected readonly ui = UI;

  /** Two independent column stacks ("masonry light"): cards keep their natural
      height and short cards tuck up under tall ones instead of leaving grid
      gaps. On mobile the columns dissolve (display: contents) and [style.order]
      restores the original 01…nn sequence. */
  protected readonly columns = [0, 1].map((column) =>
    CV.projects.map((project, n) => ({ project, n })).filter((item) => item.n % 2 === column),
  );

  protected index(i: number): string {
    return String(i + 1).padStart(2, '0');
  }

  /** "https://github.com/ce451/my-cv" → "my-cv"; profile links keep the host. */
  protected repoName(url: string): string {
    const parts = url.split('/').filter(Boolean);
    return parts.length > 3 ? (parts.pop() ?? url) : parts.slice(1).join('/');
  }
}
