// Capture — mood + note + one media item (photo/video from the library, or a
// voice note recorded on-device). Media is compressed/thumbnailed on-device and
// uploaded straight to object storage. Mood/note still work with no media.
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { X, ImagePlus, Mic, Play, Square, Sun, CloudRain } from 'lucide-react-native';
import { useAudioRecorder, useAudioRecorderState, requestRecordingPermissionsAsync, RecordingPresets } from 'expo-audio';
import { EDA, EdPill } from '@/src/ui/editorial';
import { MOODS } from '@/src/moments/moods';
import { createMoment } from '@/src/api/moments';
import { pickMedia, uploadMedia, type PreparedMedia } from '@/src/moments/media-upload';
import { useI18n } from '@/src/i18n';

const MAX_MOODS = 8;
const REC = '#C0392B';
// Feelings split into two gentle buckets by valence, so the picker shows a
// scannable ~8-9 at a time instead of all 17 at once. The gap between the two
// groups is wide (42 vs 72), so 55 is a clean divider.
const LIGHTER_MIN = 55;
const isLighter = (key: string) => (MOODS.find((m) => m.key === key)?.valence ?? 0) >= LIGHTER_MIN;
const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

const T = {
  en: {
    errAddMedia: 'Could not add that. Please try another file.',
    errMicNeeded: 'Microphone access is needed to record a voice note.',
    errStartRec: 'Could not start recording.',
    errSaveRec: 'Could not save the recording.',
    errSave: 'Could not save. Please try again.',
    newMoment: 'New moment',
    moodTitle: 'How are you\nfeeling right now?',
    moodSubtitle: 'Pick what fits. You can choose a few.',
    howLanding: 'Start with how it’s landing.',
    lighter: 'Lighter',
    heavier: 'Heavier',
    all: 'All',
    seeAll: 'Feeling a mix? See all feelings',
    noteTitle: 'A few words, if you’d like',
    notePlaceholder: 'What’s here for you right now?',
    mediaTitle: 'Add a photo, video or voice note',
    recording: 'Recording',
    stop: 'Stop',
    photoVideo: 'Photo / video',
    voiceNote: 'Voice note',
    uploading: 'Uploading…',
    saving: 'Saving…',
    saveMoment: 'Save this moment',
    video: 'Video',
    moods: {
      peaceful: 'Peaceful', calm: 'Calm', grateful: 'Grateful', hopeful: 'Hopeful',
      loved: 'Loved', proud: 'Proud', inspired: 'Inspired', funny: 'Funny',
      playful: 'Playful', tired: 'Tired', anxious: 'Anxious', sad: 'Sad',
      lonely: 'Lonely', overwhelmed: 'Overwhelmed', heavy: 'Heavy', angry: 'Angry',
      fear: 'Fearful',
    } as Record<string, string>,
  },
  fr: {
    errAddMedia: 'Impossible d’ajouter ce fichier. Essayez-en un autre.',
    errMicNeeded: 'L’accès au micro est nécessaire pour enregistrer une note vocale.',
    errStartRec: 'Impossible de démarrer l’enregistrement.',
    errSaveRec: 'Impossible d’enregistrer la note vocale.',
    errSave: 'Enregistrement impossible. Veuillez réessayer.',
    newMoment: 'Nouveau moment',
    moodTitle: 'Comment vous\nsentez-vous en ce moment ?',
    moodSubtitle: 'Choisissez ce qui vous correspond. Vous pouvez en sélectionner plusieurs.',
    howLanding: 'Commencez par ce que vous ressentez.',
    lighter: 'Plus léger',
    heavier: 'Plus lourd',
    all: 'Tout',
    seeAll: 'Un mélange ? Voir tout',
    noteTitle: 'Quelques mots, si vous le souhaitez',
    notePlaceholder: 'Qu’est-ce qui vous habite en ce moment ?',
    mediaTitle: 'Ajoutez une photo, une vidéo ou une note vocale',
    recording: 'Enregistrement',
    stop: 'Arrêter',
    photoVideo: 'Photo / vidéo',
    voiceNote: 'Note vocale',
    uploading: 'Envoi…',
    saving: 'Enregistrement…',
    saveMoment: 'Enregistrer ce moment',
    video: 'Vidéo',
    moods: {
      peaceful: 'Paisible', calm: 'Calme', grateful: 'Reconnaissant(e)', hopeful: 'Plein(e) d’espoir',
      loved: 'Aimé(e)', proud: 'Fier(ère)', inspired: 'Inspiré(e)', funny: 'Amusé(e)',
      playful: 'Joueur(se)', tired: 'Fatigué(e)', anxious: 'Anxieux(se)', sad: 'Triste',
      lonely: 'Seul(e)', overwhelmed: 'Dépassé(e)', heavy: 'Oppressé(e)', angry: 'En colère',
      fear: 'Effrayé(e)',
    } as Record<string, string>,
  },
} as const;

