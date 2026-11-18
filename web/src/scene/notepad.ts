import * as THREE from 'three';

/**
 * Squared A5 notepad (5 mm grid, glued at the top) with a ballpoint pen, on the
 * desk to the right of the laptop. The last scene writes the contact note on it
 * in handwriting. The note is a canvas texture, so the lamp lights it like the
 * paper; the links on it are real anchors in an invisible layer that the stage
 * maps onto the sheet.
 */

const PAGE_W = 0.148;
const PAGE_D = 0.21;
const PAD_H = 0.006;
/** canvas pixels: 1024 across the A5 sheet */
export const NOTE_W = 1024;
export const NOTE_H = Math.round((NOTE_W * PAGE_D) / PAGE_W);
const MM = NOTE_W / (PAGE_W * 1000);
const INK = 'rgb(28 42 104 / 0.93)';
const FONT = '"Caveat"';
/** the note sits slightly askew on the sheet */
export const NOTE_TURN = -0.025;

interface Line {
  text: string;
  size: number;
  weight: number;
  x: number;
  y: number;
  href?: string;
}

export interface Notepad {
  group: THREE.Group;
  /** world corners of the top sheet: far left, far right, near right, near left (as the canvas: tl, tr, br, bl) */
  corners(): THREE.Vector3[];
  /** 0..1: the note writes itself line by line */
  write(p: number): void;
  /** link boxes in canvas pixels, before the turn of the note */
  links: { x: number; y: number; w: number; h: number; href: string; label: string }[];
  /** world centre of the top sheet */
  center(): THREE.Vector3;
}

