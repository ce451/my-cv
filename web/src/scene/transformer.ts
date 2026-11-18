import data from './transformer-parts.json';
import { DESKTOP_H, DESKTOP_W } from './terminal';

/**
 * Patent drawing of a Siemens Energy power transformer (US 12,230,429 B2, FIG 1,
 * inventor from Weiz), split into parts by drawing/transformer.py and shown in
 * a neutral CAD window (no particular desktop: at work this runs on Windows,
 * not on the Linux of the terminal scene). Once started it comes apart on its
 * own, from the top down: terminals, bushings and their sockets, lid,
 * conservator and device box, then coolers, fans, pipes and control unit.
 * Drawing coordinates are those of the half-size drawing.
 */
type Part =
  | 't16' | 't17' | 't18' | 'b16' | 'b17' | 'b18' | 's16' | 's17' | 's18'
  | 'cons' | 'box' | 'lid' | 'tank' | 'coolL' | 'fanL' | 'pipe' | 'coolR' | 'fanR' | 'ctl';

/** back to front, so the opaque silhouettes hide what is behind */
const ORDER: Part[] = [
  'cons', 'box', 'coolL', 'fanL', 'pipe', 'tank', 'lid',
  's16', 'b16', 't16', 's17', 'b17', 't17', 's18', 'b18', 't18',
  'coolR', 'fanR', 'ctl',
];

/** final offset and the slice of the explosion progress the part moves in: from the top down, then outwards */
const MOVE: Record<Part, { d: [number, number]; from: number; to: number }> = {
  t16: { d: [0, -300], from: 0, to: 0.45 },
  t17: { d: [0, -340], from: 0.04, to: 0.49 },
  t18: { d: [0, -340], from: 0.08, to: 0.53 },
  b16: { d: [0, -220], from: 0.06, to: 0.55 },
  b17: { d: [0, -250], from: 0.1, to: 0.6 },
  b18: { d: [0, -250], from: 0.14, to: 0.64 },
  s16: { d: [0, -140], from: 0.16, to: 0.62 },
  s17: { d: [0, -160], from: 0.2, to: 0.66 },
  s18: { d: [0, -160], from: 0.24, to: 0.7 },
  lid: { d: [0, -70], from: 0.3, to: 0.78 },
  cons: { d: [150, -230], from: 0.32, to: 0.82 },
  box: { d: [330, -120], from: 0.38, to: 0.88 },
  coolL: { d: [-340, -90], from: 0.42, to: 0.95 },
  coolR: { d: [340, 90], from: 0.45, to: 0.98 },
  pipe: { d: [-160, 90], from: 0.48, to: 0.95 },
  fanL: { d: [-480, -128], from: 0.5, to: 1 },
  fanR: { d: [480, 128], from: 0.52, to: 1 },
  ctl: { d: [370, 100], from: 0.55, to: 1 },
  tank: { d: [0, 0], from: 0, to: 1 },
};

/** parts list as structured by Christopher; the parts that move with each row, sub-items one level in */
const BOM: { pos: string; name: string; qty: number; parts: Part[]; sub?: boolean }[] = [
  { pos: '1', name: 'Kessel', qty: 1, parts: [] },
  { pos: '2', name: 'Deckel', qty: 1, parts: ['lid'] },
  { pos: '3', name: 'Kühlblock', qty: 2, parts: ['coolL', 'coolR', 'fanL', 'fanR', 'pipe'] },
  { pos: '4', name: 'Dom', qty: 3, parts: ['s16', 's17', 's18'] },
  { pos: '5', name: 'Durchführung', qty: 1, parts: ['b16', 't16'] },
  { pos: '6', name: 'Durchführung', qty: 1, parts: ['b17', 't17'] },
  { pos: '7', name: 'Durchführung', qty: 1, parts: ['b18', 't18'] },
  { pos: '8', name: 'Dehngefäß', qty: 1, parts: ['cons'] },
  { pos: '8.1', name: 'Rohrleitung', qty: 1, parts: ['cons'], sub: true },
  { pos: '8.2', name: 'Flansch', qty: 2, parts: ['cons'], sub: true },
  { pos: '8.3', name: 'Rohrbogen', qty: 1, parts: ['cons'], sub: true },
  { pos: '8.4', name: 'Dichtung', qty: 2, parts: ['cons'], sub: true },
  { pos: '8.5', name: 'Schraubverbindung', qty: 8, parts: ['cons'], sub: true },
];
/** rows the panel holds; the rest stay as empty lines of the table */
const BOM_ROWS = 18;

const MENU = ['Datei', 'Bearbeiten', 'Ansicht', 'Einfügen', 'Baugruppe', 'Extras', 'Hilfe'];

const svgIcon = (d: string) =>
  `<svg viewBox="0 0 16 16"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/></svg>`;
const TOOLS = [
  'M4 1.5h5l3 3v10H4z M9 1.5v3h3', // new
  'M1.5 4.5h4l1.5 1.5h7.5v8h-13z', // open
  'M2.5 2.5h9l2 2v9h-11z M5 2.5v3.5h5V2.5 M5 13.5v-4h6v4', // save
  '',
  'M4 2l8 6-3.6.6 2.1 4.3-1.5.7-2.1-4.3L4 12z', // select
  'M2.5 13.5l11-11', // line
  'M8 2.5a5.5 5.5 0 1 0 0.01 0z', // circle
  'M2 5v8 M14 5v8 M2 9h12 M2 9l2-1.3M2 9l2 1.3M14 9l-2-1.3M14 9l-2 1.3', // dimension
  '',
  'M5.5 6.5h5v5h-5z M8 1v3.5 M6.5 2.5L8 1l1.5 1.5 M1 9h3 M2.5 7.5L1 9l1.5 1.5 M15 9h-3 M13.5 7.5L15 9l-1.5 1.5', // explode
  'M2 2h4M2 2v4M14 2h-4M14 2v4M2 14h4M2 14v-4M14 14h-4M14 14v-4', // fit
];
const EXPLODE_TOOL = 9; // index in TOOLS
const BUTTONS = ['M3 8h10', 'M3.5 3.5h9v9h-9z', 'M3.5 3.5l9 9M12.5 3.5l-9 9'].map(svgIcon).join('');

