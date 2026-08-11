import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { StudioCv } from 'content-model';
import { CvEditor } from './cv-editor';

/** Studio API runs locally only, port pinned in backend launchSettings.json. */
export const API_BASE = 'http://localhost:5451';

@Component({
  selector: 'app-root',
  imports: [CvEditor],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly http = inject(HttpClient);

  protected readonly apiStatus = signal<'checking' | 'online' | 'offline'>('checking');
  protected readonly cv = signal<StudioCv | null>(null);
  protected readonly publishedFile = signal<string | null>(null);
  protected readonly saved = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.http.get<{ status: string }>(`${API_BASE}/health`).subscribe({
      next: () => {
        this.apiStatus.set('online');
        this.loadCv();
      },
      error: () => this.apiStatus.set('offline'),
    });
  }

  protected loadCv(): void {
    this.error.set(null);
    this.http.get<StudioCv>(`${API_BASE}/api/cv`).subscribe({
      next: (cv) => this.cv.set(cv),
      error: (err: unknown) => this.error.set(`Laden fehlgeschlagen: ${describeError(err)}`),
    });
  }

  protected saveCv(doc: StudioCv): void {
    this.error.set(null);
    this.saved.set(false);
    this.http.put<StudioCv>(`${API_BASE}/api/cv`, doc).subscribe({
      next: (cv) => {
        this.cv.set(cv);
        this.saved.set(true);
      },
      error: (err: unknown) => this.error.set(`Speichern fehlgeschlagen: ${describeError(err)}`),
    });
  }

  protected publish(): void {
    this.error.set(null);
    this.publishedFile.set(null);
    this.http.post<{ file: string }>(`${API_BASE}/api/publish`, {}).subscribe({
      next: (result) => this.publishedFile.set(result.file),
      error: (err: unknown) => this.error.set(`Publish fehlgeschlagen: ${describeError(err)}`),
    });
  }
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
