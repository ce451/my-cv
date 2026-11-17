import * as THREE from 'three';

export type Legend = [text: string, rx: number, ry: number, sizeMm: number, align: 'l' | 'r' | 'c'];

export interface KeyRect {
  u: number;
  v: number;
  w: number;
  h: number;
  legends: Legend[];
}

export interface KeyboardLayout {
  keys: KeyRect[];
  /** keyboard well size in millimetres (UV space) */
  mm: [number, number];
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function texture(c: HTMLCanvasElement, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.flipY = false; // glTF UV convention
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Small line icons as printed on ThinkPad keycaps, drawn into a box of size s. */
function icon(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, s: number) {
  const h = s / 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.lineWidth = s * 0.09;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const path = (pts: number[][], close = false) => {
    ctx.beginPath();
    pts.forEach(([px, py], i) => (i ? ctx.lineTo(px * h, py * h) : ctx.moveTo(px * h, py * h)));
    if (close) ctx.closePath();
    ctx.stroke();
  };
  const speaker = () => {
    ctx.beginPath();
    for (const [px, py] of [[-0.9, -0.3], [-0.5, -0.3], [-0.05, -0.75], [-0.05, 0.75], [-0.5, 0.3], [-0.9, 0.3]])
      ctx.lineTo(px * h, py * h);
    ctx.closePath();
    ctx.fill();
  };
  const arcs = (n: number) => {
    for (let i = 1; i <= n; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, (0.25 + 0.3 * i) * h, -0.75, 0.75);
      ctx.stroke();
    }
  };
  const sun = (r: number, rays: number) => {
    ctx.beginPath();
    ctx.arc(0, 0, r * h, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      path([[Math.cos(a) * (r + 0.2), Math.sin(a) * (r + 0.2)], [Math.cos(a) * rays, Math.sin(a) * rays]]);
    }
  };
  const chevron = (rot: number) => {
    ctx.rotate(rot);
    path([[-0.45, 0.22], [0, -0.22], [0.45, 0.22]]);
  };
  switch (name) {
    case 'mute':
      speaker();
      path([[0.25, -0.35], [0.85, 0.35]]);
      path([[0.25, 0.35], [0.85, -0.35]]);
      break;
    case 'voldn':
      speaker();
      ctx.translate(-0.05 * h, 0);
      arcs(1);
      break;
    case 'volup':
      speaker();
      ctx.translate(-0.05 * h, 0);
      arcs(2);
      break;
    case 'micoff':
      ctx.beginPath();
      ctx.roundRect(-0.25 * h, -0.85 * h, 0.5 * h, 1.05 * h, 0.25 * h);
      ctx.stroke();
      path([[-0.5, -0.1], [-0.5, 0.05], [0, 0.5], [0.5, 0.05], [0.5, -0.1]]);
      path([[0, 0.5], [0, 0.85]]);
      path([[-0.75, -0.85], [0.75, 0.85]]);
      break;
    case 'sundn':
      sun(0.3, 0.62);
      break;
    case 'sunup':
      sun(0.32, 0.9);
      break;
    case 'display':
      ctx.strokeRect(-0.9 * h, -0.6 * h, 0.95 * h, 0.75 * h);
      ctx.strokeRect(0.0, -0.2 * h, 0.9 * h, 0.75 * h);
      break;
    case 'bubble':
      path([[-0.8, -0.6], [0.8, -0.6], [0.8, 0.35], [-0.2, 0.35], [-0.55, 0.75], [-0.5, 0.35], [-0.8, 0.35]], true);
      break;
    case 'phone':
      ctx.beginPath();
      ctx.roundRect(-0.38 * h, -0.85 * h, 0.76 * h, 1.7 * h, 0.15 * h);
      ctx.stroke();
      break;
    case 'star': {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = (i % 2 ? 0.38 : 0.85) * h;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case 'calc':
      ctx.strokeRect(-0.6 * h, -0.85 * h, 1.2 * h, 1.7 * h);
      path([[-0.35, -0.45], [0.35, -0.45]]);
      for (const gy of [0.0, 0.4]) for (const gx of [-0.3, 0, 0.3]) ctx.fillRect((gx - 0.07) * h, (gy - 0.07) * h, 0.14 * h, 0.14 * h);
      break;
    case 'back':
      path([[0.9, 0], [-0.9, 0]]);
      path([[-0.5, -0.4], [-0.9, 0], [-0.5, 0.4]]);
      break;
    case 'tab':
      path([[-0.9, -0.35], [0.8, -0.35]]);
      path([[0.45, -0.7], [0.8, -0.35], [0.45, 0]]);
      path([[0.9, -0.7], [0.9, 0.0]]);
      path([[0.9, 0.45], [-0.8, 0.45]]);
      path([[-0.45, 0.1], [-0.8, 0.45], [-0.45, 0.8]]);
      path([[-0.9, 0.1], [-0.9, 0.8]]);
      break;
    case 'shift':
      path([[0, -0.85], [0.75, 0], [0.32, 0], [0.32, 0.8], [-0.32, 0.8], [-0.32, 0], [-0.75, 0]], true);
      break;
    case 'caps':
      path([[0, -0.9], [0.7, -0.15], [0.3, -0.15], [0.3, 0.4], [-0.3, 0.4], [-0.3, -0.15], [-0.7, -0.15]], true);
      path([[-0.3, 0.8], [0.3, 0.8]]);
      break;
    case 'enter':
      path([[0.8, -0.8], [0.8, 0.3], [-0.8, 0.3]]);
      path([[-0.4, -0.1], [-0.8, 0.3], [-0.4, 0.7]]);
      break;
    case 'win':
      for (const [gx, gy] of [[-1, -1], [0.1, -1], [-1, 0.1], [0.1, 0.1]]) ctx.fillRect(gx * 0.8 * h, gy * 0.8 * h, 0.72 * h, 0.72 * h);
      break;
    case 'copilot':
      ctx.lineWidth = s * 0.07;
      ctx.beginPath();
      ctx.roundRect(-0.75 * h, -0.55 * h, 0.9 * h, 1.1 * h, 0.35 * h);
      ctx.stroke();
      ctx.beginPath();
      ctx.roundRect(-0.15 * h, -0.55 * h, 0.9 * h, 1.1 * h, 0.35 * h);
      ctx.stroke();
      break;
    case 'up':
      chevron(0);
      break;
    case 'down':
      chevron(Math.PI);
      break;
    case 'left':
      chevron(-Math.PI / 2);
      break;
    case 'right':
      chevron(Math.PI / 2);
      break;
  }
  ctx.restore();
}

/**
 * Key legends drawn into the keyboard's planar UV space (top = rear row).
 * Returns the printed legends (albedo) and the backlight mask (emissive).
 */
export function legendTextures(layout: KeyboardLayout, keyColor: string, inkColor: string, font: string) {
  const W = 4096;
  const pxPerMm = W / layout.mm[0];
  const H = Math.round(layout.mm[1] * pxPerMm);
  const [albedo, ca] = canvas(W, H);
  const [glow, cg] = canvas(W, H);
  ca.fillStyle = keyColor;
  ca.fillRect(0, 0, W, H);
  cg.fillStyle = '#000';
  cg.fillRect(0, 0, W, H);
  ca.fillStyle = ca.strokeStyle = inkColor;
  cg.fillStyle = cg.strokeStyle = '#fff';
  for (const ctx of [ca, cg]) ctx.textBaseline = 'middle';
  for (const k of layout.keys) {
    for (const [text, rx, ry, sizeMm, align] of k.legends) {
      if (!text) continue;
      const x = (k.u + k.w * rx) * W;
      const y = (k.v + k.h * ry) * H;
      const size = sizeMm * pxPerMm;
      for (const ctx of [ca, cg]) {
        if (text.startsWith('@')) {
          icon(ctx, text.slice(1), x, y, size);
          continue;
        }
        ctx.textAlign = align === 'l' ? 'left' : align === 'r' ? 'right' : 'center';
        ctx.font = `500 ${size}px ${font}`;
        ctx.fillText(text, x, y);
      }
    }
  }
  return { map: texture(albedo), emissiveMap: texture(glow) };
}

/** Soft contact shadow under the laptop. */
export function shadowTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(256, 256);
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(0,0,0,0.85)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.55)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
