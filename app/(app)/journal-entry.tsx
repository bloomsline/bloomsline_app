// A journal page — reading and writing. An entry is an ordered list of blocks
// (text/heading/list/quote/callout/link + image/video/voice). SAVES AS YOU GO
// (debounced autosave). New entries are created on first real content; existing
// ones are patched. Media uploads straight to storage via the journal presign.
//
// The chrome matches the list: a dark bar with no photograph over light paper.
// Sharing lives in that bar as a chip that names WHO can read the page, rather
// than as a verb under the writing — see ShareChip for why.
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Linking, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAudioRecorder, useAudioRecorderState, requestRecordingPermissionsAsync, RecordingPresets } from 'expo-audio';
import {
  ChevronLeft, Check, Trash2, Type, Heading as HeadingIcon, List as ListIcon, Quote as QuoteIcon,
  Megaphone, Link2, Image as ImageIcon, Video as VideoIcon, Mic, Play, ChevronUp, ChevronDown, X,
  Pencil, MoreHorizontal, RotateCw, GripVertical,
} from 'lucide-react-native';
import { MonoLabel } from '@/src/ui/editorial';
import { ShareChip } from '@/src/journal/ShareChip';
import { AnchoredMenu, useAnchoredMenu } from '@/src/ui/AnchoredMenu';
import { AudioRow, MediaViewer, type ViewerItem } from '@/src/ui/MediaViewer';
import { useBlockDrag } from '@/src/journal/useBlockDrag';
import { usePractitionerFace } from '@/src/care/practitioner-face';
import { createJournal, deleteJournal, getJournal, shareJournal, updateJournal } from '@/src/api/journal';
import { newBlock, serializeForSave, entryIsEmpty, isMedia, type BlockType, type JournalBlock } from '@/src/journal/blocks';
import { pickImage, pickVideo, uploadImage, uploadVideo, uploadVoice } from '@/src/journal/media';
import { useConfirm } from '@/src/ui/confirm';
import { useI18n } from '@/src/i18n';
import { useTheme } from '@/src/ui/theme-mode';

/** A LINK is not media: it belongs in a browser, and always did. */
const openLink = (url: string) =>
  Platform.OS === 'web' ? globalThis.open?.(url, '_blank') : Linking.openURL(url).catch(() => {});

type Status = 'idle' | 'saving' | 'saved';

const T = {
  en: {
    saving: 'Saving…', saved: 'Saved {time}', titlePlaceholder: 'Title', words: 'words',
    moveUp: 'Move up', moveDown: 'Move down', retry: 'Try again',
    confirmWeb: 'Delete this entry?', deleteTitle: 'Delete entry', deleteMessage: 'This can’t be undone.', cancel: 'Cancel', delete: 'Delete',
    text: 'Text', heading: 'Heading', list: 'List', quote: 'Quote', callout: 'Callout', video: 'Video', link: 'Link', image: 'Image', voice: 'Voice',
    writePlaceholder: 'Start writing…', headingPlaceholder: 'Heading', quotePlaceholder: 'Quote', calloutPlaceholder: 'Callout', itemPlaceholder: 'List item',
    addItem: 'Add item', linkUrl: 'https://…', linkLabel: 'Link text (optional)', recording: 'Recording…', stop: 'Stop', tapRecord: 'Tap to record a voice note', uploadFailed: 'Upload failed', mediaUnavailable: 'Media unavailable', micNeeded: 'Microphone access is needed.', voiceNote: 'Voice note',
    shareError: 'Could not update sharing. Please try again.',
    canRead: '{name} can read this', private: 'Private', sharedOn: 'Shared {date}',
    onlyYou: 'Only you can read this.', stopSharing: 'Stop sharing', shareWith: 'Share with {name}',
  },
  fr: {
    saving: 'Enregistrement…', saved: 'Enregistré à {time}', titlePlaceholder: 'Titre', words: 'mots',
    moveUp: 'Monter', moveDown: 'Descendre', retry: 'Réessayer',
    confirmWeb: 'Supprimer cette entrée ?', deleteTitle: 'Supprimer l’entrée', deleteMessage: 'Cette action est irréversible.', cancel: 'Annuler', delete: 'Supprimer',
    text: 'Texte', heading: 'Titre', list: 'Liste', quote: 'Citation', callout: 'Encart', video: 'Vidéo', link: 'Lien', image: 'Image', voice: 'Vocal',
    writePlaceholder: 'Commencez à écrire…', headingPlaceholder: 'Titre', quotePlaceholder: 'Citation', calloutPlaceholder: 'Encart', itemPlaceholder: 'Élément',
    addItem: 'Ajouter', linkUrl: 'https://…', linkLabel: 'Texte du lien (facultatif)', recording: 'Enregistrement…', stop: 'Arrêter', tapRecord: 'Appuyez pour enregistrer un vocal', uploadFailed: 'Échec de l’envoi', mediaUnavailable: 'Média indisponible', micNeeded: 'L’accès au micro est nécessaire.', voiceNote: 'Note vocale',
    shareError: 'Impossible de mettre à jour le partage. Réessayez.',
    canRead: '{name} peut la lire', private: 'Privé', sharedOn: 'Partagée le {date}',
    onlyYou: 'Vous seul pouvez la lire.', stopSharing: 'Ne plus partager', shareWith: 'Partager avec {name}',
  },
} as const;

