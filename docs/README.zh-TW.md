# CollectMind

<p align="center">
  <a href="../README.md">English</a> |
  <a href="./README.de.md">Deutsch</a> |
  <a href="./README.fr.md">Français</a> |
  <a href="./README.ja.md">日本語</a> |
  <a href="./README.es.md">Español</a> |
  <a href="./README.zh-CN.md">简体中文</a> |
  <b>繁體中文</b>
</p>

<div style="text-align: center">
<img src="./images/icon_origin.png"/>
</div>

CollectMind 是一款由 AI 驅動的書籤收藏工具,協助你打造屬於自己的知識庫。

**所有功能完全在本機裝置上執行。** 摘要生成、檢索與聊天全部由 Chrome 內建的 Gemini Nano,以及運行在瀏覽器內的本機 embedding 模型完成——沒有後端伺服器、不需要 API key、也不需要註冊帳號。你的書籤、網頁內容與聊天紀錄都不會離開你的裝置。唯一刻意保留的例外是備份功能:如果你選擇備份到 Google 雲端硬碟,資料會直接從瀏覽器傳輸到**你自己的**雲端硬碟空間——CollectMind 全程不會經手、也看不到這些資料。

## 1. 主要功能
* 依主題管理你的書籤
* 收藏目前開啟的網頁
* 自動生成網頁內容摘要
* (RAG)基於檢索增強的主題式 AI 聊天,支援可點擊的引用來源
* 針對特定網頁的 AI 聊天
* **跨越整個收藏內容提問** —— 一個「Library」聊天模式,一次搜尋所有主題,不用費心記住某項內容歸類在哪個主題底下
* 自動生成並持續更新的主題摘要,新增網頁時會同步更新
* AI 回覆支援串流輸出
* 支援備份與還原,可儲存到本機檔案,也可儲存到你自己的 Google 雲端硬碟(支援多份備份快照,可任選其一還原)

## 2. 運作方式

CollectMind 完全仰賴 Chrome 內建 AI(Gemini Nano)與一個輕量的本機 embedding 模型運作——不會將任何資料傳送到伺服器。

* **摘要與聊天**:[Summarizer](https://developer.chrome.com/docs/ai/summarizer-api) 與 [Prompt](https://developer.chrome.com/docs/ai/prompt-api) API 在裝置端完成網頁摘要與對話式回覆。
* **檢索(RAG)**:已儲存的網頁會被切分成多個文字區塊,並透過 [Transformers.js](https://huggingface.co/docs/transformers.js)(採用 `Xenova/multilingual-e5-small` 模型,對中英文混合內容效果良好)在專屬的 Web Worker 中於本機產生向量。聊天時只會檢索最相關的文字區塊並交給模型——而不是把每個已儲存的網頁整篇塞進 prompt,後者在某個主題底下網頁數量稍微增加時,就很容易超出模型的內容視窗上限。
* **資料儲存**:主題、網頁、聊天紀錄以及文字區塊/向量索引皆儲存於你裝置本機的 IndexedDB 中(透過 Dexie 管理)。

可以在**設定**中檢視索引狀態,並重新建立搜尋索引。

## 3. 建置與執行
> ⚠️ AI 相關功能仰賴 Chrome 內建 AI 能力,因此最低需要 **Chrome 138** 版本;裝置端模型對硬體也有實際需求:**至少 22GB 的可用磁碟空間**,並需搭配**顯示記憶體超過 4GB 的 GPU**,或是 **16GB 以上記憶體 + 4 核以上 CPU** 兩者擇一。若設定頁面中某個狀態卡片顯示「Unavailable」,可開啟 `chrome://on-device-internals` 查看確切原因(最常見的是磁碟空間不足)。

1. 複製(clone)此儲存庫
2. ```npm install && npm run build```
3. 在 Chrome 中以「載入未封裝項目」的方式載入 ```/dist``` 目錄。
4. 點擊擴充功能圖示以開啟 CollectMind。

第一次產生摘要或開始聊天時,Chrome 會提示下載其裝置端模型(數 GB 大小),embedding 模型(約 120MB)則會在背景下載——兩者下載完成後都會被快取,之後便不再需要網路連線。

## 4. 截圖

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 1. 起始頁面 </figcaption>
  <img src="./images/1.png" width="200">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 2. 建立主題 </figcaption>
  <img src="./images/2.png" width="200">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 3. 主題列表 </figcaption>
  <img src="./images/3.png" width="200">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 4. 已儲存網頁列表 </figcaption>
  <img src="./images/4.png" width="200">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 5. 網頁摘要(AI) </figcaption>
  <img src="./images/5.png" width="400">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 6. 摘要詳情 </figcaption>
  <img src="./images/6.png" width="400">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 7. 基於主題的 AI 聊天 </figcaption>
  <img src="./images/7.png" width="200">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 8. 針對特定網頁的 AI 聊天 </figcaption>
  <img src="./images/8.png" width="400">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 9. 跨全部收藏內容提問 </figcaption>
  <img src="./images/11.png" width="200">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 10. 設定(本機模型) </figcaption>
  <img src="./images/9.png" width="200">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 11. 設定(備份與雲端) </figcaption>
  <img src="./images/10.png" width="200">
</figure>
