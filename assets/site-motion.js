/* Play decorative videos only while they are visible. */
(() => {
  const videos = document.querySelectorAll('.hero-video, .end-video video');
  const visible = new Set();
  function update(video) {
    if (document.hidden || !visible.has(video)) {
      video.pause();
    } else {
      video.play().catch(() => {});
    }
  }
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) visible.add(entry.target);
      else visible.delete(entry.target);
      update(entry.target);
    }
  });
  videos.forEach(video => observer.observe(video));
  document.addEventListener('visibilitychange', () => videos.forEach(update));
})();
