import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { quadToMatrix3d, type Quad } from './screen-map';
import { buildTerminal, DESKTOP_W } from './terminal';
import { buildTransformer } from './transformer';
import { loadFrames } from './frames';
import poseData from './poses.json';
import noteData from './note-links.json';
import { ASPECT, clamp01, closeParts, ease, easeOut, locate, poseOf, span, type Poses, type Segment, type StoryState } from './timeline';

gsap.registerPlugin(ScrollTrigger);

/**
 * The scene: the desk with the ThinkPad as pre-rendered Cycles sequences
 * (frames.ts, web/render), the page's display content as real DOM mapped onto
 * the rendered display, the contact links laid over the rendered note.
 */

const poses = poseData as unknown as Poses;
/** pixels per mm of the link layer over the note */
const NOTE_PX = 8;

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

export async function initStage(canvas: HTMLCanvasElement, screenEl: HTMLElement) {
  let dirty = true;
  const frames = await loadFrames(canvas, `${import.meta.env.BASE_URL}seq/`, () => {
    dirty = true;
  });
  const stageEl = screenEl.parentElement!;

  // the links on the note: invisible anchors over the handwriting (render/note_texture.py)
  const noteLinks = document.createElement('div');
  noteLinks.className = 'note-links';
  const NOTE_W = noteData.w * NOTE_PX;
  const NOTE_H = noteData.h * NOTE_PX;
  noteLinks.style.width = `${NOTE_W}px`;
  noteLinks.style.height = `${NOTE_H}px`;
  const address = contactAddress();
  const links: { box: number[]; href: string; label: string }[] = [
    { box: noteData.links.mail, href: `mailto:${address}`, label: address },
    { box: noteData.links.linkedin, href: 'https://www.linkedin.com/in/christopher-elstner/', label: 'linkedin.com/in/christopher-elstner' },
    { box: noteData.links.github, href: 'https://github.com/ce451', label: 'github.com/ce451' },
  ];
  for (const l of links) {
    if (!l.label) continue;
    const a = noteLinks.appendChild(document.createElement('a'));
    a.href = l.href;
    a.textContent = l.label;
    if (!l.href.startsWith('mailto:')) a.rel = 'me noopener';
    const [x, y, w, h] = l.box.map((v) => v * NOTE_PX);
    Object.assign(a.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
  }
  stageEl.appendChild(noteLinks);
  grain(stageEl);

  let vw = 0;
  let vh = 0;
  let sw = 0;
  let sh = 0;
  const termSlide = screenEl.querySelector<HTMLElement>('.slide--term')!;
  const terminal = buildTerminal(termSlide);
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
    sw = Math.max(vw, vh * ASPECT);
    sh = sw / ASPECT;
    screenEl.style.width = `${sw}px`;
    screenEl.style.height = `${sh}px`;
    screenEl.style.setProperty('--kde-scale', (sw / DESKTOP_W).toFixed(5));
    frames.resize(vw, vh);
    dirty = true;
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
  // is pushed back and the camera turns to the notepad with the note on it
  const CLOSE_MS = 3600;
  const OPEN_MS = 2400;
  /** extra scrolling at the end of the CV, in viewport heights, before the last sequence starts */
  const BUFFER = 0.5;
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
  // to where it came from; one in the same direction is ignored.
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
    // back from the notepad the camera is still leaning towards it: the buffer
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

  /** page distance per input pixel in the CV: the text on the display moves about as far as the input */
  const cvGain = (st: Station) => (st.end! - st.y) / (0.8 * vh);

  /** scroll input: inside the CV it scrolls, at its edges and elsewhere a new gesture steps */
  function input(dy: number, fresh: boolean) {
    const st = stations()[at];
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
      // the CV follows the finger (and fills the buffer at its end); elsewhere the swipe counts when it ends
      if (touchY === null || busy || stations()[at].end === undefined) return;
      const cy = e.touches[0].clientY;
      if (Math.abs(touchY - cy) < 1) return;
      input(touchY - cy, touchFresh);
      touchFresh = false;
      touchY = cy;
    },
    { passive: true },
  );
  window.addEventListener('touchend', (e) => {
    if (touchY === null) return;
    const d = touchFrom - e.changedTouches[0].clientY;
    touchY = null;
    if (Math.abs(d) < 40) return;
    if (stations()[at].end === undefined || busy) go(Math.sign(d));
  });
  // layout changed (resize): stay where we are
  ScrollTrigger.addEventListener('refresh', () => {
    if (busy) return;
    const st = stations()[at];
    target = null;
    jump(Math.min(st.end ?? st.y, Math.max(st.y, y)));
  });


  let last = performance.now();
  let wanted: Segment | null = null;
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
    const cvScroll = span(pDevNow, CV_FROM, 0.97);
    if (pDevNow < RESET_AT && !pendingPlay) playStart = null;
    if (pendingPlay && pDevNow >= PLAY_AT - 0.002) {
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

    // buffer at the end of the CV: drains again when the scrolling stops
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
      const { seg, u } = locate(state);
      if (seg !== wanted) frames.want((wanted = seg));
      const view = frames.draw(seg, u);
      if (import.meta.env.DEV) (window as unknown as { __view: unknown }).__view = { seg, u, t };

      // closing: micro has closed, the display goes dark (the lid and the laptop move in the frames)
      const { dark } = closeParts(closing);
      screenEl.style.opacity = (1 - dark).toFixed(4);
      screenEl.style.visibility = dark >= 1 ? 'hidden' : '';

      terminal.update(playT, cvScroll, closing > 0.005);
      explode(exploded);
      // slides change one after another: old fades out, then the new one fades in
      const devSwap = ease(span(pDev, 0.0, 0.025));
      screenEl.style.setProperty('--glare', ease(pPull).toFixed(4));
      // the room mirrored faintly in the panel, drifting as the camera moves
      screenEl.style.setProperty('--refl-x', `${(50 + (pose.az - poses.coverPose.az) * 90).toFixed(2)}%`);
      screenEl.style.setProperty('--refl-y', `${(50 - (pose.el - poses.coverPose.el) * 90).toFixed(2)}%`);
      // dark behind the chapter text only while a text is shown, never over the zoomed terminal
      const devText = ease(span(pan, 0.5, 1)) * (1 - ease(span(closing, 0, 0.18)));
      const scrim = Math.max(ease(span(pNow, 0.3, 0.8)) * (1 - zoomIn), devText);
      document.documentElement.style.setProperty('--scrim', scrim.toFixed(4));
      screenEl.style.setProperty('--hero-o', (1 - ease(span(pNow, 0.1, 0.4))).toFixed(4));
      screenEl.style.setProperty('--now-o', (ease(span(pNow, 0.45, 0.8)) * (1 - devSwap)).toFixed(4));
      screenEl.style.setProperty('--term-o', ease(span(pDev, 0.012, 0.04)).toFixed(4));
      document.documentElement.style.setProperty('--p-now', ease(span(pNow, 0.4, 1)).toFixed(4));
      document.documentElement.style.setProperty('--p-dev', devText.toFixed(4));
      if (view) {
        if (dark < 1) mapScreen(view.screen);
        // the links on the note follow the sheet; usable once the camera is there
        noteLinks.classList.toggle('is-on', closing >= 1);
        if (closing > 0.5) noteLinks.style.transform = quadToMatrix3d(NOTE_W, NOTE_H, view.note);
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
