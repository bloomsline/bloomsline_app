// A worksheet's file question: up to five files, each one visible.
//
// It held one file and showed it as a paperclip and a file name, so a patient who
// had photographed three pages of a diary had to choose one, and nobody could
// tell from the answer whether "IMG_4471.jpg" was the right photo without opening
// it. Now the answer is a grid of previews: a photo as itself, a video as its
// first frame with a play badge, anything else as an icon with its name and size.
// Tapping one opens it where it can be seen: photos and videos in the app's own
// full-screen viewer (stepping between them), other files by their link.
//
// Each file uploads on its own, with its own progress, and a failed one stays in
// its place with Try again and Remove, rather than the whole question failing.
// Files reach the answer only once they are in storage, so a draft saved mid
// upload never holds a key with nothing behind it. The screen is told how many
// are still uploading or failed (`onStatus`), which is what lets it hold Submit
// and the way out until they are settled.
//
// Documents (a PDF, a Word file) come from the system's document picker on a
// phone (expo-document-picker, which needs a native build that includes it) and
// from the browser's own file chooser on the web.
//
// Stored shape, as the server reads it: nothing for none, one descriptor for one
// file, an array for two to five (see `fileAnswer`).
import { createElement, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, Platform, Pressable, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as WebBrowser from 'expo-web-browser';
import { Camera, File as FileIcon, FileText, Image as ImageIcon, Play, Plus, RotateCcw, Upload, X } from 'lucide-react-native';
import { useI18n } from '@/src/i18n';
import { useCare } from '@/src/care/theme';
import { useTheme } from '@/src/ui/theme-mode';
import { OVER_MEDIA } from '@/src/ui/tokens';
import { MediaViewer, type ViewerItem } from '@/src/ui/MediaViewer';
import { uploadResponseFile } from '@/src/api/resources';
import { byteSize } from '@/src/upload/put-file';
import { fileAnswer, filesOf, MAX_FILE_BYTES, MAX_FILES, type FileDescriptor } from '@/src/resources/answers';

export interface UploadStatus { uploading: number; failed: number }

const COPY = {
  en: {
    upload: 'Add a photo, video or document', uploadWeb: 'Add a file', add: 'Add',
    hint: 'Up to {max} files, {mb} MB each.', count: '{n} of {max}',
    library: 'Photo or video', camera: 'Camera', document: 'Document', cancel: 'Cancel',
    uploading: 'Uploading', failed: 'Not uploaded', retry: 'Try again', remove: 'Remove file',
    tooLarge: '{name} is larger than {mb} MB, so it was not added.',
    tooMany: 'This question takes up to {max} files, so {n} were not added.',
    busy: 'Too many uploads in a row. Wait a moment, then try again.',
    cameraOff: 'Camera access is off for Bloomsline. You can turn it on in Settings.',
    noFile: 'No file.', open: 'Open {name}',
  },
  fr: {
    upload: 'Ajouter une photo, une vidéo ou un document', uploadWeb: 'Ajouter un fichier', add: 'Ajouter',
    hint: 'Jusqu’à {max} fichiers, {mb} Mo chacun.', count: '{n} sur {max}',
    library: 'Photo ou vidéo', camera: 'Appareil photo', document: 'Document', cancel: 'Annuler',
    uploading: 'Envoi', failed: 'Non envoyé', retry: 'Réessayer', remove: 'Retirer le fichier',
    tooLarge: '{name} dépasse {mb} Mo, il n’a donc pas été ajouté.',
    tooMany: 'Cette question accepte jusqu’à {max} fichiers, {n} n’ont donc pas été ajoutés.',
    busy: 'Trop d’envois d’affilée. Patientez un instant, puis réessayez.',
    cameraOff: 'L’accès à l’appareil photo est désactivé pour Bloomsline. Vous pouvez l’activer dans les Réglages.',
    noFile: 'Aucun fichier.', open: 'Ouvrir {name}',
  },
} as const;

const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
const MB = Math.round(MAX_FILE_BYTES / (1024 * 1024));
const GAP = 8;

// Where a file uploaded on THIS phone came from, by storage key. A file that has
// just been added has no signed link yet (the server signs links when the answer
// is read back), and it should still preview and open, so it does from the copy
// on the phone. Module-level so it outlives the field: going to another screen
// and back must not turn a photo into a grey square.
const LOCAL = new Map<string, { uri: string; poster?: string | null }>();
// Video first frames, by storage key. Making one reads part of the video, which
// is not worth doing again every time the list re-renders.
const POSTERS = new Map<string, string | null>();

type Kind = 'image' | 'video' | 'pdf' | 'file';
const extOf = (name: string) => /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? '';
function kindOf(type: string, name: string): Kind {
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (type === 'application/pdf') return 'pdf';
  const ext = extOf(name);
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'].includes(ext)) return 'image';
  if (['mp4', 'mov', 'm4v', 'webm', '3gp'].includes(ext)) return 'video';
  if (ext === 'pdf') return 'pdf';
  return 'file';
}

// What the document picker offers: the files a worksheet answer is plausibly
// made of. Photos and videos are there too, for one kept in Files rather than
// in the photo library.
const DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text',
  'application/rtf',
  'text/plain',
  'image/*',
  'video/*',
];

