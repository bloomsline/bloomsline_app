// c2 — Practitioner profile. Built from the V2 cloud design (Flow C). Data is
// placeholder until the mobile practitioner-profile API is wired.
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CareHeader } from '@/src/care/CareHeader';
import { CARE } from '@/src/care/theme';
import { useOnboarding } from '@/src/onboarding/context';

export default function Practitioner() {
  const router = useRouter();
  const { practitionerName } = useOnboarding();
  const name = practitionerName ?? 'Dr. Maya Laurent';
  const initial = name.replace(/^dr\.?\s*/i, '').charAt(0).toUpperCase() || 'M';

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: CARE.canvas }}>
      <CareHeader />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: 'center', paddingTop: 8 }}>
          <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: CARE.teal, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 32 }}>{initial}</Text>
          </View>
          <Text style={{ fontSize: 22, fontWeight: '700', color: CARE.ink }}>{name}</Text>
          <Text style={{ fontSize: 14, color: '#9A9A9A', marginTop: 2 }}>Clinical psychologist · Anxiety & CBT</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 12, marginTop: 22, marginBottom: 14 }}>
          <FactCard label="Practice" value="Lumen Clinic" />
          <FactCard label="Sessions" value="Video · 50 min" />
        </View>

        <View style={{ backgroundColor: CARE.card, borderWidth: 1, borderColor: CARE.border, borderRadius: 18, padding: 18, marginBottom: 14 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: CARE.ink, marginBottom: 8 }}>About</Text>
          <Text style={{ fontSize: 13.5, color: '#7A7A7A', lineHeight: 21 }}>
            I work with adults navigating anxiety and stress, using warm, evidence-based CBT. My aim is a calm, judgment-free space.
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => router.navigate('/book' as never)}
          activeOpacity={0.85}
          style={{ height: 50, borderRadius: 25, backgroundColor: CARE.teal, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>Book a session</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function FactCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: CARE.card, borderWidth: 1, borderColor: CARE.border, borderRadius: 16, padding: 14, alignItems: 'center' }}>
      <Text style={{ fontSize: 11, fontWeight: '600', color: CARE.muted, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</Text>
      <Text style={{ fontSize: 13.5, color: CARE.ink, fontWeight: '600', marginTop: 4 }}>{value}</Text>
    </View>
  );
}
