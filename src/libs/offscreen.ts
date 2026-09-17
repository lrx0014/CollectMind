import {summarize} from "./summarizer.ts";
import {indexSavedPage} from "./rag/indexer.ts";
import {synthesizeTopicSummary} from "./rag/topic-summary.ts";

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.target === "offscreen" && msg?.type === "OFFSCREEN_SYNTHESIZE_TOPIC") {
        (async () => {
            try {
                const { topicId } = msg.payload as { topicId: number };
                const summary = await synthesizeTopicSummary(topicId);
                sendResponse({ ok: true, summary });
            } catch (e: any) {
                console.error("offscreen topic synthesis failed:", e?.message ?? String(e));
                sendResponse({ ok: false, error: e?.message ?? String(e) });
            }
        })();

        return true;
    }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.target === "offscreen" && msg?.type === "OFFSCREEN_INDEX_PAGE") {
        (async () => {
            try {
                const { pageId, topicId, text } = msg.payload as { pageId: number; topicId: number; text: string };
                const result = await indexSavedPage({ pageId, topicId, text });
                sendResponse({ ok: true, chunkCount: result.chunkCount, skipped: result.skipped });
            } catch (e: any) {
                console.error("offscreen indexing failed:", e?.message ?? String(e));
                sendResponse({ ok: false, error: e?.message ?? String(e) });
            }
        })();

        return true;
    }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.target === "offscreen" && msg?.type === "OFFSCREEN_SUMMARIZE") {

        (async () => {
            try {
                const { text, url, title } = msg.payload as { text: string; url: string; title: string };
                const out = await summarize({
                    text: text || `${title} — ${new URL(url).hostname}`,
                    type: 'key-points',
                    format: 'plain-text',
                    length: 'long',
                });
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
