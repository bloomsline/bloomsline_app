import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Eye } from 'lucide-react-native';
import { EdHeader, EdCard, EdPill, FadeIn } from '@/src/ui/editorial';
import { Block, ResourceIntro } from '@/src/resources/blocks';
import { useI18n } from '@/src/i18n';
import { fetchResourcePreview, type ResourcePreview } from '@/src/api/practitioner';
import { useTheme } from '@/src/ui/theme-mode';

// See the exercise before you send it.
//
// Sharing used to be decided from a title and two truncated lines. That is
// enough to recognise something you wrote last week and nothing else — and when
// the guess is wrong the cost lands on the patient, who opens the wrong
// worksheet.
//
// The same renderer the patient's app uses, in readOnly: everything visible,
// nothing editable. Anything else would be a second renderer to keep in step
// with the first, and the drift would show up as a preview that quietly stopped
// matching what patients actually receive.
const T = {
  en: {
    kicker: 'PREVIEW', chip: 'This is how it looks to your patient. Nothing here is saved.',
    share: 'Share this resource', missing: 'This resource could not be loaded.',
  },
  fr: {
    kicker: 'APERÇU', chip: 'Voici ce que voit votre patient. Rien n’est enregistré ici.',
    share: 'Partager cette ressource', missing: 'Impossible de charger cette ressource.',
  },
} as const;

export default function ResourcePreviewScreen() {
  const { t: TT } = useTheme();
  const router = useRouter();
  const { locale } = useI18n();
  const tr = T[locale] ?? T.en;
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();

  const [view, setView] = useState<ResourcePreview | null>(null);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setLoaded(false);
      void fetchResourcePreview(String(id)).then((v) => {
        if (!alive) return;
        setView(v);
        setLoaded(true);
      });
      return () => { alive = false; };
    }, [id]),
  );

  const back = () => (router.canGoBack() ? router.back() : router.navigate('/(practitioner)/resources' as never));

  return (
    <View style={{ flex: 1, backgroundColor: TT.bg }}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <EdHeader kicker={tr.kicker} title={view?.resource.title ?? title ?? ''} onBack={back} />

        <FadeIn style={{ paddingHorizontal: 22, paddingTop: 18 }}>
          {/* Says plainly that this is a preview. The same words the web uses,
              because a practitioner who has seen one should recognise the other. */}
          <EdCard style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 18, backgroundColor: TT.accentTint, borderColor: TT.accentTint }}>
            <Eye size={15} color={TT.accentDeep} style={{ marginTop: 1 }} />
            <Text style={{ flex: 1, fontSize: 13, lineHeight: 19, color: TT.accentDeep }}>{tr.chip}</Text>
          </EdCard>

          {!loaded && <ActivityIndicator />}
          {loaded && !view && <Text style={{ fontSize: 14, color: TT.inkSoft }}>{tr.missing}</Text>}

          {view && (
            <>
              <ResourceIntro text={view.resource.description} />
              {view.version.blocks.map((b) => (
                <Block
                  key={b.id}
                  block={b}
                  value={undefined}
                  onChange={() => {}}
                  missing={false}
                  readOnly
                  mediaUrl={view.mediaUrls?.[b.id]}
                />
              ))}

              <EdPill
                label={tr.share}
                variant="green"
                onPress={() => router.navigate({ pathname: '/(practitioner)/resources', params: { shareId: view.resource.id } } as never)}
                style={{ marginTop: 24 }}
              />
            </>
          )}
        </FadeIn>
      </ScrollView>
    </View>
  );
}
