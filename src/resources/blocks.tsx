// Shared resource block renderer — used by the assigned-worksheet flow
// (app/(app)/resource/[id]) and the self-guided Library flow (library-practice).
// Renders content blocks + every interactive input; collects answers keyed by
// block id (owned by the parent screen).
import { createElement, useEffect, useMemo, useState } from 'react';
import { Image, Linking, Modal, Platform, Pressable, ScrollView, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Check, ExternalLink, FileText, Minus, Play, Plus, X } from 'lucide-react-native';
import { useI18n } from '@/src/i18n';
import { formatReadNumber, parseTypedNumber } from '@/src/resources/number';
import { htmlToPlainText, parseRichText, type Span } from '@/src/resources/html';
import { ZonedCanvasField } from '@/src/resources/zoned-canvas-field';
import type { PatientBlock } from '@/src/api/resources';
import { useCare } from '@/src/care/theme';
import { decodeEntities } from '@/src/resources/html';
import { DateField } from '@/src/resources/date-field';
import { FileUploadField, type UploadStatus } from '@/src/resources/file-upload-field';
import { urlsByKey } from '@/src/resources/answers';
import { useTheme } from '@/src/ui/theme-mode';
import { OVER_MEDIA } from '@/src/ui/tokens';



export const INTERACTIVE = new Set(['short_text', 'long_text', 'single_choice', 'multi_choice', 'scale', 'yes_no', 'number', 'date', 'table', 'file_upload', 'zoned_canvas']);

// Reading material runs long — the practitioner's relaxation script is 14 blocks
// — so body copy is sized for sustained reading rather than for form labels.
//
// The COLOUR comes from the theme and the rest does not, which is why this is a
// function rather than a constant: it was `#3A3A3A`, a dark grey that is body
// copy on white paper and very nearly invisible on the app's dark ground. The
// reading material was unreadable in dark mode.
//
// `ink` rather than `sub`: this is the content of the page, not a caption of
// it, and it should be the most readable thing on screen.
const bodyStyle = (ink: string) => ({ fontSize: 16, color: ink, lineHeight: 26 });
const PARAGRAPH_GAP = 12;
const ITEM_GAP = 7;

// The web picks « » vs “ ” from <html lang>; there is no equivalent here, so
// the pair is chosen per locale. Module-level to keep the reference stable.
const QUOTES = { en: ['\u201c', '\u201d'], fr: ['\u00ab\u00a0', '\u00a0\u00bb'] } as const;

// `readOnly` renders a sent response: everything visible, nothing editable. It
// is the screen half of the rule the server enforces — a submitted response
// belongs to the practitioner until they hand it back.
const FIELD_COPY = {
  en: {
    answer: 'Your answer', write: 'Write here…', yes: 'Yes', no: 'No',
    required: 'This one is required.', mediaMissing: 'This media could not be loaded.', image: 'Image', opensLarger: 'Opens larger',
    audio: 'Audio', video: 'Video', playAudio: 'Play audio', playVideo: 'Play video', openPdf: 'Open PDF',
    readAs: 'Read as {n}', notANumber: 'Not read as a number. Use digits, like 12 or 3.5.',
  },
  fr: {
    answer: 'Votre réponse', write: 'Écrivez ici…', yes: 'Oui', no: 'Non',
    required: 'Cette réponse est obligatoire.', mediaMissing: 'Ce média n’a pas pu être chargé.', image: 'Image', opensLarger: 'Ouvre en grand',
    audio: 'Audio', video: 'Vidéo', playAudio: 'Écouter', playVideo: 'Lire la vidéo', openPdf: 'Ouvrir le PDF',
    readAs: 'Lu comme {n}', notANumber: 'Pas lu comme un nombre. Utilisez des chiffres, comme 12 ou 3,5.',
  },
} as const;
/** The worksheet's own words, in the patient's language. */
function useFieldCopy() {
  const { locale } = useI18n();
  return FIELD_COPY[locale] ?? FIELD_COPY.en;
}

