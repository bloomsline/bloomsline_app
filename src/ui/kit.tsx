// The component kit.
//
// One grammar, used everywhere, so a row on one screen is the same object as a
// row on another. Every colour comes from `useTheme()` — nothing here hardcodes
// a hex, which is what makes the switcher work.
//
// The pieces, and what each is for:
//   IconTile      a category, as a pale tint carrying a saturated glyph
//   CircleButton  the affordance. Highest-contrast thing on the screen
//   ListRow       tile + title/subtitle/meta + circle. The workhorse
//   SectionLabel  the quiet header between groups ("This week")
//   Group         one card holding rows separated by INSET hairlines
//   GroupRow      a row inside it: icon, title, optional value, chevron
//   EmptyState    glyph, one line of title, one sentence. Nothing else
//   ChipRow       horizontally scrolling filters
//   Sheet         rounded top, scrim, a full-width CTA at the foot
import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Text, View, type ViewStyle } from 'react-native';
import { ArrowRight, ChevronRight, type LucideIcon } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './theme-mode';
import { R, type TileName } from './tokens';

// ── IconTile ──────────────────────────────────────────────────────────────────

export function IconTile({ icon: Icon, name = 'neutral', size = 46 }: { icon: LucideIcon; name?: TileName; size?: number }) {
  const { tile } = useTheme();
  const c = tile(name);
  return (
    <View style={{ width: size, height: size, borderRadius: R.tile, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={size * 0.46} color={c.fg} strokeWidth={2} />
    </View>
  );
}

// ── CircleButton ──────────────────────────────────────────────────────────────

/** The signature affordance: a solid disc that inverts against the page. On
 *  light it is near-black; on dark it is near-white. Not a bordered ghost —
 *  the contrast IS the component. */
export function CircleButton({
  onPress,
  icon: Icon = ArrowRight,
  size = 40,
  label,
  disabled,
}: {
  onPress?: () => void;
  icon?: LucideIcon;
  size?: number;
  /** Screen-reader name. A bare arrow announces nothing without it. */
  label: string;
  disabled?: boolean;
}) {
  const { t } = useTheme();
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={8}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: t.circleBg,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.35 : pressed ? 0.75 : 1,
      })}
    >
      <Icon size={size * 0.45} color={t.circleFg} strokeWidth={2.2} />
    </Pressable>
  );
}

// ── ListRow ───────────────────────────────────────────────────────────────────

export function ListRow({
  icon,
  tile = 'neutral',
  title,
  subtitle,
  meta,
  accessory,
  onPress,
  style,
}: {
  icon?: LucideIcon;
  tile?: TileName;
  title: string;
  subtitle?: string;
  /** A third line — a time, a count. Quietest of the three. */
  meta?: string;
  /** Trailing element. Defaults to a CircleButton when `onPress` is given. */
  accessory?: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}) {
  const { t } = useTheme();
  const trailing = accessory ?? (onPress ? <CircleButton onPress={onPress} label={title} /> : null);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? [title, subtitle, meta].filter(Boolean).join(', ') : undefined}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          backgroundColor: t.card,
          borderRadius: R.card,
          borderWidth: 1,
          borderColor: t.cardLine,
          padding: 14,
          opacity: pressed && onPress ? 0.85 : 1,
        },
        style,
      ]}
    >
      {icon ? <IconTile icon={icon} name={tile} /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 15.5, fontWeight: '700', color: t.ink, letterSpacing: -0.2 }} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? <Text style={{ fontSize: 14, color: t.inkSoft }} numberOfLines={2}>{subtitle}</Text> : null}
        {meta ? <Text style={{ fontSize: 13, color: t.faint }} numberOfLines={1}>{meta}</Text> : null}
      </View>
      {trailing}
    </Pressable>
  );
}

// ── SectionLabel ──────────────────────────────────────────────────────────────

export function SectionLabel({ children, style }: { children: string; style?: ViewStyle }) {
  const { t } = useTheme();
  return (
    <Text accessibilityRole="header" style={[{ fontSize: 13, color: t.faint, marginLeft: 4, marginBottom: 8 }, style]}>
      {children}
    </Text>
  );
}

