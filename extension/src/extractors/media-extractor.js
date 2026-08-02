/**
 * Self-contained media extractor for chrome.scripting.executeScript({ files }).
 * MUST NOT import anything or close over extension scope.
 * Always returns a plain object; never throws into the page.
 *
 * When used as a file injection, the last expression / function isn't auto-returned.
 * We expose via window.__annotatedExtract (then read via a tiny follow-up func),
 * OR when injected as a function wrapper the background uses files + world MAIN/ISOLATED.
 *
 * Background injects this file then calls extractAnnotatedMedia via func.
 * This file defines globalThis.__annotatedExtractMedia for the isolated world.
 */
(function annotatedMediaExtractor() {
  "use strict";

  function safeOg() {
    const get = (sel) => {
      try {
        const el = document.querySelector(sel);
        return el ? (el.getAttribute("content") || "").trim() || null : null;
      } catch {
        return null;
      }
    };
    return {
      title: get('meta[property="og:title"]') || get('meta[name="twitter:title"]'),
      description:
        get('meta[property="og:description"]') || get('meta[name="description"]'),
      site_name: get('meta[property="og:site_name"]'),
      author:
        get('meta[name="author"]') ||
        get('meta[property="article:author"]') ||
        get('meta[name="twitter:creator"]'),
    };
  }

  function youtubeVideoIdFromUrl(url) {
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, "");
      if (host === "youtu.be") {
        const id = u.pathname.split("/").filter(Boolean)[0];
        return id && /^[\w-]{6,}$/.test(id) ? id : null;
      }
      if (
        host === "youtube.com" ||
        host === "m.youtube.com" ||
        host === "music.youtube.com"
      ) {
        const v = u.searchParams.get("v");
        if (v && /^[\w-]{6,}$/.test(v)) return v;
        const m = u.pathname.match(/\/(?:shorts|embed|live)\/([\w-]{6,})/);
        if (m) return m[1];
      }
    } catch {
      /* ignore */
    }
    const loose =
      /(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,})/i.exec(
        url
      );
    return loose ? loose[1] : null;
  }

  function pickMediaElement() {
    const videos = Array.from(document.querySelectorAll("video"));
    const audios = Array.from(document.querySelectorAll("audio"));
    const all = videos.concat(audios);
    if (!all.length) return null;

    // Prefer playing / not paused with time > 0, else largest area
    let best = null;
    let bestScore = -1;
    for (const el of all) {
      try {
        const rect = el.getBoundingClientRect();
        const area = Math.max(0, rect.width) * Math.max(0, rect.height);
        const playing = !el.paused && !el.ended && el.readyState >= 2;
        const score = (playing ? 1e9 : 0) + area + (el.currentTime > 0 ? 1e6 : 0);
        if (score > bestScore) {
          bestScore = score;
          best = el;
        }
      } catch {
        /* skip */
      }
    }
    return best;
  }

  function extractAnnotatedMedia() {
    try {
      const pageUrl = location.href;
      const title = document.title || "";
      const og = safeOg();
      const videoId = youtubeVideoIdFromUrl(pageUrl);
      const isYouTubePage = !!videoId;

      const media = pickMediaElement();
      if (!media && !isYouTubePage) {
        return {
          found: false,
          error: "No video or audio element found on this page.",
          pageUrl,
          title,
          og,
        };
      }

      let currentSrc = null;
      let duration = null;
      let currentTime = 0;
      let posterUrl = null;

      if (media) {
        currentSrc = media.currentSrc || media.src || null;
        duration =
          Number.isFinite(media.duration) && media.duration > 0
            ? media.duration
            : null;
        currentTime =
          Number.isFinite(media.currentTime) && media.currentTime >= 0
            ? media.currentTime
            : 0;
        if (media.tagName === "VIDEO") {
          posterUrl = media.getAttribute("poster") || null;
        }
      }

      // YouTube: prefer main player <video>
      if (isYouTubePage) {
        const ytVideo =
          document.querySelector("video.html5-main-video") ||
          document.querySelector("#movie_player video") ||
          media;
        if (ytVideo) {
          currentTime =
            Number.isFinite(ytVideo.currentTime) && ytVideo.currentTime >= 0
              ? ytVideo.currentTime
              : currentTime;
          duration =
            Number.isFinite(ytVideo.duration) && ytVideo.duration > 0
              ? ytVideo.duration
              : duration;
          currentSrc = ytVideo.currentSrc || ytVideo.src || currentSrc;
        }
      }

      if (!og.title && title) og.title = title;

      return {
        found: true,
        currentSrc,
        duration,
        currentTime,
        isYouTubePage,
        videoId,
        pageUrl,
        title,
        og,
        posterUrl,
      };
    } catch (err) {
      return {
        found: false,
        error: err && err.message ? String(err.message) : "Extractor failed",
        pageUrl: typeof location !== "undefined" ? location.href : "",
        title: typeof document !== "undefined" ? document.title : "",
        og: {},
      };
    }
  }

  // Isolated-world global for follow-up executeScript func call
  try {
    globalThis.__annotatedExtractMedia = extractAnnotatedMedia;
  } catch {
    /* ignore */
  }

  return extractAnnotatedMedia();
})();
