import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import layout from './keyboard-layout.json';
import { legendTextures, shadowTexture, wordmarkTextures, type KeyboardLayout } from './textures';
import { quadToMatrix3d, type Quad } from './screen-map';
import { buildTerminal, DESKTOP_W } from './terminal';
import { buildTransformer } from './transformer';
import { buildNotepad, NOTE_H, NOTE_TURN, NOTE_W } from './notepad';
import { studioScene } from './studio';

gsap.registerPlugin(ScrollTrigger);

const SCREEN_ASPECT = 1.6;
const FOV = 30;

/** Camera pose as an orbit around a target: radius, azimuth (0 = front), elevation. */
interface Pose {
  target: THREE.Vector3;
  r: number;
  az: number;
  el: number;
  up: THREE.Vector3;
}

/** the contact address, decoded from the page (base64 in the HTML, as content/cv.de.json has it) */
function contactAddress(): string {
  try {
    return atob(document.querySelector<HTMLElement>('[data-mail]')?.dataset.mail ?? '');
  } catch {
    return '';
  }
}

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
/** quick start, soft landing: a step answers the gesture at once */
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));

function lerpPose(a: Pose, b: Pose, t: number): Pose {
  return {
    target: a.target.clone().lerp(b.target, t),
    r: a.r + (b.r - a.r) * t,
    az: a.az + (b.az - a.az) * t,
    el: a.el + (b.el - a.el) * t,
    up: a.up.clone().lerp(b.up, t).normalize(),
  };
}

function applyPose(camera: THREE.PerspectiveCamera, p: Pose) {
  const c = Math.cos(p.el);
  camera.position.set(
    p.target.x + p.r * c * Math.sin(p.az),
    p.target.y + p.r * Math.sin(p.el),
    p.target.z + p.r * c * Math.cos(p.az),
  );
  camera.up.copy(p.up);
  camera.lookAt(p.target);
}

/** Black soft-touch coating of the ThinkPad chassis. */
const CHASSIS: THREE.MeshPhysicalMaterialParameters = {
  color: '#0d0e10',
  roughness: 0.6,
  specularIntensity: 0.5,
  sheen: 0.35,
  sheenRoughness: 0.55,
  sheenColor: '#202226',
};

/**
 * The real-time three.js version of the stage, kept as the authoring view for the
 * camera poses (dev only: /?gl, window.__poses -> poses.json). The page itself
 * plays the Cycles sequences (stage.ts).
 */
