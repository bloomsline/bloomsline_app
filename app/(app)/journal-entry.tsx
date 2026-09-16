// A journal page — reading and writing. An entry is an ordered list of blocks
// (text/heading/list/quote/callout/link + image/video/voice). SAVES AS YOU GO
// (debounced autosave). New entries are created on first real content; existing
// ones are patched. Media uploads straight to storage via the journal presign.
//
// The chrome matches the list: a dark bar with no photograph over light paper.
// Sharing lives in that bar as a chip that names WHO can read the page, rather
// than as a verb under the writing — see ShareChip for why.
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Keyboard, KeyboardAvoidingView, Linking, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAudioRecorder, useAudioRecorderState, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import {
  ChevronLeft, Check, Trash2, Type, Heading as HeadingIcon, List as ListIcon, Quote as QuoteIcon,
  Megaphone, Link2, Image as ImageIcon, Video as VideoIcon, Mic, Play, ChevronUp, ChevronDown, X,
  Pencil, MoreHorizontal, RotateCw, GripVertical,
} from 'lucide-react-native';
import { HEADER_TOP, Kicker } from '@/src/ui/editorial';
import { ShareChip } from '@/src/journal/ShareChip';
import { ShareRefused } from '@/src/api/share-refused';
import { AnchoredMenu, useAnchoredMenu } from '@/src/ui/AnchoredMenu';
import { AudioRow, MediaViewer, type ViewerItem } from '@/src/ui/MediaViewer';
import { useBlockDrag } from '@/src/journal/useBlockDrag';
import { usePractitionerFace } from '@/src/care/practitioner-face';
import { useSelectedPractitioner } from '@/src/care/selected-practitioner';
import { otherReaders } from '@/src/care/other-readers';
import { useOnboarding } from '@/src/onboarding/context';
import { createJournal, deleteJournal, getJournal, shareJournal, updateJournal } from '@/src/api/journal';
import { newBlock, serializeForSave, entryIsEmpty, isMedia, mediaSource, normalizeLink, posterSource, type BlockType, type JournalBlock } from '@/src/journal/blocks';
import { useKeepInView } from '@/src/journal/useKeepInView';
import { useLeaveGuard } from '@/src/ui/leave-guard';
import { pickImage, pickVideo, uploadImage, uploadVideo, uploadVoice } from '@/src/journal/media';
import { useConfirm } from '@/src/ui/confirm';
import { useI18n } from '@/src/i18n';
import { track } from '@/src/analytics/client';
import { useTheme } from '@/src/ui/theme-mode';
import { OVER_MEDIA, RECORD, veil } from '@/src/ui/tokens';
import { useStaleOnReturn } from '@/src/ui/use-stale-on-return';
import { VOICE_RECORDING, recordedMime } from '@/src/audio/recording';
import { trackJournalWrite } from '@/src/journal/pending-writes';
import { clearUnsent, readUnsent, saveUnsent } from '@/src/unsent';

/** A LINK is not media: it belongs in a browser, and always did. */
const openLink = (url: string) =>
  Platform.OS === 'web' ? globalThis.open?.(url, '_blank') : Linking.openURL(url).catch(() => {});

type Status = 'idle' | 'saving' | 'saved' | 'failed';

/** What is kept on the phone for a page not yet saved (see src/unsent). */
type UnsentPage = { title: string; blocks: JournalBlock[] };
/** Blocks worth keeping: everything but media that never finished uploading,
 *  whose file on the phone may not outlive the app. Upload state is dropped. */
const forBackup = (bs: JournalBlock[]): JournalBlock[] =>
  bs.filter((b) => !isMedia(b.type) || Boolean(b.storageKey)).map(({ uploading: _u, failed: _f, localUri: _l, localThumbUri: _t, ...b }) => b);

/** How long to wait before trying a failed save again, on its own. */
const RETRY_MS = 8000;

