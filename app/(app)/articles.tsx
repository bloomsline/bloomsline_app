// Articles — blog posts written by the patient's own practitioner(s).
//
// Read-only and unrecorded: nothing is logged about opening one. Wired to
// GET /api/mobile/blog.
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight, BookOpen, Languages } from 'lucide-react-native';
import { EdHeader, EdCard, FadeIn } from '@/src/ui/editorial';
import { ONBOARDING_IMAGES } from '@/src/onboarding/editorial/images';
import { listArticles, type Article } from '@/src/api/articles';
import { useSelectionReset } from '@/src/care/selected-practitioner';
import { useI18n } from '@/src/i18n';
import { useTheme } from '@/src/ui/theme-mode';
import { LoadFailed } from '@/src/ui/LoadFailed';

const T = {
  en: {
    title: 'Articles',
    subtitle: 'Writing from your practitioner, to read whenever you like.',
    emptyTitle: 'Nothing here yet',
    emptyBody: 'Articles your practitioner publishes will appear here.',
    // Named by the language it IS in. These were fixed strings — "In English",
    // "Read in French" — shown whatever the language, so French text was
    // labelled English, and after switching the button still offered French.
    inLang: { en: 'In English', fr: 'In French' } as Record<string, string>,
    showIn: { en: 'Read in English', fr: 'Read in French' } as Record<string, string>,
  },
  fr: {
    title: 'Articles',
    subtitle: 'Des textes rédigés par votre praticien, à lire quand vous le souhaitez.',
    emptyTitle: 'Rien ici pour le moment',
    emptyBody: 'Les articles publiés par votre praticien apparaîtront ici.',
    inLang: { en: 'En anglais', fr: 'En français' } as Record<string, string>,
    showIn: { en: 'Lire en anglais', fr: 'Lire en français' } as Record<string, string>,
  },
} as const;

/** The other language, for the toggle. Two locales, so this is the whole of it. */
const other = (l: string) => (l === 'fr' ? 'en' : 'fr');

export default function Articles() {
  const { t: TT } = useTheme();
  const router = useRouter();
  const { locale } = useI18n();
  const tr = T[locale];
  // Starts at the device language, as everything else here does, and the
  // practitioner may write in the other one — hence the toggle.
  const [reading, setReading] = useState<string>(locale);
  const [items, setItems] = useState<Article[] | null>(null);
  const [failed, setFailed] = useState(false);
  const selectionKey = useSelectionReset(() => { setItems(null); setFailed(false); });
  const back = () => (router.canGoBack() ? router.back() : router.navigate('/for-you' as never));
  const open = (id: string) => router.navigate(`/article?id=${id}&locale=${reading}` as never);

  const reload = useCallback(() => {
    let alive = true;
    // A failed read is not an empty one: `failed` shows what happened, and a
    // list already on screen is kept rather than replaced with nothing.
    listArticles(reading).then((l) => { if (!alive) return; if (l) { setItems(l); setFailed(false); } else setFailed(true); });
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- selectionKey: load again for the practitioner just chosen
  }, [reading, selectionKey]);
  useFocusEffect(reload);

  const dateOf = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

  return (
    <View style={{ flex: 1, backgroundColor: TT.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <EdHeader source={ONBOARDING_IMAGES.card1} title={tr.title} subtitle={tr.subtitle} onBack={back} />

        <FadeIn style={{ paddingHorizontal: 22, paddingTop: 20 }}>
          {items === null ? (
            failed ? <LoadFailed onRetry={() => { setFailed(false); reload(); }} />
            : <View style={{ paddingTop: 30, alignItems: 'center' }}><ActivityIndicator color={TT.accent} /></View>
          ) : items.length === 0 ? (
            <EdCard style={{ padding: 26, alignItems: 'center' }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: TT.ink }}>{tr.emptyTitle}</Text>
              <Text style={{ fontSize: 13, color: TT.inkSoft, marginTop: 6, textAlign: 'center', lineHeight: 19 }}>{tr.emptyBody}</Text>
            </EdCard>
          ) : (
            <>
              {/* Only offered when something here actually exists in the other
                  language. A toggle that changes nothing is worse than none. */}
              {items.some((a) => a.locales.includes(other(reading))) && (
                <TouchableOpacity
                  onPress={() => setReading(other(reading))}
                  activeOpacity={0.8}
                  style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 20, borderWidth: 1, borderColor: TT.line, backgroundColor: TT.card, paddingHorizontal: 13, paddingVertical: 8, marginBottom: 18 }}
                >
                  <Languages size={15} color={TT.inkSoft} strokeWidth={2} />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: TT.inkSoft }}>{tr.showIn[other(reading)]}</Text>
                </TouchableOpacity>
              )}

              <View style={{ gap: 10 }}>
                {items.map((a) => (
                  <TouchableOpacity
                    key={a.id}
                    onPress={() => open(a.id)}
                    activeOpacity={0.8}
                    style={{ backgroundColor: TT.card, borderWidth: 1, borderColor: TT.line, borderRadius: 18, padding: 12, paddingRight: 14, flexDirection: 'row', alignItems: 'center', gap: 13 }}
                  >
                    {/* Small cover, then the title. A post without one keeps the
                        same shape so the list does not go ragged. */}
                    {a.coverUrl ? (
                      <Image source={{ uri: a.coverUrl }} style={{ width: 54, height: 54, borderRadius: 12, backgroundColor: TT.accentTint }} />
                    ) : (
                      <View style={{ width: 54, height: 54, borderRadius: 12, backgroundColor: TT.accentTint, alignItems: 'center', justifyContent: 'center' }}>
                        <BookOpen size={20} color={TT.accent} strokeWidth={2} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14.5, fontWeight: '700', color: TT.ink }} numberOfLines={2}>{a.title}</Text>
                      <Text style={{ fontSize: 12, color: TT.inkSoft, marginTop: 2 }} numberOfLines={1}>
                        {/* Said plainly when a post is not in the language being
                            read — better than quietly handing over English. */}
                        {a.renderedLocale !== reading ? tr.inLang[a.renderedLocale] ?? dateOf(a.publishedAt) : dateOf(a.publishedAt)}
                      </Text>
                    </View>
                    <ChevronRight size={18} color={TT.faint} strokeWidth={2} />
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </FadeIn>
      </ScrollView>
    </View>
  );
}
