import { SEGMENTS, SEQUENCES, type Segment, type Sequence } from './timeline';
import type { Quad } from './screen-map';

/**
 * Plays the pre-rendered sequences (web/render, public/seq) on a 2D canvas: the
 * frame for a point of the camera path, cover-scaled like a background image.
 * Between two frames it cross-fades, which reads like a little motion blur.
 * Each frame carries the corners of the display and the business card, so the page can
 * map its DOM onto them, and the laptop's box in the frame.
 *
 * Where the view is narrower than the frames (4:3, 5:4), the frame does not stay
 * centred: it moves sideways so the laptop keeps clear of the chapter text on the
 * left and the business card stays in view on the right.
 *
 * Frames load coarse to fine (every 16th, then every 8th, ...): the sequence the
 * page is in, then its neighbours, so a sequence plays early at a lower frame
 * rate. Until a frame is there, the nearest loaded one stands in.
 *
 * The files stay compressed in memory; only the frames around the one on screen are
 * decoded, off the main thread, as ImageBitmaps (all of them decoded would take
 * gigabytes, and an image the browser has to decode while drawing stalls the frame).
 * (H.264 intra frames on the video decoder were tried instead of WebP: on a phone they
 * decoded slower and stalled more, so the frames are WebP only.)
 */

interface Meta {
  w: number;
  h: number;
  /** per frame: display corners (8), card corners (8), laptop box x0, y0, x1, y1 (4, may be missing) */
  segs: Record<Segment, (number[] | null)[]> & Partial<Record<Sequence, (number[] | null)[]>>;
}

export interface Shown {
  screen: Quad;
  card: Quad;
}

/** where the frame may not be centred: weights 0..1 of the two constraints */
export interface Place {
  /** keep the laptop right of this x (viewport px, the right edge of the chapter text), with weight text */
  clear: number;
  text: number;
  /** keep the business card in view, with this weight */
  card: number;
}

export interface Frames {
  resize(vw: number, vh: number): void;
  /** draws the frame for (seg, u) if it changed; the corners of what is shown, in viewport pixels */
  draw(seg: Sequence, u: number, place?: Place): Shown | null;
  /** the display's left edge (viewport px) in the last frame of seg with the frame moved right as far as it may go */
  displayLeft(seg: Segment): number | null;
  /** load this sequence (and its neighbours) next */
  want(seg: Sequence): void;
  /** whether this set has the sequence (dive: the portrait frames only) */
  has(seg: Sequence): boolean;
  /** share of the sequence's frames that are fetched, 0..1 */
  loaded(seg: Sequence): number;
  /** the laptop's box (x0, y0, x1, y1) in frame i of seg (the last with -1), the frame centred, viewport px */
  laptopAt(seg: Sequence, i: number): number[] | null;
  /** frees the decoded frames (the page turned to the other set); drawing decodes again */
  release(): void;
  /** the display's corners in frame i of seg (the last with -1), the frame centred, viewport px */
  screenAt(seg: Sequence, i: number): Quad | null;
}

const PARALLEL = 6;
/** dev trials (devlog.ts): /?noframes, /?half, /?noxfade */
const DEV_PARAMS = new URLSearchParams(import.meta.env.DEV ? location.search : '');
/** decoded frames at most (bytes): phones less */
const DECODED_BYTES = matchMedia('(pointer: coarse)').matches ? 240e6 : 400e6;
const DECODING = 3;
/** a decoded frame: an ImageBitmap, or an image where the browser has no createImageBitmap (Safari before 15) */
type Decoded = ImageBitmap | HTMLImageElement;
const decodeFile = (b: Blob): Promise<Decoded> =>
  typeof createImageBitmap === 'function'
    ? createImageBitmap(b)
    : new Promise((done, fail) => {
        const img = new Image();
        const url = URL.createObjectURL(b);
        img.onload = () => {
          URL.revokeObjectURL(url);
          done(img);
        };
        img.onerror = fail;
        img.src = url;
      });
const free = (d: Decoded) => {
  if ('close' in d) d.close();
};

/** the sequences in story order; dive and close both start where pan ends */
const BRANCHES: Sequence[] = ['dive', 'close'];
/** gap between the chapter text and the laptop, and between the card and the edge of the view (px) */
export const GAP = 32;

