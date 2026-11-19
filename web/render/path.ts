/**
 * Samples the camera path of the page (src/scene/timeline.ts) for the Cycles
 * sequences: one entry per frame with camera, focus, lid, display and backlight.
 *
 *   node web/render/path.ts web/render/out/path.json [poses.json]
 * (Node 24: runs TypeScript directly). The poses default to src/scene/poses.json;
 * the portrait frames (phones held upright) take src/scene/poses-portrait.json.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import {
  DIVE,
  DIVE_FRAMES,
  FRAMES,
  SEGMENTS,
  lerpPose,
  type Poses,
  backlight,
  closeParts,
  eye,
  poseOf,
  screenMix,
  stateAt,
} from '../src/scene/timeline.ts';

const poses = JSON.parse(readFileSync(process.argv[3] ?? new URL('../src/scene/poses.json', import.meta.url), 'utf8')) as Poses;
const r5 = (v: number) => Math.round(v * 1e5) / 1e5;
const v5 = (v: number[]) => v.map(r5);

const out: Record<string, unknown[]> = {};
for (const seg of SEGMENTS) {
  const n = FRAMES[seg];
  out[seg] = Array.from({ length: n }, (_, i) => {
    const u = i / (n - 1);
    const s = stateAt(seg, u);
    const p = poseOf(s, poses);
    const c = closeParts(s.closing);
    const m = screenMix(s);
    return {
      u: r5(u),
      eye: v5(eye(p)),
      target: v5(p.t),
      up: v5(p.up),
      focus: v5(p.f),
      shut: r5(c.shut),
      dark: r5(c.dark),
      screen: v5([m.hero, m.now, m.prompt, m.cv]),
      backlight: r5(backlight(s)),
    };
  });
}
// portrait: the camera into the display, from the reading view with the CV open
if (poses.divePose) {
  const s = stateAt('pan', 1);
  const c = closeParts(s.closing);
  const m = screenMix(s);
  out[DIVE] = Array.from({ length: DIVE_FRAMES }, (_, i) => {
    const u = i / (DIVE_FRAMES - 1);
    const p = lerpPose(poses.readPose, poses.divePose!, u);
    return {
      u: r5(u),
      eye: v5(eye(p)),
      target: v5(p.t),
      up: v5(p.up),
      focus: v5(p.f),
      shut: r5(c.shut),
      dark: r5(c.dark),
      screen: v5([m.hero, m.now, m.prompt, m.cv]),
      backlight: r5(backlight(s)),
    };
  });
}
writeFileSync(process.argv[2], JSON.stringify(out));
console.log(Object.entries(out).map(([k, v]) => `${k} ${v.length}`).join(', '));
