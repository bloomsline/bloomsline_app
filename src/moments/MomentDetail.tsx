// Moment detail bottom sheet — ported from the v1 app (components/MomentDetail),
// pared to what v2 supports today: moods, text/caption, time, image media, plus
// wired Share-to-practitioner and Delete. Deferred vs v1: the conversation thread
// (no moment_comments backend yet) and the video/voice player (media storage dark).
import { useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Send, CircleCheckBig, Trash2, Play, Mic } from 'lucide-react-native';
import { MOOD_COLORS, moodLabel } from './moods';
import { deleteMoment, shareMoment, type MomentDTO, type MomentMediaDTO } from '@/src/api/moments';
import { useConfirm } from '@/src/ui/confirm';
import { AudioRow, MediaViewer } from '@/src/ui/MediaViewer';
import { useI18n } from '@/src/i18n';
import { MonoLabel } from '@/src/ui/editorial';
import { useTheme } from '@/src/ui/theme-mode';

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
    shareTitle: 'Share moment',
    shareBody: 'Share this moment with your practitioner? They’ll be able to see it.',
    share: 'Share',
    stopShareTitle: 'Stop sharing',
    stopShareBody: 'Stop sharing this moment? Your practitioner will no longer see it.',
    stopSharing: 'Stop sharing',
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
    shareTitle: 'Partager le moment',
    shareBody: 'Partager ce moment avec votre praticien ? Il pourra le consulter.',
    share: 'Partager',
    stopShareTitle: 'Arrêter le partage',
    stopShareBody: 'Arrêter de partager ce moment ? Votre praticien ne le verra plus.',
    stopSharing: 'Arrêter',
  },
} as const;

const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;


/** What the sheet changed, so the timeline can patch itself in place. It used to
 *  just say "something changed" and the line refetched its first page — which,
 *  now that the line is paged, would throw away every older page the reader had
 *  scrolled back through and drop them at today. */
export type MomentChange = { id: string; deleted: true } | { id: string; shared: boolean };

