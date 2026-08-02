/**
 * Annotated MV3 service worker.
 *
 * Context menu ids (documented):
 *   clip-av          — "Clip this video/audio"   (video, audio)
 *   clip-selection   — "Clip selection as text"  (selection)
 *   clip-page        — "Clip this page"          (page, image)
 *   open-feed        — "Open Annotated feed"     (page)
 */
import { APP_ORIGIN } from "./config";
import { getStoredAuth } from "./lib/auth";
import { healthOk, uploadScreenshot } from "./lib/api-client";
import { captureAndDownscale } from "./lib/screenshot";
import type { ClipDraft, ExtractedMedia, OgMeta } from "./lib/types";

const MENU = {
  CLIP_AV: "clip-av",
  CLIP_SELECTION: "clip-selection",
  CLIP_PAGE: "clip-page",
  OPEN_FEED: "open-feed",
} as const;

const SESSION_DRAFT_KEY = "clipDraft";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU.CLIP_AV,
      title: "Clip this video/audio",
      contexts: ["video", "audio"],
    });
    chrome.contextMenus.create({
      id: MENU.CLIP_SELECTION,
      title: "Clip selection as text",
      contexts: ["selection"],
    });
    chrome.contextMenus.create({
      id: MENU.CLIP_PAGE,
      title: "Clip this page",
      contexts: ["page", "image"],
    });
    chrome.contextMenus.create({
      id: MENU.OPEN_FEED,
      title: "Open Annotated feed",
      contexts: ["page"],
    });
  });

  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

// Also set on startup (service worker may restart without onInstalled)
void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.contextMenus.onClicked.addListener((info, tab) => {
  void handleMenuClick(info, tab);
});

async function handleMenuClick(
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab
): Promise<void> {
  const windowId = tab?.windowId ?? (await getActiveWindowId());
  if (windowId == null) return;

  if (info.menuItemId === MENU.OPEN_FEED) {
    await openSidePanel(windowId);
    return;
  }

  try {
    let draft: ClipDraft | null = null;

    if (info.menuItemId === MENU.CLIP_AV) {
      draft = await captureAv(info, tab, windowId);
    } else if (info.menuItemId === MENU.CLIP_SELECTION) {
      draft = await captureSelection(info, tab);
    } else if (info.menuItemId === MENU.CLIP_PAGE) {
      draft = await capturePage(info, tab, windowId);
    }

    if (!draft) return;

    await chrome.storage.session.set({ [SESSION_DRAFT_KEY]: draft });
    await notifyClipDraftReady();
    await openSidePanel(windowId);
  } catch (err) {
    console.error("capture workflow failed", err);
  }
}

async function getActiveWindowId(): Promise<number | undefined> {
  const wins = await chrome.windows.getCurrent();
  return wins?.id;
}

async function openSidePanel(windowId: number): Promise<void> {
  try {
    await chrome.sidePanel.open({ windowId });
  } catch (err) {
    console.warn("sidePanel.open failed", err);
  }
}

/** Retry sendMessage 5× / 150ms — side panel may be cold. */
async function notifyClipDraftReady(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    try {
      await chrome.runtime.sendMessage({ type: "clip-draft-ready" });
      return;
    } catch {
      await sleep(150);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function tabMeta(tab?: chrome.tabs.Tab): Promise<{
  pageUrl: string;
  title: string;
  og: OgMeta;
}> {
  const pageUrl = tab?.url || "";
  const title = tab?.title || "";
  let og: OgMeta = {};
  if (tab?.id != null) {
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: "ISOLATED",
        func: () => {
          try {
            const get = (sel: string) => {
              const el = document.querySelector(sel);
              return el ? (el.getAttribute("content") || "").trim() || null : null;
            };
            return {
              title:
                get('meta[property="og:title"]') ||
                get('meta[name="twitter:title"]'),
              description:
                get('meta[property="og:description"]') ||
                get('meta[name="description"]'),
              site_name: get('meta[property="og:site_name"]'),
              author:
                get('meta[name="author"]') ||
                get('meta[property="article:author"]') ||
                get('meta[name="twitter:creator"]'),
            };
          } catch {
            return {};
          }
        },
      });
      if (result && typeof result === "object") og = result as OgMeta;
    } catch {
      /* activeTab may not grant on restricted pages */
    }
  }
  return { pageUrl, title, og };
}

