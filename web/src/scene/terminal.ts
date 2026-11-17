import data from './terminal-frames.json';

/** [fg hex, bg hex, flags: 1 bold, 2 italic, 4 underline]; empty colour = terminal default */
type Style = [string, string, number];
type Line = [string, number][];

interface TermData {
  cols: number;
  rows: number;
  styles: Style[];
  lines: Line[];
  frames: { rows: number[]; cur: [number, number] | null; title: string; mark?: string }[];
  doc: { styles: Style[]; lines: Line[]; rows: number[] };
}

const term = data as unknown as TermData;

/** Virtual desktop the Konsole window is laid out in; scaled to the screen element. */
export const DESKTOP_W = 822;
export const DESKTOP_H = DESKTOP_W / 1.6;
const MICRO_TEXT_ROWS = term.rows - 2; // status line and message line below

const MENU = ['Datei', 'Bearbeiten', 'Ansicht', 'Lesezeichen', 'Module', 'Einstellungen', 'Hilfe'];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function lineHtml(styles: Style[], line: Line): string {
  return line
    .map(([text, s]) => {
      const [fg, bg, flags] = styles[s];
      const css = [
        fg && `color:#${fg}`,
        bg && `background:#${bg}`,
        flags & 1 && 'font-weight:700',
        flags & 2 && 'font-style:italic',
        flags & 4 && 'text-decoration:underline',
      ].filter(Boolean);
      return css.length ? `<span style="${css.join(';')}">${esc(text)}</span>` : esc(text);
    })
    .join('');
}

/** Hold after a marked frame before the next keystroke, in ms: time to read the result. */
const PAUSE: Record<string, number> = {
  home: 350,
  'cd-beruf': 350,
};

/** Milliseconds before frame i appears: fast typing with some unevenness, pauses before results. */
function delay(i: number): number {
  const f = term.frames[i];
  if (f.mark === 'cd-beruf') return 170;
  if (f.mark === 'cv-open') return 260;
  return 22 + ((i * 37) % 31);
}

const icon = {
  konsole:
    '<svg viewBox="0 0 16 16"><rect x="1" y="2" width="14" height="12" rx="1.5" fill="#31363b" stroke="#7f8c8d" stroke-width=".8"/><path d="M4 6l2.2 2L4 10" stroke="#fcfcfc" stroke-width="1.2" fill="none"/><path d="M7.5 10.5h4" stroke="#fcfcfc" stroke-width="1.2"/></svg>',
  min: '<svg viewBox="0 0 18 18"><path d="M5 7.5l4 4 4-4" stroke="currentColor" stroke-width="1.3" fill="none"/></svg>',
  max: '<svg viewBox="0 0 18 18"><path d="M9 4.5L13.5 9 9 13.5 4.5 9z" stroke="currentColor" stroke-width="1.3" fill="none"/></svg>',
  close: '<svg viewBox="0 0 18 18"><path d="M5 5l8 8M13 5l-8 8" stroke="currentColor" stroke-width="1.3"/></svg>',
};

export interface Terminal {
  /** ms: time since the session started playing, doc: 0..1 scrolling through the CV in micro, quit: micro closed again */
  update(ms: number, doc: number, quit?: boolean): void;
  /** ms after the start at which the frame with this mark appears */
  timeOf(mark: string): number;
}

export function buildTerminal(host: HTMLElement): Terminal {
  host.innerHTML =
    `<div class="kde" style="width:${DESKTOP_W}px;height:${DESKTOP_H}px">` +
    `<div class="kde__bar"><span class="kde__icon">${icon.konsole}</span><span class="kde__caption"></span>` +
    `<span class="kde__btns">${icon.min}${icon.max}${icon.close}</span></div>` +
    `<div class="kde__menu">${MENU.map((m) => `<span>${m}</span>`).join('')}</div>` +
    `<div class="kde__term"><div class="term__grid"></div><i class="term__cursor"></i><i class="term__sb"></i></div>` +
    `</div>`;
  const grid = host.querySelector<HTMLElement>('.term__grid')!;
  const cursor = host.querySelector<HTMLElement>('.term__cursor')!;
  const caption = host.querySelector<HTMLElement>('.kde__caption')!;
  const rowEls = Array.from({ length: term.rows }, () => grid.appendChild(document.createElement('div')));
  const html = term.lines.map((l) => lineHtml(term.styles, l));
  const docHtml = term.doc.lines.map((l) => lineHtml(term.doc.styles, l));

  const cvOpen = term.frames.findIndex((f) => f.mark === 'cv-open');
  const cvClose = term.frames.findIndex((f) => f.mark === 'cv-close');
  const docTravel = Math.max(0, term.doc.rows.length - MICRO_TEXT_ROWS);
  // the session plays in real time once started: times[i] is when frame i appears
  const times = [0];
  for (let i = 1; i <= cvOpen; i++) times.push(times[i - 1] + (PAUSE[term.frames[i - 1].mark ?? ''] ?? 0) + delay(i));

  const shown: string[] = [];
  let current = 0;
  let offset = 0;
  // the cursor blinks while idle; every keystroke restarts the blink with the cursor on
  let blinkPhase = false;

  function render() {
    const f = term.frames[current];
    for (let r = 0; r < term.rows; r++) {
      const h = offset && r < MICRO_TEXT_ROWS ? docHtml[term.doc.rows[r + offset]] ?? '' : html[f.rows[r]];
      if (shown[r] !== h) {
        rowEls[r].innerHTML = h;
        shown[r] = h;
      }
    }
    const cur = offset ? null : f.cur;
    cursor.hidden = !cur;
    if (cur) {
      cursor.style.transform = `translate(${cur[0]}ch, ${cur[1] * 100}%)`;
      blinkPhase = !blinkPhase;
      cursor.classList.toggle('is-b', blinkPhase);
    }
    caption.textContent = `${f.title} – Konsole`;
  }

  function update(ms: number, doc: number, quit = false) {
    let i = 0;
    if (quit) i = cvClose;
    else if (doc > 0 || ms >= times[cvOpen]) i = cvOpen;
    else {
      let hi = cvOpen;
      while (i < hi) {
        const mid = (i + hi + 1) >> 1;
        if (times[mid] <= ms) i = mid;
        else hi = mid - 1;
      }
    }
    const o = doc > 0 && !quit ? Math.round(doc * docTravel) : 0;
    if (i !== current || o !== offset) {
      current = i;
      offset = o;
      render();
    }
  }

  render();
  return {
    update,
    timeOf: (mark) => times[term.frames.findIndex((f) => f.mark === mark)],
  };
}
