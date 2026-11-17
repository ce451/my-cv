import './styles.css';

const root = document.documentElement;

// the address is in the HTML only base64-encoded (as content/cv.de.json has it), so harvesters miss it
for (const a of document.querySelectorAll<HTMLAnchorElement>('a[data-mail]')) {
  try {
    const address = atob(a.dataset.mail!);
    a.href = `mailto:${address}`;
    a.textContent = address;
  } catch {
    // keep the placeholder
  }
}
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
