// The "New" card at the top of My Care (guardian plan, Q8). A child is told in
// the app, not only by email, when their parent books, moves or cancels a
// session; and the other notices written to their chart show here too. The
// server sends the last 30 days, for the practitioner selected now. Each one is
// dismissed with a tap; nothing here is the only record of anything.
import { Text, TouchableOpacity, View } from 'react-native';
import { X } from 'lucide-react-native';
import { EdCard, Kicker } from '@/src/ui/editorial';
import { useTheme } from '@/src/ui/theme-mode';
import { useI18n } from '@/src/i18n';
import type { Notice } from '@/src/api/notices';

function shownDate(iso: string, locale: 'en' | 'fr'): string {
  const d = new Date(iso);
  return d.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long' });
}

export function NoticesCard({ notices, onDismiss, onDismissAll }: { notices: Notice[]; onDismiss: (id: string) => void; onDismissAll: () => void }) {
  const { t: TT } = useTheme();
  const { t, locale } = useI18n();
  if (!notices.length) return null;
  return (
    <View style={{ marginHorizontal: 22, marginTop: 16 }}>
      <EdCard style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <Kicker>{t.notices.title}</Kicker>
          {notices.length > 1 ? (
            <TouchableOpacity onPress={onDismissAll} accessibilityRole="button" hitSlop={8}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: TT.inkSoft }}>{t.notices.clearAll}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {notices.map((n, i) => (
          <View key={n.id} style={{ flexDirection: 'row', alignItems: 'flex-start', paddingTop: 10, marginTop: i ? 10 : 0, borderTopWidth: i ? 1 : 0, borderTopColor: TT.line }}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={{ fontSize: 14.5, fontWeight: '700', color: TT.ink }}>{n.title}</Text>
              <Text style={{ fontSize: 13.5, lineHeight: 19, color: TT.inkSoft, marginTop: 2 }}>{n.body}</Text>
              <Text style={{ fontSize: 12, color: TT.faint, marginTop: 4 }}>{shownDate(n.createdAt, locale)}</Text>
            </View>
            <TouchableOpacity onPress={() => onDismiss(n.id)} accessibilityRole="button" accessibilityLabel={t.notices.dismissA11y} hitSlop={10}>
              <X size={16} color={TT.faint} />
            </TouchableOpacity>
          </View>
        ))}
      </EdCard>
    </View>
  );
}
