/**
 * Shared content types.
 *
 * `StudioCv` mirrors the editable document of the Studio API (includes
 * application-only data and is never published). `PublicCv` mirrors the
 * published file `content/cv.<locale>.json` consumed by the site build.
 */

export type Visibility = 'Public' | 'ApplicationOnly';

// --- Shapes shared by both views ---

export interface CvExperience {
  start: string;
  end?: string | null;
  position: string;
  positionNote?: string | null;
  organization: string;
  organizationNote?: string | null;
  summary: string;
  bullets: string[];
  tech: string[];
}

export interface CvEducation {
  start: string;
  end?: string | null;
  institution: string;
  program?: string | null;
  note?: string | null;
}

export interface CvInternship {
  years: string;
  organization: string;
  note?: string | null;
}

export interface SkillCategory {
  category: string;
  items: string[];
}

export interface LanguageSkill {
  name: string;
  level: string;
}

// --- Editable studio document ---

export interface StudioContact {
  type: string;
  label?: string | null;
  value: string;
  url?: string | null;
  visibility: Visibility;
}

export interface StudioProfile {
  fullName: string;
  role: string;
  intro: string;
  locationPublic: string;
  addressFull?: string | null;
  birthDate?: string | null;
  contacts: StudioContact[];
}

export interface StudioPersonal {
  label?: string | null;
  text: string;
  visibility: Visibility;
}

export interface StudioCv {
  profile: StudioProfile;
  experiences: CvExperience[];
  education: CvEducation[];
  internships: CvInternship[];
  skills: SkillCategory[];
  languages: LanguageSkill[];
  personal: StudioPersonal[];
}

// --- Published public view ---

export interface PublicMeta {
  publishedAt: string;
  locale: string;
}

export interface PublicContact {
  type: string;
  label?: string | null;
  value: string;
  url?: string | null;
}

export interface PublicProfile {
  fullName: string;
  role: string;
  intro: string;
  location: string;
  contacts: PublicContact[];
}

export interface PublicProject {
  title?: string | null;
  text: string;
}

export interface PublicCv {
  meta: PublicMeta;
  profile: PublicProfile;
  experiences: CvExperience[];
  education: CvEducation[];
  internships: CvInternship[];
  skills: SkillCategory[];
  languages: LanguageSkill[];
  projects: PublicProject[];
}