// Android's picker often leaves the type out. Storage is signed for the type the
// upload declares, so a best guess from the name beats an empty one.
const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  odt: 'application/vnd.oasis.opendocument.text', rtf: 'application/rtf', txt: 'text/plain',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', heic: 'image/heic', mp4: 'video/mp4', mov: 'video/quicktime',
};

function humanSize(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Picked { uri: string; name: string; type: string; size: number; poster?: string | null }
interface Pending extends Picked { id: string; progress: number; state: 'uploading' | 'failed' }

let seq = 0;

export function FileUploadField({
  value, onChange, readOnly, urls, onStatus,
}: {
  value: unknown;
  onChange: (v: unknown) => void;
  readOnly?: boolean;
  /** Signed links by storage key (see `urlsByKey`). */
  urls: Record<string, string>;
  onStatus?: (s: UploadStatus) => void;
}) {
  const C = useCare();
  const { t: TT } = useTheme();
  const { locale } = useI18n();
  const c = COPY[locale] ?? COPY.en;

  const files = filesOf(value);
  const [pending, setPending] = useState<Pending[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);
  const [width, setWidth] = useState(0);

  // The files as last written. Two uploads finishing a moment apart must each add
  // to what the other left, not to the value of a render that has not happened.
  const filesRef = useRef<FileDescriptor[]>(files);
  useEffect(() => { filesRef.current = filesOf(value); }, [value]);
  const mounted = useRef(true);
  const dropped = useRef(new Set<string>());
  useEffect(() => () => { mounted.current = false; }, []);

  const uploading = pending.filter((p) => p.state === 'uploading').length;
  const failed = pending.length - uploading;
  const statusRef = useRef(onStatus);
  statusRef.current = onStatus;
  useEffect(() => { statusRef.current?.({ uploading, failed }); }, [uploading, failed]);
  // Leaving the screen ends the uploads' claim on it.
  useEffect(() => () => { statusRef.current?.({ uploading: 0, failed: 0 }); }, []);

  const room = MAX_FILES - files.length - pending.length;

  const start = (p: Pending) => {
    let shown = 0;
    void uploadResponseFile(p, (fraction) => {
      // A progress event per chunk is a re-render per chunk; a visible step is enough.
      if (fraction - shown < 0.03 && fraction < 1) return;
      shown = fraction;
      if (mounted.current) setPending((list) => list.map((x) => (x.id === p.id ? { ...x, progress: fraction } : x)));
    }).then((res) => {
      // Removed while it was on its way, or the patient left the screen: the
      // file is not theirs to add any more.
      if (dropped.current.has(p.id) || !mounted.current) return;
      if (res.ok) {
        LOCAL.set(res.file.key, { uri: p.uri, poster: p.poster });
        const next = [...filesRef.current, res.file].slice(0, MAX_FILES);
        filesRef.current = next;
        setPending((list) => list.filter((x) => x.id !== p.id));
        onChange(fileAnswer(next));
        return;
      }
      if (res.reason === 'too_large') {
        setPending((list) => list.filter((x) => x.id !== p.id));
        setNotice(fill(c.tooLarge, { name: p.name, mb: MB }));
        return;
      }
      if (res.reason === 'busy') setNotice(c.busy);
      setPending((list) => list.map((x) => (x.id === p.id ? { ...x, state: 'failed', progress: 0 } : x)));
    });
  };

  const add = async (picked: Picked[]) => {
    setChoosing(false);
    const notes: string[] = [];
    const space = MAX_FILES - filesRef.current.length - pending.length;
    if (picked.length > space) notes.push(fill(c.tooMany, { max: MAX_FILES, n: picked.length - Math.max(0, space) }));
    const fresh: Pending[] = [];
    for (const f of picked.slice(0, Math.max(0, space))) {
      // Said now, before a byte is sent, rather than as a failure at the end of
      // a long upload the route was always going to refuse.
      if (f.size > MAX_FILE_BYTES) { notes.push(fill(c.tooLarge, { name: f.name, mb: MB })); continue; }
      fresh.push({ ...f, id: `up${++seq}`, progress: 0, state: 'uploading' });
    }
    setNotice(notes.length ? notes.join(' ') : null);
    if (!fresh.length) return;
    setPending((list) => [...list, ...fresh]);
    fresh.forEach(start);
  };

  const fromAssets = async (assets: ImagePicker.ImagePickerAsset[]): Promise<Picked[]> =>
    Promise.all(assets.map(async (a) => {
      const video = a.type === 'video';
      const size = a.fileSize ?? (await byteSize(a.uri).catch(() => 0));
      let poster: string | null = null;
      if (video && Platform.OS !== 'web') {
        try { poster = (await VideoThumbnails.getThumbnailAsync(a.uri, { time: 0 })).uri; } catch { /* no poster, the tile still shows a play badge */ }
      }
      return {
        uri: a.uri,
        name: a.fileName ?? (video ? 'video.mp4' : 'photo.jpg'),
        type: a.mimeType ?? (video ? 'video/mp4' : 'image/jpeg'),
        size,
        poster,
      };
    }));

  const pickLibrary = async () => {
    setNotice(null);
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 1,
      allowsMultipleSelection: room > 1,
      selectionLimit: Math.max(1, room),
      // iOS re-encodes a chosen video to 720p, which keeps most clips under the
      // ceiling. Android has no such option; the size check covers it.
      videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720,
    });
    if (res.canceled || !res.assets?.length) { setChoosing(false); return; }
    await add(await fromAssets(res.assets));
  };

  const pickCamera = async () => {
    setNotice(null);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    // The OS asks once; after a refusal every tap would do nothing, in silence.
    if (!perm.granted) { setChoosing(false); setNotice(c.cameraOff); return; }
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images', 'videos'], quality: 1, videoQuality: ImagePicker.UIImagePickerControllerQualityType.IFrame1280x720 });
    if (res.canceled || !res.assets?.length) { setChoosing(false); return; }
    await add(await fromAssets(res.assets));
  };

  // On the web, the browser's own file chooser takes ANY file, documents included
  // (phones use expo-document-picker instead, see pickDocument). On a phone's
  // browser the same chooser also offers the camera and the photo library.
  const pickWeb = () => {
    setNotice(null);
    const doc = (globalThis as { document?: Document }).document;
    if (!doc) return;
    const input = doc.createElement('input');
    input.type = 'file';
    input.multiple = room > 1;
    input.onchange = () => {
      const list = Array.from(input.files ?? []);
      void add(list.map((file) => ({ uri: URL.createObjectURL(file), name: file.name || 'file', type: file.type || 'application/octet-stream', size: file.size })));
    };
    input.click();
  };

  const pickDocument = async () => {
    setNotice(null);
    const res = await DocumentPicker.getDocumentAsync({ type: DOCUMENT_TYPES, copyToCacheDirectory: true, multiple: room > 1 });
    if (res.canceled || !res.assets?.length) { setChoosing(false); return; }
    const picked = await Promise.all(res.assets.map(async (a) => {
      const type = a.mimeType || MIME_BY_EXT[extOf(a.name)] || 'application/octet-stream';
      let poster: string | null = null;
      if (type.startsWith('video/') && Platform.OS !== 'web') {
        try { poster = (await VideoThumbnails.getThumbnailAsync(a.uri, { time: 0 })).uri; } catch { /* the tile shows a play badge without it */ }
      }
      return { uri: a.uri, name: a.name || 'file', type, size: a.size ?? (await byteSize(a.uri).catch(() => 0)), poster };
    }));
    await add(picked);
  };

  const onAdd = () => {
    if (Platform.OS === 'web') pickWeb();
    else setChoosing((v) => !v);
  };

  const remove = (key: string) => {
    const next = filesRef.current.filter((f) => f.key !== key);
    filesRef.current = next;
    setNotice(null);
    onChange(fileAnswer(next));
  };
  const drop = (id: string) => {
    dropped.current.add(id);
    setPending((list) => list.filter((x) => x.id !== id));
  };
  const retry = (p: Pending) => {
    setNotice(null);
    const again: Pending = { ...p, state: 'uploading', progress: 0 };
    setPending((list) => list.map((x) => (x.id === p.id ? again : x)));
    start(again);
  };

  // Photos and videos step through the viewer together; other files open alone.
  const linkOf = (f: FileDescriptor) => urls[f.key] ?? LOCAL.get(f.key)?.uri;
  const media = files
    .map((f) => ({ f, kind: kindOf(f.type, f.name), url: linkOf(f) }))
    .filter((m): m is { f: FileDescriptor; kind: 'image' | 'video'; url: string } => (m.kind === 'image' || m.kind === 'video') && !!m.url);
  const viewerItems: ViewerItem[] = media.map((m) => ({ kind: m.kind, url: m.url, thumbnailUrl: POSTERS.get(m.f.key) ?? LOCAL.get(m.f.key)?.poster ?? null }));

  const open = (f: FileDescriptor) => {
    const i = media.findIndex((m) => m.f.key === f.key);
    if (i >= 0) { setViewer(i); return; }
    const url = linkOf(f);
    if (!url) return;
    // A document not saved yet opens from the copy on the phone, which only
    // the system can hand to a reader; the in-app browser takes web links.
    if (!/^https?:/i.test(url)) { void Linking.openURL(url).catch(() => {}); return; }
    // Android's in-app browser does not render a PDF; the system hands it to
    // whatever reader is installed. See PdfBlock in ./blocks.
    if (Platform.OS === 'ios') void WebBrowser.openBrowserAsync(url);
    else void Linking.openURL(url).catch(() => WebBrowser.openBrowserAsync(url));
  };

  const tile = width > 0 ? Math.floor((width - GAP * 2) / 3) : 0;
  const nothing = files.length === 0 && pending.length === 0;

  if (readOnly && files.length === 0) {
    return (
      <View style={{ backgroundColor: C.card, borderRadius: 12, padding: 14 }}>
        <Text style={{ fontSize: 13, color: C.muted }}>{c.noFile}</Text>
      </View>
    );
  }

  return (
    <View>
      {nothing ? (
        <Pressable
          onPress={onAdd}
          accessibilityRole="button"
          style={{ alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: C.border, borderStyle: 'dashed', borderRadius: 14, backgroundColor: C.card, paddingVertical: 18, paddingHorizontal: 14 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Upload size={18} color={C.teal} />
            <Text style={{ fontSize: 15, fontWeight: '600', color: C.ink }}>{Platform.OS === 'web' ? c.uploadWeb : c.upload}</Text>
          </View>
          <Text style={{ fontSize: 12, color: C.muted }}>{fill(c.hint, { max: MAX_FILES, mb: MB })}</Text>
        </Pressable>
      ) : (
        <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
          {tile > 0 && files.map((f) => (
            <FileTile
              key={f.key}
              size={tile}
              file={f}
              url={urls[f.key]}
              local={LOCAL.get(f.key)}
              onOpen={() => open(f)}
              onRemove={readOnly ? undefined : () => remove(f.key)}
              copy={c}
            />
          ))}
          {tile > 0 && pending.map((p) => (
            <PendingTile key={p.id} size={tile} item={p} onRemove={() => drop(p.id)} onRetry={() => retry(p)} copy={c} />
          ))}
          {tile > 0 && !readOnly && room > 0 ? (
            <Pressable
              onPress={onAdd}
              accessibilityRole="button"
              accessibilityLabel={c.add}
              style={{ width: tile, height: tile, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.border, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', gap: 4 }}
            >
              <Plus size={20} color={C.teal} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: C.ink }}>{c.add}</Text>
              <Text style={{ fontSize: 11, color: C.muted }}>{fill(c.count, { n: files.length + pending.length, max: MAX_FILES })}</Text>
            </Pressable>
          ) : null}
        </View>
      )}

      {choosing && !readOnly ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          <Chip icon={<ImageIcon size={15} color={C.teal} />} label={c.library} onPress={() => { void pickLibrary(); }} />
          <Chip icon={<Camera size={15} color={C.teal} />} label={c.camera} onPress={() => { void pickCamera(); }} />
          <Chip icon={<FileText size={15} color={C.teal} />} label={c.document} onPress={() => { void pickDocument(); }} />
          <Chip label={c.cancel} onPress={() => setChoosing(false)} quiet />
        </View>
      ) : null}

      {notice ? <Text style={{ fontSize: 12.5, color: TT.danger, marginTop: 8, lineHeight: 18 }}>{notice}</Text> : null}

      {viewer !== null && viewerItems[viewer] ? (
        <MediaViewer items={viewerItems} index={viewer} onIndex={setViewer} onClose={() => setViewer(null)} />
      ) : null}
    </View>
  );
}

