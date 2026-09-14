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
import { joinFirstNames } from '@/src/care/practitioner-names';
import { useTheme } from '@/src/ui/theme-mode';
import { veil } from '@/src/ui/tokens';

const RED = '#B4443A';

export interface ShareChipCopy {
  canRead: string;   // "{name} can read this"
  canReadMany: string; // the same, for several names (French conjugates)
  private: string;   // "Private"
  sharedOn: string;  // "Shared {date}"
  onlyYou: string;   // "Only you can read this."
  stopSharing: string;
  shareWith: string; // "Share with {name}"
  sharedElsewhere?: string; // "Shared with {names}": shared, but not with the one selected
  alsoWith?: string;        // "Also shared with {names}."
  notYet?: string;          // "{name} can't read this."
  stopSharingWith?: string; // "Stop sharing with {name}": someone else keeps reading it
}

export function ShareChip({
  shared, sharedAt, busy, face, names, copy, locale, onToggle, others = [],
}: {
  /** Other practitioners who can read it, beside the selected one (see
   *  care/other-readers). Only ever set with a practitioner switcher. */
  others?: string[];
  shared: boolean;
  /** Everyone the page reaches when shared. The face shows the first; the words
   *  name them all, because naming one of two told the patient it went to one. */
  names: string[];
  sharedAt: string | null;
  busy: boolean;
  face: PractitionerFace | null;
  copy: ShareChipCopy;
  locale: 'en' | 'fr';
  onToggle: (next: boolean) => void;
}) {
  const { t: TT, mode } = useTheme();
  const all = names.length ? names : face?.name ? [face.name] : [];
  const name = joinFirstNames(all, locale);
  // No name to give is not "Private can read this", which is what it said.
  const elsewhere = joinFirstNames(others, locale);
  // Not shared with the practitioner on screen, but someone else can read it:
  // "Private" would say no one can.
  const sharedElsewhere = !shared && !!elsewhere && !!copy.sharedElsewhere;
  const label = shared && name
    ? (all.length > 1 ? copy.canReadMany : copy.canRead).replace('{name}', name)
    : sharedElsewhere ? copy.sharedElsewhere!.replace('{names}', elsewhere) : copy.private;
  const note = shared
    ? [`${copy.sharedOn.replace('{date}', longDate(sharedAt, locale))}.`, elsewhere && copy.alsoWith ? copy.alsoWith.replace('{names}', elsewhere) : ''].filter(Boolean).join(' ')
    : sharedElsewhere
      ? [name && copy.notYet ? copy.notYet.replace('{name}', name) : '', `${copy.sharedElsewhere!.replace('{names}', elsewhere)}.`].filter(Boolean).join(' ')
      : copy.onlyYou;

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
          backgroundColor: shared ? TT.accentTint : veil(mode, 0.10),
        }}
      >
        {busy ? (
          <ActivityIndicator size="small" color={shared ? TT.accentDeep : TT.faint} />
        ) : shared ? (
          <Avatar face={face} />
        ) : null}
        <Text numberOfLines={1} style={{ fontSize: 11.5, fontWeight: '700', color: shared ? TT.accentDeep : TT.inkSoft, maxWidth: 150 }}>
          {label}
        </Text>
        <ChevronDown size={11} color={shared ? TT.accentDeep : TT.faint} strokeWidth={2.6} />
      </Pressable>

      <AnchoredMenu
        open={menu.open}
        anchor={menu.anchor}
        onClose={menu.hide}
        note={note}
        actions={[
          shared
            // Stopping is for the practitioner on screen only; when someone else
            // keeps reading it, the action says whom it stops for.
            ? { key: 'stop', label: elsewhere && name && copy.stopSharingWith ? copy.stopSharingWith.replace('{name}', name) : copy.stopSharing, color: RED, Icon: EyeOff, onPress: () => onToggle(false) }
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
      <Text style={{ fontSize: 11, fontWeight: '800', color: TT.onAccent }}>{initialOf(face?.name)}</Text>
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
