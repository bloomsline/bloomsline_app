// Documents & forms — the patient's documents with sign status. Wired to GET
// /api/mobile/care/documents. Signing still happens on the web token link, so
// tapping a PENDING doc explains that; tapping a SIGNED one opens it to read.
//
// Reading one back used to be impossible. The row said "Signed 27 September"
// and did nothing when pressed, so a patient could see that they had consented
// to something and had no way to find out what. The signed PDF had existed in
// storage since the day signing shipped.
import { useFeatureGuard } from '@/src/care/use-feature-guard';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { FileText, Check } from 'lucide-react-native';
import { notify } from '@/src/ui/alert';
import { EdHeader, EdCard, FadeIn } from '@/src/ui/editorial';
import { ONBOARDING_IMAGES } from '@/src/onboarding/editorial/images';
import { fetchDocuments, fetchDocumentUrl, type CareDocument } from '@/src/api/care';
import { openPdf } from '@/src/ui/open-pdf';
import { useSelectionReset } from '@/src/care/selected-practitioner';
import { useI18n, fmt } from '@/src/i18n';
import { useTheme } from '@/src/ui/theme-mode';
import { LoadFailed } from '@/src/ui/LoadFailed';

const T = {
  en: {
    title: 'Documents & forms',
    emptyTitle: 'No documents yet',
    emptyBody: 'Forms your practitioner sends will appear here.',
    signAlert: 'Open this document from the link your practitioner sent to sign it.',
    openFailed: 'That document could not be opened. Try again in a moment.',
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
    openFailed: 'Ce document n’a pas pu être ouvert. Réessayez dans un instant.',
    signedOn: 'Signé le {date}',
    awaiting: 'En attente de votre signature',
    signed: 'Signé',
    pending: 'En attente',
  },
} as const;

export default function Documents() {
  useFeatureGuard('documents');
  const { t: TT } = useTheme();
  const router = useRouter();
  const { locale } = useI18n();
  const tr = T[locale];
  const [items, setItems] = useState<CareDocument[] | null>(null);
  const [failed, setFailed] = useState(false);
  // Which row is fetching its link. A presigned url is a round trip, and on a
  // slow connection a tap that does nothing for two seconds reads as a tap that
  // did not register — which is the bug being fixed, arriving by a new route.
  const [opening, setOpening] = useState<string | null>(null);
  const selectionKey = useSelectionReset(() => { setItems(null); setFailed(false); });
  // Read on every visit, not once: a document signed on the web
  // while this screen sat in the stack still showed as awaiting a signature.
  const reload = useCallback(() => {
    let alive = true;
    // A failed read is not an empty one (see LoadFailed).
    fetchDocuments().then((v) => { if (!alive) return; if (v) { setItems(v); setFailed(false); } else setFailed(true); });
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- selectionKey: load again for the practitioner just chosen
  }, [selectionKey]);
  useFocusEffect(reload);

  return (
    <View style={{ flex: 1, backgroundColor: TT.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <EdHeader kicker="Documents" title={tr.title} onBack={() => (router.canGoBack() ? router.back() : router.replace('/home' as never))} />
        <FadeIn style={{ paddingHorizontal: 22, paddingTop: 20 }}>
          {items === null ? (
            failed ? <LoadFailed onRetry={() => { setFailed(false); reload(); }} />
            : <View style={{ paddingTop: 40, alignItems: 'center' }}><ActivityIndicator color={TT.accent} /></View>
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
                  // No "declined" state: nothing on the server can set one, so the
                  // label for it was removed on both sides.
                  disabled={opening !== null}
                  onPress={() => {
                    if (!d.signed) { notify(tr.signAlert); return; }
                    if (opening) return;
                    setOpening(d.id);
                    void fetchDocumentUrl(d.id)
                      .then((url) => { if (url) return openPdf(url); notify(tr.openFailed); })
                      .finally(() => setOpening(null));
                  }}
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
                      {opening === d.id
                        ? <ActivityIndicator size="small" color={TT.accent} />
                        : <Check size={12} color={TT.accent} strokeWidth={3} />}
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
