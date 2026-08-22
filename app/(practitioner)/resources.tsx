import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Eye, Inbox, Search, Share2 } from 'lucide-react-native';
import { EdHeader, EdCard, EdPill, EdSection, FadeIn } from '@/src/ui/editorial';
import { PractitionerTabBar, PRACTITIONER_TAB_PAD } from '@/src/ui/PractitionerTabBar';
import { useConfirm } from '@/src/ui/confirm';
import { useI18n } from '@/src/i18n';
import { fetchShareableResources, fetchPatients, shareResource, type ShareableResource, type PatientListItem } from '@/src/api/practitioner';
import { useTheme } from '@/src/ui/theme-mode';

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
    preview: 'Preview', one: 'submission', many: 'submissions',
    confirmTitle: 'Send this to {name}?',
    confirmBody: '“{title}” goes to their app now, and they are notified by email.',
    confirmSend: 'Send it', confirmKeep: 'Not yet',
  },
  fr: {
    kicker: 'RESSOURCES', title: 'Partager une ressource', search: 'Rechercher',
    empty: 'Rien de publié.', pick: 'POUR QUI ?', share: 'Partager', shared: 'Partagé',
    noPatients: 'Aucun patient.', back: 'Choisir une autre',
    preview: 'Aperçu', one: 'réponse', many: 'réponses',
    confirmTitle: 'Envoyer à {name} ?',
    confirmBody: '« {title} » arrive dans son app maintenant, et un e-mail la prévient.',
    confirmSend: 'Envoyer', confirmKeep: 'Pas encore',
  },
} as const;

const fill = (s: string, vars: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

export default function Resources() {
  const { t: TT } = useTheme();
  const router = useRouter();
  const { locale } = useI18n();
  const tr = T[locale] ?? T.en;
  const confirm = useConfirm();
  // Coming back from a preview with "share this one" already decided.
  const { shareId } = useLocalSearchParams<{ shareId?: string }>();
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

  // Preview said "share this one" — jump straight to the patient list.
  useEffect(() => {
    if (!shareId || items.length === 0) return;
    const match = items.find((r) => r.id === shareId);
    if (match) setPicked(match);
  }, [shareId, items]);

  const needle = q.trim().toLowerCase();
  const shown = needle ? items.filter((r) => r.title.toLowerCase().includes(needle)) : items;

  // Sending is the one action here that reaches into a patient's app and inbox,
  // and it used to happen on the first tap of a name — with the patient list
  // being a column of near-identical rows, which is exactly the shape that
  // invites a mis-tap. There is no undo on the other side: the notification has
  // already gone. So it asks, naming both the patient and the resource, because
  // the mistake being guarded against is picking the wrong one of either.
  const send = async (patient: PatientListItem) => {
    if (!picked) return;
    const ok = await confirm({
      title: fill(tr.confirmTitle, { name: patient.name }),
      message: fill(tr.confirmBody, { title: picked.title }),
      confirmLabel: tr.confirmSend,
      cancelLabel: tr.confirmKeep,
    });
    if (!ok) return;
    setError(''); setDone(''); setBusyId(patient.id);
    const res = await shareResource(picked.id, patient.id);
    setBusyId(null);
    if (!res.ok) { setError(res.error ?? ''); return; }
    setDone(`${tr.shared} · ${patient.name}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: TT.bg }}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ paddingBottom: PRACTITIONER_TAB_PAD }} showsVerticalScrollIndicator={false}>
        <EdHeader kicker={tr.kicker} title={tr.title} />

        <FadeIn style={{ paddingHorizontal: 22, paddingTop: 20 }}>
          {!picked ? (
            <>
              <EdCard style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, marginBottom: 16 }}>
                <Search size={16} color={TT.faint} />
                <TextInput value={q} onChangeText={setQ} placeholder={tr.search} placeholderTextColor={TT.faint} style={{ flex: 1, fontSize: 15, color: TT.ink }} autoCorrect={false} />
              </EdCard>
              {!loaded && <ActivityIndicator />}
              {loaded && shown.length === 0 && <Text style={{ fontSize: 14, color: TT.inkSoft }}>{tr.empty}</Text>}
              {shown.map((r) => {
                const n = r.submissionCount ?? 0;
                return (
                  <EdCard key={r.id} onPress={() => { setPicked(r); setDone(''); setError(''); }} style={{ marginBottom: 10 }}>
                    <Text style={{ fontSize: 15.5, fontWeight: '700', color: TT.ink }}>{r.title}</Text>
                    {r.description ? <Text numberOfLines={2} style={{ fontSize: 13, color: TT.inkSoft, marginTop: 4, lineHeight: 19 }}>{r.description}</Text> : null}

                    {/* The card body picks the resource to share. These two are
                        separate targets because they are separate errands, and
                        folding either into the card would make the common one
                        (share) the accidental one. */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
                      <Pressable
                        onPress={() => router.navigate({ pathname: '/(practitioner)/resource-preview', params: { id: r.id, title: r.title } } as never)}
                        hitSlop={6}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 16, borderWidth: 1, borderColor: TT.line, paddingHorizontal: 11, paddingVertical: 6 }}
                      >
                        <Eye size={13} color={TT.inkSoft} />
                        <Text style={{ fontSize: 12.5, fontWeight: '700', color: TT.inkSoft }}>{tr.preview}</Text>
                      </Pressable>

                      {n > 0 && (
                        <Pressable
                          onPress={() => router.navigate({ pathname: '/(practitioner)/submissions', params: { resourceId: r.id, title: r.title } } as never)}
                          hitSlop={6}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 16, backgroundColor: TT.accentTint, paddingHorizontal: 11, paddingVertical: 6 }}
                        >
                          <Inbox size={13} color={TT.accentDeep} />
                          <Text style={{ fontSize: 12.5, fontWeight: '800', color: TT.accentDeep }}>
                            {n} {n === 1 ? tr.one : tr.many}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </EdCard>
                );
              })}
            </>
          ) : (
            <>
              <EdCard
                onPress={() => router.navigate({ pathname: '/(practitioner)/resource-preview', params: { id: picked.id, title: picked.title } } as never)}
                style={{ marginBottom: 18 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Share2 size={16} color={TT.accent} />
                  <Text style={{ flex: 1, fontSize: 15.5, fontWeight: '700', color: TT.ink }}>{picked.title}</Text>
                  {/* Still reachable at the last step: the moment before sending
                      is exactly when a doubt about which exercise this is
                      surfaces. */}
                  <Eye size={15} color={TT.faint} />
                </View>
              </EdCard>

              <EdSection label={tr.pick} />
              {patients.length === 0 && <Text style={{ fontSize: 14, color: TT.inkSoft }}>{tr.noPatients}</Text>}
              {patients.map((p) => (
                <EdCard key={p.id} onPress={() => send(p)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: TT.ink }}>{p.name}</Text>
                  {busyId === p.id ? <ActivityIndicator size="small" /> : <Check size={16} color={TT.line} />}
                </EdCard>
              ))}

              {done ? <Text style={{ fontSize: 13.5, fontWeight: '700', color: TT.accent, marginTop: 6 }}>{done}</Text> : null}
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
