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
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import { EdHeader, EdCard, EdSection, EdPill, FadeIn, Kicker } from '@/src/ui/editorial';
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
      fetchCare(locale).then((c) => {
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
    }, [locale]),
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

  // Standing and format, as words rather than sections. "Accepting patients" is
  // left off on purpose: this patient is already in their care, so it answers a
  // question they are not asking. The other two states DO matter, because they
  // explain a booking screen that may turn them away.
  const pills = [
    p?.isVerified ? t.profile.verified : null,
    p?.acceptanceStatus === 'waitlist' ? t.profile.waitlist : null,
    p?.acceptanceStatus === 'not_accepting' ? t.profile.notAccepting : null,
    p?.offersTelehealth ? t.profile.online : null,
    p?.offersInPerson ? t.profile.inPerson : null,
    p?.yearsExperience != null ? fmt(t.profile.yearsExperience, { n: p.yearsExperience }) : null,
  ].filter((v): v is string => v !== null);

  const contacts = [
    p?.contactEmail ? { label: p.contactEmail, url: `mailto:${p.contactEmail}` } : null,
    p?.contactPhone ? { label: p.contactPhone, url: `tel:${p.contactPhone.replace(/\s+/g, '')}` } : null,
    p?.website ? { label: t.profile.website, url: p.website } : null,
    p?.linkedin ? { label: 'LinkedIn', url: p.linkedin } : null,
    p?.instagram ? { label: 'Instagram', url: p.instagram } : null,
    p?.facebook ? { label: 'Facebook', url: p.facebook } : null,
    p?.twitter ? { label: 'X', url: p.twitter } : null,
  ].filter((c): c is { label: string; url: string } => c !== null);

  return (
    <View style={{ flex: 1, backgroundColor: TT.bg }}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <EdHeader
          kicker={tr.yourPractitioner}
          title={name ?? tr.yourPractitioner}
          subtitle={headline ?? undefined}
          onBack={() => router.back()}
          source={p?.photoUrl ? { uri: p.photoUrl } : ONBOARDING_IMAGES.card3}
        />

        <FadeIn style={{ paddingHorizontal: 22, paddingTop: 20 }}>
          {/* Standing, before detail: whether they are taking anyone on, and
              whether we have checked who they are. Both are single words and
              both change how the rest of the page reads. */}
          {pills.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 14 }}>
              {pills.map((label) => (
                <View key={label} style={{ backgroundColor: TT.accentTint, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 }}>
                  <Text style={{ fontSize: 11.5, fontWeight: '600', color: TT.accent }}>{label}</Text>
                </View>
              ))}
            </View>
          )}

          {facts.length > 0 && (
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
              {facts.map((f) => (
                <FactCard key={f.label} label={f.label} value={f.value} />
              ))}
            </View>
          )}

          {p?.bio ? (
            <EdCard style={{ marginBottom: 14 }}>
              <EdSection label={t.profile.about} />
              <Text style={{ fontSize: 14, color: TT.inkSoft, lineHeight: 22 }}>{p.bio}</Text>
            </EdCard>
          ) : null}

          {p?.introVideoUrl ? (
            <EdCard style={{ marginBottom: 14 }} onPress={() => open(p.introVideoUrl)}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: TT.accent }}>{t.profile.introVideo}</Text>
            </EdCard>
          ) : null}

          <Chips label={t.profile.specialties} items={p?.specialties ?? []} />
          <Chips label={t.profile.approaches} items={p?.approaches ?? []} />
          <Chips label={t.profile.agesServed} items={p?.agesServed ?? []} />

          {/* Qualifications, in the order the public profile lists them. The
              free-text credentials read as chips; the three structured lists
              are lines, because "MSc, Université de Paris, 2014" is a sentence
              and a chip would break it in the middle. */}
          {(p?.credentials.length || p?.education.length || p?.licenses.length || p?.certifications.length) ? (
            <EdCard style={{ marginBottom: 14 }}>
              <EdSection label={t.profile.credentials} />
              {p.credentials.length > 0 ? (
                <Text style={{ fontSize: 14, color: TT.ink, fontWeight: '600', marginBottom: p.education.length || p.licenses.length || p.certifications.length ? 12 : 0 }}>
                  {p.credentials.join(' · ')}
                </Text>
              ) : null}
              <Group label={t.profile.education} lines={p.education.map((e) => joinOrNull([e.degree, e.institution, e.year], ' · ')).filter(Boolean) as string[]} />
              <Group label={t.profile.licenses} lines={p.licenses.map((l) => joinOrNull([l.title, l.region], ' · ')).filter(Boolean) as string[]} />
              <Group label={t.profile.certifications} lines={p.certifications.map((c) => joinOrNull([c.name, c.issuer], ' · ')).filter(Boolean) as string[]} />
            </EdCard>
          ) : null}

          {p?.publications.length ? (
            <EdCard style={{ marginBottom: 14 }}>
              <EdSection label={t.profile.publications} />
              {p.publications.map((pub, i) => (
                <Pressable
                  key={`${pub.title}-${i}`}
                  onPress={() => open(pub.url)}
                  disabled={!pub.url}
                  style={{ marginTop: i === 0 ? 0 : 12 }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '600', color: pub.url ? TT.accent : TT.ink, lineHeight: 20 }}>{pub.title}</Text>
                  {joinOrNull([pub.type, pub.description], ' · ') ? (
                    <Text style={{ fontSize: 12.5, color: TT.inkSoft, marginTop: 2, lineHeight: 18 }}>
                      {joinOrNull([pub.type, pub.description], ' · ')}
                    </Text>
                  ) : null}
                </Pressable>
              ))}
            </EdCard>
          ) : null}

          {/* The address was already in the payload and had never been drawn.
              The Maps link wins when both exist: an address alone does not
              always find a side entrance. */}
          {p?.address || p?.mapsUrl ? (
            <EdCard style={{ marginBottom: 14 }} onPress={p.mapsUrl ? () => open(p.mapsUrl) : undefined}>
              <EdSection label={t.profile.location} />
              {p.address ? <Text style={{ fontSize: 14, color: TT.inkSoft, lineHeight: 21 }}>{p.address}</Text> : null}
              {p.mapsUrl ? (
                <Text style={{ fontSize: 13.5, fontWeight: '700', color: TT.accent, marginTop: p.address ? 8 : 0 }}>{t.care.openInMaps}</Text>
              ) : null}
            </EdCard>
          ) : null}

          {p?.feeRange || p?.slidingScale || p?.insurance ? (
            <EdCard style={{ marginBottom: 14 }}>
              <EdSection label={t.profile.fees} />
              {p.feeRange ? (
                <Text style={{ fontSize: 15, fontWeight: '700', color: TT.ink }}>
                  {p.feeRange}
                  <Text style={{ fontSize: 12.5, fontWeight: '400', color: TT.faint }}>{`  ${t.profile.perSession}`}</Text>
                </Text>
              ) : null}
              {p.slidingScale ? (
                <Text style={{ fontSize: 13.5, color: TT.inkSoft, marginTop: p.feeRange ? 6 : 0 }}>{t.profile.slidingScale}</Text>
              ) : null}
              {p.insurance ? <Group label={t.profile.insurance} lines={[p.insurance]} /> : null}
            </EdCard>
          ) : null}

          {contacts.length > 0 && (
            <EdCard style={{ marginBottom: 14 }}>
              <EdSection label={t.profile.contact} />
              {contacts.map((c, i) => (
                <Pressable key={c.label} onPress={() => open(c.url)} style={{ marginTop: i === 0 ? 0 : 10 }}>
                  <Text style={{ fontSize: 14, color: TT.accent, fontWeight: '600' }}>{c.label}</Text>
                </Pressable>
              ))}
            </EdCard>
          )}

          {canBook ? (
            <EdPill
              label={tr.book}
              variant="green"
              onPress={() => router.navigate('/book' as never)}
              style={{ marginTop: 6 }}
            />
          ) : (
            <Text style={{ fontSize: 12.5, color: TT.inkSoft, textAlign: 'center', marginTop: 6, lineHeight: 18 }}>
              {name ? fmt(tr.arranges, { name }) : tr.arrangesGeneric}
            </Text>
          )}
        </FadeIn>
      </ScrollView>
    </View>
  );
}

