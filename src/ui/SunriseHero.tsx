import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// Soft dawn wash for the welcome screen. A warm gradient that fades to white at
// the bottom (so it blends into the content, no hard seam), one faint sun glow
// (no hard rings), and a single gentle hill. Calm and premium, not literal.
export function SunriseHero({ height = 260 }: { height?: number }) {
  return (
    <View style={{ height }} className="w-full overflow-hidden">
      <LinearGradient colors={['#FCEAD6', '#FBEEE2', '#FFFFFF']} locations={[0, 0.55, 1]} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />

      {/* soft sun glow — low opacity so the edges read as ambient warmth */}
      <View style={{ position: 'absolute', bottom: height * 0.24, alignSelf: 'center', width: 320, height: 320, borderRadius: 160, backgroundColor: '#F8CE97', opacity: 0.22 }} />
      <View style={{ position: 'absolute', bottom: height * 0.3, alignSelf: 'center', width: 190, height: 190, borderRadius: 95, backgroundColor: '#F4BC80', opacity: 0.26 }} />

      {/* one gentle hill, blending up into the white content */}
      <View style={{ position: 'absolute', bottom: -70, left: -100, right: -100, height: 170, borderTopLeftRadius: 500, borderTopRightRadius: 500, backgroundColor: '#DEEAE3' }} />
    </View>
  );
}
