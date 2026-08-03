// Parses the sanitized HTML a practitioner's `rich_text` block carries into a
// flat list of blocks React Native can lay out. RN has no innerHTML: the old
// approach deleted every tag and rendered the remainder as one <Text>, which
// silently fused list items into each other ("…relâchez.Épaules : montez…") and
// dropped every paragraph break, so structured material arrived at the patient
// as a wall of text.
//
// The input is not arbitrary HTML. It has already been through the care app's
// note sanitizer (apps/care/src/lib/notes/sanitize.ts), so the tag set is a
// closed allowlist — b, strong, i, em, u, s, p, br, ul, ol, li, blockquote, q,
// a, mark — with attributes only on `a` (href/title/target/rel) and `mark`
// (data-tag). That is why a tokenizer is enough here and no HTML parser is
// pulled in: anything outside that set cannot reach this code, and if it ever
// did, an unknown tag contributes no styling and its text still renders.
//
// Kept free of JSX and React on purpose so the parsing can be exercised on its
// own.

export interface Span {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  mark?: boolean;
  href?: string;
}

export type RichBlock =
  | { kind: 'paragraph'; spans: Span[] }
  | { kind: 'item'; spans: Span[]; marker: string; depth: number }
  | { kind: 'quote'; spans: Span[] };

// sanitize-html escapes text as &amp; &lt; &gt; &quot; and leaves real UTF-8
// alone, so this only has to cover those plus what a practitioner's editor may
// paste in. Numeric forms are handled generically below.
const NAMED: Record<string, string> = {
  // &nbsp; decodes to a PLAIN space, not U+00A0: a non-breaking space in a
  // narrow phone column pushes long words off the screen edge, and editors emit
  // it for ordinary spacing far more often than for real typographic intent.
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  hellip: '…', mdash: '—', ndash: '–', middot: '·', bull: '•',
  rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»',
  deg: '°', euro: '€', copy: '©', reg: '®', trade: '™', times: '×',
  // v1 content was hand-written HTML, so French accents arrive as entities.
  // Case is meaningful here: &Eacute; is not &eacute;.
  agrave: 'à', Agrave: 'À', acirc: 'â', Acirc: 'Â', ccedil: 'ç', Ccedil: 'Ç',
  egrave: 'è', Egrave: 'È', eacute: 'é', Eacute: 'É', ecirc: 'ê', Ecirc: 'Ê',
  euml: 'ë', Euml: 'Ë', icirc: 'î', Icirc: 'Î', iuml: 'ï', Iuml: 'Ï',
  ocirc: 'ô', Ocirc: 'Ô', ouml: 'ö', Ouml: 'Ö', oelig: 'œ', OElig: 'Œ',
  ugrave: 'ù', Ugrave: 'Ù', ucirc: 'û', Ucirc: 'Û', uuml: 'ü', Uuml: 'Ü',
  ntilde: 'ñ', Ntilde: 'Ñ',
};

// Only the ASCII punctuation names carry long-standing case-insensitive aliases
// (&AMP;, &NBSP;). Accented names are matched exactly, or an &Eacute; would come
// back lowercased.
const CASE_INSENSITIVE = new Set(['amp', 'lt', 'gt', 'quot', 'apos', 'nbsp']);

function fromCodePoint(code: number): string | null {
  // Surrogate halves and out-of-range values throw; a malformed entity should
  // survive as its literal text rather than take the screen down.
  if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return null;
  if (code >= 0xd800 && code <= 0xdfff) return null;
  return String.fromCodePoint(code);
}

export function decodeEntities(input: string): string {
  return input.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/g, (whole, body: string) => {
    if (body.charAt(0) === '#') {
      const hex = body.charAt(1) === 'x' || body.charAt(1) === 'X';
      const code = hex ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return fromCodePoint(code) ?? whole;
    }
    const exact = NAMED[body];
    if (exact !== undefined) return exact;
    const lower = body.toLowerCase();
    return CASE_INSENSITIVE.has(lower) ? NAMED[lower] : whole;
  });
}

// Inline quotation. On the web the browser picks « » or “ ” from <html lang>;
// there is no such machinery here, so the caller passes the pair for its locale.
export interface ParseOptions {
  quotes?: readonly [string, string];
}

const INLINE_STYLE: Record<string, keyof Span> = {
  b: 'bold', strong: 'bold',
  i: 'italic', em: 'italic',
  u: 'underline',
  s: 'strike',
  mark: 'mark',
};

// Text and tags. Attribute values are matched with quotes respected so a `>`
// inside href="…" cannot end the tag early.
const TOKEN = /<\/?([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>])*)>|([^<]+)/g;
const HREF = /href\s*=\s*(?:"([^"]*)"|'([^']*)')/i;

