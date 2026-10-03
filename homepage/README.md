# CollectMind homepage

The CollectMind product site is a small, framework-free Vite project deployed to Cloudflare with Wrangler. Vite builds both HTML pages and their shared CSS/images into `dist/`.

```text
homepage/
  index.html        — product page
  privacy.html      — styled privacy policy
  styles.css        — shared styles
  images/           — logo and screenshots
  vite.config.js    — multi-page build configuration
  wrangler.jsonc    — Cloudflare static-assets configuration
  dist/             — generated build output (not committed)
```

## Local development

Requires Node.js 22.12 or newer. The repository pins Node.js 22.16 for Cloudflare builds through `.node-version`.

```bash
npm install
npm run dev
```

## Build and preview

```bash
npm run build
npm run preview
```

The production build includes both `/index.html` and `/privacy.html`.

## Cloudflare automatic deployment

Configure the Cloudflare Git deployment with:

- Root directory: `homepage`
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`

Wrangler reads `wrangler.jsonc` and deploys the generated `dist/` directory as static assets. If the existing Cloudflare project uses a different Worker name, update the `name` in `wrangler.jsonc` to match it.

For a manual deployment from this directory, run:

```bash
npm run deploy
```

The deployed homepage and `/privacy.html` URLs can be used for the Chrome Web Store listing and Google OAuth consent screen.

## Keeping content in sync

- **Screenshots**: when `docs/images/*.png` changes, copy the corresponding files into `homepage/images/`.
- **Privacy policy**: `privacy.html` is a manually maintained HTML copy of `../PRIVACY.md`; update both when the policy changes.
