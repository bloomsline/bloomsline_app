// e3 — Library "Explore". Self-guided activities from the patient's practitioner(s),
// always open, never assigned. Wired to GET /api/mobile/library.
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import { Search, ChevronRight } from 'lucide-react-native';
import { EDA, EdHeader, EdCard, FadeIn, MonoLabel } from '@/src/ui/editorial';
import { ONBOARDING_IMAGES } from '@/src/onboarding/editorial/images';
import { resourceTypeMeta } from '@/src/care/resources';
import { listLibrary, type LibraryItem } from '@/src/api/library';
import { useI18n } from '@/src/i18n';

const T = {
  en: {
    explore: 'Explore',
    subtitle: 'Practices you can do anytime — take what helps.',
    emptyTitle: 'Nothing here yet',
    emptyBody: 'Self-guided practices your practitioner shares will appear here.',
    search: 'Search practices',
    featured: 'Featured',
    done: 'Done',
    types: {
      worksheet: 'Worksheet', assessment: 'Assessment', exercise: 'Exercise',
      psychoeducation: 'Reading', table: 'Table', resource: 'Resource',
    } as Record<string, string>,
  },
  fr: {
    explore: 'Explorer',
    subtitle: 'Des pratiques à faire quand vous le souhaitez, prenez ce qui vous aide.',
    emptyTitle: 'Rien ici pour le moment',
    emptyBody: 'Les pratiques en autonomie que votre praticien partage apparaîtront ici.',
    search: 'Rechercher une pratique',
    featured: 'À la une',
    done: 'Fait',
    types: {
      worksheet: 'Fiche', assessment: 'Évaluation', exercise: 'Exercice',
      psychoeducation: 'Lecture', table: 'Tableau', resource: 'Ressource',
    } as Record<string, string>,
  },
} as const;

export default function Library() {
  const router = useRouter();
  const { locale } = useI18n();
  const tr = T[locale];
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const back = () => (router.canGoBack() ? router.back() : router.navigate('/for-you' as never));
  const open = (id: string) => router.navigate(`/library-practice?id=${id}` as never);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      listLibrary().then((l) => { if (alive) setItems(l ?? []); });
      return () => { alive = false; };
    }, []),
  );

  const featured = items && items.length > 0 ? items[0] : null;
  const rest = items ? items.slice(1) : [];

  return (
    <View style={{ flex: 1, backgroundColor: EDA.canvas }}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <EdHeader source={ONBOARDING_IMAGES.card1} kicker="LIBRARY" title={tr.explore} subtitle={tr.subtitle} onBack={back} />

        <FadeIn style={{ paddingHorizontal: 22, paddingTop: 20 }}>
          {items === null ? (
            <View style={{ paddingTop: 30, alignItems: 'center' }}><ActivityIndicator color={EDA.green} /></View>
          ) : items.length === 0 ? (
            <EdCard style={{ padding: 26, alignItems: 'center' }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: EDA.ink }}>{tr.emptyTitle}</Text>
              <Text style={{ fontSize: 13, color: EDA.inkSoft, marginTop: 6, textAlign: 'center', lineHeight: 19 }}>{tr.emptyBody}</Text>
            </EdCard>
          ) : (
            <>
              {/* Search */}
              <View style={{ height: 46, borderRadius: 23, backgroundColor: EDA.card, borderWidth: 1, borderColor: EDA.line, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, marginBottom: 20 }}>
                <Search size={16} color={EDA.faint} strokeWidth={2} />
                <Text style={{ color: EDA.faint, fontSize: 14 }}>{tr.search}</Text>
              </View>

              {/* Featured — the one dark accent block */}
              {featured && (
                <TouchableOpacity onPress={() => open(featured.id)} activeOpacity={0.9} style={{ backgroundColor: EDA.ink, borderRadius: 20, padding: 20, marginBottom: 18 }}>
                  <MonoLabel color="rgba(255,255,255,0.6)" style={{ marginBottom: 8 }}>{tr.featured}</MonoLabel>
                  <Text style={{ fontSize: 19, fontWeight: '800', color: '#fff', letterSpacing: -0.3 }}>{featured.title}</Text>
                  {featured.description ? <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.72)', lineHeight: 20, marginTop: 4 }} numberOfLines={2}>{featured.description}</Text> : null}
                </TouchableOpacity>
              )}

              {/* Practices */}
              <View style={{ gap: 10 }}>
                {rest.map((it) => {
                  const meta = resourceTypeMeta(it.type, locale);
                  return (
                    <TouchableOpacity key={it.id} onPress={() => open(it.id)} activeOpacity={0.8} style={{ backgroundColor: EDA.card, borderWidth: 1, borderColor: EDA.line, borderRadius: 18, padding: 15, paddingRight: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                      <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: EDA.greenTint, alignItems: 'center', justifyContent: 'center' }}>
                        <meta.Icon size={19} color={EDA.green} strokeWidth={2} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14.5, fontWeight: '700', color: EDA.ink }} numberOfLines={2}>{it.title}</Text>
                        <Text style={{ fontSize: 12, color: EDA.inkSoft, marginTop: 1 }}>{it.runCount > 0 ? `${tr.done} ${it.runCount}×` : (tr.types[it.type] ?? tr.types.resource)}</Text>
                      </View>
                      <ChevronRight size={18} color={EDA.faint} strokeWidth={2} />
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
