// One article, rendered natively from blocks.
//
// The server sends blocks rather than HTML: the app has no HTML renderer and no
// WebView, and adding one would mean a native build. Rendering them here means
// an article arrives in the app's own type and colours, dark mode included,
// instead of as a foreign white rectangle — and no author markup ever reaches
// the phone.
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Linking, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { EdHeader, EdCard, FadeIn } from '@/src/ui/editorial';
import { ONBOARDING_IMAGES } from '@/src/onboarding/editorial/images';
import { getArticle, type ArticleBody, type ArticleBlock, type Run } from '@/src/api/articles';
import { useI18n } from '@/src/i18n';
import { useTheme } from '@/src/ui/theme-mode';
import { OtherPractitionerNote } from '@/src/care/OtherPractitionerNote';

const T = {
  // Named by the language the article is actually in (see articles.tsx).
  en: { missingTitle: 'Not available', missingBody: 'This article could not be opened.', inLang: { en: 'This one is in English.', fr: 'This one is in French.' } as Record<string, string> },
  fr: { missingTitle: 'Indisponible', missingBody: 'Cet article n’a pas pu être ouvert.', inLang: { en: 'Celui-ci est en anglais.', fr: 'Celui-ci est en français.' } as Record<string, string> },
} as const;

export default function ArticleScreen() {
  const { t: TT } = useTheme();
  const router = useRouter();
  const { locale } = useI18n();
  const tr = T[locale];
  const { id, locale: askedFor } = useLocalSearchParams<{ id?: string; locale?: string }>();
  const reading = typeof askedFor === 'string' ? askedFor : locale;
  const [article, setArticle] = useState<ArticleBody | null | 'missing'>(null);
  const back = () => (router.canGoBack() ? router.back() : router.navigate('/articles' as never));

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      if (!id) { setArticle('missing'); return; }
      getArticle(id, reading).then((a) => { if (alive) setArticle(a ?? 'missing'); });
      return () => { alive = false; };
    }, [id, reading]),
  );

  /** One paragraph's worth of runs. Nested <Text> inherits, so marks compose. */
  const renderRuns = (runs: Run[], base: object) =>
    runs.map((r, i) => (
      <Text
        key={i}
        onPress={r.href ? () => void Linking.openURL(r.href as string) : undefined}
        style={[
          base,
          r.marks?.includes('bold') && { fontWeight: '800' as const },
          r.marks?.includes('italic') && { fontStyle: 'italic' as const },
          r.marks?.includes('underline') && { textDecorationLine: 'underline' as const },
          r.marks?.includes('strike') && { textDecorationLine: 'line-through' as const },
          // A link is the one run that has to look tappable; there is no hover
          // on a phone to discover it with.
          r.href && { color: TT.accent, textDecorationLine: 'underline' as const },
        ]}
      >
        {r.text}
      </Text>
    ));

  const renderBlock = (b: ArticleBlock, i: number) => {
    switch (b.type) {
      case 'heading':
        return (
          <Text key={i} style={{ fontSize: b.level === 2 ? 20 : b.level === 3 ? 17 : 15.5, fontWeight: '800', color: TT.ink, letterSpacing: -0.3, marginTop: i === 0 ? 0 : 22, marginBottom: 8 }}>
            {renderRuns(b.runs, { color: TT.ink })}
          </Text>
        );
      case 'paragraph':
        return (
          <Text key={i} style={{ fontSize: 15, color: TT.ink, lineHeight: 25, marginBottom: 14 }}>
            {renderRuns(b.runs, { color: TT.ink })}
          </Text>
        );
      case 'quote':
        return (
          <View key={i} style={{ borderLeftWidth: 3, borderLeftColor: TT.accent, paddingLeft: 14, marginBottom: 16, marginTop: 2 }}>
            <Text style={{ fontSize: 15, color: TT.inkSoft, lineHeight: 24, fontStyle: 'italic' }}>
              {renderRuns(b.runs, { color: TT.inkSoft })}
            </Text>
          </View>
        );
      case 'list':
        return (
          <View key={i} style={{ marginBottom: 16, gap: 7 }}>
            {b.items.map((item, j) => (
              <View key={j} style={{ flexDirection: 'row', gap: 9 }}>
                <Text style={{ fontSize: 15, color: TT.faint, lineHeight: 25, minWidth: b.ordered ? 18 : 10 }}>
                  {b.ordered ? `${j + 1}.` : '•'}
                </Text>
                <Text style={{ flex: 1, fontSize: 15, color: TT.ink, lineHeight: 25 }}>
                  {renderRuns(item, { color: TT.ink })}
                </Text>
              </View>
            ))}
          </View>
        );
      case 'image':
        // Fixed aspect rather than measured: a tall photo would otherwise push
        // the whole article off the screen while it loads.
        return <Image key={i} source={{ uri: b.src }} accessibilityLabel={b.alt || undefined} style={{ width: '100%', aspectRatio: 16 / 10, borderRadius: 16, marginBottom: 16, backgroundColor: TT.accentTint }} />;
      case 'divider':
        return <View key={i} style={{ height: 1, backgroundColor: TT.line, marginVertical: 18 }} />;
    }
  };

  const loaded = article && article !== 'missing' ? article : null;

  return (
    <View style={{ flex: 1, backgroundColor: TT.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 70 }} showsVerticalScrollIndicator={false}>
        <EdHeader
          source={ONBOARDING_IMAGES.card1}
          title={loaded?.title ?? ' '}
          subtitle={loaded?.authorName ?? ''}
          onBack={back}
        />

        <FadeIn style={{ paddingHorizontal: 22, paddingTop: 20 }}>
          {article === null ? (
            <View style={{ paddingTop: 30, alignItems: 'center' }}><ActivityIndicator color={TT.accent} /></View>
          ) : article === 'missing' ? (
            <EdCard style={{ padding: 26, alignItems: 'center' }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: TT.ink }}>{tr.missingTitle}</Text>
              <Text style={{ fontSize: 13, color: TT.inkSoft, marginTop: 6, textAlign: 'center', lineHeight: 19 }}>{tr.missingBody}</Text>
            </EdCard>
          ) : (
            <>
              {/* Whose it is, when it is not the practitioner selected. */}
              <OtherPractitionerNote practitioner={article.practitioner} />
              {/* Said before the article starts, not after it has confused
                  someone. */}
              {article.renderedLocale !== reading && tr.inLang[article.renderedLocale] ? (
                <Text style={{ fontSize: 12.5, color: TT.inkSoft, marginBottom: 14 }}>{tr.inLang[article.renderedLocale]}</Text>
              ) : null}
              {article.blocks.map(renderBlock)}
            </>
          )}
        </FadeIn>
      </ScrollView>
    </View>
  );
}