export type { UploadStatus };

export function Block({ block, value, onChange, missing, readOnly = false, mediaUrl, fileUrls, onUploadStatus }: {
  block: PatientBlock;
  value: unknown;
  onChange: (v: unknown) => void;
  missing: boolean;
  readOnly?: boolean;
  mediaUrl?: string;
  /** Signed links for answer files by storage key (`fileUrlIndex`). Without
   *  it, the one link an older payload has (`mediaUrl`) goes to the first file. */
  fileUrls?: Record<string, string>;
  /** A file question's uploads still running or failed, for the screen to hold
   *  Submit and the way out until they settle. */
  onUploadStatus?: (s: UploadStatus) => void;
}) {
  const C = useCare();
  const f = useFieldCopy();
  const b = block;
  switch (b.type) {
    case 'heading':
      // Sections are the handholds in a long read: more air above than below, so
      // a heading reads as belonging to what follows it.
      return <Text style={{ fontSize: 19, fontWeight: '700', color: C.ink, marginTop: 22, marginBottom: 10 }}>{htmlToPlainText(b.text ?? '')}</Text>;
    case 'rich_text':
      return <RichText html={b.text ?? ''} />;
    case 'divider':
      return <View style={{ height: 1, backgroundColor: C.border, marginVertical: 14 }} />;
    case 'file_upload':
      return (
        <Field label={b.label} required={b.required} missing={missing}>
          <FileUploadField value={value} onChange={onChange} readOnly={readOnly} urls={fileUrls ?? urlsByKey(value, undefined, mediaUrl)} onStatus={onUploadStatus} />
        </Field>
      );
    case 'table':
      return (
        <Field label={b.label} required={b.required} missing={missing}>
          <TableField columns={b.columns ?? []} value={value} onChange={onChange} readOnly={readOnly} />
        </Field>
      );
    case 'zoned_canvas':
      return (
        <Field label={b.label} required={b.required} missing={missing}>
          <ZonedCanvasField zones={b.zones ?? []} canvas={b.canvas} value={value} onChange={onChange} readOnly={readOnly} />
        </Field>
      );
    case 'media':
      return <MediaBlock kind={b.mediaKind} url={mediaUrl} name={b.label} />;
    case 'number':
      return (
        <Field label={b.label} required={b.required} missing={missing}>
          <Input
            value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''}
            onChangeText={onChange}
            // `decimal-pad`: iOS's plain numeric pad has no decimal key at all.
            keyboardType="decimal-pad"
            placeholder={f.answer}
            readOnly={readOnly}
          />
          {!readOnly && typeof value === 'string' ? <NumberReading text={value} /> : null}
        </Field>
      );
    case 'date':
      return (
        <Field label={b.label} required={b.required} missing={missing}>
          <DateField value={value} onChange={onChange} readOnly={readOnly} />
        </Field>
      );
    case 'short_text':
      return (
        <Field label={b.label} required={b.required} missing={missing}>
          <Input
            value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''}
            onChangeText={onChange}
            placeholder={f.answer}
            readOnly={readOnly}
          />
        </Field>
      );
    case 'long_text':
      return (
        <Field label={b.label} required={b.required} missing={missing}>
          <Input value={typeof value === 'string' ? value : ''} onChangeText={onChange} placeholder={f.write} multiline readOnly={readOnly} />
        </Field>
      );
    case 'yes_no':
      return (
        <Field label={b.label} required={b.required} missing={missing}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {(['yes', 'no'] as const).map((v) => (
              <Choice key={v} label={v === 'yes' ? f.yes : f.no} on={value === v} onPress={() => onChange(v)} flex readOnly={readOnly} />
            ))}
          </View>
        </Field>
      );
    case 'single_choice':
      return (
        <Field label={b.label} required={b.required} missing={missing}>
          <View style={{ gap: 8 }}>
            {(b.options ?? []).map((o) => <Choice key={o.id} label={o.label} on={value === o.id} onPress={() => onChange(o.id)} radio readOnly={readOnly} />)}
          </View>
        </Field>
      );
    case 'multi_choice': {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      const toggle = (oid: string) => onChange(arr.includes(oid) ? arr.filter((x) => x !== oid) : [...arr, oid]);
      return (
        <Field label={b.label} required={b.required} missing={missing}>
          <View style={{ gap: 8 }}>
            {(b.options ?? []).map((o) => <Choice key={o.id} label={o.label} on={arr.includes(o.id)} onPress={() => toggle(o.id)} checkbox readOnly={readOnly} />)}
          </View>
        </Field>
      );
    }
    case 'scale': {
      const min = b.scale?.min ?? 0;
      const max = b.scale?.max ?? 10;
      const step = b.scale?.step && b.scale.step > 0 ? b.scale.step : 1;
      // Counted in steps, not accumulated: adding 0.1 ten times is not 1 in
      // floating point, so a 0–1 scale showed 0.30000000000000004 and had no 1.
      // Rounded the way the web renders it, so a value answered there matches.
      const vals: number[] = [];
      const count = Math.floor((max - min) / step + 1e-9);
      for (let i = 0; i <= count && i < 1000; i++) vals.push(Math.round((min + i * step) * 1e6) / 1e6);
      return (
        <Field label={b.label} required={b.required} missing={missing}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {vals.map((n) => (
              <TouchableOpacity key={n} onPress={() => (readOnly ? undefined : onChange(n))} disabled={readOnly} activeOpacity={0.8} style={{ minWidth: 44, height: 44, paddingHorizontal: 10, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: value === n ? C.teal : C.card, borderWidth: 1, borderColor: value === n ? C.teal : C.border }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: value === n ? C.onTeal : C.ink }}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {(b.scale?.minLabel || b.scale?.maxLabel) && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
              <Text style={{ fontSize: 11.5, color: C.muted }}>{b.scale?.minLabel ?? ''}</Text>
              <Text style={{ fontSize: 11.5, color: C.muted }}>{b.scale?.maxLabel ?? ''}</Text>
            </View>
          )}
        </Field>
      );
    }
    default:
      return null;
  }
}

