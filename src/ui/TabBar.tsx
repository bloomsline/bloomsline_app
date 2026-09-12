import { Platform, Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useLanding } from '@/src/prefs/app-prefs';
import { useI18n } from '@/src/i18n';
import { useTheme } from '@/src/ui/theme-mode';
import { clearOf } from '@/src/ui/tokens';

/** The pill's own height: 4px of padding, a 6px row inset, one 13.5px line. */
const PILL_H = 38;

/**
 * How far above the pill the page starts going quiet.
 *
 * Sized against where content COMES TO REST, not against how the fade looks on
 * its own. The tab screens end their scroll 96px above the foot, so a run-up
 * long enough to be luxurious puts that last line half inside the fade and dims
 * it permanently — the line has stopped moving and is still greyed out, which
 * reads as a bug rather than as depth. At 44 the resting edge sits under about
 * a quarter of the veil, which is not visible, and the fade is still a fade.
 */
const FADE_RUNUP = 44;

export type TabId = 'care' | 'moments' | 'foryou';

const TAB_LABEL: Record<TabId, 'care' | 'moments' | 'forYou'> = { care: 'care', moments: 'moments', foryou: 'forYou' };

const TABS: Record<TabId, { id: TabId; href: string }> = {
  care: { id: 'care', href: '/home' },
  moments: { id: 'moments', href: '/moments' },
  foryou: { id: 'foryou', href: '/for-you' },
};

// The tab bar. ONE shape everywhere.
//
// There were two: a v1 floating white pill with icons and a capture FAB, and
// the v2 pill of plain labels the rebuilt tabs draw. Only the Care tab's solo
// state still asked for the v1 one, so the chrome changed shape depending on
// whether you had a practitioner yet — which is exactly where a patient is
// least sure the app is working. The v1 variant is gone.
//
// Colours come from the theme, so this reads correctly on the light solo
// screen and on the dark rebuilt tabs without a variant. Capture is reached
// from the dashed "today" node at the foot of the line, which sits where the
// new moment will land; the corner + was a second door to the same room.
export function TabBar({ active }: { active: TabId }) {
  const { t: TT } = useTheme();
  const router = useRouter();
  const { landing } = useLanding();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const order: TabId[] = landing === 'moments' ? ['moments', 'care', 'foryou'] : ['care', 'moments', 'foryou'];

  // The bar floats over the page, OUTSIDE the screen's SafeAreaView (its hosts
  // claim the top edge only), so it has to keep itself clear of the system's
  // own chrome. `bottom-8` was measured against an iPhone's slim home
  // indicator; Android's three-button navigation bar is twice as tall and was
  // covering the labels. Whichever is taller wins, and the 32 stays as the
  // floor so nothing moves on iOS.
  const barBottom = Math.max(32, insets.bottom + 12);

  return (
    <>
      {/* CONTENT DISSOLVES BEFORE IT REACHES THE BAR.
          The page scrolls underneath the pill, and with the bar now easy to
          find that overlap became easy to see too: a heading half-eaten by a
          solid object, cut off mid-letter. The fade takes the page down to its
          own colour just above the bar, so a line on its way out goes quiet
          instead of being sliced.

          Not a blur. A real frosted bar needs a native module, and on Android
          it is redrawn every frame — a bar that stutters while you scroll is a
          worse trade than one you can see through. This costs nothing at
          scroll time.

          It fades to `bg` rather than to `transparent`: see `clearOf`. */}
      <LinearGradient
        colors={[clearOf(TT.bg), TT.bg, TT.bg]}
        locations={[0, 0.62, 1]}
        pointerEvents="none"
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: barBottom + PILL_H + FADE_RUNUP }}
      />
      <View
        className="absolute inset-x-6 flex-row items-center justify-center"
        style={{ bottom: barBottom }}
      >
      {/* A pill, not bare labels. Bare text has no ground of its own, so the
          page scrolls UNDERNEATH it — the day heading collided with the tab
          row. The container gives the bar a surface; the active tab gets its
          own inner pill so selection reads without relying on weight alone.
          It HUGS its labels — no flex-1. Stretching it to the full width left
          a dead third after "For You" and pushed its edge into the + button;
          the row is justify-between instead, so the pill ends where the words
          do and the + stays at the margin. */}
      {/* FINDING THE BAR is what the accent chip is for. The surface is
          `floating`, which on the dark theme is #141A17 against a #0E1512
          page — about three percent apart, so the whole control sank into
          the page and had to be hunted for. Rather than repaint the surface
          and make the content passing underneath look sliced off, the tab
          you are ON carries the accent: the eye lands on the bright chip and
          the bar comes with it.

          `accent` + `onAccent` and not a new pair: the practitioner's tab bar
          has drawn its active destination this way from the start, so the two
          apps now agree rather than each having a rule. */}
      <View
        className="flex-row items-center self-start rounded-full p-1"
        style={{
          backgroundColor: TT.floating,
          borderWidth: 1,
          borderColor: TT.cardLine,
          // A little lift as well, so the bar reads as being over the page
          // rather than printed on it. Both, because iOS draws the shadow and
          // Android only the elevation.
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 6,
        }}
      >
        {order.map((id) => TABS[id]).map((tab) => {
          const on = tab.id === active;
          return (
            <Pressable
              key={tab.id}
              disabled={on}
              onPress={() => router.navigate(tab.href as never)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              className="rounded-full px-3.5 py-1.5"
              style={on ? { backgroundColor: TT.accent } : undefined}
            >
              {/* `onAccent`, never white: the dark theme's accent is a pale
                  mint, and white on it is unreadable. The token already knows
                  that — #FFFFFF on the light theme's deep green, #0E1512 on
                  the mint. */}
              <Text style={{ fontSize: 13.5, fontWeight: on ? '700' : '500', color: on ? TT.onAccent : TT.faint }}>
                {t.tabs[TAB_LABEL[tab.id]]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {/* No capture button here. The dashed "today" node at the foot of the
          line already opens capture, and it is the better target: it sits
          exactly where the new moment will land, so the gesture and its
          result are in the same place. A + in the corner was a second door
          to the same room, and it pushed the tab pill off centre. */}
      </View>
    </>
  );
}

// Web keeps a persistent bottom padding so the floating bar never covers content.
export const TAB_BAR_SPACER = Platform.OS === 'web' ? 'pb-36' : 'pb-32';
