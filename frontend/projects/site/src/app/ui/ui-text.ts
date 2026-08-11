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
  projectsMore: 'Wie diese Seite entsteht: zum Making-of →',
  contact: {
    lineTop: 'Klingt interessant?',
    lineBottom: 'Dann reden wir.',
    ctaLinkedIn: 'Auf LinkedIn schreiben',
    or: 'oder',
    github: 'Code auf GitHub ansehen',
  },
  footer: {
    makingOf: 'Making-of',
    privacy: 'Datenschutz',
    source: 'Quellcode dieser Seite',
  },
} as const;
