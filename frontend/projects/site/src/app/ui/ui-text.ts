/**
 * Central UI strings (German). i18n approach (see ADR 0004): a locale is this
 * object plus its cv.<locale>.json — adding English later means swapping both.
 */
export const UI = {
  skip: 'Zum Inhalt springen',
  locationSuffix: ', Österreich',
  portraitAltPrefix: 'Porträt von ',
  present: 'heute',
  back: '← Zur Startseite',
  toTop: 'Nach oben scrollen',
  /** Steht im Prerender anstelle der Adresse; ersetzt sie nach der Hydration (Spam-Schutz). */
  emailPlaceholder: 'E-Mail',
  sections: {
    werdegang: 'Werdegang',
    projekte: 'Private Projekte',
    kenntnisse: 'Kenntnisse',
    ausbildung: 'Ausbildung',
    praktika: 'Praktika',
  },
  stats: {
    years: 'Jahre Berufserfahrung',
    technologies: 'Technologien im Werkzeugkasten',
    languages: 'Kundengespräche in beiden Sprachen',
  },
  projectLabel: 'Projekt',
  contact: {
    lineTop: 'Klingt interessant?',
    lineBottom: 'Dann reden wir.',
    ctaEmail: 'E-Mail schreiben',
    ctaLinkedIn: 'Auf LinkedIn schreiben',
    or: 'oder',
    linkedInAlt: 'auf LinkedIn schreiben',
  },
  footer: {
    makingOf: 'Making-of',
    privacy: 'Datenschutz',
    source: 'Quellcode dieser Seite',
  },
} as const;
