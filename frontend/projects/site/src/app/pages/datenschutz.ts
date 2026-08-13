import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { buildWebPageJsonLd } from '../content/schema';
import { EmailLink } from '../ui/email-link';
import { PageHead } from '../ui/page-head';
import { UI } from '../ui/ui-text';

const TITLE = 'Impressum und Datenschutz · Christopher Elstner';
const DESCRIPTION =
  'Offenlegung gemäß § 25 MedienG und Datenschutzerklärung dieser Website: keine Cookies, ' +
  'kein Tracking, keine externen Dienste; Hosting über Cloudflare Pages.';

@Component({
  selector: 'app-datenschutz',
  imports: [RouterLink, EmailLink],
  templateUrl: './datenschutz.html',
})
export class Datenschutz {
  protected readonly ui = UI;

  constructor() {
    inject(PageHead).apply({
      path: '/datenschutz/',
      title: TITLE,
      description: DESCRIPTION,
      ogType: 'website',
      jsonLd: buildWebPageJsonLd(TITLE, '/datenschutz/', DESCRIPTION),
    });
  }
}
