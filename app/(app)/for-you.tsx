// For You — Flow E "Space for you" landing (screen e0), from the V2 cloud design.
// Two self-guided spaces: a private Journal, and Small activities (the Library of
// practitioner-made practices, always open, never assigned).
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { PenLine, Sprout } from 'lucide-react-native';
import { TabBar } from '@/src/ui/TabBar';
import { CARE } from '@/src/care/theme';

const ORANGE = '#C87941';
const ORANGE_TINT = '#FCF1E7';

export default function ForYou() {
  const router = useRouter();
  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: CARE.canvas }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 26, paddingBottom: 180 }} showsVerticalScrollIndicator={false}>
        <Text style={{ fontSize: 28, fontWeight: '700', letterSpacing: -0.6, color: CARE.ink }}>Space for you</Text>
        <Text style={{ fontSize: 13.5, color: '#9A9A9A', marginTop: 4, marginBottom: 26 }}>Take what helps, whenever it suits you.</Text>

        {/* Journal */}
        <View style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: CARE.border, borderRadius: 24, padding: 24, marginBottom: 16 }}>
          <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: CARE.mint, alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
            <PenLine size={24} color={CARE.teal} strokeWidth={2} />
          </View>
          <Text style={{ fontSize: 20, fontWeight: '700', color: CARE.ink, marginBottom: 6 }}>Journal</Text>
          <Text style={{ fontSize: 14, color: '#7A7A7A', lineHeight: 22, marginBottom: 18 }}>A private place to write freely. Only you can read this.</Text>
          <TouchableOpacity onPress={() => router.navigate('/journal' as never)} activeOpacity={0.85} style={{ height: 48, borderRadius: 24, backgroundColor: CARE.teal, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>Open journal</Text>
          </TouchableOpacity>
        </View>

        {/* Small activities */}
        <View style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: CARE.border, borderRadius: 24, padding: 24 }}>
          <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: ORANGE_TINT, alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
            <Sprout size={24} color={ORANGE} strokeWidth={2} />
          </View>
          <Text style={{ fontSize: 20, fontWeight: '700', color: CARE.ink, marginBottom: 6 }}>Small activities</Text>
          <Text style={{ fontSize: 14, color: '#7A7A7A', lineHeight: 22, marginBottom: 18 }}>Short practices made by practitioners — always open, never assigned.</Text>
          <TouchableOpacity onPress={() => router.navigate('/library' as never)} activeOpacity={0.85} style={{ height: 48, borderRadius: 24, backgroundColor: '#fff', borderWidth: 1.5, borderColor: CARE.teal, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: CARE.teal }}>Browse activities</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <TabBar active="foryou" />
    </SafeAreaView>
  );
}
