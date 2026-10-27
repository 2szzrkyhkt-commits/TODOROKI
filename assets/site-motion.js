/* Let readers pause decorative motion, including reduced-motion preferences. */
(() => {
  const videos = [...document.querySelectorAll('.hero-video, .end-video video')];
  const hero = document.querySelector('.hero');
  if (!hero || !videos.length) return;
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = preference.matches;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'motion-toggle';
  function apply() {
    button.textContent = paused ? '背景動画を再生' : '背景動画を停止';
    videos.forEach(video => {
      video.dataset.motionPaused = String(paused);
      if (paused) video.pause();
      else { const attempt = video.play(); if (attempt) attempt.catch(() => {}); }
    });
  }
  videos.forEach(video => video.addEventListener('play', () => { if (paused) video.pause(); }));
  button.addEventListener('click', () => { paused = !paused; apply(); });
  preference.addEventListener('change', e => { paused = e.matches; apply(); });
  hero.append(button);
  apply();
})();
