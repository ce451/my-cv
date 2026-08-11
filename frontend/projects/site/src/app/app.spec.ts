import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';
import { CV } from './content/cv-data';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes)],
    }).compileComponents();
  });

  it('creates the shell with navigation and footer links', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('nav.top')).toBeTruthy();
    expect(compiled.querySelectorAll('footer nav a').length).toBe(3);
  });

  it('injects schema.org JSON-LD into the document head', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const script = document.getElementById('cv-jsonld');
    expect(script).toBeTruthy();
    const parsed = JSON.parse(script!.textContent ?? '{}');
    expect(parsed['@type']).toBe('ProfilePage');
    expect(parsed.mainEntity.name).toBe(CV.profile.fullName);
  });
});
