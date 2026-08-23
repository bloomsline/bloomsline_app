// The zoned_canvas exercise on a phone: Circle of Control, the Iceberg, the
// Body Map. The patient files short entries into labelled regions.
//
// Same two halves as the care app. The CANVAS draws the zones and each entry AS
// ITS OWN WORDS, positioned by the shared geometry (./canvas). The LEGEND below
// is where the writing happens — add, remove, move between zones. Nothing is
// dragged, and both halves work with a keyboard on screen and a thumb on glass.
//
// The canvas used to show numbers, with the words only in the legend. A
// practitioner named the cost: the exercise works by seeing everything at once,
// and hiding each item behind a tap ships the mechanics and loses the mechanism.
// A phone renders the canvas at roughly 0.42x, so it needs a bigger font in
// canvas units than the care app and settles on a shorter text budget for the
// same answer — which is fine, because an answer stores no coordinates.
import { Fragment, useMemo, useState } from 'react';
import { Modal, Pressable, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import { Plus, X } from 'lucide-react-native';
import { useCare } from '@/src/care/theme';
import { useI18n } from '@/src/i18n';
import { labelSlots, labelAnchor, shapeBox, wrapLabel, zoneLabel, type CanvasEntry, type CanvasZone, type ZoneShape } from '@/src/resources/canvas';

// v1's accent names, matched to the care app's palette so one exercise looks
// like itself on both surfaces.
// `tag`/`tagLine`/`tagInk` are the entry label — soft fill, hairline ring,
// accent-dark text. Matched to the care app so one exercise looks like itself
// on both surfaces.
type Accent = { stroke: string; fill: string; chip: string; text: string; tag: string; tagLine: string; tagInk: string };
const ACCENTS: Record<string, Accent> = {
  teal: { stroke: '#0d9488', fill: 'rgba(13,148,136,0.08)', chip: '#0d9488', text: '#0f766e', tag: '#EAF6F4', tagLine: 'rgba(13,148,136,0.45)', tagInk: '#0f5f57' },
  slate: { stroke: '#94a3b8', fill: 'rgba(148,163,184,0.06)', chip: '#64748b', text: '#475569', tag: '#F1F3F5', tagLine: 'rgba(100,116,139,0.40)', tagInk: '#3F4A5A' },
  violet: { stroke: '#8b5cf6', fill: 'rgba(139,92,246,0.08)', chip: '#8b5cf6', text: '#6d28d9', tag: '#F3EEFE', tagLine: 'rgba(139,92,246,0.45)', tagInk: '#5B21B6' },
  amber: { stroke: '#f59e0b', fill: 'rgba(245,158,11,0.08)', chip: '#f59e0b', text: '#b45309', tag: '#FEF5E7', tagLine: 'rgba(245,158,11,0.45)', tagInk: '#92400E' },
  rose: { stroke: '#f43f5e', fill: 'rgba(244,63,94,0.08)', chip: '#f43f5e', text: '#be123c', tag: '#FEEDF0', tagLine: 'rgba(244,63,94,0.45)', tagInk: '#9F1239' },
  sky: { stroke: '#0ea5e9', fill: 'rgba(14,165,233,0.08)', chip: '#0ea5e9', text: '#0369a1', tag: '#E8F5FD', tagLine: 'rgba(14,165,233,0.45)', tagInk: '#075985' },
  emerald: { stroke: '#10b981', fill: 'rgba(16,185,129,0.08)', chip: '#10b981', text: '#047857', tag: '#E9F7F1', tagLine: 'rgba(16,185,129,0.45)', tagInk: '#065F46' },
};
const accentOf = (name?: string) => ACCENTS[name ?? ''] ?? ACCENTS.slate;

const COPY = {
  en: { add: 'Add', placeholder: 'Add something…', empty: 'Nothing yet.', move: 'Move', remove: 'Remove', noZones: 'This exercise has no zones.', close: 'Close', tapHint: 'Tap an entry to read it in full.' },
  fr: { add: 'Ajouter', placeholder: 'Ajouter…', empty: 'Rien pour l’instant.', move: 'Déplacer', remove: 'Supprimer', noZones: 'Cet exercice n’a pas de zones.', close: 'Fermer', tapHint: 'Touchez un numéro pour le lire.' },
} as const;

type CanvasAnswer = Record<string, CanvasEntry[]>;

const asAnswer = (value: unknown): CanvasAnswer =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as CanvasAnswer) : {};

/** Parents before children, so a nested zone paints on top of its parent. */
const drawOrder = (zones: CanvasZone[]): CanvasZone[] =>
  [...zones].sort((a, b) => Number(Boolean(a.parentZoneId)) - Number(Boolean(b.parentZoneId)));

