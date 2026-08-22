// Light / dark, and who decides.
//
// Three settings, not two: 'system' follows the OS, 'light' and 'dark' override
// it. 'system' is the default because a patient who has set their phone to dark
// at night has already told us what they want, and asking again is noise.
//
// The choice is persisted, and read back BEFORE the first paint is committed —
// `ready` stays false until then. Without that the app renders light, then flips
// to dark a frame later, which is the flash every themed app gets wrong once.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { storageGet, storageSet } from '@/src/storage';
import { PALETTES, TILES, type Mode, type Palette, type Tile, type TileName } from './tokens';

export type ThemeChoice = 'system' | 'light' | 'dark';

const KEY = 'ui.theme';

interface ThemeValue {
  /** What is actually on screen right now. */
  mode: Mode;
  /** What the user picked; 'system' means "whatever the phone says". */
  choice: ThemeChoice;
  setChoice: (c: ThemeChoice) => void;
  t: Palette;
  tile: (name: TileName) => Tile;
  /** True once the stored choice has been read. Gate the first paint on it. */
  ready: boolean;
}

const Ctx = createContext<ThemeValue | null>(null);

const isChoice = (v: unknown): v is ThemeChoice => v === 'system' || v === 'light' || v === 'dark';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [choice, setChoiceState] = useState<ThemeChoice>('system');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    void storageGet(KEY).then((v) => {
      if (!alive) return;
      if (isChoice(v)) setChoiceState(v);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo<ThemeValue>(() => {
    // `useColorScheme` can be null before the OS reports; treat that as light
    // rather than flickering to dark and back.
    const mode: Mode = choice === 'system' ? (system === 'dark' ? 'dark' : 'light') : choice;
    return {
      mode,
      choice,
      // Write-through: state first so the UI turns over immediately, storage
      // after. A failed write costs the preference next launch, not this tap.
      setChoice: (c) => {
        setChoiceState(c);
        void storageSet(KEY, c);
      },
      t: PALETTES[mode],
      tile: (name) => TILES[mode][name] ?? TILES[mode].neutral,
      ready,
    };
  }, [choice, system, ready]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTheme outside ThemeProvider — wrap the app in <ThemeProvider>.');
  return v;
}

/** `mode === 'dark'`, for the handful of places that branch on it structurally
 *  (a bitmap, a status-bar style) rather than on a colour. */
export function useIsDark(): boolean {
  return useTheme().mode === 'dark';
}