/** Paths relative to extension package root (dist/ load or parent load). */
function extractorFile(): string {
  const bg = chrome.runtime.getManifest().background as
    | { service_worker?: string }
    | undefined;
  const sw = bg?.service_worker;
  if (typeof sw === "string" && sw.startsWith("dist/")) {
    return "dist/extractors/media-extractor.js";
  }
  return "extractors/media-extractor.js";
}

async function runMediaExtractor(tabId: number): Promise<ExtractedMedia> {
  try {
    // Inject self-contained file, then invoke the global it defines.
    await chrome.scripting.executeScript({
      target: { tabId },
      world: "ISOLATED",
      files: [extractorFile()],
    });
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      world: "ISOLATED",
      func: () => {
        try {
          const g = globalThis as unknown as {
            __annotatedExtractMedia?: () => ExtractedMedia;
          };
          if (typeof g.__annotatedExtractMedia === "function") {
            return g.__annotatedExtractMedia();
          }
          return { found: false, error: "Extractor not installed" };
        } catch (err) {
          return {
            found: false,
            error: err instanceof Error ? err.message : "Extractor failed",
          };
        }
      },
    });
    return (result as ExtractedMedia) || { found: false, error: "No result" };
  } catch (err) {
    return {
      found: false,
      error: err instanceof Error ? err.message : "executeScript failed",
    };
  }
}

async function maybeScreenshot(
  windowId: number
): Promise<ClipDraft["screenshot"] | undefined> {
  const shot = await captureAndDownscale(windowId);
  if (!shot) return undefined;

  const screenshot: NonNullable<ClipDraft["screenshot"]> = {
    dataUrl: shot.dataUrl,
  };

  // Upload only when authed + online; skip silently otherwise.
  try {
    const auth = await getStoredAuth();
    if (auth?.token) {
      const online = await healthOk(4000);
      if (online) {
        const up = await uploadScreenshot(
          shot.base64,
          shot.contentType,
          auth.token
        );
        if (up?.upload_id) screenshot.upload_id = up.upload_id;
      }
    }
  } catch (err) {
    console.warn("screenshot upload skipped", err);
  }

  return screenshot;
}

async function captureAv(
  _info: chrome.contextMenus.OnClickData,
  tab: chrome.tabs.Tab | undefined,
  windowId: number
): Promise<ClipDraft | null> {
  if (tab?.id == null) return null;
  const extracted = await runMediaExtractor(tab.id);
  const meta = await tabMeta(tab);
  const screenshot = await maybeScreenshot(windowId);

  return {
    kind: "av",
    pageUrl: extracted.pageUrl || meta.pageUrl,
    title: extracted.title || meta.title,
    og: extracted.og || meta.og,
    currentSrc: extracted.currentSrc,
    duration: extracted.duration,
    currentTime: extracted.currentTime ?? 0,
    isYouTubePage: extracted.isYouTubePage,
    videoId: extracted.videoId,
    posterUrl: extracted.posterUrl,
    screenshot,
    createdAt: Date.now(),
  };
}

async function captureSelection(
  info: chrome.contextMenus.OnClickData,
  tab: chrome.tabs.Tab | undefined
): Promise<ClipDraft | null> {
  const meta = await tabMeta(tab);
  const text = (info.selectionText || "").trim();
  return {
    kind: "text",
    pageUrl: meta.pageUrl,
    title: meta.title,
    og: meta.og,
    text,
    createdAt: Date.now(),
  };
}

async function capturePage(
  info: chrome.contextMenus.OnClickData,
  tab: chrome.tabs.Tab | undefined,
  windowId: number
): Promise<ClipDraft | null> {
  const meta = await tabMeta(tab);
  const isImage = info.mediaType === "image" || !!info.srcUrl;
  const screenshot = await maybeScreenshot(windowId);
  return {
    kind: isImage ? "image" : "page",
    pageUrl: meta.pageUrl,
    title: meta.title,
    og: meta.og,
    imageUrl: info.srcUrl,
    screenshot,
    createdAt: Date.now(),
  };
}

// Side panel may ask for current draft
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "ping") {
    sendResponse({ ok: true, origin: APP_ORIGIN });
    return false;
  }
  if (msg?.type === "get-clip-draft") {
    void chrome.storage.session.get(SESSION_DRAFT_KEY).then((r) => {
      sendResponse({ draft: r[SESSION_DRAFT_KEY] ?? null });
    });
    return true;
  }
  if (msg?.type === "clear-clip-draft") {
    void chrome.storage.session.remove(SESSION_DRAFT_KEY).then(() => {
      sendResponse({ ok: true });
    });
    return true;
  }
  return false;
});
