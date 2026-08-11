import { Component } from '@angular/core';
import { Contact } from '../sections/contact';
import { Education } from '../sections/education';
import { Hero } from '../sections/hero';
import { IntroStats } from '../sections/intro-stats';
import { Projects } from '../sections/projects';
import { Skills } from '../sections/skills';
import { Timeline } from '../sections/timeline';

@Component({
  selector: 'app-home',
  imports: [Hero, IntroStats, Timeline, Projects, Skills, Education, Contact],
  templateUrl: './home.html',
})
export class Home {}
