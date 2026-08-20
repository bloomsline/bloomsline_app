// The ground the three tabs stand on.
//
// A warm bloom sitting high and centred, over a base that darkens toward the
// foot of the screen — the light lands behind the greeting rather than behind
// the cards. The colours are not invented: they are sampled from the design,
// so the peak is its (51,42,33) against (24,28,26) at the top corners.
//
// It is an IMAGE, and that is the point. Two earlier versions failed:
//
//   SVG radial gradients looked right and then vanished after the app was
//   backgrounded and reopened. An SVG fill is a reference to an id elsewhere in
//   the document (`url(#ed-warm)`), and that reference is what a repaint after
//   restore is known to drop. All three screens also declared the same ids,
//   which collide the day two of them mount at once.
//
//   LinearGradient survives a repaint but cannot concentrate light at a point,
//   so the bloom flattened into a wash coming from above.
//
// A bitmap has no ids to resolve and no compositing to redo. It is 8KB for a
// 160x320 source, because a gradient carries no detail worth more than that;
// it is stretched rather than cropped so the bloom keeps its position on any
// screen shape.
import type { ReactNode } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { EDD } from './editorial';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const GROUND = require('../../assets/ground.png');

export function Ground({ children, style }: { children: ReactNode; style?: object }) {
  return (
    <View style={[{ flex: 1, backgroundColor: EDD.ground }, style]}>
      <Image
        source={GROUND}
        resizeMode="stretch"
        // absoluteFill alone is not enough: an Image keeps the source's own
        // dimensions unless the style overrides them, so the 160x320 asset drew
        // at 160x320 in the middle of the screen with a seam down its edge.
        style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
        // Decorative: it carries no information a screen reader should announce.
        accessible={false}
      />
      {children}
    </View>
  );
}
