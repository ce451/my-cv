import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { CV } from './content/cv-data';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  async function render(): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders name and role from the published content', async () => {
    const compiled = await render();
    const text = compiled.textContent ?? '';
    expect(text).toContain(CV.profile.fullName);
    expect(text).toContain(CV.profile.role);
  });

  it('renders one station per published experience', async () => {
    const compiled = await render();
    expect(compiled.querySelectorAll('.station').length).toBe(CV.experiences.length);
  });

  it('renders all skill categories', async () => {
    const compiled = await render();
    expect(compiled.querySelectorAll('.skills .row').length).toBe(CV.skills.length);
  });

  it('contains no application-only data', async () => {
    const compiled = await render();
    const text = compiled.textContent ?? '';
    expect(text).not.toContain('[entfernt]');
    expect(text).not.toContain('gmail');
    expect(text).not.toContain('Verheiratet');
  });
});
