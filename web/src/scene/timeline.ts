/**
 * The camera path of the story as five pre-rendered sequences (Cycles, see
 * web/render). The page picks the frame for its state; render/path.ts samples the
 * same functions for Blender, so page and render cannot drift apart.
 *
 * Each sequence runs over one parameter u in 0..1:
 *   pull   hero (display fills the view) -> laptop on the desk
 *   now    laptop -> view of the digitalisation chapter
 *   zoom   -> close on the display (terminal)
 *   pan    close view -> reading view of the CV
 *   close  lean towards the next view, then micro closes, the display goes dark,
 *          the lid comes down and the camera turns to the business card, which
 *          lies on the desk only in this sequence
 *
 * Poses are three.js coordinates (Y up, laptop front towards +Z), framed for a
 * 16:10 view (1600 x 1000) with a vertical field of view of FOV degrees.
 */

export const FOV = 30;
export const ASPECT = 1.6;

export const SEGMENTS = ['pull', 'now', 'zoom', 'pan', 'close'] as const;
export type Segment = (typeof SEGMENTS)[number];

/** frames per sequence: about 30 per second of the time-driven steps */
export const FRAMES: Record<Segment, number> = { pull: 72, now: 48, zoom: 60, pan: 48, close: 120 };

/** how far the camera leans towards the next view while the buffer at the end of the CV fills */
export const LEAN = 0.12;
/** share of the close sequence that belongs to the lean, before micro closes */
export const LEAN_PART = 0.1;
/** the hinge rises as the lid comes down onto the deck (m) */
export const LID_LIFT = 0.0061;

export const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
/** quick start, soft landing: a step answers the gesture at once */
export const easeOut = (t: number) => 1 - (1 - t) ** 3;
export const smooth = (t: number) => t * t * (3 - 2 * t);
export const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
export const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));

export type Vec = [number, number, number];
/** orbit around a target: radius, azimuth (0 = front), elevation; f is the focus point */
export interface Pose {
  t: Vec;
  r: number;
  az: number;
  el: number;
  up: Vec;
  f: Vec;
}
export type PoseName = 'coverPose' | 'laptopPose' | 'nowPose' | 'zoomPose' | 'readPose' | 'shutPose' | 'cardPose';
export type Poses = Record<PoseName, Pose>;

/**
 * State of the story as far as the camera is concerned.
 * dev runs 0..2: the zoom onto the display (0..1), then the pan to the reading
 * view (1..2). The page computes it as zoomIn * (1 + pan): forwards the pan
 * starts when the zoom is done, backwards the pan stays at 1 while the zoom
 * runs back, so the camera passes the reading view, the close view and the
 * chapter view in turn either way.
 */
export interface StoryState {
  pull: number;
  now: number;
  dev: number;
  /** buffer at the end of the CV, 0..1 */
  lean: number;
  /** the last sequence, 0..1 */
  closing: number;
}

/** the parts of the last sequence over closing = 0..1 */
export function closeParts(closing: number) {
  return {
    /** micro has closed, the display goes dark */
    dark: ease(span(closing, 0.05, 0.2)),
    /** camera towards the view of the closing lid */
    toShut: ease(span(closing, 0, 0.32)),
    /** the lid comes down */
    shut: ease(span(closing, 0.18, 0.5)),
    /** camera turns to the business card */
    turn: ease(span(closing, 0.5, 0.92)),
  };
}

/** sequence and parameter for a state: the deepest sequence that has begun */
export function locate(s: StoryState): { seg: Segment; u: number } {
  if (s.closing > 0) return { seg: 'close', u: LEAN_PART + (1 - LEAN_PART) * s.closing };
  if (s.lean > 0) return { seg: 'close', u: LEAN_PART * clamp01(s.lean) };
  if (s.dev > 1) return { seg: 'pan', u: Math.min(1, s.dev - 1) };
  if (s.dev > 0) return { seg: 'zoom', u: s.dev };
  if (s.now > 0) return { seg: 'now', u: s.now };
  return { seg: 'pull', u: s.pull };
}

/** the state a frame of a sequence shows (inverse of locate) */
export function stateAt(seg: Segment, u: number): StoryState {
  const s: StoryState = { pull: 1, now: 1, dev: 2, lean: 0, closing: 0 };
  switch (seg) {
    case 'pull':
      return { ...s, pull: u, now: 0, dev: 0 };
    case 'now':
      return { ...s, now: u, dev: 0 };
    case 'zoom':
      return { ...s, dev: u };
    case 'pan':
      return { ...s, dev: 1 + u };
    case 'close':
      return u <= LEAN_PART ? { ...s, lean: u / LEAN_PART } : { ...s, lean: 1, closing: (u - LEAN_PART) / (1 - LEAN_PART) };
  }
}

const mix = (a: Vec, b: Vec, t: number): Vec => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const unit = (v: Vec): Vec => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  return {
    t: mix(a.t, b.t, t),
    r: a.r + (b.r - a.r) * t,
    az: a.az + (b.az - a.az) * t,
    el: a.el + (b.el - a.el) * t,
    up: unit(mix(a.up, b.up, t)),
    f: mix(a.f, b.f, t),
  };
}

/** the camera pose of a state; the steps already ease in time, so the poses follow them linearly */
export function poseOf(s: StoryState, P: Poses): Pose {
  const c = closeParts(s.closing);
  let pose = lerpPose(P.coverPose, P.laptopPose, s.pull);
  pose = lerpPose(pose, P.nowPose, s.now);
  pose = lerpPose(pose, P.zoomPose, clamp01(s.dev));
  pose = lerpPose(pose, P.readPose, clamp01(s.dev - 1));
  pose = lerpPose(pose, P.shutPose, 1 - (1 - LEAN * s.lean) * (1 - c.toShut));
  return lerpPose(pose, P.cardPose, c.turn);
}

/** camera position of a pose */
export function eye(p: Pose): Vec {
  const c = Math.cos(p.el);
  return [p.t[0] + p.r * c * Math.sin(p.az), p.t[1] + p.r * Math.sin(p.el), p.t[2] + p.r * c * Math.cos(p.az)];
}

/**
 * What the display shows, as weights of the slides (the rest is the empty
 * screen). It lights the keyboard and glows past the edge of the page's display
 * a little, so it has to match it: during the zoom the empty prompt (the session
 * starts once the camera is there), from the pan on the CV in micro, the prompt
 * again once micro quits.
 */
export function screenMix(s: StoryState) {
  const swap = ease(span(s.dev, 0, 0.03));
  const term = ease(span(s.dev, 0.005, 0.09));
  // micro quits as the last sequence starts: back to the prompt
  const cv = span(s.dev, 1, 1.02) * (1 - span(s.closing, 0, 0.01));
  return {
    hero: 1 - ease(span(s.now, 0.1, 0.4)),
    now: ease(span(s.now, 0.45, 0.8)) * (1 - swap),
    prompt: term * (1 - cv),
    cv: term * cv,
  };
}

/** keyboard backlight: comes on while the camera moves in on the display */
export const backlight = (s: StoryState) => ease(span(s.dev, 0.3, 1.3)) * (1 - closeParts(s.closing).dark);
