import data from './terminal-frames.json';

/**
 * The CV in micro on a phone held upright. Scrolling the CV moves the camera into
 * the laptop's display (the dive frames, stage.ts); meanwhile Konsole leaves its
 * maximised state and becomes a window exactly as tall and wide as the part of the
 * display the phone shows at the end of the dive, so micro ends up filling the
 * phone. In the narrower window micro wraps the CV again (the recording,
 * terminal-frames.json, is wrapped at 100 columns), by words as its softwrap does,
 * at a size that reads like 13 px on the phone.
 *
 * The window is DOM on the display (screen px), mapped with the display like the
 * rest of its content. Laying it out again on every frame of the way (window and text
 * sizes, micro wrapping anew) costs a phone frames (measured, Android/Chrome); the look
 * was preferred, so the way out is short (stage.ts). /?cvstatic (dev): the window stays
 * at its place and the camera brings it to the phone's size, without those stalls.
 */

type Style = [string, string, number];
type Line = [string, number][];
interface TermData {
  styles: Style[];
  lines: Line[];
  frames: { rows: number[]; title: string; mark?: string }[];
  doc: { styles: Style[]; lines: Line[]; rows: number[] };
}
const term = data as unknown as TermData;

/** width of micro's line number gutter in the recording (" 1 ", "10 ", "   " on a wrapped row) */
const GUTTER = 3;
/** on the phone at the end of the dive (CSS px) */
const FONT_PX = 13;
const ROW_PX = 18;
const BAR_PX = 30;
/** Hack's advance in em */
const ADVANCE = 0.602;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** colour and weight of a style; the backgrounds stay micro's (the current line is not highlighted here) */
function css([fg, , flags]: Style): string {
  return [fg && `color:#${fg}`, flags & 1 && 'font-weight:700', flags & 2 && 'font-style:italic', flags & 4 && 'text-decoration:underline']
    .filter(Boolean)
    .join(';');
}

/** one character with its style */
type Cell = [string, number];

/** the CV's logical lines (number, cells) from the recorded rows */
function logical(): { n: string; cells: Cell[] }[] {
  const out: { n: string; cells: Cell[] }[] = [];
  for (const r of term.doc.rows) {
    const cells: Cell[] = [];
    for (const [text, s] of term.doc.lines[r]) for (const ch of text) cells.push([ch, s]);
    const gutter = cells.slice(0, GUTTER).map((c) => c[0]).join('');
    const body = cells.slice(GUTTER);
    while (body.length && body[body.length - 1][0] === ' ') body.pop();
    if (gutter.trim() || !out.length) out.push({ n: gutter.trim(), cells: body });
    else {
      // a wrapped row: micro broke the line at a space
      const prev = out[out.length - 1].cells;
      if (prev.length && body.length) prev.push([' ', body[0][1]]);
      prev.push(...body);
    }
  }
  return out;
}
const LINES = logical();

/** the line wrapped by words to rows of width cols */
function wrap(cells: Cell[], cols: number): Cell[][] {
  if (!cells.length) return [[]];
  const rows: Cell[][] = [];
  let i = 0;
  while (i < cells.length) {
    let end = Math.min(cells.length, i + cols);
    if (end < cells.length) {
      let sp = end;
      while (sp > i && cells[sp][0] !== ' ') sp--;
      if (sp > i) end = sp;
    }
    rows.push(cells.slice(i, end));
    i = end;
    while (i < cells.length && cells[i][0] === ' ') i++;
  }
  return rows;
}

