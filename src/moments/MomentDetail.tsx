// Moment detail bottom sheet — ported from the v1 app (components/MomentDetail),
// pared to what v2 supports today: moods, text/caption, time, image media, plus
// wired Share-to-practitioner and Delete. Deferred vs v1: the conversation thread
// (no moment_comments backend yet) and the video/voice player (media storage dark).
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Modal, Platform, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Send, CircleCheckBig, Trash2, Play, Mic } from 'lucide-react-native';
import { MOOD_COLORS, moodLabel } from './moods';
import { deleteMoment, shareMoment, type MomentDTO, type MomentMediaDTO } from '@/src/api/moments';
import { useI18n } from '@/src/i18n';
import { EDA, MonoLabel } from '@/src/ui/editorial';

const T = {
  en: {
    updateSharingError: 'Could not update sharing. Please try again.',
    deleteError: 'Could not delete. Please try again.',
    deleteConfirmWeb: 'Delete this moment? This can’t be undone.',
    deleteTitle: 'Delete moment',
    deleteBody: 'This can’t be undone.',
    delete: 'Delete',
    sharedTap: 'Shared · Tap to stop sharing',
    sendToPractitioner: 'Send to my practitioner',
    deleteMoment: 'Delete moment',
    voiceNote: 'Voice note',
    voice: 'Voice',
  },
  fr: {
    updateSharingError: 'Impossible de mettre à jour le partage. Veuillez réessayer.',
    deleteError: 'Impossible de supprimer. Veuillez réessayer.',
    deleteConfirmWeb: 'Supprimer ce moment ? Cette action est irréversible.',
    deleteTitle: 'Supprimer le moment',
    deleteBody: 'Cette action est irréversible.',
    delete: 'Supprimer',
    sharedTap: 'Partagé · Appuyez pour arrêter',
    sendToPractitioner: 'Envoyer à mon praticien',
    deleteMoment: 'Supprimer le moment',
    voiceNote: 'Note vocale',
    voice: 'Vocal',
  },
} as const;

const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const openMedia = (url: string) => (Platform.OS === 'web' ? globalThis.open?.(url, '_blank') : Linking.openURL(url).catch(() => {}));

const BLOOM = EDA.green;

