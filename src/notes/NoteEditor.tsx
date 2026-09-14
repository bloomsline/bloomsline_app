import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { Bold, Italic, List, Minus, Quote, Tag as TagIcon, X } from 'lucide-react-native';
import type { NoteRange } from '@/src/api/practitioner';
import { useTheme } from '@/src/ui/theme-mode';
import { useI18n } from '@/src/i18n';
import { RichText } from '@/src/resources/blocks';

// The note editor, as close to the care app's as a phone allows.
//
// The web uses contentEditable and execCommand. React Native has neither, so
// this works the other way round: the text stays plain, and formatting is a list
// of MARKED RANGES over it. Select a sentence, tap Tag, and that sentence is
// tagged — which is the capability that matters, and the one a whole-note label
// cannot give you. The server composes the ranges into the same markup the web
// stores (lib/notes/compose).
//
// Marks are kept sorted and non-overlapping PER TYPE: applying a tag over a
// range that already has one replaces it, exactly as re-tagging does on the web,
// so the same text can never carry two contradictory tags.
export interface EditorTag { slug: string; label: string }

const NOTE_COPY = {
  en: {
    minimize: 'Minimize', close: 'Close', discard: 'Discard draft', bold: 'Bold', italic: 'Italic', bullet: 'Bullet list',
    quote: 'Quote', tag: 'Tag', templates: 'Templates', tagHeading: 'TAG THE SELECTED TEXT', removeTag: 'Remove tag',
    body: 'Write a note for this session…', save: 'Save note',
    hint: 'Select a sentence to tag, quote or format it.',
    simplified: 'This note was formatted on the web. Headings, numbered lists and links show here as plain text, and saving a change keeps them that way.',
    appendNotice: 'This note was formatted on the web, so here you add to it. What you write goes after the note, which stays as it is. Edit the whole note on the web.',
    appendBody: 'Add to this note…', appendSave: 'Add to note', theNote: 'THE NOTE SO FAR',
  },
  fr: {
    minimize: 'Réduire', close: 'Fermer', discard: 'Supprimer le brouillon', bold: 'Gras', italic: 'Italique', bullet: 'Liste à puces',
    quote: 'Citation', tag: 'Étiquette', templates: 'Modèles', tagHeading: 'ÉTIQUETER LE TEXTE SÉLECTIONNÉ', removeTag: 'Retirer l’étiquette',
    body: 'Rédigez une note pour cette séance…', save: 'Enregistrer la note',
    hint: 'Sélectionnez une phrase pour l’étiqueter, la citer ou la mettre en forme.',
    simplified: 'Cette note a été mise en forme sur le web. Les titres, listes numérotées et liens apparaissent ici en texte simple, et enregistrer une modification les garde ainsi.',
    appendNotice: 'Cette note a été mise en forme sur le web : ici, vous la complétez. Ce que vous écrivez s’ajoute après la note, qui reste telle quelle. Modifiez la note entière sur le web.',
    appendBody: 'Compléter cette note…', appendSave: 'Ajouter à la note', theNote: 'LA NOTE JUSQU’ICI',
  },
} as const;

