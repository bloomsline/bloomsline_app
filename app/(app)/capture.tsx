// Capture — v2. Three steps in one screen, matching the design board.
//
// The v1 flow asked for a FEELING first and only then let you write. That put a
// taxonomy in front of the thing a person actually came to do, so v2 inverts it:
//
//   1. write   the words open the screen, one plain question, keyboard already
//              up. Photo / video / voice sit under a rule at the foot, and the
//              feeling is a required ROW rather than a screen of its own.
//   2. feel    a sheet rises over the writing, which dims but stays visible, so
//              the question is asked about something you can still see. Choosing
//              "was this more…" GROWS the sheet rather than replacing it, so
//              changing your mind costs nothing.
//   3. preview the moment drawn the way it will look on the line, not a summary
//              of the form. Sharing sits above the buttons, naming the
//              practitioner rather than the word "private" — the question a
//              person has here is who sees this.
//
// "Good / Hard / Mixed" is NOT stored. It filters which feelings are offered,
// and the timeline's valence is derived from the feelings actually picked (see
// MOOD_SCORES). That is why this needed no migration.
import { useEffect, useRef, useState } from 'react';
import { useAudioRecorder, useAudioRecorderState, requestRecordingPermissionsAsync, RecordingPresets } from 'expo-audio';
import { ActivityIndicator, Animated, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { X, ChevronLeft, ImagePlus, Mic, Lock, Eye, Camera, Video, Images, Square, Circle } from 'lucide-react-native';
import { EDD } from '@/src/ui/editorial';
import { MOODS, moodLabel } from '@/src/moments/moods';
import { createMoment, shareMoment } from '@/src/api/moments';
import { pickMedia, captureMedia, cameraAvailable, uploadMedia, type PreparedMedia } from '@/src/moments/media-upload';
import { useOnboarding } from '@/src/onboarding/context';
import { useI18n, fmt } from '@/src/i18n';
import { notify } from '@/src/ui/alert';
import { useTheme } from '@/src/ui/theme-mode';

const MAX_MOODS = 3; // the board asks for "up to 3 feelings"

// The valence divider the v1 picker already used: the gap between the heavier
// and lighter clusters is wide (42 vs 72), so 55 sits cleanly between them.
const LIGHTER_MIN = 55;
const isLighter = (key: string) => (MOODS.find((m) => m.key === key)?.valence ?? 0) >= LIGHTER_MIN;

type Tone = 'good' | 'hard' | 'mixed';
type Step = 'write' | 'feel' | 'preview';

const moodsForTone = (tone: Tone) =>
  tone === 'mixed' ? MOODS : MOODS.filter((m) => isLighter(m.key) === (tone === 'good'));

export default function Capture() {
  const { t: TT } = useTheme();
  const router = useRouter();
  const { t, locale } = useI18n();
  const tr = t.capture;
  const { practitionerName, hasPractitioner } = useOnboarding();
  const pracFirst = (practitionerName ?? '').replace(/^dr\.?\s*/i, '').trim().split(/\s+/)[0] || '';

  // A pre-selected feeling from the Moments empty-state shortcut still works: it
  // opens the sheet on the matching tone with that feeling already chosen.
  const { emotion } = useLocalSearchParams<{ emotion?: string }>();
  const initial = typeof emotion === 'string' && MOODS.some((m) => m.key === emotion) ? emotion : null;

  const [step, setStep] = useState<Step>('write');
  const [note, setNote] = useState('');
  const [media, setMedia] = useState<PreparedMedia | null>(null);
  const [tone, setTone] = useState<Tone | null>(initial ? (isLighter(initial) ? 'good' : 'hard') : null);
  const [moods, setMoods] = useState<string[]>(initial ? [initial] : []);
  const [share, setShare] = useState(false);
  const [busy, setBusy] = useState(false);
  // Which picker sheet is open, if any. One control per KIND of thing a patient
  // is choosing — "a moment to keep", not a file format.
  const [picker, setPicker] = useState<null | 'visual' | 'voice'>(null);
  // Recoverable problems (no mic, a file that would not load) are shown INLINE,
  // not through notify(): on web that is a blocking window.alert, which for
  // something the patient can simply try again is far too heavy a hand. The
  // screen this replaces did the same.
  const [error, setError] = useState<string | null>(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder);
  const recording = recState.isRecording;

  const capturedAt = useRef(new Date()).current;
  const when = `${capturedAt.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'long' })}, ${capturedAt.toLocaleTimeString(locale === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}`;

  const hasSomething = (note.trim().length > 0 || media !== null) && !recording;
  const photoUri = media?.kind === 'image' ? media.uri : media?.kind === 'video' ? media.thumbUri ?? null : null;

  const toggleMood = (key: string) =>
    setMoods((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : cur.length >= MAX_MOODS ? cur : [...cur, key]));

  const take = async (fn: () => Promise<PreparedMedia | null>) => {
    setPicker(null);
    setError(null);
    try {
      const picked = await fn();
      if (picked) setMedia(picked);
    } catch {
      setError(tr.errAddMedia);
    }
  };

  const startRec = async () => {
    setPicker(null);
    setError(null);
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) { setError(tr.errMicNeeded); return; }
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch {
      setError(tr.errStartRec);
    }
  };

  const stopRec = async () => {
    try {
      const seconds = Math.round((recState.durationMillis ?? 0) / 1000);
      await recorder.stop();
      const uri = recorder.uri;
      if (uri) {
        const size = (await (await fetch(uri)).blob()).size;
        setMedia({ kind: 'audio', uri, mime: Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4', size, durationSeconds: seconds });
      }
    } catch {
      setError(tr.errSaveRec);
    }
  };

  const commit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const uploaded = media ? [await uploadMedia(media)] : [];
      const created = await createMoment({
        textContent: note.trim() || null,
        moods,
        capturedAt: capturedAt.toISOString(),
        media: uploaded,
      });
      // Sharing is a second call on purpose: the moment exists either way, so a
      // failure here costs the share, never the moment.
      if (share) {
        try {
          await shareMoment(created.id, true);
        } catch {
          notify(tr.newMoment, tr.errShare);
        }
      }
      router.replace('/moments' as never);
    } catch {
      notify(tr.newMoment, tr.errSave);
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: TT.bg }}>
      <StatusBar style="light" />

      {/* The photograph, when there is one, is the ground for every step — it is
          the moment, not an attachment to it. */}
      {photoUri ? (
        <>
          <Image source={{ uri: photoUri }} style={{ position: 'absolute', inset: 0 }} resizeMode="cover" />
          <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(14,21,18,0.55)' }} />
        </>
      ) : null}

      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
        <Header
          step={step}
          tr={tr}
          onClose={() => router.back()}
          onBack={() => setStep(step === 'preview' ? 'feel' : 'write')}
        />

        {step === 'preview' ? (
          <Preview
            when={when}
            note={note}
            moods={moods}
            locale={locale}
            tr={tr}
            share={share}
            canShare={hasPractitioner && !!pracFirst}
            pracFirst={pracFirst}
            busy={busy}
            onToggleShare={() => setShare((v) => !v)}
            onEdit={() => setStep('write')}
            onCommit={commit}
          />
        ) : (
          <>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
              <ScrollView contentContainerStyle={{ paddingHorizontal: 26, paddingTop: 6, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
                <Text style={{ fontSize: 12.5, color: TT.faint, marginBottom: 12 }}>{when}</Text>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder={tr.what}
                  placeholderTextColor="rgba(255,255,255,0.42)"
                  multiline
                  autoFocus={step === 'write'}
                  editable={step === 'write'}
                  selectionColor={TT.accent}
                  style={[
                    { fontSize: 21, fontWeight: '600', color: TT.ink, lineHeight: 29, minHeight: 90, textAlignVertical: 'top' },
                    Platform.OS === 'web' ? ({ outlineStyle: 'none' } as never) : null,
                  ]}
                />
              </ScrollView>

              {step === 'write' ? (
                <View style={{ paddingHorizontal: 26, paddingBottom: 8 }}>
                  {error ? (
                    <Text style={{ fontSize: 12.5, color: '#E5837B', marginBottom: 12, lineHeight: 18 }}>{error}</Text>
                  ) : null}
                  {recording ? (
                    <RecordingBar seconds={Math.round((recState.durationMillis ?? 0) / 1000)} onStop={stopRec} tr={tr} />
                  ) : media ? (
                    <MediaBadge media={media} onClear={() => setMedia(null)} tr={tr} />
                  ) : null}
                  <View style={{ height: 1, backgroundColor: TT.cardLine, marginBottom: 14 }} />
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <Chip Icon={ImagePlus} label={tr.photoOrVideo} onPress={() => setPicker('visual')} />
                    <Chip Icon={Mic} label={tr.voice} onPress={() => setPicker('voice')} />
                  </View>

                  {/* The feeling is a row that says it is required, not a screen
                      you have to get past before you can write anything. */}
                  <Pressable
                    onPress={() => hasSomething && setStep('feel')}
                    style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', paddingVertical: 14, opacity: hasSomething ? 1 : 0.45 }}
                  >
                    <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: TT.ink }}>{tr.addFeeling}</Text>
                    <Text style={{ fontSize: 10.5, letterSpacing: 1, color: TT.faint }}>{tr.required.toUpperCase()}</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => hasSomething && setStep('feel')}
                    disabled={!hasSomething}
                    style={{ height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: hasSomething ? '#fff' : 'rgba(255,255,255,0.12)' }}
                  >
                    <Text style={{ fontSize: 15, fontWeight: '700', color: hasSomething ? '#141414' : 'rgba(255,255,255,0.4)' }}>{tr.next}</Text>
                  </Pressable>
                </View>
              ) : null}
            </KeyboardAvoidingView>

            {picker ? (
              <PickerSheet
                which={picker}
                tr={tr}
                onClose={() => setPicker(null)}
                onPhoto={() => take(() => captureMedia('photo'))}
                onVideo={() => take(() => captureMedia('video'))}
                onLibrary={() => take(pickMedia)}
                onRecord={startRec}
              />
            ) : null}

            {step === 'feel' ? (
              <FeelSheet
                tr={tr}
                locale={locale}
                tone={tone}
                moods={moods}
                onTone={setTone}
                onToggle={toggleMood}
                onDone={() => setStep('preview')}
              />
            ) : null}
          </>
        )}
      </SafeAreaView>
    </View>
  );
}