export function MomentDetail({ moment, onClose, onChanged }: { moment: MomentDTO; onClose: () => void; onChanged: () => void }) {
  const insets = useSafeAreaInsets();
  const { locale, t } = useI18n();
  const tr = T[locale];
  const [shared, setShared] = useState(moment.sharedWithPractitioner);
  const [sharing, setSharing] = useState(false);
  const [deleting, setDeleting] = useState(false);


  const toggleShare = async () => {
    if (sharing) return;
    const next = !shared;
    setSharing(true);
    setShared(next); // optimistic
    try {
      const confirmed = await shareMoment(moment.id, next);
      setShared(confirmed);
      onChanged();
    } catch {
      setShared(!next); // revert
      if (Platform.OS === 'web') globalThis.alert?.(tr.updateSharingError);
    } finally {
      setSharing(false);
    }
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      await deleteMoment(moment.id);
      onChanged();
      onClose();
    } catch {
      setDeleting(false);
      if (Platform.OS === 'web') globalThis.alert?.(tr.deleteError);
    }
  };

  const confirmDelete = () => {
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(tr.deleteConfirmWeb)) doDelete();
    } else {
      Alert.alert(tr.deleteTitle, tr.deleteBody, [
        { text: t.common.cancel, style: 'cancel' },
        { text: tr.delete, style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const when = new Date(moment.capturedAt);
  const timeLabel = `${when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
        <Pressable
          onPress={() => {}}
          style={{ backgroundColor: EDA.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: insets.bottom + 16, maxHeight: '82%' }}
        >
          <View style={{ alignItems: 'center', paddingVertical: 12 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: EDA.line }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Media — first item as a hero */}
            {moment.media.length > 0 && <MediaHero item={moment.media[0]} />}

            <View style={{ padding: 20 }}>
              {/* Moods */}
              {moment.moods.length > 0 && (
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                  {moment.moods.map((mood) => {
                    const color = MOOD_COLORS[mood] || '#666';
                    return (
                      <View key={mood} style={{ backgroundColor: color + '14', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 6 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color }}>{moodLabel(mood, locale)}</Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Text + caption */}
              {moment.textContent ? <Text style={{ fontSize: 17, color: EDA.ink, lineHeight: 26, marginBottom: 12 }}>{moment.textContent}</Text> : null}
              {moment.caption ? <Text style={{ fontSize: 15, color: EDA.inkSoft, lineHeight: 22, marginBottom: 12 }}>{moment.caption}</Text> : null}

              {/* Extra media */}
              {moment.media.length > 1 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {moment.media.slice(1).map((m) => (
                      <MediaThumb key={m.id} item={m} />
                    ))}
                  </View>
                </ScrollView>
              )}

              {/* Time */}
              <MonoLabel color={EDA.faint} size={10.5}>{timeLabel}</MonoLabel>

              {/* Share to practitioner */}
              <TouchableOpacity
                onPress={toggleShare}
                disabled={sharing}
                activeOpacity={0.85}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, paddingVertical: 16,
                  backgroundColor: shared ? EDA.greenTint : BLOOM, borderRadius: 27, borderWidth: shared ? 1 : 0, borderColor: shared ? EDA.line : 'transparent',
                }}
              >
                {sharing ? (
                  <ActivityIndicator size="small" color={shared ? BLOOM : '#fff'} />
                ) : shared ? (
                  <>
                    <CircleCheckBig size={18} color={BLOOM} strokeWidth={2} />
                    <Text style={{ fontSize: 14, fontWeight: '600', color: BLOOM }}>{tr.sharedTap}</Text>
                  </>
                ) : (
                  <>
                    <Send size={16} color="#fff" strokeWidth={2} />
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>{tr.sendToPractitioner}</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Delete */}
              <TouchableOpacity
                onPress={confirmDelete}
                disabled={deleting}
                activeOpacity={0.7}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10, paddingVertical: 14, borderRadius: 16 }}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#DC2626" />
                ) : (
                  <>
                    <Trash2 size={16} color="#DC2626" strokeWidth={2} />
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#DC2626' }}>{tr.deleteMoment}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function MediaHero({ item }: { item: MomentMediaDTO }) {
  const { locale } = useI18n();
  const tr = T[locale];
  if (item.kind === 'audio') {
    return (
      <TouchableOpacity onPress={() => openMedia(item.url)} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: EDA.greenTint, paddingHorizontal: 20, paddingVertical: 18 }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: EDA.green, alignItems: 'center', justifyContent: 'center' }}>
          <Play size={18} color="#fff" fill="#fff" />
        </View>
        <Text style={{ fontSize: 15, fontWeight: '600', color: EDA.ink }}>{tr.voiceNote}{item.durationSeconds ? ` · ${fmtDur(item.durationSeconds)}` : ''}</Text>
      </TouchableOpacity>
    );
  }
  const poster = item.thumbnailUrl ?? (item.kind === 'image' ? item.url : null);
  const isVideo = item.kind === 'video';
  return (
    <TouchableOpacity activeOpacity={isVideo ? 0.9 : 1} disabled={!isVideo} onPress={isVideo ? () => openMedia(item.url) : undefined}>
      {poster ? <Image source={{ uri: poster }} style={{ width: '100%', height: 260 }} resizeMode="cover" /> : <View style={{ width: '100%', height: 260, backgroundColor: EDA.slot }} />}
      {isVideo && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
            <Play size={26} color="#fff" fill="#fff" />
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

function MediaThumb({ item }: { item: MomentMediaDTO }) {
  const { locale } = useI18n();
  const tr = T[locale];
  if (item.kind === 'audio') {
    return (
      <TouchableOpacity onPress={() => openMedia(item.url)} activeOpacity={0.8} style={{ width: 120, height: 120, borderRadius: 16, backgroundColor: EDA.greenTint, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <Mic size={22} color={EDA.green} strokeWidth={2} />
        <Text style={{ fontSize: 11, color: EDA.inkSoft }}>{item.durationSeconds ? fmtDur(item.durationSeconds) : tr.voice}</Text>
      </TouchableOpacity>
    );
  }
  const poster = item.thumbnailUrl ?? (item.kind === 'image' ? item.url : null);
  const isVideo = item.kind === 'video';
  return (
    <TouchableOpacity activeOpacity={isVideo ? 0.9 : 1} disabled={!isVideo} onPress={isVideo ? () => openMedia(item.url) : undefined}>
      {poster ? <Image source={{ uri: poster }} style={{ width: 120, height: 120, borderRadius: 16 }} resizeMode="cover" /> : <View style={{ width: 120, height: 120, borderRadius: 16, backgroundColor: EDA.slot }} />}
      {isVideo && (
        <View style={{ position: 'absolute', top: 44, left: 44, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
          <Play size={16} color="#fff" fill="#fff" />
        </View>
      )}
    </TouchableOpacity>
  );
}