function Chip({ icon, label, onPress, quiet }: { icon?: React.ReactNode; label: string; onPress: () => void; quiet?: boolean }) {
  const C = useCare();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 7, height: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: quiet ? 'transparent' : C.border, backgroundColor: quiet ? 'transparent' : C.card }}>
      {icon}
      <Text style={{ fontSize: 14, fontWeight: '600', color: quiet ? C.muted : C.ink }}>{label}</Text>
    </Pressable>
  );
}

type Copy = (typeof COPY)[keyof typeof COPY];

function RemoveButton({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={label} style={{ position: 'absolute', top: 5, right: 5, width: 26, height: 26, borderRadius: 13, backgroundColor: OVER_MEDIA.scrim, alignItems: 'center', justifyContent: 'center' }}>
      <X size={14} color={OVER_MEDIA.ink} strokeWidth={2.5} />
    </Pressable>
  );
}

/** A saved file: the picture itself, a video's first frame, or an icon and a name. */
function FileTile({ size, file, url, local, onOpen, onRemove, copy }: { size: number; file: FileDescriptor; url?: string; local?: { uri: string; poster?: string | null }; onOpen: () => void; onRemove?: () => void; copy: Copy }) {
  const C = useCare();
  const { t: TT } = useTheme();
  const kind = kindOf(file.type, file.name);
  const src = url ?? local?.uri;
  const [broken, setBroken] = useState(false);
  const poster = useVideoPoster(kind === 'video' ? file.key : null, src, local?.poster ?? null);

  const showImage = kind === 'image' && src && !broken;
  return (
    <View style={{ width: size, height: size }}>
      <Pressable
        onPress={onOpen}
        disabled={!src}
        accessibilityRole="button"
        accessibilityLabel={fill(copy.open, { name: file.name })}
        style={{ flex: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: kind === 'video' ? TT.slot : C.card, borderWidth: showImage || kind === 'video' ? 0 : 1, borderColor: C.border }}
      >
        {showImage ? (
          <Image source={{ uri: src }} style={{ width: '100%', height: '100%' }} resizeMode="cover" onError={() => setBroken(true)} />
        ) : kind === 'video' ? (
          <>
            {poster ? (
              <Image source={{ uri: poster }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            ) : Platform.OS === 'web' && src ? (
              // The browser draws a video's first frame itself once it has read
              // the start of the file, which is the poster the phone builds make
              // with expo-video-thumbnails. `#t=0.1` asks for a frame rather than
              // the black one some files open on.
              createElement('video', { src: `${src}#t=0.1`, muted: true, playsInline: true, preload: 'metadata', style: { width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none', background: TT.slot } })
            ) : null}
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: OVER_MEDIA.scrim, alignItems: 'center', justifyContent: 'center' }}>
                <Play size={17} color={OVER_MEDIA.ink} fill={OVER_MEDIA.ink} />
              </View>
            </View>
          </>
        ) : (
          <View style={{ flex: 1, padding: 9, justifyContent: 'space-between' }}>
            <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: kind === 'pdf' ? TT.dangerTint : C.mint, alignItems: 'center', justifyContent: 'center' }}>
              {kind === 'image' ? <ImageIcon size={15} color={C.teal} /> : kind === 'pdf' ? <FileText size={15} color={TT.danger} /> : <FileIcon size={15} color={C.teal} />}
            </View>
            <View>
              <Text numberOfLines={2} style={{ fontSize: 12, fontWeight: '600', color: C.ink, lineHeight: 15 }}>{file.name}</Text>
              {file.size ? <Text style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{humanSize(file.size)}</Text> : null}
            </View>
          </View>
        )}
      </Pressable>
      {onRemove ? <RemoveButton onPress={onRemove} label={copy.remove} /> : null}
    </View>
  );
}