export default function Capture() {
  const router = useRouter();
  const { locale } = useI18n();
  const tr = T[locale];
  // An `emotion` param (from the Moments empty-state arrival shortcut) pre-selects
  // that feeling and opens straight into its bucket, ready to add more or write.
  const { emotion, bucket } = useLocalSearchParams<{ emotion?: string; bucket?: string }>();
  const initialEmotion = typeof emotion === 'string' && MOODS.some((m) => m.key === emotion) ? emotion : null;
  const [selected, setSelected] = useState<string[]>(initialEmotion ? [initialEmotion] : []);
  // Emotion picker view: the two-bucket chooser first, then the filtered grid. A
  // pre-selected emotion opens straight into its bucket; a `bucket` param (from
  // the Moments card's Lighter/Heavier shortcut) opens that cluster directly.
  const [view, setView] = useState<'pick' | 'lighter' | 'heavier' | 'all'>(
    initialEmotion
      ? isLighter(initialEmotion) ? 'lighter' : 'heavier'
      : bucket === 'lighter' || bucket === 'heavier' ? bucket : 'pick',
  );
  const shownMoods = view === 'all' ? MOODS : view === 'pick' ? [] : MOODS.filter((m) => isLighter(m.key) === (view === 'lighter'));
  const [note, setNote] = useState('');
  const [noteFocused, setNoteFocused] = useState(false);
  const [media, setMedia] = useState<PreparedMedia | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Soft reveal for the note + media once a feeling is picked. `showExtras` keeps
  // them mounted through the exit fade; `reveal` drives opacity + a gentle rise.
  const hasSelection = selected.length > 0;
  const reveal = useRef(new Animated.Value(0)).current;
  const [showExtras, setShowExtras] = useState(hasSelection);
  const scrollRef = useRef<ScrollView>(null);
  const noteY = useRef(0);
  useEffect(() => {
    if (hasSelection) {
      setShowExtras(true);
      Animated.timing(reveal, { toValue: 1, duration: 440, easing: Easing.bezier(0.16, 0.84, 0.24, 1), useNativeDriver: true }).start();
      // Softly bring the note into focus as the natural next step.
      const id = setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(noteY.current - 96, 0), animated: true }), 130);
      return () => clearTimeout(id);
    }
    Animated.timing(reveal, { toValue: 0, duration: 240, easing: Easing.in(Easing.ease), useNativeDriver: true }).start(({ finished }) => {
      if (finished) setShowExtras(false);
    });
  }, [hasSelection, reveal]);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder);
  const recording = recState.isRecording;

  const toggle = (key: string) =>
    setSelected((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : prev.length >= MAX_MOODS ? prev : [...prev, key]));

  const canSave = (selected.length > 0 || note.trim().length > 0 || media !== null) && !recording;
  const close = () => (router.canGoBack() ? router.back() : router.navigate('/moments' as never));

  const addMedia = async () => {
    setError(null);
    try {
      const p = await pickMedia();
      if (p) setMedia(p);
    } catch {
      setError(tr.errAddMedia);
    }
  };

  const startRec = async () => {
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

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);
    try {
      const m = media ? [await uploadMedia(media)] : [];
      await createMoment({ moods: selected, textContent: note.trim() || null, capturedAt: new Date().toISOString(), media: m });
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : tr.errSave);
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: EDA.canvas }}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* Slim editorial top bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingTop: 8, paddingBottom: 4 }}>
          <TouchableOpacity onPress={close} activeOpacity={0.7} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: EDA.card, borderWidth: 1, borderColor: EDA.line, justifyContent: 'center', alignItems: 'center' }}>
            <X size={19} color={EDA.ink} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={{ fontSize: 15, fontWeight: '700', color: EDA.ink }}>{tr.newMoment}</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView ref={scrollRef} contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 24 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={{ fontSize: 26, fontWeight: '800', color: EDA.ink, letterSpacing: -0.5, lineHeight: 32, marginTop: 12 }}>{tr.moodTitle}</Text>
          <Text style={{ fontSize: 14, color: EDA.inkSoft, marginTop: 6 }}>{view === 'pick' ? tr.howLanding : tr.moodSubtitle}</Text>

          {view === 'pick' ? (
            /* Two gentle buckets first — one decision, not seventeen. */
            <View style={{ marginTop: 20 }}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity onPress={() => setView('lighter')} activeOpacity={0.85}
                  style={{ flex: 1, height: 104, borderRadius: 18, borderWidth: 1.5, borderColor: EDA.line, backgroundColor: EDA.card, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <Sun size={26} color={EDA.green} strokeWidth={2} />
                  <Text style={{ fontSize: 16, fontWeight: '700', color: EDA.ink }}>{tr.lighter}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setView('heavier')} activeOpacity={0.85}
                  style={{ flex: 1, height: 104, borderRadius: 18, borderWidth: 1.5, borderColor: EDA.line, backgroundColor: EDA.card, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <CloudRain size={26} color={EDA.inkSoft} strokeWidth={2} />
                  <Text style={{ fontSize: 16, fontWeight: '700', color: EDA.ink }}>{tr.heavier}</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => setView('all')} activeOpacity={0.7} style={{ alignSelf: 'center', marginTop: 16 }}>
                <Text style={{ fontSize: 13.5, fontWeight: '700', color: EDA.green }}>{tr.seeAll}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Bucket switch — change your mind without going back. */}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 18 }}>
                {(['lighter', 'heavier', 'all'] as const).map((seg) => {
                  const on = view === seg;
                  return (
                    <TouchableOpacity key={seg} onPress={() => setView(seg)} activeOpacity={0.8}
                      style={{ flex: 1, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, backgroundColor: on ? EDA.green : EDA.card, borderColor: on ? EDA.green : EDA.line }}>
                      <Text style={{ fontSize: 13.5, fontWeight: '700', color: on ? '#fff' : EDA.inkSoft }}>{seg === 'lighter' ? tr.lighter : seg === 'heavier' ? tr.heavier : tr.all}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Divider: the tone buckets (category) above, the moods (sub-category) below. */}
              <View style={{ height: 1, backgroundColor: EDA.line, marginTop: 20 }} />

              {/* Filtered mood grid */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 }}>
                {shownMoods.map((m) => {
                  const on = selected.includes(m.key);
                  return (
                    <TouchableOpacity key={m.key} onPress={() => toggle(m.key)} activeOpacity={0.8}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingLeft: 12, paddingRight: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5, backgroundColor: on ? EDA.greenTint : EDA.card, borderColor: on ? EDA.green : EDA.line }}>
                      <m.Icon size={16} color={on ? EDA.green : EDA.faint} strokeWidth={2} />
                      <Text style={{ fontSize: 14, fontWeight: '600', color: on ? EDA.green : EDA.inkSoft }}>{tr.moods[m.key] ?? m.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {/* Note + media appear only after a feeling is chosen — one step at a time,
              with a soft fade + rise (and an exit fade before they unmount). */}
          {showExtras && (
          <Animated.View
            onLayout={(e) => { noteY.current = e.nativeEvent.layout.y; }}
            style={{ opacity: reveal, transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}
          >
          {/* Note */}
          <Text style={{ fontSize: 15, fontWeight: '700', color: EDA.ink, marginTop: 28 }}>{tr.noteTitle}</Text>
          <View style={{ marginTop: 10, borderRadius: 16, borderWidth: 1.5, borderColor: noteFocused ? EDA.green : EDA.line, backgroundColor: EDA.card, paddingHorizontal: 16, paddingVertical: 12 }}>
            <TextInput value={note} onChangeText={setNote} onFocus={() => setNoteFocused(true)} onBlur={() => setNoteFocused(false)} placeholder={tr.notePlaceholder} placeholderTextColor={EDA.faint} multiline maxLength={5000}
              style={[{ minHeight: 96, fontSize: 15, lineHeight: 22, color: EDA.ink, textAlignVertical: 'top' }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as never) : null]} />
          </View>

          {/* Media */}
          <Text style={{ fontSize: 15, fontWeight: '700', color: EDA.ink, marginTop: 28 }}>{tr.mediaTitle}</Text>
          {recording ? (
            <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1.5, borderColor: REC, backgroundColor: '#FBEEEC', paddingHorizontal: 16, paddingVertical: 14 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: REC }} />
              <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: REC }}>{tr.recording} · {fmtDur(Math.round((recState.durationMillis ?? 0) / 1000))}</Text>
              <TouchableOpacity onPress={stopRec} activeOpacity={0.8} style={{ height: 38, paddingHorizontal: 16, borderRadius: 19, backgroundColor: REC, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Square size={13} color="#fff" fill="#fff" />
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>{tr.stop}</Text>
              </TouchableOpacity>
            </View>
          ) : media ? (
            <MediaPreview media={media} onRemove={() => setMedia(null)} tr={tr} />
          ) : (
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <TouchableOpacity onPress={addMedia} activeOpacity={0.8} style={{ flex: 1, height: 88, borderRadius: 16, borderWidth: 1.5, borderColor: EDA.line, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <ImagePlus size={20} color={EDA.faint} strokeWidth={2} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: EDA.inkSoft }}>{tr.photoVideo}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={startRec} activeOpacity={0.8} style={{ flex: 1, height: 88, borderRadius: 16, borderWidth: 1.5, borderColor: EDA.line, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Mic size={20} color={EDA.faint} strokeWidth={2} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: EDA.inkSoft }}>{tr.voiceNote}</Text>
              </TouchableOpacity>
            </View>
          )}

          {error && <Text style={{ marginTop: 12, fontSize: 13, fontWeight: '500', color: REC }}>{error}</Text>}
          </Animated.View>
          )}
        </ScrollView>

        {/* CTA — fades in with the note/media once there's a feeling to save. */}
        {showExtras && (
        <Animated.View style={{ opacity: reveal }}>
          <View style={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 8, borderTopWidth: 1, borderTopColor: EDA.line }}>
            <EdPill label={saving ? (media ? tr.uploading : tr.saving) : tr.saveMoment} variant="dark" disabled={!canSave || saving} onPress={save} />
          </View>
        </Animated.View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MediaPreview({ media, onRemove, tr }: { media: PreparedMedia; onRemove: () => void; tr: (typeof T)[keyof typeof T] }) {
  const remove = (
    <TouchableOpacity onPress={onRemove} activeOpacity={0.8} style={{ position: 'absolute', top: -8, right: -8, width: 28, height: 28, borderRadius: 14, backgroundColor: EDA.ink, alignItems: 'center', justifyContent: 'center' }}>
      <X size={15} color="#fff" strokeWidth={2.5} />
    </TouchableOpacity>
  );

  if (media.kind === 'audio') {
    return (
      <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: EDA.line, backgroundColor: EDA.card, paddingHorizontal: 16, paddingVertical: 14, alignSelf: 'stretch' }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: EDA.green, alignItems: 'center', justifyContent: 'center' }}>
          <Mic size={18} color="#fff" strokeWidth={2} />
        </View>
        <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: EDA.ink }}>{tr.voiceNote} · {fmtDur(media.durationSeconds)}</Text>
        <TouchableOpacity onPress={onRemove} hitSlop={8}><X size={18} color={EDA.faint} strokeWidth={2} /></TouchableOpacity>
      </View>
    );
  }

  // image or video → thumbnail
  const thumb = media.kind === 'image' ? media.thumbUri : media.thumbUri;
  return (
    <View style={{ marginTop: 10, alignSelf: 'flex-start' }}>
      {thumb ? (
        <Image source={{ uri: thumb }} style={{ width: 120, height: 120, borderRadius: 16, backgroundColor: EDA.line }} resizeMode="cover" />
      ) : (
        <View style={{ width: 120, height: 120, borderRadius: 16, backgroundColor: EDA.slot, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 12, color: '#fff' }}>{tr.video}</Text>
        </View>
      )}
      {media.kind === 'video' && (
        <View style={{ position: 'absolute', top: 44, left: 44, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
          <Play size={16} color="#fff" fill="#fff" />
        </View>
      )}
      {remove}
    </View>
  );
}
