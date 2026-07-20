// c2 — Practitioner profile, from the practitioner's own public profile via
// /api/mobile/care.
//
// Every field here is optional, and anything missing is OMITTED rather than
// filled with a placeholder. This screen previously shipped hardcoded sample
// text ("Dr. Maya Laurent", "Lumen Clinic", a fake bio), which read as fact to
// a patient looking at their actual clinician. A sparse profile is honest; an
// invented one is not.
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { CareHeader } from '@/src/care/CareHeader';
import { CARE } from '@/src/care/theme';
import { useOnboarding } from '@/src/onboarding/context';
import { fetchCare, type CarePractitioner } from '@/src/api/care';

/** Join non-empty parts for a subtitle, or null when there is nothing to say. */
function joinOrNull(parts: (string | null | undefined)[], sep: string): string | null {
  const kept = parts.map((p) => p?.trim()).filter((p): p is string => Boolean(p));
  return kept.length > 0 ? kept.join(sep) : null;
}

export default function Practitioner() {
  const router = useRouter();
  const { practitionerName } = useOnboarding();
  const [p, setP] = useState<CarePractitioner | null>(null);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      fetchCare().then((c) => {
        if (!alive) return;
        setP(c?.practitioner ?? null);
        setLoaded(true);
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  // Fall back to the name we already knew rather than showing nothing while the
  // request is in flight.
  const name = p?.name ?? practitionerName ?? null;
  const initial = (name ?? '').replace(/^dr\.?\s*/i, '').charAt(0).toUpperCase() || '?';

  const subtitle = joinOrNull([p?.headline, p?.specialties?.length ? p.specialties.join(', ') : null], ' · ');
  const location = joinOrNull([p?.city, p?.country], ', ');
  const sessions = p?.sessionTypes?.length ? p.sessionTypes.join(' · ') : null;
  const languages = p?.languages?.length ? p.languages.join(', ') : null;
  const facts = [
    location ? { label: 'Location', value: location } : null,
    sessions ? { label: 'Sessions', value: sessions } : null,
    languages ? { label: 'Languages', value: languages } : null,
  ].filter((f): f is { label: string; value: string } => f !== null);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: CARE.canvas }}>
      <CareHeader />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: 'center', paddingTop: 8 }}>
          {p?.photoUrl ? (
            <Image
              source={{ uri: p.photoUrl }}
              style={{ width: 84, height: 84, borderRadius: 42, marginBottom: 14 }}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: CARE.teal, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 32 }}>{initial}</Text>
            </View>
          )}

          {name ? (
            <Text style={{ fontSize: 22, fontWeight: '700', color: CARE.ink }}>{name}</Text>
          ) : !loaded ? (
            <ActivityIndicator color={CARE.teal} />
          ) : (
            <Text style={{ fontSize: 22, fontWeight: '700', color: CARE.ink }}>Your practitioner</Text>
          )}

          {subtitle && (
            <Text style={{ fontSize: 14, color: '#9A9A9A', marginTop: 2, textAlign: 'center' }}>{subtitle}</Text>
          )}
        </View>

        {facts.length > 0 && (
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 22, marginBottom: 14 }}>
            {facts.map((f) => (
              <FactCard key={f.label} label={f.label} value={f.value} />
            ))}
          </View>
        )}

        {p?.bio ? (
          <View style={{ backgroundColor: CARE.card, borderWidth: 1, borderColor: CARE.border, borderRadius: 18, padding: 18, marginTop: facts.length > 0 ? 0 : 22, marginBottom: 14 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: CARE.ink, marginBottom: 8 }}>About</Text>
            <Text style={{ fontSize: 13.5, color: '#7A7A7A', lineHeight: 21 }}>{p.bio}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          onPress={() => router.navigate('/book' as never)}
          activeOpacity={0.85}
          style={{ height: 50, borderRadius: 25, backgroundColor: CARE.teal, alignItems: 'center', justifyContent: 'center', marginTop: facts.length === 0 && !p?.bio ? 28 : 0 }}
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
      <Text style={{ fontSize: 13.5, color: CARE.ink, fontWeight: '600', marginTop: 4, textAlign: 'center' }}>{value}</Text>
    </View>
  );
}
