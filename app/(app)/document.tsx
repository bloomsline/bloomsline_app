// Read a document and sign it, in the app.
//
// The list used to answer a tap on a pending document with "open the link your
// practitioner sent", which sent the patient off to their inbox to do what the
// app was already showing them. This is the web signing page in the app: the
// practitioner's text as written (or the uploaded PDF, opened in the phone's
// viewer), the practitioner's counter-signature if there is one, then the
// name, a signature drawn with a finger, and "I agree". The server records it
// with the same core as the link (care: documents/[id]/sign).
import { useFeatureGuard } from '@/src/care/use-feature-guard';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Check, CircleCheckBig, FileText } from 'lucide-react-native';
import { EdHeader, EdCard, EdPill, FadeIn } from '@/src/ui/editorial';
import { fetchDocument, fetchDocumentUrl, signDocument, type DocumentToSign, type SignatureStrokes } from '@/src/api/care';
import { openPdf } from '@/src/ui/open-pdf';
import { SignaturePad } from '@/src/ui/SignaturePad';
import { PAPER } from '@/src/ui/tokens';
import { LoadFailed } from '@/src/ui/LoadFailed';
import { useConfirm } from '@/src/ui/confirm';
import { useLeaveGuard } from '@/src/ui/leave-guard';
import { useI18n } from '@/src/i18n';
import { useTheme } from '@/src/ui/theme-mode';

const T = {
  en: {
    kicker: 'DOCUMENT', gone: 'This document is no longer available.',
    empty: 'This document has no content.',
    openPdf: 'Read the document', readFirst: 'Open and read the document before you sign it.', openFailed: 'The document could not be opened. Try again in a moment.',
    byPractitioner: 'Signed by your practitioner',
    sign: 'Sign', asGuardian: 'I am signing as a parent or legal guardian',
    guardianNote: 'You are signing as the patient’s parent or legal guardian.',
    fullName: 'Full name', signature: 'Signature', drawHere: 'Sign here with your finger', clear: 'Clear',
    agree: 'I agree to this document.', agreeGuardian: 'I agree to this document on the patient’s behalf.',
    signButton: 'Sign document',
    needName: 'Please enter your full name.', needSignature: 'Please add your signature.', needAgree: 'Please tick “I agree”.',
    offline: 'Could not reach Bloomsline. Check your connection and try again.', failed: 'Could not sign. Please try again.',
    doneTitle: 'Signed, thank you', doneBody: 'A signed copy has been sent to your practitioner.', back: 'Back to documents',
    signedOn: (d: string) => `You signed this on ${d}.`, readSigned: 'Read the signed copy',
    expired: 'This document is no longer open for signing. Ask your practitioner to send it again.',
    leaveTitle: 'Leave without signing?', leaveBody: 'Your signature has not been sent.', leave: 'Leave', stay: 'Stay',
  },
  fr: {
    kicker: 'DOCUMENT', gone: 'Ce document n’est plus disponible.',
    empty: 'Ce document n’a aucun contenu.',
    openPdf: 'Lire le document', readFirst: 'Ouvrez et lisez le document avant de le signer.', openFailed: 'Le document n’a pas pu être ouvert. Réessayez dans un instant.',
    byPractitioner: 'Signé par votre praticien',
    sign: 'Signer', asGuardian: 'Je signe en tant que parent ou représentant légal',
    guardianNote: 'Vous signez en tant que parent ou représentant légal du patient.',
    fullName: 'Nom complet', signature: 'Signature', drawHere: 'Signez ici avec votre doigt', clear: 'Effacer',
    agree: 'J’accepte ce document.', agreeGuardian: 'J’accepte ce document au nom du patient.',
    signButton: 'Signer le document',
    needName: 'Veuillez saisir votre nom complet.', needSignature: 'Veuillez ajouter votre signature.', needAgree: 'Veuillez cocher « J’accepte ».',
    offline: 'Impossible de joindre Bloomsline. Vérifiez votre connexion et réessayez.', failed: 'Impossible de signer. Réessayez.',
    doneTitle: 'Signé, merci', doneBody: 'Une copie signée a été transmise à votre praticien.', back: 'Retour aux documents',
    signedOn: (d: string) => `Vous l’avez signé le ${d}.`, readSigned: 'Lire la copie signée',
    expired: 'Ce document n’est plus ouvert à la signature. Demandez à votre praticien de vous le renvoyer.',
    leaveTitle: 'Partir sans signer ?', leaveBody: 'Votre signature n’a pas été envoyée.', leave: 'Partir', stay: 'Rester',
  },
} as const;

