# CollectMind

<p align="center">
  <a href="../README.md">English</a> |
  <a href="./README.de.md">Deutsch</a> |
  <a href="./README.fr.md">Français</a> |
  <b>日本語</b> |
  <a href="./README.es.md">Español</a> |
  <a href="./README.zh-CN.md">简体中文</a> |
  <a href="./README.zh-TW.md">繁體中文</a>
</p>

<div style="text-align: center">
<img src="./images/icon_origin.png"/>
</div>

CollectMind は、自分だけのナレッジベースを構築できる AI 搭載のブックマークコレクションです。

**すべての処理は完全にデバイス上で完結します。** 要約・検索・チャットはすべて、Chrome に内蔵された Gemini Nano とブラウザ内で動作するローカルの埋め込みモデルによって行われます——バックエンドサーバーも、API キーも、アカウント登録も一切不要です。ブックマークやページの内容、チャット履歴が端末の外に出ることはありません。唯一意図的な例外はバックアップ機能です。Google ドライブへのバックアップを選択した場合、データはブラウザから直接**あなた自身の**ドライブへ送られます——CollectMind がその間に介在したり、データを見たりすることは一切ありません。

## 1. 主な機能
* トピックごとにブックマークを整理
* 現在開いているページをブックマークに追加
* ウェブページの内容を自動要約
* (RAG) 検索拡張生成によるトピック単位の AI チャット。クリック可能な引用元付き
* 特定のウェブページに関する AI チャット
* **コレクション全体を横断して質問** ——すべてのトピックを一度に検索する「ライブラリ」チャットモード。どのトピックに保存したか覚えていなくても大丈夫
* トピックごとの要約を自動生成し、ページが追加されるたびに最新の状態を維持
* ストリーミング表示される AI の回答
* ローカルファイル、またはご自身の Google ドライブへのバックアップ・復元(複数のバックアップを保存でき、どれでも選んで復元可能)

## 2. 仕組み

CollectMind は、Chrome 内蔵の AI(Gemini Nano)と小型のローカル埋め込みモデルだけで完全に動作します——サーバーには一切データを送信しません。

* **要約とチャット**: [Summarizer](https://developer.chrome.com/docs/ai/summarizer-api) API と [Prompt](https://developer.chrome.com/docs/ai/prompt-api) API が、ページ要約と対話的な応答をデバイス上で処理します。
* **検索(RAG)**: 保存したページはチャンクに分割され、[Transformers.js](https://huggingface.co/docs/transformers.js)(`Xenova/multilingual-e5-small`。英語と中国語が混在するコンテンツにも強い)を使って専用の Web Worker 内でローカルに埋め込みベクトル化されます。チャット時には、最も関連性の高いチャンクだけが取得されモデルに渡されます——以前は保存済みページをすべてプロンプトに詰め込んでいたため、トピック内のページ数が少し増えるだけでモデルのコンテキストウィンドウを超えてしまっていました。
* **保存先**: トピック、ページ、チャット履歴、チャンク/埋め込みインデックスはすべて、お使いの端末上の IndexedDB(Dexie 経由)に保存されます。

インデックスの状態確認や検索インデックスの再構築は、**設定**画面から行えます。

## 3. ビルドと実行方法
> ⚠️ AI 機能は Chrome 内蔵の AI 機能に依存しているため、**Chrome 138** 以上が必要です。また、端末上で動作するモデルには実際のハードウェア要件があります:**空き容量 22GB 以上**、加えて **VRAM 4GB 超の GPU**、または **16GB 以上の RAM と 4 コア以上の CPU** のいずれかが必要です。設定画面のステータスカードに「Unavailable」と表示された場合は、`chrome://on-device-internals` を開いて具体的な原因(多くはディスク容量不足)を確認してください。

1. このリポジトリをクローンする
2. ```npm install && npm run build```
3. ```/dist``` ディレクトリを Chrome にパッケージ化されていない拡張機能として読み込む。
4. 拡張機能のアイコンをクリックして CollectMind を開く。

初めてページを要約したりチャットしたりする際、Chrome から端末上のモデル(数 GB)のダウンロードを促されます。また埋め込みモデル(約 120MB)はバックグラウンドでダウンロードされます——どちらもその後はキャッシュされ、再度のネットワークアクセスは不要になります。

## 4. スクリーンショット

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 1. スタートページ </figcaption>
  <img src="./images/1.png" width="200">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 2. トピックを作成 </figcaption>
  <img src="./images/2.png" width="200">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 3. トピック一覧 </figcaption>
  <img src="./images/3.png" width="200">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 4. 保存済みページ一覧 </figcaption>
  <img src="./images/4.png" width="200">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 5. ページ要約(AI) </figcaption>
  <img src="./images/5.png" width="400">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 6. 要約の詳細 </figcaption>
  <img src="./images/6.png" width="400">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 7. トピックに基づく AI チャット </figcaption>
  <img src="./images/7.png" width="200">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 8. 特定のページに基づく AI チャット </figcaption>
  <img src="./images/8.png" width="400">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 9. コレクション全体(すべてのトピック)を横断して質問 </figcaption>
  <img src="./images/11.png" width="200">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 10. 設定(ローカルモデル) </figcaption>
  <img src="./images/9.png" width="200">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 11. 設定(バックアップとクラウド) </figcaption>
  <img src="./images/10.png" width="200">
</figure>
