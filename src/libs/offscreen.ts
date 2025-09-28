import {summarize} from "./summarizer.ts";

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.target === "offscreen" && msg?.type === "OFFSCREEN_SUMMARIZE") {

        (async () => {
            try {
                const { text, url, title } = msg.payload as { text: string; url: string; title: string };
                const out = await summarize({ text: text || `${title} — ${new URL(url).hostname}` });
                console.log("summarized:", out?.slice(0, 120));
                sendResponse({ ok: true, summary: String(out || "").trim() });
            } catch (e: any) {
                console.error("offscreen failed:", e?.message ?? String(e));
                sendResponse({ ok: false, error: e?.message ?? String(e) });
            }
        })();

        return true;
    }
});

chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
    if (msg?.target === "offscreen" && msg?.type === "PING") {
        sendResponse({ ok: true });
    }
});
