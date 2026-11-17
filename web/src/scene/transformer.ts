import data from './transformer-parts.json';
import { DESKTOP_H, DESKTOP_W } from './terminal';

/**
 * Patent drawing of a Siemens Energy power transformer (US 12,230,429 B2, FIG 1,
 * inventor from Weiz), split into parts by drawing/transformer.py and shown in
 * a neutral CAD window (no particular desktop: at work this runs on Windows,
 * not on the Linux of the terminal scene). Once started it comes apart on its
 * own: bushings up, conservator up and back, coolers out along the tank.
 * Drawing coordinates are those of the half-size drawing.
 */
type Part = 'cons' | 'coolL' | 'tank' | 'coolR' | 'b16' | 'b17' | 'b18';

/** back to front, so the opaque silhouettes hide what is behind */
const ORDER: Part[] = ['cons', 'coolL', 'tank', 'coolR', 'b16', 'b17', 'b18'];

/** final offset and the slice of the explosion progress the part moves in */
const MOVE: Record<Part, { d: [number, number]; from: number; to: number }> = {
  b16: { d: [0, -220], from: 0, to: 0.55 },
  b17: { d: [0, -290], from: 0.08, to: 0.63 },
  b18: { d: [0, -290], from: 0.16, to: 0.71 },
  cons: { d: [80, -150], from: 0.3, to: 0.85 },
  coolL: { d: [-175, -49], from: 0.4, to: 1 },
  coolR: { d: [175, 49], from: 0.45, to: 1 },
  tank: { d: [0, 0], from: 0, to: 1 },
};

/** model tree: part, label, nesting level */
const TREE: [Part | null, string, number][] = [
  [null, 'Transformator', 0],
  ['tank', 'Kessel', 1],
  ['b16', 'Durchführung 1', 1],
  ['b17', 'Durchführung 2', 1],
  ['b18', 'Durchführung 3', 1],
  ['cons', 'Ausdehnungsgefäß', 1],
  ['coolL', 'Kühler links', 1],
  ['coolR', 'Kühler rechts', 1],
];

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
const VIEW = { x: -140, y: -130, w: 1310, h: 1210 };

const parts = data.parts as Record<Part, [number, number, number, number]>;
const smooth = (t: number) => t * t * (3 - 2 * t);

export function buildTransformer(host: HTMLElement): (p: number) => void {
  host.innerHTML =
    `<div class="cad" style="width:${DESKTOP_W}px;height:${DESKTOP_H}px">` +
    `<div class="cad__bar"><span class="cad__icon">${svgIcon('M2 13.5L8 2.5l6 11z M5 8h6')}</span>` +
    `<span>Leistungstransformator – Zeichnung</span><span class="cad__btns">${BUTTONS}</span></div>` +
    `<div class="cad__menu">${MENU.map((m) => `<span>${m}</span>`).join('')}</div>` +
    `<div class="cad__tools">${TOOLS.map((d, i) => (d ? `<i${i === EXPLODE_TOOL ? ' data-explode' : ''}>${svgIcon(d)}</i>` : '<b></b>')).join('')}</div>` +
    `<div class="cad__body"><div class="cad__tree"><p>Modell</p>` +
    TREE.map(([, label, level]) => `<div style="padding-left:${10 + level * 16}px">${level ? '' : '▾ '}${label}</div>`).join('') +
    `</div><div class="cad__canvas"><div class="cad__sheet"></div>` +
    `<dl class="cad__block"><dt>Benennung</dt><dd>Leistungstransformator</dd>` +
    `<dt>Vorlage</dt><dd>US 12,230,429 B2, Fig. 1</dd><dt>Blatt</dt><dd>1 / 1</dd></dl></div></div>` +
    `<div class="cad__status"><span>Baugruppe Transformator · 7 Teile</span><span class="cad__state"></span></div>` +
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
  const rows = Array.from(host.querySelectorAll<HTMLElement>('.cad__tree div'));
  const explodeTool = host.querySelector<HTMLElement>('[data-explode]')!;
  const state = host.querySelector<HTMLElement>('.cad__state')!;

  // assembled it fills the sheet a bit more; it backs off while coming apart
  const [cx, cy] = [512, 600];
  let last = -1;
  return (p: number) => {
    if (Math.abs(p - last) < 1e-4) return;
    last = p;
    const s = 1.2 - 0.2 * smooth(p);
    all.setAttribute('transform', `translate(${cx} ${cy}) scale(${s.toFixed(4)}) translate(${-cx} ${-cy})`);
    let moving: Part | null = null;
    for (const e of els) {
      const raw = (p - e.from) / (e.to - e.from);
      const t = smooth(Math.min(1, Math.max(0, raw)));
      e.img.setAttribute('transform', `translate(${(e.d[0] * t).toFixed(2)} ${(e.d[1] * t).toFixed(2)})`);
      if (e.name !== 'tank' && raw > 0 && raw < 1) moving = e.name; // the latest part to start wins
    }
    // the part on the move is selected in the tree, as if dragged out
    TREE.forEach(([part], i) => rows[i].classList.toggle('is-sel', part !== null && part === moving));
    explodeTool.classList.toggle('is-on', p > 0.001);
    state.textContent = p > 0.001 ? `Explosionsansicht ${Math.round(p * 100)} %` : 'Zusammenbau';
  };
}
