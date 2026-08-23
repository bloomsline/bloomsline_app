// The practitioner's face, wherever it appears.
//
// It existed on the practitioner's own profile and nowhere else: My Care, the
// session menu and the booking confirmation each drew a coloured circle with a
// letter in it, while the photo sat unread in the very payload those screens had
// already fetched. A patient saw their practitioner's face once and an initial
// everywhere else.
//
// One component, so the next screen that needs an avatar gets the photo by
// default rather than reinventing the letter.
import { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { initialOf, usePractitionerFace } from '@/src/care/practitioner-face';
import { useTheme } from '@/src/ui/theme-mode';

export function PractitionerAvatar({
  size,
  name,
  photoUrl,
  tone = 'tint',
  style,
}: {
  size: number;
  name?: string | null;
  /** Pass it when the screen already has it, and no fetch happens. Omitted, the
   *  session-wide cached face is used — one request per session, shared. */
  photoUrl?: string | null;
  /** `tint` is the pale accent disc used on My Care; `solid` the filled accent
   *  one the session screens use. Only matters for the fallback letter. */
  tone?: 'tint' | 'solid';
  /** Spacing only — the disc's own size and shape are the component's. An
   *  Image and a View do not share a style type, and margins are all a caller
   *  has ever wanted. */
  style?: { marginTop?: number; marginBottom?: number; marginLeft?: number; marginRight?: number };
}) {
  const { t: TT } = useTheme();
  // A screen that already holds the care payload passes the photo in and no
  // request is made. The ones that do not (the session menu, the booking
  // confirmation) omit it and share one fetch between them.
  const face = usePractitionerFace(photoUrl === undefined);
  // A photo that will not load must not leave an empty disc — fall through to
  // the letter, which is what these screens showed before there was a photo.
  const [broken, setBroken] = useState(false);

  const uri = photoUrl ?? face?.photoUrl ?? null;
  if (uri && !broken) {
    return (
      <Image
        source={{ uri }}
        onError={() => setBroken(true)}
        // The tint sits behind the photo so a slow one arrives as a pale disc.
        // react-native-web paints an unresolved Image black otherwise, which
        // reads as a hole where the face should be.
        style={[{ width: size, height: size, borderRadius: size / 2, borderWidth: 1, borderColor: TT.cardLine, backgroundColor: TT.accentTint }, style]}
      />
    );
  }

  const solid = tone === 'solid';
  return (
    <View
      style={[{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: solid ? TT.accent : TT.accentTint,
        borderWidth: solid ? 0 : 1, borderColor: TT.cardLine,
        alignItems: 'center', justifyContent: 'center',
      }, style]}
    >
      <Text style={{ color: solid ? TT.onAccent : TT.accent, fontWeight: '700', fontSize: size * 0.38 }}>
        {initialOf(name ?? face?.name)}
      </Text>
    </View>
  );
}