const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

export default function JournalEntry() {
  const { t: TT } = useTheme();
  const router = useRouter();
  const { locale } = useI18n();
  const confirm = useConfirm();
  const tr = T[locale];
  const { id: paramId } = useLocalSearchParams<{ id?: string }>();

  const [title, setTitle] = useState('');
  const [blocks, setBlocks] = useState<JournalBlock[]>([{ ...newBlock('text') }]);
  const [status, setStatus] = useState<Status>('idle');
  // "Saved" alone says nothing you did not already assume. The clock time says
  // which version is safe, which is the thing anyone actually wants to know.
  const [savedAtLabel, setSavedAtLabel] = useState('');
  /** Which media block is open full screen, by block id. */
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(typeof paramId === 'string' ? paramId : null);
  const [shared, setShared] = useState(false);
  const [sharedAt, setSharedAt] = useState<string | null>(null);
  // The day the page was started. A new page has none yet, and today is then
  // the honest answer rather than a guess.
  const [writtenAt, setWrittenAt] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  // Existing entries open READ-ONLY (tap Edit to change); new ones open in edit.
  const [mode, setMode] = useState<'read' | 'edit'>(typeof paramId === 'string' ? 'read' : 'edit');

  // How to redo a failed upload, kept per block. The picked asset never reaches
  // the block model — only the finished storage key does — so without this a
  // failure could only ever be reported, never undone.
  const redo = useRef(new Map<string, () => Promise<void>>());
  const idRef = useRef<string | null>(typeof paramId === 'string' ? paramId : null);
  const latest = useRef({ title: '', blocks: [] as JournalBlock[] });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  const face = usePractitionerFace();

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder);
  const recording = recState.isRecording;

  useEffect(() => {
    let alive = true;
    if (idRef.current) {
      getJournal(idRef.current).then((e) => {
        if (!alive) return;
        if (e) {
          setTitle(e.title ?? '');
          const bs = e.blocks && e.blocks.length ? e.blocks : [{ ...newBlock('text') }];
          setBlocks(bs);
          setShared(e.sharedWithPractitioner ?? false);
          setSharedAt(e.sharedWithPractitionerAt ?? null);
          setWrittenAt(e.createdAt ?? null);
          latest.current = { title: e.title ?? '', blocks: bs };
        }
        setLoaded(true);
      });
    } else {
      setLoaded(true);
    }
    return () => { alive = false; };
  }, []);

  const doSave = async () => {
    const { title: tt, blocks: bs } = latest.current;
    if (entryIsEmpty(tt, bs)) { if (mounted.current) setStatus('idle'); return; }
    const payload = { title: tt.trim() || null, blocks: serializeForSave(bs) };
    if (idRef.current) {
      await updateJournal(idRef.current, payload);
    } else {
      const created = await createJournal(payload);
      if (created) { idRef.current = created.id; if (mounted.current) setSavedId(created.id); }
    }
    if (mounted.current) {
      setSavedAtLabel(new Date().toLocaleTimeString(locale === 'fr' ? 'fr-FR' : 'en-GB', { hour: '2-digit', minute: '2-digit' }));
      setStatus('saved');
    }
  };

  // No confirmation sheet in either direction: opening the chip's menu IS the
  // deliberate act, and the menu already names the state and the one thing you
  // can do about it. A sheet on top of that asks a question about a question.
  const toggleShare = async (next: boolean) => {
    if (!savedId || sharing) return;
    setSharing(true); setShared(next);
    try {
      const res = await shareJournal(savedId, next);
      setShared(res.shared);
      setSharedAt(res.sharedAt);
    } catch {
      setShared(!next);
      setError(tr.shareError);
    } finally {
      setSharing(false);
    }
  };

  const schedule = () => {
    setStatus('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(doSave, 1000);
  };

  // Commit both state + the autosave ref, then schedule a save.
  const commit = (nextTitle: string, nextBlocks: JournalBlock[]) => {
    latest.current = { title: nextTitle, blocks: nextBlocks };
    schedule();
  };
  const setBlocksAndSave = (updater: (prev: JournalBlock[]) => JournalBlock[]) => {
    setBlocks((prev) => { const next = updater(prev); commit(latest.current.title || title, next); return next; });
  };
  const onTitle = (v: string) => { setTitle(v); commit(v, latest.current.blocks.length ? latest.current.blocks : blocks); };

  useEffect(() => {
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
      void doSave();
    };
  }, []);

  const back = () => (router.canGoBack() ? router.back() : router.navigate('/journal' as never));

  const remove = async () => {
    if (timer.current) clearTimeout(timer.current);
    if (idRef.current) await deleteJournal(idRef.current);
    idRef.current = null;
    latest.current = { title: '', blocks: [] };
    back();
  };
  const confirmDelete = async () => {
    if (!idRef.current && entryIsEmpty(title, blocks)) { back(); return; }
    if (await confirm({ title: tr.deleteTitle, message: tr.deleteMessage, confirmLabel: tr.delete, cancelLabel: tr.cancel, destructive: true })) remove();
  };

  // --- block ops -------------------------------------------------------------
  const patch = (id: string, p: Partial<JournalBlock>) => setBlocksAndSave((prev) => prev.map((b) => (b.id === id ? { ...b, ...p } : b)));
  const removeBlock = (id: string) => setBlocksAndSave((prev) => {
    redo.current.delete(id); const n = prev.filter((b) => b.id !== id); return n.length ? n : [{ ...newBlock('text') }]; });
  const move = (id: string, dir: -1 | 1) => setBlocksAndSave((prev) => {
    const i = prev.findIndex((b) => b.id === id); const j = i + dir;
    if (i < 0 || j < 0 || j >= prev.length) return prev;
    const n = [...prev]; [n[i], n[j]] = [n[j], n[i]]; return n;
  });
  const addText = (type: BlockType) => setBlocksAndSave((prev) => [...prev, newBlock(type)]);
  const reorder = (from: number, to: number) => setBlocksAndSave((prev) => {
    const n = [...prev];
    n.splice(to, 0, ...n.splice(from, 1));
    return n;
  });

  const drag = useBlockDrag(blocks.length, reorder);

  /** Run an upload for a block, remembering how to run it again if it fails. */
  const attach = async (blockId: string, send: () => Promise<Partial<JournalBlock> | null>) => {
    const run = async () => {
      patch(blockId, { uploading: true, failed: false });
      const up = await send().catch(() => null);
      if (up) { redo.current.delete(blockId); patch(blockId, { ...up, uploading: false, failed: false }); }
      else { redo.current.set(blockId, run); patch(blockId, { uploading: false, failed: true }); }
    };
    await run();
  };

  const addImage = async () => {
    setError(null);
    const picked = await pickImage().catch(() => null);
    if (!picked) return;
    const b = newBlock('image'); b.localUri = picked.uri; b.width = picked.width; b.height = picked.height;
    setBlocksAndSave((prev) => [...prev, b]);
    await attach(b.id, () => uploadImage(picked));
  };
  const addVideo = async () => {
    setError(null);
    const picked = await pickVideo().catch(() => null);
    if (!picked) return;
    const b = newBlock('video'); b.localUri = picked.thumbUri ?? picked.uri; b.durationSeconds = picked.durationSeconds;
    setBlocksAndSave((prev) => [...prev, b]);
    await attach(b.id, () => uploadVideo(picked));
  };
  const startVoice = async () => {
    setError(null);
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) { setError(tr.micNeeded); return; }
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch { setError(tr.uploadFailed); }
  };
  const stopVoice = async () => {
    try {
      const seconds = Math.round((recState.durationMillis ?? 0) / 1000);
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) return;
      const mime = Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4';
      const b = newBlock('voice'); b.localUri = uri; b.durationSeconds = seconds;
      setBlocksAndSave((prev) => [...prev, b]);
      await attach(b.id, () => uploadVoice(uri, mime, seconds));
    } catch { setError(tr.uploadFailed); }
  };

  const words = blocks
    .flatMap((b) => (b.type === 'list' ? (b.items ?? []) : [b.text ?? '']))
    .join(' ').trim().split(/\s+/).filter(Boolean).length;

  // The date and the length, said once at the top of the page instead of in a
  // footer bar. Both are facts about the page, not controls.
  const metaLine = `${(writtenAt ? new Date(writtenAt) : new Date()).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} · ${words} ${tr.words}`;

  const TOOLS: { type: BlockType; label: string; Icon: typeof Type; onPress: () => void }[] = [
    { type: 'text', label: tr.text, Icon: Type, onPress: () => addText('text') },
    { type: 'heading', label: tr.heading, Icon: HeadingIcon, onPress: () => addText('heading') },
    { type: 'list', label: tr.list, Icon: ListIcon, onPress: () => addText('list') },
    { type: 'quote', label: tr.quote, Icon: QuoteIcon, onPress: () => addText('quote') },
    { type: 'callout', label: tr.callout, Icon: Megaphone, onPress: () => addText('callout') },
    { type: 'video', label: tr.video, Icon: VideoIcon, onPress: addVideo },
    { type: 'link', label: tr.link, Icon: Link2, onPress: () => addText('link') },
    { type: 'image', label: tr.image, Icon: ImageIcon, onPress: addImage },
    { type: 'voice', label: tr.voice, Icon: Mic, onPress: startVoice },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: TT.bg }}>
      <StatusBar style="light" />
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* The bar. Dark and imageless, like the list it came from — and where
            the share state lives, because a state belongs with the chrome and
            not under the writing. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingVertical: 12 }}>
          <TouchableOpacity onPress={back} activeOpacity={0.7} style={darkCircleBtn}><ChevronLeft size={18} color="#fff" strokeWidth={2} /></TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            {mode === 'edit' && status === 'saved' && <Check size={13} color={TT.accent} strokeWidth={2.5} />}
            {mode === 'edit' && status !== 'idle' ? <MonoLabel color={TT.faint} size={9.5}>{status === 'saving' ? tr.saving : tr.saved.replace('{time}', savedAtLabel)}</MonoLabel> : null}
          </View>
          <View style={{ flex: 1 }} />
          {savedId && !entryIsEmpty(title, blocks) && (
            <ShareChip
              shared={shared} sharedAt={sharedAt} busy={sharing} face={face} locale={locale}
              copy={{ canRead: tr.canRead, private: tr.private, sharedOn: tr.sharedOn, onlyYou: tr.onlyYou, stopSharing: tr.stopSharing, shareWith: tr.shareWith }}
              onToggle={toggleShare}
            />
          )}
          {mode === 'read' && (
            <TouchableOpacity onPress={() => setMode('edit')} activeOpacity={0.7} style={darkCircleBtn}><Pencil size={16} color="#fff" strokeWidth={2} /></TouchableOpacity>
          )}
          <TouchableOpacity onPress={confirmDelete} activeOpacity={0.7} style={darkCircleBtn}><Trash2 size={16} color={TT.inkSoft} strokeWidth={2} /></TouchableOpacity>
        </View>

        {/* The paper. */}
        <View style={{ flex: 1, backgroundColor: TT.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: 'hidden' }}>

        {loaded && (mode === 'read' ? (
          <ReadView title={title} blocks={blocks} tr={tr} meta={metaLine} onOpenMedia={setViewingId} />
        ) : (
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            scrollEnabled={!drag.dragging}
          >
            <Text style={{ fontSize: 11.5, color: TT.faint, marginBottom: 8, paddingHorizontal: 4 }}>{metaLine}</Text>
            <TextInput
              value={title}
              onChangeText={onTitle}
              placeholder={tr.titlePlaceholder}
              placeholderTextColor={TT.faint}
              multiline
              style={[{ fontSize: 23, fontWeight: '800', color: TT.ink, letterSpacing: -0.4, marginBottom: 14, paddingHorizontal: 4 }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as never) : null]}
            />
            {blocks.map((b, i) => (
              <BlockRow key={b.id} block={b} tr={tr} first={i === 0} last={i === blocks.length - 1}
                onPatch={(p) => patch(b.id, p)} onRemove={() => removeBlock(b.id)} onUp={() => move(b.id, -1)} onDown={() => move(b.id, 1)}
                onRetry={redo.current.get(b.id)}
                onMeasure={(h) => drag.measure(i, h)}
                gripHandlers={drag.gripHandlers(i)}
                shift={drag.shiftOf(i)}
                lifted={drag.draggingIndex === i} />
            ))}
            {error && <Text style={{ color: '#DC2626', fontSize: 13, marginTop: 8, paddingHorizontal: 4 }}>{error}</Text>}
          </ScrollView>
        ))}

        {/* Recording bar OR the block toolbar — edit mode only */}
        {mode === 'edit' && (recording ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderTopColor: TT.line }}>
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: '#DC2626' }} />
            <Text style={{ fontSize: 14, fontWeight: '600', color: TT.ink }}>{tr.recording} {fmtDur(Math.round((recState.durationMillis ?? 0) / 1000))}</Text>
            <TouchableOpacity onPress={stopVoice} activeOpacity={0.85} style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#DC2626', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 }}>
              <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#fff' }} />
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{tr.stop}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ borderTopWidth: 1, borderTopColor: TT.line, paddingVertical: 8 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }} keyboardShouldPersistTaps="handled">
              {TOOLS.map(({ type, label, Icon, onPress }) => (
                <TouchableOpacity key={type} onPress={onPress} activeOpacity={0.8}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: TT.card, borderWidth: 1, borderColor: TT.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 }}>
                  <Icon size={15} color={TT.ink} strokeWidth={2} />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: TT.ink }}>{label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ))}

        </View>
      </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Everything on the page, so stepping in the viewer walks the page
          rather than showing one item in isolation. */}
      {viewingId ? (
        (() => {
          const shown: ViewerItem[] = blocks
            .filter((b) => (b.type === 'image' || b.type === 'video') && b.url)
            .map((b) => ({ kind: b.type === 'video' ? ('video' as const) : ('image' as const), url: b.url!, thumbnailUrl: b.localUri ?? null }));
          const at = blocks.filter((b) => (b.type === 'image' || b.type === 'video') && b.url).findIndex((b) => b.id === viewingId);
          if (at < 0 || shown.length === 0) return null;
          return (
            <MediaViewer
              items={shown}
              index={at}
              onIndex={(i) => setViewingId(blocks.filter((b) => (b.type === 'image' || b.type === 'video') && b.url)[i]?.id ?? null)}
              onClose={() => setViewingId(null)}
            />
          );
        })()
      ) : null}
    </View>
  );
}