export async function initStage(canvas: HTMLCanvasElement, screenEl: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(css('--scene-bg'));
  const tex = new THREE.TextureLoader();
  const load = async (url: string, srgb = true) => {
    const t = await tex.loadAsync(url);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const [envMap, backdropMap, deskColor, deskRough, deskNormal] = await Promise.all([
    load('/scene/env.webp'),
    load('/scene/backdrop.webp'),
    load('/scene/desk-color.webp'),
    load('/scene/desk-rough.webp', false),
    load('/scene/desk-normal.webp', false),
  ]);

  // reflections: the evening room around the desk, plus studio softboxes that
  // shape the black chassis the way a product shoot on location would
  const studio = studioScene();
  envMap.mapping = THREE.EquirectangularReflectionMapping;
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(3.5, 64, 32),
    new THREE.MeshBasicMaterial({ map: envMap, side: THREE.BackSide, color: new THREE.Color().setScalar(1.4) }),
  );
  const pmrem = new THREE.PMREMGenerator(renderer);
  // the desk mirrors only the room: at grazing angles it would show the softboxes
  const roomOnly = new THREE.Scene();
  roomOnly.add(dome);
  const roomEnv = pmrem.fromScene(roomOnly, 0.02).texture;
  studio.add(dome);
  scene.environment = pmrem.fromScene(studio, 0.02).texture;
  scene.environmentIntensity = 0.8;

  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 20);

  await document.fonts.load('500 40px "Hanken Grotesk"');
  const gltf = await new GLTFLoader().loadAsync('/models/thinkpad.glb');
  const laptop = gltf.scene;
  laptop.position.y = 0.0015; // rubber feet
  scene.add(laptop);

  const legends = legendTextures(layout as unknown as KeyboardLayout, '#0f0f11', '#b9b9bd', '"Hanken Grotesk"');
  let keysMat: THREE.MeshStandardMaterial | undefined;
  let screenMesh: THREE.Mesh | undefined;
  // physical materials: soft-touch coating on the chassis (velvety edge response),
  // satin keycaps, a smoother touchpad surface
  const physical = new Map<string, THREE.MeshPhysicalMaterial>();
  const swap = (mesh: THREE.Mesh, name: string, params: THREE.MeshPhysicalMaterialParameters) => {
    if (!physical.has(name)) physical.set(name, new THREE.MeshPhysicalMaterial({ name, ...params }));
    mesh.material = physical.get(name)!;
    return physical.get(name)!;
  };
  laptop.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    switch (mat.name) {
      case 'chassis':
        swap(mesh, 'chassis', CHASSIS);
        break;
      case 'touchpad':
        swap(mesh, 'touchpad', { color: '#121315', roughness: 0.56, specularIntensity: 0.4 });
        break;
      case 'keys':
        keysMat = swap(mesh, 'keys', {
          color: '#ffffff',
          map: legends.map,
          emissiveMap: legends.emissiveMap,
          emissive: '#ffe2c4',
          emissiveIntensity: 0,
          roughness: 0.55,
          specularIntensity: 0.55,
          sheen: 0.3,
          sheenRoughness: 0.6,
          sheenColor: '#2b2e33',
        });
        break;
      case 'screen':
        mesh.material = new THREE.MeshBasicMaterial({ color: css('--screen-bg') });
        screenMesh = mesh;
        break;
      case 'led':
        // power LED beside the button: lit white (notebookcheck photo of the P16s)
        mesh.material = new THREE.MeshBasicMaterial({ color: '#f4f6ff', toneMapped: false });
        break;
    }
  });
  if (!screenMesh) throw new Error('Screen mesh missing in model');
  const screenMat = screenMesh.material as THREE.MeshBasicMaterial;
  const screenBg = screenMat.color.clone();
  const lidNode = laptop.getObjectByName('Lid');
  if (!lidNode) throw new Error('Lid missing in model');
  const lid: THREE.Object3D = lidNode;
  const lidOpen = lid.rotation.x;
  const lidY = lid.position.y;

  // ThinkPad wordmark embossed into the palm rest, red i-dot (Lenovo top photo:
  // centre 147.5 mm right of the middle, 31 mm from the front, rising at 40 deg)
  await document.fonts.load('600 40px "Archivo"');
  const mark = wordmarkTextures('Th\u0131nkPad', '"Archivo"');
  for (const t of [mark.roughness, mark.normal]) {
    t.flipY = true;
    t.needsUpdate = true;
  }
  const markW = 0.05;
  const markH = markW / mark.aspect;
  const wordmark = new THREE.Mesh(
    new THREE.PlaneGeometry(markW, markH),
    new THREE.MeshPhysicalMaterial({
      ...CHASSIS,
      roughnessMap: mark.roughness,
      normalMap: mark.normal,
      normalScale: new THREE.Vector2(1.6, 1.6),
      polygonOffset: true,
      polygonOffsetFactor: -2,
    }),
  );
  const iDot = new THREE.Mesh(
    new THREE.CircleGeometry(0.00075, 20),
    new THREE.MeshStandardMaterial({ color: '#c41e24', roughness: 0.5, emissive: '#c41e24', emissiveIntensity: 0.15, polygonOffset: true, polygonOffsetFactor: -4 }),
  );
  iDot.position.set((mark.dot.u - 0.5) * markW, (0.5 - mark.dot.v) * markH, 0);
  wordmark.add(iDot);
  wordmark.rotation.set(-Math.PI / 2, 0, THREE.MathUtils.degToRad(40), 'XYZ');
  wordmark.position.set(0.1475, 0.01441, 0.1243 - 0.0312);
  wordmark.receiveShadow = true;
  laptop.add(wordmark);
  laptop.updateMatrixWorld(true);

  // the LED's light spills faintly onto the matte deck around it
  const ledObj = laptop.getObjectByName('PowerLed');
  if (ledObj) {
    const glow = document.createElement('canvas');
    glow.width = glow.height = 64;
    const g = glow.getContext('2d')!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgb(255 255 255 / 1)');
    grad.addColorStop(0.25, 'rgb(255 255 255 / 0.35)');
    grad.addColorStop(1, 'rgb(255 255 255 / 0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const halo = new THREE.Mesh(
      new THREE.PlaneGeometry(0.005, 0.005),
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(glow),
        color: '#dfe6ff',
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    const at = laptop.worldToLocal(new THREE.Box3().setFromObject(ledObj).getCenter(new THREE.Vector3()));
    halo.rotation.x = -Math.PI / 2;
    halo.position.set(at.x, at.y + 0.0002, at.z);
    laptop.add(halo);
  }

  // screen corners in world space, from the quad's local bounds
  screenMesh.geometry.computeBoundingBox();
  const bb = screenMesh.geometry.boundingBox!;
  const pts: THREE.Vector3[] = [];
  for (const x of [bb.min.x, bb.max.x])
    for (const y of [bb.min.y, bb.max.y])
      for (const z of [bb.min.z, bb.max.z]) {
        const p = new THREE.Vector3(x, y, z).applyMatrix4(screenMesh.matrixWorld);
        if (!pts.some((q) => q.distanceTo(p) < 1e-6)) pts.push(p);
      }
  pts.sort((a, b) => b.y - a.y);
  const [tl, tr] = pts[0].x < pts[1].x ? [pts[0], pts[1]] : [pts[1], pts[0]];
  const [bl, br] = pts[2].x < pts[3].x ? [pts[2], pts[3]] : [pts[3], pts[2]];
  const corners = [tl, tr, br, bl];
  const center = corners.reduce((s, p) => s.add(p), new THREE.Vector3()).multiplyScalar(0.25);
  const up = tl.clone().sub(bl).normalize();
  const right = tr.clone().sub(tl).normalize();
  const normal = right.clone().cross(up).normalize();
  const screenH = tl.distanceTo(bl);
  const screenW = tl.distanceTo(tr);

  // lights: the display lights the keyboard, the desk lamp the rest
  RectAreaLightUniformsLib.init();
  const screenLight = new THREE.RectAreaLight('#eef0f2', 0.9, screenW, screenH);
  screenLight.position.copy(center).addScaledVector(normal, 0.003);
  screenLight.lookAt(center.clone().add(normal));
  scene.add(screenLight);
  // desk lamp off to the left: warm light pool and real shadows
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const lamp = new THREE.SpotLight('#ffc996', 12, 0, 0.72, 1, 2);
  lamp.position.set(-0.78, 0.82, 0.18);
  lamp.target.position.set(0.08, 0, -0.06);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(2048, 2048);
  lamp.shadow.bias = -0.0004;
  lamp.shadow.normalBias = 0.0015;
  lamp.shadow.radius = 4;
  lamp.shadow.camera.near = 0.3;
  lamp.shadow.camera.far = 2.5;
  scene.add(lamp, lamp.target);
  // cool rim from behind separates the black lid from the warm room
  const rim = new THREE.DirectionalLight('#dfe6f0', 0.8);
  rim.position.set(-1.0, 1.7, -0.9);
  scene.add(rim);
  laptop.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && o !== screenMesh) o.castShadow = o.receiveShadow = true;
  });

  // ambient occlusion: contact shadows in the keyboard well, under the keys and the laptop
  const composer = new EffectComposer(
    renderer,
    new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }),
  );
  composer.addPass(new RenderPass(scene, camera));
  const ao = new GTAOPass(scene, camera, 1, 1);
  ao.updateGtaoMaterial({ radius: 0.025, distanceExponent: 1.2, thickness: 0.01, scale: 1.3, samples: 16 });
  ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 16 });
  ao.blendIntensity = 0.9;
  composer.addPass(ao);
  composer.addPass(new OutputPass());

  // desk: varnished wood (Poly Haven, CC0), grain running left to right
  for (const t of [deskColor, deskRough, deskNormal]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.center.set(0.5, 0.5);
    t.rotation = Math.PI / 2;
    t.repeat.set(1.2, 3.2);
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  }
  const desk = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 0.03, 1.2),
    new THREE.MeshPhysicalMaterial({
      map: deskColor,
      roughnessMap: deskRough,
      normalMap: deskNormal,
      normalScale: new THREE.Vector2(0.6, 0.6),
      color: new THREE.Color().setScalar(0.42),
      roughness: 1,
      envMap: roomEnv,
      envMapIntensity: 0.6,
    }),
  );
  desk.position.set(0.3, -0.015, -0.27);
  desk.receiveShadow = true;
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.62, 0.46),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, opacity: 0.7, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, 0.0004, -0.01);
  // the room behind, out of focus: a backplate far behind the desk
  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(7.6, 4.3),
    new THREE.MeshBasicMaterial({ map: backdropMap, toneMapped: false, fog: false, color: new THREE.Color(1, 1, 1) }),
  );
  backdrop.position.set(0.4, 0.5, -3.2);
  scene.add(desk, shadow, backdrop);

  // notepad on the desk to the right: the contact note is written on it at the end
  const note = await buildNotepad(contactAddress());
  note.write(1); // the note is already on the pad
  note.group.position.set(0.34, 0, 0.07);
  note.group.rotation.y = -0.2;
  scene.add(note.group);
  note.group.updateMatrixWorld(true);
  const noteCorners = note.corners();
  const noteLinks = document.createElement('div');
  noteLinks.className = 'note-links';
  noteLinks.style.width = `${NOTE_W}px`;
  noteLinks.style.height = `${NOTE_H}px`;
  const noteTurn = noteLinks.appendChild(document.createElement('div'));
  noteTurn.className = 'note-links__turn';
  noteTurn.style.transform = `rotate(${NOTE_TURN}rad)`;
  for (const l of note.links) {
    const a = noteTurn.appendChild(document.createElement('a'));
    a.href = l.href;
    a.textContent = l.label;
    if (!l.href.startsWith('mailto:')) a.rel = 'me noopener';
    Object.assign(a.style, { left: `${l.x}px`, top: `${l.y}px`, width: `${l.w}px`, height: `${l.h}px` });
  }
  screenEl.parentElement!.appendChild(noteLinks);

  // camera poses
  const laptopPose: Pose = { target: new THREE.Vector3(0.0, 0.1, -0.035), r: 0.98, az: -0.5, el: 0.4, up: new THREE.Vector3(0, 1, 0) };
  const nowPose: Pose = { target: new THREE.Vector3(-0.15, 0.095, -0.03), r: 1.04, az: -0.3, el: 0.3, up: new THREE.Vector3(0, 1, 0) };
  const screenAz = Math.atan2(normal.x, normal.z);
  const screenEl0 = Math.asin(normal.y);
  let coverPose: Pose;
  let zoomPose: Pose;
  let readPose: Pose;
  let notePose: Pose;
  // the lid closes seen from the front left, then the camera turns to the notepad
  const shutPose: Pose = { target: new THREE.Vector3(0.03, 0.03, -0.06), r: 0.86, az: -0.36, el: 0.42, up: new THREE.Vector3(0, 1, 0) };
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

  /**
   * Pose from a viewing angle so that the bounding box of pts lands at (fx, fy),
   * at most fw wide and fh high (viewport fractions).
   */
  function frameBox(pts: THREE.Vector3[], mid: THREE.Vector3, az: number, el: number, fx: number, fy: number, fw: number, fh: number, upVec: THREE.Vector3): Pose {
    const pose: Pose = { target: mid.clone(), r: 0.6, az, el, up: upVec.clone() };
    const right = new THREE.Vector3();
    const camUp = new THREE.Vector3();
    for (let i = 0; i < 8; i++) {
      applyPose(camera, pose);
      camera.updateMatrixWorld();
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const c of pts) {
        projected.copy(c).project(camera);
        x0 = Math.min(x0, projected.x); x1 = Math.max(x1, projected.x);
        y0 = Math.min(y0, projected.y); y1 = Math.max(y1, projected.y);
      }
      pose.r *= Math.max((x1 - x0) / 2 / fw, (y1 - y0) / 2 / fh);
      const halfH = pose.r * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
      right.setFromMatrixColumn(camera.matrixWorld, 0);
      camUp.setFromMatrixColumn(camera.matrixWorld, 1);
      const dx = ((x0 + x1) / 2 + 1) / 2 - fx; // + means box is right of where it should be
      const dy = (1 - (y0 + y1) / 2) / 2 - fy;
      pose.target.addScaledVector(right, dx * 2 * halfH * camera.aspect).addScaledVector(camUp, -dy * 2 * halfH);
    }
    return pose;
  }
  /** the display's bounding box at (fx, fy) with width fw */
  const framePose = (az: number, el: number, fx: number, fy: number, fw: number, upVec: THREE.Vector3) =>
    frameBox(corners, center, az, el, fx, fy, fw, Infinity, upVec);

  function resize() {
    vw = document.documentElement.clientWidth;
    vh = document.documentElement.clientHeight;
    renderer.setSize(vw, vh, false);
    composer.setSize(vw, vh);
    camera.aspect = vw / vh;
    camera.updateProjectionMatrix();
    sw = Math.max(vw, vh * SCREEN_ASPECT);
    sh = sw / SCREEN_ASPECT;
    screenEl.style.width = `${sw}px`;
    screenEl.style.height = `${sh}px`;
    screenEl.style.setProperty('--kde-scale', (sw / DESKTOP_W).toFixed(5));
    // distance at which the display covers the viewport 1:1 in CSS pixels
    const d0 = (screenH * vh) / sh / (2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)));
    coverPose = { target: center.clone(), r: d0, az: screenAz, el: screenEl0, up: up.clone() };
    // close on the display, bezel just visible; then the reading view with the text on the left
    const fit = Math.min(0.9, (0.9 * vh * SCREEN_ASPECT) / vw);
    zoomPose = framePose(screenAz - 0.07, screenEl0 + 0.04, 0.5, 0.5, fit, up);
    readPose = framePose(screenAz + 0.14, screenEl0 + 0.14, 0.665, 0.46, Math.min(0.56, (0.62 * vh * SCREEN_ASPECT) / vw), new THREE.Vector3(0, 1, 0));
    // the notepad from above, a little from the left, filling most of the height
    notePose = frameBox(noteCorners, note.center(), -0.1, 0.98, 0.5, 0.5, 0.86, 0.84, new THREE.Vector3(0, 1, 0));
    // dev only: the Cycles renders (web/render) take their cameras from these poses
    if (import.meta.env.DEV)
      (window as unknown as { __poses: Record<string, Pose> }).__poses = { laptopPose, nowPose, coverPose, zoomPose, readPose, notePose, shutPose };
    dirty = true;
  }

  const projected = new THREE.Vector3();
  function mapScreen() {
    const quad = corners.map((p) => {
      projected.copy(p).project(camera);
      return [((projected.x + 1) / 2) * vw, ((1 - projected.y) / 2) * vh];
    }) as Quad;
    screenEl.style.transform = quadToMatrix3d(sw, sh, quad);
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
  const LID_LIFT = 0.0061; // the hinge rises as the lid comes down onto the deck
  const LAPTOP_BACK = 0.11;
  /** extra scrolling at the end of the CV, in viewport heights, before the last sequence starts */
  const BUFFER = 0.5;
  /** how far the camera leans towards the next view while the buffer fills */
  const LEAN = 0.12;
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

  let dirty = true;
  let last = performance.now();
  // switch to the mapped layout and place the screen in the same task, so no
  // frame is painted between the CSS cover layout and the matrix3d mapping
  document.documentElement.classList.add('is-staged');
  resize();
  applyPose(camera, coverPose!);
  camera.updateMatrixWorld();
  mapScreen();
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
    if (closing !== closeGoal) {
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
    if (moving) {
      const [pPull, pNow, pDev] = shown;
      const zoomIn = ease(span(pDev, 0, ZOOM_TO));
      const panOut = pan;
      // the steps already ease in time, so the first poses follow them linearly
      let pose = lerpPose(coverPose, laptopPose, pPull);
      pose = lerpPose(pose, nowPose, pNow);
      pose = lerpPose(pose, zoomPose, zoomIn);
      pose = lerpPose(pose, readPose, panOut);
      pose = lerpPose(pose, shutPose, 1 - (1 - LEAN * overShown) * (1 - ease(span(closing, 0, 0.32))));
      pose = lerpPose(pose, notePose, ease(span(closing, 0.5, 0.92)));
      applyPose(camera, pose);
      camera.updateMatrixWorld();

      // closing: the display goes dark, the lid comes down, the laptop is pushed back
      const dark = ease(span(closing, 0.05, 0.2));
      const shut = ease(span(closing, 0.18, 0.5));
      const theta = lidOpen + (Math.PI / 2 - lidOpen) * shut;
      lid.rotation.x = theta;
      lid.position.y = lidY + LID_LIFT * smooth(span(THREE.MathUtils.radToDeg(theta), 50, 90));
      const back = ease(span(closing, 0.46, 0.78));
      laptop.position.z = -LAPTOP_BACK * back;
      shadow.position.z = -0.01 - LAPTOP_BACK * back;
      screenMat.color.copy(screenBg).multiplyScalar(1 - dark);
      screenLight.intensity = 0.9 * (1 - dark);
      screenEl.style.opacity = (1 - dark).toFixed(4);
      screenEl.style.visibility = dark >= 1 ? 'hidden' : '';
      if (keysMat) keysMat.emissiveIntensity = 0.9 * ease(span(pDev, 0.04, 0.2)) * (1 - dark);

      terminal.update(playT, cvScroll, closing > 0.005);
      explode(exploded);
      // slides change one after another: old fades out, then the new one fades in
      const devSwap = ease(span(pDev, 0.0, 0.025));
      screenEl.style.setProperty('--glare', ease(pPull).toFixed(4));
      // the room mirrored faintly in the panel, drifting as the camera moves
      screenEl.style.setProperty('--refl-x', `${(50 + (pose.az - screenAz) * 90).toFixed(2)}%`);
      screenEl.style.setProperty('--refl-y', `${(50 - (pose.el - screenEl0) * 90).toFixed(2)}%`);
      // dark behind the chapter text only while a text is shown, never over the zoomed terminal
      const devText = ease(span(panOut, 0.5, 1)) * (1 - ease(span(closing, 0, 0.18)));
      const scrim = Math.max(ease(span(pNow, 0.3, 0.8)) * (1 - zoomIn), devText);
      document.documentElement.style.setProperty('--scrim', scrim.toFixed(4));
      screenEl.style.setProperty('--hero-o', (1 - ease(span(pNow, 0.1, 0.4))).toFixed(4));
      screenEl.style.setProperty('--now-o', (ease(span(pNow, 0.45, 0.8)) * (1 - devSwap)).toFixed(4));
      screenEl.style.setProperty('--term-o', ease(span(pDev, 0.012, 0.04)).toFixed(4));
      document.documentElement.style.setProperty('--p-now', ease(span(pNow, 0.4, 1)).toFixed(4));
      document.documentElement.style.setProperty('--p-dev', devText.toFixed(4));
      composer.render();
      if (dark < 1) mapScreen();
      // the links on the note follow the sheet; usable once the camera is there
      const noteOn = closing > 0.5;
      noteLinks.classList.toggle('is-on', closing >= 1);
      if (noteOn) {
        const quad = noteCorners.map((p) => {
          projected.copy(p).project(camera);
          return [((projected.x + 1) / 2) * vw, ((1 - projected.y) / 2) * vh];
        }) as Quad;
        noteLinks.style.transform = quadToMatrix3d(NOTE_W, NOTE_H, quad);
      }
      dirty = false;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
