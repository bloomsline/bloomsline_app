// The way to your own account, from the top-right corner of every tab.
//
// It was a gear. A gear is a machine's icon and this is a person's corner: what
// belongs there is their face, and Settings is where their face takes them.
// With no photograph they get their own mark rather than a letter — same shape
// engine as the line, seeded by their name, never one of the mood silhouettes.
import { Image, Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { Settings } from 'lucide-react-native';
import { useTheme } from '@/src/ui/theme-mode';
import { useI18n } from '@/src/i18n';
import { shapePath } from '@/src/moments/shapes';
import { identityMark } from './identity-shape';
import { useMeFace } from './me-face';

export function ProfileButton({ size = 36 }: { size?: number }) {
  const { t: TT } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const face = useMeFace();

  const photo = face?.avatarUrl && /^(https?|blob|file|data):/.test(face.avatarUrl) ? face.avatarUrl : null;
  const mark = identityMark(face?.name);
  const r = size / 2 - 5;

  return (
    <Pressable
      onPress={() => router.navigate('/settings' as never)}
      accessibilityRole="button"
      accessibilityLabel={t.settings.title}
      style={{
        width: size, height: size, borderRadius: size / 2, overflow: 'hidden',
        backgroundColor: TT.card, borderWidth: 1, borderColor: TT.cardLine,
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      {photo ? (
        <Image source={{ uri: photo }} style={{ width: size, height: size }} resizeMode="cover" />
      ) : face ? (
        <Svg width={size} height={size}>
          <Path d={shapePath(mark.shape, size / 2, size / 2, r)} fill={mark.color} />
        </Svg>
      ) : (
        // Before `/me` has answered there is no name to seed with, and seeding
        // with nothing would give every patient the same mark for a moment and
        // then change it under them. The gear holds the space instead.
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Settings size={Math.round(size * 0.47)} color={TT.inkSoft} strokeWidth={2} />
        </View>
      )}
    </Pressable>
  );
}