const darkCircleBtn = { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' } as const;


type Tr = { [K in keyof (typeof T)['en']]: string };

// Multiline input that grows to its content height (native grows on its own;
// web needs this) and always spans the full width — no clipped box / overflow.
function AutoGrowInput({ value, onChange, placeholder, style }: { value: string; onChange: (v: string) => void; placeholder: string; style: object }) {
  const { t: TT } = useTheme();
  const [h, setH] = useState(0);
  const minH = (style as { lineHeight?: number }).lineHeight ?? 24;
  return (
    <TextInput
      value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={TT.faint} multiline
      onContentSizeChange={(e) => setH(e.nativeEvent.contentSize.height)}
      style={[{ color: TT.ink, padding: 0, width: '100%', height: Math.max(h, minH) }, style, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as never) : null]}
    />
  );
}

// Read-only rendering of an entry — the readable "journal" view (tap Edit to
// change). Plain Text flows and wraps naturally, so nothing is clipped.
function ReadView({ title, blocks, tr, meta, onOpenMedia }: { title: string; blocks: JournalBlock[]; tr: Tr; meta: string; onOpenMedia: (blockId: string) => void }) {
  const { t: TT } = useTheme();
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <Text style={{ fontSize: 11.5, color: TT.faint, marginBottom: 8 }}>{meta}</Text>
      {title.trim() ? <Text style={{ fontSize: 24, fontWeight: '800', color: TT.ink, letterSpacing: -0.4, marginBottom: 18 }}>{title}</Text> : null}
      <View style={{ gap: 16 }}>{blocks.map((b) => <ReadBlock key={b.id} block={b} tr={tr} onOpenMedia={onOpenMedia} />)}</View>
    </ScrollView>
  );
}

