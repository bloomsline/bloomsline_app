// Articles — blog posts written by the patient's own practitioner(s).
//
// Read-only and unrecorded: there is no run count and no opened-at. A patient
// browsing what their therapist has written is not an event worth logging.
import { apiFetch } from '../auth/api';

export interface Article {
  id: string;
  title: string;
  excerpt: string;
  /** Absolute URL, or null when the post has no cover. */
  coverUrl: string | null;
  publishedAt: string | null;
  authorName: string;
  /** Locales the post actually exists in. */
  locales: string[];
  /** The locale this payload came back in, after falling back to the language
   *  it was written in. Compare with what was asked for to know whether to say
   *  "this one is in English". */
  renderedLocale: string;
}

export type Mark = 'bold' | 'italic' | 'underline' | 'strike';

export interface Run {
  text: string;
  marks?: Mark[];
  href?: string;
}

/** What the server sends instead of HTML. The app has no HTML renderer and no
 *  WebView, and adding one would mean a native build — these render in the
 *  app's own type and colours, dark mode included. */
export type ArticleBlock =
  | { type: 'heading'; level: 2 | 3 | 4; runs: Run[] }
  | { type: 'paragraph'; runs: Run[] }
  | { type: 'quote'; runs: Run[] }
  | { type: 'list'; ordered: boolean; items: Run[][] }
  | { type: 'image'; src: string; alt: string }
  | { type: 'divider' };

export interface ArticleBody extends Article {
  blocks: ArticleBlock[];
}

/** Live posts by this patient's practitioner(s), newest first.
 *
 *  An empty array is a real answer — it means the practitioner has never
 *  published — and the home tab uses it to hide the Articles card entirely
 *  rather than open onto an empty room. `null` means the request failed, which
 *  is a different thing and must not be mistaken for "none". */
export async function listArticles(locale: string): Promise<Article[] | null> {
  try {
    const res = await apiFetch(`/api/mobile/blog?locale=${encodeURIComponent(locale)}`);
    if (!res.ok) return null;
    return (await res.json()).items as Article[];
  } catch {
    return null;
  }
}

export async function getArticle(id: string, locale: string): Promise<ArticleBody | null> {
  try {
    const res = await apiFetch(`/api/mobile/blog/${encodeURIComponent(id)}?locale=${encodeURIComponent(locale)}`);
    if (!res.ok) return null;
    return (await res.json()).article as ArticleBody;
  } catch {
    return null;
  }
}
