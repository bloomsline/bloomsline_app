// Journal — v2. The list, and the empty state.
//
// THE ONE SCREEN WITH NO PHOTOGRAPH. Every other v2 surface is a picture; this
// one is a plain dark head over light paper. That is the argument, not a saving:
// this is the place nobody else looks, and a closed, imageless surface says so
// before the word "Private" does.
//
// The paper below is deliberately the lighter world — writing happens on paper,
// and the contrast is what makes the page feel like a page.
import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronLeft, Lock, Search, PenLine, Plus, ChevronRight, MessageCircle, Sparkles, CalendarDays, type LucideIcon } from 'lucide-react-native';
import { MonoLabel } from '@/src/ui/editorial';
import { useOnboarding } from '@/src/onboarding/context';
import { useI18n } from '@/src/i18n';
import { listJournal, createJournal, type JournalEntry } from '@/src/api/journal';
import { useTheme } from '@/src/ui/theme-mode';
import { veil } from '@/src/ui/tokens';

/** The three openings offered when there is nothing yet. Each creates a page
 *  titled with the prompt, so the blank screen is never the first thing. */
const PROMPTS: { key: 'session' | 'good' | 'mind'; Icon: LucideIcon }[] = [
  { key: 'session', Icon: CalendarDays },
  { key: 'good', Icon: Sparkles },
  { key: 'mind', Icon: MessageCircle },
];