export function parseRichText(html: string, options?: ParseOptions): RichBlock[] {
  if (!html) return [];
  const [openQuote, closeQuote] = options?.quotes ?? ['“', '”'];

  const blocks: RichBlock[] = [];
  let spans: Span[] = [];
  let kind: RichBlock['kind'] = 'paragraph';
  let marker = '';
  let depth = 0;

  // Counts rather than booleans: <strong><strong>x</strong> still bold</strong>
  // has to stay bold after the inner tag closes.
  const depthOf: Record<string, number> = { bold: 0, italic: 0, underline: 0, strike: 0, mark: 0 };
  let href: string | undefined;
  const lists: { ordered: boolean; count: number }[] = [];

  const flush = () => {
    trimEdges(spans);
    if (spans.length > 0) {
      blocks.push(kind === 'item' ? { kind: 'item', spans, marker, depth } : { kind, spans } as RichBlock);
    }
    spans = [];
  };

  const push = (text: string) => {
    if (!text) return;
    const span: Span = { text };
    if (depthOf.bold > 0) span.bold = true;
    if (depthOf.italic > 0) span.italic = true;
    if (depthOf.underline > 0) span.underline = true;
    if (depthOf.strike > 0) span.strike = true;
    if (depthOf.mark > 0) span.mark = true;
    if (href) span.href = href;
    spans.push(span);
  };

  TOKEN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN.exec(html)) !== null) {
    const [whole, rawName, attrs, text] = m;

    if (text !== undefined) {
      // HTML collapses runs of whitespace, and the source is full of newlines
      // and indentation between tags. Collapsing here is what keeps "a</p><p>b"
      // from becoming "ab" while "a <em>b</em>" keeps its single space.
      push(decodeEntities(text.replace(/\s+/g, ' ')));
      continue;
    }

    const name = (rawName ?? '').toLowerCase();
    const closing = whole.charAt(1) === '/';

    switch (name) {
      case 'p':
      case 'blockquote':
        flush();
        kind = closing ? 'paragraph' : name === 'p' ? 'paragraph' : 'quote';
        break;
      case 'ul':
      case 'ol':
        flush();
        if (closing) lists.pop();
        else lists.push({ ordered: name === 'ol', count: 0 });
        kind = 'paragraph';
        break;
      case 'li': {
        flush();
        if (closing) {
          kind = 'paragraph';
          break;
        }
        const list = lists[lists.length - 1];
        kind = 'item';
        depth = Math.max(0, lists.length - 1);
        if (list) {
          list.count += 1;
          marker = list.ordered ? `${list.count}.` : '•';
        } else {
          // A stray <li> with no list around it still reads as a bullet.
          marker = '•';
        }
        break;
      }
      case 'br':
        // A line break inside the block, not a new block: the spans share one
        // <Text>, so a newline character is exactly right.
        if (!closing) push('\n');
        break;
      case 'a':
        if (closing) href = undefined;
        else {
          const hit = HREF.exec(attrs ?? '');
          const url = decodeEntities((hit?.[1] ?? hit?.[2] ?? '').trim());
          // Only schemes the sanitizer allows. Anything else is not worth
          // handing to Linking.openURL.
          href = /^(https?:|mailto:)/i.test(url) ? url : undefined;
        }
        break;
      case 'q':
        push(closing ? closeQuote : openQuote);
        break;
      default: {
        const style = INLINE_STYLE[name];
        if (style) depthOf[style] += closing ? -1 : 1;
        if (style && depthOf[style] < 0) depthOf[style] = 0;
        break;
      }
    }
  }

  // Content with no block tag at all ("just a sentence") lands here.
  flush();
  return blocks;
}

// Drops the whitespace a block picked up from the source's own indentation,
// without touching the single spaces that separate inline spans.
function trimEdges(spans: Span[]): void {
  while (spans.length > 0) {
    const first = spans[0];
    first.text = first.text.replace(/^[ \t\n]+/, '');
    if (first.text) break;
    spans.shift();
  }
  while (spans.length > 0) {
    const last = spans[spans.length - 1];
    last.text = last.text.replace(/[ \t\n]+$/, '');
    if (last.text) break;
    spans.pop();
  }
}

// For places that need a single string (a heading, an accessibility label).
// Unlike deleting tags, this keeps block boundaries as line breaks.
export function htmlToPlainText(html: string): string {
  return parseRichText(html)
    .map((b) => b.spans.map((s) => s.text).join(''))
    .join('\n')
    .trim();
}