// The practitioner's framing for the piece — "why you are about to read this".
// It used to be plain body copy sitting directly above the content, so on a long
// read it looked like the opening paragraph and stopped reading as framing at
// all. A tinted card gives it a surface of its own and the eye a place to land
// before the material starts. EDA rather than CARE tokens: this renders inside
// the editorial screens, next to their green chips.
export function ResourceIntro({ text }: { text: string | null | undefined }) {
  const { t: TT } = useTheme();
  // A description is stored as sanitised HTML, like the rich_text blocks — so it
  // arrives carrying `&nbsp;` and `&amp;`, which were printed literally. The
  // block parser has always decoded these; a plain description never went
  // through it.
  const body = text ? decodeEntities(text).trim() : '';
  if (!body) return null;
  return (
    <View style={{ backgroundColor: TT.accentTint, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 22 }}>
      <Text style={{ fontSize: 15, color: TT.accentDeep, lineHeight: 23 }}>{body}</Text>
    </View>
  );
}

// A practitioner's rich_text arrives as sanitized HTML. RN has no innerHTML, so
// the markup is parsed into blocks (see ./html) and laid out here: paragraphs
// with air between them, list items as a marker column beside flexed text so
// wrapped lines hang-indent instead of sliding under the bullet.
export function RichText({ html }: { html: string }) {
  const C = useCare();
  const { locale } = useI18n();
  const quotes = QUOTES[locale] ?? QUOTES.en;
  const blocks = useMemo(() => parseRichText(html, { quotes }), [html, quotes]);

  if (blocks.length === 0) return null;

  return (
    <View style={{ marginBottom: 16 }}>
      {blocks.map((b, i) => {
        const last = i === blocks.length - 1;
        if (b.kind === 'item') {
          return (
            <View key={i} style={{ flexDirection: 'row', marginLeft: b.depth * 16, marginBottom: last ? 0 : ITEM_GAP }}>
              <Text style={[bodyStyle(C.ink), { minWidth: 20 }]}>{b.marker}</Text>
              <Text style={[bodyStyle(C.ink), { flex: 1 }]}><Spans spans={b.spans} /></Text>
            </View>
          );
        }
        if (b.kind === 'quote') {
          return (
            <View key={i} style={{ borderLeftWidth: 3, borderLeftColor: C.border, paddingLeft: 12, marginBottom: last ? 0 : PARAGRAPH_GAP }}>
              <Text style={[bodyStyle(C.ink), { fontStyle: 'italic' }]}><Spans spans={b.spans} /></Text>
            </View>
          );
        }
        return (
          <Text key={i} style={[bodyStyle(C.ink), { marginBottom: last ? 0 : PARAGRAPH_GAP }]}>
            <Spans spans={b.spans} />
          </Text>
        );
      })}
    </View>
  );
}

