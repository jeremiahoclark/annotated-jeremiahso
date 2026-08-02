/** App origin for API, auth, feed iframe, and annotation landing links. */
export const APP_ORIGIN =
  (import.meta.env.VITE_APP_ORIGIN as string | undefined) ??
  "https://annotated-app.jeremiahoclark.workers.dev";

export const MAX_CLIP_SECONDS = 90;
export const MAX_CLIP_WORDS = 100;
export const MIN_COMMENTARY_CHARS = 10;
