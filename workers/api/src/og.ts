/**
 * Best-effort OG metadata scrape via HTMLRewriter (4s timeout).
 */
export interface OgMeta {
  title: string | null;
  author: string | null;
}

export async function fetchOgMeta(url: string, timeoutMs = 4000): Promise<OgMeta> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "AnnotatedBot/1.0 (+https://annotated.app; fair-use annotation)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    if (!res.ok || !res.body) return { title: null, author: null };

    const meta: {
      ogTitle: string | null;
      articleAuthor: string | null;
      metaAuthor: string | null;
      docTitle: string;
    } = {
      ogTitle: null,
      articleAuthor: null,
      metaAuthor: null,
      docTitle: "",
    };

    await new HTMLRewriter()
      .on("meta", {
        element(el) {
          const prop = (
            el.getAttribute("property") ||
            el.getAttribute("name") ||
            ""
          ).toLowerCase();
          const content = el.getAttribute("content");
          if (!content) return;
          if (prop === "og:title") meta.ogTitle = content;
          if (prop === "article:author") meta.articleAuthor = content;
          if (prop === "author") meta.metaAuthor = content;
        },
      })
      .on("title", {
        text(t) {
          meta.docTitle += t.text;
        },
      })
      .transform(res)
      .arrayBuffer();

    const title = meta.ogTitle || (meta.docTitle.trim() || null);
    const author = meta.articleAuthor || meta.metaAuthor;
    return { title, author };
  } catch {
    return { title: null, author: null };
  } finally {
    clearTimeout(timer);
  }
}

export async function enrichAnnotationOg(
  db: D1Database,
  annotationId: number,
  sourceUrl: string
): Promise<void> {
  const meta = await fetchOgMeta(sourceUrl);
  if (!meta.title && !meta.author) return;
  await db
    .prepare(
      `UPDATE annotations SET
         source_title = COALESCE(source_title, ?),
         source_author = COALESCE(source_author, ?),
         updated_at = datetime('now')
       WHERE id = ?`
    )
    .bind(meta.title, meta.author, annotationId)
    .run();

  if (meta.title || meta.author) {
    await db
      .prepare(
        `UPDATE canonical_sources SET
           title = COALESCE(title, ?),
           author = COALESCE(author, ?)
         WHERE key = (SELECT canonical_source_key FROM annotations WHERE id = ?)`
      )
      .bind(meta.title, meta.author, annotationId)
      .run();
  }
}