// Nested <Text> inherits from its parent, so each span only carries what it
// changes.
function Spans({ spans }: { spans: Span[] }) {
  const C = useCare();
  return (
    <>
      {spans.map((s, i) => (
        <Text
          key={i}
          style={{
            fontWeight: s.bold ? '700' : undefined,
            fontStyle: s.italic ? 'italic' : undefined,
            textDecorationLine: decoration(s),
            backgroundColor: s.mark ? C.mint : undefined,
            color: s.mark ? C.mintInk : s.href ? C.teal : undefined,
          }}
          onPress={s.href ? () => { void Linking.openURL(s.href as string); } : undefined}
        >
          {s.text}
        </Text>
      ))}
    </>
  );
}

function decoration(s: Span): 'underline' | 'line-through' | 'underline line-through' | undefined {
  const underline = s.underline || Boolean(s.href);
  if (underline && s.strike) return 'underline line-through';
  if (underline) return 'underline';
  if (s.strike) return 'line-through';
  return undefined;
}


// An image a practitioner attached, and the full-screen viewer behind it. A
// diagram or a worksheet photographed at A4 is unreadable at phone width, so the
// image opens on tap and can be enlarged.
//
// Zoom is driven three ways because no one way covers every platform here:
// pinch (ScrollView's own, iOS), double-tap, and explicit +/− buttons. The
// buttons are not a fallback so much as the only thing that works everywhere and
// is reachable without a gesture — proper pinch on Android needs
// react-native-gesture-handler, which is a native module and a new build.
function ZoomableImage({ url, ratio, name }: { url: string; ratio: number; name?: string }) {
  const f = useFieldCopy();
  const { t } = useI18n();
  const C = useCare();
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const { width, height } = useWindowDimensions();

  const close = () => { setOpen(false); setZoom(1); };
  const cycle = () => setZoom((z) => (z >= 3 ? 1 : z + 1));

  // Fit the image to the screen first, then scale that up. Zooming a
  // screen-width image would otherwise crop a tall one before it was readable.
  const fitWidth = Math.min(width, height * ratio);
  const shown = fitWidth * zoom;

  return (
    <>
      <TouchableOpacity activeOpacity={0.9} onPress={() => setOpen(true)} accessibilityLabel={name || f.image} accessibilityHint={f.opensLarger}>
        <View style={{ marginBottom: 16, borderRadius: 14, overflow: 'hidden', backgroundColor: C.card }}>
          <Image source={{ uri: url }} style={{ width: '100%', aspectRatio: ratio }} resizeMode="cover" />
        </View>
      </TouchableOpacity>

      <Modal visible={open} transparent={false} animationType="fade" onRequestClose={close} supportedOrientations={['portrait', 'landscape']}>
        <View style={{ flex: 1, backgroundColor: '#0B0B0B' }}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ minWidth: '100%', minHeight: '100%', alignItems: 'center', justifyContent: 'center' }}
            maximumZoomScale={4}
            minimumZoomScale={1}
            bouncesZoom
            centerContent
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            horizontal={false}
          >
            {/* Panning comes free once the image is wider or taller than the
                viewport, which is what makes "any part of the image" reachable. */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center', justifyContent: 'center' }}>
              <Pressable onPress={cycle}>
                <Image source={{ uri: url }} style={{ width: shown, height: shown / ratio }} resizeMode="contain" accessibilityLabel={name || f.image} />
              </Pressable>
            </ScrollView>
          </ScrollView>

          <View style={{ position: 'absolute', top: 44, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity onPress={close} hitSlop={10} accessibilityLabel={t.common.close} style={pill}>
              <X size={18} color={OVER_MEDIA.ink} />
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={() => setZoom((z) => Math.max(1, z - 1))} disabled={zoom <= 1} hitSlop={10} accessibilityLabel={t.common.zoomOut} style={[pill, { opacity: zoom <= 1 ? 0.4 : 1 }]}>
              <Minus size={18} color={OVER_MEDIA.ink} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setZoom((z) => Math.min(3, z + 1))} disabled={zoom >= 3} hitSlop={10} accessibilityLabel={t.common.zoomIn} style={[pill, { opacity: zoom >= 3 ? 0.4 : 1 }]}>
              <Plus size={18} color={OVER_MEDIA.ink} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const pill = { width: 40, height: 40, borderRadius: 20, backgroundColor: OVER_MEDIA.control, alignItems: 'center', justifyContent: 'center' } as const;

// A practitioner's image, video or audio. The URL is signed server-side (the
// app cannot sign anything itself), so no url means there is nothing to show.
//
// Images render inline. Video and audio open in the phone's own player: this
// project ships no video component, and a broken inline player is worse than a
// button that works.
function MediaBlock({ kind, url, name }: { kind?: string; url?: string; name?: string }) {
  const C = useCare();
  const f = useFieldCopy();
  const [ratio, setRatio] = useState(16 / 9);

  useEffect(() => {
    if (!url || (kind && kind !== 'image')) return;
    let alive = true;
    // The natural size is unknown until it loads; until then the placeholder
    // holds 16:9 so the page does not jump when it arrives.
    Image.getSize(url, (w, h) => { if (alive && w > 0 && h > 0) setRatio(w / h); }, () => {});
    return () => { alive = false; };
  }, [url, kind]);

  if (!url) {
    return (
      <View style={{ backgroundColor: C.card, borderRadius: 12, padding: 14, marginBottom: 16 }}>
        <Text style={{ fontSize: 13, color: C.muted }}>{f.mediaMissing}</Text>
      </View>
    );
  }

  if (kind === 'pdf') {
    return <PdfBlock url={url} name={name} />;
  }

  if (!kind || kind === 'image') {
    return <ZoomableImage url={url} ratio={ratio} name={name} />;
  }

  return (
    <MediaCard
      icon="play"
      name={name || (kind === 'audio' ? f.audio : f.video)}
      action={kind === 'audio' ? f.playAudio : f.playVideo}
      onPress={() => { void WebBrowser.openBrowserAsync(url); }}
    />
  );
}


// A PDF, opened without leaving the exercise.
//
// The three platforms need different machinery for the same result. On iOS,
// openBrowserAsync is an SFSafariViewController — an in-app sheet that renders
// the PDF and that the patient dismisses straight back onto this screen. On WEB
// it falls through to window.open and dumps them in a new tab, away from the
// exercise they were halfway through, so the web build gets a real modal with
// the PDF inside it.
//
// ANDROID looks like iOS and is not. openBrowserAsync there is a Chrome Custom
// Tab, which does not render PDFs at all: it downloads the file, or shows a
// blank page, and either way the exercise is over. So Android hands the url to
// the system, which has something that can actually open a PDF (Drive, Files,
// whichever reader is installed). Same promise every time: the document opens.
function PdfBlock({ url, name }: { url: string; name?: string }) {
  const f = useFieldCopy();
  const { t } = useI18n();
  const C = useCare();
  const [open, setOpen] = useState(false);
  const title = name && !looksLikeStorageKey(name) ? name : 'PDF';

  if (Platform.OS === 'android') {
    return (
      <MediaCard
        icon="pdf"
        name={name || 'PDF'}
        action={f.openPdf}
        // If nothing on the phone handles a PDF, fall back to the browser
        // rather than to nothing at all.
        onPress={() => { void Linking.openURL(url).catch(() => WebBrowser.openBrowserAsync(url)); }}
      />
    );
  }

  if (Platform.OS !== 'web') {
    return <MediaCard icon="pdf" name={name || 'PDF'} action={f.openPdf} onPress={() => { void WebBrowser.openBrowserAsync(url); }} />;
  }

  return (
    <>
      <MediaCard icon="pdf" name={name || 'PDF'} action={f.openPdf} onPress={() => setOpen(true)} />
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: C.scrim, padding: 16 }}>
          <View style={{ flex: 1, backgroundColor: C.sheet, borderRadius: 16, overflow: 'hidden', maxWidth: 900, width: '100%', alignSelf: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.border }}>
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, fontWeight: '700', color: C.ink }}>{title}</Text>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={10} accessibilityLabel={t.common.close}>
                <X size={18} color="#6A6A6A" />
              </TouchableOpacity>
            </View>
            {/* react-native-web renders a DOM element passed through
                createElement, which is the only way to embed a PDF here without
                pulling in a viewer dependency. */}
            {createElement('iframe', {
              src: url,
              title,
              style: { flex: 1, width: '100%', height: '100%', border: 'none' },
            })}
          </View>
        </View>
      </Modal>
    </>
  );
}

