// c8 — From your practitioner: assigned resources & exercises. Wired to GET
// /api/mobile/care/todo (real assignments). Demo items under FORCE_CARE_HUB.
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Check, ChevronRight, MessageCircle, type LucideIcon } from 'lucide-react-native';
import { EdHeader, EdCard, FadeIn } from '@/src/ui/editorial';
import { useOnboarding } from '@/src/onboarding/context';
import { FORCE_CARE_HUB } from '@/src/config';
import { fetchTodo, type TodoItem } from '@/src/api/care';
import { resourceTypeMeta, statusLabel, isDone } from '@/src/care/resources';
import { useI18n, fmt } from '@/src/i18n';
import { useTheme } from '@/src/ui/theme-mode';

const T = {
  en: {
    defaultPractitioner: 'your practitioner',
    titleFrom: 'From {name}',
    subtitle: 'Do these whenever suits you, no due dates.',
    emptyTitle: 'Nothing shared yet',
    emptyBody: 'Anything {name} shares with you will appear here.',
    reply: 'New message',
  },
  fr: {
    defaultPractitioner: 'votre praticien',
    titleFrom: 'De la part de {name}',
    subtitle: 'Faites-les quand cela vous convient, sans date limite.',
    emptyTitle: 'Rien de partagé pour le moment',
    emptyBody: 'Tout ce que {name} partage avec vous apparaîtra ici.',
    reply: 'Nouveau message',
  },
} as const;

const DEMO: TodoItem[] = [
  { id: 'd1', resourceId: '', title: 'A short reflection', type: 'worksheet', status: 'in_progress', dueAt: null, assignedAt: '' },
  { id: 'd2', resourceId: '', title: 'Evening wind-down', type: 'exercise', status: 'assigned', dueAt: null, assignedAt: '' },
  { id: 'd3', resourceId: '', title: 'Understanding anxious evenings', type: 'psychoeducation', status: 'completed', dueAt: null, assignedAt: '' },
];

export default function FromPractitioner() {
  const { t: TT } = useTheme();
  const router = useRouter();
  const { locale } = useI18n();
  const tr = T[locale];
  const { practitionerName } = useOnboarding();
  const first = (practitionerName ?? tr.defaultPractitioner).replace(/^dr\.?\s*/i, '').split(/\s+/)[0];
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
    <View style={{ flex: 1, backgroundColor: TT.bg }}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <EdHeader kicker={first} title={fmt(tr.titleFrom, { name: first })} subtitle={tr.subtitle} onBack={() => router.back()} />
        <FadeIn style={{ paddingHorizontal: 22, paddingTop: 20 }}>
          {items === null ? (
            <View style={{ paddingTop: 40, alignItems: 'center' }}>
              <ActivityIndicator color={TT.accent} />
            </View>
          ) : items.length === 0 ? (
            <EdCard style={{ alignItems: 'center', padding: 24 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: TT.ink }}>{tr.emptyTitle}</Text>
              <Text style={{ fontSize: 13, color: TT.inkSoft, textAlign: 'center', marginTop: 6, lineHeight: 19 }}>
                {fmt(tr.emptyBody, { name: first })}
              </Text>
            </EdCard>
          ) : (
            <View style={{ gap: 10 }}>
              {items.map((it) => {
                const meta = resourceTypeMeta(it.type, locale);
                const done = isDone(it.status);
                const open = it.resourceId ? () => router.navigate(`/resource/${it.id}` as never) : undefined;
                return <ResItem key={it.id} Icon={meta.Icon} title={it.title} tag={meta.label} status={statusLabel(it.status, locale)} statusGreen={it.status === 'in_progress'} done={done} muted={done && !it.hasReply} reply={it.hasReply ? tr.reply : undefined} onPress={open} />;
              })}
            </View>
          )}
        </FadeIn>
      </ScrollView>
    </View>
  );
}

function ResItem({
  Icon, title, tag, status, statusGreen, done, muted, reply, onPress,
}: {
  Icon: LucideIcon; title: string; tag: string; status: string; statusGreen?: boolean; done?: boolean; muted?: boolean; reply?: string; onPress?: () => void;
}) {
  const { t: TT } = useTheme();
  const { t } = useI18n();
  const soon = () => Platform.OS === 'web' && globalThis.alert?.(t.common.comingSoon);
  return (
    <TouchableOpacity
      onPress={onPress ?? soon}
      activeOpacity={0.8}
      style={{ backgroundColor: TT.card, borderWidth: reply ? 1.5 : 1, borderColor: reply ? TT.accent : TT.line, borderRadius: 18, padding: 15, paddingRight: 16, flexDirection: 'row', alignItems: 'center', gap: 14, opacity: muted ? 0.7 : 1 }}
    >
      <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: TT.accentTint, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={19} color={muted ? TT.faint : TT.accent} strokeWidth={2} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 14.5, fontWeight: '700', color: muted ? TT.inkSoft : TT.ink }}>{title}</Text>
        {reply && (
          <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: TT.accentTint, borderRadius: 8, paddingVertical: 3, paddingHorizontal: 7, marginTop: 4 }}>
            <MessageCircle size={11} color={TT.accent} strokeWidth={2.5} />
            <Text style={{ fontSize: 11, fontWeight: '800', color: TT.accentDeep }}>{reply}</Text>
          </View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: TT.faint, letterSpacing: 0.2 }}>{tag}</Text>
          <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: TT.line }} />
          {done ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Check size={12} color={TT.accent} strokeWidth={3} />
              <Text style={{ fontSize: 11.5, fontWeight: '700', color: TT.accent }}>{status}</Text>
            </View>
          ) : (
            <Text style={{ fontSize: 11.5, fontWeight: '700', color: statusGreen ? TT.accent : TT.faint }}>{status}</Text>
          )}
        </View>
      </View>
      <ChevronRight size={18} color={TT.faint} strokeWidth={2} />
    </TouchableOpacity>
  );
}
