import './styles.css';
import { revealMail } from './mail';

const root = document.documentElement;

revealMail();
const canvas = document.querySelector<HTMLCanvasElement>('.stage__gl');
const screen = document.querySelector<HTMLElement>('#screen');

/** Visible part of the (cover-sized) screen equals the viewport. */
function setViewSize() {
  root.style.setProperty('--view-w', `${root.clientWidth}px`);
  root.style.setProperty('--view-h', `${root.clientHeight}px`);
}

if (root.classList.contains('stage-on') && canvas && screen) {
  setViewSize();
  window.addEventListener('resize', setViewSize);
  // dev only: /?gl shows the real-time three.js scene the camera poses are set up in
  const gl = import.meta.env.DEV && new URLSearchParams(location.search).has('gl');
  (gl ? import('./scene/stage-gl') : import('./scene/stage'))
    .then(({ initStage }) => initStage(canvas, screen))
    .catch((err) => {
      console.error(err);
      root.classList.remove('stage-on', 'is-staged');
    });
}