// A storage key is not a title: "69dd9f6420bec4.884_Guide_….pdf" tells a patient
// nothing, so the card says "Open PDF" instead.
const looksLikeStorageKey = (name: string): boolean => /^[0-9a-f]{8,}|\d{6,}/i.test(name);

// One row for anything that opens rather than renders inline. The file's own
// name is the title only when the practitioner gave it one — a storage filename
// like "69dd9f6420bec4.884_Guide_….pdf" is not a thing to show a patient.
function MediaCard({ icon, name, action, onPress }: { icon: 'pdf' | 'play'; name: string; action: string; onPress: () => void }) {
  const C = useCare();
  const looksLikeStorageName = looksLikeStorageKey(name);
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: C.border, borderRadius: 14, backgroundColor: C.card, padding: 14, marginBottom: 16 }}
    >
      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: icon === 'pdf' ? '#FDECEC' : C.mint, alignItems: 'center', justifyContent: 'center' }}>
        {icon === 'pdf' ? <FileText size={16} color="#C0392B" /> : <Play size={16} color={C.teal} />}
      </View>
      <View style={{ flex: 1 }}>
        {!looksLikeStorageName && <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '600', color: C.ink }}>{name}</Text>}
        <Text style={{ fontSize: looksLikeStorageName ? 15 : 12.5, fontWeight: looksLikeStorageName ? '600' : '400', color: looksLikeStorageName ? C.ink : C.muted }}>
          {action}
        </Text>
      </View>
      <ExternalLink size={16} color="#9A9A9A" />
    </TouchableOpacity>
  );
}