export default function DocumentScreen() {
  useFeatureGuard('documents');
  const { t: TT } = useTheme();
  const router = useRouter();
  const { locale } = useI18n();
  const tr = T[locale] ?? T.en;
  const confirm = useConfirm();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [doc, setDoc] = useState<DocumentToSign | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'gone' | 'failed'>('loading');
  const [name, setName] = useState('');
  const [guardian, setGuardian] = useState(false);
  const [signature, setSignature] = useState<SignatureStrokes | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [openedPdf, setOpenedPdf] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [done, setDone] = useState(false);
  const [opening, setOpening] = useState(false);

  useEffect(() => { setDoc(null); setState('loading'); setDone(false); setSignature(null); setAgreed(false); setOpenedPdf(false); setErr(''); }, [id]);

  const load = useCallback(async (alive: () => boolean = () => true) => {
    const v = await fetchDocument(String(id));
    if (!alive()) return;
    if (v === 'gone') { setState('gone'); return; }
    if (!v) { setState((s) => (s === 'ready' ? s : 'failed')); return; }
    setDoc(v);
    setName((n) => n || v.defaultName);
    setState('ready');
  }, [id]);

  useFocusEffect(useCallback(() => {
    let alive = true;
    if (!done) void load(() => alive);
    return () => { alive = false; };
  }, [load, done]));

  const signable = !!doc && !doc.signed && !doc.expired && !done;
  const guard = useLeaveGuard(signable && !!signature, async (leave) => {
    if (await confirm({ title: tr.leaveTitle, message: tr.leaveBody, confirmLabel: tr.leave, cancelLabel: tr.stay, destructive: true })) leave();
  });
  const back = () => (router.canGoBack() ? router.back() : router.replace('/documents' as never));

  const readPdf = async (url: string | null) => {
    if (!url) { setErr(tr.openFailed); return; }
    await openPdf(url);
    setOpenedPdf(true);
  };

  const readSigned = async () => {
    if (!doc || opening) return;
    setOpening(true);
    const url = await fetchDocumentUrl(doc.id).finally(() => setOpening(false));
    if (url) await openPdf(url); else setErr(tr.openFailed);
  };

  const submit = async () => {
    if (!doc || busyRef.current) return;
    if (doc.pdfUrl && !openedPdf) { setErr(tr.readFirst); return; }
    if (name.trim().length < 2) { setErr(tr.needName); return; }
    if (!signature) { setErr(tr.needSignature); return; }
    if (!agreed) { setErr(tr.needAgree); return; }
    busyRef.current = true;
    setBusy(true); setErr('');
    const res = await signDocument(doc.id, { signerName: name.trim(), capacity: doc.guardianSigns || guardian ? 'guardian' : 'self', signature });
    busyRef.current = false;
    setBusy(false);
    if (res.ok) { guard.release(); setDone(true); return; }
    // Already signed (on the web, or another phone) or past its window: show the document as it now is.
    if (res.reason === 'signed' || res.reason === 'expired') void load();
    if (res.reason === 'gone') { setState('gone'); return; }
    setErr(res.reason === 'offline' ? tr.offline : res.error ?? tr.failed);
  };

  const asGuardian = !!doc && (doc.guardianSigns || guardian);
  const loc = locale === 'fr' ? 'fr-FR' : 'en-GB';

  if (done) {
    return (
      <View style={{ flex: 1, backgroundColor: TT.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: TT.accentTint, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <CircleCheckBig size={34} color={TT.accent} strokeWidth={2} />
        </View>
        <Text style={{ fontSize: 22, fontWeight: '800', color: TT.ink, textAlign: 'center' }}>{tr.doneTitle}</Text>
        <Text style={{ fontSize: 14, color: TT.inkSoft, textAlign: 'center', marginTop: 6, lineHeight: 20 }}>{tr.doneBody}</Text>
        <EdPill label={tr.back} onPress={back} style={{ marginTop: 28, alignSelf: 'stretch' }} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: TT.bg }}>
      <ScrollView scrollEnabled={!drawing} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <EdHeader kicker={tr.kicker} title={doc?.title ?? ''} onBack={back} />
        <FadeIn style={{ paddingHorizontal: 22, paddingTop: 18 }}>
          {state === 'loading' && <ActivityIndicator color={TT.accent} />}
          {state === 'gone' && <Text style={{ fontSize: 14, color: TT.inkSoft }}>{tr.gone}</Text>}
          {state === 'failed' && <LoadFailed onRetry={() => load()} />}

          {state === 'ready' && doc && (
            <>
              {/* The document */}
              <EdCard style={{ marginBottom: 16 }}>
                {doc.pdfUrl ? (
                  <Pressable onPress={() => { void readPdf(doc.pdfUrl); }} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: TT.accentTint, alignItems: 'center', justifyContent: 'center' }}>
                      <FileText size={19} color={TT.accent} strokeWidth={2} />
                    </View>
                    <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: TT.ink }}>{tr.openPdf}</Text>
                    {openedPdf && <Check size={16} color={TT.accent} strokeWidth={3} />}
                  </Pressable>
                ) : (doc.blocks ?? []).length === 0 ? (
                  <Text style={{ fontSize: 14, color: TT.faint, textAlign: 'center', paddingVertical: 12 }}>{tr.empty}</Text>
                ) : (
                  <View style={{ gap: 10 }}>
                    {(doc.blocks ?? []).map((b, i) => <DocBlock key={b.id ?? i} block={b} />)}
                  </View>
                )}
              </EdCard>

              {doc.practitionerSignatureUrl && (
                <EdCard style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 11.5, fontWeight: '700', letterSpacing: 0.4, color: TT.faint, textTransform: 'uppercase' }}>{tr.byPractitioner}</Text>
                  {doc.practitionerName && <Text style={{ fontSize: 14, color: TT.ink, marginTop: 4 }}>{doc.practitionerName}</Text>}
                  <View style={{ marginTop: 8, alignSelf: 'flex-start', backgroundColor: PAPER.ground, borderRadius: 8, padding: 6 }}>
                    <Image source={{ uri: doc.practitionerSignatureUrl }} style={{ width: 200, height: 64 }} resizeMode="contain" accessibilityLabel={doc.practitionerName ?? tr.byPractitioner} />
                  </View>
                </EdCard>
              )}

              {doc.signed ? (
                <EdCard>
                  <Text style={{ fontSize: 14, color: TT.ink }}>{tr.signedOn(doc.signedAt ? new Date(doc.signedAt).toLocaleDateString(loc, { day: 'numeric', month: 'long', year: 'numeric' }) : '')}</Text>
                  <EdPill label={opening ? '…' : tr.readSigned} variant="outline" onPress={() => { void readSigned(); }} style={{ marginTop: 14 }} />
                </EdCard>
              ) : doc.expired ? (
                <EdCard><Text style={{ fontSize: 14, lineHeight: 20, color: TT.inkSoft }}>{tr.expired}</Text></EdCard>
              ) : (
                <EdCard>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: TT.ink, marginBottom: 10 }}>{tr.sign}</Text>
                  {doc.guardianSigns ? (
                    <Text style={{ fontSize: 13, color: TT.inkSoft, marginBottom: 10 }}>{tr.guardianNote}</Text>
                  ) : doc.allowGuardian ? (
                    <Tick on={guardian} onPress={() => setGuardian((g) => !g)} label={tr.asGuardian} />
                  ) : null}

                  <Text style={{ fontSize: 12, fontWeight: '600', color: TT.faint, marginTop: 6, marginBottom: 6 }}>{tr.fullName}</Text>
                  <TextInput
                    value={name}
                    onChangeText={(v) => { setName(v.slice(0, 200)); setErr(''); }}
                    autoComplete="name"
                    textContentType="name"
                    editable={!busy}
                    style={{ height: 46, borderWidth: 1, borderColor: TT.line, borderRadius: 12, paddingHorizontal: 12, fontSize: 15, color: TT.ink, backgroundColor: TT.bg }}
                  />

                  <Text style={{ fontSize: 12, fontWeight: '600', color: TT.faint, marginTop: 14, marginBottom: 6 }}>{tr.signature}</Text>
                  <SignaturePad value={signature} onChange={(v) => { setSignature(v); setErr(''); }} onDrawing={setDrawing} clearLabel={tr.clear} hint={tr.drawHere} />

                  <View style={{ marginTop: 6 }}>
                    <Tick on={agreed} onPress={() => { setAgreed((a) => !a); setErr(''); }} label={asGuardian ? tr.agreeGuardian : tr.agree} />
                  </View>

                  {err ? <Text accessibilityLiveRegion="polite" style={{ fontSize: 13, color: TT.danger, marginTop: 8 }}>{err}</Text> : null}
                  <EdPill label={busy ? '…' : tr.signButton} variant="green" disabled={busy} onPress={() => { void submit(); }} style={{ marginTop: 14 }} />
                </EdCard>
              )}
              {err && !signable ? <Text style={{ fontSize: 13, color: TT.danger, marginTop: 10 }}>{err}</Text> : null}
            </>
          )}
        </FadeIn>
      </ScrollView>
    </View>
  );
}

