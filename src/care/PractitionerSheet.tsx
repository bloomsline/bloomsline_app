import { Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import { EDA, MonoLabel } from '@/src/ui/editorial';
import { useI18n } from '@/src/i18n';
import type { CarePractitioner } from '@/src/api/care';
import { useTheme } from '@/src/ui/theme-mode';

// The practitioner mini-profile, shown as a bottom sheet. Same fields as the
// in-app practitioner screen (avatar, name, headline + specialties, key facts,
// bio), reused during onboarding so the patient can get to know who invited them.
// Light editorial styling (no dark hero) — this is a modal sheet.
function joinOrNull(parts: (string | null | undefined)[], sep: string): string | null {
  const v = parts.filter(Boolean).join(sep);
  return v || null;
}

export function PractitionerSheet({
  visible,
  onClose,
  practitioner,
  nameFallback,
}: {
  visible: boolean;
  onClose: () => void;
  practitioner: CarePractitioner | null;
  nameFallback: string | null;
}) {
  const { t: TT } = useTheme();
  const { t } = useI18n();
  const p = practitioner;
  const name = p?.name ?? nameFallback ?? null;
  const initial = (name ?? '').replace(/^dr\.?\s*/i, '').charAt(0).toUpperCase() || '?';
  const subtitle = joinOrNull([p?.headline, p?.specialties?.length ? p.specialties.join(', ') : null], ' · ');
  const facts = [
    joinOrNull([p?.city, p?.country], ', ') ? { label: t.profile.location, value: joinOrNull([p?.city, p?.country], ', ')! } : null,
    p?.sessionTypes?.length ? { label: t.profile.sessions, value: p.sessionTypes.join(' · ') } : null,
    p?.languages?.length ? { label: t.profile.languages, value: p.languages.join(', ') } : null,
  ].filter((f): f is { label: string; value: string } => f !== null);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        <Pressable className="max-h-[85%] rounded-t-3xl" style={{ backgroundColor: TT.card }} onPress={() => {}}>
          <View className="items-center pt-3">
            <View style={{ height: 4, width: 40, borderRadius: 2, backgroundColor: TT.line }} />
          </View>
          <Pressable onPress={onClose} className="absolute right-4 top-4 z-10 h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: TT.accentTint }}>
            <X size={18} color={TT.accent} strokeWidth={2} />
          </Pressable>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 36 }} showsVerticalScrollIndicator={false}>
            <View style={{ alignItems: 'center' }}>
              {p?.photoUrl ? (
                <Image source={{ uri: p.photoUrl }} style={{ width: 84, height: 84, borderRadius: 42, marginBottom: 14 }} accessibilityIgnoresInvertColors />
              ) : (
                <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: TT.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 32 }}>{initial}</Text>
                </View>
              )}
              <Text style={{ fontSize: 22, fontWeight: '700', color: TT.ink, textAlign: 'center' }}>{name ?? 'Your practitioner'}</Text>
              {subtitle ? <Text style={{ fontSize: 14, color: TT.inkSoft, marginTop: 3, textAlign: 'center' }}>{subtitle}</Text> : null}
            </View>

            {facts.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 20 }}>
                {facts.map((f) => (
                  <View key={f.label} style={{ backgroundColor: TT.bg, borderWidth: 1, borderColor: TT.line, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14, minWidth: 96, alignItems: 'center' }}>
                    <MonoLabel color={TT.faint} size={9.5}>{f.label}</MonoLabel>
                    <Text style={{ fontSize: 13.5, color: TT.ink, fontWeight: '600', marginTop: 5, textAlign: 'center' }}>{f.value}</Text>
                  </View>
                ))}
              </View>
            )}

            {p?.bio ? (
              <View style={{ marginTop: 22 }}>
                <MonoLabel color={TT.faint} style={{ marginBottom: 8 }}>{t.profile.about}</MonoLabel>
                <Text style={{ fontSize: 13.5, color: TT.inkSoft, lineHeight: 21 }}>{p.bio}</Text>
              </View>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