export function Field({ label, required, missing, children }: { label?: string; required?: boolean; missing: boolean; children: React.ReactNode }) {
  const C = useCare();
  const f = useFieldCopy();
  return (
    <View style={{ marginBottom: 20 }}>
      {label ? (
        <Text style={{ fontSize: 15, fontWeight: '600', color: missing ? C.danger : C.ink, marginBottom: 10 }}>
          {label}
          {required ? <Text style={{ color: C.danger }}> *</Text> : null}
        </Text>
      ) : null}
      {children}
      {missing ? <Text style={{ fontSize: 12, color: C.danger, marginTop: 6 }}>{f.required}</Text> : null}
    </View>
  );
}

interface TableColumn { id: string; label: string; type: string }
type TableRow = Record<string, string | number>;

// The server caps a table at 200 rows and silently drops the rest, so the UI
// stops there too rather than letting someone type into a row that will not
// survive the trip (apps/care/src/lib/resources/answers.ts).
const MAX_TABLE_ROWS = 200;

/**
 * A number cell that shows what is being typed. The cell used to re-render from
 * the parsed number on every keystroke, so "3." became "3", "-" vanished, and
 * "3," emptied the cell — a decimal or a negative could not be entered at all.
 * The stored value is still a number (or absent), exactly as before.
 */
