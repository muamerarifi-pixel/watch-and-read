// Runs inside the page itself (MAIN world), before Facebook/Instagram scripts load.
// While a video is "kept" (floating), the site's own code is not allowed to pause,
// reload or unload it — so opening comments, scrolling away or switching tabs
// no longer stops the video. The user can still pause from the floating window.
(() => {
  if (window.__watchReadMain) return;
  window.__watchReadMain = true;

  const isKept = (el) =>
    !!el &&
    typeof el.getAttribute === "function" &&
    el.getAttribute("data-wr-keep") === "1" &&
    document.documentElement &&
    document.documentElement.getAttribute("data-wr-lock") === "1";

  const P = HTMLMediaElement.prototype;
  const origPause = P.pause;
  const origLoad = P.load;

  P.pause = function pause() {
    if (isKept(this)) return;
    return origPause.apply(this, arguments);
  };

  P.load = function load() {
    if (isKept(this)) return;
    return origLoad.apply(this, arguments);
  };

  // Block the site from emptying the source of a kept video.
  for (const prop of ["src", "srcObject"]) {
    const desc = Object.getOwnPropertyDescriptor(P, prop);
    if (!desc || !desc.set) continue;
    Object.defineProperty(P, prop, {
      configurable: true,
      enumerable: desc.enumerable,
      get: desc.get,
      set(value) {
        if (isKept(this) && !value) return;
        return desc.set.call(this, value);
      },
    });
  }

  const origRemoveAttr = Element.prototype.removeAttribute;
  Element.prototype.removeAttribute = function removeAttribute(name) {
    if (this instanceof HTMLMediaElement && isKept(this) && String(name).toLowerCase() === "src") return;
    return origRemoveAttr.apply(this, arguments);
  };

  // Make the patched functions look native to the page.
  const patched = new Map([
    [P.pause, "pause"],
    [P.load, "load"],
    [Element.prototype.removeAttribute, "removeAttribute"],
  ]);
  const origToString = Function.prototype.toString;
  Function.prototype.toString = function toString() {
    if (patched.has(this)) return `function ${patched.get(this)}() { [native code] }`;
    return origToString.apply(this, arguments);
  };
  patched.set(Function.prototype.toString, "toString");
})();