function ReadBlock({ block: b, tr, onOpenMedia }: { block: JournalBlock; tr: Tr; onOpenMedia?: (blockId: string) => void }) {
  const { t: TT } = useTheme();
  switch (b.type) {
    case 'heading': return <Text style={{ fontSize: 19, fontWeight: '800', color: TT.ink, letterSpacing: -0.3 }}>{b.text}</Text>;
    case 'text': return <Text style={{ fontSize: 16, lineHeight: 27, color: TT.inkSoft }}>{b.text}</Text>;
    case 'quote': return <View style={{ borderLeftWidth: 3, borderLeftColor: TT.accent, paddingLeft: 14 }}><Text style={{ fontSize: 16, lineHeight: 26, fontStyle: 'italic', color: TT.inkSoft }}>{b.text}</Text></View>;
    case 'callout': return <View style={{ backgroundColor: TT.accentTint, borderRadius: 16, padding: 16 }}><Text style={{ fontSize: 15.5, lineHeight: 25, color: TT.ink }}>{b.text}</Text></View>;
    case 'list': return (
      <View style={{ gap: 8 }}>
        {(b.items ?? []).map((it, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
            <Text style={{ fontSize: 16, color: TT.accent, lineHeight: 25 }}>{b.ordered ? `${i + 1}.` : '•'}</Text>
            <Text style={{ flex: 1, fontSize: 16, lineHeight: 25, color: TT.inkSoft }}>{it}</Text>
          </View>
        ))}
      </View>
    );
    case 'link': return (
      <TouchableOpacity onPress={() => b.url && openLink(b.url)} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Link2 size={16} color={TT.accent} /><Text style={{ fontSize: 15.5, fontWeight: '600', color: TT.accent }}>{b.label || b.url}</Text>
      </TouchableOpacity>
    );
    case 'voice':
      // Plays where it sits. Nothing to look at, so nothing to open.
      return b.url ? (
        <AudioRow url={b.url} durationSeconds={b.durationSeconds} label={tr.voiceNote} />
      ) : (
        <MediaBlock block={b} tr={tr} />
      );
    case 'image': case 'video':
      return <TouchableOpacity activeOpacity={0.9} disabled={!b.url} onPress={() => b.url && onOpenMedia?.(b.id)}><MediaBlock block={b} tr={tr} /></TouchableOpacity>;
    default: return null;
  }
}

