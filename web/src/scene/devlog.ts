/**
 * Dev only (/?log): measures on the visitor's device and sends it every 2 s to a
 * collector on the dev machine (port 5464): frame intervals, the frames the player
 * had to stand in for (frames.ts) and decode times.
 */
type FStats = { draws: number; standIn: number; unfetched: number; decodes: number; decodeMs: number; decodeMax: number; budget: number };

export function startDevLog() {
  const url = `${location.protocol}//${location.hostname}:5464/log`;
  // trials: /?log&noscreen hides the DOM on the display (hero, terminal, CV window, reflection),
  // /?log&nograin the film grain, /?log&noframes (frames.ts) keeps the first frame
  const q = new URLSearchParams(location.search);
  const css = [
    q.has('noscreen') && '.screen { visibility: hidden !important; }',
    q.has('nograin') && '.stage__grain { display: none !important; }',
    q.has('norefl') && '.screen__refl, .screen__sheen { display: none !important; }',
    // the reflection as it was before 19.11. (blend mode screen, no own layers)
    q.has('oldrefl') && '.screen__refl { mix-blend-mode: screen; will-change: auto !important; } .screen__sheen { will-change: auto !important; }',
    // without the Firefox filter on the display (styles.css)
    q.has('nofilter') && 'html.is-staged .screen { filter: none !important; }',
  ].filter(Boolean);
  if (css.length) document.head.appendChild(document.createElement('style')).textContent = css.join('\n');
  // /?log&cycle: variants of the display's layers in turn, 7 s each, with a large letter in the
  // corner, so one look tells which of them renders the text on the display cleanly
  if (q.has('cycle')) {
    const variants: [string, string][] = [
      ['A', ''],
      ['B', '.screen__refl { mix-blend-mode: screen; will-change: auto !important; } .screen__sheen { will-change: auto !important; }'],
      ['C', '.screen__refl, .screen__sheen { display: none !important; }'],
      ['D', '.stage__grain { display: none !important; }'],
      ['E', 'html.is-staged .screen { will-change: auto !important; }'],
      ['F', 'html.is-staged .screen { opacity: 0.999 !important; }'],
      ['G', 'html.is-staged .screen { filter: brightness(1.001) !important; }'],
    ];
    const style = document.head.appendChild(document.createElement('style'));
    const label = document.body.appendChild(document.createElement('div'));
    label.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:99;font:700 64px/1 sans-serif;color:#ff0;text-shadow:0 0 6px #000';
    let k = 0;
    const show = () => {
      const [name, rule] = variants[k % variants.length];
      style.textContent = rule;
      label.textContent = name;
      k++;
    };
    show();
    setInterval(show, 7000);
  }
  const trial = ['noscreen', 'nograin', 'norefl', 'noframes', 'half', 'noxfade', 'nocv', 'oldrefl', 'nofilter'].filter((k) => q.has(k)).join(',');
  const id = Math.random().toString(36).slice(2, 8);
  let last = performance.now();
  let gaps: number[] = [];
  const tick = (now: number) => {
    gaps.push(now - last);
    last = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  let longTasks = 0;
  let longMs = 0;
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        longTasks++;
        longMs += e.duration;
      }
    }).observe({ type: 'longtask', buffered: true });
  } catch {
    /* not in Safari */
  }
  setInterval(() => {
    const g = gaps;
    gaps = [];
    if (!g.length) return;
    const sorted = [...g].sort((a, b) => a - b);
    const med = sorted[sorted.length >> 1];
    const view = (window as unknown as { __view?: { seg: string; u: number } }).__view;
    const body = {
      id,
      trial,
      t: Math.round(performance.now()),
      ua: navigator.userAgent,
      dpr: devicePixelRatio,
      vw: innerWidth,
      vh: innerHeight,
      seg: view ? `${view.seg} ${view.u.toFixed(2)}` : '',
      frames: g.length,
      median: +med.toFixed(1),
      // a frame interval this much longer than the display's is a dropped frame
      over1_5: g.filter((x) => x > med * 1.5).length,
      over2_5: g.filter((x) => x > med * 2.5).length,
      max: Math.round(sorted[sorted.length - 1]),
      longTasks,
      longMs: Math.round(longMs),
      fstats: (window as unknown as { __fstats?: FStats[] }).__fstats,
    };
    fetch(url, { method: 'POST', body: JSON.stringify(body), keepalive: true }).catch(() => {});
  }, 2000);
}