function NumberCell({ value, onChange, readOnly }: { value: unknown; onChange: (text: string) => void; readOnly?: boolean }) {
  const [text, setText] = useState(value != null ? String(value) : '');
  return (
    <>
      <Input
        value={text}
        onChangeText={(t) => { setText(t); onChange(t); }}
        keyboardType="numbers-and-punctuation"
        placeholder="0"
        readOnly={readOnly}
      />
      {!readOnly ? <NumberReading text={text} /> : null}
    </>
  );
}

/**
 * What a typed number will be stored as, said under the field. "1,234" is a
 * thousand in English and one and a bit in French, and a number the server
 * cannot read is dropped; either used to happen with nothing on screen. Shown
 * only when the reading is not simply the digits typed.
 */
function NumberReading({ text }: { text: string }) {
  const C = useCare();
  const f = useFieldCopy();
  const { locale } = useI18n();
  const typed = text.trim();
  if (!typed || typed === '-' || typed === '+') return null;
  const n = parseTypedNumber(typed, locale);
  if (n === undefined) return <Text style={{ fontSize: 12, color: C.danger, marginTop: 6 }}>{f.notANumber}</Text>;
  if (/^-?\d+$/.test(typed)) return null;
  return <Text style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>{f.readAs.replace('{n}', formatReadNumber(n, locale))}</Text>;
}

const TABLE_COPY = {
  en: { addRow: 'Add row', row: 'Row', remove: 'Remove row', noColumns: 'This table has no columns yet.', empty: 'Nothing added yet.' },
  fr: { addRow: 'Ajouter une ligne', row: 'Ligne', remove: 'Supprimer la ligne', noColumns: 'Ce tableau n’a pas encore de colonnes.', empty: 'Rien pour l’instant.' },
} as const;

/**
 * A table answer, laid out for a phone. The web renders a real <table> with a
 * column per field, which is right on a wide screen and unusable on a narrow
 * one: three or four columns leave each cell too small to read what you typed.
 * So a row becomes a CARD with its columns stacked as labelled fields — the
 * pattern phones use for repeating groups.
 *
 * The stored value is identical to the web's either way — an array of row
 * objects keyed by column id, numbers stored as numbers, empty cells absent —
 * so a table filled in on the phone opens correctly in the practitioner's
 * browser, and one started on the web can be finished on the phone.
 */
