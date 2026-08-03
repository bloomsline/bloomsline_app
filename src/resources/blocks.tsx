// Shared resource block renderer — used by the assigned-worksheet flow
// (app/(app)/resource/[id]) and the self-guided Library flow (library-practice).
// Renders content blocks + every interactive input; collects answers keyed by
// block id (owned by the parent screen).
import { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Check, Paperclip, Upload, X } from 'lucide-react-native';
import { CARE } from '@/src/care/theme';
import { EDA } from '@/src/ui/editorial';
import { useI18n } from '@/src/i18n';
import { htmlToPlainText, parseRichText, type Span } from '@/src/resources/html';
import { uploadResponseFile, type PatientBlock, type UploadedFile } from '@/src/api/resources';

export const INTERACTIVE = new Set(['short_text', 'long_text', 'single_choice', 'multi_choice', 'scale', 'yes_no', 'number', 'date', 'table', 'file_upload']);

// Reading material runs long — the practitioner's relaxation script is 14 blocks
// — so body copy is sized for sustained reading rather than for form labels.
const BODY = { fontSize: 16, color: '#3A3A3A', lineHeight: 26 } as const;
const PARAGRAPH_GAP = 12;
const ITEM_GAP = 7;

// The web picks « » vs “ ” from <html lang>; there is no equivalent here, so
// the pair is chosen per locale. Module-level to keep the reference stable.
const QUOTES = { en: ['\u201c', '\u201d'], fr: ['\u00ab\u00a0', '\u00a0\u00bb'] } as const;

