// The one question this app asks about statistics.
//
// It is a sheet rather than a line in a settings page nobody opens, and it is
// asked ONCE per device: answer it and it never appears again, whichever way
// you answered. The wording follows the website's banner, which was itself
// written to CNIL's rule that refusing must be exactly as easy as accepting —
// so the two buttons here are the same size, the same shape and the same
// weight, and "No thanks" comes first.
//
// What it must never do is imply that saying no costs anything. It does not:
// the app is identical either way.
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChartNoAxesColumn } from 'lucide-react-native';
import { useTheme } from '@/src/ui/theme-mode';
import { useI18n } from '@/src/i18n';

export function ConsentSheet({ visible, onAnswer }: { visible: boolean; onAnswer: (granted: boolean) => void }) {
  const { t: TT } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const T = t.analytics.ask;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => onAnswer(false)} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20,20,20,0.4)' }}>
        <View
          accessibilityViewIsModal
          style={{
            borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: TT.sheet,
            paddingHorizontal: 24, paddingTop: 22, paddingBottom: Math.max(34, insets.bottom + 16),
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <ChartNoAxesColumn size={20} color={TT.accent} strokeWidth={2.4} />
            <Text style={{ fontSize: 19, fontWeight: '800', color: TT.ink, letterSpacing: -0.3 }}>{T.title}</Text>
          </View>

          <Text style={{ fontSize: 15, lineHeight: 22, color: TT.faint, marginTop: 10 }}>{T.body}</Text>
          <Text style={{ fontSize: 13, lineHeight: 19, color: TT.faint, marginTop: 10 }}>{T.never}</Text>

          {/* Equal weight, on purpose. Refusing is the first thing the thumb
              reaches and looks exactly like accepting. */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => onAnswer(false)}
              style={{ flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 16, backgroundColor: TT.card, borderWidth: 1, borderColor: TT.line }}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: TT.ink }}>{T.no}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => onAnswer(true)}
              style={{ flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 16, backgroundColor: TT.card, borderWidth: 1, borderColor: TT.line }}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: TT.ink }}>{T.yes}</Text>
            </Pressable>
          </View>

          <Text style={{ fontSize: 12.5, color: TT.faint, marginTop: 14, textAlign: 'center' }}>{T.change}</Text>
        </View>
      </View>
    </Modal>
  );
}
