import { PublicCv } from 'content-model';

interface Ym {
  year: number;
  month: number | null;
}

function parseYm(value: string): Ym {
  const [year, month] = value.split('-');
  return { year: Number(year), month: month ? Number(month) : null };
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** "2025-09" → "09/2025"; "2008" → "2008". */
export function formatYm(value: string): string {
  const { year, month } = parseYm(value);
  return month ? `${pad2(month)}/${year}` : String(year);
}

export function formatPeriod(start: string, end: string | null | undefined, presentLabel: string): string {
  return `${formatYm(start)} – ${end ? formatYm(end) : presentLabel}`;
}

function monthIndex(value: string, fallbackMonth: number): number {
  const { year, month } = parseYm(value);
  return year * 12 + (month ?? fallbackMonth) - 1;
}

/** Elapsed months; finished periods count the final month inclusively. */
export function durationMonths(start: string, end: string | null | undefined, now: Date): number {
  const startIndex = monthIndex(start, 1);
  const endIndex = end == null ? now.getFullYear() * 12 + now.getMonth() : monthIndex(end, 12) + 1;
  return Math.max(1, endIndex - startIndex);
}

export function formatDuration(months: number): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts: string[] = [];
  if (years > 0) {
    parts.push(years === 1 ? '1 Jahr' : `${years} Jahre`);
  }
  if (rest > 0) {
    parts.push(rest === 1 ? '1 Monat' : `${rest} Monate`);
  }
  return parts.length ? parts.join(' ') : '1 Monat';
}

export interface CvStats {
  careerYears: number;
  /** Distinct entries of the skill list (workstyle excluded) — matches what the skills section shows. */
  technologies: number;
  languagesShort: string;
}

export function computeStats(cv: PublicCv, now: Date): CvStats {
  const nowIndex = now.getFullYear() * 12 + now.getMonth();
  const earliestStart = Math.min(...cv.experiences.map((e) => monthIndex(e.start, 1)));
  return {
    careerYears: Math.floor((nowIndex - earliestStart) / 12),
    technologies: new Set(
      cv.skills.filter((s) => s.category !== 'Arbeitsweise').flatMap((s) => s.items),
    ).size,
    languagesShort: cv.languages.map((l) => l.name.slice(0, 2).toUpperCase()).join(' · '),
  };
}

/** German decimal formatting for stat numbers. */
export function formatNumber(value: number, decimals: number): string {
  return value.toFixed(decimals).replace('.', ',');
}

/** First sentence for the hero, the rest for the intro section. */
export function splitIntro(intro: string): { lead: string; rest: string } {
  const cut = intro.indexOf('. ');
  if (cut === -1) {
    return { lead: intro, rest: '' };
  }
  return { lead: intro.slice(0, cut + 1), rest: intro.slice(cut + 2) };
}
