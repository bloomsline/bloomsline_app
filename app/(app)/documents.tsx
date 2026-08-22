// Documents & forms — the patient's documents with sign status. Wired to GET
// /api/mobile/care/documents. Read-only list; signing still happens on the web
// token link for now, so tapping a pending doc explains that.
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { FileText, Check } from 'lucide-react-native';
import { EdHeader, EdCard, FadeIn } from '@/src/ui/editorial';
import { ONBOARDING_IMAGES } from '@/src/onboarding/editorial/images';
import { fetchDocuments, type CareDocument } from '@/src/api/care';
import { useI18n, fmt } from '@/src/i18n';
import { useTheme } from '@/src/ui/theme-mode';

const T = {
  en: {
    title: 'Documents & forms',
    emptyTitle: 'No documents yet',
    emptyBody: 'Forms your practitioner sends will appear here.',
    signAlert: 'Open this document from the link your practitioner sent to sign it.',
    signedOn: 'Signed {date}',
    awaiting: 'Awaiting your signature',
    signed: 'Signed',
    pending: 'Pending',
  },
  fr: {
    title: 'Documents et formulaires',
    emptyTitle: 'Aucun document pour le moment',
    emptyBody: 'Les formulaires envoyés par votre praticien apparaîtront ici.',
    signAlert: 'Ouvrez ce document depuis le lien que votre praticien vous a envoyé pour le signer.',
    signedOn: 'Signé le {date}',
    awaiting: 'En attente de votre signature',
    signed: 'Signé',
    pending: 'En attente',
  },
} as const;

export default function Documents() {
  const { t: TT } = useTheme();
  const router = useRouter();
  const { locale } = useI18n();
  const tr = T[locale];
  const [items, setItems] = useState<CareDocument[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetchDocuments().then((d) => { if (alive) setItems(d ?? []); });
    return () => { alive = false; };
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: TT.bg }}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <EdHeader kicker="DOCUMENTS" title={tr.title} onBack={() => router.back()} />
        <FadeIn style={{ paddingHorizontal: 22, paddingTop: 20 }}>
          {items === null ? (
            <View style={{ paddingTop: 40, alignItems: 'center' }}><ActivityIndicator color={TT.accent} /></View>
          ) : items.length === 0 ? (
            <EdCard style={{ alignItems: 'center', padding: 24 }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: TT.accentTint, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <FileText size={22} color={TT.accent} strokeWidth={2} />
              </View>
              <Text style={{ fontSize: 16, fontWeight: '700', color: TT.ink }}>{tr.emptyTitle}</Text>
              <Text style={{ fontSize: 13, color: TT.inkSoft, marginTop: 6, textAlign: 'center', lineHeight: 19 }}>{tr.emptyBody}</Text>
            </EdCard>
          ) : (
            <View style={{ gap: 10 }}>
              {items.map((d) => (
                <TouchableOpacity
                  key={d.id}
                  activeOpacity={0.8}
                  onPress={() => !d.signed && Platform.OS === 'web' && globalThis.alert?.(tr.signAlert)}
                  style={{ backgroundColor: TT.card, borderWidth: 1, borderColor: TT.line, borderRadius: 18, padding: 15, paddingRight: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}
                >
                  <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: TT.accentTint, alignItems: 'center', justifyContent: 'center' }}>
                    <FileText size={19} color={d.signed ? TT.accent : TT.faint} strokeWidth={2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14.5, fontWeight: '700', color: TT.ink }}>{d.title}</Text>
                    <Text style={{ fontSize: 12, color: TT.inkSoft, marginTop: 1 }}>{d.signed && d.signedAt ? fmt(tr.signedOn, { date: shortDate(d.signedAt, locale) }) : tr.awaiting}</Text>
                  </View>
                  {d.signed ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: TT.accentTint, borderRadius: 11, paddingVertical: 4, paddingHorizontal: 9 }}>
                      <Check size={12} color={TT.accent} strokeWidth={3} />
                      <Text style={{ fontSize: 11.5, fontWeight: '700', color: TT.accent }}>{tr.signed}</Text>
                    </View>
                  ) : (
                    <View style={{ borderWidth: 1, borderColor: TT.line, borderRadius: 11, paddingVertical: 4, paddingHorizontal: 9 }}>
                      <Text style={{ fontSize: 11.5, fontWeight: '700', color: TT.inkSoft }}>{tr.pending}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </FadeIn>
      </ScrollView>
    </View>
  );
}

const shortDate = (iso: string, locale?: string) => new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