export function Block({ block, value, onChange, missing }: { block: PatientBlock; value: unknown; onChange: (v: unknown) => void; missing: boolean }) {
  const b = block;
  switch (b.type) {
    case 'heading':
      // Sections are the handholds in a long read: more air above than below, so
      // a heading reads as belonging to what follows it.
      return <Text style={{ fontSize: 19, fontWeight: '700', color: CARE.ink, marginTop: 22, marginBottom: 10 }}>{htmlToPlainText(b.text ?? '')}</Text>;
    case 'rich_text':
      return <RichText html={b.text ?? ''} />;
    case 'divider':
      return <View style={{ height: 1, backgroundColor: '#ECECEC', marginVertical: 14 }} />;
    case 'file_upload':
      return (
        <Field label={b.label} required={b.required} missing={missing}>
          <FileUploadField value={value as UploadedFile | undefined} onChange={onChange} />
        </Field>
      );
    case 'media':
    case 'table':
      return (
        <Field label={b.label} required={b.required} missing={missing}>
          <View style={{ backgroundColor: '#F6F6F4', borderRadius: 12, padding: 14 }}>
            <Text style={{ fontSize: 13, color: '#9A9A9A' }}>{b.type === 'table' ? 'Table' : 'Media'} — open this one in the web app for now.</Text>
          </View>
        </Field>
      );
    case 'short_text':
    case 'number':
    case 'date':
      return (
        <Field label={b.label} required={b.required} missing={missing}>
          <Input
            value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''}
            onChangeText={onChange}
            keyboardType={b.type === 'number' ? 'numeric' : 'default'}
            placeholder={b.type === 'date' ? 'YYYY-MM-DD' : 'Your answer'}
          />
        </Field>
      );
    case 'long_text':
      return (
        <Field label={b.label} required={b.required} missing={missing}>
          <Input value={typeof value === 'string' ? value : ''} onChangeText={onChange} placeholder="Write here…" multiline />
        </Field>
      );
    case 'yes_no':
      return (
        <Field label={b.label} required={b.required} missing={missing}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {(['yes', 'no'] as const).map((v) => (
              <Choice key={v} label={v === 'yes' ? 'Yes' : 'No'} on={value === v} onPress={() => onChange(v)} flex />
            ))}
          </View>
        </Field>
      );
    case 'single_choice':
      return (
        <Field label={b.label} required={b.required} missing={missing}>
          <View style={{ gap: 8 }}>
            {(b.options ?? []).map((o) => <Choice key={o.id} label={o.label} on={value === o.id} onPress={() => onChange(o.id)} radio />)}
          </View>
        </Field>
      );
    case 'multi_choice': {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      const toggle = (oid: string) => onChange(arr.includes(oid) ? arr.filter((x) => x !== oid) : [...arr, oid]);
      return (
        <Field label={b.label} required={b.required} missing={missing}>
          <View style={{ gap: 8 }}>
            {(b.options ?? []).map((o) => <Choice key={o.id} label={o.label} on={arr.includes(o.id)} onPress={() => toggle(o.id)} checkbox />)}
          </View>
        </Field>
      );
    }
    case 'scale': {
      const min = b.scale?.min ?? 0;
      const max = b.scale?.max ?? 10;
      const step = b.scale?.step && b.scale.step > 0 ? b.scale.step : 1;
      const vals: number[] = [];
      for (let n = min; n <= max; n += step) vals.push(n);
      return (
        <Field label={b.label} required={b.required} missing={missing}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {vals.map((n) => (
              <TouchableOpacity key={n} onPress={() => onChange(n)} activeOpacity={0.8} style={{ minWidth: 44, height: 44, paddingHorizontal: 10, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: value === n ? CARE.teal : '#fff', borderWidth: 1, borderColor: value === n ? CARE.teal : CARE.border }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: value === n ? '#fff' : CARE.ink }}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {(b.scale?.minLabel || b.scale?.maxLabel) && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
              <Text style={{ fontSize: 11.5, color: '#9A9A9A' }}>{b.scale?.minLabel ?? ''}</Text>
              <Text style={{ fontSize: 11.5, color: '#9A9A9A' }}>{b.scale?.maxLabel ?? ''}</Text>
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
  const body = text?.trim();
  if (!body) return null;
  return (
    <View style={{ backgroundColor: EDA.greenTint, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 22 }}>
      <Text style={{ fontSize: 15, color: EDA.greenDeep, lineHeight: 23 }}>{body}</Text>
    </View>
  );
}

// A practitioner's rich_text arrives as sanitized HTML. RN has no innerHTML, so
// the markup is parsed into blocks (see ./html) and laid out here: paragraphs
// with air between them, list items as a marker column beside flexed text so
// wrapped lines hang-indent instead of sliding under the bullet.
export function RichText({ html }: { html: string }) {
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
              <Text style={[BODY, { minWidth: 20 }]}>{b.marker}</Text>
              <Text style={[BODY, { flex: 1 }]}><Spans spans={b.spans} /></Text>
            </View>
          );
        }
        if (b.kind === 'quote') {
          return (
            <View key={i} style={{ borderLeftWidth: 3, borderLeftColor: CARE.border, paddingLeft: 12, marginBottom: last ? 0 : PARAGRAPH_GAP }}>
              <Text style={[BODY, { fontStyle: 'italic' }]}><Spans spans={b.spans} /></Text>
            </View>
          );
        }
        return (
          <Text key={i} style={[BODY, { marginBottom: last ? 0 : PARAGRAPH_GAP }]}>
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
  return (
    <>
      {spans.map((s, i) => (
        <Text
          key={i}
          style={{
            fontWeight: s.bold ? '700' : undefined,
            fontStyle: s.italic ? 'italic' : undefined,
            textDecorationLine: decoration(s),
            backgroundColor: s.mark ? CARE.mint : undefined,
            color: s.mark ? CARE.mintInk : s.href ? CARE.teal : undefined,
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

export function Field({ label, required, missing, children }: { label?: string; required?: boolean; missing: boolean; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 20 }}>
      {label ? (
        <Text style={{ fontSize: 15, fontWeight: '600', color: missing ? CARE.danger : CARE.ink, marginBottom: 10 }}>
          {label}
          {required ? <Text style={{ color: CARE.danger }}> *</Text> : null}
        </Text>
      ) : null}
      {children}
      {missing ? <Text style={{ fontSize: 12, color: CARE.danger, marginTop: 6 }}>This one is required.</Text> : null}
    </View>
  );
}

function humanSize(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function byteSize(uri: string): Promise<number> {
  try {
    return (await (await fetch(uri)).blob()).size;
  } catch {
    return 0;
  }
}

// A patient file-upload answer. Picks a photo/video from the library (works on
// web and native), uploads straight to storage, and stores the { key, ... }
// descriptor the server expects. Video covers the common "film yourself" case.
function FileUploadField({ value, onChange }: { value: UploadedFile | undefined; onChange: (v: unknown) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async () => {
    setError(null);
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 1, allowsMultipleSelection: false });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    const isVideo = a.type === 'video';
    const name = a.fileName ?? (isVideo ? 'video.mp4' : 'photo.jpg');
    const type = a.mimeType ?? (isVideo ? 'video/mp4' : 'image/jpeg');
    const size = a.fileSize ?? (await byteSize(a.uri));
    setBusy(true);
    try {
      const uploaded = await uploadResponseFile({ uri: a.uri, name, type, size });
      if (!uploaded) { setError('Upload failed. Please try again.'); return; }
      onChange(uploaded);
    } catch {
      setError('Upload failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (busy) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: CARE.border, borderRadius: 14, backgroundColor: '#fff', padding: 14 }}>
        <ActivityIndicator color={CARE.teal} />
        <Text style={{ fontSize: 14, color: '#6A6A6A' }}>Uploading…</Text>
      </View>
    );
  }

  if (value?.key) {
    return (
      <View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: CARE.teal, borderRadius: 14, backgroundColor: `${CARE.teal}0F`, padding: 14 }}>
          <Paperclip size={16} color={CARE.teal} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '600', color: CARE.ink }}>{value.name}</Text>
            {value.size ? <Text style={{ fontSize: 12, color: '#9A9A9A', marginTop: 2 }}>{humanSize(value.size)}</Text> : null}
          </View>
          <TouchableOpacity onPress={() => onChange(undefined)} hitSlop={8} accessibilityLabel="Remove file">
            <X size={18} color="#9A9A9A" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={pick} activeOpacity={0.8} style={{ marginTop: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: CARE.teal }}>Replace</Text>
        </TouchableOpacity>
        {error ? <Text style={{ fontSize: 12, color: CARE.danger, marginTop: 6 }}>{error}</Text> : null}
      </View>
    );
  }

  return (
    <View>
      <TouchableOpacity onPress={pick} activeOpacity={0.85} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1.5, borderColor: CARE.border, borderStyle: 'dashed', borderRadius: 14, backgroundColor: '#fff', paddingVertical: 18 }}>
        <Upload size={18} color={CARE.teal} />
        <Text style={{ fontSize: 15, fontWeight: '600', color: CARE.ink }}>Upload a photo or video</Text>
      </TouchableOpacity>
      {error ? <Text style={{ fontSize: 12, color: CARE.danger, marginTop: 6 }}>{error}</Text> : null}
    </View>
  );
}

function Input({ value, onChangeText, placeholder, multiline, keyboardType }: { value: string; onChangeText: (t: string) => void; placeholder?: string; multiline?: boolean; keyboardType?: 'default' | 'numeric' }) {
  return (
    <View style={{ borderWidth: 1, borderColor: CARE.border, borderRadius: 14, backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 12 }}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#BBB"
        multiline={multiline}
        keyboardType={keyboardType}
        style={[{ fontSize: 15, color: CARE.ink, lineHeight: 22, minHeight: multiline ? 96 : undefined, textAlignVertical: multiline ? 'top' : 'center' }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as never) : null]}
      />
    </View>
  );
}

function Choice({ label, on, onPress, radio, checkbox, flex }: { label: string; on: boolean; onPress: () => void; radio?: boolean; checkbox?: boolean; flex?: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{ flex: flex ? 1 : undefined, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: on ? `${CARE.teal}0F` : '#fff', borderWidth: 1.5, borderColor: on ? CARE.teal : CARE.border, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 15, justifyContent: flex ? 'center' : 'flex-start' }}
    >
      {(radio || checkbox) && (
        <View style={{ width: 20, height: 20, borderRadius: checkbox ? 6 : 10, borderWidth: 2, borderColor: on ? CARE.teal : '#CCC', alignItems: 'center', justifyContent: 'center', backgroundColor: on ? CARE.teal : 'transparent' }}>
          {on && <Check size={12} color="#fff" strokeWidth={3} />}
        </View>
      )}
      <Text style={{ fontSize: 15, fontWeight: '600', color: on ? CARE.teal : CARE.ink }}>{label}</Text>
    </TouchableOpacity>
  );
}
