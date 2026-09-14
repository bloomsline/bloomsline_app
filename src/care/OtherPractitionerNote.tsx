// "From Marc · Switch to Marc", above something that belongs to a practitioner
// other than the one selected.
//
// A to-do, a library activity or an article opened from an email or a message
// can belong to any of the patient's practitioners, whoever the app is showing.
// The page opens either way (the server allows it for any linked practitioner),
// and this line says whose it is. It does NOT switch on the patient's behalf:
// following a link from an email should not quietly change what My Care shows
// the next time they open it. The switch is offered, one tap away.
//
// Renders nothing unless there is a real choice of practitioners and the item
// is someone else's, so a patient with one practitioner never sees it.
import { Pressable, Text, View, type ViewStyle } from 'react-native';
import { ArrowLeftRight } from 'lucide-react-native';
import { useSelectedPractitioner } from '@/src/care/selected-practitioner';
import { fmt, useI18n } from '@/src/i18n';
import { useTheme } from '@/src/ui/theme-mode';

export function OtherPractitionerNote({
  practitioner,
  style,
}: {
  /** Who the item belongs to, as the detail payload says. Absent on older
   *  servers, and then nothing is shown. */
  practitioner?: { id: string; name: string | null } | null;
  style?: ViewStyle;
}) {
  const { t: TT } = useTheme();
  const { t } = useI18n();
  const { canSwitch, practitioners, selectedId, select } = useSelectedPractitioner();

  if (!canSwitch || !practitioner || practitioner.id === selectedId) return null;
  // The switch only for someone still linked: the list is who can be chosen.
  const linked = practitioners.find((p) => p.id === practitioner.id) ?? null;
  const name = practitioner.name || linked?.name;
  if (!name) return null;

  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 12, rowGap: 4, marginBottom: 16 }, style]}>
      <Text style={{ fontSize: 13, color: TT.inkSoft }}>{fmt(t.care.fromName, { name })}</Text>
      {linked ? (
        <Pressable
          onPress={() => select(linked.id)}
          hitSlop={8}
          accessibilityRole="button"
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 5, opacity: pressed ? 0.6 : 1 })}
        >
          <ArrowLeftRight size={13} color={TT.accent} strokeWidth={2.2} />
          <Text style={{ fontSize: 13, fontWeight: '700', color: TT.accent }}>{fmt(t.care.switchTo, { name })}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
