# Extension signing key

`collectmind-private-key.pem` is the RSA private key whose public half is
embedded in `public/manifest.json`'s `"key"` field. It's what pins the
extension's ID to a fixed value (`kajonmdopgpkaepgmfpfdomlgcamklnk`) instead
of one derived from wherever `dist/` happens to be loaded from — which
matters because the Google Cloud OAuth client (used for Drive backup/restore)
is registered against that specific ID.

**This whole directory is gitignored on purpose.** The private key isn't used
by `chrome.identity.getAuthToken()` at runtime (that flow only needs the
public key in the manifest), but it *is* needed if you ever `chrome
--pack-extension` this project or otherwise want to reproduce the same ID —
so back it up somewhere safe outside git (password manager, encrypted
storage) rather than losing it. If it's lost, generate a new one and update
both `manifest.json`'s `key` and the OAuth client's registered extension ID
to match the new ID.
