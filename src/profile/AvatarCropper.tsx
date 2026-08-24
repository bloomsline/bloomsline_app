// Choosing which part of the photograph is the face.
//
// The first version resized straight to 512×512, which forces both dimensions
// and squashes anything that is not already square — every portrait photo came
// out compressed sideways. A square avatar has to be CROPPED to a square, not
// resized into one.
//
// `allowsEditing` gives the system cropper on iOS and Android and does nothing
// on web, where expo-image-picker's implementation handles only `mediaTypes`
// and friends. Patients use the web app on their phones, so the crop has to
// exist here or it does not exist for them.
//
// Drag to move, the track below to zoom. No pinch: it needs two pointers, which
// rules out anyone on a desktop browser, and the track works with a thumb and a
// mouse alike.
import { useRef, useState } from 'react';
import { Image, Modal, PanResponder, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useTheme } from '@/src/ui/theme-mode';
import { useI18n } from '@/src/i18n';
import { OVER_MEDIA } from '@/src/ui/tokens';

export interface CropRect {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

const MAX_ZOOM = 3;
const TRACK_H = 34;

export function AvatarCropper({ uri, imageW, imageH, onCancel, onDone }: {
  uri: string;
  imageW: number;
  imageH: number;
  onCancel: () => void;
  /** The crop in SOURCE pixels, ready for ImageManipulator. */
  onDone: (crop: CropRect) => void;
}) {
  const { t: TT } = useTheme();
  const { t } = useI18n();
  const tr = t.profile;
  const { width: screenW } = useWindowDimensions();
  const frame = Math.min(screenW - 48, 320);

  // `base` makes the image exactly cover the frame at zoom 1, so there is never
  // a gap to crop into.
  const base = frame / Math.min(imageW, imageH);
  // Open on the MIDDLE of the photograph. At (0, 0) the frame sits on the top
  // left corner, so a portrait opened on somebody's hair.
  const start = { x: (frame - imageW * base) / 2, y: (frame - imageH * base) / 2 };
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState(start);

  // Refs shadow the state so the gesture reads current values without
  // re-creating the responder on every frame.
  const zoomRef = useRef(1);
  const offsetRef = useRef(start);
  const startRef = useRef({ x: 0, y: 0 });

  /** Keep the image covering the frame: no edge may come inside it. */
  const clamp = (x: number, y: number, z: number) => {
    const k = base * z;
    const dw = imageW * k;
    const dh = imageH * k;
    return {
      x: Math.min(0, Math.max(frame - dw, x)),
      y: Math.min(0, Math.max(frame - dh, y)),
    };
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { startRef.current = { ...offsetRef.current }; },
      onPanResponderMove: (_e, g) => {
        const next = clampRef.current(startRef.current.x + g.dx, startRef.current.y + g.dy, zoomRef.current);
        offsetRef.current = next;
        setOffset(next);
      },
    }),
  ).current;

  // The clamp closes over `frame` and the image size, which are known only after
  // the first render; a ref keeps the responder pointing at the current one.
  const clampRef = useRef(clamp);
  clampRef.current = clamp;

  const setZoomTo = (z: number) => {
    const next = Math.min(MAX_ZOOM, Math.max(1, z));
    zoomRef.current = next;
    setZoom(next);
    const c = clamp(offsetRef.current.x, offsetRef.current.y, next);
    offsetRef.current = c;
    setOffset(c);
  };

  const trackW = frame;
  const track = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => setZoomFromX(e.nativeEvent.locationX),
      onPanResponderMove: (e) => setZoomFromX(e.nativeEvent.locationX),
    }),
  ).current;
  const setZoomFromXRef = useRef((x: number) => {});
  setZoomFromXRef.current = (x: number) => setZoomTo(1 + (Math.min(trackW, Math.max(0, x)) / trackW) * (MAX_ZOOM - 1));
  const setZoomFromX = (x: number) => setZoomFromXRef.current(x);

  const done = () => {
    const k = base * zoom;
    // The frame, expressed in the source image's own pixels.
    const side = frame / k;
    onDone({
      originX: Math.max(0, Math.round(-offset.x / k)),
      originY: Math.max(0, Math.round(-offset.y / k)),
      width: Math.round(Math.min(side, imageW)),
      height: Math.round(Math.min(side, imageH)),
    });
  };

  const k = base * zoom;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      {/* Opaque, not a scrim. A translucent one left the form legible behind
          the crop circle, which read as two screens fighting rather than as an
          editor. A photo editor gets the whole screen, like the lightbox. */}
      <View style={{ flex: 1, backgroundColor: TT.slot, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <View style={{ width: frame, alignItems: 'center' }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: OVER_MEDIA.ink, marginBottom: 14 }}>{tr.cropTitle}</Text>

          {/* The frame. `overflow: hidden` is the crop — what you see inside it
              is exactly what is cut, so there is nothing to explain. */}
          <View
            {...pan.panHandlers}
            // `slot`: the ground behind a picture that has not covered it yet.
            // Dark in both themes on purpose — this frame is a media surface, not
            // a page surface.
            style={{ width: frame, height: frame, borderRadius: frame / 2, overflow: 'hidden', backgroundColor: TT.slot }}
          >
            <Image
              source={{ uri }}
              style={{ position: 'absolute', left: offset.x, top: offset.y, width: imageW * k, height: imageH * k }}
            />
          </View>

          {/* Zoom */}
          <View
            {...track.panHandlers}
            style={{ width: trackW, height: TRACK_H, justifyContent: 'center', marginTop: 18 }}
          >
            <View style={{ height: 3, borderRadius: 2, backgroundColor: OVER_MEDIA.control }} />
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: ((zoom - 1) / (MAX_ZOOM - 1)) * (trackW - 22),
                width: 22, height: 22, borderRadius: 11, backgroundColor: OVER_MEDIA.ink,
              }}
            />
          </View>

          {/* `width` explicitly: the parent centres its children, which makes
              them shrink to fit, and `flex: 1` then divides almost nothing —
              both labels wrapped inside their own pills. */}
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 22, width: frame }}>
            <Pressable
              onPress={onCancel}
              accessibilityRole="button"
              style={{ flex: 1, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: OVER_MEDIA.control }}
            >
              <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: '700', color: OVER_MEDIA.ink }}>{t.common.cancel}</Text>
            </Pressable>
            <Pressable
              onPress={done}
              accessibilityRole="button"
              accessibilityLabel={tr.usePhoto}
              style={{ flex: 1, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: TT.accent }}
            >
              <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: '700', color: TT.onAccent }}>{tr.usePhoto}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