const T = {
  en: {
    saving: 'Saving…', saved: 'Saved {time}', notSaved: 'Not saved', save: 'Save', saveError: 'Could not save. Check your connection and try again.', titlePlaceholder: 'Title', words: 'words',
    moveUp: 'Move up', moveDown: 'Move down', retry: 'Try again',
    confirmWeb: 'Delete this entry?', deleteTitle: 'Delete entry', deleteMessage: 'This can’t be undone.', cancel: 'Cancel', delete: 'Delete',
    text: 'Text', heading: 'Heading', list: 'List', quote: 'Quote', callout: 'Callout', video: 'Video', link: 'Link', image: 'Image', voice: 'Voice',
    writePlaceholder: 'Start writing…', headingPlaceholder: 'Heading', quotePlaceholder: 'Quote', calloutPlaceholder: 'Callout', itemPlaceholder: 'List item',
    addItem: 'Add item', linkUrl: 'https://…', linkLabel: 'Link text (optional)', recording: 'Recording…', stop: 'Stop', tapRecord: 'Tap to record a voice note', uploadFailed: 'Upload failed', mediaUnavailable: 'Media unavailable', micNeeded: 'Microphone access is needed.', voiceNote: 'Voice note',
    shareError: 'Could not update sharing. Please try again.',
    noPractitioner: 'You are not linked to a practitioner right now, so there is no one to share this with.',
    loadError: 'Could not open this page. Check your connection and try again.',
    videoTooLarge: 'This video is too large to add (over 100 MB). Try a shorter clip.',
    restored: 'We restored writing from this page that had not been saved. It is being saved now.',
    deleteError: 'Could not delete this page. Check your connection and try again.',
    unsavedTitle: 'This page is not saved', unsavedBody: 'Your latest changes have not reached the server. If you leave now, they will be lost.',
    uploadingBody: 'A photo, video or voice note is still uploading. If you leave now, it will not be kept.',
    stay: 'Stay', leaveAnyway: 'Leave anyway',
    canRead: '{name} can read this', canReadMany: '{name} can read this', private: 'Private', sharedOn: 'Shared {date}',
    onlyYou: 'Only you can read this.', stopSharing: 'Stop sharing', shareWith: 'Share with {name}',
    sharedElsewhere: 'Shared with {names}', alsoWith: 'Also shared with {names}.', notYet: '{name} can’t read this.', stopSharingWith: 'Stop sharing with {name}',
  },
  fr: {
    saving: 'Enregistrement…', saved: 'Enregistré à {time}', notSaved: 'Non enregistré', save: 'Enregistrer', saveError: 'Enregistrement impossible. Vérifiez votre connexion et réessayez.', titlePlaceholder: 'Titre', words: 'mots',
    moveUp: 'Monter', moveDown: 'Descendre', retry: 'Réessayer',
    confirmWeb: 'Supprimer cette entrée ?', deleteTitle: 'Supprimer l’entrée', deleteMessage: 'Cette action est irréversible.', cancel: 'Annuler', delete: 'Supprimer',
    text: 'Texte', heading: 'Titre', list: 'Liste', quote: 'Citation', callout: 'Encart', video: 'Vidéo', link: 'Lien', image: 'Image', voice: 'Vocal',
    writePlaceholder: 'Commencez à écrire…', headingPlaceholder: 'Titre', quotePlaceholder: 'Citation', calloutPlaceholder: 'Encart', itemPlaceholder: 'Élément',
    addItem: 'Ajouter', linkUrl: 'https://…', linkLabel: 'Texte du lien (facultatif)', recording: 'Enregistrement…', stop: 'Arrêter', tapRecord: 'Appuyez pour enregistrer un vocal', uploadFailed: 'Échec de l’envoi', mediaUnavailable: 'Média indisponible', micNeeded: 'L’accès au micro est nécessaire.', voiceNote: 'Note vocale',
    shareError: 'Impossible de mettre à jour le partage. Réessayez.',
    noPractitioner: 'Vous n’êtes lié à aucun praticien pour le moment, il n’y a donc personne avec qui partager.',
    loadError: 'Impossible d’ouvrir cette page. Vérifiez votre connexion et réessayez.',
    videoTooLarge: 'Cette vidéo est trop lourde (plus de 100 Mo). Essayez un extrait plus court.',
    restored: 'Nous avons restauré des modifications de cette page qui n’avaient pas été enregistrées. Elles sont en cours d’enregistrement.',
    deleteError: 'Impossible de supprimer cette page. Vérifiez votre connexion et réessayez.',
    unsavedTitle: 'Cette page n’est pas enregistrée', unsavedBody: 'Vos dernières modifications ne sont pas arrivées sur le serveur. Si vous partez maintenant, elles seront perdues.',
    uploadingBody: 'Une photo, une vidéo ou un vocal est encore en cours d’envoi. Si vous partez maintenant, il ne sera pas conservé.',
    stay: 'Rester', leaveAnyway: 'Partir quand même',
    canRead: '{name} peut la lire', canReadMany: '{name} peuvent la lire', private: 'Privé', sharedOn: 'Partagée le {date}',
    onlyYou: 'Vous seul pouvez la lire.', stopSharing: 'Ne plus partager', shareWith: 'Partager avec {name}',
    sharedElsewhere: 'Partagée avec {names}', alsoWith: 'Aussi partagée avec {names}.', notYet: '{name} ne peut pas la lire.', stopSharingWith: 'Ne plus partager avec {name}',
  },
} as const;

const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

