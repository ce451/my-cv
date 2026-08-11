import { TestBed } from '@angular/core/testing';
import { StudioCv } from 'content-model';
import { CvEditor } from './cv-editor';

function sampleCv(): StudioCv {
  return {
    profile: {
      fullName: 'Max Muster',
      role: 'Dev',
      intro: 'Intro',
      locationPublic: 'Weiz',
      addressFull: 'Geheimgasse 1',
      birthDate: '1990-01-02',
      contacts: [{ type: 'github', label: 'gh', value: 'max', url: null, visibility: 'Public' }],
    },
    experiences: [
      {
        start: '2020-01',
        end: '  ',
        position: 'Dev',
        positionNote: null,
        organization: 'ACME',
        organizationNote: null,
        summary: 'Summary',
        bullets: ['b1'],
        tech: ['C#'],
      },
    ],
    education: [],
    internships: [],
    skills: [],
    languages: [],
    personal: [],
  };
}

describe('CvEditor', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CvEditor] }).compileComponents();
  });

  it('renders profile fields from the input document', async () => {
    const fixture = TestBed.createComponent(CvEditor);
    fixture.componentRef.setInput('doc', sampleCv());
    fixture.detectChanges();
    await fixture.whenStable();

    const firstInput = (fixture.nativeElement as HTMLElement).querySelector('input');
    expect(firstInput?.value).toBe('Max Muster');
  });

  it('emits a normalized document on save (blank "Bis" becomes null)', () => {
    const fixture = TestBed.createComponent(CvEditor);
    fixture.componentRef.setInput('doc', sampleCv());
    fixture.detectChanges();

    let emitted: StudioCv | undefined;
    fixture.componentInstance.save.subscribe((cv) => (emitted = cv));

    const saveButton = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')]
      .find((b) => b.textContent?.includes('Speichern'));
    saveButton?.click();

    expect(emitted).toBeDefined();
    expect(emitted?.experiences[0].end).toBeNull();
  });
});
