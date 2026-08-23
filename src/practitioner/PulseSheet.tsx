import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { RefreshCw, Sparkles, X } from 'lucide-react-native';
import { useI18n } from '@/src/i18n';
import { fetchPulse, generatePulse, type Pulse } from '@/src/api/practitioner';
import { useTheme } from '@/src/ui/theme-mode';
import { LIGHT, DARK, type Mode } from '@/src/ui/tokens';

// The session brief, on the phone.
//
// Bloom Pulse's own prompt describes the moment it is for — "a feel for one of
// their patients in the few seconds before a session" — and until now it lived
// only on the member page and the dashboard, both of which are a laptop. The
// few seconds before a session are the ones where you are holding a phone.
//
// READ-ONLY except for regenerate. The consent toggle is deliberately not here:
// turning on AI egress for a patient's record is a decision to make at a desk,
// having read what it means, not by tapping through on the way into a room.
const T = {
  en: {
    kicker: 'SESSION BRIEF', close: 'Close',
    none: 'No brief yet for this patient.', generate: 'Generate a brief',
    regenerate: 'Refresh', generating: 'Reading their history…',
    consentOff: 'Bloom Pulse is off. Turn it on in the care app to use briefs — it sends patient material to an AI model, so it is opt-in.',
    stale: '{n} new since this was written.', signals: 'RIGHT NOW', next: 'FOR NEXT TIME', themes: 'THEMES',
    from: 'From {notes} notes and {sessions} sessions.',
    failed: 'Could not build a brief just now.',
  },
  fr: {
    kicker: 'BRIEF DE SÉANCE', close: 'Fermer',
    none: 'Aucun brief pour ce patient.', generate: 'Générer un brief',
    regenerate: 'Actualiser', generating: 'Lecture de son historique…',
    consentOff: 'Bloom Pulse est désactivé. Activez-le dans l’app pour utiliser les briefs : il transmet des données patient à un modèle IA, donc c’est sur option.',
    stale: '{n} nouveautés depuis sa rédaction.', signals: 'EN CE MOMENT', next: 'POUR LA PROCHAINE FOIS', themes: 'THÈMES',
    from: 'À partir de {notes} notes et {sessions} séances.',
    failed: 'Impossible de générer un brief pour le moment.',
  },
} as const;

const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');

// Signal tone. An amber signal is something to hold in mind walking in, not an
// alarm — the wording does that work, the colour just groups them.
// Signal chips, per theme.
//
// Record<Mode, ...> rather than a function of the palette: these are MODULE
// level, so a hook cannot reach them, and keeping them static preserves the
// Record<string, ...> annotation that string indexing depends on. (The function
// form was tried and reverted — it dropped the annotation and broke `KIND[k]`.)
//
// The dark values are not the light ones dimmed. A pale chip on a dark card
// reads as a sticker; the tint becomes a low-alpha wash of the hue it means and
// the text lightens to sit on it, the same rule TILES follows in tokens.ts.
const KIND: Record<Mode, Record<string, { bg: string; fg: string }>> = {
  light: {
    concern: { bg: '#FEF3C7', fg: '#B45309' },
    risk: { bg: '#FFE4E6', fg: '#BE123C' },
    positive: { bg: LIGHT.accentTint, fg: LIGHT.accentDeep },
  },
  dark: {
    concern: { bg: 'rgba(233,196,106,0.16)', fg: '#E9C46A' },
    risk: { bg: 'rgba(244,63,94,0.18)', fg: '#FDA4AF' },
    positive: { bg: DARK.accentTint, fg: DARK.accent },
  },
};

