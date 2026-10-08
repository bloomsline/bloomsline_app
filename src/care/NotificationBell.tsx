// The bell at the top of My Care, with how many notices are new.
//
// Notices used to be a card at the top of the screen, which pushed sessions and
// to-dos down until each one was dismissed, and kept month-old items under
// "New". A bell is where people look for them: the count says whether there is
// anything, and the list is one tap away (notifications.tsx).
import { Text, TouchableOpacity, View } from 'react-native';
import { Bell } from 'lucide-react-native';
import { useTheme } from '@/src/ui/theme-mode';
import { useI18n, fmt } from '@/src/i18n';

export function NotificationBell({ unread, onPress, size = 36 }: { unread: number; onPress: () => void; size?: number }) {
  const { t: TT } = useTheme();
  const { t } = useI18n();
  const label = unread > 0 ? fmt(t.notices.bellA11yCount, { n: String(unread) }) : t.notices.bellA11y;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1, borderColor: TT.cardLine, backgroundColor: TT.card, alignItems: 'center', justifyContent: 'center' }}
    >
      <Bell size={17} color={TT.ink} strokeWidth={2} />
      {unread > 0 ? (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: TT.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: TT.bg }}
        >
          <Text style={{ fontSize: 10.5, fontWeight: '800', color: TT.onAccent }}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}
