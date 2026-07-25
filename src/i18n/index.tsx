// App-wide localization (English / French).
//
// Locale precedence:
//   1. The user's explicit choice (Settings toggle) — sticky, persisted.
//   2. The invite's language (a French invite opens the app in French and makes
//      French the saved default) — set via setLocale on the invite screen.
//   3. The server profile's locale for a returning patient — adoptDefault().
//   4. English.
//
// Persisted through the shared storage seam (Keychain on native, localStorage on
// web). `t` is the active dictionary; interpolate {tokens} with `fmt`.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { storageGet, storageSet } from '../storage';
import { en } from './en';
import { fr } from './fr';

export type Locale = 'en' | 'fr';
export type Dict = typeof en;

const DICTS: Record<Locale, Dict> = { en, fr };
const KEY = 'pref.locale';

/** Replace {name}-style tokens in a translated string. */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

interface I18nValue {
  locale: Locale;
  t: Dict;
  /** Explicit user change — persists and wins over any later default. */
  setLocale: (l: Locale) => void;
  /** Adopt a default (invite / server) ONLY if the user hasn't chosen yet. */
  adoptDefault: (l: Locale) => void;
  /** True once the stored preference has been read. */
  ready: boolean;
}

const Ctx = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');
  const [ready, setReady] = useState(false);
  const chosen = useRef(false); // an explicit/persisted preference exists

  useEffect(() => {
    let alive = true;
    storageGet(KEY).then((v) => {
      if (!alive) return;
      if (v === 'en' || v === 'fr') {
        chosen.current = true;
        setLocaleState(v);
      }
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const setLocale = useCallback((l: Locale) => {
    chosen.current = true;
    setLocaleState(l);
    void storageSet(KEY, l);
  }, []);

  const adoptDefault = useCallback((l: Locale) => {
    if (chosen.current) return; // never override an explicit choice
    chosen.current = true;
    setLocaleState(l);
    void storageSet(KEY, l);
  }, []);

  const value = useMemo<I18nValue>(
    () => ({ locale, t: DICTS[locale], setLocale, adoptDefault, ready }),
    [locale, setLocale, adoptDefault, ready],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n must be used within I18nProvider');
  return v;
}
