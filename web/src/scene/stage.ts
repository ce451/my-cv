import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { quadToMatrix3d, type Quad } from './screen-map';
import { buildTerminal, DESKTOP_W } from './terminal';
import { buildTransformer } from './transformer';
import { buildCvWindow } from './cv-full';
import { GAP, loadFrames, type Frames, type Place } from './frames';
import poseData from './poses.json';
import cardData from './card-links.json';
import { ASPECT, clamp01, closeParts, ease, easeOut, locate, poseOf, span, type Poses, type Sequence, type StoryState } from './timeline';

gsap.registerPlugin(ScrollTrigger);

/**
 * The scene: the desk with the ThinkPad as pre-rendered Cycles sequences
 * (frames.ts, web/render), the page's display content as real DOM mapped onto
 * the rendered display, the contact links laid over the rendered business card.
 */

const poses = poseData as unknown as Poses;
/** pixels per mm of the link layer over the business card */
const CARD_PX = 16;

/** the contact address, decoded from the page (base64 in the HTML, as content/cv.de.json has it) */
function contactAddress(): string {
  try {
    return atob(document.querySelector<HTMLElement>('[data-mail]')?.dataset.mail ?? '');
  } catch {
    return '';
  }
}

/** fine film grain over the scene; it moves, so it reads as grain and not as a texture */
function grain(stage: HTMLElement) {
  const n = 160;
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d')!;
  const img = g.createImageData(n, n);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (Math.random() + Math.random() + Math.random() - 1.5) * 2; // about normal, sd 1
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v > 0 ? 255 : 0;
    img.data[i + 3] = Math.min(255, Math.abs(v) * 9);
  }
  g.putImageData(img, 0, 0);
  const el = document.createElement('div');
  el.className = 'stage__grain';
  el.style.backgroundImage = `url(${c.toDataURL()})`;
  stage.appendChild(el);
}

/** views narrower than this (width / height) get the portrait frames, where there are any */
const PORTRAIT = 0.9;

