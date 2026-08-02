# Fair Use Policy — Annotated

Annotated is a **commentary and criticism** network. We help people clip short excerpts of public media, add their own analysis, and always send readers back to the original work.

This page is our public-facing policy. It is not legal advice. Fair use is a US doctrine (17 U.S.C. § 107) decided case-by-case.

## The four fair-use factors

Courts weigh:

1. **Purpose and character of the use** — transformative commentary, criticism, news reporting, teaching, and research weigh more heavily than pure entertainment or commercial substitution. Annotated requires original commentary on every top-level clip.
2. **Nature of the copyrighted work** — factual works generally receive thinner protection than highly creative ones; both can still be clipped for criticism.
3. **Amount and substantiality** — only as much as needed for the point. We hard-limit clips so the product cannot become a substitute for the full work.
4. **Effect on the potential market** — use should not replace the market for the original. We never re-host full videos or articles in v1; we link back and use bounded embeds or short text excerpts.

## Our product limits (enforced server-side)

| Media | Limit |
|-------|--------|
| Video / audio | Clip window **≤ 90 seconds** (`clip_end − clip_start`) |
| Text | Excerpt **≤ 100 words** |
| Commentary | **Required** on every top-level annotation (min 10 non-whitespace characters) |
| Attribution | **Always link back** — source URL, domain, and a prominent “View original” control |

- Threading: to say more in text, create a follow-up clip (`parent_id`) rather than pasting a longer excerpt.
- Anonymous posting hides the author publicly but still records identity server-side for abuse control.
- We do **not** re-host full media. v1 uses bounded embeds (e.g. YouTube `start`/`end`), optional low-res screenshots, and short transcript windows.

## Flag process

Every annotation has a **copyright concern** control.

1. Anyone can report: reason `copyright_concern` or `other`, optional free-text body.
2. Reports land in an admin queue (`reports` table; unresolved first).
3. Admins (allowlisted via `ADMIN_EMAILS`) review whether the clip + commentary still look like good-faith fair use or should be taken down / revised.
4. This is the product’s “I believe this is stealing / this is not fair use” hook — human review, not automated legal judgment.

## Good-faith checklist for posters

- [ ] My commentary adds criticism, analysis, or context — not just the clip alone.
- [ ] The excerpt is only as long as needed (within 90s / 100 words).
- [ ] Readers can open the original source from the annotation page.
- [ ] I am not trying to replace the original work’s market.

If you are a rights holder and believe a post is not fair use, use the report control or contact the operators with the annotation URL.
