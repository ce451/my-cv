import { Component } from '@angular/core';
import { CV } from '../content/cv-data';
import { UI } from '../ui/ui-text';
import { Reveal } from '../fx/reveal';

@Component({
  selector: 'app-skills',
  imports: [Reveal],
  templateUrl: './skills.html',
})
export class Skills {
  protected readonly ui = UI;
  protected readonly skills = CV.skills;
}
