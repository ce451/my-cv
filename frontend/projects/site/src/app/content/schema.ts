import { PublicCv } from 'content-model';

export const SITE_ORIGIN = 'https://elstner.ch';

const PERSON_ID = `${SITE_ORIGIN}/#person`;

/** Launch date of the site — dateCreated of the ProfilePage. */
const SITE_LAUNCHED = '2026-08-11';

/**
 * schema.org ProfilePage/Person markup (Google-documented), derived from the
 * published content — machine-readable for search engines and recruiter tools.
 */
export function buildJsonLd(cv: PublicCv): Record<string, unknown> {
  const currentJob = cv.experiences.find((experience) => !experience.end);
  const mail = cv.profile.contacts.find((contact) => contact.type === 'email' && contact.url);
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    dateCreated: SITE_LAUNCHED,
    dateModified: cv.meta.publishedAt,
    mainEntity: {
      '@type': 'Person',
      '@id': PERSON_ID,
      name: cv.profile.fullName,
      jobTitle: cv.profile.role,
      description: cv.profile.intro,
      url: `${SITE_ORIGIN}/`,
      image: `${SITE_ORIGIN}/portrait-640.webp`,
      ...(mail && { email: mail.value }),
      address: {
        '@type': 'PostalAddress',
        addressLocality: cv.profile.location,
        addressCountry: 'AT',
      },
      sameAs: cv.profile.contacts
        .map((contact) => contact.url)
        .filter((url): url is string => !!url && !url.startsWith('mailto:')),
      knowsLanguage: cv.languages.map((language) => language.name),
      // The workstyle category holds sentences, not topics — skip it here.
      knowsAbout: cv.skills
        .filter((skill) => skill.category !== 'Arbeitsweise')
        .flatMap((skill) => skill.items),
      ...(currentJob && { worksFor: { '@type': 'Organization', name: currentJob.organization } }),
      hasOccupation: {
        '@type': 'Occupation',
        name: cv.profile.role,
        occupationLocation: { '@type': 'City', name: cv.profile.location },
      },
      alumniOf: cv.education
        .filter((entry) => entry.program)
        .map((entry) => ({ '@type': 'EducationalOrganization', name: entry.institution })),
    },
  };
}

/** Markup for the subpages — they are about the person, but not the profile itself. */
export function buildWebPageJsonLd(name: string, path: string, description: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name,
    url: SITE_ORIGIN + path,
    description,
    inLanguage: 'de',
    about: { '@id': PERSON_ID },
  };
}
