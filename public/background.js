chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }
});

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status !== "complete" || !tab.url) return;
  try {
    const shouldEnable =
      tab.url.startsWith("https://") || tab.url.startsWith("http://");
      chrome.sidePanel.setOptions({
      tabId,
      path: "index.html",
      enabled: shouldEnable
    });
  } catch (e) {
    console.debug("sidePanel API unavailable", e);
  }
});