// ── Group / GroupRow ──────────────────────────────────────────────────────────

/** A settings group: one card, rows inside it, hairlines INSET so they start
 *  after the icon rather than cutting the card in half. */
export function Group({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { t } = useTheme();
  return (
    <View style={[{ backgroundColor: t.card, borderRadius: R.card, borderWidth: 1, borderColor: t.cardLine, overflow: 'hidden' }, style]}>
      {children}
    </View>
  );
}

export function GroupRow({
  icon: Icon,
  title,
  value,
  onPress,
  accessory,
  first,
}: {
  icon?: LucideIcon;
  title: string;
  /** The current setting, shown under the title. */
  value?: string;
  onPress?: () => void;
  accessory?: ReactNode;
  /** Suppresses the divider on the first row of a Group. */
  first?: boolean;
}) {
  const { t } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={value ? `${title}, ${value}` : title}
      style={({ pressed }) => ({ opacity: pressed && onPress ? 0.7 : 1 })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 }}>
        {Icon ? <Icon size={21} color={t.inkSoft} strokeWidth={1.9} /> : null}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: 15.5, fontWeight: '600', color: t.ink }}>{title}</Text>
          {value ? <Text style={{ fontSize: 13.5, color: t.faint }}>{value}</Text> : null}
        </View>
        {accessory ?? (onPress ? <ChevronRight size={19} color={t.faint} strokeWidth={2} /> : null)}
      </View>
      {!first ? null : null}
    </Pressable>
  );
}

/** The inset hairline between two GroupRows. Rendered by the parent so the last
 *  row never carries a trailing line. */
export function GroupDivider({ inset = 51 }: { inset?: number }) {
  const { t } = useTheme();
  return <View style={{ height: 1, backgroundColor: t.line, marginLeft: inset }} />;
}

// ── EmptyState ────────────────────────────────────────────────────────────────

export function EmptyState({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body?: string }) {
  const { t } = useTheme();
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingVertical: 64, gap: 10 }}>
      <Icon size={54} color={t.faint} strokeWidth={1.5} />
      <Text style={{ fontSize: 18, fontWeight: '700', color: t.ink, marginTop: 6, textAlign: 'center' }}>{title}</Text>
      {body ? <Text style={{ fontSize: 14.5, color: t.inkSoft, textAlign: 'center', lineHeight: 21 }}>{body}</Text> : null}
    </View>
  );
}

// ── ChipRow ───────────────────────────────────────────────────────────────────

export function ChipRow<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { key: T; label: string }[];
  value: T | null;
  onChange: (key: T | null) => void;
}) {
  const { t } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}>
      {items.map((it) => {
        const on = it.key === value;
        return (
          <Pressable
            key={it.key}
            onPress={() => onChange(on ? null : it.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={{
              paddingHorizontal: 15,
              paddingVertical: 9,
              borderRadius: R.pill,
              backgroundColor: on ? t.ctaBg : t.card,
              borderWidth: 1,
              borderColor: on ? t.ctaBg : t.cardLine,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: on ? t.ctaFg : t.ink }}>{it.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ── Sheet ─────────────────────────────────────────────────────────────────────

export function Sheet({
  visible,
  onClose,
  children,
  cta,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  cta?: { label: string; onPress: () => void; disabled?: boolean };
}) {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: t.scrim }} onPress={onClose} accessibilityLabel="Close" />
      <View
        style={{
          backgroundColor: t.bg,
          borderTopLeftRadius: R.sheet,
          borderTopRightRadius: R.sheet,
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: insets.bottom + 16,
        }}
      >
        {/* The grabber. Purely affordance — it says "this drags". */}
        <View style={{ alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: t.line, marginBottom: 14 }} />
        {children}
        {cta ? (
          <Pressable
            onPress={cta.disabled ? undefined : cta.onPress}
            accessibilityRole="button"
            accessibilityLabel={cta.label}
            style={({ pressed }) => ({
              height: 54,
              borderRadius: R.pill,
              backgroundColor: t.ctaBg,
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 18,
              opacity: cta.disabled ? 0.4 : pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: t.ctaFg }}>{cta.label}</Text>
          </Pressable>
        ) : null}
      </View>
    </Modal>
  );
}
