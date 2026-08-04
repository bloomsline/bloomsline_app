import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from 'expo-router';
import { Check, Search, Share2 } from 'lucide-react-native';
import { EDA, EdHeader, EdCard, EdPill, EdSection, FadeIn } from '@/src/ui/editorial';
import { PractitionerTabBar, PRACTITIONER_TAB_PAD } from '@/src/ui/PractitionerTabBar';
import { useI18n } from '@/src/i18n';
import { fetchShareableResources, fetchPatients, shareResource, type ShareableResource, type PatientListItem } from '@/src/api/practitioner';

// The library, for SHARING. Published resources only — a draft has no frozen
// version to pin an assignment to, so it cannot be sent.
//
// No authoring. Building an exercise is desk work, and a phone-sized block
// editor would be a worse version of one that already exists.
const T = {
  en: {
    kicker: 'LIBRARY', title: 'Share a resource', search: 'Search resources',
    empty: 'Nothing published yet.', pick: 'WHO IS IT FOR?', share: 'Share', shared: 'Shared',
    noPatients: 'No patients yet.', back: 'Pick another',
  },
  fr: {
    kicker: 'RESSOURCES', title: 'Partager une ressource', search: 'Rechercher',
    empty: 'Rien de publié.', pick: 'POUR QUI ?', share: 'Partager', shared: 'Partagé',
    noPatients: 'Aucun patient.', back: 'Choisir une autre',
  },
} as const;

export default function Resources() {
  const { locale } = useI18n();
  const tr = T[locale] ?? T.en;
  const [items, setItems] = useState<ShareableResource[]>([]);
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<ShareableResource | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [done, setDone] = useState('');
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void Promise.all([fetchShareableResources(), fetchPatients()]).then(([res, pats]) => {
        if (!alive) return;
        setItems(res ?? []);
        setPatients(pats ?? []);
        setLoaded(true);
      });
      return () => { alive = false; };
    }, []),
  );

  const needle = q.trim().toLowerCase();
  const shown = needle ? items.filter((r) => r.title.toLowerCase().includes(needle)) : items;

  const send = async (patient: PatientListItem) => {
    if (!picked) return;
    setError(''); setDone(''); setBusyId(patient.id);
    const res = await shareResource(picked.id, patient.id);
    setBusyId(null);
    if (!res.ok) { setError(res.error ?? ''); return; }
    setDone(`${tr.shared} · ${patient.name}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: EDA.canvas }}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ paddingBottom: PRACTITIONER_TAB_PAD }} showsVerticalScrollIndicator={false}>
        <EdHeader kicker={tr.kicker} title={tr.title} />

        <FadeIn style={{ paddingHorizontal: 22, paddingTop: 20 }}>
          {!picked ? (
            <>
              <EdCard style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, marginBottom: 16 }}>
                <Search size={16} color={EDA.faint} />
                <TextInput value={q} onChangeText={setQ} placeholder={tr.search} placeholderTextColor={EDA.faint} style={{ flex: 1, fontSize: 15, color: EDA.ink }} autoCorrect={false} />
              </EdCard>
              {!loaded && <ActivityIndicator />}
              {loaded && shown.length === 0 && <Text style={{ fontSize: 14, color: EDA.inkSoft }}>{tr.empty}</Text>}
              {shown.map((r) => (
                <EdCard key={r.id} onPress={() => { setPicked(r); setDone(''); setError(''); }} style={{ marginBottom: 10 }}>
                  <Text style={{ fontSize: 15.5, fontWeight: '700', color: EDA.ink }}>{r.title}</Text>
                  {r.description ? <Text numberOfLines={2} style={{ fontSize: 13, color: EDA.inkSoft, marginTop: 4, lineHeight: 19 }}>{r.description}</Text> : null}
                </EdCard>
              ))}
            </>
          ) : (
            <>
              <EdCard style={{ marginBottom: 18 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Share2 size={16} color={EDA.green} />
                  <Text style={{ flex: 1, fontSize: 15.5, fontWeight: '700', color: EDA.ink }}>{picked.title}</Text>
                </View>
              </EdCard>

              <EdSection label={tr.pick} />
              {patients.length === 0 && <Text style={{ fontSize: 14, color: EDA.inkSoft }}>{tr.noPatients}</Text>}
              {patients.map((p) => (
                <EdCard key={p.id} onPress={() => send(p)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: EDA.ink }}>{p.name}</Text>
                  {busyId === p.id ? <ActivityIndicator size="small" /> : <Check size={16} color={EDA.line} />}
                </EdCard>
              ))}

              {done ? <Text style={{ fontSize: 13.5, fontWeight: '700', color: EDA.green, marginTop: 6 }}>{done}</Text> : null}
              {error ? <Text style={{ fontSize: 13.5, color: '#C0392B', marginTop: 6 }}>{error}</Text> : null}

              <EdPill label={tr.back} variant="outline" onPress={() => setPicked(null)} style={{ marginTop: 18 }} />
            </>
          )}
        </FadeIn>
      </ScrollView>

      <PractitionerTabBar active="resources" />
    </View>
  );
}
