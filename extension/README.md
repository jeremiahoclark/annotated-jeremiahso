# Annotated — Chrome extension (MV3)

Scaffold only. **Build comes in the extension phase.**

## Current state

- `manifest.json` — MV3 skeleton (no `host_permissions`; uses `activeTab` for user-invoked actions)
- `icons/` — brand marks (black + orange + scissors glyph)
- `dist/` — not produced yet (background SW + side panel SPA)

## Planned capabilities

- Context menus: clip video/audio (≤90s), clip selection (≤100 words), clip page
- Side panel: Compose + Feed (`?embed=1`)
- Auth via `chrome.identity.launchWebAuthFlow` → bearer mint from the web app
- Screenshots via `tabs.captureVisibleTab` (activeTab / user gesture)

See [docs/SPEC.md](../docs/SPEC.md) for the full contract.
