#!/usr/bin/env node
// Packages dist/ into a .zip ready for the Chrome Web Store Developer
// Dashboard's "New item" upload.
//
// Run `npm run build` first (or use `npm run build:store`, which chains
// both). This script does NOT rebuild — it operates on whatever is already
// in dist/.
//
// Why this exists: Chrome Web Store rejects a brand-new item upload outright
// if manifest.json has a "key" field ("key field not allowed in manifest").
// Our dist/manifest.json always has one (see public/manifest.json) so that
// `chrome.identity` / OAuth keeps a stable extension ID across local
// rebuilds. For the *first* store upload that key has to come out; the store
// assigns its own ID, and you re-derive a "key" from that afterwards (Package
// tab -> View public key) for all subsequent updates, once the ID is stable.
//
// See the project chat history / README for the full publish walkthrough.

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const distDir = join(projectRoot, 'dist');
const manifestPath = join(distDir, 'manifest.json');

function fail(message) {
    console.error(`\n✖ ${message}\n`);
    process.exit(1);
}

if (!existsSync(distDir) || !existsSync(manifestPath)) {
    fail('dist/manifest.json not found. Run `npm run build` first (or use `npm run build:store`).');
}

// 1. Strip the "key" field from a copy of the manifest written into dist/ —
// mutates dist/manifest.json in place, since dist/ is a build artifact
// (gitignored, regenerated every build) rather than source.
const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
const hadKey = 'key' in manifest;
delete manifest.key;
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

if (hadKey) {
    console.log('Removed "key" from dist/manifest.json (not allowed on first Chrome Web Store upload).');
} else {
    console.log('dist/manifest.json had no "key" field to remove.');
}

// 2. Zip up dist/ (flat: files land at the zip root, matching what the
// Developer Dashboard expects — not wrapped in a "dist/" folder).
const JUNK_FILENAMES = new Set(['.DS_Store', 'Thumbs.db']);

function collectFiles(dir) {
    const entries = readdirSync(dir, { recursive: true });
    return entries
        .map(entry => join(dir, entry))
        .filter(fullPath => statSync(fullPath).isFile())
        .filter(fullPath => !JUNK_FILENAMES.has(fullPath.split(sep).pop() ?? ''));
}

const zip = new JSZip();
for (const filePath of collectFiles(distDir)) {
    // path.relative() uses the OS-native separator (backslashes on Windows);
    // zip entry paths should always use forward slashes.
    const zipEntryPath = relative(distDir, filePath).split(sep).join('/');
    zip.file(zipEntryPath, readFileSync(filePath));
}

const version = manifest.version ?? '0.0.0';
const outputName = `collectmind-store-v${version}.zip`;
const outputPath = join(projectRoot, outputName);

const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
writeFileSync(outputPath, buffer);

const sizeMb = (buffer.length / (1024 * 1024)).toFixed(1);
console.log(`\nWrote ${outputName} (${sizeMb} MB) — ready to upload at`);
console.log('https://chrome.google.com/webstore/devconsole\n');
