// One line of a settings panel: an icon, what it is, what it is set to.
//
// Lifted out of the patient's settings so the practitioner's panel is the SAME
// control and not a lookalike. The two screens list different things — a
// practitioner has no home tab to choose — but a row is a row, and two
// implementations of one would drift the first time either is touched.
import { Text, TouchableOpacity, View } from 'react-native';
import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { useTheme } from '@/src/ui/theme-mode';

export function Row({ Icon, title, value, onPress, divider, tone, chevron = true }: {
  Icon: LucideIcon;
  title: string;
  /** The setting's current value, or a one-line hint for a row that has none. */
  value?: string;
  onPress: () => void;
  divider?: boolean;
  tone?: 'danger';
  /** A chevron promises somewhere to go. Sign out and Delete are acts, not
   *  destinations, so they do not get one. */
  chevron?: boolean;
}) {
  const { t: TT } = useTheme();
  const ink = tone === 'danger' ? TT.danger : TT.ink;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{ paddingVertical: 15, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: divider ? 1 : 0, borderBottomColor: TT.line }}
    >
      <Icon size={20} color={tone === 'danger' ? TT.danger : TT.accent} strokeWidth={1.9} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, color: ink }}>{title}</Text>
        {value ? <Text style={{ fontSize: 12.5, color: TT.faint, marginTop: 1 }}>{value}</Text> : null}
      </View>
      {chevron ? <ChevronRight size={18} color={TT.faint} strokeWidth={2} /> : null}
    </TouchableOpacity>
  );
}
