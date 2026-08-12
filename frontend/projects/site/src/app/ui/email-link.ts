import { Directive, ElementRef, afterNextRender, booleanAttribute, inject, input } from '@angular/core';
import { CV } from '../content/cv-data';

/**
 * Spam-harvester protection: the published JSON carries the e-mail address
 * base64-encoded (see PublishMapper) and the prerendered HTML shows only a
 * placeholder. This directive injects the mailto link, and optionally the
 * address as text, after hydration; harvesters scraping HTML, JSON or the
 * JS bundle never see the address in plain text.
 */
@Directive({ selector: 'a[appEmail]' })
export class EmailLink {
  readonly appEmailShowAddress = input(false, { transform: booleanAttribute });
  private readonly el = inject<ElementRef<HTMLAnchorElement>>(ElementRef);

  constructor() {
    afterNextRender(() => {
      const encoded = CV.profile.contacts.find((c) => c.type === 'email')?.value;
      if (!encoded) {
        return;
      }
      let address: string;
      try {
        address = atob(encoded);
      } catch {
        return;
      }
      const anchor = this.el.nativeElement;
      anchor.href = `mailto:${address}`;
      if (this.appEmailShowAddress()) {
        anchor.textContent = address;
      }
    });
  }
}
