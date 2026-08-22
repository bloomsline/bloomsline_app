import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronRight, FileText, User } from 'lucide-react-native';
import { EdHeader, EdCard, EdSection, FadeIn } from '@/src/ui/editorial';
import { useI18n } from '@/src/i18n';
import { fetchSubmissionGroups, fetchSubmissions, type SubmissionGroups, type SubmissionSummary } from '@/src/api/practitioner';
import { useTheme } from '@/src/ui/theme-mode';

// What patients have sent back.
//
// Grouped by RESOURCE by default, because that is the question asked first:
// "did the worksheet I sent out come back?". By patient answers a different and
// rarer one — "what has this person done?" — which is really a question about
// the person. Both are here because both get asked; the order is the frequency.
//
// Arriving from a resource's count skips the grouping entirely and opens that
// resource's list, because the choice was already made by the tap.
const T = {
  en: {
    kicker: 'SUBMISSIONS', title: 'What came back',
    byResource: 'By resource', byPatient: 'By patient',
    empty: 'Nothing submitted yet.', emptyOne: 'No submissions for this one yet.',
    one: 'submission', many: 'submissions',
    sources: { app: 'App', web: 'Web', link: 'Shared link' },
  },
  fr: {
    kicker: 'RÉPONSES', title: 'Ce qui est revenu',
    byResource: 'Par ressource', byPatient: 'Par patient',
    empty: 'Aucune réponse pour l’instant.', emptyOne: 'Aucune réponse pour celle-ci.',
    one: 'réponse', many: 'réponses',
    sources: { app: 'App', web: 'Web', link: 'Lien partagé' },
  },
} as const;

export default function Submissions() {
  const { t: TT } = useTheme();
  const router = useRouter();
  const { locale } = useI18n();
  const tr = T[locale] ?? T.en;
  const params = useLocalSearchParams<{ resourceId?: string; memberId?: string; title?: string }>();

  const focusResource = typeof params.resourceId === 'string' ? params.resourceId : null;
  const focusMember = typeof params.memberId === 'string' ? params.memberId : null;
  const focused = focusResource || focusMember;

  const [mode, setMode] = useState<'resource' | 'patient'>('resource');
  const [groups, setGroups] = useState<SubmissionGroups | null>(null);
  const [items, setItems] = useState<SubmissionSummary[]>([]);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (focused) return;
      let alive = true;
      setLoaded(false);
      void fetchSubmissionGroups().then((g) => {
        if (!alive) return;
        setGroups(g);
        setLoaded(true);
      });
      return () => { alive = false; };
    }, [focused]),
  );

  useEffect(() => {
    if (!focused) return;
    let alive = true;
    setLoaded(false);
    void fetchSubmissions({ resourceId: focusResource ?? undefined, memberId: focusMember ?? undefined }).then((rows) => {
      if (!alive) return;
      setItems(rows ?? []);
      setLoaded(true);
    });
    return () => { alive = false; };
  }, [focused, focusResource, focusMember]);

  const back = () => (router.canGoBack() ? router.back() : router.navigate('/(practitioner)/resources' as never));
  const loc = locale === 'fr' ? 'fr-FR' : 'en-GB';
  const when = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(loc, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

  const rows = mode === 'resource' ? (groups?.byResource ?? []) : (groups?.byPatient ?? []);

  return (
    <View style={{ flex: 1, backgroundColor: TT.bg }}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <EdHeader kicker={tr.kicker} title={focused ? (params.title ?? tr.title) : tr.title} onBack={back} />

        <FadeIn style={{ paddingHorizontal: 22, paddingTop: 18 }}>
          {!focused && (
            <View style={{ flexDirection: 'row', gap: 9, marginBottom: 18 }}>
              <Toggle Icon={FileText} label={tr.byResource} on={mode === 'resource'} onPress={() => setMode('resource')} />
              <Toggle Icon={User} label={tr.byPatient} on={mode === 'patient'} onPress={() => setMode('patient')} />
            </View>
          )}

          {!loaded && <ActivityIndicator />}

          {/* grouped */}
          {loaded && !focused && rows.length === 0 && <Text style={{ fontSize: 14, color: TT.inkSoft }}>{tr.empty}</Text>}
          {loaded && !focused && rows.map((r) => {
            const name = 'title' in r ? r.title : r.name;
            return (
              <EdCard
                key={r.id}
                onPress={() => router.navigate({
                  pathname: '/(practitioner)/submissions',
                  params: mode === 'resource' ? { resourceId: r.id, title: name } : { memberId: r.id, title: name },
                } as never)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}
              >
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={2} style={{ fontSize: 15, fontWeight: '700', color: TT.ink }}>{name}</Text>
                  <Text style={{ fontSize: 12.5, color: TT.accent, marginTop: 3, fontWeight: '700' }}>
                    {r.count} {r.count === 1 ? tr.one : tr.many}
                  </Text>
                </View>
                <ChevronRight size={17} color={TT.faint} />
              </EdCard>
            );
          })}

          {/* one resource's or one patient's submissions */}
          {loaded && focused && items.length === 0 && <Text style={{ fontSize: 14, color: TT.inkSoft }}>{tr.emptyOne}</Text>}
          {loaded && focused && items.length > 0 && <EdSection label={`${items.length} ${items.length === 1 ? tr.one : tr.many}`.toUpperCase()} />}
          {loaded && focused && items.map((s) => (
            <EdCard
              key={s.id}
              onPress={() => router.navigate({ pathname: '/(practitioner)/submission', params: { id: s.id } } as never)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}
            >
              <View style={{ flex: 1 }}>
                {/* Whichever the list is NOT grouped by is the useful headline:
                    a resource's list wants names, a patient's wants titles. */}
                <Text numberOfLines={2} style={{ fontSize: 15, fontWeight: '700', color: TT.ink }}>
                  {focusResource ? s.who : s.resourceTitle}
                </Text>
                <Text style={{ fontSize: 12.5, color: TT.faint, marginTop: 3 }}>
                  {when(s.submittedAt)} · {tr.sources[s.source as keyof typeof tr.sources] ?? s.source}
                </Text>
                {s.score && (
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: TT.accent, marginTop: 3 }}>
                    {s.score.total}/{s.score.maxScore}{s.score.label ? ` · ${s.score.label}` : ''}
                  </Text>
                )}
              </View>
              <ChevronRight size={17} color={TT.faint} />
            </EdCard>
          ))}
        </FadeIn>
      </ScrollView>
    </View>
  );
}

function Toggle({ Icon, label, on, onPress }: { Icon: typeof FileText; label: string; on: boolean; onPress: () => void }) {
  const { t: TT } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: on ? TT.accentTint : TT.card, borderWidth: 1.5, borderColor: on ? TT.accent : TT.line }}
    >
      <Icon size={14} color={on ? TT.accentDeep : TT.inkSoft} />
      <Text style={{ fontSize: 13.5, fontWeight: '700', color: on ? TT.accentDeep : TT.inkSoft }}>{label}</Text>
    </Pressable>
  );
}