/** A file on its way, or one that did not make it. */
function PendingTile({ size, item, onRemove, onRetry, copy }: { size: number; item: Pending; onRemove: () => void; onRetry: () => void; copy: Copy }) {
  const C = useCare();
  const { t: TT } = useTheme();
  const kind = kindOf(item.type, item.name);
  const preview = kind === 'image' ? item.uri : item.poster ?? null;
  const failed = item.state === 'failed';
  return (
    <View style={{ width: size, height: size }}>
      <View style={{ flex: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: preview ? TT.slot : C.card, borderWidth: failed ? 1.5 : preview ? 0 : 1, borderColor: failed ? TT.danger : C.border }}>
        {preview ? <Image source={{ uri: preview }} style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0.55 }} resizeMode="cover" /> : null}
        <View style={{ flex: 1, padding: 9, justifyContent: 'flex-end' }}>
          {failed ? (
            <>
            {/* Under the remove button's row rather than beside it, where a
                third of a phone's width cut it to "Not up…". */}
            <Text numberOfLines={2} style={{ fontSize: 11.5, fontWeight: '700', color: preview ? OVER_MEDIA.ink : TT.danger, marginBottom: 6 }}>{copy.failed}</Text>
            <Pressable onPress={onRetry} accessibilityRole="button" accessibilityLabel={`${copy.retry}, ${item.name}`} style={{ alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderRadius: 10, backgroundColor: C.sheet }}>
              <RotateCcw size={15} color={TT.danger} strokeWidth={2.4} />
              <Text style={{ fontSize: 11.5, fontWeight: '700', color: TT.danger }}>{copy.retry}</Text>
            </Pressable>
            </>
          ) : (
            <View accessibilityRole="progressbar" accessibilityLabel={`${copy.uploading}, ${item.name}`} accessibilityValue={{ min: 0, max: 100, now: Math.round(item.progress * 100) }} style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <ActivityIndicator size="small" color={preview ? OVER_MEDIA.ink : C.teal} />
                <Text style={{ fontSize: 11.5, fontWeight: '700', color: preview ? OVER_MEDIA.ink : C.ink }}>{Math.round(item.progress * 100)}%</Text>
              </View>
              <View style={{ height: 4, borderRadius: 2, backgroundColor: preview ? OVER_MEDIA.control : C.border, overflow: 'hidden' }}>
                <View style={{ width: `${Math.max(4, item.progress * 100)}%`, height: '100%', backgroundColor: C.teal }} />
              </View>
            </View>
          )}
        </View>
      </View>
      <RemoveButton onPress={onRemove} label={copy.remove} />
    </View>
  );
}

/**
 * A video's first frame, for its tile. The copy on the phone when there is one
 * (made when it was picked), otherwise read from the signed link on a phone
 * build. The web draws its own (see FileTile), so it asks for nothing here.
 */
function useVideoPoster(key: string | null, src: string | undefined, local: string | null): string | null {
  const [poster, setPoster] = useState<string | null>(() => (key ? local ?? POSTERS.get(key) ?? null : null));
  useEffect(() => {
    if (!key || !src || local || Platform.OS === 'web') return;
    if (POSTERS.has(key)) { setPoster(POSTERS.get(key) ?? null); return; }
    let alive = true;
    VideoThumbnails.getThumbnailAsync(src, { time: 0 })
      .then((r) => { POSTERS.set(key, r.uri); if (alive) setPoster(r.uri); })
      .catch(() => { POSTERS.set(key, null); });
    return () => { alive = false; };
  }, [key, src, local]);
  return local ?? poster;
}