export default function JournalEntry() {
  const { t: TT, mode: theme } = useTheme();
  const router = useRouter();
  const { locale } = useI18n();
  const confirm = useConfirm();
  const tr = T[locale];
  const { id: paramId, fresh } = useLocalSearchParams<{ id?: string; fresh?: string }>();

  const [title, setTitle] = useState('');
  const [blocks, setBlocks] = useState<JournalBlock[]>([{ ...newBlock('text') }]);
  const [status, setStatus] = useState<Status>('idle');
  // "Saved" alone says nothing you did not already assume. The clock time says
  // which version is safe, which is the thing anyone actually wants to know.
  const [savedAtLabel, setSavedAtLabel] = useState('');
  /** Which media block is open full screen, by block id. */
  /**
   * The viewer's contents, FROZEN at the moment something was tapped.
   *
   * It used to be derived from `blocks` on every render, and the editor
   * re-renders constantly — autosave, the recorder's status, a keystroke. Every
   * one of those rebuilt the item list, and a video whose url changed when its
   * upload landed had the player released and rebuilt underneath it. Press play,
   * it stops. Press play, it stops. Read mode never re-renders like that, which
   * is exactly why it played fine there and nowhere else.
   *
   * A snapshot cannot be disturbed by any of it. The cost is that a video is
   * played from the copy it was opened with: close and reopen to pick up the
   * uploaded one, which is invisible in practice.
   */
  const [viewer, setViewer] = useState<{ items: ViewerItem[]; index: number } | null>(null);
  const [loaded, setLoaded] = useState(false);
  // An existing page whose content could not be read. Distinct from an empty
  // page: see `load`.
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(typeof paramId === 'string' ? paramId : null);
  const [shared, setShared] = useState(false);
  const [sharedAt, setSharedAt] = useState<string | null>(null);
  // Who can read the page now, once shared (see MomentDetail). Undefined: the
  // server did not say, so today's practitioners are named as before.
  const [readers, setReaders] = useState<string[] | undefined>(undefined);
  const [readerIds, setReaderIds] = useState<string[] | undefined>(undefined);
  // The day the page was started. A new page has none yet, and today is then
  // the honest answer rather than a guess.
  const [writtenAt, setWrittenAt] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  // Existing entries open READ-ONLY (tap Edit to change); new ones open in edit.
  // `fresh` marks a page created a moment ago by the journal list, which has to
  // open in edit: it has an id like any other page, so the id alone cannot tell
  // "opened to read" apart from "just made, start writing".
  const [mode, setMode] = useState<'read' | 'edit'>(typeof paramId === 'string' && fresh !== '1' ? 'read' : 'edit');

  // How to redo a failed upload, kept per block. The picked asset never reaches
  // the block model — only the finished storage key does — so without this a
  // failure could only ever be reported, never undone.
  const redo = useRef(new Map<string, () => Promise<void>>());
  const idRef = useRef<string | null>(typeof paramId === 'string' ? paramId : null);
  const latest = useRef({ title: '', blocks: [] as JournalBlock[] });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Saves run one after another, never side by side. See `doSave`.
  const saveChain = useRef<Promise<boolean>>(Promise.resolve(true));
  const mounted = useRef(true);
  /**
   * What has changed, counted. Every edit bumps `edits`; a save that lands
   * records the count it carried in `savedEdits`. Equal means nothing to save.
   *
   * Without it, leaving saved the page whatever had happened — reading an old
   * page and going back re-saved it, which moved it to the top of the list as
   * "Today" and wrote this phone's copy over anything edited elsewhere since.
   */
  const edits = useRef(0);
  const savedEdits = useRef(0);
  // The page was read from the server (or is new). Until then there is nothing
  // it would be safe to save over.
  const loadOk = useRef(typeof paramId !== 'string');
  // Deleted: nothing may save it back, including an upload finishing later.
  const deleted = useRef(false);

  const face = usePractitionerFace();
  const { practitionerName, practitionerNames, hasPractitioner } = useOnboarding();
  const pracNames = practitionerNames.length ? practitionerNames : practitionerName ? [practitionerName] : [];
  const { canSwitch, selectionKey, selectedId } = useSelectedPractitioner();

  const keep = useKeepInView();

  const recorder = useAudioRecorder(VOICE_RECORDING);
  const recState = useAudioRecorderState(recorder);
  const recording = recState.isRecording;

  /**
   * Read the page. A page that could not be read is NOT shown as blank.
   *
   * It was: `getJournal` returned null on a dropped connection, the editor
   * opened empty, and the first word typed was autosaved over the real entry —
   * the id was still there, so the save replaced everything the page held.
   * Now a failed read says so, offers a retry, and nothing can be saved until
   * the page has actually been read.
   */
  const load = async (alive: () => boolean = () => mounted.current) => {
    if (!idRef.current) { setLoaded(true); return; }
    setLoadFailed(false);
    const e = await getJournal(idRef.current);
    if (!alive()) return;
    if (!e) { setLoadFailed(true); setLoaded(true); return; }
    // Writing kept on this phone that never reached the server — newer than
    // what the server has — comes back, in edit mode, and is sent again.
    const kept = await readUnsent<UnsentPage>('journal', idRef.current);
    if (!alive()) return;
    const restore = kept && new Date(kept.savedAt).getTime() > new Date(e.updatedAt).getTime() ? kept.payload : null;
    if (kept && !restore) void clearUnsent('journal', idRef.current);
    const serverBlocks = e.blocks && e.blocks.length ? e.blocks : [{ ...newBlock('text') }];
    const bs = restore && restore.blocks.length ? restore.blocks : serverBlocks;
    const restoredTitle = restore ? restore.title : (e.title ?? '');
    setTitle(restoredTitle);
    setBlocks(bs);
    setShared(e.sharedWithPractitioner ?? false);
    setSharedAt(e.sharedWithPractitionerAt ?? null);
    setReaders(e.sharedWith);
    setReaderIds(e.sharedWithIds);
    setWrittenAt(e.createdAt ?? null);
    latest.current = { title: restoredTitle, blocks: bs };
    loadOk.current = true;
    stale.markFresh();
    setLoaded(true);
    if (restore) {
      setMode('edit');
      setError(tr.restored);
      edits.current += 1;
      schedule();
    }
  };

  useEffect(() => {
    let alive = true;
    void load(() => alive);
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on open
  }, []);

  // A switch of practitioner changes what the chip is about: "shared" means
  // shared with the one selected. Read the share state again, and ONLY that —
  // a full `load` replaces the writing on screen, which must never happen to
  // someone mid-sentence just because they changed practitioner elsewhere.
  const shareReadFor = useRef(selectionKey);
  useEffect(() => {
    if (shareReadFor.current === selectionKey) return;
    shareReadFor.current = selectionKey;
    const id = idRef.current;
    if (!id || !loadOk.current) return;
    let alive = true;
    void getJournal(id).then((e) => {
      if (!alive || !e || !mounted.current) return;
      setShared(e.sharedWithPractitioner ?? false);
      setSharedAt(e.sharedWithPractitionerAt ?? null);
      setReaders(e.sharedWith);
      setReaderIds(e.sharedWithIds);
    });
    return () => { alive = false; };
  }, [selectionKey]);

  // A page left open for a long time: its photo, video and voice links have
  // expired. Read it again — but only with nothing unsaved on it, since a read
  // replaces what is on screen.
  const stale = useStaleOnReturn(() => {
    if (!loadOk.current || !idRef.current || edits.current !== savedEdits.current || deleted.current) return;
    if (latest.current.blocks.some((b) => b.uploading)) return;
    void load();
  });

  /**
   * One save of the page as it stands. True when the server has it.
   *
   * It used to say "Saved" whatever happened: `updateJournal` and
   * `createJournal` report a failure by returning false / null rather than
   * throwing, and nothing looked. Offline, or during a bad deploy, the corner
   * read "Saved 15:21" over writing that existed only on the phone.
   */
  const saveOnce = async (): Promise<boolean> => {
    if (deleted.current || !loadOk.current) return true;
    const carried = edits.current;
    if (carried === savedEdits.current) {
      // Nothing new to send. A "Saving…" set by Save or by a retry must not
      // outlive that, or the leave guard would keep holding the screen.
      if (mounted.current) setStatus((st) => (st === 'saving' || st === 'failed' ? (savedEdits.current > 0 ? 'saved' : 'idle') : st));
      return true;
    }
    const { title: tt, blocks: bs } = latest.current;
    // An empty page that was never saved is not worth creating. An EXISTING page
    // emptied on purpose is a change like any other: skipping it brought the old
    // text back the next time the page opened.
    if (!idRef.current && entryIsEmpty(tt, bs)) { savedEdits.current = carried; if (mounted.current) setStatus('idle'); return true; }
    const payload = { title: tt.trim() || null, blocks: serializeForSave(bs) };
    let ok: boolean;
    if (idRef.current) {
      // A copy on the phone first, so writing survives the app being killed
      // before the server has it (see src/unsent). Removed once it lands.
      const pageId = idRef.current;
      await saveUnsent<UnsentPage>('journal', pageId, { title: tt, blocks: forBackup(bs) });
      ok = await updateJournal(pageId, payload);
      if (ok && edits.current === carried) void clearUnsent('journal', pageId);
    } else {
      const created = await createJournal(payload);
      ok = Boolean(created);
      // The FIRST save of a page opened blank — a page started from the journal
      // list is counted there, so this is the other way in and not a duplicate.
      if (created) { track('journal_page_created', { from: 'editor' }); idRef.current = created.id; if (mounted.current) setSavedId(created.id); }
    }
    if (ok) savedEdits.current = Math.max(savedEdits.current, carried);
    if (!mounted.current) return ok;
    if (ok) {
      if (retryTimer.current) clearTimeout(retryTimer.current);
      setSavedAtLabel(new Date().toLocaleTimeString(locale === 'fr' ? 'fr-FR' : 'en-GB', { hour: '2-digit', minute: '2-digit' }));
      // Another edit may have arrived while this one travelled; that one is
      // still on its way, and the corner should not claim otherwise.
      setStatus(edits.current === savedEdits.current ? 'saved' : 'saving');
      setError((e) => (e === tr.saveError ? null : e));
    } else {
      setStatus('failed');
      // Try again on its own, so a dropped connection that comes back is
      // caught up without anyone having to notice. A new keystroke replaces
      // this with its own save (see `schedule`).
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = setTimeout(() => { void doSave(); }, RETRY_MS);
    }
    return ok;
  };

  /**
   * Saves QUEUE. Each waits for the one before it and then reads the page as it
   * is by then. Side by side, two saves of a page not yet on the server were two
   * creates: on a slow connection the autosave fired again before the first
   * create had answered, `idRef` was still empty, and the patient got the same
   * entry twice.
   */
  const doSave = (): Promise<boolean> => {
    const next = saveChain.current.then(saveOnce, saveOnce).catch(() => {
      if (mounted.current) setStatus('failed');
      return false;
    });
    saveChain.current = next;
    return next;
  };

  // No confirmation sheet in either direction: opening the chip's menu IS the
  // deliberate act, and the menu already names the state and the one thing you
  // can do about it. A sheet on top of that asks a question about a question.
  const toggleShare = async (next: boolean) => {
    if (!savedId || sharing) return;
    setSharing(true); setShared(next);
    try {
      const res = await shareJournal(savedId, next);
      track(res.shared ? 'journal_shared' : 'journal_unshared', { from: 'editor' });
      setShared(res.shared);
      setSharedAt(res.sharedAt);
      // Everyone who can read it now, shared with the selected one or not: after
      // stopping for them, another practitioner may still be reading it.
      setReaders(res.sharedWith);
      setReaderIds(res.sharedWithIds);
    } catch (err) {
      setShared(!next);
      setError(err instanceof ShareRefused ? tr.noPractitioner : tr.shareError);
    } finally {
      setSharing(false);
    }
  };

  /**
   * Save this instant, and say so.
   *
   * The page already saves as you go, but a timestamp in the corner is a fact,
   * not a reassurance — several people read "Enregistré à 15:21" and still went
   * looking for a save button before leaving the page. So there is one, and it
   * does exactly what it promises: flush whatever is pending, then hand the
   * page back in reading mode, which is itself the confirmation that there is
   * nothing left to type.
   */
  const saveNow = async () => {
    if (timer.current) clearTimeout(timer.current);
    if (retryTimer.current) clearTimeout(retryTimer.current);
    setStatus('saving');
    // Reading mode only once the server has the page. Handing it back as if it
    // were done, when it is not, was the same untruth as the corner label.
    if (await doSave()) {
      if (mounted.current) { setMode('read'); Keyboard.dismiss(); }
    } else if (mounted.current) {
      setError(tr.saveError);
    }
  };

  const schedule = () => {
    setStatus('saving');
    if (timer.current) clearTimeout(timer.current);
    if (retryTimer.current) clearTimeout(retryTimer.current);
    timer.current = setTimeout(() => { void doSave(); }, 1000);
  };

  // Commit both state + the autosave ref, then schedule a save.
  const commit = (nextTitle: string, nextBlocks: JournalBlock[]) => {
    if (deleted.current) return;
    latest.current = { title: nextTitle, blocks: nextBlocks };
    edits.current += 1;
    schedule();
  };
  const setBlocksAndSave = (updater: (prev: JournalBlock[]) => JournalBlock[]) => {
    // `latest.current.title`, not `|| title`: an empty title is a title. The
    // fallback put back a title cleared while an upload was running.
    setBlocks((prev) => { const next = updater(prev); commit(latest.current.title, next); return next; });
  };
  const onTitle = (v: string) => { setTitle(v); commit(v, latest.current.blocks.length ? latest.current.blocks : blocks); };

  useEffect(() => {
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
      if (retryTimer.current) clearTimeout(retryTimer.current);
      // A page made by "New page" and left with nothing on it is removed, not
      // kept. The list creates the page before the editor opens, so backing out
      // without writing left a blank "Untitled" in the list for good.
      const { title: tt, blocks: bs } = latest.current;
      if (fresh === '1' && idRef.current && loadOk.current && !deleted.current && entryIsEmpty(tt, bs) && !bs.some((b) => b.uploading)) {
        trackJournalWrite(deleteJournal(idRef.current));
        void clearUnsent('journal', idRef.current);
        return;
      }
      trackJournalWrite(doSave());
    };
  }, []);

  /** Tapping a picture or a video: take the list as it stands, and open on it.
   *
   *  The player gets the FILE — the one on the phone while it exists, which is
   *  also what lets a video play while it is still uploading. It used to get
   *  `url ?? localUri`, and for a video just picked `localUri` held the poster
   *  JPEG and `url` never arrived (the upload returns a key, not an address).
   *  So the viewer was asked to play a still image: controls, and nothing
   *  behind them. Every fix to the player's re-rendering missed that. */
  const openMedia = (blockId: string) => {
    const playable = (b: JournalBlock) => (b.type === 'image' || b.type === 'video') && Boolean(mediaSource(b));
    const list = latest.current.blocks.filter(playable);
    const at = list.findIndex((b) => b.id === blockId);
    if (at < 0) return;
    setViewer({
      index: at,
      items: list.map((b) => ({ kind: b.type === 'video' ? ('video' as const) : ('image' as const), url: mediaSource(b)!, thumbnailUrl: b.type === 'video' ? posterSource(b) : null })),
    });
  };

  const back = () => (router.canGoBack() ? router.back() : router.navigate('/journal' as never));

  const uploading = blocks.some((b) => b.uploading);
  /**
   * Leaving with writing that has not landed. Anything still waiting is saved
   * first and the page then closes on its own; only when that save fails (or a
   * file is mid-upload) does it ask. It used to try one save as the screen
   * unmounted and say nothing when that failed too.
   */
  const guard = useLeaveGuard(status === 'saving' || status === 'failed' || uploading, async (leave) => {
    if (timer.current) clearTimeout(timer.current);
    if (retryTimer.current) clearTimeout(retryTimer.current);
    const saved = await doSave();
    const stillUploading = latest.current.blocks.some((b) => b.uploading);
    if (saved && !stillUploading) { leave(); return; }
    const yes = await confirm({
      title: tr.unsavedTitle,
      message: stillUploading && saved ? tr.uploadingBody : tr.unsavedBody,
      confirmLabel: tr.leaveAnyway, cancelLabel: tr.stay, destructive: true,
    });
    if (yes) leave();
  });

  const remove = async () => {
    if (timer.current) clearTimeout(timer.current);
    if (retryTimer.current) clearTimeout(retryTimer.current);
    // A delete that did not happen is not a delete. The screen used to close
    // either way, leaving the page in the list and, if it was shared, still
    // readable by the practitioner.
    if (idRef.current && !(await deleteJournal(idRef.current))) { setError(tr.deleteError); return; }
    if (idRef.current) void clearUnsent('journal', idRef.current);
    deleted.current = true;
    idRef.current = null;
    latest.current = { title: '', blocks: [] };
    guard.release();
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
  /** A new block takes the cursor, so writing continues where it was added. */
  const focusKeyOf = (b: JournalBlock) => (b.type === 'list' ? `${b.id}:0` : b.type === 'link' ? `${b.id}:url` : b.id);
  const addText = (type: BlockType) => {
    const b = newBlock(type);
    keep.focusSoon(focusKeyOf(b));
    setBlocksAndSave((prev) => [...prev, b]);
  };
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
    const picked = await pickVideo().catch((e: unknown) => {
      if (e instanceof Error && e.message === 'too_large') setError(tr.videoTooLarge);
      return null;
    });
    if (!picked) return;
    // The video in `localUri`, its poster in `localThumbUri`. This line once put
    // the poster where the video goes, and that was the video that would not play.
    const b = newBlock('video'); b.localUri = picked.uri; b.localThumbUri = picked.thumbUri; b.durationSeconds = picked.durationSeconds;
    setBlocksAndSave((prev) => [...prev, b]);
    await attach(b.id, () => uploadVideo(picked));
  };
  const startVoice = async () => {
    setError(null);
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) { setError(tr.micNeeded); return; }
      // The same two lines Capture needed, and for the same reasons: iOS will
      // not record until the audio SESSION allows it, and `playsInSilentMode`
      // is what stops the note you just recorded being silent on a phone with
      // the ringer switch flipped. The journal was recording without either.
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch { setError(tr.uploadFailed); }
  };
  const stopVoice = async () => {
    try {
      const seconds = Math.round((recState.durationMillis ?? 0) / 1000);
      await recorder.stop();
      // Back out of the record route, or everything played afterwards comes out
      // of the earpiece at a whisper — including the video on this very page.
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const uri = recorder.uri;
      if (!uri) return;
      const mime = await recordedMime(uri);
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
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
      {/* `padding` on ANDROID TOO, and that is the fix for two reports at once:
          the caret hidden behind the keyboard, and the block toolbar (Text,
          Heading, List, Quote) sitting underneath it where it cannot be reached.
          Both were the same cause — `undefined` here means this view does
          nothing on Android, so nothing moved out of the keyboard's way. The
          toolbar is already inside this view, so once the view pads, the toolbar
          rides above the keyboard and the scroller shrinks to match, which is
          what puts the line being typed back on screen. */}
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        {/* The bar. Dark and imageless, like the list it came from — and where
            the share state lives, because a state belongs with the chrome and
            not under the writing. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingTop: HEADER_TOP, paddingBottom: 12 }}>
          <TouchableOpacity onPress={back} activeOpacity={0.7} style={[circleBtn, { backgroundColor: veil(theme, 0.10) }]}><ChevronLeft size={18} color={TT.ink} strokeWidth={2} /></TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            {mode === 'edit' && status === 'saved' && <Check size={13} color={TT.accent} strokeWidth={2.5} />}
            {mode === 'edit' && status !== 'idle' ? (
              <Kicker color={status === 'failed' ? '#B4443A' : TT.faint} size={9.5}>
                {status === 'saving' ? tr.saving : status === 'failed' ? tr.notSaved : tr.saved.replace('{time}', savedAtLabel)}
              </Kicker>
            ) : null}
          </View>
          <View style={{ flex: 1 }} />
          {/* With nobody to share with there is no chip to offer — unless it is
              already shared, which can still be stopped. */}
          {savedId && !loadFailed && !entryIsEmpty(title, blocks) && (hasPractitioner || shared) && (
            <ShareChip
              shared={shared} sharedAt={sharedAt} busy={sharing} face={face} names={canSwitch ? pracNames : shared && readers ? readers : pracNames} locale={locale}
              others={canSwitch ? otherReaders(readers, readerIds, selectedId) : []}
              copy={{ canRead: tr.canRead, canReadMany: tr.canReadMany, private: tr.private, sharedOn: tr.sharedOn, onlyYou: tr.onlyYou, stopSharing: tr.stopSharing, shareWith: tr.shareWith, sharedElsewhere: tr.sharedElsewhere, alsoWith: tr.alsoWith, notYet: tr.notYet, stopSharingWith: tr.stopSharingWith }}
              onToggle={toggleShare}
            />
          )}
          {mode === 'edit' && !loadFailed && !entryIsEmpty(title, blocks) && (
            <TouchableOpacity
              onPress={saveNow}
              activeOpacity={0.85}
              style={{ height: 34, paddingHorizontal: 16, borderRadius: 17, backgroundColor: TT.ctaBg, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 13.5, fontWeight: '700', color: TT.ctaFg }}>{tr.save}</Text>
            </TouchableOpacity>
          )}
          {mode === 'read' && !loadFailed && (
            <TouchableOpacity onPress={() => setMode('edit')} activeOpacity={0.7} style={[circleBtn, { backgroundColor: veil(theme, 0.10) }]}><Pencil size={16} color={TT.ink} strokeWidth={2} /></TouchableOpacity>
          )}
          {!loadFailed && <TouchableOpacity onPress={confirmDelete} activeOpacity={0.7} style={[circleBtn, { backgroundColor: veil(theme, 0.10) }]}><Trash2 size={16} color={TT.inkSoft} strokeWidth={2} /></TouchableOpacity>}
        </View>

        {/* The paper. */}
        <View style={{ flex: 1, backgroundColor: TT.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: 'hidden' }}>

        {loaded && loadFailed ? (
          // Could not read it. Not an empty page — an unknown one — so there is
          // nothing to edit, and nothing that could be saved over the real one.
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 14 }}>
            <Text style={{ fontSize: 15, lineHeight: 22, color: TT.inkSoft, textAlign: 'center' }}>{tr.loadError}</Text>
            <TouchableOpacity
              onPress={() => { setLoaded(false); void load(); }}
              activeOpacity={0.85}
              style={{ height: 38, paddingHorizontal: 18, borderRadius: 19, backgroundColor: TT.ctaBg, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: TT.ctaFg }}>{tr.retry}</Text>
            </TouchableOpacity>
          </View>
        ) : loaded && (mode === 'read' ? (
          <ReadView title={title} blocks={blocks} tr={tr} meta={metaLine} onOpenMedia={openMedia} />
        ) : (
          <ScrollView
            {...keep.scrollProps}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            scrollEnabled={!drag.dragging}
          >
            {/* The padding lives on this view rather than the scroller, so a
                field measured against it is measured in scroll coordinates. */}
            <View ref={keep.content} collapsable={false} style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32 }}>
            <Text style={{ fontSize: 11.5, color: TT.faint, marginBottom: 8, paddingHorizontal: 4 }}>{metaLine}</Text>
            <TextInput
              {...keep.field('title', title)}
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
                onOpenMedia={openMedia}
                field={keep.field}
                focusSoon={keep.focusSoon}
                onMeasure={(h) => drag.measure(i, h)}
                gripHandlers={drag.gripHandlers(i)}
                shift={drag.shiftOf(i)}
                lifted={drag.draggingIndex === i} />
            ))}
            {error && <Text style={{ color: '#DC2626', fontSize: 13, marginTop: 8, paddingHorizontal: 4 }}>{error}</Text>}
            </View>
          </ScrollView>
        ))}

        {/* Recording bar OR the block toolbar — edit mode only */}
        {mode === 'edit' && !loadFailed && (recording ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderTopColor: TT.line }}>
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: RECORD.dot }} />
            <Text style={{ fontSize: 14, fontWeight: '600', color: TT.ink }}>{tr.recording} {fmtDur(Math.round((recState.durationMillis ?? 0) / 1000))}</Text>
            <TouchableOpacity onPress={stopVoice} activeOpacity={0.85} style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: RECORD.dot, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 }}>
              <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: RECORD.ink }} />
              <Text style={{ color: OVER_MEDIA.ink, fontWeight: '700', fontSize: 13 }}>{tr.stop}</Text>
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
      {viewer ? (
        <MediaViewer
          items={viewer.items}
          index={viewer.index}
          onIndex={(i) => setViewer((v) => (v ? { ...v, index: i } : v))}
          onClose={() => setViewer(null)}
        />
      ) : null}
    </View>
  );
}

