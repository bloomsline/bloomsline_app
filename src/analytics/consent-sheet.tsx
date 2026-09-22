// The one question this app asks about statistics.
//
// It is a sheet rather than a line in a settings page nobody opens, and it is
// asked ONCE per device: answer it and it never appears again, whichever way
// you answered. The wording follows the website's banner, which was itself
// written to CNIL's rule that refusing must be exactly as easy as accepting —
// so the two buttons here are the same size, the same shape and the same
// weight, and "No thanks" comes first.
//
// It is also the same SIZE as the website's banner: one line, a link, two
// buttons. It used to run to a title, two paragraphs and a footnote, which is
// a wall of text over somebody's home screen asking for a favour. The detail
// it used to spell out lives in the privacy policy, which the link opens and
// which is the version that is actually maintained.
//
// What it must never do is imply that saying no costs anything. It does not:
// the app is identical either way.
import { Linking, Modal, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChartNoAxesColumn } from 'lucide-react-native';
import { useTheme } from '@/src/ui/theme-mode';
import { useI18n } from '@/src/i18n';

export function ConsentSheet({ visible, onAnswer }: { visible: boolean; onAnswer: (granted: boolean) => void }) {
  const { t: TT } = useTheme();
  const { t, locale } = useI18n();
  const insets = useSafeAreaInsets();
  const T = t.analytics.ask;

  // The policy, in the reader's language. Same page the settings panel opens,
  // and the same rule: link to the source rather than restate it here.
  const openPolicy = () => {
    const url = `https://www.bloomsline.com${locale === 'fr' ? '/fr' : ''}/privacy`;
    if (Platform.OS === 'web') globalThis.open?.(url, '_blank');
    else Linking.openURL(url).catch(() => {});
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => onAnswer(false)} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20,20,20,0.4)' }}>
        <View
          accessibilityViewIsModal
          style={{
            borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: TT.sheet,
            paddingHorizontal: 24, paddingTop: 20, paddingBottom: Math.max(28, insets.bottom + 14),
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <ChartNoAxesColumn size={18} color={TT.accent} strokeWidth={2.4} style={{ marginTop: 2 }} />
            <Text style={{ flex: 1, fontSize: 14.5, lineHeight: 21, color: TT.ink }}>
              {T.line}{' '}
              <Text accessibilityRole="link" onPress={openPolicy} style={{ color: TT.accent, textDecorationLine: 'underline' }}>
                {T.more}
              </Text>
            </Text>
          </View>

          {/* Equal weight, on purpose. Refusing is the first thing the thumb
              reaches and looks exactly like accepting. */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => onAnswer(false)}
              style={{ flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: 16, backgroundColor: TT.card, borderWidth: 1, borderColor: TT.line }}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: TT.ink }}>{T.no}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => onAnswer(true)}
              style={{ flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: 16, backgroundColor: TT.card, borderWidth: 1, borderColor: TT.line }}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: TT.ink }}>{T.yes}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
