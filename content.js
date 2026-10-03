// Watch & Read – content script (isolated world) for Facebook and Instagram.
(() => {
  if (window.__watchRead) return;

  const S = { autoFloat: true, muteOthers: true, hoverButton: true };
  chrome.storage.sync.get(S, (v) => Object.assign(S, v));
  chrome.storage.onChanged.addListener((changes) => {
    for (const k in changes) if (k in S) S[k] = changes[k].newValue;
    if (!S.hoverButton) hideButton();
  });

  const root = () => document.documentElement;
  let kept = null;

  // ---------- picking a video ----------
  const isPlaying = (v) => !v.paused && !v.ended && v.readyState > 2;

  function visibleArea(v) {
    const r = v.getBoundingClientRect();
    const w = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0));
    const h = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
    return w * h;
  }

  function bestVideo(requirePlaying) {
    const vids = [...document.querySelectorAll("video")].filter((v) => v.isConnected && v.videoWidth > 0);
    const playing = vids.filter(isPlaying);
    const pool = playing.length ? playing : requirePlaying ? [] : vids;
    let best = null, bestArea = -1;
    for (const v of pool) {
      const a = visibleArea(v);
      if (a > bestArea) { best = v; bestArea = a; }
    }
    return best;
  }

  // The video that belongs to the same post as the clicked element.
  function nearestVideo(el) {
    let n = el;
    for (let i = 0; i < 25 && n; i++) {
      n = n.parentElement;
      const v = n && n.querySelector && n.querySelector("video");
      if (v) return v;
    }
    return null;
  }

  // ---------- keep playing + float ----------
  function keep(v) {
    if (kept && kept !== v) release();
    kept = v;
    v.setAttribute("data-wr-keep", "1");
    root().setAttribute("data-wr-lock", "1");
    v.addEventListener("leavepictureinpicture", release, { once: true });
  }

  function release() {
    if (kept) kept.removeAttribute("data-wr-keep");
    kept = null;
    root().removeAttribute("data-wr-lock");
  }

  // Must be called synchronously from a click / shortcut (browser requires a user action).
  function float(v, quiet) {
    if (!v) {
      if (!quiet) toast("No video found on screen.");
      return false;
    }
    if (document.pictureInPictureElement === v) { keep(v); return true; }
    try {
      v.removeAttribute("disablepictureinpicture");
      v.disablePictureInPicture = false;
      const req = v.requestPictureInPicture();
      keep(v);
      req.then(() => {
        if (v.paused) v.play().catch(() => {});
        if (!quiet) toast("Video is floating — it keeps playing while you read the comments.");
      }).catch((err) => {
        release();
        toast("Couldn't float this video (" + (err && err.name ? err.name : "error") + "). Try the ⧉ button on the video.");
      });
      return true;
    } catch (err) {
      release();
      toast("Couldn't float this video. Try the ⧉ button on the video.");
      return false;
    }
  }

  // Exposed for the toolbar popup and the keyboard shortcut.
  window.__watchRead = {
    floatBest() {
      if (document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(() => {});
        return "exited";
      }
      return float(bestVideo(false)) ? "floating" : "none";
    },
  };

  // ---------- auto-float when a comment button is clicked ----------
  const COMMENT_RE = /(comment|koment|yorum|kommentar|comentar|commentaire|commenta)/i;
  const SKIP_RE = /(write|shkruaj|reply|përgjigj|add a comment|shto|send|dërgo|post|like|share|edit|delete|hide|report|filter|sort|most relevant|newest)/i;

  function isCommentTrigger(t) {
    if (t.closest('[contenteditable="true"], textarea, input, [role="textbox"], form')) return false;
    const labelled = t.closest("[aria-label]");
    const label = labelled ? labelled.getAttribute("aria-label") || "" : "";
    if (label && COMMENT_RE.test(label) && !SKIP_RE.test(label)) return true;
    const btn = t.closest('a, [role="button"], [role="link"]');
    if (btn) {
      const text = (btn.textContent || "").trim();
      if (text.length && text.length <= 40 && COMMENT_RE.test(text) && !SKIP_RE.test(text)) return true;
      const inner = btn.querySelector("[aria-label]");
      const il = inner ? inner.getAttribute("aria-label") || "" : "";
      if (il && COMMENT_RE.test(il) && !SKIP_RE.test(il)) return true;
    }
    return false;
  }

  window.addEventListener(
    "click",
    (e) => {
      if (!S.autoFloat || !e.isTrusted || e.button !== 0) return;
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (document.pictureInPictureElement) return; // already floating
      if (!isCommentTrigger(t)) return;
      let v = nearestVideo(t);
      if (!v || !isPlaying(v)) v = bestVideo(true);
      if (!v) return; // nothing playing → let the site behave normally
      float(v, false);
      // the click continues to the site, so the comments still open
    },
    true
  );

  // Silence the second copy of the video that Facebook opens in the post window.
  document.addEventListener(
    "play",
    (e) => {
      const v = e.target;
      if (!S.muteOthers || !kept || v === kept || !(v instanceof HTMLMediaElement)) return;
      v.muted = true;
      v.pause();
    },
    true
  );

  // ---------- UI: hover button + toast (shadow DOM so the site can't restyle it) ----------
  let host, shadow, btn, toastEl, hoverVideo = null, hideTimer = 0, rafPending = false;

  function ensureUI() {
    if (host || !document.body) return !!host;
    host = document.createElement("div");
    host.style.cssText = "position:fixed;inset:0 auto auto 0;width:0;height:0;z-index:2147483647;";
    shadow = host.attachShadow({ mode: "closed" });
    shadow.innerHTML = `
      <style>
        .btn{position:fixed;display:none;align-items:center;gap:6px;padding:6px 10px;border:0;border-radius:999px;
          background:rgba(20,20,24,.82);color:#fff;font:600 12px/1 system-ui,-apple-system,"Segoe UI",sans-serif;
          cursor:pointer;backdrop-filter:blur(6px);box-shadow:0 2px 10px rgba(0,0,0,.35);transition:background .15s}
        .btn:hover{background:rgba(24,119,242,.95)}
        .btn svg{width:14px;height:14px}
        .toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%) translateY(10px);opacity:0;
          max-width:min(420px,90vw);padding:10px 14px;border-radius:10px;background:rgba(20,20,24,.92);color:#fff;
          font:500 13px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.35);
          transition:opacity .2s,transform .2s;pointer-events:none;text-align:center}
        .toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
      </style>
      <button class="btn" title="Float this video so it keeps playing while you read comments">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><rect x="12" y="11" width="8" height="7" rx="1" fill="currentColor"/></svg>
        <span>Float &amp; keep playing</span>
      </button>
      <div class="toast"></div>`;
    btn = shadow.querySelector(".btn");
    toastEl = shadow.querySelector(".toast");
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (hoverVideo && document.pictureInPictureElement === hoverVideo) {
        document.exitPictureInPicture().catch(() => {});
      } else {
        float(hoverVideo, false);
      }
      hideButton();
    });
    btn.addEventListener("mouseenter", () => clearTimeout(hideTimer));
    document.body.appendChild(host);
    return true;
  }

  let toastTimer = 0;
  function toast(msg) {
    if (!ensureUI()) return;
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 3200);
  }

  function hideButton() {
    if (btn) btn.style.display = "none";
    hoverVideo = null;
  }

  function videoAt(x, y) {
    let best = null, bestArea = 0;
    for (const v of document.querySelectorAll("video")) {
      const r = v.getBoundingClientRect();
      if (r.width < 200 || r.height < 120) continue;
      if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
      const a = r.width * r.height;
      if (a > bestArea) { best = v; bestArea = a; }
    }
    return best;
  }

  function placeButton(v) {
    const r = v.getBoundingClientRect();
    const top = Math.max(8, r.top + 10);
    const left = Math.max(8, r.left + 10);
    btn.style.top = top + "px";
    btn.style.left = left + "px";
    btn.querySelector("span").textContent =
      document.pictureInPictureElement === v ? "Back to page" : "Float & keep playing";
    btn.style.display = "flex";
  }

  document.addEventListener(
    "mousemove",
    (e) => {
      if (!S.hoverButton || rafPending) return;
      rafPending = true;
      const x = e.clientX, y = e.clientY;
      requestAnimationFrame(() => {
        rafPending = false;
        if (!ensureUI()) return;
        const v = videoAt(x, y);
        if (v) {
          clearTimeout(hideTimer);
          hoverVideo = v;
          placeButton(v);
        } else if (hoverVideo) {
          clearTimeout(hideTimer);
          hideTimer = setTimeout(hideButton, 600);
        }
      });
    },
    { capture: true, passive: true }
  );
  window.addEventListener("scroll", () => { if (hoverVideo) placeButton(hoverVideo); }, { capture: true, passive: true });
})();
