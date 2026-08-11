import { Component, inject } from '@angular/core';
import { CV } from '../content/cv-data';
import { buildJsonLd } from '../content/schema';
import { PageHead } from '../ui/page-head';
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
export class Home {
  constructor() {
    inject(PageHead).apply({
      path: '/',
      title: 'Christopher Elstner — Senior Full-Stack Softwareentwickler',
      description:
        'Senior Full-Stack Softwareentwickler aus Weiz: Angular, .NET, Java. Über zwölf Jahre Software für Industrie und Gesundheitswesen — von der Anforderung bis zum Support.',
      ogType: 'profile',
      jsonLd: buildJsonLd(CV),
    });
  }
}
