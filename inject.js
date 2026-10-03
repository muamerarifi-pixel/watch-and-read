// Shared by the popup and the background worker: runs inside the page.
function floatInPage() {
  if (window.__watchRead) return window.__watchRead.floatBest();
  if (document.pictureInPictureElement) {
    document.exitPictureInPicture().catch(() => {});
    return "exited";
  }
  const vids = [...document.querySelectorAll("video")].filter((v) => v.videoWidth > 0);
  const playing = vids.filter((v) => !v.paused && !v.ended);
  const pool = playing.length ? playing : vids;
  const area = (v) => {
    const r = v.getBoundingClientRect();
    return Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0)) *
           Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
  };
  const v = pool.sort((a, b) => area(b) - area(a))[0];
  if (!v) return "none";
  v.removeAttribute("disablepictureinpicture");
  v.requestPictureInPicture().catch(() => {});
  return "floating";
}