export async function loadFrames(canvas: HTMLCanvasElement, base: string, onFrame: () => void): Promise<Frames> {
  const meta: Meta = await (await fetch(`${base}meta.json`)).json();
  const ctx = canvas.getContext('2d', { alpha: false })!;
  const segs = meta.segs as Record<Sequence, (number[] | null)[]>;
  const present = SEQUENCES.filter((s) => segs[s]);
  /** the files (fetched), the decoded frames, and which are being decoded */
  const files = Object.fromEntries(present.map((s) => [s, segs[s].map(() => null as Blob | null)])) as Record<Sequence, (Blob | null)[]>;
  const fetching = Object.fromEntries(present.map((s) => [s, segs[s].map(() => false)])) as Record<Sequence, boolean[]>;
  const bitmaps = Object.fromEntries(present.map((s) => [s, segs[s].map(() => null as Decoded | null)])) as Record<
    Sequence,
    (Decoded | null)[]
  >;
  const decoding = new Set<string>();
  const budget = Math.max(12, Math.floor(DECODED_BYTES / (meta.w * meta.h * 4)));
  // dev trial /?half: the timed moves (dive, close) only on every second frame, so half as many are decoded and shown
  const HALF = import.meta.env.DEV && DEV_PARAMS.has('half');
  const halved = (s: Sequence, i: number) => HALF && (s === 'dive' || s === 'close') && i % 2 === 1 && i !== segs[s].length - 1;


  // where each frame lies along the story: the main line pull .. pan, then the branches
  const start: Partial<Record<Sequence, number>> = {};
  let x = 0;
  for (const s of SEGMENTS) {
    if (BRANCHES.includes(s) || !segs[s]) continue;
    start[s] = x;
    x += segs[s].length;
  }
  const fork = x - 1;
  for (const s of BRANCHES) if (segs[s]) start[s] = fork;
  /** frames between (s, i) and the one on screen (at, f); ahead counts less than behind */
  let at: Sequence = 'pull';
  let atF = 0;
  let heading = 1;
  function distance(s: Sequence, i: number): number {
    const a = start[s]! + i;
    const b = start[at]! + atF;
    // from one branch to the other: back to the fork and out again
    if (BRANCHES.includes(s) && BRANCHES.includes(at) && s !== at) return (a - fork + (b - fork)) * 1.4;
    const d = a - b;
    return Math.abs(d) * (d * heading > 0 ? 0.6 : 1.4);
  }

  // dev: how often the frame asked for was not there yet (stats.ts reads them)
  const stats = { draws: 0, standIn: 0, unfetched: 0, decodes: 0, decodeMs: 0, decodeMax: 0, budget };
  if (import.meta.env.DEV) (window as unknown as { __fstats: typeof stats[] }).__fstats = [...((window as unknown as { __fstats?: typeof stats[] }).__fstats ?? []), stats];
  /** decodes the frames nearest the one on screen, as many as the budget holds, and drops the rest */
  let lastPlan = '';
  let released = false;
  function release() {
    released = true;
    wanted = [];
    lastPlan = '';
    for (const s of present)
      bitmaps[s].forEach((b, i) => {
        if (b) free(b);
        bitmaps[s][i] = null;
      });
  }
  function plan() {
    if (released) return;
    const key = `${at}${Math.round(atF)}:${heading}`;
    if (key === lastPlan) return;
    lastPlan = key;
    const all: [Sequence, number, number][] = [];
    for (const s of present) for (let i = 0; i < segs[s].length; i++) if (files[s][i] && !halved(s, i)) all.push([s, i, distance(s, i)]);
    all.sort((p, q) => p[2] - q[2]);
    const keep = new Set(all.slice(0, budget).map(([s, i]) => `${s}${i}`));
    for (const s of present)
      bitmaps[s].forEach((b, i) => {
        if (b && !keep.has(`${s}${i}`)) {
          free(b);
          bitmaps[s][i] = null;
        }
      });
    wanted = all.slice(0, budget).filter(([s, i]) => !bitmaps[s][i]);
    decode();
  }
  let wanted: [Sequence, number, number][] = [];
  function decode() {
    while (decoding.size < DECODING && wanted.length) {
      const [s, i] = wanted.shift()!;
      const k = `${s}${i}`;
      if (bitmaps[s][i] || decoding.has(k) || !files[s][i]) continue;
      decoding.add(k);
      const t0 = performance.now();
      decodeFile(files[s][i]!)
        .then((b) => {
          if (import.meta.env.DEV) {
            const ms = performance.now() - t0;
            stats.decodes++;
            stats.decodeMs += ms;
            stats.decodeMax = Math.max(stats.decodeMax, ms);
          }
          // still wanted? (the plan may have moved on while it decoded)
          if (!released && distanceRank(s, i)) {
            bitmaps[s][i] = b;
            if (s === at) onFrame();
          } else free(b);
        })
        .catch(() => {
          files[s][i] = null; // not an image: fetched again on the next want()
        })
        .finally(() => {
          decoding.delete(k);
          decode();
        });
    }
  }
  /** whether (s, i) is among the frames the budget holds now */
  function distanceRank(s: Sequence, i: number): boolean {
    const d = distance(s, i);
    let closer = 0;
    for (const t of present)
      for (let j = 0; j < segs[t].length; j++) if ((files[t][j] || bitmaps[t][j]) && !halved(t, j) && distance(t, j) < d && ++closer >= budget) return false;
    return true;
  }

  // coarse to fine within a sequence
  function order(n: number): number[] {
    const out: number[] = [];
    const seen = new Set<number>();
    for (let step = 16; step >= 1; step /= 2)
      for (let i = 0; i < n; i += step)
        if (!seen.has(i)) {
          seen.add(i);
          out.push(i);
        }
    if (!seen.has(n - 1)) out.splice(1, 0, n - 1);
    return out;
  }
  let queue: [Sequence, number][] = [];
  let active = 0;
  function want(seg: Sequence) {
    // this sequence, then the next and the previous one; the rest when the story gets there.
    // The dive leaves the reading view (the end of pan) and comes back to it
    const k = SEGMENTS.indexOf(seg === 'dive' ? 'pan' : seg);
    const next: Sequence[] = [k, k + 1, k - 1].filter((i) => i >= 0 && i < SEGMENTS.length).map((i) => SEGMENTS[i]);
    if (seg === 'pan' || seg === 'close') next.splice(1, 0, 'dive');
    if (seg === 'dive') next.unshift('dive');
    queue = [...new Set(next)]
      .filter((s) => segs[s])
      .flatMap((s) => order(segs[s].length).filter((i) => segs[s][i] && !files[s][i] && !fetching[s][i]).map((i) => [s, i] as [Sequence, number]));
    pump();
  }
  function pump() {
    while (active < PARALLEL && queue.length) {
      const [s, i] = queue.shift()!;
      if (files[s][i] || fetching[s][i]) continue;
      fetching[s][i] = true;
      active++;
      fetch(`${base}${s}/${String(i).padStart(3, '0')}.webp`)
        .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
        .then((b) => {
          files[s][i] = b;
          lastPlan = '';
          plan();
        })
        .catch(() => {}) // tried again on the next want()
        .finally(() => {
          fetching[s][i] = false;
          active--;
          pump();
        });
    }
  }


  let vw = 1;
  let vh = 1;
  let scale = 1;
  /** the frame centred in the view; ox is where it is drawn */
  let ox0 = 0;
  let ox = 0;
  let oy = 0;
  let drawn = '';
  function resize(w: number, h: number) {
    vw = w;
    vh = h;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--scene-bg').trim() || '#000';
    ctx.fillRect(0, 0, vw, vh);
    ctx.imageSmoothingQuality = 'high';
    scale = Math.max(vw / meta.w, vh / meta.h);
    ox = ox0 = (vw - meta.w * scale) / 2;
    oy = (vh - meta.h * scale) / 2;
    drawn = '';
  }

  // the text keeps clear of the display's left edge (the laptop's box reaches further
  // left only low down, at the keyboard, below the text); the laptop's right edge stays in view
  const leftOf = (c: number[]) => Math.min(c[0], c[6]);
  const rightOf = (c: number[]) => (c.length >= 20 ? c[18] : Math.max(c[2], c[4]));
  /** how far right the frame may go: no gap at its left edge, the laptop's right edge in view */
  const rightmost = (c: number[]) => Math.max(2 * ox0, Math.min(0, vw - GAP - rightOf(c) * meta.w * scale));
  /** where the frame goes for corners c */
  function offset(c: number[], place?: Place): number {
    const sw = meta.w * scale;
    if (!place || sw - vw < 0.5) return ox0;
    let x = ox0;
    if (place.text > 0) {
      const need = Math.min(rightmost(c), place.clear + GAP - leftOf(c) * sw);
      if (need > ox0) x += place.text * (need - ox0);
    }
    if (place.card > 0) {
      const cx = [c[8], c[10], c[12], c[14]];
      const need = vw - GAP - Math.max(...cx) * sw;
      if (need < x) x += place.card * (need - x);
    }
    return Math.min(0, Math.max(2 * ox0, x));
  }

  function screenAt(seg: Sequence, i: number): Quad | null {
    const m = segs[seg];
    const c = m?.[i < 0 ? m.length + i : i];
    if (!c) return null;
    const keep = ox;
    ox = ox0;
    const q = corners(c, 0);
    ox = keep;
    return q;
  }

  function displayLeft(seg: Segment): number | null {
    const m = segs[seg];
    const c = m[m.length - 1];
    return c ? rightmost(c) + leftOf(c) * meta.w * scale : null;
  }

  const corners = (c: number[], from: number): Quad =>
    [0, 1, 2, 3].map((k) => [ox + c[from + 2 * k] * meta.w * scale, oy + c[from + 2 * k + 1] * meta.h * scale]) as Quad;
  const mixed = (a: number[], b: number[], t: number) => a.map((v, k) => v + (b[k] - v) * t);

  function nearest(seg: Sequence, f: number): number {
    const r = bitmaps[seg];
    let best = -1;
    for (let i = 0; i < r.length; i++) if (r[i] && (best < 0 || Math.abs(i - f) < Math.abs(best - f))) best = i;
    return best;
  }

  function draw(seg: Sequence, u: number, place?: Place): Shown | null {
    if (!segs[seg]) return null;
    if (released) {
      released = false;
      lastPlan = '';
    }
    const n = segs[seg].length;
    const f = Math.min(n - 1, Math.max(0, u * (n - 1)));
    if (import.meta.env.DEV && DEV_PARAMS.has('noframes') && drawn) {
      // dev trial: the first frame stays, nothing is decoded or drawn (the DOM still follows the camera)
      const m = segs[seg][Math.round(f)] ?? segs[seg].find(Boolean)!;
      ox = offset(m, place);
      return { screen: corners(m, 0), card: corners(m, 8) };
    }
    let i0 = Math.floor(f);
    let i1 = Math.min(n - 1, i0 + 1);
    let t = f - i0;
    if (HALF && (seg === 'dive' || seg === 'close')) {
      i0 = Math.floor(f / 2) * 2;
      i1 = Math.min(n - 1, i0 + 2);
      t = i1 > i0 ? (f - i0) / (i1 - i0) : 0;
    }
    // dev trial /?noxfade: the nearest frame only, no blend of two (the canvas changes only with the frame)
    if (import.meta.env.DEV && DEV_PARAMS.has('noxfade')) {
      i0 = i1 = Math.round(f);
      t = 0;
    }
    if (seg !== at || Math.abs(f - atF) >= 0.5) {
      // the direction the story moves in: along the main line, or into a branch and out of it
      if (seg === at) heading = f > atF ? 1 : -1;
      else heading = start[seg]! + f > start[at]! + atF ? 1 : -1;
      at = seg;
      atF = f;
      plan();
    }
    if (import.meta.env.DEV) stats.draws++;
    if (!bitmaps[seg][i0] || !bitmaps[seg][i1]) {
      if (import.meta.env.DEV) {
        stats.standIn++;
        if (!files[seg][i0]) stats.unfetched++;
      }
      // stand-in: the nearest frame that is there
      i0 = i1 = nearest(seg, f);
      t = 0;
      if (i0 < 0) {
        // nothing loaded yet: the page can already place its DOM
        const m = segs[seg];
        let k = -1;
        for (let i = 0; i < n; i++) if (m[i] && (k < 0 || Math.abs(i - f) < Math.abs(k - f))) k = i;
        if (k < 0) return null;
        ox = offset(m[k]!, place);
        return { screen: corners(m[k]!, 0), card: corners(m[k]!, 8) };
      }
    }
    if (t < 0.02) t = 0;
    else if (t > 0.98) {
      i0 = i1;
      t = 0;
    }
    const a = segs[seg][i0]!;
    const b = segs[seg][i1]!;
    const c = t && a.length === b.length ? mixed(a, b, t) : t ? mixed(a.slice(0, 16), b.slice(0, 16), t) : a;
    ox = offset(c, place);
    const key = `${seg}${i0}:${i1}:${t.toFixed(3)}:${ox.toFixed(1)}`;
    if (key !== drawn) {
      drawn = key;
      const w = meta.w * scale;
      const h = meta.h * scale;
      ctx.globalAlpha = 1;
      ctx.drawImage(bitmaps[seg][i0]!, ox, oy, w, h);
      if (t) {
        ctx.globalAlpha = t;
        ctx.drawImage(bitmaps[seg][i1]!, ox, oy, w, h);
        ctx.globalAlpha = 1;
      }
    }
    return { screen: corners(c, 0), card: corners(c, 8) };
  }

  function loadedShare(seg: Sequence): number {
    const m = segs[seg];
    if (!m) return 1;
    const all = m.filter(Boolean).length;
    return all ? files[seg].filter(Boolean).length / all : 1;
  }

  function laptopAt(seg: Sequence, i: number): number[] | null {
    const m = segs[seg];
    const c = m?.[i < 0 ? m.length + i : i];
    if (!c || c.length < 20) return null;
    const sx = meta.w * scale;
    const sy = meta.h * scale;
    return [ox0 + c[16] * sx, oy + c[17] * sy, ox0 + c[18] * sx, oy + c[19] * sy];
  }

  return { resize, draw, displayLeft, want, has: (seg) => !!segs[seg], screenAt, loaded: loadedShare, laptopAt, release };
}