export async function initStage(canvas: HTMLCanvasElement, screenEl: HTMLElement) {
  let dirty = true;
  /** false while the splash is up (the story does not move behind it) */
  let started = false;
  // two sets of frames: landscape (seq/) and portrait (seq-portrait/, phones held upright);
  // without portrait frames every view gets the landscape ones
  const sets: { land?: Promise<Frames>; port?: Promise<Frames | null> } = {};
  const onFrame = () => {
    dirty = true;
  };
  const landscape = () => (sets.land ??= loadFrames(canvas, `${import.meta.env.BASE_URL}seq/`, onFrame));
  const portrait = () => (sets.port ??= loadFrames(canvas, `${import.meta.env.BASE_URL}seq-portrait/`, onFrame).catch(() => null));
  const portraitView = () => document.documentElement.clientWidth / document.documentElement.clientHeight < PORTRAIT;
  let upright = portraitView() && (await portrait()) !== null;
  let frames = upright ? (await portrait())! : await landscape();
  document.documentElement.classList.toggle('is-portrait', upright);
  const stageEl = screenEl.parentElement!;

  // the links on the business card: invisible anchors over the print (render/card_texture.py)
  const cardLinks = document.createElement('div');
  cardLinks.className = 'note-links';
  const CARD_W = cardData.w * CARD_PX;
  const CARD_H = cardData.h * CARD_PX;
  cardLinks.style.width = `${CARD_W}px`;
  cardLinks.style.height = `${CARD_H}px`;
  const address = contactAddress();
  const links: { box: number[]; href: string; label: string }[] = [
    { box: cardData.links.mail, href: `mailto:${address}`, label: address },
    { box: cardData.links.linkedin, href: 'https://www.linkedin.com/in/christopher-elstner/', label: 'linkedin.com/in/christopher-elstner' },
    { box: cardData.links.github, href: 'https://github.com/ce451', label: 'github.com/ce451' },
  ];
  for (const l of links) {
    if (!l.label) continue;
    const a = cardLinks.appendChild(document.createElement('a'));
    a.href = l.href;
    a.textContent = l.label;
    if (!l.href.startsWith('mailto:')) a.rel = 'me noopener';
    const [x, y, w, h] = l.box.map((v) => v * CARD_PX);
    Object.assign(a.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
  }
  stageEl.appendChild(cardLinks);
  /** writes a style property only when its value changes (most of them change only now and then) */
  const written = new Map<HTMLElement, Record<string, string>>();
  function put(el: HTMLElement | null, prop: string, value: string) {
    if (!el) return;
    let w = written.get(el);
    if (!w) written.set(el, (w = {}));
    if (w[prop] === value) return;
    w[prop] = value;
    el.style.setProperty(prop, value);
  }
  // the room mirrored in the panel, the panel's sheen
  const refl = screenEl.appendChild(document.createElement('div'));
  refl.className = 'screen__refl';
  const reflImg = refl.appendChild(document.createElement('div'));
  reflImg.className = 'screen__refl-img';
  const sheen = screenEl.appendChild(document.createElement('div'));
  sheen.className = 'screen__sheen';
  const heroSlide = screenEl.querySelector<HTMLElement>('.slide--hero');
  const nowSlide = screenEl.querySelector<HTMLElement>('.slide--now');
  // the legal notice, below the card in the last view
  const legal = document.querySelector<HTMLElement>('.legal');
  grain(stageEl);
  // darkens the room behind the chapter text
  const scrimEl = stageEl.appendChild(document.createElement('div'));
  scrimEl.className = 'stage__scrim';

  let vw = 0;
  let vh = 0;
  let sw = 0;
  let sh = 0;
  const nowText = document.querySelector<HTMLElement>('#ch-now .chapter__text');
  const devText = document.querySelector<HTMLElement>('#ch-dev .chapter__text');
  /** right edges of the chapter texts (viewport px): the laptop keeps clear of them */
  let nowRight = 0;
  let devRight = 0;
  const termSlide = screenEl.querySelector<HTMLElement>('.slide--term')!;
  const terminal = buildTerminal(termSlide);
  // upright, scrolling the CV moves the camera into the display, where micro's window
  // becomes as large as the phone (cv-full.ts, the dive frames)
  const NO_CV = import.meta.env.DEV && new URLSearchParams(location.search).has('nocv');
  const cvWin = buildCvWindow(termSlide, termSlide.querySelector<HTMLElement>('.kde')!);
  /** upright with the dive frames */
  let diving = false;
  // Upright the camera moves into micro and out again in one go, time-driven: the
  // first gesture in the CV starts the way in, a new one at the CV's end (or top)
  // the way out, and the story runs on from there (the last sequence, or back up)
  const DIVE_IN_MS = 1000;
  const DIVE_OUT_MS = 500;
  /** quintic ease in and out: the middle of the way out of micro in a fifth of its time */
  const steep = (t: number) => (t < 0.5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2);
  /** a new gesture this long (viewport heights) at the CV's end leaves micro */
  const LEAVE = 0.04;
  /** in micro (at rest), the way running (1 in, -1 out) and its progress 0..1 */
  let diveIn = false;
  let diveDir = 0;
  let diveP = 0;
  /** where the story goes once out of micro */
  let leave = 0;
  let leaveAcc = 0;
  /** how far the CV shows scrolled (0..1, last frame) */
  let docShown = 0;
  const explode = buildTransformer(screenEl.querySelector<HTMLElement>('.slide--now')!);
  // the CV opens in the close view, then the camera pulls back to the reading view
  const panFrom = terminal.timeOf('cv-open') + 500;
  const panTo = panFrom + 1600;
  const sessionEnd = panTo;
  // dev chapter progress at which the session starts, resets, and the CV scrolls
  const ZOOM_TO = 0.14;
  const PLAY_AT = ZOOM_TO;
  const RESET_AT = 0.03;
  const CV_FROM = PLAY_AT; // the CV scrolls as soon as the session is done
  /** narrowest the chapter texts get (px) */
  const TEXT_MIN = 260;
  let playStart: number | null = null;
  let pan = 0;
  /** camera position in the dev chapter (0..2, see StoryState) and its speed */
  let devCam = 0;
  let devVel = 0;
  /** seconds the camera takes to catch up with the dev chapter, about */
  const DEV_SMOOTH = 0.35;

  function resize() {
    vw = document.documentElement.clientWidth;
    vh = document.documentElement.clientHeight;
    // the display as the first view shows it, filling the view: in landscape the frame is
    // the display's shape; upright (frames 1 : 1.6) the display is as tall as the frame
    if (upright) {
      sh = Math.max(vh, vw * ASPECT);
      sw = sh * ASPECT;
    } else {
      sw = Math.max(vw, vh * ASPECT);
      sh = sw / ASPECT;
    }
    screenEl.style.width = `${sw}px`;
    screenEl.style.height = `${sh}px`;
    screenEl.style.setProperty('--kde-scale', (sw / DESKTOP_W).toFixed(5));
    frames.resize(vw, vh);
    // the chapter texts no wider than the room left of the display allows (4:3, 5:4);
    // upright they sit below the laptop
    const root = document.documentElement;
    const fit = (el: HTMLElement | null, seg: 'now' | 'pan', prop: string, widest: number) => {
      if (!el) return 0;
      const left = upright ? null : frames.displayLeft(seg);
      const pad = el.parentElement!.getBoundingClientRect().left + parseFloat(getComputedStyle(el.parentElement!).paddingLeft);
      if (left === null) root.style.removeProperty(`${prop}-w`);
      else root.style.setProperty(`${prop}-w`, `${Math.round(Math.min(widest, Math.max(TEXT_MIN, left - GAP - pad)))}px`);
      // higher up where the text would run off the bottom, smaller where even that is not enough
      el.classList.remove('is-compact');
      if (upright) {
        // above the laptop: smaller where it would reach down onto it (narrow phones)
        root.style.removeProperty(`${prop}-top`);
        const box = frames.laptopAt(seg, -1);
        const lift = parseFloat(el.style.translate.split(' ')[1] || '0') || 0; // while it fades in, it sits lower
        if (box && el.getBoundingClientRect().bottom - lift > box[1] - 12) el.classList.add('is-compact');
      } else {
        if (el.offsetHeight > vh - 48) el.classList.add('is-compact');
        root.style.setProperty(`${prop}-top`, `${Math.round(Math.max(16, Math.min(0.32 * vh, vh - el.offsetHeight - 32)))}px`);
      }
      return el.getBoundingClientRect().right;
    };
    // micro's window: the part of the display the view shows at the end of the dive
    diving = upright && frames.has('dive');
    if (!diving) {
      diveIn = false;
      diveDir = 0;
      leave = 0;
    }
    const q = diving ? frames.screenAt('dive', -1) : null;
    if (q) {
      const k = sw / (q[1][0] - q[0][0]);
      const x0 = Math.max(0, -q[0][0] * k);
      const y0 = Math.max(0, -q[0][1] * k);
      const x1 = Math.min(sw, (vw - q[0][0]) * k);
      const y1 = Math.min(sh, (vh - q[0][1]) * k);
      cvWin.layout({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, k, sw / DESKTOP_W, vw, vh);
    } else diving = false;
    nowRight = fit(nowText, 'now', '--now', 480);
    devRight = fit(devText, 'pan', '--dev', Math.min(480, 0.25 * vw));
    dirty = true;
    // turned between portrait and landscape: the other set of frames
    if (portraitView() !== upright) void swapFrames();
  }

  let swapping = false;
  async function swapFrames() {
    if (swapping) return;
    swapping = true;
    const port = portraitView() ? await portrait() : null;
    const next = port ?? (await landscape());
    swapping = false;
    if (next !== frames) {
      frames.release();
      frames = next;
      upright = port !== null;
      document.documentElement.classList.toggle('is-portrait', upright);
      resize();
      if (wanted) frames.want(wanted);
    }
  }

  /** the display content onto the rendered display */
  function mapScreen(quad: Quad) {
    // where the display fills the view (the hero), a pure translation keeps the text crisp
    const x = (vw - sw) / 2;
    const y = (vh - sh) / 2;
    const cover: Quad = [[x, y], [x + sw, y], [x + sw, y + sh], [x, y + sh]];
    const off = Math.max(...quad.map((p, i) => Math.hypot(p[0] - cover[i][0], p[1] - cover[i][1])));
    screenEl.style.transform = quadToMatrix3d(sw, sh, off < 1 ? cover : quad);
  }

  const pull = ScrollTrigger.create({ trigger: '#ch-hero', start: 'top top', end: () => `+=${window.innerHeight}` });
  const now = ScrollTrigger.create({ trigger: '#ch-now', start: 'top top', end: 'top -60%' });
  const dev = ScrollTrigger.create({ trigger: '#ch-dev', start: 'top top', end: 'bottom bottom' });
  // the drawing comes apart in the zone above the dev chapter
  const apart = ScrollTrigger.create({ trigger: '#ch-dev', start: 'top 80%', end: 'top top' });
  const EXPLODE_MS = 1100;
  const EXPLODE_DRIFT = 4;
  const TRAVEL_MS = 1600;
  // last sequence: micro closes, the display goes dark, the lid closes, the laptop
  // stays where it is and the camera turns to the business card
  const CLOSE_MS = 3600;
  const OPEN_MS = 2400;
  /** extra scrolling at the end of the CV, in viewport heights, before the last sequence starts */
  const BUFFER = 0.25;
  let exploded = 0;
  let handOver = false;
  let pendingPlay = false;
  let closing = 0;
  let closeGoal = 0;
  let over = 0;
  let overShown = 0;
  let overAt = 0;
  let armed = false;
  let travel: { from: number; to: number; t0: number; ms: number; ez: (t: number) => number; done: () => void } | null = null;
  const tracks = [pull, now, dev];
  const shown = tracks.map(() => 0);

  // The story moves in steps: one scroll gesture (wheel, swipe, key) plays the
  // sequence to the next station, up or down. Only the CV in micro scrolls
  // freely; at its top a new gesture steps back, at its end some more scrolling
  // fills a buffer before the last sequence starts. The page never scrolls
  // natively. A gesture against the direction of a running sequence turns it back
  // to where it came from; one in the same direction is ignored. Upright the CV is
  // read in micro full screen: the first gesture in the CV takes the camera into the
  // display, a new one at the CV's end (or top) out again and on (diveInput).
  type Kind = 'hero' | 'desk' | 'digi' | 'cv' | 'contact';
  type Station = { y: number; end?: number; kind: Kind };
  const devAt = (p: number) => dev.start + p * (dev.end - dev.start);
  function stations(): Station[] {
    return [
      { y: 0, kind: 'hero' },
      { y: pull.end, kind: 'desk' },
      { y: now.end, kind: 'digi' },
      { y: devAt(PLAY_AT), end: devAt(0.97), kind: 'cv' },
      // the last sequence plays in the scene, the page stays at the end of the CV
      { y: devAt(0.97), kind: 'contact' },
    ];
  }
  const CV = 3; // index of the CV station
  const CONTACT = 4;
  let y = window.scrollY;
  const jump = (to: number) => {
    y = to;
    window.scrollTo({ top: to, behavior: 'instant' });
  };
  const prog = (tr: ScrollTrigger) => clamp01((y - tr.start) / Math.max(1, tr.end - tr.start));
  const dist = (st: Station, v: number) => (v < st.y ? st.y - v : v > (st.end ?? st.y) ? v - (st.end ?? st.y) : 0);
  // start at the station nearest to where the page was (reload further down)
  let at = 0;
  stations().forEach((st, i, all) => {
    if (dist(st, y) < dist(all[at], y)) at = i;
  });
  {
    const st = stations()[at];
    jump(Math.min(st.end ?? st.y, Math.max(st.y, y)));
  }
  if (at >= CV) playStart = performance.now() - sessionEnd; // the session counts as played
  let busy: { to: number; dir: number; fromY: number; close?: boolean } | null = null;
  let quietUntil = 0;
  let target: number | null = null; // free scrolling in the CV
  const travelMs = (d: number) => Math.min(1700, Math.max(900, 800 + (450 * Math.abs(d)) / vh));
  const travelTo = (to: number, done: () => void) => {
    travel = { from: y, to, t0: performance.now(), ms: travelMs(to - y), ez: easeOut, done };
  };
  function arrive() {
    at = busy!.to;
    // back from the card the camera is still leaning towards it: the buffer
    // counts as full and drains, so the lean eases out instead of jumping
    if (busy!.close && at === CV) {
      over = overShown = 1;
      overAt = performance.now();
    }
    busy = null;
    if (at === CONTACT) over = 0;
    armed = false;
    quietUntil = performance.now() + 600; // the rest of the gesture does not count as a new one
  }

  function go(dir: number) {
    const all = stations();
    target = null;
    if (busy) {
      if (dir === busy.dir) return;
      // turn back to where the sequence started
      handOver = false;
      pendingPlay = false;
      if (playStart !== null && performance.now() - playStart < sessionEnd) playStart = null;
      if (busy.close) {
        closeGoal = at === CONTACT ? 1 : 0;
        busy = { to: at, dir, fromY: busy.fromY, close: true };
      } else {
        busy = { to: at, dir, fromY: busy.fromY };
        travelTo(busy.fromY, arrive);
      }
      dirty = true;
      return;
    }
    const to = at + dir;
    if (to < 0 || to >= all.length) return;
    busy = { to, dir, fromY: y };
    quietUntil = Infinity;
    if (dir > 0 && to === CV) handOver = true; // explode first, then travel
    else if (to === CONTACT || at === CONTACT) {
      // the last sequence plays in the scene, forwards or backwards
      busy.close = true;
      closeGoal = to === CONTACT ? 1 : 0;
    } else travelTo(dir < 0 ? (all[to].end ?? all[to].y) : all[to].y, arrive); // up into the CV: at its end
    dirty = true;
  }

  /** page distance per input pixel in the CV: the text on the display moves about as far as the input;
   * upright in micro the CV follows the finger */
  const cvGain = (st: Station) => (st.end! - st.y) / (diving ? Math.max(1, cvWin.travel()) : 0.8 * vh);

  /** upright in the CV: into micro, through the CV, out again */
  function diveInput(st: Station, dy: number, fresh: boolean) {
    if (diveDir !== 0) return; // on the way in or out
    const base = target ?? y;
    // at an edge once the CV has come to rest there, as shown (not while it still runs towards it)
    const edge =
      target === null && ((dy > 0 && base >= st.end! - 1 && docShown >= 0.998) || (dy < 0 && base <= st.y + 1 && docShown <= 0.002));
    if (!diveIn) {
      // at the top, or at the end back from the card: the story steps on; else into micro
      if (!fresh && performance.now() < quietUntil) return;
      if (edge) go(Math.sign(dy));
      else {
        diveDir = 1;
        diveP = 0;
        dirty = true;
      }
      return;
    }
    if (edge) {
      // the gesture that got to the edge does not count; a little of a new one leaves micro
      if (fresh) {
        armed = true;
        leaveAcc = 0;
      }
      if (!armed) return;
      leaveAcc += Math.abs(dy);
      if (leaveAcc >= LEAVE * vh) {
        armed = false;
        leave = Math.sign(dy);
        diveDir = -1;
        diveP = 0;
        dirty = true;
      }
      return;
    }
    armed = false;
    target = Math.min(st.end!, Math.max(st.y, base + dy * cvGain(st)));
    dirty = true;
  }

  /** scroll input: inside the CV it scrolls, at its edges and elsewhere a new gesture steps */
  function input(dy: number, fresh: boolean) {
    if (!started) return;
    const st = stations()[at];
    if (!busy && st.end !== undefined && diving) return diveInput(st, dy, fresh);
    if (!busy && st.end !== undefined) {
      const base = target ?? y;
      if (dy > 0 && base >= st.end - 1) {
        // the end of the CV holds: the gesture that got there does not count, a new
        // one fills the buffer, and only a full buffer starts the last sequence
        if (fresh) armed = true;
        if (!armed) return;
        over = Math.min(1, over + dy / (BUFFER * vh));
        overAt = performance.now();
        dirty = true;
        if (over >= 1) go(1);
        return;
      }
      armed = false;
      if (dy < 0) over = 0;
      const g = dy * cvGain(st);
      if (!(g < 0 && base <= st.y + 1)) {
        target = Math.min(st.end, Math.max(st.y, base + g));
        dirty = true;
      } else if (fresh) go(-1);
      return;
    }
    if (fresh || (!busy && performance.now() >= quietUntil)) go(Math.sign(dy));
  }

  let lastWheel = 0;
  let lastAbs = 0;
  window.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey) return; // pinch zoom
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? vh : 1);
      const t = performance.now();
      const abs = Math.abs(dy);
      // a new gesture: after a pause, or a fresh push during the inertia of the last one
      const fresh = t - lastWheel > 180 || abs > lastAbs * 1.6 + 8;
      lastWheel = t;
      lastAbs = abs;
      if (abs >= 2) input(dy, fresh);
    },
    { passive: false },
  );
  const KEYS: Record<string, number> = { ArrowDown: 0.12, PageDown: 0.85, ' ': 0.85, End: 1, ArrowUp: -0.12, PageUp: -0.85, Home: -1 };
  window.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    if ((e.target as HTMLElement).closest?.('input, textarea, select, button, [contenteditable]')) return;
    if (!(e.key in KEYS)) return;
    e.preventDefault();
    input(KEYS[e.key] * vh * (e.key === ' ' && e.shiftKey ? -1 : 1), !e.repeat);
  });
  let touchY: number | null = null;
  let touchFrom = 0;
  let touchFresh = false;
  window.addEventListener(
    'touchstart',
    (e) => {
      touchY = touchFrom = e.touches[0].clientY;
      touchFresh = true;
    },
    { passive: true },
  );
  window.addEventListener(
    'touchmove',
    (e) => {
      // the story moves, never the page: no native scrolling, no pull-to-refresh (pinch zoom stays)
      if (e.touches.length === 1 && e.cancelable) e.preventDefault();
      // the CV follows the finger (and fills the buffer at its end); elsewhere the swipe counts when it ends
      if (touchY === null || busy || stations()[at].end === undefined) return;
      const cy = e.touches[0].clientY;
      if (Math.abs(touchY - cy) < 1) return;
      input(touchY - cy, touchFresh);
      touchFresh = false;
      touchY = cy;
    },
    { passive: false },
  );
  window.addEventListener('touchend', (e) => {
    if (touchY === null || !started) return;
    const d = touchFrom - e.changedTouches[0].clientY;
    touchY = null;
    if (Math.abs(d) < 40) return;
    if (stations()[at].end === undefined || busy) go(Math.sign(d));
  });
  // layout changed (resize, the phone turned): stay where we are, in the CV at the same place in it
  let cvAt: number | null = null;
  ScrollTrigger.addEventListener('refreshInit', () => {
    const st = stations()[at];
    cvAt = st.end !== undefined ? clamp01(((target ?? y) - st.y) / Math.max(1, st.end - st.y)) : null;
  });
  ScrollTrigger.addEventListener('refresh', () => {
    if (busy) return;
    const st = stations()[at];
    target = null;
    if (st.end !== undefined && cvAt !== null) jump(st.y + cvAt * (st.end - st.y));
    else jump(Math.min(st.end ?? st.y, Math.max(st.y, y)));
  });


  let last = performance.now();
  let wanted: Sequence | null = null;
  /** the display's corners in the frame on screen */
  let shownScreen: [number, number][] | null = null;
  // switch to the mapped layout and place the screen in the same task, so no
  // frame is painted between the CSS cover layout and the matrix3d mapping
  document.documentElement.classList.add('is-staged');
  resize();
  {
    const first = frames.draw('pull', 0);
    if (first) mapScreen(first.screen);
  }
  window.addEventListener('resize', resize);

  function frame(t: number) {
    const dt = Math.min((t - last) / 1000, 0.1);
    last = t;
    const k = 1 - Math.exp(-dt * 14);
    let moving = dirty;
    const a = prog(apart);
    tracks.forEach((tr, i) => {
      const d = prog(tr) - shown[i];
      if (Math.abs(d) > 1e-5) {
        shown[i] += d * k;
        moving = true;
      } else shown[i] = prog(tr);
    });
    // dev chapter: the recorded session plays once the camera is on the display,
    // after it the CV scrolls; back above the chapter it resets
    const pDevNow = shown[2];
    // (from just past CV_FROM: at the station the progress lands a hair above it, 1e-16, and any
    // scroll above 0 makes the terminal show micro with the CV at once, skipping the session)
    const cvScroll = span(pDevNow, CV_FROM + 1e-6, 0.97);
    const docScroll = cvScroll;
    docShown = docScroll;
    // upright: into micro and out of it, both eased in and out; out steeply, so the stretch where
    // micro wraps the CV anew (the window widening, about 0.8 .. 0.1 of the way) passes in a
    // fifth of the time (measured: from 0.79 to 0.1 the columns go 47 -> 98 on a phone)
    if (diveDir !== 0) {
      diveP = Math.min(1, diveP + (dt * 1000) / (diveDir > 0 ? DIVE_IN_MS : DIVE_OUT_MS));
      moving = true;
    }
    const full = !diving ? 0 : diveDir > 0 ? ease(diveP) : diveDir < 0 ? 1 - steep(diveP) : diveIn ? 1 : 0;
    if (diveDir !== 0 && diveP >= 1) {
      diveIn = diveDir > 0;
      diveDir = 0;
      if (leave) {
        const to = leave;
        leave = 0;
        go(to);
      }
    }
    if (pDevNow < RESET_AT && !pendingPlay) playStart = null;
    // the session starts once the camera has arrived at the display
    if (pendingPlay && pDevNow >= PLAY_AT - 0.002 && devCam >= 0.97) {
      playStart = t;
      pendingPlay = false;
    }
    const playT = playStart === null ? 0 : t - playStart;
    const panTarget = ease(span(playT, panFrom, panTo));
    if (Math.abs(panTarget - pan) > 1e-4) {
      pan += (panTarget - pan) * k;
      moving = true;
    } else pan = panTarget;
    if (playStart !== null && playT < sessionEnd + 100) moving = true;

    // during the hand-over the parts keep drifting apart (past 1) until the terminal replaces the drawing
    const explodeTo = handOver ? EXPLODE_DRIFT : a > 0 ? 1 : 0;
    if (exploded !== explodeTo) {
      const step = (dt * 1000) / EXPLODE_MS;
      exploded = explodeTo > exploded ? Math.min(explodeTo, exploded + step) : Math.max(explodeTo, exploded - step);
      moving = true;
    }
    if (handOver && exploded >= 1 && !travel) {
      // the parts drift on during the way; the session starts at its end
      travel = {
        from: y,
        to: devAt(PLAY_AT),
        t0: t,
        ms: TRAVEL_MS,
        ez: ease,
        done: () => {
          handOver = false;
          pendingPlay = true;
        },
      };
    }

    // buffer at the end of the CV: drains again when the scrolling stops (overShown is read above, from the last frame)
    if (!busy && over > 0 && t - overAt > 400) over = Math.max(0, over - dt * 1.2);
    if (Math.abs(over - overShown) > 1e-4) {
      overShown += (over - overShown) * (1 - Math.exp(-dt * 10));
      moving = true;
    } else overShown = over;

    // last sequence, time-driven in both directions
    if (closeGoal > closing && overShown < 0.98) {
      // forwards the camera first completes its lean: the frames of the last
      // sequence start there (timeline.ts), so it runs on without a jump
      over = 1;
      moving = true;
    } else if (closing !== closeGoal) {
      const step = (dt * 1000) / (closeGoal > closing ? CLOSE_MS : OPEN_MS);
      closing = closeGoal > closing ? Math.min(1, closing + step) : Math.max(0, closing - step);
      moving = true;
    }
    if (busy?.close && closing === closeGoal) arrive();

    // free scrolling through the CV, eased towards the input
    if (target !== null && !travel) {
      const d = target - y;
      jump(Math.abs(d) < 0.5 ? target : y + d * (1 - Math.exp(-dt * 12)));
      if (Math.abs(d) < 0.5) target = null;
      moving = true;
    }
    if (travel) {
      const u = Math.min(1, (t - travel.t0) / travel.ms);
      jump(travel.from + (travel.to - travel.from) * travel.ez(u));
      if (u === 1) {
        const done = travel.done;
        travel = null;
        done();
      }
      moving = true;
    }
    // arriving at the terminal: done once the session has played (also when turned back to it)
    if (busy && !busy.close && !travel && !handOver && busy.to === CV) {
      if (playStart === null && !pendingPlay) pendingPlay = true;
      else if (playStart !== null && playT >= sessionEnd) arrive();
    }
    // camera in the dev chapter: forwards the pan follows the zoom; backwards the
    // zoom runs back with the pan still at 1, so the camera passes the close view
    // on the way (timeline.ts). A critically damped spring keeps the quick step
    // back from the CV at a pace the frames can follow.
    const zoomIn = ease(span(shown[2], 0, ZOOM_TO));
    const devGoal = zoomIn * (1 + pan);
    {
      const w = 2 / DEV_SMOOTH;
      const x = w * dt;
      const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
      const change = devCam - devGoal;
      const temp = (devVel + w * change) * dt;
      devVel = (devVel - w * temp) * decay;
      devCam = devGoal + (change + temp) * decay;
      if (Math.abs(devCam - devGoal) > 1e-4 || Math.abs(devVel) > 1e-3) moving = true;
      else {
        devCam = devGoal;
        devVel = 0;
      }
    }
    if (moving) {
      dirty = false;
      const [pPull, pNow, pDev] = shown;
      const state: StoryState = { pull: pPull, now: pNow, dev: devCam, lean: overShown, closing };
      const pose = poseOf(state, poses);
      const located = locate(state);
      // upright the dive takes over from the reading view while the CV scrolls
      const { seg, u } = full > 0 ? { seg: 'dive' as const, u: full } : located;
      if (seg !== wanted) frames.want((wanted = seg));
      // where the frame is not centred: the laptop clear of the chapter text, the card in view
      const devShown = ease(span(pan, 0.5, 1)) * (1 - ease(span(closing, 0, 0.18))) * (1 - ease(span(full, 0, 0.4)))
      // upright on the way out of micro towards the card the text stays away (it would come back for a moment)
      * (diving && (leave > 0 || (busy?.close && closeGoal === 1)) ? 0 : 1);
      const nowShown = ease(span(pNow, 0.4, 1)) * (1 - zoomIn);
      const turn = closeParts(closing).turn;
      const place: Place = upright
        ? { clear: 0, text: 0, card: 0 } // upright the card is in the middle of the frame (poses-portrait.ts)
        : nowShown >= devShown
          ? { clear: nowRight, text: nowShown, card: turn }
          : { clear: devRight, text: devShown, card: turn };
      const view = frames.draw(seg, u, place);
      if (view) shownScreen = view.screen;
      if (import.meta.env.DEV) (window as unknown as { __view: unknown }).__view = { seg, u, t, doc: docScroll };

      // closing: micro has closed, the display goes dark (the lid moves in the frames)
      const { dark } = closeParts(closing);
      put(screenEl, 'opacity', (1 - dark).toFixed(4));
      put(screenEl, 'visibility', dark >= 1 ? 'hidden' : '');

      terminal.update(playT, docScroll, closing > 0.005);
      // dev trial /?nocv: micro's window is not laid out on the way (it stays as it is)
      if (!(import.meta.env.DEV && NO_CV && full < 1)) cvWin.update(docScroll, full, shownScreen);
      explode(exploded);
      // slides change one after another: old fades out, then the new one fades in
      const devSwap = ease(span(pDev, 0.0, 0.025));
      // styles go straight to the elements that use them: a custom property on the screen
      // or the root would restyle everything below it on every frame
      const glare = ease(pPull);
      put(sheen, 'opacity', glare.toFixed(4));
      put(refl, 'opacity', (glare * 0.09).toFixed(4));
      // the room mirrored faintly in the panel, drifting as the camera moves (as a background
      // at 160 % of the panel's width, positioned at rx, ry)
      if (glare > 0) {
        const rx = 0.5 + (pose.az - poses.coverPose.az) * 0.9;
        const ry = 0.5 - (pose.el - poses.coverPose.el) * 0.9;
        const iw = 1.6 * sw;
        const ih = (iw * 9) / 16;
        put(reflImg, 'transform', `translate(${((sw - iw) * rx).toFixed(1)}px, ${((sh - ih) * ry).toFixed(1)}px)`);
      }
      // dark behind the chapter text only while a text is shown, never over the zoomed terminal
      const scrim = Math.max(ease(span(pNow, 0.3, 0.8)) * (1 - zoomIn), devShown);
      put(scrimEl, 'opacity', scrim.toFixed(4));
      put(heroSlide, 'opacity', (1 - ease(span(pNow, 0.1, 0.4))).toFixed(4));
      put(nowSlide, 'opacity', (ease(span(pNow, 0.45, 0.8)) * (1 - devSwap)).toFixed(4));
      put(termSlide, 'opacity', ease(span(pDev, 0.012, 0.04)).toFixed(4));
      const pn = ease(span(pNow, 0.4, 1));
      put(nowText, 'opacity', pn.toFixed(4));
      put(nowText, 'translate', `0 ${((1 - pn) * 28).toFixed(2)}px`);
      put(devText, 'opacity', devShown.toFixed(4));
      put(devText, 'translate', `0 ${((1 - devShown) * 28).toFixed(2)}px`);
      if (view) {
        if (dark < 1) mapScreen(view.screen);
        // the links on the card follow it; usable once the camera is there
        cardLinks.classList.toggle('is-on', closing >= 1);
        legal?.classList.toggle('is-on', closing >= 1);
        if (closing > 0.5) cardLinks.style.transform = quadToMatrix3d(CARD_W, CARD_H, view.card);
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // the splash (index.html) stays until the fonts are there and the sequence the story
  // starts in has loaded; on a slow line until most of it has, at most a few seconds
  const splash = document.querySelector<HTMLElement>('.splash');
  const splashBar = splash?.querySelector<HTMLElement>('i');
  started = !splash;
  if (splash) {
    const t0 = performance.now();
    let fonts = false;
    document.fonts.ready.then(() => (fonts = true));
    const check = () => {
      const share = frames.loaded(wanted ?? 'pull');
      splashBar?.style.setProperty('--p', (0.1 * Number(fonts) + 0.9 * share).toFixed(3));
      const waited = performance.now() - t0;
      if ((fonts && share >= 1) || (waited > 3500 && share >= 0.5) || waited > 9000) {
        started = true;
        splash.classList.add('is-done');
        setTimeout(() => splash.remove(), 800);
      } else setTimeout(check, 100);
    };
    check();
  }
}
