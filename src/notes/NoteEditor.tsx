import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { Bold, Italic, List, Minus, Quote, Tag as TagIcon, X } from 'lucide-react-native';
import { EDA } from '@/src/ui/editorial';
import type { NoteRange } from '@/src/api/practitioner';
import { useTheme } from '@/src/ui/theme-mode';

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

export function NoteEditor({
  title, text, ranges, noteType, noteTypes, tags, templates, saving, error,
  onTitle, onText, onRanges, onNoteType, onSave, onMinimize, onCancel, onDiscard, statusLine, header,
}: {
  title: string;
  text: string;
  ranges: NoteRange[];
  noteType: string;
  noteTypes: string[];
  tags: EditorTag[];
  templates: { id: string; label: string; body: string }[];
  saving: boolean;
  error: string;
  onTitle: (v: string) => void;
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
    const next = text.trim() ? `${text.trim()}\n\n${body}` : body;
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
        <Pressable onPress={onMinimize} hitSlop={10} accessibilityLabel="Minimize">
          <Minus size={20} color={TT.inkSoft} />
        </Pressable>
        <Pressable onPress={onCancel} hitSlop={10} accessibilityLabel="Close">
          <X size={20} color={TT.inkSoft} />
        </Pressable>
      </View>

      {/* The one destructive path, so the only one that asks. Kept away from the
          Close control on purpose. */}
      {onDiscard ? (
        <Pressable onPress={onDiscard} hitSlop={8} style={{ alignSelf: 'flex-start', paddingBottom: 10 }}>
          <Text style={{ fontSize: 12.5, fontWeight: '600', color: TT.faint }}>Discard draft</Text>
        </Pressable>
      ) : null}

      {/* Toolbar. Formatting acts on the SELECTION, so it is disabled without
          one rather than silently doing nothing. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: TT.line, backgroundColor: TT.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 10, paddingVertical: 8 }}>
        <ToolButton Icon={Bold} on={marked('bold')} disabled={!hasSelection} onPress={() => (marked('bold') ? clearMark('bold') : applyMark('bold'))} label="Bold" />
        <ToolButton Icon={Italic} on={marked('italic')} disabled={!hasSelection} onPress={() => (marked('italic') ? clearMark('italic') : applyMark('italic'))} label="Italic" />
        <View style={{ width: 1, height: 20, backgroundColor: TT.line, marginHorizontal: 2 }} />
        <ToolButton Icon={List} on={false} disabled={false} onPress={bulletLine} label="Bullet list" />
        <ToolButton Icon={Quote} on={marked('quote')} disabled={!hasSelection} onPress={() => (marked('quote') ? clearMark('quote') : applyMark('quote'))} label="Quote" />
        <ToolButton Icon={TagIcon} on={tagOpen} disabled={!hasSelection} onPress={() => setTagOpen((v) => !v)} label="Tag" />
        <View style={{ flex: 1 }} />
        {templates.length > 0 && (
          <Pressable onPress={() => setTplOpen((v) => !v)} hitSlop={8}>
            <Text style={{ fontSize: 12.5, fontWeight: '700', color: TT.accent }}>Templates</Text>
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
          <Text style={{ fontSize: 11.5, fontWeight: '700', color: TT.faint, marginBottom: 8 }}>TAG THE SELECTED TEXT</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {tags.map((t) => (
              <Pressable key={t.slug} onPress={() => applyMark('tag', t.slug)} style={{ borderRadius: 14, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: TT.accentTint, borderWidth: 1, borderColor: TT.accent }}>
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: TT.accentDeep, textTransform: 'capitalize' }}>{t.label}</Text>
              </Pressable>
            ))}
            {marked('tag') && (
              <Pressable onPress={() => clearMark('tag')} style={{ borderRadius: 14, paddingHorizontal: 11, paddingVertical: 7, borderWidth: 1, borderColor: TT.line }}>
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: TT.inkSoft }}>Remove tag</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      <View style={{ borderWidth: 1, borderTopWidth: 0, borderColor: TT.line, backgroundColor: TT.card, paddingHorizontal: 14, paddingVertical: 12 }}>
        <TextInput
          value={title}
          onChangeText={onTitle}
          placeholder="Title (optional)"
          placeholderTextColor={TT.faint}
          style={{ fontSize: 15.5, fontWeight: '700', color: TT.ink }}
        />
      </View>

      <View style={{ borderWidth: 1, borderTopWidth: 0, borderColor: TT.line, backgroundColor: TT.card, borderBottomLeftRadius: 16, borderBottomRightRadius: 16, paddingHorizontal: 14, paddingVertical: 12 }}>
        <TextInput
          value={text}
          onChangeText={(v) => {
            // Marks index into the text, so a shorter text must not leave marks
            // pointing past the end.
            if (v.length < text.length) onRanges(ranges.filter((r) => r.end <= v.length));
            onText(v);
          }}
          onSelectionChange={(e) => setSel(e.nativeEvent.selection)}
          placeholder="Write a note for this session…"
          placeholderTextColor={TT.faint}
          multiline
          textAlignVertical="top"
          style={{ minHeight: 200, fontSize: 15.5, lineHeight: 24, color: TT.ink }}
        />
      </View>

      {!hasSelection && (
        <Text style={{ fontSize: 12, color: TT.faint, marginTop: 8 }}>
          Select a sentence to tag, quote or format it.
        </Text>
      )}

      {noteTypes.length > 1 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
          {noteTypes.map((t) => (
            <Pressable
              key={t}
              onPress={() => onNoteType(t)}
              style={{ borderRadius: 14, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: t === noteType ? TT.accentTint : TT.card, borderWidth: 1.5, borderColor: t === noteType ? TT.accent : TT.line }}
            >
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: t === noteType ? TT.accentDeep : TT.inkSoft, textTransform: 'capitalize' }}>{t.replace(/_/g, ' ')}</Text>
            </Pressable>
          ))}
        </View>
      )}

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
          <Text style={{ fontSize: 15, fontWeight: '600', color: TT.inkSoft }}>Close</Text>
        </Pressable>
        <Pressable
          onPress={onSave}
          disabled={saving || !text.trim()}
          style={{ flex: 1.4, height: 50, borderRadius: 25, backgroundColor: TT.accent, alignItems: 'center', justifyContent: 'center', opacity: saving || !text.trim() ? 0.45 : 1 }}
        >
          {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Save note</Text>}
        </Pressable>
      </View>
      {error ? <Text style={{ fontSize: 13.5, color: '#C0392B', marginTop: 12 }}>{error}</Text> : null}
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
