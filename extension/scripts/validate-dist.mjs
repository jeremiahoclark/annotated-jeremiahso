/**
 * Assert dist/ is a loadable MV3 package.
 * Wired as `npm run validate` and chained after build.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

const ALLOWED_PERMISSIONS = new Set([
  "activeTab",
  "scripting",
  "storage",
  "contextMenus",
  "sidePanel",
  "notifications",
  "identity",
]);

function fail(msg) {
  console.error(`validate-dist FAIL: ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`  ✓ ${msg}`);
}

if (!existsSync(dist) || !statSync(dist).isDirectory()) {
  fail("dist/ missing");
}

const manifestPath = path.join(dist, "manifest.json");
if (!existsSync(manifestPath)) fail("dist/manifest.json missing");

let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch (e) {
  fail(`manifest.json not parseable: ${e.message}`);
}

if (manifest.manifest_version !== 3) {
  fail(`manifest_version must be 3, got ${manifest.manifest_version}`);
}
ok("manifest_version === 3");

const icons = manifest.icons || {};
for (const size of ["16", "48", "128"]) {
  const rel = icons[size];
  if (!rel) fail(`icons.${size} missing in manifest`);
  const abs = path.join(dist, rel);
  if (!existsSync(abs)) fail(`icon file missing: ${rel}`);
}
ok("icons 16/48/128 exist on disk");

const sw = manifest.background?.service_worker;
if (!sw || typeof sw !== "string") fail("background.service_worker missing");
if (!existsSync(path.join(dist, sw))) fail(`service_worker file missing: ${sw}`);
ok(`background.service_worker: ${sw}`);

const panel = manifest.side_panel?.default_path;
if (!panel || typeof panel !== "string") fail("side_panel.default_path missing");
if (!existsSync(path.join(dist, panel))) fail(`side_panel file missing: ${panel}`);
ok(`side_panel.default_path: ${panel}`);

const perms = manifest.permissions || [];
for (const p of perms) {
  if (!ALLOWED_PERMISSIONS.has(p)) {
    fail(`permission not in allowed set: ${p}`);
  }
}
ok(`permissions ⊆ declared set (${perms.length})`);

const host = manifest.host_permissions || [];
const all = [...perms, ...host];
if (all.includes("<all_urls>") || host.some((h) => h === "<all_urls>" || h === "*://*/*")) {
  fail("must not declare <all_urls> / *://*/*");
}
ok("no <all_urls>");

// Extractor present for executeScript files[]
const extractor = path.join(dist, "extractors/media-extractor.js");
if (!existsSync(extractor)) fail("extractors/media-extractor.js missing");
ok("media-extractor.js present");

console.log("validate-dist: PASS");