/** exploded extent with some air around it */
const VIEW = { x: -523, y: -230, w: 2066, h: 1360 };
/** centres of the assembled and the exploded drawing; the view follows from one to the other */
const ASSEMBLED = { x: 510, y: 581, scale: 1.29 };
const EXPLODED = { x: 510, y: 435 };

const parts = data.parts as Record<Part, [number, number, number, number]>;
const smooth = (t: number) => t * t * (3 - 2 * t);
/** slow constant drift added to the burst, so the parts never come to a stop */
const DRIFT = 0.3;
/** offset in units of the part's move: fast burst (ease out), plus the drift; 1 at the end of its slice */
const travelled = (t: number) => (t <= 0 ? 0 : (1 - (1 - Math.min(t, 1)) ** 2 + DRIFT * t) / (1 + DRIFT));

/** p: 0 assembled, 1 exploded; beyond 1 the parts drift on and the view keeps backing off */
export function buildTransformer(host: HTMLElement): (p: number) => void {
  host.innerHTML =
    `<div class="cad" style="width:${DESKTOP_W}px;height:${DESKTOP_H}px">` +
    `<div class="cad__bar"><span class="cad__icon">${svgIcon('M2 13.5L8 2.5l6 11z M5 8h6')}</span>` +
    `<span>Leistungstransformator – Zeichnung</span><span class="cad__btns">${BUTTONS}</span></div>` +
    `<div class="cad__menu">${MENU.map((m) => `<span>${m}</span>`).join('')}</div>` +
    `<div class="cad__tools">${TOOLS.map((d, i) => (d ? `<i${i === EXPLODE_TOOL ? ' data-explode' : ''}>${svgIcon(d)}</i>` : '<b></b>')).join('')}</div>` +
    `<div class="cad__body"><div class="cad__bom"><p>Stückliste</p><table>` +
    `<tr><th>Pos.</th><th>Benennung</th><th>Menge</th></tr>` +
    BOM.map((r) => `<tr${r.sub ? ' class="is-sub"' : ''}><td>${r.pos}</td><td>${r.name}</td><td>${r.qty}</td></tr>`).join('') +
    '<tr><td></td><td></td><td></td></tr>'.repeat(Math.max(0, BOM_ROWS - BOM.length)) +
    `</table></div><div class="cad__canvas"><div class="cad__sheet"></div></div></div>` +
    `<div class="cad__status"><span>Vorlage US 12,230,429 B2, Fig. 1 · ${BOM.length} Positionen</span><span class="cad__state"></span></div>` +
    `</div>`;

  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'tx');
  svg.setAttribute('viewBox', `${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Patentzeichnung eines Leistungstransformators von Siemens Energy');
  const all = document.createElementNS(ns, 'g');
  svg.appendChild(all);
  const els = ORDER.map((name) => {
    const [x, y, w, h] = parts[name];
    const img = document.createElementNS(ns, 'image');
    img.setAttribute('href', `/scene/transformer/${name}.webp`);
    for (const [k, v] of Object.entries({ x, y, width: w, height: h })) img.setAttribute(k, String(v));
    all.appendChild(img);
    return { name, img, ...MOVE[name] };
  });
  host.querySelector('.cad__canvas')!.appendChild(svg);
  const rows = Array.from(host.querySelectorAll<HTMLElement>('.cad__bom tr')).slice(1);
  const explodeTool = host.querySelector<HTMLElement>('[data-explode]')!;
  const state = host.querySelector<HTMLElement>('.cad__state')!;

  // assembled it fills the sheet; the view backs off while it comes apart
  const vx = VIEW.x + VIEW.w / 2;
  const vy = VIEW.y + VIEW.h / 2;
  let last = -1;
  return (p: number) => {
    if (Math.abs(p - last) < 1e-4) return;
    last = p;
    const e = smooth(Math.min(p, 1));
    const s = (ASSEMBLED.scale + (1 - ASSEMBLED.scale) * e) / (1 + 0.12 * Math.max(0, p - 1));
    const cx = ASSEMBLED.x + (EXPLODED.x - ASSEMBLED.x) * e;
    const cy = ASSEMBLED.y + (EXPLODED.y - ASSEMBLED.y) * e;
    all.setAttribute('transform', `translate(${vx} ${vy}) scale(${s.toFixed(4)}) translate(${-cx.toFixed(1)} ${-cy.toFixed(1)})`);
    const moving = new Set<Part>();
    for (const el of els) {
      const raw = (p - el.from) / (el.to - el.from);
      const t = travelled(raw);
      el.img.setAttribute('transform', `translate(${(el.d[0] * t).toFixed(2)} ${(el.d[1] * t).toFixed(2)})`);
      if (raw > 0 && raw < 1) moving.add(el.name);
    }
    // the rows of the parts on the move light up in the parts list
    BOM.forEach((r, i) => rows[i].classList.toggle('is-sel', r.parts.some((q) => moving.has(q))));
    explodeTool.classList.toggle('is-on', p > 0.001);
    state.textContent = p > 0.001 ? `Explosionsansicht ${Math.round(Math.min(p, 1) * 100)} %` : 'Zusammenbau';
  };
}