export function ZonedCanvasField({
  zones,
  canvas,
  value,
  onChange,
  readOnly = false,
}: {
  zones: CanvasZone[];
  canvas: { width: number; height: number } | undefined;
  value: unknown;
  onChange: (v: unknown) => void;
  readOnly?: boolean;
}) {
  const C = useCare();
  const { locale } = useI18n();
  const t = COPY[locale] ?? COPY.en;
  const size = canvas ?? { width: 800, height: 600 };
  const answer = useMemo(() => asAnswer(value), [value]);
  // A chip is a number, so the text has to live somewhere reachable. Tapping one
  // (on the canvas or in the legend) opens it — the only way to read a long
  // entry without laying it inside a shape it does not fit in.
  const [open, setOpen] = useState<{ zone: CanvasZone; entry: CanvasEntry; n: number } | null>(null);

  // Laid out once per answer. 26 canvas units clears the ~11px floor at the
  // ~0.42x a phone renders this at; below that the words are decoration.
  const layout = useMemo(
    () => zones.map((z) => {
      const entries = answer[z.id] ?? [];
      return { zone: z, entries, laid: labelSlots(z, zones, entries.map((e) => e.text), { minFontSize: 26 }) };
    }),
    [zones, answer],
  );

  // Numbering runs across the whole canvas so a chip's number is unique on
  // screen and the legend reads against it.
  const numbering = useMemo(() => {
    const map = new Map<string, number>();
    let n = 0;
    for (const z of zones) for (const e of answer[z.id] ?? []) map.set(`${z.id}::${e.id}`, ++n);
    return map;
  }, [zones, answer]);

  if (zones.length === 0) {
    return (
      <View style={{ backgroundColor: '#F6F6F4', borderRadius: 12, padding: 14 }}>
        <Text style={{ fontSize: 13, color: '#9A9A9A' }}>{t.noZones}</Text>
      </View>
    );
  }

  const setZone = (zoneId: string, entries: CanvasEntry[]) => {
    const next: CanvasAnswer = { ...answer };
    if (entries.length) next[zoneId] = entries;
    else delete next[zoneId];
    onChange(Object.keys(next).length ? next : undefined);
  };

  const move = (from: string, entry: CanvasEntry, to: string) => {
    if (from === to) return;
    const next: CanvasAnswer = { ...answer };
    next[from] = (next[from] ?? []).filter((e) => e.id !== entry.id);
    if (!next[from].length) delete next[from];
    next[to] = [...(next[to] ?? []), entry];
    onChange(next);
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 14, backgroundColor: C.card, padding: 6 }}>
        {/* aspectRatio keeps the canvas in proportion at any phone width. */}
        <Svg width="100%" height="100%" viewBox={`0 0 ${size.width} ${size.height}`} style={{ aspectRatio: size.width / size.height }}>
          {drawOrder(zones).map((z) => {
            const a = accentOf(z.accent);
            const anchor = labelAnchor(z.shape, Boolean(z.parentZoneId));
            return (
              <Fragment key={z.id}>
                <ZoneOutline shape={z.shape} stroke={a.stroke} fill={a.fill} />
                {/* SVG text does not wrap, and a practitioner's label can be a
                    whole sentence. The full text is always in the panel below. */}
                {wrapLabel(zoneLabel(z.label), shapeBox(z.shape).w - 24).map((line, li) => (
                  <SvgText key={li} x={anchor.x} y={anchor.y + li * 22} textAnchor="middle" fontSize={20} fontWeight="700" fill={a.text}>
                    {line}
                  </SvgText>
                ))}
              </Fragment>
            );
          })}
          {layout.map(({ zone: z, entries, laid }) => {
            const a = accentOf(z.accent);
            return laid.labels.map((L, i) => {
              if (!L) return null;
              const e = entries[i];
              const n = numbering.get(`${z.id}::${e.id}`) ?? i + 1;
              return (
                <G key={`${z.id}-${e.id}`} onPress={() => setOpen({ zone: z, entry: e, n })}>
                  <Rect x={L.box.x} y={L.box.y} width={L.box.w} height={L.box.h} rx={8} fill={a.tag} stroke={a.tagLine} strokeWidth={1.5} />
                  {L.lines.map((line, li) => (
                    <SvgText
                      key={li}
                      x={L.box.x + L.box.w / 2}
                      y={L.box.y + 8 + laid.fontSize * 1.18 * li + laid.fontSize * 0.82}
                      textAnchor="middle"
                      fontSize={laid.fontSize}
                      fontWeight="600"
                      fill={a.tagInk}
                    >
                      {line}
                    </SvgText>
                  ))}
                </G>
              );
            });
          })}
        </Svg>
      </View>

      {numbering.size > 0 && (
        <Text style={{ fontSize: 12, color: '#9A9A9A', textAlign: 'center' }}>{t.tapHint}</Text>
      )}

      {zones.map((z) => (
        <ZonePanel
          key={z.id}
          zone={z}
          zones={zones}
          entries={answer[z.id] ?? []}
          numbering={numbering}
          readOnly={readOnly}
          onSet={(entries) => setZone(z.id, entries)}
          onMove={(entry, to) => move(z.id, entry, to)}
          onOpen={(entry, n) => setOpen({ zone: z, entry, n })}
        />
      ))}

      <Modal visible={open !== null} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        <Pressable
          onPress={() => setOpen(null)}
          style={{ flex: 1, backgroundColor: C.scrim, alignItems: 'center', justifyContent: 'center', padding: 28 }}
        >
          {/* Stops a tap inside the card from closing it. */}
          <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 420, backgroundColor: C.sheet, borderRadius: 20, padding: 20, gap: 14 }}>
            {open && (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: accentOf(open.zone.accent).chip, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: C.onTeal }}>{open.n}</Text>
                  </View>
                  <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: accentOf(open.zone.accent).text }}>
                    {zoneLabel(open.zone.label)}
                  </Text>
                </View>
                <Text style={{ fontSize: 17, color: C.ink, lineHeight: 25 }}>{open.entry.text}</Text>
                <TouchableOpacity onPress={() => setOpen(null)} style={{ alignSelf: 'flex-end' }} hitSlop={8}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: C.teal }}>{t.close}</Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function ZoneOutline({ shape, stroke, fill }: { shape: ZoneShape; stroke: string; fill: string }) {
  if (shape.kind === 'rect') {
    return <Rect x={shape.x} y={shape.y} width={shape.w} height={shape.h} rx={shape.rx ?? 0} fill={fill} stroke={stroke} strokeWidth={2} />;
  }
  if (shape.kind === 'circle') {
    return <Circle cx={shape.cx} cy={shape.cy} r={shape.r} fill={fill} stroke={stroke} strokeWidth={2} />;
  }
  if (shape.kind === 'ellipse') {
    return <Ellipse cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} fill={fill} stroke={stroke} strokeWidth={2} />;
  }
  return <Polygon points={shape.points.map(([x, y]) => `${x},${y}`).join(' ')} fill={fill} stroke={stroke} strokeWidth={2} />;
}