// Was `darkCircleBtn` with a baked-in white wash — a white disc on cream. The
// circular affordance inverts by theme, so the colour comes from the palette and
// only the geometry lives here.
const circleBtn = { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' } as const;


type Tr = { [K in keyof (typeof T)['en']]: string };

// Multiline input that grows to its content height (native grows on its own;
// web needs this) and always spans the full width — no clipped box / overflow.
type FieldProps = ReturnType<ReturnType<typeof useKeepInView>['field']>;

function AutoGrowInput({ value, onChange, placeholder, style, field }: { value: string; onChange: (v: string) => void; placeholder: string; style: object; field: FieldProps }) {
  const { t: TT } = useTheme();
  const [h, setH] = useState(0);
  const minH = (style as { lineHeight?: number }).lineHeight ?? 24;
  return (
    <TextInput
      {...field}
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
  const { t: TT, mode } = useTheme();
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
    // Shown only when it is an address the server keeps, so the preview straight
    // after saving is the same page that opens next time.
    case 'link': return !normalizeLink(b.url) ? null : (
      <TouchableOpacity onPress={() => openLink(normalizeLink(b.url))} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Link2 size={16} color={TT.accent} /><Text style={{ fontSize: 15.5, fontWeight: '600', color: TT.accent }}>{b.label || b.url}</Text>
      </TouchableOpacity>
    );
    case 'voice':
      // Plays where it sits. Nothing to look at, so nothing to open. From the
      // recording on the phone when there is one: straight after saving there
      // is no server address yet, and this used to show a play button with no
      // player behind it until the page was opened again.
      // Not when its upload failed: that note is not on the page the server
      // keeps, and playing it here said otherwise until the page was reopened.
      return mediaSource(b) && !b.failed ? (
        <AudioRow url={mediaSource(b)!} durationSeconds={b.durationSeconds} label={tr.voiceNote} tone={mode} />
      ) : (
        <MediaBlock block={b} tr={tr} />
      );
    case 'image': case 'video':
      return <TouchableOpacity activeOpacity={0.9} disabled={!mediaSource(b)} onPress={() => onOpenMedia?.(b.id)}><MediaBlock block={b} tr={tr} /></TouchableOpacity>;
    default: return null;
  }
}

function BlockRow({ block: b, tr, first, last, onPatch, onRemove, onUp, onDown, onRetry, onOpenMedia, field, focusSoon, onMeasure, gripHandlers, shift, lifted }: {
  block: JournalBlock; tr: Tr; first: boolean; last: boolean;
  field: (key: string, value: string) => FieldProps;
  focusSoon: (key: string) => void;
  onPatch: (p: Partial<JournalBlock>) => void; onRemove: () => void; onUp: () => void; onDown: () => void;
  onRetry?: () => Promise<void>;
  onOpenMedia?: (blockId: string) => void;
  onMeasure: (height: number) => void;
  gripHandlers: object;
  shift: number;
  lifted: boolean;
}) {
  const { t: TT, mode } = useTheme();
  const menu = useAnchoredMenu();
  // Multiline text grows to fit its content (fixes the tiny fixed-height box +
  // horizontal overflow on web); single-line inputs stay plain. `key` names the
  // field, so it can be given the cursor and kept in view.
  const input = (key: string, extra: object, value: string, onChange: (v: string) => void, placeholder: string, multiline = true, more?: object, onLeave?: () => void) => {
    const f = field(key, value);
    // Leaving a field is both the keep-in-view bookkeeping and, for some fields,
    // a tidy-up; one handler, so neither replaces the other in the spread.
    const withLeave = { ...f, onBlur: () => { f.onBlur(); onLeave?.(); } };
    return multiline ? (
      <AutoGrowInput field={withLeave} value={value} onChange={onChange} placeholder={placeholder} style={extra} />
    ) : (
      <TextInput {...withLeave} {...more} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={TT.faint}
        style={[{ color: TT.ink, padding: 0 }, extra, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as never) : null]} />
    );
  };

  let content: React.ReactNode = null;
  if (b.type === 'text') content = input(b.id, { fontSize: 15.5, lineHeight: 26, color: TT.inkSoft }, b.text ?? '', (v) => onPatch({ text: v }), tr.writePlaceholder);
  else if (b.type === 'heading') content = input(b.id, { fontSize: 19, fontWeight: '800', letterSpacing: -0.3 }, b.text ?? '', (v) => onPatch({ text: v }), tr.headingPlaceholder);
  else if (b.type === 'quote') content = (
    <View style={{ borderLeftWidth: 3, borderLeftColor: TT.accent, paddingLeft: 12 }}>
      {input(b.id, { fontSize: 15.5, lineHeight: 25, fontStyle: 'italic', color: TT.inkSoft }, b.text ?? '', (v) => onPatch({ text: v }), tr.quotePlaceholder)}
    </View>
  );
  else if (b.type === 'callout') content = (
    <View style={{ backgroundColor: TT.accentTint, borderRadius: 14, padding: 14 }}>
      {input(b.id, { fontSize: 15, lineHeight: 24, color: TT.ink }, b.text ?? '', (v) => onPatch({ text: v }), tr.calloutPlaceholder)}
    </View>
  );
  else if (b.type === 'list') content = (
    <View style={{ gap: 8 }}>
      {(b.items ?? ['']).map((it, idx) => (
        <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: TT.accent, marginTop: 9 }} />
          <View style={{ flex: 1 }}>
            {input(`${b.id}:${idx}`, { fontSize: 15.5, lineHeight: 24 }, it, (v) => onPatch({ items: (b.items ?? []).map((x, k) => (k === idx ? v : x)) }), tr.itemPlaceholder, false)}
          </View>
          {(b.items?.length ?? 0) > 1 && (
            <TouchableOpacity onPress={() => onPatch({ items: (b.items ?? []).filter((_, k) => k !== idx) })} hitSlop={8}><X size={14} color={TT.faint} /></TouchableOpacity>
          )}
        </View>
      ))}
      {/* The new item takes the cursor, and the page follows it down. */}
      <TouchableOpacity
        onPress={() => { focusSoon(`${b.id}:${(b.items ?? ['']).length}`); onPatch({ items: [...(b.items ?? []), ''] }); }}
        activeOpacity={0.7} style={{ marginLeft: 16 }}
      >
        <Text style={{ fontSize: 13, fontWeight: '600', color: TT.accent }}>+ {tr.addItem}</Text>
      </TouchableOpacity>
    </View>
  );
  else if (b.type === 'link') content = (
    <View style={{ backgroundColor: TT.card, borderWidth: 1, borderColor: TT.line, borderRadius: 12, padding: 12, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Link2 size={15} color={TT.accent} />
        {/* An address, typed on an address keyboard: no capital W, no
            autocorrected "www. site", and `https://` added on leaving the field
            so what the page shows is what the server keeps. */}
        {input(`${b.id}:url`, { fontSize: 14.5, color: TT.ink, flex: 1 }, b.url ?? '', (v) => onPatch({ url: v }), tr.linkUrl, false,
          { autoCapitalize: 'none', autoCorrect: false, keyboardType: 'url', textContentType: 'URL' },
          // On blur, which every platform fires (web has no onEndEditing). Only
          // ever fills in; never wipes what was typed because it is not an
          // address yet.
          () => { const n = normalizeLink(b.url); if (n && n !== (b.url ?? '')) onPatch({ url: n }); },
        )}
      </View>
      {input(`${b.id}:label`, { fontSize: 13.5, color: TT.inkSoft }, b.label ?? '', (v) => onPatch({ label: v }), tr.linkLabel, false)}
    </View>
  );
  else if (b.type === 'voice' && mediaSource(b) && !b.failed) content = (
    // A voice note plays while the page is being written, from the recording
    // on the phone. It was a drawing of a play button until now.
    <AudioRow url={mediaSource(b)!} durationSeconds={b.durationSeconds} label={tr.voiceNote} tone={mode} />
  );
  else if (isMedia(b.type)) content = (
    // A still with a play triangle painted on it and no tap behind it is a
    // video that does not work — which is exactly how it was reported. The
    // read view has always opened the viewer here; editing does too, from the
    // file on the phone, so a video plays before it has finished uploading.
    <TouchableOpacity activeOpacity={0.9} disabled={!mediaSource(b)} onPress={() => onOpenMedia?.(b.id)}>
      <MediaBlock block={b} tr={tr} />
    </TouchableOpacity>
  );

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
        style={[{ width: 24, height: 30, alignItems: 'center', justifyContent: 'center', marginTop: 2 }, Platform.OS === 'web' ? ({ userSelect: 'none', cursor: 'grab' } as never) : null]}
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
  const uri = posterSource(b);
  if (b.type === 'voice') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: TT.accentTint, borderRadius: 14, padding: 14 }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: TT.accent, alignItems: 'center', justifyContent: 'center' }}>
          {b.uploading ? <ActivityIndicator size="small" color={OVER_MEDIA.ink} /> : <Play size={16} color={OVER_MEDIA.ink} fill={OVER_MEDIA.ink} />}
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
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: OVER_MEDIA.scrim, alignItems: 'center', justifyContent: 'center' }}><Play size={22} color={OVER_MEDIA.ink} fill={OVER_MEDIA.ink} /></View>
        </View>
      )}
      {b.uploading && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: OVER_MEDIA.scrim }}><ActivityIndicator color={OVER_MEDIA.ink} /></View>
      )}
      {b.failed && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: OVER_MEDIA.scrim }}><Text style={{ color: OVER_MEDIA.ink, fontSize: 13 }}>{tr.uploadFailed}</Text></View>
      )}
    </View>
  );
}