function DocBlock({ block: b }: { block: NonNullable<DocumentToSign['blocks']>[number] }) {
  const { t: TT } = useTheme();
  if (b.type === 'divider') return <View style={{ height: 1, backgroundColor: TT.line, marginVertical: 4 }} />;
  if (b.type === 'heading') return <Text style={{ fontSize: 16, fontWeight: '700', color: TT.ink }}>{b.text}</Text>;
  if (b.type === 'list') {
    return (
      <View style={{ gap: 4 }}>
        {(b.items ?? []).map((it, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
            <Text style={{ fontSize: 14.5, color: TT.inkSoft }}>•</Text>
            <Text style={{ flex: 1, fontSize: 14.5, lineHeight: 21, color: TT.ink }}>{it}</Text>
          </View>
        ))}
      </View>
    );
  }
  return <Text style={{ fontSize: 14.5, lineHeight: 21, color: TT.ink }}>{b.text}</Text>;
}

function Tick({ on, onPress, label }: { on: boolean; onPress: () => void; label: string }) {
  const { t: TT } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8 }}>
      <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: on ? TT.accent : TT.line, backgroundColor: on ? TT.accent : 'transparent', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
        {on && <Check size={14} color={TT.onAccent} strokeWidth={3} />}
      </View>
      <Text style={{ flex: 1, fontSize: 14, lineHeight: 20, color: TT.ink }}>{label}</Text>
    </Pressable>
  );
}
