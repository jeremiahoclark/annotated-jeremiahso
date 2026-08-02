/**
 * annotated-app — SPA shell + same-origin /api/* proxy to annotated-api.
 *
 * Production: service binding API → Worker annotated-api.
 * Assets: frontend/dist via ASSETS (SPA not_found_handling).
 */

export interface Env {
  API: Fetcher;
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      // Forward to annotated-api; preserve method, headers, body, response.
      return env.API.fetch(request);
    }

    if (url.pathname === "/health") {
      return Response.json({
        ok: true,
        service: "annotated-app",
        timestamp: new Date().toISOString(),
      });
    }

    return env.ASSETS.fetch(request);
  },
};
