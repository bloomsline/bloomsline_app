// e3 — Library "Explore". Self-guided activities from the patient's practitioner(s),
// always open, never assigned. Wired to GET /api/mobile/library.
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Search } from 'lucide-react-native';
import { CARE } from '@/src/care/theme';
import { resourceTypeMeta } from '@/src/care/resources';
import { listLibrary, type LibraryItem } from '@/src/api/library';

const ORANGE = '#C87941';

export default function Library() {
  const router = useRouter();
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
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: CARE.canvas }}>
      <View style={{ paddingHorizontal: 24, paddingTop: 8 }}>
        <TouchableOpacity onPress={back} activeOpacity={0.7} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', borderWidth: 1, borderColor: CARE.border, alignItems: 'center', justifyContent: 'center' }}>
          <ChevronLeft size={18} color="#333" strokeWidth={2} />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 14, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Text style={{ fontSize: 28, fontWeight: '700', letterSpacing: -0.6, color: CARE.ink, marginBottom: 4 }}>Explore</Text>
        <Text style={{ fontSize: 13.5, color: '#9A9A9A', marginBottom: 18 }}>Practices you can do anytime — take what helps.</Text>

        {items === null ? (
          <View style={{ paddingTop: 30, alignItems: 'center' }}><ActivityIndicator color={CARE.teal} /></View>
        ) : items.length === 0 ? (
          <View style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: CARE.border, borderRadius: 18, padding: 26, alignItems: 'center', marginTop: 4 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: CARE.ink }}>Nothing here yet</Text>
            <Text style={{ fontSize: 13, color: '#999', marginTop: 6, textAlign: 'center', lineHeight: 19 }}>Self-guided practices your practitioner shares will appear here.</Text>
          </View>
        ) : (
          <>
            <View style={{ height: 44, borderRadius: 22, backgroundColor: '#fff', borderWidth: 1, borderColor: CARE.border, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, marginBottom: 20 }}>
              <Search size={16} color={CARE.muted} strokeWidth={2} />
              <Text style={{ color: CARE.muted, fontSize: 14 }}>Search practices</Text>
            </View>

            {featured && (
              <TouchableOpacity onPress={() => open(featured.id)} activeOpacity={0.9} style={{ borderRadius: 20, overflow: 'hidden', marginBottom: 18 }}>
                <LinearGradient colors={['#009B8E', '#00B4A3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 20 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.75)', marginBottom: 8 }}>Featured</Text>
                  <Text style={{ fontSize: 19, fontWeight: '700', color: '#fff', marginBottom: 4 }}>{featured.title}</Text>
                  {featured.description ? <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 20 }} numberOfLines={2}>{featured.description}</Text> : null}
                </LinearGradient>
              </TouchableOpacity>
            )}

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {rest.map((it) => {
                const meta = resourceTypeMeta(it.type);
                return (
                  <TouchableOpacity key={it.id} onPress={() => open(it.id)} activeOpacity={0.85} style={{ width: '47%', flexGrow: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: CARE.border, borderRadius: 18, padding: 16 }}>
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#FCF1E7', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                      <meta.Icon size={18} color={ORANGE} strokeWidth={2} />
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: CARE.ink }} numberOfLines={2}>{it.title}</Text>
                    <Text style={{ fontSize: 12, color: '#9A9A9A', marginTop: 2 }}>{it.runCount > 0 ? `Done ${it.runCount}×` : meta.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