function rowHtml(cells: Cell[], styles: Style[]): string {
  let html = '';
  let k = 0;
  while (k < cells.length) {
    const s = cells[k][1];
    let text = '';
    while (k < cells.length && cells[k][1] === s) text += cells[k++][0];
    const c = css(styles[s]);
    html += c ? `<span style="${c}">${esc(text)}</span>` : esc(text);
  }
  return html;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CvWindow {
  /** the window at the end of the dive (screen px), the screen px per phone px there and Konsole's scale (screen px per kde px) */
  layout(rect: Rect, k: number, kde: number, vw: number, vh: number): void;
  /**
   * doc 0..1: how far the CV has scrolled; open 0..1: maximised Konsole -> the window;
   * screen: the display's corners in the current frame (viewport px)
   */
  update(doc: number, open: number, screen: [number, number][] | null): void;
  /** scrolling distance through the whole CV on the phone (px), so it follows the finger */
  travel(): number;
}

/** dev: the window at its place from the start, not laid out on the way */
const REWRAP = !(import.meta.env.DEV && new URLSearchParams(location.search).has('cvstatic'));
/** share of the way over which the maximised Konsole fades into the window */
const FADE = REWRAP ? 0.12 : 0.16;

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const span = (t: number, a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));
/** Konsole's font in kde px (styles.css, .term__grid) */
const KDE_FONT = 13.333;

/**
 * host: the terminal slide; maximised: Konsole's maximised window in it (terminal.ts).
 * The window starts as large as the maximised one with its font and keeps to the part
 * of the display the camera shows, a little smaller on the way (so it reads as a
 * window), until it fills the phone; its text grows with the camera until it is 13
 * phone px and stays so. micro wraps the CV again at every width on the way, as in a
 * window being resized. (/?cvstatic: the maximised Konsole fades into the window at its
 * end place, the part of the display the phone shows at the end of the dive.)
 */
