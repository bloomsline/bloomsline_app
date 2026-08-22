// c7 — "What your practitioner can see": the patient's currently-shared moments,
// with working Unshare. Wired to GET /api/mobile/care/sharing +
// POST /api/moments/[id]/share {shared:false}. (Global "pause all sharing" needs
// a user-level flag that doesn't exist yet — deferred.)
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Lock } from 'lucide-react-native';
import { EdHeader, EdCard, FadeIn, MonoLabel } from '@/src/ui/editorial';
import { useOnboarding } from '@/src/onboarding/context';
import { fetchSharing, type SharedItem } from '@/src/api/care';
import { shareMoment } from '@/src/api/moments';
import { moodLabel } from '@/src/moments/moods';
import { useI18n, fmt, type Locale } from '@/src/i18n';
import { useTheme } from '@/src/ui/theme-mode';

const T = {
  en: {
    titleCanSee: 'What {name} can see',
    updateError: 'Could not update. Please try again.',
    sharedWith: 'Shared with {name} ({count})',
    emptyBody: 'Nothing is shared right now. You choose what to share from each moment.',
    unshare: 'Unshare',
    privacyNote: "Your private moments, journal and chats stay with you, only what's listed here is shared.",
    note: 'Note',
    moment: 'Moment',
  },
  fr: {
    titleCanSee: 'Ce que {name} peut voir',
    updateError: 'Impossible de mettre à jour. Veuillez réessayer.',
    sharedWith: 'Partagé avec {name} ({count})',
    emptyBody: 'Rien n\'est partagé pour le moment. Vous choisissez ce que vous partagez depuis chaque moment.',
    unshare: 'Ne plus partager',
    privacyNote: 'Vos moments privés, votre journal et vos échanges restent avec vous, seul ce qui est listé ici est partagé.',
    note: 'Note',
    moment: 'Moment',
  },
} as const;

export default function Sharing() {
  const { t: TT } = useTheme();
  const router = useRouter();
  const { locale } = useI18n();
  const tr = T[locale];
  const { practitionerName } = useOnboarding();
  const first = (practitionerName ?? 'Dr. Maya').replace(/^dr\.?\s*/i, '').split(/\s+/)[0];
  const [items, setItems] = useState<SharedItem[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchSharing().then((s) => { if (alive) setItems(s ?? []); });
    return () => { alive = false; };
  }, []);

  const unshare = async (id: string) => {
    if (busy) return;
    setBusy(id);
    try {
      await shareMoment(id, false);
      setItems((prev) => (prev ? prev.filter((x) => x.id !== id) : prev));
    } catch {
      if (Platform.OS === 'web') globalThis.alert?.(tr.updateError);
    }
    setBusy(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: TT.bg }}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <EdHeader kicker="SHARING" title={fmt(tr.titleCanSee, { name: first })} onBack={() => router.back()} />
        <FadeIn style={{ paddingHorizontal: 22, paddingTop: 20 }}>
          {items === null ? (
            <View style={{ paddingTop: 40, alignItems: 'center' }}><ActivityIndicator color={TT.accent} /></View>
          ) : (
            <>
              <MonoLabel color={TT.faint} style={{ marginBottom: 12 }}>{fmt(tr.sharedWith, { name: first, count: items.length })}</MonoLabel>

              {items.length === 0 ? (
                <EdCard style={{ alignItems: 'center', padding: 20, marginBottom: 18 }}>
                  <Text style={{ fontSize: 13.5, color: TT.inkSoft, textAlign: 'center', lineHeight: 19 }}>{tr.emptyBody}</Text>
                </EdCard>
              ) : (
                <View style={{ gap: 10, marginBottom: 18 }}>
                  {items.map((it) => (
                    <View key={it.id} style={{ backgroundColor: TT.card, borderWidth: 1, borderColor: TT.line, borderRadius: 18, padding: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: TT.accent }} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: TT.ink }} numberOfLines={1}>{label(it, tr, locale)}</Text>
                        <Text style={{ fontSize: 12, color: TT.inkSoft, marginTop: 1 }}>{when(it.when, locale)}</Text>
                      </View>
                      <TouchableOpacity onPress={() => unshare(it.id)} hitSlop={8} disabled={busy === it.id}>
                        {busy === it.id ? <ActivityIndicator size="small" color={TT.accent} /> : <Text style={{ fontSize: 13, color: TT.accent, fontWeight: '700' }}>{tr.unshare}</Text>}
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              <View style={{ backgroundColor: TT.accentTint, borderRadius: 18, padding: 16, flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                <Lock size={15} color={TT.accentDeep} strokeWidth={2} />
                <Text style={{ flex: 1, fontSize: 13, color: TT.accentDeep, lineHeight: 19 }}>
                  {tr.privacyNote}
                </Text>
              </View>
            </>
          )}
        </FadeIn>
      </ScrollView>
    </View>
  );
}

function label(it: SharedItem, tr: (typeof T)[Locale], locale: Locale): string {
  if (it.moods && it.moods.length > 0) return `${tr.note} · ${moodLabel(it.moods[0], locale)}`;
  if (it.text) return it.text.length > 40 ? `${it.text.slice(0, 40)}…` : it.text;
  return tr.moment;
}
function when(iso: string, locale: Locale): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString(locale, { weekday: 'short' })}, ${d.toLocaleTimeString(locale === 'fr' ? 'fr' : [], { hour: '2-digit', minute: '2-digit' })}`;
}
