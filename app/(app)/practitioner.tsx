// c2 — Practitioner profile, from the practitioner's own public profile via
// /api/mobile/care. Hybrid editorial re-skin: the practitioner's photo (or a
// calm fallback) becomes the dark hero, then light editorial facts + bio + CTA.
//
// Every field here is optional, and anything missing is OMITTED rather than
// filled with a placeholder. This screen previously shipped hardcoded sample
// text ("Dr. Maya Laurent", "Lumen Clinic", a fake bio), which read as fact to
// a patient looking at their actual clinician. A sparse profile is honest; an
// invented one is not.
import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import { EdHeader, EdCard, EdSection, EdPill, FadeIn, MonoLabel } from '@/src/ui/editorial';
import { ONBOARDING_IMAGES } from '@/src/onboarding/editorial/images';
import { useOnboarding } from '@/src/onboarding/context';
import { fetchCare, type CarePractitioner } from '@/src/api/care';
import { useI18n, fmt } from '@/src/i18n';
import { useTheme } from '@/src/ui/theme-mode';

const T = {
  en: {
    yourPractitioner: 'Your practitioner',
    book: 'Book a session',
    arranges: '{name} arranges your sessions. Reach out to book.',
    arrangesGeneric: 'Your practitioner arranges your sessions.',
  },
  fr: {
    yourPractitioner: 'Votre praticien',
    book: 'Réserver une séance',
    arranges: '{name} organise vos séances. Contactez cette personne pour réserver.',
    arrangesGeneric: 'Votre praticien organise vos séances.',
  },
} as const;

/** Join non-empty parts for a subtitle, or null when there is nothing to say. */
function joinOrNull(parts: (string | null | undefined)[], sep: string): string | null {
  const kept = parts.map((p) => p?.trim()).filter((p): p is string => Boolean(p));
  return kept.length > 0 ? kept.join(sep) : null;
}

export default function Practitioner() {
  const { t: TT } = useTheme();
  const router = useRouter();
  const { locale, t } = useI18n();
  const tr = T[locale];
  const { practitionerName } = useOnboarding();
  const [p, setP] = useState<CarePractitioner | null>(null);
  const [canBook, setCanBook] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      fetchCare().then((c) => {
        if (!alive) return;
        setP(c?.practitioner ?? null);
        // Default to allowing when the block is absent (older backend), so we
        // never hide a button the server would honour.
        setCanBook(c?.permissions?.canBook ?? true);
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

  const headline = joinOrNull([p?.headline, p?.specialties?.length ? p.specialties.join(', ') : null], ' · ');
  const location = joinOrNull([p?.city, p?.country], ', ');
  const sessions = p?.sessionTypes?.length ? p.sessionTypes.join(' · ') : null;
  const languages = p?.languages?.length ? p.languages.join(', ') : null;
  const facts = [
    location ? { label: t.profile.location, value: location } : null,
    sessions ? { label: t.profile.sessions, value: sessions } : null,
    languages ? { label: t.profile.languages, value: languages } : null,
  ].filter((f): f is { label: string; value: string } => f !== null);

  return (
    <View style={{ flex: 1, backgroundColor: TT.bg }}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <EdHeader
          kicker="YOUR PRACTITIONER"
          title={name ?? tr.yourPractitioner}
          subtitle={headline ?? undefined}
          onBack={() => router.back()}
          source={p?.photoUrl ? { uri: p.photoUrl } : ONBOARDING_IMAGES.card3}
        />

        <FadeIn style={{ paddingHorizontal: 22, paddingTop: 20 }}>
          {facts.length > 0 && (
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
              {facts.map((f) => (
                <FactCard key={f.label} label={f.label} value={f.value} />
              ))}
            </View>
          )}

          {p?.bio ? (
            <EdCard style={{ marginTop: facts.length > 0 ? 0 : 6, marginBottom: 14 }}>
              <EdSection label={t.profile.about} />
              <Text style={{ fontSize: 14, color: TT.inkSoft, lineHeight: 22 }}>{p.bio}</Text>
            </EdCard>
          ) : null}

          {canBook ? (
            <EdPill
              label={tr.book}
              variant="green"
              onPress={() => router.navigate('/book' as never)}
              style={{ marginTop: facts.length === 0 && !p?.bio ? 14 : 6 }}
            />
          ) : (
            <Text style={{ fontSize: 12.5, color: TT.inkSoft, textAlign: 'center', marginTop: facts.length === 0 && !p?.bio ? 20 : 6, lineHeight: 18 }}>
              {name ? fmt(tr.arranges, { name }) : tr.arrangesGeneric}
            </Text>
          )}
        </FadeIn>
      </ScrollView>
    </View>
  );
}

function FactCard({ label, value }: { label: string; value: string }) {
  const { t: TT } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: TT.card, borderWidth: 1, borderColor: TT.line, borderRadius: 16, padding: 14, alignItems: 'center' }}>
      <MonoLabel color={TT.faint} size={9.5}>{label}</MonoLabel>
      <Text style={{ fontSize: 13.5, color: TT.ink, fontWeight: '600', marginTop: 6, textAlign: 'center' }}>{value}</Text>
    </View>
  );
}