export function buildCvWindow(host: HTMLElement, maximised: HTMLElement): CvWindow {
  const desk = host.appendChild(document.createElement('div'));
  desk.className = 'cvwin-desk';
  const el = host.appendChild(document.createElement('div'));
  el.className = 'cvwin';
  const open = term.frames.find((f) => f.mark === 'cv-open')!;
  el.innerHTML =
    `<div class="cvwin__bar"><span>${esc(open.title)} – Konsole</span></div>` +
    `<div class="cvwin__text"></div><div class="cvwin__status"></div>`;
  const textEl = el.querySelector<HTMLElement>('.cvwin__text')!;
  const status = el.querySelector<HTMLElement>('.cvwin__status')!;
  // micro's status line (dark on light, as micro draws it): the file's info on the left,
  // the key hints on the right where the window is wide enough for both
  const statusText = term.lines[open.rows[open.rows.length - 2]].map(([t]) => t).join('');
  const [statusLeft, statusRight = ''] = statusText.trim().split(/\s{2,}/);
  status.innerHTML = `<span class="cvwin__status-l">${esc(statusLeft)}</span><span class="cvwin__status-r">${esc(statusRight)}</span>`;
  const statusR = status.querySelector<HTMLElement>('.cvwin__status-r')!;
  const numW = String(LINES.length).length;

  /** the CV wrapped to cols columns, as rows of html */
  const wrapped = new Map<number, string[]>();
  function rowsFor(cols: number): string[] {
    let rows = wrapped.get(cols);
    if (rows) return rows;
    rows = [];
    for (const { n, cells } of LINES) {
      for (const [i, r] of wrap(cells, cols - numW - 1).entries()) {
        rows.push(`<span class="cvwin__n">${(i ? '' : n).padStart(numW)} </span>` + rowHtml(r, term.doc.styles));
      }
    }
    wrapped.set(cols, rows);
    return rows;
  }
  const colsOf = (w: number, u: number) => Math.max(24, Math.floor((w / u - 12) / (FONT_PX * ADVANCE)));
  // rows that fit below the title bar and above the status line (its margin 6, the text's padding 2 x 4)
  const visibleOf = (h: number, u: number) => Math.max(1, Math.floor((h / u - BAR_PX - ROW_PX - 14) / ROW_PX));

  let rowEls: HTMLElement[] = [];
  let target: Rect = { x: 0, y: 0, w: 1, h: 1 };
  let full: Rect = { x: 0, y: 0, w: 1, h: 1 };
  let kEnd = 1;
  let uStart = 1;
  let shown = '';
  let vw = 1;
  let vh = 1;

  function layout(rect: Rect, k: number, kde: number, viewW: number, viewH: number) {
    target = rect;
    kEnd = k;
    vw = viewW;
    vh = viewH;
    uStart = (kde * KDE_FONT) / FONT_PX;
    full = { x: 0, y: 0, w: host.clientWidth || rect.w, h: host.clientHeight || rect.h };
    shown = '';
    placed = '';
  }

  function update(doc: number, openness: number, screen: [number, number][] | null) {
    // Konsole leaves its maximised state: the window fades in over it, shrinks to its place
    // and its text to the phone's size
    const on = openness > 0;
    el.style.visibility = desk.style.visibility = on ? 'visible' : 'hidden';
    maximised.style.opacity = on ? (1 - ease(span(openness, 0, FADE))).toFixed(4) : '';
    if (!on) return;
    const fade = ease(span(openness, 0, FADE)).toFixed(4);
    desk.style.opacity = fade;
    if (!REWRAP) {
      // first the desktop under the maximised Konsole, then the window on it (not both over each other)
      el.style.opacity = ease(span(openness, FADE * 0.6, FADE * 1.6)).toFixed(4);
      show(target, kEnd, doc);
      return;
    }
    el.style.opacity = fade;
    // the part of the display in view (screen px) and the screen px per phone px there
    let kNow = kEnd;
    let vis = target;
    if (screen) {
      const [a, b, c, d] = screen;
      const left = (a[0] + d[0]) / 2;
      const top = (a[1] + b[1]) / 2;
      kNow = full.w / Math.max(1, (b[0] + c[0]) / 2 - left);
      const kY = full.h / Math.max(1, (c[1] + d[1]) / 2 - top);
      const x0 = Math.min(full.w, Math.max(0, -left * kNow));
      const x1 = Math.min(full.w, Math.max(0, (vw - left) * kNow));
      const y0 = Math.min(full.h, Math.max(0, -top * kY));
      const y1 = Math.min(full.h, Math.max(0, (vh - top) * kY));
      vis = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    }
    // un-maximised: smaller than what is in view on the way, filling it at both ends
    const inset = 1 - 0.12 * Math.sin(Math.PI * Math.min(1, openness));
    const w = Math.min(full.w, Math.max(target.w, vis.w * inset));
    const h = Math.min(full.h, Math.max(target.h * inset, vis.h * inset));
    const r = {
      x: Math.min(full.w - w, Math.max(0, vis.x + (vis.w - w) / 2)),
      y: Math.min(full.h - h, Math.max(0, vis.y + (vis.h - h) / 2)),
      w,
      h,
    };
    // the text as in the maximised window until the camera makes it 13 phone px
    show(r, Math.min(uStart, kNow), doc);
  }

  /** the window at r (screen px) with u screen px per phone px for its text, the CV scrolled to doc */
  let placed = '';
  function show(r: Rect, u: number, doc: number) {
    const box = `${r.x} ${r.y} ${r.w} ${r.h} ${u}`;
    if (box !== placed) {
      placed = box;
      Object.assign(el.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` });
      el.style.setProperty('--k', u.toFixed(5));
    }
    const cols = colsOf(r.w, u);
    const visible = visibleOf(r.h, u);
    const rows = rowsFor(cols);
    const o = Math.round(Math.min(1, Math.max(0, doc)) * Math.max(0, rows.length - visible));
    const key = `${cols} ${visible} ${o}`;
    if (key === shown) return;
    if (rowEls.length !== visible) {
      textEl.replaceChildren();
      rowEls = Array.from({ length: visible }, () => textEl.appendChild(document.createElement('div')));
    }
    if (!shown.startsWith(`${cols} `)) statusR.hidden = statusLeft.length + statusRight.length + 2 > cols;
    shown = key;
    rowEls.forEach((e, i) => (e.innerHTML = rows[o + i] ?? ''));
  }

  // the scrolling at the end of the dive, where the window has its place
  const travel = () => Math.max(0, rowsFor(colsOf(target.w, kEnd)).length - visibleOf(target.h, kEnd)) * ROW_PX;
  return { layout, update, travel };
}