export function NoteEditor({
  text, ranges, noteType, noteTypes, tags, templates, saving, error, simplified, appendToHtml,
  onText, onRanges, onNoteType, onSave, onMinimize, onCancel, onDiscard, statusLine, header,
}: {
  text: string;
  ranges: NoteRange[];
  noteType: string;
  noteTypes: string[];
  tags: EditorTag[];
  templates: { id: string; label: string; body: string }[];
  saving: boolean;
  error: string;
  /** The note carries formatting only the web can write. */
  simplified?: boolean;
  /** Adding to a web-formatted note: the note as stored, shown above the field,
   *  which then holds only what is added. */
  appendToHtml?: string;
  onText: (v: string) => void;
  onRanges: (r: NoteRange[]) => void;
  onNoteType: (v: string) => void;
  onSave: () => void;
  onMinimize: () => void;
  /** Leaves the editor and KEEPS the writing. Not destructive. */
  onCancel: () => void;
  /** Throws the writing away. Destructive, so the caller confirms. */
  onDiscard?: () => void;
  /** Whether the unfinished note is safe, shown under the header. */
  statusLine?: string;
  header: string;
}) {
  const { t: TT } = useTheme();
  const { locale } = useI18n();
  const c = NOTE_COPY[locale] ?? NOTE_COPY.en;
  const [sel, setSel] = useState({ start: 0, end: 0 });
  const [tagOpen, setTagOpen] = useState(false);
  const [tplOpen, setTplOpen] = useState(false);
  const hasSelection = sel.end > sel.start;

  // Which tags are already used, so the footer can show them the way the web's
  // "Tags" summary does.
  const usedTags = useMemo(() => {
    const slugs = new Set(ranges.filter((r) => r.type === 'tag' && r.slug).map((r) => r.slug as string));
    return tags.filter((t) => slugs.has(t.slug));
  }, [ranges, tags]);

  /** Drop anything of this type overlapping [start,end) — re-marking replaces. */
  const without = (list: NoteRange[], type: NoteRange['type'], start: number, end: number) =>
    list.filter((r) => r.type !== type || r.end <= start || r.start >= end);

  const applyMark = (type: NoteRange['type'], slug?: string) => {
    if (!hasSelection) return;
    const cleaned = without(ranges, type, sel.start, sel.end);
    onRanges([...cleaned, { start: sel.start, end: sel.end, type, ...(slug ? { slug } : {}) }]);
    setTagOpen(false);
  };

  const clearMark = (type: NoteRange['type']) => {
    if (!hasSelection) return;
    onRanges(without(ranges, type, sel.start, sel.end));
  };

  const marked = (type: NoteRange['type']) =>
    hasSelection && ranges.some((r) => r.type === type && r.start <= sel.start && r.end >= sel.end);

  // A list is written as "- " lines, which is what the composer turns into <ul>.
  const bulletLine = () => {
    const before = text.slice(0, sel.start);
    const lineStart = before.lastIndexOf('\n') + 1;
    const line = text.slice(lineStart);
    if (line.startsWith('- ')) return;
    onText(`${text.slice(0, lineStart)}- ${text.slice(lineStart)}`);
    // Every mark after the insertion point shifts by the two characters added.
    onRanges(ranges.map((r) => (r.start >= lineStart ? { ...r, start: r.start + 2, end: r.end + 2 } : r)));
  };

  const insertTemplate = (body: string) => {
    // Trim the END only: trimming the front moved every character under the
    // marks laid on them.
    const kept = text.replace(/\s+$/, '');
    const next = kept ? `${kept}\n\n${body}` : body;
    onRanges(kept ? ranges.filter((r) => r.start < kept.length).map((r) => ({ ...r, end: Math.min(r.end, kept.length) })) : []);
    onText(next);
    setTplOpen(false);
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Title bar — minimise and close, like the care modal's − and ×. Closing
          KEEPS the writing, which is why there is no confirmation on it and why
          the status line below says so rather than a dialog asserting it. */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingBottom: 14 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: TT.ink }}>{header}</Text>
          {statusLine ? <Text style={{ fontSize: 11.5, color: TT.faint, marginTop: 2 }}>{statusLine}</Text> : null}
        </View>
        <Pressable onPress={onMinimize} hitSlop={10} accessibilityLabel={c.minimize}>
          <Minus size={20} color={TT.inkSoft} />
        </Pressable>
        <Pressable onPress={onCancel} hitSlop={10} accessibilityLabel={c.close}>
          <X size={20} color={TT.inkSoft} />
        </Pressable>
      </View>

      {/* The one destructive path, so the only one that asks. Kept away from the
          Close control on purpose. */}
      {onDiscard ? (
        <Pressable onPress={onDiscard} hitSlop={8} style={{ alignSelf: 'flex-start', paddingBottom: 10 }}>
          <Text style={{ fontSize: 12.5, fontWeight: '600', color: TT.faint }}>{c.discard}</Text>
        </Pressable>
      ) : null}

      {/* Said before the note is changed, not discovered on the web afterwards.
          Saved unchanged, the server keeps the note's formatting as it was. */}
      {appendToHtml !== undefined ? (
        <>
          <View style={{ backgroundColor: TT.accentTint, borderRadius: 12, padding: 12, marginBottom: 12 }}>
            <Text style={{ fontSize: 12.5, lineHeight: 18, color: TT.accentDeep }}>{c.appendNotice}</Text>
          </View>
          <Text style={{ fontSize: 11.5, fontWeight: '700', color: TT.faint, marginBottom: 6 }}>{c.theNote}</Text>
          <View style={{ borderWidth: 1, borderColor: TT.line, borderRadius: 16, backgroundColor: TT.card, paddingHorizontal: 14, paddingTop: 12, marginBottom: 14 }}>
            <RichText html={appendToHtml} />
          </View>
        </>
      ) : simplified ? (
        <View style={{ backgroundColor: TT.accentTint, borderRadius: 12, padding: 12, marginBottom: 10 }}>
          <Text style={{ fontSize: 12.5, lineHeight: 18, color: TT.accentDeep }}>{c.simplified}</Text>
        </View>
      ) : null}

      {/* Toolbar. Formatting acts on the SELECTION, so it is disabled without
          one rather than silently doing nothing. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: TT.line, backgroundColor: TT.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 10, paddingVertical: 8 }}>
        <ToolButton Icon={Bold} on={marked('bold')} disabled={!hasSelection} onPress={() => (marked('bold') ? clearMark('bold') : applyMark('bold'))} label={c.bold} />
        <ToolButton Icon={Italic} on={marked('italic')} disabled={!hasSelection} onPress={() => (marked('italic') ? clearMark('italic') : applyMark('italic'))} label={c.italic} />
        <View style={{ width: 1, height: 20, backgroundColor: TT.line, marginHorizontal: 2 }} />
        <ToolButton Icon={List} on={false} disabled={false} onPress={bulletLine} label={c.bullet} />
        <ToolButton Icon={Quote} on={marked('quote')} disabled={!hasSelection} onPress={() => (marked('quote') ? clearMark('quote') : applyMark('quote'))} label={c.quote} />
        <ToolButton Icon={TagIcon} on={tagOpen} disabled={!hasSelection} onPress={() => setTagOpen((v) => !v)} label={c.tag} />
        <View style={{ flex: 1 }} />
        {templates.length > 0 && (
          <Pressable onPress={() => setTplOpen((v) => !v)} hitSlop={8}>
            <Text style={{ fontSize: 12.5, fontWeight: '700', color: TT.accent }}>{c.templates}</Text>
          </Pressable>
        )}
      </View>

      {tplOpen && (
        <View style={{ borderWidth: 1, borderTopWidth: 0, borderColor: TT.line, backgroundColor: TT.card, paddingHorizontal: 10, paddingVertical: 8, gap: 6 }}>
          {templates.map((t) => (
            <Pressable key={t.id} onPress={() => insertTemplate(t.body)} style={{ paddingVertical: 7 }}>
              <Text style={{ fontSize: 14, color: TT.ink }}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {tagOpen && (
        <View style={{ borderWidth: 1, borderTopWidth: 0, borderColor: TT.line, backgroundColor: TT.card, paddingHorizontal: 10, paddingVertical: 10 }}>
          <Text style={{ fontSize: 11.5, fontWeight: '700', color: TT.faint, marginBottom: 8 }}>{c.tagHeading}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {tags.map((t) => (
              <Pressable key={t.slug} onPress={() => applyMark('tag', t.slug)} style={{ borderRadius: 14, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: TT.accentTint, borderWidth: 1, borderColor: TT.accent }}>
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: TT.accentDeep, textTransform: 'capitalize' }}>{t.label}</Text>
              </Pressable>
            ))}
            {marked('tag') && (
              <Pressable onPress={() => clearMark('tag')} style={{ borderRadius: 14, paddingHorizontal: 11, paddingVertical: 7, borderWidth: 1, borderColor: TT.line }}>
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: TT.inkSoft }}>{c.removeTag}</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* No title field. A session note has none on the web, and a title typed
          here reopened as a bold first line with the field empty. */}

      <View style={{ borderWidth: 1, borderTopWidth: 0, borderColor: TT.line, backgroundColor: TT.card, borderBottomLeftRadius: 16, borderBottomRightRadius: 16, paddingHorizontal: 14, paddingVertical: 12 }}>
        <TextInput
          value={text}
          onChangeText={(v) => {
            // Marks index into the text, so they move with every edit. They used
            // to stay on the same character positions: type "Today " before a
            // tagged phrase and the tag slid onto "Today felt aban".
            const moved = shiftRanges(text, v, ranges);
            if (moved !== ranges) onRanges(moved);
            onText(v);
          }}
          onSelectionChange={(e) => setSel(e.nativeEvent.selection)}
          placeholder={appendToHtml !== undefined ? c.appendBody : c.body}
          placeholderTextColor={TT.faint}
          multiline
          textAlignVertical="top"
          style={{ minHeight: 200, fontSize: 15.5, lineHeight: 24, color: TT.ink }}
        />
      </View>

      {!hasSelection && (
        <Text style={{ fontSize: 12, color: TT.faint, marginTop: 8 }}>{c.hint}</Text>
      )}

      {/* No note-type chips. A phone note is always the session's note — the
          server saves it as the session summary whatever type is picked — so the
          chips were a choice that changed nothing, labelled with raw slugs. */}

      {/* The footer's tag summary, as the care modal has bottom-left. */}
      {usedTags.length > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 16 }}>
          <TagIcon size={13} color={TT.faint} />
          {usedTags.map((t) => (
            <View key={t.slug} style={{ borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: TT.accentTint }}>
              <Text style={{ fontSize: 11.5, fontWeight: '700', color: TT.accentDeep, textTransform: 'capitalize' }}>{t.label}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 22 }}>
        <Pressable onPress={onCancel} style={{ flex: 1, height: 50, borderRadius: 25, borderWidth: 1.5, borderColor: TT.line, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: TT.inkSoft }}>{c.close}</Text>
        </Pressable>
        <Pressable
          onPress={onSave}
          disabled={saving || !text.trim()}
          style={{ flex: 1.4, height: 50, borderRadius: 25, backgroundColor: TT.accent, alignItems: 'center', justifyContent: 'center', opacity: saving || !text.trim() ? 0.45 : 1 }}
        >
          {saving ? <ActivityIndicator color={TT.onAccent} size="small" /> : <Text style={{ fontSize: 15, fontWeight: '700', color: TT.onAccent }}>{appendToHtml !== undefined ? c.appendSave : c.save}</Text>}
        </Pressable>
      </View>
      {error ? <Text style={{ fontSize: 13.5, color: TT.danger, marginTop: 12 }}>{error}</Text> : null}
      <View style={{ height: 30 }} />
    </View>
  );
}

