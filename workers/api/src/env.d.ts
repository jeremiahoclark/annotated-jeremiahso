/** Cloudflare Worker bindings for annotated-api */
export interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;
  RATE_LIMIT: KVNamespace;
  CACHE: KVNamespace;

  ENVIRONMENT: string;
  ADMIN_EMAILS: string;

  BETTER_AUTH_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  TWITTER_CLIENT_ID?: string;
  TWITTER_CLIENT_SECRET?: string;
  /** Service binding to jeremiah-so-mailer worker */
  MAILER?: Fetcher;
  /** Bearer token for the mailer worker (wrangler secret) */
  MAILER_SEND_TOKEN?: string;

  /** Injected by vitest pool workers */
  TEST_MIGRATIONS?: {
    name: string;
    queries: string[];
  }[];
}

declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database;
      MEDIA: R2Bucket;
      RATE_LIMIT: KVNamespace;
      CACHE: KVNamespace;
      ENVIRONMENT: string;
      ADMIN_EMAILS: string;
      BETTER_AUTH_SECRET?: string;
      GOOGLE_CLIENT_ID?: string;
      GOOGLE_CLIENT_SECRET?: string;
      TWITTER_CLIENT_ID?: string;
      TWITTER_CLIENT_SECRET?: string;
      MAILER_SEND_TOKEN?: string;
      TEST_MIGRATIONS?: {
        name: string;
        queries: string[];
      }[];
    }
  }
}

export {};
