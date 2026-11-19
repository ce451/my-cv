import './styles.css';
import { revealMail } from './mail';

const root = document.documentElement;
// the watchdog in index.html: the script runs
root.setAttribute('data-boot', '');

revealMail();
const canvas = document.querySelector<HTMLCanvasElement>('.stage__gl');
const screen = document.querySelector<HTMLElement>('#screen');

/** Visible part of the (cover-sized) screen equals the viewport. */
function setViewSize() {
  root.style.setProperty('--view-w', `${root.clientWidth}px`);
  root.style.setProperty('--view-h', `${root.clientHeight}px`);
}

// dev only: /?log measures on the device and sends it to the dev machine (scene/devlog.ts)
if (import.meta.env.DEV && new URLSearchParams(location.search).has('log')) import('./scene/devlog').then((m) => m.startDevLog());

if (root.classList.contains('stage-on') && canvas && screen) {
  setViewSize();
  window.addEventListener('resize', setViewSize);
  import('./scene/stage')
    .then(({ initStage }) => initStage(canvas, screen))
    .catch((err) => {
      console.error(err);
      root.classList.remove('stage-on', 'is-staged');
    });
}
