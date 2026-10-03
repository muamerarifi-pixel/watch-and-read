const DEFAULTS = { autoFloat: true, muteOthers: true, hoverButton: true };

chrome.storage.sync.get(DEFAULTS, (s) => {
  for (const key of Object.keys(DEFAULTS)) {
    const box = document.getElementById(key);
    box.checked = !!s[key];
    box.addEventListener("change", () => chrome.storage.sync.set({ [key]: box.checked }));
  }
});

const status = document.getElementById("status");
document.getElementById("go").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let result = "none";
  try {
    const res = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: floatInPage });
    result = (res && res[0] && res[0].result) || "none";
  } catch (e) {
    result = "blocked";
  }
  status.textContent = {
    floating: "Floating — scroll and read the comments freely.",
    exited: "Video returned to the page.",
    none: "No video found on this tab.",
    blocked: "Chrome doesn't allow extensions on this page.",
  }[result] || "";
  if (result === "floating" || result === "exited") setTimeout(() => window.close(), 900);
});