function BlockRow({ block: b, tr, first, last, onPatch, onRemove, onUp, onDown, onRetry, onMeasure, gripHandlers, shift, lifted }: {
  block: JournalBlock; tr: Tr; first: boolean; last: boolean;
  onPatch: (p: Partial<JournalBlock>) => void; onRemove: () => void; onUp: () => void; onDown: () => void;
  onRetry?: () => Promise<void>;
  onMeasure: (height: number) => void;
  gripHandlers: object;
  shift: number;
  lifted: boolean;
}) {
  const { t: TT } = useTheme();
  const menu = useAnchoredMenu();
  // Multiline text grows to fit its content (fixes the tiny fixed-height box +
  // horizontal overflow on web); single-line inputs stay plain.
  const input = (extra: object, value: string, onChange: (v: string) => void, placeholder: string, multiline = true) =>
    multiline ? (
      <AutoGrowInput value={value} onChange={onChange} placeholder={placeholder} style={extra} />
    ) : (
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={TT.faint}
        style={[{ color: TT.ink, padding: 0 }, extra, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as never) : null]} />
    );

  let content: React.ReactNode = null;
  if (b.type === 'text') content = input({ fontSize: 15.5, lineHeight: 26, color: TT.inkSoft }, b.text ?? '', (v) => onPatch({ text: v }), tr.writePlaceholder);
  else if (b.type === 'heading') content = input({ fontSize: 19, fontWeight: '800', letterSpacing: -0.3 }, b.text ?? '', (v) => onPatch({ text: v }), tr.headingPlaceholder);
  else if (b.type === 'quote') content = (
    <View style={{ borderLeftWidth: 3, borderLeftColor: TT.accent, paddingLeft: 12 }}>
      {input({ fontSize: 15.5, lineHeight: 25, fontStyle: 'italic', color: TT.inkSoft }, b.text ?? '', (v) => onPatch({ text: v }), tr.quotePlaceholder)}
    </View>
  );
  else if (b.type === 'callout') content = (
    <View style={{ backgroundColor: TT.accentTint, borderRadius: 14, padding: 14 }}>
      {input({ fontSize: 15, lineHeight: 24, color: TT.ink }, b.text ?? '', (v) => onPatch({ text: v }), tr.calloutPlaceholder)}
    </View>
  );
  else if (b.type === 'list') content = (
    <View style={{ gap: 8 }}>
      {(b.items ?? ['']).map((it, idx) => (
        <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: TT.accent, marginTop: 9 }} />
          <View style={{ flex: 1 }}>
            {input({ fontSize: 15.5, lineHeight: 24 }, it, (v) => onPatch({ items: (b.items ?? []).map((x, k) => (k === idx ? v : x)) }), tr.itemPlaceholder, false)}
          </View>
          {(b.items?.length ?? 0) > 1 && (
            <TouchableOpacity onPress={() => onPatch({ items: (b.items ?? []).filter((_, k) => k !== idx) })} hitSlop={8}><X size={14} color={TT.faint} /></TouchableOpacity>
          )}
        </View>
      ))}
      <TouchableOpacity onPress={() => onPatch({ items: [...(b.items ?? []), ''] })} activeOpacity={0.7} style={{ marginLeft: 16 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: TT.accent }}>+ {tr.addItem}</Text>
      </TouchableOpacity>
    </View>
  );
  else if (b.type === 'link') content = (
    <View style={{ backgroundColor: TT.card, borderWidth: 1, borderColor: TT.line, borderRadius: 12, padding: 12, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Link2 size={15} color={TT.accent} />
        {input({ fontSize: 14.5, color: TT.ink, flex: 1 }, b.url ?? '', (v) => onPatch({ url: v }), tr.linkUrl, false)}
      </View>
      {input({ fontSize: 13.5, color: TT.inkSoft }, b.label ?? '', (v) => onPatch({ label: v }), tr.linkLabel, false)}
    </View>
  );
  else if (isMedia(b.type)) content = <MediaBlock block={b} tr={tr} />;

  // Up, down and delete used to sit under EVERY block, so a page of writing
  // read as a stack of controls. One quiet handle carries all three instead,
  // and a failed upload puts its way out at the top of the same menu.
  const actions = [
    ...(onRetry ? [{ key: 'retry', label: tr.retry, color: TT.accent, Icon: RotateCw, onPress: () => { void onRetry(); } }] : []),
    { key: 'up', label: tr.moveUp, Icon: ChevronUp, disabled: first, onPress: onUp },
    { key: 'down', label: tr.moveDown, Icon: ChevronDown, disabled: last, onPress: onDown },
    { key: 'del', label: tr.delete, color: '#B4443A', Icon: Trash2, onPress: onRemove },
  ];

  return (
    <View
      onLayout={(e) => onMeasure(e.nativeEvent.layout.height)}
      style={{
        marginBottom: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 4,
        transform: [{ translateY: shift }],
        // The dragged row rides above the rest and casts a shadow, so it reads
        // as picked up rather than as the page having gone wrong.
        zIndex: lifted ? 10 : 0,
        ...(lifted
          ? { backgroundColor: TT.card, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 }
          : null),
      }}
    >
      <View style={{ flex: 1 }}>{content}</View>
      {/* Grip and menu: one thing to move the block with, one for everything
          else. The menu keeps Move up / Move down, which is the way through for
          anyone not dragging. */}
      <View
        {...gripHandlers}
        style={[{ width: 24, height: 30, alignItems: 'center', justifyContent: 'center', marginTop: 2 }, { userSelect: 'none', cursor: 'grab' } as never]}
      >
        <GripVertical size={15} color={lifted ? TT.accent : TT.faint} strokeWidth={2} />
      </View>
      <TouchableOpacity
        ref={menu.ref}
        onPress={menu.show}
        hitSlop={8}
        style={{ width: 24, height: 30, alignItems: 'center', justifyContent: 'center', marginTop: 2 }}
      >
        <MoreHorizontal size={15} color={b.failed ? '#B4443A' : TT.faint} strokeWidth={2} />
      </TouchableOpacity>
      <AnchoredMenu open={menu.open} anchor={menu.anchor} onClose={menu.hide} actions={actions} />
    </View>
  );
}

function MediaBlock({ block: b, tr }: { block: JournalBlock; tr: Tr }) {
  const { t: TT } = useTheme();
  const uri = b.url ?? b.localUri ?? null;
  if (b.type === 'voice') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: TT.accentTint, borderRadius: 14, padding: 14 }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: TT.accent, alignItems: 'center', justifyContent: 'center' }}>
          {b.uploading ? <ActivityIndicator size="small" color="#fff" /> : <Play size={16} color="#fff" fill="#fff" />}
        </View>
        <Text style={{ fontSize: 15, fontWeight: '600', color: TT.ink }}>{tr.voiceNote}{b.durationSeconds ? ` · ${fmtDur(b.durationSeconds)}` : ''}</Text>
        {b.failed && <Text style={{ marginLeft: 'auto', fontSize: 12, color: '#DC2626' }}>{tr.uploadFailed}</Text>}
      </View>
    );
  }
  // image / video
  return (
    <View style={{ borderRadius: 14, overflow: 'hidden', backgroundColor: TT.slot }}>
      {uri ? <Image source={{ uri }} style={{ width: '100%', height: 200 }} resizeMode="cover" /> : <View style={{ width: '100%', height: 200 }} />}
      {b.type === 'video' && !b.uploading && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}><Play size={22} color="#fff" fill="#fff" /></View>
        </View>
      )}
      {b.uploading && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' }}><ActivityIndicator color="#fff" /></View>
      )}
      {b.failed && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}><Text style={{ color: '#fff', fontSize: 13 }}>{tr.uploadFailed}</Text></View>
      )}
    </View>
  );
}