function TableField({ columns, value, onChange, readOnly }: { columns: TableColumn[]; value: unknown; onChange: (v: unknown) => void; readOnly?: boolean }) {
  const C = useCare();
  const { locale } = useI18n();
  const t = TABLE_COPY[locale] ?? TABLE_COPY.en;
  const rows: TableRow[] = Array.isArray(value) ? (value as TableRow[]) : [];

  if (columns.length === 0) {
    return (
      <View style={{ backgroundColor: C.card, borderRadius: 12, padding: 14 }}>
        <Text style={{ fontSize: 13, color: C.muted }}>{t.noColumns}</Text>
      </View>
    );
  }

  // Mirrors the web cell exactly: a number column stores a number, and a cleared
  // or unparseable cell drops its key instead of storing an empty string, which
  // is what lets the server tell a blank row from a filled one.
  const setCell = (index: number, column: TableColumn, raw: string) => {
    const next = rows.map((row, i) => {
      if (i !== index) return row;
      const copy: TableRow = { ...row };
      if (column.type === 'number') {
        // Read as the server reads it, in the patient's language (src/resources/number).
        const n = raw === '' ? undefined : parseTypedNumber(raw, locale);
        if (n !== undefined) copy[column.id] = n;
        else delete copy[column.id];
      } else if (raw === '') {
        delete copy[column.id];
      } else {
        copy[column.id] = raw;
      }
      return copy;
    });
    onChange(next);
  };

  return (
    <View style={{ gap: 10 }}>
      {rows.length === 0 && <Text style={{ fontSize: 13, color: C.muted }}>{t.empty}</Text>}

      {rows.map((row, i) => (
        <View key={i} style={{ borderWidth: 1, borderColor: C.border, borderRadius: 14, backgroundColor: C.card, padding: 12, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: C.muted }}>{t.row} {i + 1}</Text>
            {!readOnly && (
              <TouchableOpacity onPress={() => onChange(rows.filter((_, idx) => idx !== i))} hitSlop={8} accessibilityLabel={t.remove}>
                <X size={16} color="#9A9A9A" />
              </TouchableOpacity>
            )}
          </View>
          {columns.map((c) => (
            <View key={c.id} style={{ gap: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: C.ink }}>{c.label}</Text>
              {c.type === 'number' ? (
                <NumberCell value={row[c.id]} onChange={(text) => setCell(i, c, text)} readOnly={readOnly} />
              ) : (
                <Input
                  value={row[c.id] != null ? String(row[c.id]) : ''}
                  onChangeText={(text) => setCell(i, c, text)}
                  readOnly={readOnly}
                />
              )}
            </View>
          ))}
        </View>
      ))}

      {!readOnly && rows.length < MAX_TABLE_ROWS && (
        <TouchableOpacity
          onPress={() => onChange([...rows, {}])}
          activeOpacity={0.8}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: C.border, borderStyle: 'dashed', borderRadius: 14, paddingVertical: 14 }}
        >
          <Plus size={16} color={C.teal} />
          <Text style={{ fontSize: 14.5, fontWeight: '600', color: C.ink }}>{t.addRow}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function Input({ value, onChangeText, placeholder, multiline, keyboardType, readOnly }: { value: string; onChangeText: (t: string) => void; placeholder?: string; multiline?: boolean; keyboardType?: 'default' | 'numeric' | 'decimal-pad' | 'numbers-and-punctuation'; readOnly?: boolean }) {
  const C = useCare();
  return (
    <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 14, backgroundColor: C.card, paddingHorizontal: 14, paddingVertical: 12 }}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#BBB"
        multiline={multiline}
        keyboardType={keyboardType}
        editable={!readOnly}
        style={[{ fontSize: 15, color: C.ink, lineHeight: 22, minHeight: multiline ? 96 : undefined, textAlignVertical: multiline ? 'top' : 'center' }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as never) : null]}
      />
    </View>
  );
}

function Choice({ label, on, onPress, radio, checkbox, flex, readOnly }: { label: string; on: boolean; onPress: () => void; radio?: boolean; checkbox?: boolean; flex?: boolean; readOnly?: boolean }) {
  const C = useCare();
  return (
    <TouchableOpacity
      onPress={readOnly ? undefined : onPress}
      disabled={readOnly}
      activeOpacity={0.8}
      style={{ flex: flex ? 1 : undefined, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: on ? `${C.teal}0F` : C.card, borderWidth: 1.5, borderColor: on ? C.teal : C.border, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 15, justifyContent: flex ? 'center' : 'flex-start' }}
    >
      {(radio || checkbox) && (
        <View style={{ width: 20, height: 20, borderRadius: checkbox ? 6 : 10, borderWidth: 2, borderColor: on ? C.teal : C.border, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? C.teal : 'transparent' }}>
          {on && <Check size={12} color={C.onTeal} strokeWidth={3} />}
        </View>
      )}
      <Text style={{ fontSize: 15, fontWeight: '600', color: on ? C.teal : C.ink }}>{label}</Text>
    </TouchableOpacity>
  );
}
