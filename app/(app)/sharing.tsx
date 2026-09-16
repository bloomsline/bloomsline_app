// c7 — "What your practitioner can see": the moments and journal pages the
// SELECTED practitioner can read, with working Unshare. Wired to GET
// /api/mobile/care/sharing, which filters to the practitioner the app has
// selected; Unshare goes to the endpoint for the item's kind (a journal page is
// not a moment, and the moment endpoint answered 404 for one). Stopping removes
// the selected practitioner only. (Global "pause all sharing" needs a
// user-level flag that doesn't exist yet — deferred.)
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Lock } from 'lucide-react-native';
import { notify } from '@/src/ui/alert';
import { track } from '@/src/analytics/client';
import { EdHeader, EdCard, FadeIn, Kicker } from '@/src/ui/editorial';
import { joinFirstNames } from '@/src/care/practitioner-names';
import { useOnboarding } from '@/src/onboarding/context';
import { fetchSharing, type SharedItem } from '@/src/api/care';
import { shareMoment } from '@/src/api/moments';
import { shareJournal } from '@/src/api/journal';
import { useSelectionReset } from '@/src/care/selected-practitioner';
import { moodLabel } from '@/src/moments/moods';
import { useI18n, fmt, type Locale } from '@/src/i18n';
import { useTheme } from '@/src/ui/theme-mode';
import { LoadFailed } from '@/src/ui/LoadFailed';

const T = {
  en: {
    titleCanSee: 'What {name} can see',
    titleCanSeeMany: 'What {name} can see',
    titleGeneric: 'What your practitioner can see', yourPractitioner: 'your practitioner', kicker: 'Sharing',
    updateError: 'Could not update. Please try again.',
    sharedWith: 'Shared with {name} ({count})',
    emptyBody: 'Nothing is shared right now. You choose what to share from each moment and journal page.',
    page: 'Journal page',
    unshare: 'Unshare',
    privacyNote: "Your private moments, journal and chats stay with you, only what's listed here is shared.",
    note: 'Note',
    moment: 'Moment',
  },
  fr: {
    titleCanSee: 'Ce que {name} peut voir',
    titleCanSeeMany: 'Ce que {name} peuvent voir',
    titleGeneric: 'Ce que votre praticien peut voir', yourPractitioner: 'votre praticien', kicker: 'Partage',
    updateError: 'Impossible de mettre à jour. Veuillez réessayer.',
    sharedWith: 'Partagé avec {name} ({count})',
    emptyBody: 'Rien n\'est partagé pour le moment. Vous choisissez ce que vous partagez depuis chaque moment et chaque page de journal.',
    page: 'Page de journal',
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
  // Who the list is about. With the switcher that is the selected practitioner,
  // and the server has already filtered to them, so the title names them and no
  // one else. It used to guess the readers by matching display names against
  // each item's `sharedWith`, which broke on two practitioners with one name
  // and on any name edited since the share. An older server sends every linked
  // name here, and every one of them is who its list is about.
  //
  // It fell back to "Maya" — a preview placeholder — for a real patient whose
  // practitioner's name had not loaded.
  const { practitionerName, practitionerNames } = useOnboarding();
  const [items, setItems] = useState<SharedItem[] | null>(null);
  const pracNames = practitionerNames.length ? practitionerNames : practitionerName ? [practitionerName] : [];
  const first = joinFirstNames(pracNames, locale);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  // Another practitioner, another list: empty it at once so the previous one's
  // shares never sit under the new name while the new list loads.
  const selectionKey = useSelectionReset(() => { setItems(null); setFailed(false); setBusy(null); });

  useEffect(() => {
    let alive = true;
    // A failed read is not an empty one (see LoadFailed).
    fetchSharing().then((v) => { if (!alive) return; if (v) { setItems(v); setFailed(false); } else setFailed(true); });
    return () => { alive = false; };
  }, [attempt, selectionKey]);

  const unshare = async (it: SharedItem) => {
    if (busy) return;
    const id = it.id;
    setBusy(id);
    try {
      // Each kind has its own endpoint. Absent `kind` is an older server,
      // which only ever listed moments.
      if (it.kind === 'journal') await shareJournal(id, false);
      else await shareMoment(id, false);
      track(it.kind === 'journal' ? 'journal_unshared' : 'moment_unshared', { from: 'sharing' });
      setItems((prev) => (prev ? prev.filter((x) => !(x.id === id && x.kind === it.kind)) : prev));
    } catch {
      notify(tr.updateError);
    }
    setBusy(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: TT.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <EdHeader kicker={tr.kicker} title={first ? fmt(pracNames.length > 1 ? tr.titleCanSeeMany : tr.titleCanSee, { name: first }) : tr.titleGeneric} onBack={() => router.back()} />
        <FadeIn style={{ paddingHorizontal: 22, paddingTop: 20 }}>
          {items === null ? (
            failed ? <LoadFailed onRetry={() => { setFailed(false); setAttempt((a) => a + 1); }} />
            : <View style={{ paddingTop: 40, alignItems: 'center' }}><ActivityIndicator color={TT.accent} /></View>
          ) : (
            <>
              <Kicker color={TT.faint} style={{ marginBottom: 12 }}>{fmt(tr.sharedWith, { name: first || tr.yourPractitioner, count: items.length })}</Kicker>

              {items.length === 0 ? (
                <EdCard style={{ alignItems: 'center', padding: 20, marginBottom: 18 }}>
                  <Text style={{ fontSize: 13.5, color: TT.inkSoft, textAlign: 'center', lineHeight: 19 }}>{tr.emptyBody}</Text>
                </EdCard>
              ) : (
                <View style={{ gap: 10, marginBottom: 18 }}>
                  {items.map((it) => (
                    <View key={`${it.kind ?? 'moment'}-${it.id}`} style={{ backgroundColor: TT.card, borderWidth: 1, borderColor: TT.line, borderRadius: 18, padding: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: TT.accent }} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: TT.ink }} numberOfLines={1}>{label(it, tr, locale)}</Text>
                        <Text style={{ fontSize: 12, color: TT.inkSoft, marginTop: 1 }}>{it.kind === 'journal' ? `${tr.page} · ${when(it.when, locale)}` : when(it.when, locale)}</Text>
                      </View>
                      <TouchableOpacity onPress={() => unshare(it)} hitSlop={8} disabled={busy === it.id}>
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
  // A page is known by its title, which is what the patient named it; its
  // opening words when it has none.
  if (it.kind === 'journal') {
    const title = it.title?.trim();
    if (title) return title;
    if (it.text) return it.text.length > 40 ? `${it.text.slice(0, 40)}…` : it.text;
    return tr.page;
  }
  if (it.moods && it.moods.length > 0) return `${tr.note} · ${moodLabel(it.moods[0], locale)}`;
  if (it.text) return it.text.length > 40 ? `${it.text.slice(0, 40)}…` : it.text;
  return tr.moment;
}
function when(iso: string, locale: Locale): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString(locale, { weekday: 'short' })}, ${d.toLocaleTimeString(locale === 'fr' ? 'fr' : [], { hour: '2-digit', minute: '2-digit' })}`;
}
