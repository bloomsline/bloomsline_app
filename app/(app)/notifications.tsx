// Notifications: what the practitioner sent, and what is left to do about it.
//
// Behind the bell on My Care. New ones first, then the last 30 days already
// read, each worded in the app's language by the server (it used to keep the
// language the notice was written in). A tap opens what it is about and marks it
// read; "Mark all as read" clears the count. A signed document's notices arrive
// already read: nothing is left to do about them.
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Bell, ChevronRight } from 'lucide-react-native';
import { EdHeader, EdCard, FadeIn, Kicker } from '@/src/ui/editorial';
import { LoadFailed } from '@/src/ui/LoadFailed';
import { useTheme } from '@/src/ui/theme-mode';
import { useI18n } from '@/src/i18n';
import { fetchBell, dismissNotices, type BellNotice } from '@/src/api/notices';

function shownDate(iso: string, locale: 'en' | 'fr'): string {
  return new Date(iso).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long' });
}

export default function Notifications() {
  const { t: TT } = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();
  const [items, setItems] = useState<BellNotice[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    const r = await fetchBell(locale);
    if (r) { setItems(r.items); setFailed(false); } else setFailed(true);
  }, [locale]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const back = () => (router.canGoBack() ? router.back() : router.replace('/home' as never));

  const markRead = (ids: string[]) => {
    if (!ids.length) return;
    setItems((list) => list?.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)) ?? list);
    void dismissNotices(ids);
  };

  const open = (n: BellNotice) => {
    if (!n.read) markRead([n.id]);
    const to = n.target;
    if (!to) return;
    if (to.kind === 'document') router.push({ pathname: '/document', params: { id: to.id } } as never);
    else if (to.kind === 'assignment') router.push(`/resource/${to.id}` as never);
    // Sessions live on My Care itself.
    else back();
  };

  const unread = (items ?? []).filter((n) => !n.read);
  const earlier = (items ?? []).filter((n) => n.read);

  const row = (n: BellNotice, i: number) => (
    <TouchableOpacity
      key={n.id}
      onPress={() => open(n)}
      activeOpacity={0.8}
      accessibilityRole="button"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: TT.line }}
    >
      {!n.read ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: TT.accent }} /> : <View style={{ width: 8 }} />}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14.5, fontWeight: n.read ? '600' : '700', color: n.read ? TT.inkSoft : TT.ink }}>{n.title}</Text>
        <Text style={{ fontSize: 13.5, lineHeight: 19, color: TT.inkSoft, marginTop: 2 }}>{n.body}</Text>
        <Text style={{ fontSize: 12, color: TT.faint, marginTop: 4 }}>{shownDate(n.createdAt, locale)}</Text>
      </View>
      {n.target && n.target.kind !== 'session' ? <ChevronRight size={16} color={TT.faint} strokeWidth={2} /> : null}
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: TT.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <EdHeader title={t.notices.title} onBack={back} />
        <FadeIn style={{ paddingHorizontal: 22, paddingTop: 18 }}>
          {items === null ? (
            failed ? <LoadFailed onRetry={() => { setFailed(false); void load(); }} /> : <ActivityIndicator color={TT.accent} />
          ) : items.length === 0 ? (
            <EdCard style={{ alignItems: 'center', padding: 24 }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: TT.accentTint, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Bell size={22} color={TT.accent} strokeWidth={2} />
              </View>
              <Text style={{ fontSize: 16, fontWeight: '700', color: TT.ink }}>{t.notices.empty}</Text>
              <Text style={{ fontSize: 13, color: TT.inkSoft, marginTop: 6, textAlign: 'center', lineHeight: 19 }}>{t.notices.emptyBody}</Text>
            </EdCard>
          ) : (
            <>
              {unread.length > 0 && (
                <>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Kicker color={TT.faint}>{t.notices.new}</Kicker>
                    <TouchableOpacity onPress={() => markRead(unread.map((n) => n.id))} accessibilityRole="button" hitSlop={8}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: TT.accent }}>{t.notices.markAll}</Text>
                    </TouchableOpacity>
                  </View>
                  <EdCard style={{ paddingVertical: 4, marginBottom: 22 }}>{unread.map(row)}</EdCard>
                </>
              )}
              {earlier.length > 0 && (
                <>
                  <Kicker color={TT.faint} style={{ marginBottom: 8 }}>{t.notices.earlier}</Kicker>
                  <EdCard style={{ paddingVertical: 4 }}>{earlier.map(row)}</EdCard>
                </>
              )}
            </>
          )}
        </FadeIn>
      </ScrollView>
    </View>
  );
}
