/**
 * Contact scene: after micro is closed a new message opens on the desktop of the
 * terminal scene, addressed to Christopher, and the greeting types itself. The
 * window is a link: a click opens the visitor's mail program with that draft.
 * Laid out in the virtual desktop of the Konsole window (822 px wide).
 */

const SUBJECT = 'Kontakt über elstner.ch';
const GREETING = 'Hallo Christopher,\n\n';

const icon = {
  mail: '<svg viewBox="0 0 16 16"><rect x="1.5" y="3" width="13" height="10" rx="1.2" fill="#31363b" stroke="#7f8c8d" stroke-width=".8"/><path d="M2 4l6 4.6L14 4" stroke="#fcfcfc" stroke-width="1.1" fill="none"/></svg>',
  min: '<svg viewBox="0 0 18 18"><path d="M5 7.5l4 4 4-4" stroke="currentColor" stroke-width="1.3" fill="none"/></svg>',
  max: '<svg viewBox="0 0 18 18"><path d="M9 4.5L13.5 9 9 13.5 4.5 9z" stroke="currentColor" stroke-width="1.3" fill="none"/></svg>',
  close: '<svg viewBox="0 0 18 18"><path d="M5 5l8 8M13 5l-8 8" stroke="currentColor" stroke-width="1.3"/></svg>',
  send: '<svg viewBox="0 0 16 16"><path d="M1.5 7.6L14.5 2 10 14.2 7.6 8.6z M7.6 8.6L14.5 2" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/></svg>',
  attach: '<svg viewBox="0 0 16 16"><path d="M10.5 4.5l-5 5a1.4 1.4 0 0 0 2 2l5.5-5.5a2.6 2.6 0 0 0-3.7-3.7L3.6 8a3.8 3.8 0 0 0 5.4 5.4l4-4" fill="none" stroke="currentColor" stroke-width="1.1"/></svg>',
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** host: the Konsole window; address: decoded at runtime, never in the source. Returns update(p), p 0..1. */
export function buildMail(host: HTMLElement, address: string): (p: number) => void {
  const href = `mailto:${address}?subject=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(GREETING)}`;
  const win = document.createElement('div');
  win.className = 'mail';
  win.innerHTML =
    `<div class="kde__bar"><span class="kde__icon">${icon.mail}</span><span class="kde__caption">Neue Nachricht</span>` +
    `<span class="kde__btns">${icon.min}${icon.max}${icon.close}</span></div>` +
    `<div class="mail__tools"><a class="mail__send" tabindex="-1" title="Im E-Mail-Programm öffnen">${icon.send}Senden</a>` +
    `<span>${icon.attach}Anhängen</span></div>` +
    `<dl class="mail__fields"><dt>An:</dt><dd>Christopher Elstner &lt;${esc(address)}&gt;</dd>` +
    `<dt>Betreff:</dt><dd>${esc(SUBJECT)}</dd></dl>` +
    `<a class="mail__body" tabindex="-1"><span class="mail__text"></span><i class="mail__cursor"></i></a>`;
  for (const a of win.querySelectorAll('a')) a.href = href;
  host.appendChild(win);
  const text = win.querySelector<HTMLElement>('.mail__text')!;

  let last = -1;
  return (p: number) => {
    if (Math.abs(p - last) < 1e-4) return;
    last = p;
    // opens like a new window, then the greeting types itself
    const open = Math.min(1, Math.max(0, (p - 0.15) / 0.25));
    const o = open * open * (3 - 2 * open);
    win.style.opacity = o.toFixed(3);
    win.style.transform = `scale(${(0.94 + 0.06 * o).toFixed(4)})`;
    win.classList.toggle('is-open', o > 0.99);
    const typed = Math.round(Math.min(1, Math.max(0, (p - 0.45) / 0.4)) * GREETING.length);
    if (text.textContent!.length !== typed) text.textContent = GREETING.slice(0, typed);
  };
}
