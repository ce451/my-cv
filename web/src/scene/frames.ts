import { SEGMENTS, type Segment } from './timeline';
import type { Quad } from './screen-map';

/**
 * Plays the pre-rendered sequences (web/render, public/seq) on a 2D canvas: the
 * frame for a point of the camera path, cover-scaled like a background image.
 * Between two frames it cross-fades, which reads like a little motion blur.
 * Each frame carries the corners of the display and the business card, so the page can
 * map its DOM onto them.
 *
 * Frames load coarse to fine (every 16th, then every 8th, ...): the sequence the
 * page is in, then its neighbours, so a sequence plays early at a lower frame
 * rate. Until a frame is there, the nearest loaded one stands in.
 */

interface Meta {
  w: number;
  h: number;
  segs: Record<Segment, (number[] | null)[]>;
}

export interface Shown {
  screen: Quad;
  card: Quad;
}

export interface Frames {
  resize(vw: number, vh: number): void;
  /** draws the frame for (seg, u) if it changed; the corners of what is shown, in viewport pixels */
  draw(seg: Segment, u: number): Shown | null;
  /** load this sequence (and its neighbours) next */
  want(seg: Segment): void;
}

const PARALLEL = 6;

export async function loadFrames(canvas: HTMLCanvasElement, base: string, onFrame: () => void): Promise<Frames> {
  const meta: Meta = await (await fetch(`${base}meta.json`)).json();
  const ctx = canvas.getContext('2d', { alpha: false })!;
  const imgs = Object.fromEntries(SEGMENTS.map((s) => [s, meta.segs[s].map(() => null as HTMLImageElement | null)])) as Record<
    Segment,
    (HTMLImageElement | null)[]
  >;
  const ready = Object.fromEntries(SEGMENTS.map((s) => [s, meta.segs[s].map(() => false)])) as Record<Segment, boolean[]>;

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
  let queue: [Segment, number][] = [];
  let active = 0;
  let current: Segment = 'pull';
  function want(seg: Segment) {
    current = seg;
    // this sequence, then the next and the previous one; the rest when the story gets there
    const k = SEGMENTS.indexOf(seg);
    const segs = [k, k + 1, k - 1].filter((i) => i >= 0 && i < SEGMENTS.length).map((i) => SEGMENTS[i]);
    queue = segs.flatMap((s) => order(meta.segs[s].length).filter((i) => meta.segs[s][i] && !imgs[s][i]).map((i) => [s, i] as [Segment, number]));
    pump();
  }
  function pump() {
    while (active < PARALLEL && queue.length) {
      const [s, i] = queue.shift()!;
      if (imgs[s][i]) continue;
      const img = new Image();
      img.decoding = 'async';
      imgs[s][i] = img;
      active++;
      img.src = `${base}${s}/${String(i).padStart(3, '0')}.webp`;
      img
        .decode()
        .then(() => {
          ready[s][i] = true;
          if (s === current) onFrame();
        })
        .catch(() => {
          imgs[s][i] = null; // try again on the next want()
        })
        .finally(() => {
          active--;
          pump();
        });
    }
  }

  let vw = 1;
  let vh = 1;
  let scale = 1;
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
    ox = (vw - meta.w * scale) / 2;
    oy = (vh - meta.h * scale) / 2;
    drawn = '';
  }

  const corners = (c: number[], from: number): Quad =>
    [0, 1, 2, 3].map((k) => [ox + c[from + 2 * k] * meta.w * scale, oy + c[from + 2 * k + 1] * meta.h * scale]) as Quad;
  const mixed = (a: number[], b: number[], t: number) => a.map((v, k) => v + (b[k] - v) * t);

  function nearest(seg: Segment, f: number): number {
    const r = ready[seg];
    let best = -1;
    for (let i = 0; i < r.length; i++) if (r[i] && (best < 0 || Math.abs(i - f) < Math.abs(best - f))) best = i;
    return best;
  }

  function draw(seg: Segment, u: number): Shown | null {
    const n = meta.segs[seg].length;
    const f = Math.min(n - 1, Math.max(0, u * (n - 1)));
    let i0 = Math.floor(f);
    let i1 = Math.min(n - 1, i0 + 1);
    let t = f - i0;
    if (!ready[seg][i0] || !ready[seg][i1]) {
      // stand-in: the nearest frame that is there
      i0 = i1 = nearest(seg, f);
      t = 0;
      if (i0 < 0) {
        // nothing loaded yet: the page can already place its DOM
        const m = meta.segs[seg];
        let k = -1;
        for (let i = 0; i < n; i++) if (m[i] && (k < 0 || Math.abs(i - f) < Math.abs(k - f))) k = i;
        return k < 0 ? null : { screen: corners(m[k]!, 0), card: corners(m[k]!, 8) };
      }
    }
    if (t < 0.02) t = 0;
    else if (t > 0.98) {
      i0 = i1;
      t = 0;
    }
    const c = t ? mixed(meta.segs[seg][i0]!, meta.segs[seg][i1]!, t) : meta.segs[seg][i0]!;
    const key = `${seg}${i0}:${i1}:${t.toFixed(3)}`;
    if (key !== drawn) {
      drawn = key;
      const w = meta.w * scale;
      const h = meta.h * scale;
      ctx.globalAlpha = 1;
      ctx.drawImage(imgs[seg][i0]!, ox, oy, w, h);
      if (t) {
        ctx.globalAlpha = t;
        ctx.drawImage(imgs[seg][i1]!, ox, oy, w, h);
        ctx.globalAlpha = 1;
      }
    }
    return { screen: corners(c, 0), card: corners(c, 8) };
  }

  return { resize, draw, want };
}
