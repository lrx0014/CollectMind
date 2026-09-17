# CollectMind homepage

A static, no-build-step product page for CollectMind — plain HTML/CSS, no framework, nothing to compile. Deploy it as-is.

```
homepage/
  index.html     — the product page
  privacy.html   — privacy policy sub-page (same content as ../PRIVACY.md, styled)
  styles.css     — shared styles for both pages
  images/        — logo + screenshots (copied from ../docs/images/)
```

## Deploying with GitHub Pages (recommended, free)

1. Push this folder to GitHub.
2. Repo **Settings → Pages**.
3. Under "Build and deployment", set **Source: Deploy from a branch**, pick your branch (e.g. `master`), and set the folder to **`/homepage`** (GitHub Pages lets you serve from a subfolder without needing a separate branch or `gh-pages` setup).
4. Save. GitHub will publish it at `https://<your-username>.github.io/CollectMind/` within a minute or two.

Once live, that URL (and `.../privacy.html` for the policy page) is what you plug into:
- The Chrome Web Store listing's **Homepage URL** / **Support URL** fields.
- The Chrome Web Store's required **Privacy Policy URL** (use the `privacy.html` page instead of linking the raw `PRIVACY.md` — same content, nicer to read).
- Google Cloud Console's OAuth consent screen **Application home page** / **Privacy Policy link** fields.

## Keeping it in sync

- **Screenshots**: if you update `docs/images/*.png` (e.g. after a UI change), copy the same files into `homepage/images/` so the product page and the README stay consistent.
- **Privacy policy**: `privacy.html` is a manually-kept HTML copy of `../PRIVACY.md`'s content — if you edit one, update the other. There's no build step wiring them together on purpose (keeps this folder dependency-free), so this is a manual sync.
- **"Get CollectMind" button** in `index.html`'s hero section currently links to the README's build instructions (there's no published listing yet). Once the extension is live on the Chrome Web Store, replace that `href` with the real store listing URL.
