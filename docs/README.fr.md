# CollectMind

<p align="center">
  <a href="../README.md">English</a> |
  <a href="./README.de.md">Deutsch</a> |
  <b>Français</b> |
  <a href="./README.ja.md">日本語</a> |
  <a href="./README.es.md">Español</a> |
  <a href="./README.zh-CN.md">简体中文</a> |
  <a href="./README.zh-TW.md">繁體中文</a>
</p>

<div style="text-align: center">
<img src="./images/icon_origin.png"/>
</div>

CollectMind est une collection de favoris propulsée par l'IA qui vous aide à construire votre propre base de connaissances.

**Tout s'exécute entièrement sur votre appareil.** Le résumé, la recherche et le chat reposent entièrement sur Gemini Nano, intégré à Chrome, ainsi que sur un modèle d'embedding local exécuté dans votre navigateur — il n'y a ni serveur backend, ni clé API, ni compte requis. Vos favoris, le contenu des pages et l'historique des conversations ne quittent jamais votre machine. La seule exception délibérée concerne la sauvegarde : si vous choisissez de sauvegarder sur Google Drive, les données vont directement de votre navigateur vers *votre propre* espace Drive — CollectMind n'intervient à aucun moment et ne les voit jamais.

## 1. Fonctionnalités principales
* Organiser vos favoris par thème
* Ajouter la page en cours à vos favoris
* Résumer automatiquement le contenu des pages
* (RAG) Chat IA basé sur la recherche augmentée, par thème, avec des citations de sources cliquables
* Chat IA sur une page web spécifique
* **Interroger l'ensemble de votre collection** — un mode de chat « Bibliothèque » qui parcourt tous les thèmes à la fois, pour ne plus avoir à se souvenir dans quel thème vous avez classé quelque chose
* Résumés de thèmes générés automatiquement, tenus à jour au fil de l'ajout de pages
* Réponses affichées en flux (streaming)
* Sauvegarde et restauration, soit vers un fichier local, soit vers votre propre Google Drive (plusieurs sauvegardes possibles, chacune restaurable individuellement)

## 2. Fonctionnement

CollectMind fonctionne entièrement grâce à l'IA intégrée de Chrome (Gemini Nano) et à un petit modèle d'embedding local — rien n'est envoyé à un serveur.

* **Résumé et chat** : les API [Summarizer](https://developer.chrome.com/docs/ai/summarizer-api) et [Prompt](https://developer.chrome.com/docs/ai/prompt-api) gèrent les résumés de pages et les réponses conversationnelles directement sur l'appareil.
* **Recherche (RAG)** : les pages enregistrées sont découpées en fragments et vectorisées localement avec [Transformers.js](https://huggingface.co/docs/transformers.js) (`Xenova/multilingual-e5-small`, qui fonctionne bien pour du contenu mêlant anglais et chinois), exécuté dans un Web Worker dédié. Lors d'une conversation, seuls les fragments les plus pertinents sont récupérés et transmis au modèle — plutôt que d'injecter chaque page entière dans le prompt, ce qui dépassait autrefois la fenêtre de contexte du modèle dès qu'un thème contenait plus de quelques pages.
* **Stockage** : les thèmes, pages, historiques de conversation ainsi que l'index de fragments/embeddings résident tous dans IndexedDB (via Dexie), sur votre machine.

Vérifiez l'état de l'indexation et reconstruisez l'index de recherche depuis les **Paramètres**.

## 3. Compilation et exécution
> ⚠️ Les fonctionnalités d'IA reposent sur les capacités d'IA intégrées à Chrome ; la version minimale requise est donc **Chrome 138**. Le modèle embarqué a également de vraies exigences matérielles : **≥ 22 Go d'espace disque libre**, ainsi qu'un GPU avec **plus de 4 Go de VRAM** ou **16 Go de RAM et plus, avec 4 cœurs CPU ou plus**. Si une carte de statut dans les Paramètres affiche « Unavailable », ouvrez `chrome://on-device-internals` pour connaître la raison exacte (le plus souvent, un manque d'espace disque).

1. Clonez ce dépôt
2. ```npm install && npm run build```
3. Chargez le répertoire ```/dist``` dans Chrome en tant qu'extension non empaquetée.
4. Cliquez sur l'icône de l'extension pour ouvrir CollectMind.

La première fois que vous résumez une page ou lancez une conversation, Chrome vous proposera de télécharger son modèle embarqué (quelques Go), et le modèle d'embedding (~120 Mo) se téléchargera en arrière-plan — les deux sont ensuite mis en cache et ne nécessitent plus de connexion réseau par la suite.

## 4. Captures d'écran

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 1. Page d'accueil </figcaption>
  <img src="./images/1.png" width="200">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 2. Créer un thème </figcaption>
  <img src="./images/2.png" width="200">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 3. Liste des thèmes </figcaption>
  <img src="./images/3.png" width="200">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 4. Liste des pages enregistrées </figcaption>
  <img src="./images/4.png" width="200">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 5. Résumé de page (IA) </figcaption>
  <img src="./images/5.png" width="400">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 6. Détails du résumé </figcaption>
  <img src="./images/6.png" width="400">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 7. Chat IA par thème </figcaption>
  <img src="./images/7.png" width="200">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 8. Chat IA sur une page spécifique </figcaption>
  <img src="./images/8.png" width="400">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 9. Interroger toute votre collection (tous les thèmes) </figcaption>
  <img src="./images/11.png" width="200">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 10. Paramètres (modèles locaux) </figcaption>
  <img src="./images/9.png" width="200">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 11. Paramètres (sauvegarde et cloud) </figcaption>
  <img src="./images/10.png" width="200">
</figure>
