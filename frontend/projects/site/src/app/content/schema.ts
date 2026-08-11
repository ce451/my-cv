import { PublicCv } from 'content-model';

/**
 * schema.org ProfilePage/Person markup (Google-documented), derived from the
 * published content — machine-readable for search engines and recruiter tools.
 */
export function buildJsonLd(cv: PublicCv): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    dateModified: cv.meta.publishedAt,
    mainEntity: {
      '@type': 'Person',
      name: cv.profile.fullName,
      jobTitle: cv.profile.role,
      description: cv.profile.intro,
      address: {
        '@type': 'PostalAddress',
        addressLocality: cv.profile.location,
        addressCountry: 'AT',
      },
      sameAs: cv.profile.contacts
        .map((contact) => contact.url)
        .filter((url): url is string => !!url && !url.startsWith('mailto:')),
      knowsLanguage: cv.languages.map((language) => language.name),
      alumniOf: cv.education
        .filter((entry) => entry.program)
        .map((entry) => ({ '@type': 'EducationalOrganization', name: entry.institution })),
    },
  };
}
