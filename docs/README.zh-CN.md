# CollectMind

<p align="center">
  <a href="../README.md">English</a> |
  <a href="./README.de.md">Deutsch</a> |
  <a href="./README.fr.md">Français</a> |
  <a href="./README.ja.md">日本語</a> |
  <a href="./README.es.md">Español</a> |
  <b>简体中文</b> |
  <a href="./README.zh-TW.md">繁體中文</a>
</p>

<div style="text-align: center">
<img src="./images/icon_origin.png"/>
</div>

CollectMind 是一款 AI 驱动的书签收藏工具,帮助你构建属于自己的知识库。

**所有功能完全在本地设备上运行。** 摘要生成、检索和聊天全部由 Chrome 内置的 Gemini Nano 以及运行在浏览器内的本地 embedding 模型完成——没有后端服务器、不需要 API key、也不需要注册账号。你的书签、网页内容和聊天记录都不会离开你的设备。唯一有意为之的例外是备份功能:如果你选择备份到 Google Drive,数据会直接从浏览器传输到**你自己的** Drive 存储空间——CollectMind 全程不经手、也看不到这些数据。

## 1. 主要功能
* 按主题管理你的书签
* 收藏当前打开的网页
* 自动生成网页内容摘要
* (RAG)基于检索增强的主题式 AI 聊天,支持可点击的引用来源
* 针对特定网页的 AI 聊天
* **跨越整个收藏夹提问** —— 一个 "Library" 聊天模式,一次性搜索所有主题,不用再费心记住某个内容归到了哪个主题下
* 自动生成并保持更新的主题级摘要,新增网页后会自动同步
* AI 回复支持流式输出
* 支持备份与恢复,可以存到本地文件,也可以存到你自己的 Google Drive(支持多份备份快照,可任选其一恢复)

## 2. 工作原理

CollectMind 完全基于 Chrome 内置 AI(Gemini Nano)和一个轻量的本地 embedding 模型运行——不会向任何服务器发送数据。

* **摘要与聊天**:[Summarizer](https://developer.chrome.com/docs/ai/summarizer-api) 和 [Prompt](https://developer.chrome.com/docs/ai/prompt-api) API 在本地设备上完成网页摘要和对话式回答。
* **检索(RAG)**:已保存的网页会被切分成若干文本块,并通过 [Transformers.js](https://huggingface.co/docs/transformers.js)(使用 `Xenova/multilingual-e5-small` 模型,对中英文混合内容效果良好)在专用的 Web Worker 中本地生成向量。聊天时只会检索最相关的文本块并提交给模型——而不是把每个保存的网页整篇塞进 prompt 里,后者在一个主题下网页稍微多一点时,就很容易超出模型的上下文窗口。
* **数据存储**:主题、网页、聊天记录以及文本块/向量索引都保存在你设备本地的 IndexedDB 中(通过 Dexie 管理)。

可以在**设置**里查看索引状态,并重新构建搜索索引。

## 3. 构建与运行
> ⚠️ AI 相关功能依赖 Chrome 内置 AI 能力,因此最低需要 **Chrome 138** 版本,同时端侧模型对硬件也有实际要求:**至少 22GB 的磁盘可用空间**,以及**显存超过 4GB 的 GPU**,或者 **16GB 以上内存 + 4 核以上 CPU** 二选一满足。如果设置页面里某个状态卡片显示 "Unavailable",打开 `chrome://on-device-internals` 可以看到具体原因(最常见的是磁盘空间不足)。

1. 克隆本仓库
2. ```npm install && npm run build```
3. 在 Chrome 中以"加载已解压的扩展程序"方式加载 ```/dist``` 目录。
4. 点击扩展图标打开 CollectMind。

第一次生成摘要或发起聊天时,Chrome 会提示下载其端侧模型(几个 GB 大小),embedding 模型(约 120MB)会在后台下载——两者下载完成后都会被缓存,之后无需再联网。

## 4. 截图

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 1. 起始页面 </figcaption>
  <img src="./images/1.png" width="200">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 2. 创建主题 </figcaption>
  <img src="./images/2.png" width="200">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 3. 主题列表 </figcaption>
  <img src="./images/3.png" width="200">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 4. 已保存网页列表 </figcaption>
  <img src="./images/4.png" width="200">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 5. 网页摘要(AI) </figcaption>
  <img src="./images/5.png" width="400">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 6. 摘要详情 </figcaption>
  <img src="./images/6.png" width="400">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 7. 基于主题的 AI 聊天 </figcaption>
  <img src="./images/7.png" width="200">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 8. 针对特定网页的 AI 聊天 </figcaption>
  <img src="./images/8.png" width="400">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 9. 跨全部收藏夹提问 </figcaption>
  <img src="./images/11.png" width="200">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 10. 设置(本地模型) </figcaption>
  <img src="./images/9.png" width="200">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 11. 设置(备份与云端) </figcaption>
  <img src="./images/10.png" width="200">
</figure>