function Header({ step, tr, onClose, onBack }: { step: Step; tr: Cap; onClose: () => void; onBack: () => void }) {
  const { t: TT } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, paddingTop: 8, paddingBottom: 16 }}>
      <Pressable
        onPress={step === 'write' ? onClose : onBack}
        style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}
      >
        {step === 'write' ? <X size={17} color="#fff" strokeWidth={2} /> : <ChevronLeft size={18} color="#fff" strokeWidth={2} />}
      </Pressable>
      <Text style={{ flex: 1, textAlign: 'center', fontSize: 10.5, letterSpacing: 1.6, color: TT.faint }}>
        {(step === 'preview' ? tr.preview : tr.newMoment).toUpperCase()}
      </Text>
      <View style={{ width: 34, alignItems: 'flex-end' }}>
        {step === 'write' ? <Text style={{ fontSize: 11, color: TT.faint }}>1/2</Text> : null}
      </View>
    </View>
  );
}

/**
 * Step two. One sheet that GROWS: picking a tone reveals the feelings beneath
 * the pills rather than replacing the question, so going back costs nothing.
 */
function FeelSheet({
  tr, locale, tone, moods, onTone, onToggle, onDone,
}: {
  tr: Cap;
  locale: 'en' | 'fr';
  tone: Tone | null;
  moods: string[];
  onTone: (t: Tone) => void;
  onToggle: (k: string) => void;
  onDone: () => void;
}) {
  const { t: TT } = useTheme();
  const rise = useRef(new Animated.Value(0)).current;
  // In an effect, not during render: the sheet's entrance is a side effect, and
  // starting it inline fires on every re-render (each feeling tap) as well.
  useEffect(() => {
    Animated.timing(rise, { toValue: 1, duration: 320, useNativeDriver: true }).start();
  }, [rise]);

  return (
    <Animated.View
      style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        opacity: rise,
        transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
        backgroundColor: 'rgba(20,26,23,0.96)',
        borderTopLeftRadius: 26, borderTopRightRadius: 26,
        borderTopWidth: 1, borderColor: TT.cardLine,
        paddingHorizontal: 22, paddingTop: 12, paddingBottom: 26,
      }}
    >
      <View style={{ alignSelf: 'center', width: 38, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)', marginBottom: 14 }} />
      <Text style={{ fontSize: 10.5, letterSpacing: 1.4, color: TT.faint, marginBottom: 14 }}>{tr.step2.toUpperCase()}</Text>

      {/* The question sits ABOVE the pills, and is replaced by the second one
          below them once a choice is made — the sheet grows rather than swapping
          screens, so the pills never move and changing your mind costs nothing. */}
      {tone === null ? (
        <Text style={{ fontSize: 17, fontWeight: '700', color: TT.ink, marginBottom: 14 }}>{tr.wasMore}</Text>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 9 }}>
        {(['good', 'hard', 'mixed'] as Tone[]).map((k) => {
          const on = tone === k;
          return (
            <Pressable
              key={k}
              onPress={() => onTone(k)}
              style={{ flex: 1, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? 'rgba(255,255,255,0.14)' : 'transparent', borderWidth: 1, borderColor: on ? 'rgba(255,255,255,0.30)' : TT.cardLine }}
            >
              <Text style={{ fontSize: 13.5, fontWeight: on ? '700' : '500', color: on ? TT.ink : TT.inkSoft }}>{tr.tone[k]}</Text>
            </Pressable>
          );
        })}
      </View>

      {tone !== null ? (
        <>
          <Text style={{ marginTop: 18, fontSize: 17, fontWeight: '700', color: TT.ink }}>{tr.howFeel}</Text>
          <Text style={{ marginTop: 3, fontSize: 12.5, color: TT.faint }}>{fmt(tr.pickUpTo, { n: String(MAX_MOODS) })}</Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
            {moodsForTone(tone).map((m) => {
              const on = moods.includes(m.key);
              return (
                <Pressable
                  key={m.key}
                  onPress={() => onToggle(m.key)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: on ? `${m.color}2E` : 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: on ? m.color : TT.cardLine }}
                >
                  <m.Icon size={13} color={on ? m.color : TT.inkSoft} strokeWidth={2} />
                  <Text style={{ fontSize: 13, fontWeight: on ? '700' : '500', color: on ? TT.ink : TT.inkSoft }}>{moodLabel(m.key, locale)}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={onDone}
            disabled={moods.length === 0}
            style={{ marginTop: 20, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: moods.length > 0 ? '#fff' : 'rgba(255,255,255,0.12)' }}
          >
            <Text style={{ fontSize: 15, fontWeight: '700', color: moods.length > 0 ? '#141414' : 'rgba(255,255,255,0.4)' }}>{tr.seeMyMoment}</Text>
          </Pressable>
        </>
      ) : null}
    </Animated.View>
  );
}

/** Step three. The moment as it will look on the line, not a summary of a form. */
function Preview({
  when, note, moods, locale, tr, share, canShare, pracFirst, busy, onToggleShare, onEdit, onCommit,
}: {
  when: string;
  note: string;
  moods: string[];
  locale: 'en' | 'fr';
  tr: Cap;
  share: boolean;
  canShare: boolean;
  pracFirst: string;
  busy: boolean;
  onToggleShare: () => void;
  onEdit: () => void;
  onCommit: () => void;
}) {
  const { t: TT } = useTheme();
  return (
    <View style={{ flex: 1, paddingHorizontal: 26 }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <Text style={{ fontSize: 12.5, color: TT.faint, marginBottom: 12 }}>{when}</Text>
        {note.trim() ? (
          <Text style={{ fontSize: 21, fontWeight: '600', color: TT.ink, lineHeight: 29 }}>{note.trim()}</Text>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
          {moods.map((k) => {
            const m = MOODS.find((x) => x.key === k);
            if (!m) return null;
            return (
              <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 32, borderRadius: 16, backgroundColor: `${m.color}2E`, borderWidth: 1, borderColor: m.color }}>
                <m.Icon size={13} color={m.color} strokeWidth={2} />
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: TT.ink }}>{moodLabel(k, locale)}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Who sees this. Named, not labelled "private": the question a person has
          here is who, and the reassurance about undoing it appears only once it
          is something they have actually done. */}
      {canShare ? (
        <Pressable
          onPress={onToggleShare}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: TT.card, borderWidth: 1, borderColor: share ? 'rgba(127,217,192,0.45)' : TT.cardLine, borderRadius: 18, padding: 14, marginBottom: 14 }}
        >
          {share ? <Eye size={17} color={TT.accent} strokeWidth={2} /> : <Lock size={17} color={TT.faint} strokeWidth={2} />}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: share ? TT.accent : TT.ink }}>
              {share ? fmt(tr.showPrac, { prac: pracFirst }) : tr.keepPrivate}
            </Text>
            <Text style={{ fontSize: 11.5, color: TT.faint, marginTop: 2 }}>
              {share ? tr.canChangeLater : fmt(tr.pracCannotSee, { prac: pracFirst })}
            </Text>
          </View>
          <View style={{ width: 42, height: 25, borderRadius: 13, padding: 3, backgroundColor: share ? TT.accent : 'rgba(255,255,255,0.16)', alignItems: share ? 'flex-end' : 'flex-start' }}>
            <View style={{ width: 19, height: 19, borderRadius: 10, backgroundColor: '#fff' }} />
          </View>
        </Pressable>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 10, paddingBottom: 8 }}>
        <Pressable
          onPress={onEdit}
          disabled={busy}
          style={{ width: 96, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: TT.cardLine }}
        >
          <Text style={{ fontSize: 14.5, fontWeight: '700', color: TT.ink }}>{tr.edit}</Text>
        </Pressable>
        <Pressable
          onPress={onCommit}
          disabled={busy}
          style={{ flex: 1, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', opacity: busy ? 0.6 : 1 }}
        >
          {busy ? <ActivityIndicator color="#141414" /> : <Text style={{ fontSize: 15, fontWeight: '700', color: '#141414' }}>{tr.createMoment}</Text>}
        </Pressable>
      </View>
    </View>
  );
}

/**
 * The media picker. One sheet per KIND of thing being chosen — photo and video
 * are a single control because a patient is choosing a moment to keep, not a
 * file format, and voice offers the same two ways in: record now, or bring one.
 *
 * Drawn as glass over whatever is behind it, so the moment stays visible while
 * they choose how to add to it.
 */
function PickerSheet({
  which, tr, onClose, onPhoto, onVideo, onLibrary, onRecord,
}: {
  which: 'visual' | 'voice';
  tr: Cap;
  onClose: () => void;
  onPhoto: () => void;
  onVideo: () => void;
  onLibrary: () => void;
  onRecord: () => void;
}) {
  const { t: TT } = useTheme();
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(rise, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, [rise]);

  // On web the camera routes do not exist, so offering them would be a button
  // that cannot work. The library still can.
  const rows =
    which === 'visual'
      ? [
          ...(cameraAvailable
            ? [
                { Icon: Camera, label: tr.takePhoto, onPress: onPhoto },
                { Icon: Video, label: tr.recordVideo, onPress: onVideo },
              ]
            : []),
          { Icon: Images, label: tr.chooseLibrary, onPress: onLibrary },
        ]
      : [
          { Icon: Circle, label: tr.recordNow, onPress: onRecord },
          { Icon: Images, label: tr.chooseFile, onPress: onLibrary },
        ];

  return (
    <>
      <Pressable onPress={onClose} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)' }} />
      <Animated.View
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          opacity: rise,
          transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
          backgroundColor: 'rgba(20,26,23,0.97)',
          borderTopLeftRadius: 26, borderTopRightRadius: 26,
          borderTopWidth: 1, borderColor: TT.cardLine,
          paddingHorizontal: 18, paddingTop: 12, paddingBottom: 22,
        }}
      >
        <View style={{ alignSelf: 'center', width: 38, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)', marginBottom: 14 }} />
        <Text style={{ fontSize: 10.5, letterSpacing: 1.4, color: TT.faint, marginBottom: 8, paddingHorizontal: 4 }}>
          {(which === 'visual' ? tr.photoOrVideo : tr.voice).toUpperCase()}
        </Text>
        {rows.map((r) => (
          <Pressable
            key={r.label}
            onPress={r.onPress}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, paddingHorizontal: 4 }}
          >
            <r.Icon size={19} color={TT.ink} strokeWidth={2} />
            <Text style={{ fontSize: 15.5, fontWeight: '600', color: TT.ink }}>{r.label}</Text>
          </Pressable>
        ))}
        <Pressable onPress={onClose} style={{ marginTop: 8, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' }}>
          <Text style={{ fontSize: 14.5, fontWeight: '700', color: TT.ink }}>{tr.cancel}</Text>
        </Pressable>
      </Animated.View>
    </>
  );
}

