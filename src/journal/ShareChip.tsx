// The share control, as a chip in the bar.
//
// It used to be a verb with no object sitting under the writing — "Share with
// practitioner", or a red "Stop" that shouted at someone who was only reading.
// A state is a better control than a command here: the chip SAYS who can read
// the page, and pressing it opens the one thing you can do about that.
//
// Sharing from the menu does not ask again. Someone who went looking for this
// control has already answered "are you sure"; asking twice is a question about
// a question. Stopping is red because it is the only destructive thing here,
// but it sits behind a tap rather than under the words.
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { ChevronDown, EyeOff, Send } from 'lucide-react-native';
import { AnchoredMenu, useAnchoredMenu } from '@/src/ui/AnchoredMenu';
import { initialOf, type PractitionerFace } from '@/src/care/practitioner-face';
import { useTheme } from '@/src/ui/theme-mode';

const RED = '#B4443A';

export interface ShareChipCopy {
  canRead: string;   // "{name} can read this"
  private: string;   // "Private"
  sharedOn: string;  // "Shared {date}"
  onlyYou: string;   // "Only you can read this."
  stopSharing: string;
  shareWith: string; // "Share with {name}"
}

export function ShareChip({
  shared, sharedAt, busy, face, copy, locale, onToggle,
}: {
  shared: boolean;
  sharedAt: string | null;
  busy: boolean;
  face: PractitionerFace | null;
  copy: ShareChipCopy;
  locale: 'en' | 'fr';
  onToggle: (next: boolean) => void;
}) {
  const { t: TT } = useTheme();
  const name = (face?.name ?? '').replace(/^dr\.?\s*/i, '').trim();
  const label = shared ? copy.canRead.replace('{name}', name || copy.private) : copy.private;

  const menu = useAnchoredMenu();

  return (
    <>
      <Pressable
        ref={menu.ref}
        onPress={menu.show}
        disabled={busy}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, borderRadius: 15,
          paddingLeft: shared ? 3 : 11, paddingRight: 9,
          backgroundColor: shared ? '#E4F4EC' : 'rgba(255,255,255,0.12)',
        }}
      >
        {busy ? (
          <ActivityIndicator size="small" color={shared ? TT.accentDeep : TT.faint} />
        ) : shared ? (
          <Avatar face={face} />
        ) : null}
        <Text numberOfLines={1} style={{ fontSize: 11.5, fontWeight: '700', color: shared ? TT.accentDeep : 'rgba(255,255,255,0.72)', maxWidth: 150 }}>
          {label}
        </Text>
        <ChevronDown size={11} color={shared ? TT.accentDeep : 'rgba(255,255,255,0.55)'} strokeWidth={2.6} />
      </Pressable>

      <AnchoredMenu
        open={menu.open}
        anchor={menu.anchor}
        onClose={menu.hide}
        note={shared ? copy.sharedOn.replace('{date}', longDate(sharedAt, locale)) : copy.onlyYou}
        actions={[
          shared
            ? { key: 'stop', label: copy.stopSharing, color: RED, Icon: EyeOff, onPress: () => onToggle(false) }
            : { key: 'share', label: copy.shareWith.replace('{name}', name || ''), color: TT.accent, Icon: Send, onPress: () => onToggle(true) },
        ]}
      />
    </>
  );
}

function Avatar({ face }: { face: PractitionerFace | null }) {
  const { t: TT } = useTheme();
  if (face?.photoUrl) {
    return <Image source={{ uri: face.photoUrl }} style={{ width: 24, height: 24, borderRadius: 12 }} />;
  }
  return (
    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: TT.accent, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 11, fontWeight: '800', color: '#fff' }}>{initialOf(face?.name)}</Text>
    </View>
  );
}

/** "17 August" — the day it was sent, not a timestamp. Falls back to today when
 *  the server did not say, which is only ever the case immediately after a
 *  share, when today is the right answer anyway. */
function longDate(iso: string | null, locale: 'en' | 'fr'): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long' });
}
