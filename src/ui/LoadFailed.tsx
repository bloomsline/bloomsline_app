// What a screen shows when it could not load, instead of pretending it has
// nothing.
//
// Screen after screen turned a failed request into an empty list: offline, or
// during a deploy, a patient read "Nothing is shared right now", "No past
// sessions yet", "Nothing here yet"; a practitioner read "Patient not found" or
// "Bloom Pulse is off". Each of those is a statement about their care, and each
// was untrue. This says what actually happened and offers the one thing to do.
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useState } from 'react';
import { useI18n } from '@/src/i18n';
import { useTheme } from '@/src/ui/theme-mode';

const T = {
  en: { body: 'Could not load this. Check your connection and try again.', retry: 'Try again' },
  fr: { body: 'Chargement impossible. Vérifiez votre connexion et réessayez.', retry: 'Réessayer' },
} as const;

export function LoadFailed({ onRetry, compact = false }: { onRetry: () => void | Promise<unknown>; compact?: boolean }) {
  const { t: TT } = useTheme();
  const { locale } = useI18n();
  const tr = T[locale] ?? T.en;
  const [trying, setTrying] = useState(false);
  const retry = async () => {
    if (trying) return;
    setTrying(true);
    try { await onRetry(); } finally { setTrying(false); }
  };
  return (
    <View style={{ alignItems: 'center', paddingVertical: compact ? 14 : 36, paddingHorizontal: 12, gap: 12 }}>
      <Text style={{ fontSize: 14, lineHeight: 20, color: TT.inkSoft, textAlign: 'center' }}>{tr.body}</Text>
      <Pressable
        onPress={() => { void retry(); }}
        accessibilityRole="button"
        style={{ height: 38, minWidth: 120, paddingHorizontal: 18, borderRadius: 19, backgroundColor: TT.ctaBg, alignItems: 'center', justifyContent: 'center' }}
      >
        {trying ? <ActivityIndicator color={TT.ctaFg} /> : <Text style={{ fontSize: 14, fontWeight: '700', color: TT.ctaFg }}>{tr.retry}</Text>}
      </Pressable>
    </View>
  );
}