export default function Journal() {
  const { t: TT, mode } = useTheme();
  const router = useRouter();
  const { t, locale } = useI18n();
  const { practitionerName } = useOnboarding();
  const tr = t.journal;

  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await listJournal();
      if (list) { setEntries(list); setFailed(false); } else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const open = (id: string) => router.navigate({ pathname: '/journal-entry', params: { id } } as never);

  const startPage = async (title: string | null) => {
    if (creating) return;
    setCreating(true);
    try {
      const made = await createJournal({ title, blocks: [] });
      if (made) open(made.id);
    } finally {
      setCreating(false);
    }
  };

  // Search is client-side over the flattened preview the API already returns —
  // the same text the list shows, so what you read is what you search.
  const needle = q.trim().toLowerCase();
  const shown = (entries ?? []).filter(
    (e) => !needle || (e.title ?? '').toLowerCase().includes(needle) || e.body.toLowerCase().includes(needle),
  );

  return (
    <View style={{ flex: 1, backgroundColor: TT.bg }}>
      <StatusBar style="light" />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* The head: dark, and pointedly without an image. */}
        <View style={{ paddingHorizontal: 22, paddingTop: 6, paddingBottom: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
            <TouchableOpacity
              onPress={() => (router.canGoBack() ? router.back() : router.navigate('/for-you' as never))}
              style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: veil(mode, 0.10), alignItems: 'center', justifyContent: 'center' }}
            >
              <ChevronLeft size={18} color={TT.ink} strokeWidth={2} />
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: veil(mode, 0.10), alignItems: 'center', justifyContent: 'center' }}>
              <Lock size={16} color={TT.inkSoft} strokeWidth={2} />
            </View>
          </View>
          <MonoLabel color={TT.faint} size={10.5} style={{ marginBottom: 8 }}>{tr.kicker}</MonoLabel>
          <Text style={{ fontSize: 30, fontWeight: '800', color: TT.ink, letterSpacing: -1 }}>{tr.title}</Text>
          <Text style={{ marginTop: 8, fontSize: 13.5, color: TT.inkSoft, lineHeight: 20, maxWidth: 300 }}>{tr.subtitle}</Text>
        </View>

        {/* The paper. */}
        <View style={{ flex: 1, backgroundColor: TT.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: 'hidden' }}>
          {entries === null && !failed ? (
            <View style={{ paddingTop: 60, alignItems: 'center' }}>
              <ActivityIndicator color={TT.faint} />
            </View>
          ) : failed ? (
            <View style={{ paddingHorizontal: 34, paddingTop: 56, alignItems: 'center' }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: TT.ink, textAlign: 'center' }}>{tr.failedTitle}</Text>
              <Text style={{ marginTop: 6, fontSize: 13.5, color: TT.inkSoft, textAlign: 'center', lineHeight: 20 }}>{tr.failedBody}</Text>
              <TouchableOpacity
                onPress={() => { setFailed(false); setEntries(null); void load(); }}
                style={{ marginTop: 18, height: 44, paddingHorizontal: 26, borderRadius: 22, borderWidth: 1, borderColor: TT.line, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: TT.ink }}>{t.common.retry}</Text>
              </TouchableOpacity>
            </View>
          ) : (entries ?? []).length === 0 ? (
            <EmptyState tr={tr} onBlank={() => startPage(null)} onPrompt={(k) => startPage(tr.prompts[k])} busy={creating} />
          ) : (
            <>
              <ScrollView
                contentContainerStyle={{ padding: 18, paddingBottom: 120 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: TT.card, borderWidth: 1, borderColor: TT.line, borderRadius: 14, paddingHorizontal: 14, height: 44, marginBottom: 14 }}>
                  <Search size={16} color={TT.faint} strokeWidth={2} />
                  <TextInput
                    value={q}
                    onChangeText={setQ}
                    placeholder={tr.find}
                    placeholderTextColor={TT.faint}
                    style={[{ flex: 1, fontSize: 14.5, color: TT.ink }, { outlineStyle: 'none' } as never]}
                  />
                </View>

                {shown.length === 0 ? (
                  <Text style={{ paddingTop: 26, textAlign: 'center', fontSize: 13.5, color: TT.inkSoft }}>{tr.noMatch}</Text>
                ) : (
                  <View style={{ gap: 10 }}>
                    {shown.map((e) => (
                      <EntryCard key={e.id} entry={e} locale={locale} tr={tr} pracName={practitionerName} onPress={() => open(e.id)} />
                    ))}
                  </View>
                )}
              </ScrollView>

              <TouchableOpacity
                onPress={() => startPage(null)}
                disabled={creating}
                activeOpacity={0.9}
                style={{ position: 'absolute', right: 18, bottom: 26, flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, paddingHorizontal: 20, borderRadius: 24, backgroundColor: TT.accent, opacity: creating ? 0.6 : 1 }}
              >
                <PenLine size={16} color={TT.onAccent} strokeWidth={2.2} />
                <Text style={{ fontSize: 14.5, fontWeight: '700', color: TT.onAccent }}>{tr.newPage}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

function EntryCard({
  entry, locale, tr, pracName, onPress,
}: {
  entry: JournalEntry;
  locale: 'en' | 'fr';
  tr: Jr;
  pracName: string | null;
  onPress: () => void;
}) {
  const { t: TT } = useTheme();
  const initial = (pracName ?? '').replace(/^dr\.?\s*/i, '').trim().charAt(0).toUpperCase() || 'M';
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{ backgroundColor: TT.card, borderWidth: 1, borderColor: TT.line, borderRadius: 16, padding: 16 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        <Text style={{ flex: 1, fontSize: 11.5, color: TT.faint }}>{whenLabel(entry.updatedAt, locale, tr)}</Text>
        {/* A page that has been sent carries the face of who can read it — the
            one place this screen admits anyone else exists. */}
        {entry.sharedWithPractitioner ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 4, paddingRight: 10, height: 24, borderRadius: 12, backgroundColor: TT.accentTint }}>
            <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: TT.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 9.5, fontWeight: '800', color: TT.onAccent }}>{initial}</Text>
            </View>
            <Text style={{ fontSize: 11, fontWeight: '700', color: TT.accentDeep }}>{tr.shared}</Text>
          </View>
        ) : null}
      </View>
      <Text style={{ fontSize: 16.5, fontWeight: '800', color: TT.ink, letterSpacing: -0.3 }}>{entry.title?.trim() || tr.untitled}</Text>
      {entry.body.trim() ? (
        <Text numberOfLines={2} style={{ marginTop: 5, fontSize: 13, color: TT.inkSoft, lineHeight: 19 }}>{entry.body.trim()}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

function EmptyState({
  tr, onBlank, onPrompt, busy,
}: {
  tr: Jr;
  onBlank: () => void;
  onPrompt: (k: 'session' | 'good' | 'mind') => void;
  busy: boolean;
}) {
  const { t: TT } = useTheme();
  return (
    <ScrollView contentContainerStyle={{ padding: 22, paddingTop: 40 }} showsVerticalScrollIndicator={false}>
      <TouchableOpacity onPress={onBlank} disabled={busy} activeOpacity={0.8} style={{ alignSelf: 'center', width: 62, height: 62, borderRadius: 20, backgroundColor: TT.accentTint, alignItems: 'center', justifyContent: 'center' }}>
        <Plus size={26} color={TT.accent} strokeWidth={2.2} />
      </TouchableOpacity>
      <Text style={{ marginTop: 16, textAlign: 'center', fontSize: 19, fontWeight: '800', color: TT.ink, letterSpacing: -0.3 }}>{tr.startHere}</Text>
      <Text style={{ marginTop: 4, textAlign: 'center', fontSize: 13.5, color: TT.inkSoft }}>{tr.orGuide}</Text>

      <View style={{ marginTop: 22, gap: 10 }}>
        {PROMPTS.map(({ key, Icon }) => (
          <TouchableOpacity
            key={key}
            onPress={() => onPrompt(key)}
            disabled={busy}
            activeOpacity={0.85}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: TT.card, borderWidth: 1, borderColor: TT.line, borderRadius: 14, paddingHorizontal: 14, height: 54 }}
          >
            <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: TT.accentTint, alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={15} color={TT.accent} strokeWidth={2} />
            </View>
            <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: TT.ink }}>{tr.prompts[key]}</Text>
            <ChevronRight size={17} color={TT.faint} strokeWidth={2} />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

/** "Today" / "Yesterday" / a short date — the list is read by recency. */
function whenLabel(iso: string, locale: 'en' | 'fr', tr: Jr): string {
  const d = new Date(iso);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(new Date()) - startOf(d)) / 86400000);
  if (days <= 0) return tr.today;
  if (days === 1) return tr.yesterday;
  return d.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' });
}

type Jr = ReturnType<typeof useI18n>['t']['journal'];