function ZonePanel({
  zone, zones, entries, numbering, readOnly, onSet, onMove, onOpen,
}: {
  zone: CanvasZone;
  zones: CanvasZone[];
  entries: CanvasEntry[];
  numbering: Map<string, number>;
  readOnly: boolean;
  onSet: (entries: CanvasEntry[]) => void;
  onMove: (entry: CanvasEntry, to: string) => void;
  onOpen: (entry: CanvasEntry, n: number) => void;
}) {
  const C = useCare();
  const { locale } = useI18n();
  const t = COPY[locale] ?? COPY.en;
  const [draft, setDraft] = useState('');
  const a = accentOf(zone.accent);
  const others = zones.filter((z) => z.id !== zone.id);

  const add = () => {
    const text = draft.trim();
    if (!text) return;
    onSet([...entries, { id: `${zone.id}-${Date.now().toString(36)}`, text, createdAt: new Date().toISOString() }]);
    setDraft('');
  };

  return (
    <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 14, backgroundColor: C.card, padding: 12, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: a.chip }} />
        <Text style={{ fontSize: 14, fontWeight: '700', color: a.text, flex: 1 }}>{zoneLabel(zone.label)}</Text>
      </View>

      {entries.length === 0 ? (
        <Text style={{ fontSize: 13, color: '#9A9A9A' }}>{t.empty}</Text>
      ) : (
        entries.map((e) => {
          const n = numbering.get(`${zone.id}::${e.id}`) ?? 0;
          return (
            <View key={e.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
              {/* The row opens the same popup as its chip, so a long entry is
                  readable in full without truncating the list. */}
              <TouchableOpacity onPress={() => onOpen(e, n)} activeOpacity={0.7} style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: a.chip, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: C.onTeal }}>{n}</Text>
                </View>
                <Text numberOfLines={2} style={{ flex: 1, fontSize: 15, color: C.ink, lineHeight: 21 }}>{e.text}</Text>
              </TouchableOpacity>
              {!readOnly && others.length > 0 && (
                // One tap cycles to the next zone. A picker for two zones is more
                // chrome than choice, and Circle of Control has exactly two.
                <TouchableOpacity
                  onPress={() => onMove(e, zones[(zones.findIndex((z) => z.id === zone.id) + 1) % zones.length].id)}
                  hitSlop={8}
                  accessibilityLabel={t.move}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: C.teal }}>{t.move}</Text>
                </TouchableOpacity>
              )}
              {!readOnly && (
                <TouchableOpacity onPress={() => onSet(entries.filter((x) => x.id !== e.id))} hitSlop={8} accessibilityLabel={t.remove}>
                  <X size={16} color="#9A9A9A" />
                </TouchableOpacity>
              )}
            </View>
          );
        })
      )}

      {!readOnly && (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={add}
            returnKeyType="done"
            placeholder={t.placeholder}
            placeholderTextColor="#BBB"
            style={{ fontSize: 15, color: C.ink }}
          />
        </View>
        <TouchableOpacity
          onPress={add}
          disabled={!draft.trim()}
          activeOpacity={0.8}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: draft.trim() ? 1 : 0.4 }}
        >
          <Plus size={16} color={C.teal} />
          <Text style={{ fontSize: 14, fontWeight: '700', color: C.teal }}>{t.add}</Text>
        </TouchableOpacity>
      </View>
      )}
    </View>
  );
}
