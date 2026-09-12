// e3 — "My guides" / "Mes repères" (route + API still say library).
// Self-guided activities from the patient's practitioner(s),
// always open, never assigned. Wired to GET /api/mobile/library.
import { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Search, ChevronRight, X } from 'lucide-react-native';
import { EdHeader, EdCard, FadeIn, Kicker } from '@/src/ui/editorial';
import { ONBOARDING_IMAGES } from '@/src/onboarding/editorial/images';
import { resourceTypeMeta } from '@/src/care/resources';
import { listLibrary, type LibraryItem } from '@/src/api/library';
import { useI18n } from '@/src/i18n';
import { useTheme } from '@/src/ui/theme-mode';
import { onCta } from '@/src/ui/tokens';

const T = {
  en: {
    title: 'My guides',
    subtitle: 'Resources chosen for you by your practitioner, available whenever you need them.',
    emptyTitle: 'Nothing here yet',
    emptyBody: 'Self-guided practices your practitioner shares will appear here.',
    search: 'Search practices',
    noMatch: 'Nothing matches that.',
    clearSearch: 'Clear search',
    featured: 'Featured',
    done: 'Done',
    types: {
      worksheet: 'Worksheet', assessment: 'Assessment', exercise: 'Exercise',
      psychoeducation: 'Reading', table: 'Table', resource: 'Resource',
    } as Record<string, string>,
  },
  fr: {
    title: 'Mes repères',
    subtitle: 'Des supports choisis par votre praticien, à explorer quand vous en ressentez le besoin.',
    emptyTitle: 'Rien ici pour le moment',
    emptyBody: 'Les pratiques en autonomie que votre praticien partage apparaîtront ici.',
    search: 'Rechercher une pratique',
    noMatch: 'Aucun résultat.',
    clearSearch: 'Effacer la recherche',
    featured: 'À la une',
    done: 'Fait',
    types: {
      worksheet: 'Fiche', assessment: 'Évaluation', exercise: 'Exercice',
      psychoeducation: 'Lecture', table: 'Tableau', resource: 'Ressource',
    } as Record<string, string>,
  },
} as const;

export default function Library() {
  const { t: TT, mode } = useTheme();
  const router = useRouter();
  const { locale } = useI18n();
  const tr = T[locale];
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [q, setQ] = useState('');
  const back = () => (router.canGoBack() ? router.back() : router.navigate('/for-you' as never));
  const open = (id: string) => router.navigate(`/library-practice?id=${id}` as never);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      listLibrary().then((l) => { if (alive) setItems(l ?? []); });
      return () => { alive = false; };
    }, []),
  );

  // Searching is ACCENT-INSENSITIVE, which is not a nicety in French: nobody
  // types "méditation" with the accent when they are looking for it, and a
  // search that returns nothing for a word plainly on the screen reads as
  // broken rather than as strict.
  const fold = (v: string) => v.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const needle = fold(q.trim());
  const matches = (it: LibraryItem) =>
    fold(it.title).includes(needle) ||
    fold(it.description ?? '').includes(needle) ||
    fold(tr.types[it.type] ?? '').includes(needle);

  const searching = needle.length > 0;
  const found = items ? items.filter(matches) : [];
  // While searching there is no "featured": promoting one result above the rest
  // would be the app deciding which of YOUR matches matters most.
  const featured = !searching && items && items.length > 0 ? items[0] : null;
  const rest = searching ? found : items ? items.slice(1) : [];

  return (
    <View style={{ flex: 1, backgroundColor: TT.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <EdHeader source={ONBOARDING_IMAGES.card1} title={tr.title} subtitle={tr.subtitle} onBack={back} />

        <FadeIn style={{ paddingHorizontal: 22, paddingTop: 20 }}>
          {items === null ? (
            <View style={{ paddingTop: 30, alignItems: 'center' }}><ActivityIndicator color={TT.accent} /></View>
          ) : items.length === 0 ? (
            <EdCard style={{ padding: 26, alignItems: 'center' }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: TT.ink }}>{tr.emptyTitle}</Text>
              <Text style={{ fontSize: 13, color: TT.inkSoft, marginTop: 6, textAlign: 'center', lineHeight: 19 }}>{tr.emptyBody}</Text>
            </EdCard>
          ) : (
            <>
              {/* Search */}
              {/* It used to be a Text: an icon and a label that looked like a
                  search box and did nothing when tapped. Sized by padding rather
                  than a fixed height, for the reason the journal's field was
                  clipping its own descenders. */}
              <View style={{ borderRadius: 23, backgroundColor: TT.card, borderWidth: 1, borderColor: TT.line, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 13, minHeight: 46, marginBottom: 20 }}>
                <Search size={16} color={TT.faint} strokeWidth={2} />
                <TextInput
                  value={q}
                  onChangeText={setQ}
                  placeholder={tr.search}
                  placeholderTextColor={TT.faint}
                  autoCorrect={false}
                  returnKeyType="search"
                  style={[{ flex: 1, fontSize: 14, color: TT.ink, padding: 0 }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as never) : null]}
                />
                {q.length > 0 ? (
                  <TouchableOpacity onPress={() => setQ('')} hitSlop={10} accessibilityLabel={tr.clearSearch}>
                    <X size={16} color={TT.faint} strokeWidth={2} />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Featured — the one INVERTED block. It used to be `TT.ink`, which is
                  near-black on cream and WHITE on the ground: in dark mode it was a
                  white slab carrying white text. `ctaBg`/`ctaFg` is the pair that
                  actually means "flip against the page". */}
              {featured && (
                <TouchableOpacity onPress={() => open(featured.id)} activeOpacity={0.9} style={{ backgroundColor: TT.ctaBg, borderRadius: 20, padding: 20, marginBottom: 18 }}>
                  <Kicker color={onCta(mode, 0.6)} style={{ marginBottom: 8 }}>{tr.featured}</Kicker>
                  <Text style={{ fontSize: 19, fontWeight: '800', color: TT.ctaFg, letterSpacing: -0.3 }}>{featured.title}</Text>
                  {featured.description ? <Text style={{ fontSize: 13, color: onCta(mode, 0.72), lineHeight: 20, marginTop: 4 }} numberOfLines={2}>{featured.description}</Text> : null}
                </TouchableOpacity>
              )}

              {searching && found.length === 0 ? (
                <Text style={{ paddingTop: 18, textAlign: 'center', fontSize: 13.5, color: TT.inkSoft }}>{tr.noMatch}</Text>
              ) : null}

              {/* Practices */}
              <View style={{ gap: 10 }}>
                {rest.map((it) => {
                  const meta = resourceTypeMeta(it.type, locale);
                  return (
                    <TouchableOpacity key={it.id} onPress={() => open(it.id)} activeOpacity={0.8} style={{ backgroundColor: TT.card, borderWidth: 1, borderColor: TT.line, borderRadius: 18, padding: 15, paddingRight: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                      <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: TT.accentTint, alignItems: 'center', justifyContent: 'center' }}>
                        <meta.Icon size={19} color={TT.accent} strokeWidth={2} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14.5, fontWeight: '700', color: TT.ink }} numberOfLines={2}>{it.title}</Text>
                        <Text style={{ fontSize: 12, color: TT.inkSoft, marginTop: 1 }}>{it.runCount > 0 ? `${tr.done} ${it.runCount}×` : (tr.types[it.type] ?? tr.types.resource)}</Text>
                      </View>
                      <ChevronRight size={18} color={TT.faint} strokeWidth={2} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
        </FadeIn>
      </ScrollView>
    </View>
  );
}
