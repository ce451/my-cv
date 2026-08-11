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
  nav: {
    brand: 'CE',
    werdegang: 'Werdegang',
    projekte: 'Projekte',
    kenntnisse: 'Kenntnisse',
    kontakt: 'Kontakt',
    pdf: 'Lebenslauf als PDF',
  },
  sections: {
    werdegang: 'Werdegang',
    projekte: 'Private Projekte',
    kenntnisse: 'Kenntnisse',
    ausbildung: 'Ausbildung',
    praktika: 'Praktika',
  },
  stats: {
    years: 'Jahre Berufserfahrung',
    technologies: 'Technologien im Projekteinsatz',
    languages: 'Kundengespräche in beiden Sprachen',
  },
  projectLabel: 'Projekt',
  contact: {
    lineTop: 'Klingt interessant?',
    lineBottom: 'Dann reden wir.',
    ctaLinkedIn: 'Auf LinkedIn schreiben',
    or: 'oder',
    github: 'Code auf GitHub ansehen',
    pdf: 'Lebenslauf als PDF',
  },
  footer: {
    makingOf: 'Making-of',
    privacy: 'Datenschutz',
    source: 'Quellcode dieser Seite',
  },
} as const;
