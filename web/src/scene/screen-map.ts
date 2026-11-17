/**
 * Maps a DOM element of size w x h onto an arbitrary quad in viewport pixels
 * (corners TL, TR, BR, BL) with a CSS matrix3d homography. A perspective camera
 * maps a plane to the screen projectively, so this is exact, not an approximation.
 * When the quad is an axis-aligned rectangle of the same size the result is a pure
 * translation, which keeps text crisp at the start of the scene.
 */
export type Quad = [[number, number], [number, number], [number, number], [number, number]];

export function quadToMatrix3d(w: number, h: number, quad: Quad): string {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = quad;
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const dy3 = y0 - y1 + y2 - y3;
  const det = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / det;
  const k = (dx1 * dy3 - dx3 * dy1) / det;
  const a = x1 - x0 + g * x1;
  const b = x3 - x0 + k * x3;
  const d = y1 - y0 + g * y1;
  const e = y3 - y0 + k * y3;
  return `matrix3d(${a / w},${d / w},0,${g / w},${b / h},${e / h},0,${k / h},0,0,1,0,${x0},${y0},0,1)`;
}
