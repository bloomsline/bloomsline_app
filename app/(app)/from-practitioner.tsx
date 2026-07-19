// c8 — From your practitioner: assigned resources & exercises. Wired to GET
// /api/mobile/care/todo (real assignments). Demo items under FORCE_CARE_HUB.
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Check, ChevronRight, type LucideIcon } from 'lucide-react-native';
import { CareHeader } from '@/src/care/CareHeader';
import { CARE } from '@/src/care/theme';
import { useOnboarding } from '@/src/onboarding/context';
import { FORCE_CARE_HUB } from '@/src/config';
import { fetchTodo, type TodoItem } from '@/src/api/care';
import { resourceTypeMeta, statusLabel, isDone } from '@/src/care/resources';

const DEMO: TodoItem[] = [
  { id: 'd1', resourceId: '', title: 'A short reflection', type: 'worksheet', status: 'in_progress', dueAt: null, assignedAt: '' },
  { id: 'd2', resourceId: '', title: 'Evening wind-down', type: 'exercise', status: 'assigned', dueAt: null, assignedAt: '' },
  { id: 'd3', resourceId: '', title: 'Understanding anxious evenings', type: 'psychoeducation', status: 'completed', dueAt: null, assignedAt: '' },
];

export default function FromPractitioner() {
  const router = useRouter();
  const { practitionerName } = useOnboarding();
  const first = (practitionerName ?? 'your practitioner').replace(/^dr\.?\s*/i, '').split(/\s+/)[0];
  const [items, setItems] = useState<TodoItem[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetchTodo().then((t) => {
      if (!alive) return;
      setItems(t && t.length > 0 ? t : FORCE_CARE_HUB ? DEMO : []);
    });
    return () => { alive = false; };
  }, []);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: CARE.canvas }}>
      <CareHeader title={`From ${first}`} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <Text style={{ fontSize: 13, color: '#9A9A9A', marginBottom: 14 }}>Do these whenever suits you — no due dates.</Text>

        {items === null ? (
          <View style={{ paddingTop: 40, alignItems: 'center' }}>
            <ActivityIndicator color={CARE.teal} />
          </View>
        ) : items.length === 0 ? (
          <View style={{ backgroundColor: CARE.card, borderWidth: 1, borderColor: CARE.border, borderRadius: 18, padding: 24, alignItems: 'center' }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: CARE.ink }}>Nothing shared yet</Text>
            <Text style={{ fontSize: 13, color: '#999', textAlign: 'center', marginTop: 6, lineHeight: 19 }}>
              Anything {first} shares with you will appear here.
            </Text>
          </View>
        ) : (
          items.map((it) => {
            const meta = resourceTypeMeta(it.type);
            const done = isDone(it.status);
            const open = it.resourceId ? () => router.navigate(`/resource/${it.id}` as never) : undefined;
            return <ResItem key={it.id} Icon={meta.Icon} title={it.title} tag={meta.label} status={statusLabel(it.status)} statusTeal={it.status === 'in_progress'} done={done} muted={done} onPress={open} />;
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ResItem({
  Icon, title, tag, status, statusTeal, done, muted, onPress,
}: {
  Icon: LucideIcon; title: string; tag: string; status: string; statusTeal?: boolean; done?: boolean; muted?: boolean; onPress?: () => void;
}) {
  const soon = () => Platform.OS === 'web' && globalThis.alert?.('Coming soon');
  return (
    <TouchableOpacity
      onPress={onPress ?? soon}
      activeOpacity={0.8}
      style={{ backgroundColor: CARE.card, borderWidth: 1, borderColor: CARE.border, borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 }}
    >
      <View style={{ width: 46, height: 46, borderRadius: 13, backgroundColor: muted ? '#F1ECE2' : CARE.mint, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={19} color={muted ? '#9A9081' : CARE.teal} strokeWidth={2} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 15, fontWeight: muted ? '600' : '700', color: muted ? '#7A7568' : CARE.ink }}>{title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <Text style={{ fontSize: 11, fontWeight: '600', color: '#9A9081', textTransform: 'uppercase', letterSpacing: 0.4 }}>{tag}</Text>
          <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: '#D4CBB9' }} />
          {done ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Check size={12} color={CARE.teal} strokeWidth={3} />
              <Text style={{ fontSize: 11.5, fontWeight: '600', color: CARE.teal }}>{status}</Text>
            </View>
          ) : (
            <Text style={{ fontSize: 11.5, fontWeight: '600', color: statusTeal ? CARE.teal : '#9A9081' }}>{status}</Text>
          )}
        </View>
      </View>
      <ChevronRight size={18} color="#CFC6B4" strokeWidth={2} />
    </TouchableOpacity>
  );
}
