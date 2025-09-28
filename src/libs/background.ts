// background.ts

import db from "./db.ts";

async function ensureOffscreen(path = "offscreen.html") {
    const url = chrome.runtime.getURL(path);
    const ctx = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"], documentUrls: [url] });
    if (ctx.length === 0) {
        await chrome.offscreen.createDocument({
            url: path,
            reasons: ["DOM_PARSER"],
            justification: "Summarize page text for saved pages",
        });
    }
}

async function waitOffscreenReady(timeoutMs = 5000) {
    await ensureOffscreen("offscreen.html");
    return new Promise<void>((resolve, reject) => {
        let settled = false;
        const t = setTimeout(() => {
            if (!settled) { settled = true; reject(new Error("Offscreen not ready (timeout)")); }
        }, timeoutMs);

        chrome.runtime.sendMessage({ target: "offscreen", type: "PING" }, (resp) => {
            const le = chrome.runtime.lastError;
            if (!settled) {
                settled = true; clearTimeout(t);
                if (le) reject(new Error(le.message ?? String(le)));
                else if (!resp) reject(new Error("No response to PING"));
                else resolve();
            }
        });
    });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "SUMMARIZE_SAVED_PAGE_WITH_TEXT") {
        (async () => {
            const { pageId, url, title, text } = msg.payload as { pageId: number; url: string; title: string; text: string; };

            try {
                await waitOffscreenReady().catch(() => ensureOffscreen("offscreen.html")); // 容错

                chrome.runtime.sendMessage(
                    { target: "offscreen", type: "OFFSCREEN_SUMMARIZE", payload: { text, url, title } },
                    async (resp) => {
                        const le = chrome.runtime.lastError;
                        if (le) {
                            await db.updatePageSummary(pageId, "Summary failed.");
                            sendResponse({ ok: false, error: le.message ?? String(le) });
                            return;
                        }
                        if (!resp) {
                            await db.updatePageSummary(pageId, "Summary failed.");
                            sendResponse({ ok: false, error: "No response from offscreen" });
                            return;
                        }
                        const ok = !!resp.ok;
                        const summary = ok ? (resp.summary || "No summary.") : `Summary failed. ${resp.error ?? ""}`;
                        await db.updatePageSummary(pageId, summary);
                        sendResponse({ ok });
                    }
                );
            } catch (e: any) {
                await db.updatePageSummary(pageId, "Summary failed.");
                sendResponse({ ok: false, error: e?.message ?? String(e) });
            }
        })();
        return true;
    }
});
