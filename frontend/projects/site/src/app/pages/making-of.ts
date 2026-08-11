import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { buildWebPageJsonLd } from '../content/schema';
import { PageHead } from '../ui/page-head';
import { UI } from '../ui/ui-text';

const TITLE = 'Making-of · Christopher Elstner';
const DESCRIPTION =
  'Wie diese Website entsteht: KI-gestützter Entwicklungsworkflow mit Claude Code, ' +
  'Architekturentscheidungen als ADRs, privates Content-Backend und Tests in der CI.';

@Component({
  selector: 'app-making-of',
  imports: [RouterLink],
  templateUrl: './making-of.html',
})
export class MakingOf {
  protected readonly ui = UI;

  constructor() {
    inject(PageHead).apply({
      path: '/making-of/',
      title: TITLE,
      description: DESCRIPTION,
      ogType: 'website',
      jsonLd: buildWebPageJsonLd(TITLE, '/making-of/', DESCRIPTION),
    });
  }
}
