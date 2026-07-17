import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C } from './theme';

// The warm sunrise illustration on the welcome screen (g1/q1). Layered views
// approximate the design's gradient sky + rising sun + two rolling hills.
// (A pixel-exact SVG can replace this later without touching callers.)
export function SunriseHero({ height = 296 }: { height?: number }) {
  return (
    <View style={{ height }} className="w-full overflow-hidden">
      <LinearGradient colors={[C.skyTop, C.skyBottom]} style={{ position: 'absolute', inset: 0 }} />

      {/* sun glow */}
      <View
        style={{ position: 'absolute', bottom: height * 0.16, alignSelf: 'center', width: 260, height: 260, borderRadius: 130, backgroundColor: C.sunGlow, opacity: 0.55 }}
      />
      <View
        style={{ position: 'absolute', bottom: height * 0.2, alignSelf: 'center', width: 150, height: 150, borderRadius: 75, backgroundColor: C.sunGlow2, opacity: 0.6 }}
      />
      {/* sun disc */}
      <View style={{ position: 'absolute', bottom: height * 0.26, alignSelf: 'center', width: 76, height: 76, borderRadius: 38, backgroundColor: C.sunDisc }} />

      {/* rolling hills */}
      <View style={{ position: 'absolute', bottom: -80, left: -60, right: -60, height: 200, borderTopLeftRadius: 400, borderTopRightRadius: 400, backgroundColor: C.hillBack }} />
      <View style={{ position: 'absolute', bottom: -110, left: -40, right: -120, height: 200, borderTopLeftRadius: 380, borderTopRightRadius: 380, backgroundColor: C.hillFront }} />
    </View>
  );
}
