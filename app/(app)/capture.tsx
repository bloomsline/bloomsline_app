// Capture — mood + note + one media item (photo/video from the library, or a
// voice note recorded on-device). Media is compressed/thumbnailed on-device and
// uploaded straight to object storage. Mood/note still work with no media.
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { X, ImagePlus, Mic, Play, Square } from 'lucide-react-native';
import { useAudioRecorder, useAudioRecorderState, requestRecordingPermissionsAsync, RecordingPresets } from 'expo-audio';
import { MOODS } from '@/src/moments/moods';
import { createMoment } from '@/src/api/moments';
import { pickMedia, uploadMedia, type PreparedMedia } from '@/src/moments/media-upload';

const MAX_MOODS = 8;
const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export default function Capture() {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [media, setMedia] = useState<PreparedMedia | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError('Could not add that. Please try another file.');
    }
  };

  const startRec = async () => {
    setError(null);
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) { setError('Microphone access is needed to record a voice note.'); return; }
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch {
      setError('Could not start recording.');
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
      setError('Could not save the recording.');
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
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: '#fff' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 8, paddingBottom: 4 }}>
          <TouchableOpacity onPress={close} activeOpacity={0.7} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' }}>
            <X size={19} color="#333" strokeWidth={2} />
          </TouchableOpacity>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#000' }}>New moment</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={{ fontSize: 26, fontWeight: '700', color: '#000', letterSpacing: -0.5, lineHeight: 32, marginTop: 12 }}>How are you{'\n'}feeling right now?</Text>
          <Text style={{ fontSize: 14, color: '#999', marginTop: 6 }}>Pick what fits. You can choose a few.</Text>

          {/* Mood grid */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 20 }}>
            {MOODS.map((m) => {
              const on = selected.includes(m.key);
              return (
                <TouchableOpacity key={m.key} onPress={() => toggle(m.key)} activeOpacity={0.8}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingLeft: 12, paddingRight: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5, backgroundColor: on ? `${m.color}14` : '#fff', borderColor: on ? m.color : '#EBEBEB' }}>
                  <m.Icon size={16} color={m.color} strokeWidth={2} />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: on ? m.color : '#333' }}>{m.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Note */}
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#000', marginTop: 28 }}>A few words, if you’d like</Text>
          <View style={{ marginTop: 10, borderRadius: 16, borderWidth: 1, borderColor: '#EBEBEB', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12 }}>
            <TextInput value={note} onChangeText={setNote} placeholder="What’s here for you right now?" placeholderTextColor="#BBBBBB" multiline maxLength={5000}
              style={{ minHeight: 96, fontSize: 15, lineHeight: 22, color: '#000', textAlignVertical: 'top' }} />
          </View>

          {/* Media */}
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#000', marginTop: 28 }}>Add a photo, video or voice note</Text>
          {recording ? (
            <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1.5, borderColor: '#DC2626', backgroundColor: '#FEF2F2', paddingHorizontal: 16, paddingVertical: 14 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#DC2626' }} />
              <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: '#DC2626' }}>Recording · {fmtDur(Math.round((recState.durationMillis ?? 0) / 1000))}</Text>
              <TouchableOpacity onPress={stopRec} activeOpacity={0.8} style={{ height: 38, paddingHorizontal: 16, borderRadius: 19, backgroundColor: '#DC2626', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Square size={13} color="#fff" fill="#fff" />
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>Stop</Text>
              </TouchableOpacity>
            </View>
          ) : media ? (
            <MediaPreview media={media} onRemove={() => setMedia(null)} />
          ) : (
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <TouchableOpacity onPress={addMedia} activeOpacity={0.8} style={{ flex: 1, height: 88, borderRadius: 16, borderWidth: 1.5, borderColor: '#EBEBEB', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <ImagePlus size={20} color="#999" strokeWidth={2} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#999' }}>Photo / video</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={startRec} activeOpacity={0.8} style={{ flex: 1, height: 88, borderRadius: 16, borderWidth: 1.5, borderColor: '#EBEBEB', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Mic size={20} color="#999" strokeWidth={2} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#999' }}>Voice note</Text>
              </TouchableOpacity>
            </View>
          )}

          {error && <Text style={{ marginTop: 12, fontSize: 13, fontWeight: '500', color: '#DC2626' }}>{error}</Text>}
        </ScrollView>

        {/* CTA */}
        <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8, borderTopWidth: 1, borderTopColor: '#EEE' }}>
          <Pressable onPress={save} disabled={!canSave || saving}
            style={{ height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', backgroundColor: !canSave || saving ? '#E5E5E5' : '#1A1A1A' }}>
            <Text style={{ fontSize: 17, fontWeight: '600', color: !canSave || saving ? '#999' : '#fff' }}>{saving ? (media ? 'Uploading…' : 'Saving…') : 'Save this moment'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MediaPreview({ media, onRemove }: { media: PreparedMedia; onRemove: () => void }) {
  const remove = (
    <TouchableOpacity onPress={onRemove} activeOpacity={0.8} style={{ position: 'absolute', top: -8, right: -8, width: 28, height: 28, borderRadius: 14, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' }}>
      <X size={15} color="#fff" strokeWidth={2.5} />
    </TouchableOpacity>
  );

  if (media.kind === 'audio') {
    return (
      <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: '#EBEBEB', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 14, alignSelf: 'stretch' }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#F59E0B', alignItems: 'center', justifyContent: 'center' }}>
          <Mic size={18} color="#fff" strokeWidth={2} />
        </View>
        <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: '#000' }}>Voice note · {fmtDur(media.durationSeconds)}</Text>
        <TouchableOpacity onPress={onRemove} hitSlop={8}><X size={18} color="#999" strokeWidth={2} /></TouchableOpacity>
      </View>
    );
  }

  // image or video → thumbnail
  const thumb = media.kind === 'image' ? media.thumbUri : media.thumbUri;
  return (
    <View style={{ marginTop: 10, alignSelf: 'flex-start' }}>
      {thumb ? (
        <Image source={{ uri: thumb }} style={{ width: 120, height: 120, borderRadius: 16, backgroundColor: '#F2F2F2' }} resizeMode="cover" />
      ) : (
        <View style={{ width: 120, height: 120, borderRadius: 16, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 12, color: '#fff' }}>Video</Text>
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
