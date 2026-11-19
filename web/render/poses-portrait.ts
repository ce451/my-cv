/**
 * Camera poses for the portrait frames (phones held upright): the same viewing
 * angles as src/scene/poses.json, each framed so its subject sits in the lower half
 * of a 1200 x 1920 frame and the chapter text has the upper half, over the dark room
 * (styles.css, html.is-portrait); 'bottom' swaps them. Phones show only the middle
 * of the frame's width (about 74 % at 19.5:9), tablets held upright the middle of its
 * height, so every subject stays inside x 0.14..0.86 and y 0.09..0.91.
 *
 *   node web/render/poses-portrait.ts <geometry.json> web/src/scene/poses-portrait.json [top|bottom]
 * geometry.json: render/geometry.py (world points of the laptop, the display and the
 * card in three.js coordinates).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import * as THREE from 'three';
import { FOV, type Pose, type PoseName, type Poses, type Vec } from '../src/scene/timeline.ts';

export const PORTRAIT_ASPECT = 1200 / 1920;

const geom = JSON.parse(readFileSync(process.argv[2], 'utf8')) as Record<string, Vec[]>;
const land = JSON.parse(readFileSync(new URL('../src/scene/poses.json', import.meta.url), 'utf8')) as Poses;
const pts = (k: string) => geom[k].map((p) => new THREE.Vector3(...p));
const camera = new THREE.PerspectiveCamera(FOV, PORTRAIT_ASPECT, 0.01, 20);

function apply(p: Pose) {
  const c = Math.cos(p.el);
  camera.position.set(p.t[0] + p.r * c * Math.sin(p.az), p.t[1] + p.r * Math.sin(p.el), p.t[2] + p.r * c * Math.cos(p.az));
  camera.up.set(...p.up);
  camera.lookAt(...p.t);
  camera.updateMatrixWorld();
}

/** the box of points lands centred on (fx, fy), at most fw wide and fh high (fractions of the frame, y from the top) */
function frame(from: Pose, points: THREE.Vector3[], fx: number, fy: number, fw: number, fh: number): Pose {
  const mid = new THREE.Box3().setFromPoints(points).getCenter(new THREE.Vector3());
  const t = mid.clone();
  const pose: Pose = { ...from, t: t.toArray() as Vec, r: from.r };
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const q = new THREE.Vector3();
  for (let i = 0; i < 12; i++) {
    pose.t = t.toArray() as Vec;
    apply(pose);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of points) {
      q.copy(p).project(camera);
      x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x);
      y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y);
    }
    pose.r *= Math.max((x1 - x0) / 2 / fw, (y1 - y0) / 2 / fh);
    const halfH = pose.r * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    right.setFromMatrixColumn(camera.matrixWorld, 0);
    up.setFromMatrixColumn(camera.matrixWorld, 1);
    const dx = ((x0 + x1) / 2 + 1) / 2 - fx;
    const dy = (1 - (y0 + y1) / 2) / 2 - fy;
    t.addScaledVector(right, dx * 2 * halfH * PORTRAIT_ASPECT).addScaledVector(up, -dy * 2 * halfH);
  }
  pose.t = t.toArray() as Vec;
  return pose;
}

const open = pts('laptopOpen');
const screen = pts('screen');
const card = pts('card');
// the chapter text above the laptop, over the dark room ('top', the default), or below it ('bottom')
const TEXT = process.argv[4] === 'bottom' ? 'bottom' : 'top';
const UPPER = TEXT === 'top' ? { fx: 0.5, fy: 0.68, fw: 0.7, fh: 0.36 } : { fx: 0.5, fy: 0.29, fw: 0.72, fh: 0.38 };
const out: Required<Poses> = {
  // the hero as on the desktop: the display fills the view (its height the frame's), the
  // page's hero in the part the phone shows; then the camera pulls back to the laptop
  coverPose: frame(land.coverPose, screen, 0.5, 0.5, 10, 1.0),
  laptopPose: frame(land.laptopPose, open, UPPER.fx, UPPER.fy, UPPER.fw, UPPER.fh),
  // the longest chapter text: the laptop smaller and lower
  nowPose: TEXT === 'top' ? frame(land.nowPose, open, 0.5, 0.73, 0.62, 0.28) : frame(land.nowPose, open, UPPER.fx, UPPER.fy, UPPER.fw, UPPER.fh),
  zoomPose: frame(land.zoomPose, screen, 0.5, TEXT === 'top' ? 0.6 : 0.3, 0.72, 0.4),
  readPose: frame(land.readPose, screen, 0.5, TEXT === 'top' ? 0.64 : 0.29, 0.72, 0.38),
  shutPose: frame(land.shutPose, open, UPPER.fx, UPPER.fy, UPPER.fw, UPPER.fh),
  // upright the camera goes on into the display: square to it, the panel's height filling the
  // frame's (stage.ts makes micro's window as tall as the view there)
  divePose: frame(land.coverPose, screen, 0.5, 0.5, 10, 1.0),
  // the card with the closed laptop's corner, in the middle
  // upright the card is narrow on the phone: seen more from above, so it is less foreshortened
  cardPose: frame({ ...land.cardPose, el: land.cardPose.el + THREE.MathUtils.degToRad(16) }, [...card], 0.5, 0.45, 0.66, 0.56),
};
// focus: as in landscape where it is a fixed point, on the new target where it follows the display
for (const k of Object.keys(out) as (PoseName | 'divePose')[]) {
  const from = k === 'divePose' ? land.coverPose : land[k];
  const same = from.f.every((v, i) => Math.abs(v - from.t[i]) < 1e-4);
  if (same) out[k].f = out[k].t;
  out[k] = { ...out[k], t: out[k].t.map((v) => Math.round(v * 1e5) / 1e5) as Vec, r: Math.round(out[k].r * 1e5) / 1e5 };
}
writeFileSync(process.argv[3], JSON.stringify(out, null, 1));
console.log(Object.entries(out).map(([k, p]) => `${k} r ${p.r.toFixed(3)}`).join(', '));
