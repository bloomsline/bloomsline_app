// A number as a patient types it, read exactly as the server reads it
// (apps/care/src/lib/resources/answers.ts `parseTypedNumber`). Kept in step by
// hand: the server is the one that stores the answer, and this only lets the
// field say, as it is typed, what that will be.
//
// The one ambiguous number is "1,234": in English a comma before exactly three
// digits groups thousands (1234); in French it is the decimal point (1.234).
export type NumberLocale = 'en' | 'fr';

const GROUP_SPACE = /[    ]/;
const escapeRe = (c: string) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function parseTypedNumber(raw: string, locale: NumberLocale): number | undefined {
  const hit = /^([+-]?)(.+)$/.exec(raw.trim());
  if (!hit) return undefined;
  const [, sign, body] = hit;
  let plain: string;
  if (GROUP_SPACE.test(body)) {
    const m = /^(\d{1,3}(?:[    ]\d{3})+)(?:[.,](\d+))?$/.exec(body);
    if (!m) return undefined;
    plain = m[1].replace(new RegExp(GROUP_SPACE.source, 'g'), '') + (m[2] ? `.${m[2]}` : '');
  } else {
    const dots = body.split('.').length - 1;
    const commas = body.split(',').length - 1;
    if (dots > 0 && commas > 0) {
      const decimal = body.lastIndexOf('.') > body.lastIndexOf(',') ? '.' : ',';
      const group = decimal === '.' ? ',' : '.';
      if (!new RegExp(`^\\d{1,3}(?:${escapeRe(group)}\\d{3})+${escapeRe(decimal)}\\d+$`).test(body)) return undefined;
      plain = body.split(group).join('').replace(decimal, '.');
    } else if (dots + commas > 1) {
      const group = dots > 0 ? '.' : ',';
      if (!new RegExp(`^\\d{1,3}(?:${escapeRe(group)}\\d{3})+$`).test(body)) return undefined;
      plain = body.split(group).join('');
    } else {
      if (!/^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(body)) return undefined;
      plain = locale === 'en' && /^\d{1,3},\d{3}$/.test(body) ? body.replace(',', '') : body.replace(',', '.');
    }
  }
  const n = Number(sign + plain);
  return Number.isFinite(n) ? n : undefined;
}

/** The number as the patient's language writes it, for "Read as …". */
export function formatReadNumber(n: number, locale: NumberLocale): string {
  return n.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-GB', { maximumFractionDigits: 10 });
}
