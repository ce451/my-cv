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

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
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
    }
  });
  if (!screenMesh) throw new Error('Screen mesh missing in model');

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

  // camera poses
  const laptopPose: Pose = { target: new THREE.Vector3(0.0, 0.1, -0.035), r: 0.98, az: -0.5, el: 0.4, up: new THREE.Vector3(0, 1, 0) };
  const nowPose: Pose = { target: new THREE.Vector3(-0.15, 0.095, -0.03), r: 1.04, az: -0.3, el: 0.3, up: new THREE.Vector3(0, 1, 0) };
  const screenAz = Math.atan2(normal.x, normal.z);
  const screenEl0 = Math.asin(normal.y);
  let coverPose: Pose;
  let zoomPose: Pose;
  let readPose: Pose;
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
  const CV_FROM = 0.17;
  let playStart: number | null = null;
  let pan = 0;

  /** Pose from a viewing angle so that the display's bounding box lands at (fx, fy) with width fw (viewport fractions). */
  function framePose(az: number, el: number, fx: number, fy: number, fw: number, upVec: THREE.Vector3): Pose {
    const pose: Pose = { target: center.clone(), r: 0.6, az, el, up: upVec.clone() };
    const right = new THREE.Vector3();
    const camUp = new THREE.Vector3();
    for (let i = 0; i < 6; i++) {
      applyPose(camera, pose);
      camera.updateMatrixWorld();
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const c of corners) {
        projected.copy(c).project(camera);
        x0 = Math.min(x0, projected.x); x1 = Math.max(x1, projected.x);
        y0 = Math.min(y0, projected.y); y1 = Math.max(y1, projected.y);
      }
      pose.r *= (x1 - x0) / 2 / fw;
      const halfH = pose.r * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
      right.setFromMatrixColumn(camera.matrixWorld, 0);
      camUp.setFromMatrixColumn(camera.matrixWorld, 1);
      const dx = ((x0 + x1) / 2 + 1) / 2 - fx; // + means box is right of where it should be
      const dy = (1 - (y0 + y1) / 2) / 2 - fy;
      pose.target.addScaledVector(right, dx * 2 * halfH * camera.aspect).addScaledVector(camUp, -dy * 2 * halfH);
    }
    return pose;
  }

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
  // right before the next chapter the drawing on the display comes apart on its own;
  // scrolled back above that point it goes back together
  const apart = ScrollTrigger.create({ trigger: '#ch-dev', start: 'top 80%', end: 'top top' });
  const EXPLODE_MS = 1700;
  let exploded = 0;
  const tracks = [pull, now, dev];
  const shown = tracks.map(() => 0);

  // the page does not scroll while the session plays, so it cannot be skipped
  const root = document.documentElement;
  let prevDev = dev.progress;
  let locked = false;
  const lockScroll = (on: boolean) => {
    locked = on;
    root.classList.toggle('is-locked', on);
  };

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
    const k = 1 - Math.exp(-dt * 6);
    let moving = dirty;
    tracks.forEach((tr, i) => {
      const d = tr.progress - shown[i];
      if (Math.abs(d) > 1e-5) {
        shown[i] += d * k;
        moving = true;
      } else shown[i] = tr.progress;
    });
    // dev chapter: zoom onto the display by scrolling, then the recorded session
    // plays on its own with scrolling locked; after it the CV scrolls
    const raw = dev.progress;
    if (!locked && playStart === null && prevDev < PLAY_AT && raw >= PLAY_AT && raw < 1) {
      lockScroll(true);
      window.scrollTo({ top: dev.start + PLAY_AT * (dev.end - dev.start), behavior: 'instant' });
    }
    prevDev = dev.progress;
    const pDevNow = shown[2];
    const cvScroll = span(pDevNow, CV_FROM, 0.97);
    if (pDevNow < RESET_AT) playStart = null;
    else if (playStart === null && pDevNow >= PLAY_AT - 0.002) playStart = t;
    if (playStart !== null && cvScroll > 0 && t - playStart < sessionEnd) playStart = t - sessionEnd;
    const playT = playStart === null ? 0 : t - playStart;
    const panTarget = ease(span(playT, panFrom, panTo));
    if (Math.abs(panTarget - pan) > 1e-4) {
      pan += (panTarget - pan) * k;
      moving = true;
    } else pan = panTarget;
    if (locked && playStart !== null && playT >= sessionEnd) lockScroll(false);
    if (playStart !== null && playT < sessionEnd + 100) moving = true;
    const explodeTo = apart.progress > 0 ? 1 : 0;
    if (exploded !== explodeTo) {
      const step = (dt * 1000) / EXPLODE_MS;
      exploded = explodeTo > exploded ? Math.min(1, exploded + step) : Math.max(0, exploded - step);
      moving = true;
    }
    if (moving) {
      const [pPull, pNow, pDev] = shown;
      const zoomIn = ease(span(pDev, 0, ZOOM_TO));
      const panOut = pan;
      let pose = lerpPose(coverPose, laptopPose, ease(pPull));
      pose = lerpPose(pose, nowPose, ease(pNow));
      pose = lerpPose(pose, zoomPose, zoomIn);
      pose = lerpPose(pose, readPose, panOut);
      applyPose(camera, pose);
      camera.updateMatrixWorld();
      if (keysMat) keysMat.emissiveIntensity = 0.9 * ease(span(pDev, 0.04, 0.2));
      terminal.update(playT, cvScroll);
      explode(exploded);
      // slides change one after another: old fades out, then the new one fades in
      const devSwap = ease(span(pDev, 0.0, 0.025));
      screenEl.style.setProperty('--glare', ease(pPull).toFixed(4));
      // the room mirrored faintly in the panel, drifting as the camera moves
      screenEl.style.setProperty('--refl-x', `${(50 + (pose.az - screenAz) * 90).toFixed(2)}%`);
      screenEl.style.setProperty('--refl-y', `${(50 - (pose.el - screenEl0) * 90).toFixed(2)}%`);
      // dark behind the chapter text only while a text is shown, never over the zoomed terminal
      const scrim = Math.max(ease(span(pNow, 0.3, 0.8)) * (1 - zoomIn), ease(span(panOut, 0.5, 1)));
      document.documentElement.style.setProperty('--scrim', scrim.toFixed(4));
      screenEl.style.setProperty('--hero-o', (1 - ease(span(pNow, 0.1, 0.4))).toFixed(4));
      screenEl.style.setProperty('--now-o', (ease(span(pNow, 0.45, 0.8)) * (1 - devSwap)).toFixed(4));
      screenEl.style.setProperty('--term-o', ease(span(pDev, 0.012, 0.04)).toFixed(4));
      document.documentElement.style.setProperty('--p-now', ease(span(pNow, 0.4, 1)).toFixed(4));
      document.documentElement.style.setProperty('--p-dev', ease(span(panOut, 0.5, 1)).toFixed(4));
      composer.render();
      mapScreen();
      dirty = false;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
