import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { History } from 'lucide-react-native';
import { EdHeader, EdCard, FadeIn } from '@/src/ui/editorial';
import { Block } from '@/src/resources/blocks';
import { fileUrlIndex } from '@/src/resources/answers';
import { useI18n } from '@/src/i18n';
import { fetchDay, fetchSubmission, type SubmissionDetail } from '@/src/api/practitioner';
import { useTheme } from '@/src/ui/theme-mode';
import { usePracticeZone } from '@/src/practitioner/practice-zone';
import { LoadFailed } from '@/src/ui/LoadFailed';

// One submission, read-only.
//
// Rendered against the version it was ANSWERED ON, which is the whole reason
// this screen is not just "the resource with values filled in". A resource
// edited since would have different questions, and drawing old answers against
// new ones silently reattributes them — answer three appearing under a question
// the patient never saw. The banner says which version, because a practitioner
// reading something that looks subtly wrong deserves to know why.
const T = {
  en: {
    kicker: 'SUBMISSION', pinned: 'Rendered against the version this was answered on.',
    missing: 'This submission is no longer available. It may have been deleted.', note: 'YOUR NOTE BACK',
    onEarlier: (d: string) => `Written on ${d}, about the earlier answers. These were sent since.`,
    sources: { app: 'App', web: 'Web', share: 'Shared link', link: 'Shared link' },
  },
  fr: {
    kicker: 'RÉPONSE', pinned: 'Affiché selon la version utilisée pour répondre.',
    missing: 'Cette réponse n’est plus disponible. Elle a peut-être été supprimée.', note: 'VOTRE RETOUR',
    onEarlier: (d: string) => `Écrit le ${d}, sur les réponses précédentes. Celles-ci ont été envoyées depuis.`,
    sources: { app: 'App', web: 'Web', share: 'Lien partagé', link: 'Lien partagé' },
  },
} as const;

export default function SubmissionScreen() {
  const { t: TT } = useTheme();
  const router = useRouter();
  const { locale } = useI18n();
  const zone = usePracticeZone(fetchDay);
  const tr = T[locale] ?? T.en;
  const { id } = useLocalSearchParams<{ id: string }>();

  const [view, setView] = useState<SubmissionDetail | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [gone, setGone] = useState(false);

  // A different id is a different screen: never show the last one while this loads.
  useEffect(() => { setView(null); setLoaded(false); setGone(false); }, [id]);

  const load = useCallback(async (alive: () => boolean = () => true) => {
    const v = await fetchSubmission(String(id));
    if (!alive()) return;
    setGone(v === 'gone');
    // A failed refresh keeps what is already on screen.
    if (v !== 'gone') setView((prev) => v ?? prev);
    else setView(null);
    setLoaded(true);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void load(() => alive);
      return () => { alive = false; };
    }, [load]),
  );

  // Every file of an answer by its storage key (see `urlsByKey`); an older
  // server's single `mediaUrls` link still reaches the first file.
  const fileUrls = useMemo(() => (view ? fileUrlIndex(view.version.blocks, view.answers, view.fileUrls, view.mediaUrls) : {}), [view]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/(practitioner)/submissions' as never));
  const loc = locale === 'fr' ? 'fr-FR' : 'en-GB';
  const when = view?.submittedAt
    ? new Date(view.submittedAt).toLocaleString(loc, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', ...zone })
    : '';

  return (
    <View style={{ flex: 1, backgroundColor: TT.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <EdHeader kicker={tr.kicker} title={view?.who ?? ''} onBack={back} />

        <FadeIn style={{ paddingHorizontal: 22, paddingTop: 18 }}>
          {!loaded && <ActivityIndicator />}
          {loaded && !view && gone && <Text style={{ fontSize: 14, color: TT.inkSoft }}>{tr.missing}</Text>}
          {loaded && !view && !gone && <LoadFailed onRetry={() => load()} />}

          {view && (
            <>
              <EdCard style={{ marginBottom: 14 }}>
                <Text numberOfLines={3} style={{ fontSize: 15, fontWeight: '700', color: TT.ink }}>{view.resourceTitle}</Text>
                <Text style={{ fontSize: 12.5, color: TT.faint, marginTop: 4 }}>
                  {when} · {tr.sources[view.source as keyof typeof tr.sources] ?? view.source}
                </Text>
                {view.score && (
                  <Text style={{ fontSize: 14, fontWeight: '800', color: TT.accent, marginTop: 6 }}>
                    {view.score.total}/{view.score.maxScore}{view.score.label ? ` · ${view.score.label}` : ''}
                  </Text>
                )}
              </EdCard>

              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginBottom: 18, paddingHorizontal: 2 }}>
                <History size={13} color={TT.faint} style={{ marginTop: 2 }} />
                <Text style={{ flex: 1, fontSize: 12, lineHeight: 18, color: TT.faint }}>{tr.pinned}</Text>
              </View>

              {view.version.blocks.map((b) => (
                <Block
                  key={b.id}
                  block={b}
                  value={view.answers[b.id]}
                  onChange={() => {}}
                  missing={false}
                  readOnly
                  mediaUrl={view.mediaUrls?.[b.id]}
                  fileUrls={fileUrls}
                />
              ))}

              {view.practitionerNote ? (
                <View style={{ marginTop: 22 }}>
                  <Text style={{ fontSize: 12.5, fontWeight: '700', letterSpacing: 0.2, color: TT.faint, marginBottom: 8 }}>{tr.note}</Text>
                  <EdCard>
                    {view.noteOnEarlierAnswers && view.noteWrittenAt ? (
                      <Text style={{ fontSize: 12, color: TT.faint, marginBottom: 6 }}>
                        {tr.onEarlier(new Date(view.noteWrittenAt).toLocaleDateString(loc, { day: 'numeric', month: 'long', ...zone }))}
                      </Text>
                    ) : null}
                    <Text style={{ fontSize: 14.5, lineHeight: 21, color: TT.ink }}>{view.practitionerNote}</Text>
                  </EdCard>
                </View>
              ) : null}
            </>
          )}
        </FadeIn>
      </ScrollView>
    </View>
  );
}