export function MomentDetail({ moment, onClose, onChanged }: { moment: MomentDTO; onClose: () => void; onChanged: (change: MomentChange) => void }) {
  const { t: TT } = useTheme();
  const insets = useSafeAreaInsets();
  const { locale, t } = useI18n();
  const confirm = useConfirm();
  const tr = T[locale];
  const [shared, setShared] = useState(moment.sharedWithPractitioner);
  const [sharing, setSharing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Which media item is open full screen, or null. The index is into
  // `moment.media`, so stepping in the viewer walks the whole moment.
  const [viewing, setViewing] = useState<number | null>(null);


  // Sharing sends the moment to the practitioner (or withdraws it), so both
  // directions confirm first — mirrors the delete flow (web confirm / native Alert).
  const confirmToggleShare = async () => {
    if (sharing) return;
    const next = !shared;
    const ok = await confirm({
      title: next ? tr.shareTitle : tr.stopShareTitle,
      message: next ? tr.shareBody : tr.stopShareBody,
      confirmLabel: next ? tr.share : tr.stopSharing,
      cancelLabel: t.common.cancel,
    });
    if (ok) toggleShare();
  };

  const toggleShare = async () => {
    if (sharing) return;
    const next = !shared;
    setSharing(true);
    setShared(next); // optimistic
    try {
      const confirmed = await shareMoment(moment.id, next);
      setShared(confirmed);
      onChanged({ id: moment.id, shared: confirmed });
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
      onChanged({ id: moment.id, deleted: true });
      onClose();
    } catch {
      setDeleting(false);
      if (Platform.OS === 'web') globalThis.alert?.(tr.deleteError);
    }
  };

  const confirmDelete = async () => {
    if (await confirm({ title: tr.deleteTitle, message: tr.deleteBody, confirmLabel: tr.delete, cancelLabel: t.common.cancel, destructive: true })) doDelete();
  };

  const when = new Date(moment.capturedAt);
  const timeLabel = `${when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: TT.scrim, justifyContent: 'flex-end' }}>
        <Pressable
          onPress={() => {}}
          style={{ backgroundColor: TT.sheet, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: insets.bottom + 16, maxHeight: '82%' }}
        >
          <View style={{ alignItems: 'center', paddingVertical: 12 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: TT.line }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Media — first item as a hero */}
            {moment.media.length > 0 && <MediaHero item={moment.media[0]} onOpen={() => setViewing(0)} />}

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
              {moment.textContent ? <Text style={{ fontSize: 17, color: TT.ink, lineHeight: 26, marginBottom: 12 }}>{moment.textContent}</Text> : null}
              {moment.caption ? <Text style={{ fontSize: 15, color: TT.inkSoft, lineHeight: 22, marginBottom: 12 }}>{moment.caption}</Text> : null}

              {/* Extra media */}
              {moment.media.length > 1 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {moment.media.slice(1).map((m, i) => (
                      <MediaThumb key={m.id} item={m} onOpen={() => setViewing(i + 1)} />
                    ))}
                  </View>
                </ScrollView>
              )}

              {/* Time */}
              <MonoLabel color={TT.faint} size={10.5}>{timeLabel}</MonoLabel>

              {/* Share to practitioner */}
              <TouchableOpacity
                onPress={confirmToggleShare}
                disabled={sharing}
                activeOpacity={0.85}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, paddingVertical: 16,
                  backgroundColor: shared ? TT.accentTint : TT.accent, borderRadius: 27, borderWidth: shared ? 1 : 0, borderColor: shared ? TT.line : 'transparent',
                }}
              >
                {sharing ? (
                  <ActivityIndicator size="small" color={shared ? TT.accent : '#fff'} />
                ) : shared ? (
                  <>
                    <CircleCheckBig size={18} color={TT.accent} strokeWidth={2} />
                    <Text style={{ fontSize: 14, fontWeight: '600', color: TT.accent }}>{tr.sharedTap}</Text>
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
      {/* The viewer sits inside this sheet so closing it returns here rather
          than dismissing the moment underneath it. */}
      {viewing !== null ? (
        <MediaViewer
          // The DTO types `kind` as a string; anything unexpected is treated as
          // an image, which shows something rather than a blank stage.
          items={moment.media.map((m) => ({
            kind: m.kind === 'video' ? ('video' as const) : m.kind === 'audio' ? ('audio' as const) : ('image' as const),
            url: m.url,
            thumbnailUrl: m.thumbnailUrl,
            durationSeconds: m.durationSeconds,
          }))}
          index={viewing}
          onIndex={setViewing}
          onClose={() => setViewing(null)}
        />
      ) : null}
    </Modal>
  );
}

function MediaHero({ item, onOpen }: { item: MomentMediaDTO; onOpen: () => void }) {
  const { t: TT } = useTheme();
  const { locale } = useI18n();
  const tr = T[locale];
  // Audio plays in place. There is nothing to look at, so a full screen showing
  // a progress bar would be theatre.
  if (item.kind === 'audio') {
    return (
      <View style={{ paddingHorizontal: 20, paddingVertical: 18 }}>
        <AudioRow url={item.url} durationSeconds={item.durationSeconds} label={`${tr.voiceNote}${item.durationSeconds ? ` · ${fmtDur(item.durationSeconds)}` : ''}`} />
      </View>
    );
  }
  const poster = item.thumbnailUrl ?? (item.kind === 'image' ? item.url : null);
  const isVideo = item.kind === 'video';
  // An image is now tappable too: it used to be `disabled` unless it was a
  // video, so a photograph could not be enlarged at all.
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onOpen}>
      {poster ? <Image source={{ uri: poster }} style={{ width: '100%', height: 260 }} resizeMode="cover" /> : <View style={{ width: '100%', height: 260, backgroundColor: TT.slot }} />}
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

function MediaThumb({ item, onOpen }: { item: MomentMediaDTO; onOpen: () => void }) {
  const { t: TT } = useTheme();
  const { locale } = useI18n();
  const tr = T[locale];
  if (item.kind === 'audio') {
    return (
      <TouchableOpacity onPress={onOpen} activeOpacity={0.8} style={{ width: 120, height: 120, borderRadius: 16, backgroundColor: TT.accentTint, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <Mic size={22} color={TT.accent} strokeWidth={2} />
        <Text style={{ fontSize: 11, color: TT.inkSoft }}>{item.durationSeconds ? fmtDur(item.durationSeconds) : tr.voice}</Text>
      </TouchableOpacity>
    );
  }
  const poster = item.thumbnailUrl ?? (item.kind === 'image' ? item.url : null);
  const isVideo = item.kind === 'video';
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onOpen}>
      {poster ? <Image source={{ uri: poster }} style={{ width: 120, height: 120, borderRadius: 16 }} resizeMode="cover" /> : <View style={{ width: 120, height: 120, borderRadius: 16, backgroundColor: TT.slot }} />}
      {isVideo && (
        <View style={{ position: 'absolute', top: 44, left: 44, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
          <Play size={16} color="#fff" fill="#fff" />
        </View>
      )}
    </TouchableOpacity>
  );
}
