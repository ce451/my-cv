import { DOCUMENT, Injectable, inject } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { SITE_ORIGIN } from '../content/schema';

export interface PageHeadData {
  /** Canonical path — '/' or with trailing slash ('/making-of/'), matching the deployed URLs. */
  path: string;
  title: string;
  description: string;
  ogType: 'profile' | 'website';
  jsonLd: Record<string, unknown>;
}

/**
 * Per-route head elements: canonical link, meta description, Open Graph /
 * Twitter tags and JSON-LD. Called from the page components' constructors,
 * so everything lands in the prerendered HTML of each route.
 */
@Injectable({ providedIn: 'root' })
export class PageHead {
  private readonly doc = inject(DOCUMENT);
  private readonly meta = inject(Meta);

  apply(data: PageHeadData): void {
    const url = SITE_ORIGIN + data.path;
    this.meta.updateTag({ name: 'description', content: data.description });
    this.meta.updateTag({ property: 'og:type', content: data.ogType });
    this.meta.updateTag({ property: 'og:site_name', content: 'Christopher Elstner' });
    this.meta.updateTag({ property: 'og:title', content: data.title });
    this.meta.updateTag({ property: 'og:description', content: data.description });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ property: 'og:image', content: `${SITE_ORIGIN}/og-image.png` });
    this.meta.updateTag({ property: 'og:image:width', content: '1200' });
    this.meta.updateTag({ property: 'og:image:height', content: '630' });
    this.meta.updateTag({ property: 'og:locale', content: 'de_AT' });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.upsertCanonical(url);
    this.upsertJsonLd(data.jsonLd);
  }

  private upsertCanonical(href: string): void {
    let link = this.doc.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.doc.createElement('link');
      link.rel = 'canonical';
      this.doc.head.appendChild(link);
    }
    link.href = href;
  }

  private upsertJsonLd(data: Record<string, unknown>): void {
    let script = this.doc.getElementById('cv-jsonld') as HTMLScriptElement | null;
    if (!script) {
      script = this.doc.createElement('script');
      script.id = 'cv-jsonld';
      script.type = 'application/ld+json';
      this.doc.head.appendChild(script);
    }
    script.textContent = JSON.stringify(data);
  }
}
