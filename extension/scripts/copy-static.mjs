/**
 * Post-vite: copy icons, extractor, and write manifest into dist/.
 * dist/ is fully loadable as an unpacked extension root.
 */
import { copyFileSync, mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

if (!existsSync(dist)) {
  console.error("dist/ missing — run vite builds first");
  process.exit(1);
}

const bg = path.join(dist, "background.js");
if (!existsSync(bg)) {
  console.error("dist/background.js missing after background build");
  process.exit(1);
}

const sidepanelHtml = path.join(dist, "sidepanel/index.html");
if (!existsSync(sidepanelHtml)) {
  console.error("dist/sidepanel/index.html missing after sidepanel build");
  process.exit(1);
}

// Ensure sidepanel asset paths are relative (./assets/...)
let html = readFileSync(sidepanelHtml, "utf8");
html = html.replace(/(src|href)="\/assets\//g, '$1="./assets/');
html = html.replace(/(src|href)="\/sidepanel\//g, '$1="./');
writeFileSync(sidepanelHtml, html);

// Icons
const iconsSrc = path.join(root, "icons");
const iconsDst = path.join(dist, "icons");
mkdirSync(iconsDst, { recursive: true });
for (const size of ["16", "48", "128"]) {
  const f = `${size}.png`;
  copyFileSync(path.join(iconsSrc, f), path.join(iconsDst, f));
}

// Self-contained media extractor (plain JS, no imports)
const extractorSrc = path.join(root, "src/extractors/media-extractor.js");
const extractorDst = path.join(dist, "extractors");
mkdirSync(extractorDst, { recursive: true });
copyFileSync(extractorSrc, path.join(extractorDst, "media-extractor.js"));

const appOrigin =
  process.env.VITE_APP_ORIGIN ||
  "https://annotated-app.jeremiahoclark.workers.dev";
let hostPattern;
try {
  const u = new URL(appOrigin);
  hostPattern = `${u.origin}/*`;
} catch {
  hostPattern = "https://annotated-app.jeremiahoclark.workers.dev/*";
}

const distManifest = {
  manifest_version: 3,
  name: "Annotated",
  version: "0.1.0",
  description:
    "Clip any media, add commentary, share under fair use. Clip it. Comment on it. Back it up.",
  permissions: [
    "activeTab",
    "scripting",
    "storage",
    "contextMenus",
    "sidePanel",
    "notifications",
    "identity",
  ],
  host_permissions: [hostPattern],
  icons: {
    "16": "icons/16.png",
    "48": "icons/48.png",
    "128": "icons/128.png",
  },
  action: {
    default_title: "Annotated",
    default_icon: {
      "16": "icons/16.png",
      "48": "icons/48.png",
      "128": "icons/128.png",
    },
  },
  background: {
    service_worker: "background.js",
  },
  side_panel: {
    default_path: "sidepanel/index.html",
  },
};

writeFileSync(path.join(dist, "manifest.json"), JSON.stringify(distManifest, null, 2) + "\n");

writeFileSync(
  path.join(dist, "README.load"),
  `Load unpacked: chrome://extensions → Developer mode → Load unpacked → select this dist/ folder.

Built for APP_ORIGIN host: ${hostPattern}
Override at build: VITE_APP_ORIGIN=https://your-app.example npm run build
`
);

// Repo scaffold manifest (load from extension/ root → paths under dist/)
const rootManifest = {
  manifest_version: 3,
  name: "Annotated",
  version: "0.1.0",
  description:
    "Clip any media, add commentary, share under fair use. Clip it. Comment on it. Back it up.",
  permissions: distManifest.permissions,
  host_permissions: distManifest.host_permissions,
  icons: {
    "16": "icons/16.png",
    "48": "icons/48.png",
    "128": "icons/128.png",
  },
  action: {
    default_title: "Annotated",
    default_icon: {
      "16": "icons/16.png",
      "48": "icons/48.png",
      "128": "icons/128.png",
    },
  },
  background: {
    service_worker: "dist/background.js",
  },
  side_panel: {
    default_path: "dist/sidepanel/index.html",
  },
};

writeFileSync(path.join(root, "manifest.json"), JSON.stringify(rootManifest, null, 2) + "\n");

console.log("copy-static: icons, extractor, manifest → dist/");
