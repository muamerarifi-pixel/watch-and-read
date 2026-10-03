importScripts("inject.js");

// Keyboard shortcut (Alt+Shift+P by default) – float the playing video on the current tab.
// Works on Facebook/Instagram, and as a simple "float video" on any other site too.
async function floatActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return "none";
  try {
    const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: floatInPage });
    return (results && results[0] && results[0].result) || "none";
  } catch (e) {
    return "blocked";
  }
}

chrome.commands.onCommand.addListener((command) => {
  if (command === "float-video") floatActiveTab();
});

self.floatActiveTab = floatActiveTab;
self.floatInPage = floatInPage;
