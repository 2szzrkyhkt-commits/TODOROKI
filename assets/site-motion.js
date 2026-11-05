/* Keep the muted, looping TODOROKI bull background video playing. */
(() => {
  const videos = document.querySelectorAll('.hero-video, .end-video video');
  videos.forEach(video => {
    video.autoplay = true;
    video.loop = true;
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.removeAttribute('controls');
    function play() {
      if (document.hidden) return;
      const attempt = video.play();
      if (attempt && typeof attempt.catch === 'function') attempt.catch(() => {});
    }
    if (video.readyState >= 2) play();
    else video.addEventListener('canplay', play, { once: true });
    video.addEventListener('pause', () => { if (!document.hidden) play(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) play(); });
  });
})();