/** While a voice note is being recorded: the elapsed time and the way to stop. */
function RecordingBar({ seconds, onStop, tr }: { seconds: number; onStop: () => void; tr: Cap }) {
  const { t: TT } = useTheme();
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <Animated.View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: '#E5534B', opacity: pulse }} />
      <Text style={{ flex: 1, fontSize: 13, color: TT.ink, fontWeight: '600' }}>
        {tr.recording}  {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
      </Text>
      <Pressable onPress={onStop} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.12)' }}>
        <Square size={12} color={TT.ink} strokeWidth={2.5} fill={TT.ink} />
        <Text style={{ fontSize: 13, fontWeight: '700', color: TT.ink }}>{tr.stop}</Text>
      </Pressable>
    </View>
  );
}

function Chip({ Icon, label, onPress }: { Icon: typeof ImagePlus; label: string; onPress: () => void }) {
  const { t: TT } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: TT.cardLine }}
    >
      <Icon size={15} color={TT.ink} strokeWidth={2} />
      <Text style={{ fontSize: 13, fontWeight: '600', color: TT.ink }}>{label}</Text>
    </Pressable>
  );
}

function MediaBadge({ media, onClear, tr }: { media: PreparedMedia; onClear: () => void; tr: Cap }) {
  const { t: TT } = useTheme();
  const thumb = media.kind === 'image' ? media.uri : media.kind === 'video' ? media.thumbUri ?? null : null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      {thumb ? (
        <Image source={{ uri: thumb }} style={{ width: 40, height: 40, borderRadius: 10 }} />
      ) : (
        <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' }}>
          <Mic size={17} color={TT.ink} strokeWidth={2} />
        </View>
      )}
      <Text style={{ flex: 1, fontSize: 12.5, color: TT.inkSoft }}>
        {media.kind === 'image' ? tr.photoAdded : media.kind === 'video' ? tr.videoAdded : tr.voiceAdded}
      </Text>
      <Pressable onPress={onClear} style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.10)' }}>
        <X size={14} color={TT.ink} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

type Cap = ReturnType<typeof useI18n>['t']['capture'];
