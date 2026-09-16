# CollectMind

<div style="text-align: center">
<img src="./docs/images/icon_origin.png"/>
</div>

CollectMind is an AI-powered Bookmark Collection which helps you build your own knowledge base.

## 1. Main Features
* Manage your bookmarks by topic
* Bookmark the current webpage
* Automatically summarize webpage content
* (RAG) Retrieval-augmented AI chat based on topics, with clickable source citations
* AI chat based on a specific webpage
* **Ask across your entire collection** — a "Library" chat mode that searches every topic at once, so you don't need to remember which topic you filed something under
* Auto-synthesized topic-level summaries, kept fresh as pages are added
* Streaming AI responses
* Backup and restore
* Everything runs on-device — no servers, no API keys, no data leaving your browser

## 2. How it works

CollectMind runs entirely on Chrome's built-in AI (Gemini Nano) plus a small local embedding model — nothing is sent to a server.

* **Summarizing & chatting**: the [Summarizer](https://developer.chrome.com/docs/ai/summarizer-api) and [Prompt](https://developer.chrome.com/docs/ai/prompt-api) APIs handle page summaries and conversational answers on-device.
* **Retrieval (RAG)**: saved pages are split into chunks and embedded locally with [Transformers.js](https://huggingface.co/docs/transformers.js) (`Xenova/multilingual-e5-small`, works well for mixed English/Chinese content), running in a dedicated Web Worker. When you chat, only the most relevant chunks are retrieved and fed to the model — instead of stuffing every saved page into the prompt, which used to blow past the model's context window once a topic had more than a handful of pages.
* **Storage**: topics, pages, chat history, and the chunk/embedding index all live in IndexedDB (via Dexie) on your machine.

Check indexing status and rebuild the search index from **Settings**.

## 3. How to build & run
> ⚠️ The AI features rely on Chrome built-in AI capabilities, so the minimum required version is **Chrome 138**, and the on-device model has real hardware requirements: **≥22GB free disk space**, plus either a GPU with **>4GB VRAM** or **16GB+ RAM and 4+ CPU cores**. If a status card in Settings shows "Unavailable", open `chrome://on-device-internals` for the exact reason (most commonly disk space).

1. clone this repo
2. ```npm install && npm run build```
3. Load the ```/dist``` directory in Chrome as an unpacked extension.
4. Click the extension's icon to open CollectMind.

The first time you summarize a page or chat, Chrome will prompt to download its on-device model (a few GB), and the embedding model (~120MB) will download in the background — both are cached afterward and don't require network access again.

## 4. Screenshots

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 1. Start-Page </figcaption>
  <img src="./docs/images/1.png" width="200">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 2. Create a Topic </figcaption>
  <img src="./docs/images/2.png" width="200">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 3. Topic List </figcaption>
  <img src="./docs/images/3.png" width="200">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 4. Saved Pages List </figcaption>
  <img src="./docs/images/4.png" width="200">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 5. Page Summary (ai) </figcaption>
  <img src="./docs/images/5.png" width="400">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 6. Summary Details </figcaption>
  <img src="./docs/images/6.png" width="400">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 7. AI chat based on topics </figcaption>
  <img src="./docs/images/7.png" width="200">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 8. AI chat based on a specific webpage </figcaption>
  <img src="./docs/images/8.png" width="400">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 9. Settings </figcaption>
  <img src="./docs/images/9.png" width="200">
</figure>