function ToolButton({ Icon, on, disabled, onPress, label }: { Icon: typeof Bold; on: boolean; disabled: boolean; onPress: () => void; label: string }) {
  const { t: TT } = useTheme();
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityLabel={label}
      style={{ height: 34, width: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? TT.accentTint : 'transparent', opacity: disabled ? 0.35 : 1 }}
    >
      <Icon size={16} color={on ? TT.accent : TT.ink} strokeWidth={2} />
    </Pressable>
  );
}

/**
 * Move marks to follow an edit. The edit is found as the span between the text's
 * unchanged beginning and unchanged end; marks after it shift by the change in
 * length, marks it cuts into are clipped to it, and marks that end up empty go.
 * Typing inside a marked phrase grows the mark; typing right after one does not.
 * Returns the same array when nothing moved.
 */
export function shiftRanges(prev: string, next: string, ranges: NoteRange[]): NoteRange[] {
  if (prev === next || ranges.length === 0) return ranges;
  let start = 0;
  while (start < prev.length && start < next.length && prev[start] === next[start]) start++;
  let endPrev = prev.length;
  let endNext = next.length;
  while (endPrev > start && endNext > start && prev[endPrev - 1] === next[endNext - 1]) { endPrev--; endNext--; }
  const delta = endNext - endPrev;
  let changed = false;
  const out: NoteRange[] = [];
  for (const r of ranges) {
    let s2 = r.start;
    let e2 = r.end;
    if (r.end <= start) { /* entirely before the edit */ }
    else if (r.start >= endPrev) { s2 += delta; e2 += delta; }
    else {
      if (r.start > start) s2 = endNext;
      e2 = r.end >= endPrev ? r.end + delta : endNext;
    }
    if (s2 !== r.start || e2 !== r.end) changed = true;
    if (e2 > s2) out.push(s2 === r.start && e2 === r.end ? r : { ...r, start: s2, end: e2 });
    else changed = true;
  }
  return changed ? out : ranges;
}
