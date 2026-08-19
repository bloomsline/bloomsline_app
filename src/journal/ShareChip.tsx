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
import { useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { ChevronDown, EyeOff, Send } from 'lucide-react-native';
import { EDA } from '@/src/ui/editorial';
import { initialOf, type PractitionerFace } from '@/src/care/practitioner-face';

const RED = '#B4443A';
const MENU_W = 210;

export interface ShareChipCopy {
  canRead: string;   // "{name} can read this"
  private: string;   // "Private"
  sharedOn: string;  // "Shared {date}"
  onlyYou: string;   // "Only you can read this."
  stopSharing: string;
  shareWith: string; // "Share with {name}"
}

export function ShareChip({
  shared, sharedAt, busy, face, copy, locale, open, onOpen, onClose, onToggle,
}: {
  shared: boolean;
  sharedAt: string | null;
  busy: boolean;
  face: PractitionerFace | null;
  copy: ShareChipCopy;
  locale: 'en' | 'fr';
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onToggle: (next: boolean) => void;
}) {
  const name = (face?.name ?? '').replace(/^dr\.?\s*/i, '').trim();
  const label = shared ? copy.canRead.replace('{name}', name || copy.private) : copy.private;

  // A Modal renders against the WINDOW, not against this chip — on the web
  // build, where the app sits in a centred phone-width frame, a menu positioned
  // from the window edge lands outside the phone entirely. Measure the chip and
  // hang the menu off it, which is also what it should do on a tablet.
  const chip = useRef<View>(null);
  const { width: screenW } = useWindowDimensions();
  const [anchor, setAnchor] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const openAtChip = () => {
    chip.current?.measureInWindow((x, y, w, h) => setAnchor({ x, y, w, h }));
    onOpen();
  };

  const left = anchor
    ? Math.max(8, Math.min(anchor.x + anchor.w - MENU_W, screenW - MENU_W - 8))
    : Math.max(8, screenW - MENU_W - 18);
  const top = anchor ? anchor.y + anchor.h + 8 : 92;

  return (
    <>
      <Pressable
        ref={chip}
        onPress={openAtChip}
        disabled={busy}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, borderRadius: 15,
          paddingLeft: shared ? 3 : 11, paddingRight: 9,
          backgroundColor: shared ? '#E4F4EC' : 'rgba(255,255,255,0.12)',
        }}
      >
        {busy ? (
          <ActivityIndicator size="small" color={shared ? EDA.greenDeep : EDA.faint} />
        ) : shared ? (
          <Avatar face={face} />
        ) : null}
        <Text numberOfLines={1} style={{ fontSize: 11.5, fontWeight: '700', color: shared ? EDA.greenDeep : 'rgba(255,255,255,0.72)', maxWidth: 150 }}>
          {label}
        </Text>
        <ChevronDown size={11} color={shared ? EDA.greenDeep : 'rgba(255,255,255,0.55)'} strokeWidth={2.6} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
        <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(22,24,20,0.2)' }} />
        <View style={{ position: 'absolute', top, left, width: MENU_W, backgroundColor: '#fff', borderWidth: 1, borderColor: EDA.line, borderRadius: 16, overflow: 'hidden' }}>
          <Text style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10, fontSize: 11.5, color: EDA.faint, borderBottomWidth: 1, borderBottomColor: '#F1EFEA' }}>
            {shared ? copy.sharedOn.replace('{date}', longDate(sharedAt, locale)) : copy.onlyYou}
          </Text>
          <Pressable
            onPress={() => { onClose(); onToggle(!shared); }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14, paddingVertical: 13 }}
          >
            {shared
              ? <EyeOff size={15} color={RED} strokeWidth={1.9} />
              : <Send size={15} color={EDA.green} strokeWidth={1.9} />}
            <Text style={{ flex: 1, fontSize: 13.5, fontWeight: '700', color: shared ? RED : EDA.green }}>
              {shared ? copy.stopSharing : copy.shareWith.replace('{name}', name || '')}
            </Text>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

function Avatar({ face }: { face: PractitionerFace | null }) {
  if (face?.photoUrl) {
    return <Image source={{ uri: face.photoUrl }} style={{ width: 24, height: 24, borderRadius: 12 }} />;
  }
  return (
    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: EDA.green, alignItems: 'center', justifyContent: 'center' }}>
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
