// The ground the three tabs stand on.
//
// It was a flat #0E1512, which is a colour rather than a room: nothing to catch
// the eye, and every card on top of it sat at exactly the same depth. This is
// the same near-black with light in it — a warm bloom high on the screen, a cool
// one low, and the edges falling away — so the surface has somewhere to be
// brightest and the cards read as lying ON something.
//
// Drawn as one static SVG rather than stacked translucent views: gradients in
// views cost a layer each and would sit between the content and the touch
// handling. This is a single non-interactive layer under everything.
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { EDD } from './editorial';

export function Ground({ children, style }: { children: ReactNode; style?: object }) {
  return (
    <View style={[{ flex: 1, backgroundColor: EDD.ground }, style]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
        <Defs>
          {/* High and slightly left: the light falls where the greeting is, so
              a name reads against the brightest part of the screen. */}
          <RadialGradient id="ed-warm" cx="42%" cy="12%" rx="95%" ry="62%">
            <Stop offset="0" stopColor="#9C8563" stopOpacity="0.55" />
            <Stop offset="0.5" stopColor="#5A5140" stopOpacity="0.22" />
            <Stop offset="1" stopColor="#0E1512" stopOpacity="0" />
          </RadialGradient>

          {/* A cooler counterweight low down, so the screen is not simply warm
              at one end and dead at the other. */}
          <RadialGradient id="ed-cool" cx="78%" cy="92%" rx="80%" ry="48%">
            <Stop offset="0" stopColor="#2A4A44" stopOpacity="0.30" />
            <Stop offset="1" stopColor="#0E1512" stopOpacity="0" />
          </RadialGradient>

          {/* Edges fall away. Keeps the corners from competing with the content
              and stops the warm bloom looking like a spill. */}
          <RadialGradient id="ed-vignette" cx="50%" cy="45%" rx="78%" ry="70%">
            <Stop offset="0.55" stopColor="#000000" stopOpacity="0" />
            <Stop offset="1" stopColor="#000000" stopOpacity="0.38" />
          </RadialGradient>
        </Defs>

        <Rect x="0" y="0" width="100%" height="100%" fill="url(#ed-warm)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#ed-cool)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#ed-vignette)" />
      </Svg>
      {children}
    </View>
  );
}
