import './styles.css';

const root = document.documentElement;
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
  import('./scene/stage')
    .then(({ initStage }) => initStage(canvas, screen))
    .catch((err) => {
      console.error(err);
      root.classList.remove('stage-on', 'is-staged');
    });
}
