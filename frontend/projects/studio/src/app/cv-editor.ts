import { Component, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CvEducation,
  CvExperience,
  CvInternship,
  LanguageSkill,
  SkillCategory,
  StudioContact,
  StudioCv,
  StudioPersonal,
} from 'content-model';

/**
 * Form editor for the full CV document. Works on a deep copy of the input;
 * list order in the UI is the sort order that gets persisted.
 */
@Component({
  selector: 'app-cv-editor',
  imports: [FormsModule],
  templateUrl: './cv-editor.html',
  styleUrl: './cv-editor.scss',
})
export class CvEditor {
  readonly doc = input.required<StudioCv>();
  readonly save = output<StudioCv>();

  protected readonly draft = signal<StudioCv | null>(null);

  constructor() {
    // Re-clone whenever fresh server state arrives (initial load and after save).
    effect(() => this.draft.set(structuredClone(this.doc())));
  }

  protected submit(): void {
    const draft = this.draft();
    if (draft) {
      this.save.emit(normalize(draft));
    }
  }

  // --- list helpers ---

  protected move<T>(list: T[], index: number, delta: number): void {
    const target = index + delta;
    if (target < 0 || target >= list.length) {
      return;
    }
    [list[index], list[target]] = [list[target], list[index]];
  }

  protected remove<T>(list: T[], index: number): void {
    list.splice(index, 1);
  }

  protected joinLines(items: string[]): string {
    return items.join('\n');
  }

  protected splitLines(value: string): string[] {
    return value.split('\n').map((v) => v.trim()).filter(Boolean);
  }

  protected joinComma(items: string[]): string {
    return items.join(', ');
  }

  protected splitComma(value: string): string[] {
    return value.split(',').map((v) => v.trim()).filter(Boolean);
  }

  // --- factories ---

  protected addContact(list: StudioContact[]): void {
    list.push({ type: 'email', label: null, value: '', url: null, visibility: 'Public' });
  }

  protected addExperience(list: CvExperience[]): void {
    list.push({
      start: '',
      end: null,
      position: '',
      positionNote: null,
      organization: '',
      organizationNote: null,
      summary: '',
      bullets: [],
      tech: [],
    });
  }

  protected addEducation(list: CvEducation[]): void {
    list.push({ start: '', end: null, institution: '', program: null, note: null });
  }

  protected addInternship(list: CvInternship[]): void {
    list.push({ years: '', organization: '', note: null });
  }

  protected addSkill(list: SkillCategory[]): void {
    list.push({ category: '', items: [] });
  }

  protected addLanguage(list: LanguageSkill[]): void {
    list.push({ name: '', level: '' });
  }

  protected addPersonal(list: StudioPersonal[]): void {
    list.push({ label: null, text: '', visibility: 'Public' });
  }
}

/** Empty optional strings become null — e.g. an empty "Bis" means ongoing. */
function normalize(cv: StudioCv): StudioCv {
  const opt = (value: string | null | undefined): string | null => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  };

  return {
    profile: {
      ...cv.profile,
      addressFull: opt(cv.profile.addressFull),
      birthDate: opt(cv.profile.birthDate),
      contacts: cv.profile.contacts.map((c) => ({ ...c, label: opt(c.label), url: opt(c.url) })),
    },
    experiences: cv.experiences.map((e) => ({
      ...e,
      end: opt(e.end),
      positionNote: opt(e.positionNote),
      organizationNote: opt(e.organizationNote),
    })),
    education: cv.education.map((e) => ({
      ...e,
      end: opt(e.end),
      program: opt(e.program),
      note: opt(e.note),
    })),
    internships: cv.internships.map((i) => ({ ...i, note: opt(i.note) })),
    skills: cv.skills.map((s) => ({ ...s, items: [...s.items] })),
    languages: cv.languages.map((l) => ({ ...l })),
    personal: cv.personal.map((p) => ({ ...p, label: opt(p.label) })),
  };
}