/**
 * Anything the practitioner may have written as a link, opened safely.
 *
 * A profile is free text: `website` is whatever they typed, which is often
 * "cabinet-grey.fr" with no scheme, and `Linking.openURL` refuses that
 * silently. Assume https when no scheme is given, and never throw at a patient
 * for a link they did not write.
 */
function open(url: string | null | undefined): void {
  if (!url) return;
  const href = /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`;
  void Linking.openURL(href).catch(() => {});
}

/** One vocabulary list, as chips. Renders nothing at all when empty. */
function Chips({ label, items }: { label: string; items: string[] }) {
  const { t: TT } = useTheme();
  if (items.length === 0) return null;
  return (
    <EdCard style={{ marginBottom: 14 }}>
      <EdSection label={label} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
        {items.map((it) => (
          <View key={it} style={{ backgroundColor: TT.bg, borderWidth: 1, borderColor: TT.line, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 }}>
            <Text style={{ fontSize: 12.5, color: TT.ink }}>{it}</Text>
          </View>
        ))}
      </View>
    </EdCard>
  );
}

/** A titled run of lines inside a card, for the credential groups. */
function Group({ label, lines }: { label: string; lines: string[] }) {
  const { t: TT } = useTheme();
  if (lines.length === 0) return null;
  return (
    <View style={{ marginTop: 12 }}>
      <Kicker color={TT.faint} size={9.5} style={{ marginBottom: 5 }}>{label}</Kicker>
      {lines.map((l, i) => (
        <Text key={`${l}-${i}`} style={{ fontSize: 13.5, color: TT.inkSoft, lineHeight: 20 }}>{l}</Text>
      ))}
    </View>
  );
}

function FactCard({ label, value }: { label: string; value: string }) {
  const { t: TT } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: TT.card, borderWidth: 1, borderColor: TT.line, borderRadius: 16, padding: 14, alignItems: 'center' }}>
      <Kicker color={TT.faint} size={9.5}>{label}</Kicker>
      <Text style={{ fontSize: 13.5, color: TT.ink, fontWeight: '600', marginTop: 6, textAlign: 'center' }}>{value}</Text>
    </View>
  );
}
