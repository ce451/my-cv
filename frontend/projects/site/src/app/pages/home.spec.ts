import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CV } from '../content/cv-data';
import { Home } from './home';

describe('Home', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  async function render(): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders name, role and tagline from the published content', async () => {
    const compiled = await render();
    const text = compiled.textContent ?? '';
    expect(text).toContain(CV.profile.fullName);
    expect(text).toContain(CV.profile.role);
    expect(text).toContain(CV.profile.tagline ?? '');
    for (const highlight of CV.profile.highlights) {
      expect(text).toContain(highlight);
    }
  });

  it('renders one station per published experience', async () => {
    const compiled = await render();
    expect(compiled.querySelectorAll('.station').length).toBe(CV.experiences.length);
  });

  it('renders all skill categories', async () => {
    const compiled = await render();
    expect(compiled.querySelectorAll('.skills .row').length).toBe(CV.skills.length);
  });

  it('links every published project repository', async () => {
    const compiled = await render();
    const hrefs = [...compiled.querySelectorAll('.projects .repos a')].map((a) =>
      a.getAttribute('href'),
    );
    expect(hrefs).toEqual(CV.projects.flatMap((p) => p.links));
  });

  it('sets canonical, Open Graph tags and Person JSON-LD in the head', async () => {
    await render();
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    expect(canonical?.href).toBe('https://elstner.ch/');
    const ogImage = document.querySelector('meta[property="og:image"]');
    expect(ogImage?.getAttribute('content')).toBe('https://elstner.ch/og-image.png');
    const parsed = JSON.parse(document.getElementById('cv-jsonld')?.textContent ?? '{}');
    expect(parsed['@type']).toBe('ProfilePage');
    expect(parsed.mainEntity.name).toBe(CV.profile.fullName);
    expect(parsed.mainEntity.knowsAbout).toContain('Angular');
  });

  // Defense in depth: the structural guarantee lives in the backend publish
  // pipeline (PublishMapperTests). Probes here are generic terms on purpose —
  // real application-only values must never appear in this public repo, not
  // even inside a negative assertion.
  it('contains no application-only data', async () => {
    const compiled = await render();
    const text = compiled.textContent ?? '';
    expect(text).not.toContain('gasse');
    expect(text).not.toContain('gmail');
    expect(text).not.toContain('Verheiratet');
  });
});