export function PulseSheet({ memberId, who, onClose }: { memberId: string | null; who: string; onClose: () => void }) {
  const { t: TT, mode } = useTheme();
  const { locale } = useI18n();
  const tr = T[locale] ?? T.en;

  const [pulse, setPulse] = useState<Pulse | null>(null);
  const [consented, setConsented] = useState(true);
  const [fresh, setFresh] = useState<{ newNotes: number; newSessions: number } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    if (!memberId) return;
    let alive = true;
    setLoaded(false);
    void fetchPulse(memberId).then((v) => {
      if (!alive) return;
      setPulse(v?.pulse ?? null);
      setConsented(v?.consented ?? false);
      setFresh(v?.freshness ? { newNotes: v.freshness.newNotes, newSessions: v.freshness.newSessions } : null);
      setLoaded(true);
    });
    return () => { alive = false; };
  }, [memberId]);

  useEffect(load, [load]);

  const build = async () => {
    if (!memberId || busy) return;
    setBusy(true); setError('');
    const res = await generatePulse(memberId);
    setBusy(false);
    if (!res.ok) {
      // consent_required is the one worth naming: it is fixable, elsewhere.
      setError(res.error === 'consent_required' ? tr.consentOff : tr.failed);
      if (res.error === 'consent_required') setConsented(false);
      return;
    }
    setPulse(res.pulse ?? null);
    setFresh(null);
  };

  if (!memberId) return null;
  const staleCount = (fresh?.newNotes ?? 0) + (fresh?.newSessions ?? 0);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20,20,18,0.45)' }} onPress={onClose}>
        <Pressable onPress={() => {}} style={{ maxHeight: '88%', borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: TT.sheet }}>
          <View style={{ alignItems: 'center', paddingTop: 10 }}>
            <View style={{ height: 4, width: 40, borderRadius: 2, backgroundColor: TT.line }} />
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 16, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 11 }}>
              <View style={{ height: 34, width: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: TT.accentTint }}>
                <Sparkles size={16} color={TT.accentDeep} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10.5, fontWeight: '800', letterSpacing: 1, color: TT.faint }}>{tr.kicker}</Text>
                <Text style={{ fontSize: 17.5, fontWeight: '800', color: TT.ink, marginTop: 2 }}>{who}</Text>
              </View>
              <Pressable onPress={onClose} hitSlop={8} style={{ height: 30, width: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: TT.bg }}>
                <X size={16} color={TT.inkSoft} />
              </Pressable>
            </View>

            {!loaded && <ActivityIndicator style={{ marginTop: 22 }} />}

            {loaded && !consented && (
              <Text style={{ fontSize: 14, lineHeight: 21, color: TT.inkSoft, marginTop: 18 }}>{tr.consentOff}</Text>
            )}

            {loaded && consented && !pulse && !busy && (
              <View style={{ marginTop: 18 }}>
                <Text style={{ fontSize: 14, color: TT.inkSoft }}>{tr.none}</Text>
                <Pressable onPress={build} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, borderRadius: 24, backgroundColor: TT.accent, paddingVertical: 13 }}>
                  <Sparkles size={16} color="#fff" />
                  <Text style={{ fontSize: 14.5, fontWeight: '800', color: '#fff' }}>{tr.generate}</Text>
                </Pressable>
              </View>
            )}

            {busy && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20 }}>
                <ActivityIndicator />
                <Text style={{ fontSize: 14, color: TT.inkSoft }}>{tr.generating}</Text>
              </View>
            )}

            {pulse && !busy && (
              <>
                <Text style={{ fontSize: 15.5, lineHeight: 23, color: TT.ink, marginTop: 18 }}>{pulse.content.pulseLine}</Text>

                {staleCount > 0 && (
                  <Text style={{ fontSize: 12.5, color: '#B45309', marginTop: 10 }}>{fill(tr.stale, { n: String(staleCount) })}</Text>
                )}

                {pulse.content.signals?.length > 0 && (
                  <View style={{ marginTop: 20 }}>
                    <Text style={{ fontSize: 10.5, fontWeight: '800', letterSpacing: 1, color: TT.faint, marginBottom: 9 }}>{tr.signals}</Text>
                    {pulse.content.signals.map((sig, i) => {
                      const c = KIND[mode][sig.kind] ?? { bg: TT.bg, fg: TT.inkSoft };
                      return (
                        <View key={i} style={{ flexDirection: 'row', gap: 9, alignItems: 'flex-start', marginBottom: 7 }}>
                          <View style={{ height: 7, width: 7, borderRadius: 4, backgroundColor: c.fg, marginTop: 6 }} />
                          <Text style={{ flex: 1, fontSize: 14.5, lineHeight: 21, color: TT.ink }}>{sig.text}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}

                {pulse.content.nextSteps?.length > 0 && (
                  <View style={{ marginTop: 20 }}>
                    <Text style={{ fontSize: 10.5, fontWeight: '800', letterSpacing: 1, color: TT.faint, marginBottom: 9 }}>{tr.next}</Text>
                    {pulse.content.nextSteps.map((n, i) => (
                      <View key={i} style={{ borderRadius: 14, backgroundColor: TT.accentTint, padding: 12, marginBottom: 7 }}>
                        <Text style={{ fontSize: 14.5, lineHeight: 21, color: TT.accentDeep }}>{n}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {pulse.content.themes?.length > 0 && (
                  <View style={{ marginTop: 20 }}>
                    <Text style={{ fontSize: 10.5, fontWeight: '800', letterSpacing: 1, color: TT.faint, marginBottom: 9 }}>{tr.themes}</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                      {pulse.content.themes.map((t, i) => (
                        <View key={i} style={{ borderRadius: 12, backgroundColor: TT.bg, paddingHorizontal: 10, paddingVertical: 5 }}>
                          <Text style={{ fontSize: 12.5, fontWeight: '600', color: TT.inkSoft }}>{t.label}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Provenance. A brief that will not say what it read is asking
                    to be trusted on nothing. */}
                <Text style={{ fontSize: 12, color: TT.faint, marginTop: 20, lineHeight: 18 }}>
                  {fill(tr.from, { notes: String(pulse.noteCount), sessions: String(pulse.sessionCount) })}
                </Text>

                <Pressable onPress={build} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, borderRadius: 22, borderWidth: 1, borderColor: TT.line, paddingVertical: 12 }}>
                  <RefreshCw size={15} color={TT.inkSoft} />
                  <Text style={{ fontSize: 13.5, fontWeight: '700', color: TT.inkSoft }}>{tr.regenerate}</Text>
                </Pressable>
              </>
            )}

            {error ? <Text style={{ fontSize: 13.5, lineHeight: 20, color: '#C0392B', marginTop: 14 }}>{error}</Text> : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