export async function buildNotepad(address: string): Promise<Notepad> {
  await document.fonts.load(`600 80px ${FONT}`);
  const canvas = document.createElement('canvas');
  canvas.width = NOTE_W;
  canvas.height = NOTE_H;
  const ctx = canvas.getContext('2d')!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;

  // the note: the call from v1, then the ways to get in touch
  const lines: Line[] = [
    { text: 'Klingt interessant?', size: 118, weight: 600, x: 92, y: 300 },
    { text: 'Dann reden wir.', size: 118, weight: 600, x: 118, y: 440 },
    { text: address, size: 86, weight: 500, x: 104, y: 680, href: `mailto:${address}` },
    { text: 'linkedin.com/in/christopher-elstner', size: 72, weight: 500, x: 96, y: 818, href: 'https://www.linkedin.com/in/christopher-elstner/' },
    { text: 'github.com/ce451', size: 86, weight: 500, x: 108, y: 956, href: 'https://github.com/ce451' },
    { text: 'Christopher', size: 96, weight: 600, x: 560, y: 1200 },
  ];
  // shrink lines that would run past the right margin
  for (const l of lines) {
    ctx.font = `${l.weight} ${l.size}px ${FONT}`;
    const room = NOTE_W - l.x - 70;
    const w = ctx.measureText(l.text).width;
    if (w > room) l.size = Math.floor((l.size * room) / w);
  }
  const widths = lines.map((l) => {
    ctx.font = `${l.weight} ${l.size}px ${FONT}`;
    return ctx.measureText(l.text).width;
  });
  const total = widths.reduce((a, b) => a + b, 0);

  function paper() {
    ctx.fillStyle = '#e8ebec'; // a touch cool: the warm lamp tints it
    ctx.fillRect(0, 0, NOTE_W, NOTE_H);
    ctx.strokeStyle = 'rgb(96 128 160 / 0.32)';
    ctx.lineWidth = 1.6;
    const step = 5 * MM;
    const top = 16 * MM; // below the glued edge
    ctx.beginPath();
    for (let x = (NOTE_W % step) / 2; x < NOTE_W; x += step) {
      ctx.moveTo(x, top);
      ctx.lineTo(x, NOTE_H);
    }
    for (let y = top; y < NOTE_H; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(NOTE_W, y);
    }
    ctx.stroke();
  }

  let last = -1;
  function write(p: number) {
    if (Math.abs(p - last) < 1e-3) return;
    last = p;
    paper();
    // the hand moves along the text: each line is revealed left to right
    let budget = p * total;
    ctx.save();
    ctx.translate(NOTE_W / 2, NOTE_H / 2);
    ctx.rotate(NOTE_TURN);
    ctx.translate(-NOTE_W / 2, -NOTE_H / 2);
    ctx.fillStyle = INK;
    ctx.strokeStyle = INK;
    lines.forEach((l, i) => {
      if (budget <= 0) return;
      const shown = Math.min(widths[i], budget);
      budget -= widths[i];
      ctx.save();
      ctx.beginPath();
      ctx.rect(l.x - 20, l.y - l.size, shown + 30, l.size * 1.5);
      ctx.clip();
      ctx.font = `${l.weight} ${l.size}px ${FONT}`;
      ctx.fillText(l.text, l.x, l.y);
      ctx.restore();
      // a quick stroke under the question, a dash before the name
      if (i === 0 && shown === widths[i]) {
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(l.x + 6, l.y + 26);
        ctx.quadraticCurveTo(l.x + widths[i] * 0.5, l.y + 14, l.x + widths[i] - 10, l.y + 30);
        ctx.stroke();
      }
      if (i === lines.length - 1 && shown > 0) {
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(l.x - 70, l.y - 30);
        ctx.lineTo(l.x - 22, l.y - 33);
        ctx.stroke();
      }
    });
    ctx.restore();
    tex.needsUpdate = true;
  }
  write(0);

  // geometry: paper block, the sheet with the note, glued edge, grey board below
  const group = new THREE.Group();
  const block = new THREE.Mesh(
    new THREE.BoxGeometry(PAGE_W, PAD_H, PAGE_D),
    new THREE.MeshStandardMaterial({ color: '#d9dde6', roughness: 0.92 }),
  );
  block.position.y = PAD_H / 2 + 0.0012;
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(PAGE_W + 0.001, 0.0012, PAGE_D + 0.001),
    new THREE.MeshStandardMaterial({ color: '#8b8378', roughness: 0.9 }),
  );
  board.position.y = 0.0006;
  const sheet = new THREE.Mesh(
    new THREE.PlaneGeometry(PAGE_W, PAGE_D),
    new THREE.MeshStandardMaterial({ map: tex, color: '#e6edff', roughness: 0.86 }), // offsets the warm lamp
  );
  sheet.rotation.x = -Math.PI / 2;
  sheet.position.y = PAD_H + 0.0012 + 0.0002;
  const glue = new THREE.Mesh(
    new THREE.BoxGeometry(PAGE_W + 0.0006, PAD_H + 0.0016, 0.011),
    new THREE.MeshStandardMaterial({ color: '#2b2c30', roughness: 0.7 }),
  );
  glue.position.set(0, (PAD_H + 0.0016) / 2 + 0.0004, -PAGE_D / 2 + 0.0055);
  group.add(board, block, sheet, glue);

  // ballpoint pen beside the pad
  const pen = new THREE.Group();
  const black = new THREE.MeshStandardMaterial({ color: '#141519', roughness: 0.35, metalness: 0.2 });
  const steel = new THREE.MeshStandardMaterial({ color: '#c9ccd1', roughness: 0.25, metalness: 1 });
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.0047, 0.0047, 0.118, 28), black);
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.0047, 0.0012, 0.018, 28), steel);
  cone.position.y = -0.068;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.0047, 0.0047, 0.012, 28), steel);
  cap.position.y = 0.065;
  const clip = new THREE.Mesh(new THREE.BoxGeometry(0.0022, 0.04, 0.0016), steel);
  clip.position.set(0, 0.045, 0.0052);
  pen.add(barrel, cone, cap, clip);
  pen.rotation.set(Math.PI / 2, 0, 0.32); // lying down, turned a little
  pen.position.set(PAGE_W / 2 + 0.024, 0.0049, 0.01);
  group.add(pen);
  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true;
  });

  // links: box of each line with a link, in canvas pixels (before the slight turn)
  const links = lines
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => l.href)
    .map(({ l, i }) => ({ x: l.x - 10, y: l.y - l.size * 0.8, w: widths[i] + 20, h: l.size * 1.05, href: l.href!, label: l.text }));

  const local = [
    new THREE.Vector3(-PAGE_W / 2, sheet.position.y, -PAGE_D / 2),
    new THREE.Vector3(PAGE_W / 2, sheet.position.y, -PAGE_D / 2),
    new THREE.Vector3(PAGE_W / 2, sheet.position.y, PAGE_D / 2),
    new THREE.Vector3(-PAGE_W / 2, sheet.position.y, PAGE_D / 2),
  ];
  return {
    group,
    corners: () => local.map((v) => v.clone().applyMatrix4(group.matrixWorld)),
    center: () => new THREE.Vector3(0, sheet.position.y, 0).applyMatrix4(group.matrixWorld),
    write,
    links,
  };
}
