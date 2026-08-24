// The patient's own name and picture.
//
// Settings showed both and let them change neither: the card at the top was a
// statement, not a control. The name was always writable through PATCH /me and
// the picture had nowhere to live until `users.image` was wired up — a column
// that had existed all along and was used for nobody.
//
// Saving is one button rather than a field-by-field autosave. The journal
// autosaves because writing is continuous and losing a sentence is real; a name
// is changed once in a year, and a profile that commits as you type gives you
// nowhere to change your mind.
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Camera } from 'lucide-react-native';
import { EdHeader, FadeIn } from '@/src/ui/editorial';
import { OptionSheet } from '@/src/ui/option-sheet';
import { useTheme } from '@/src/ui/theme-mode';
import { useI18n } from '@/src/i18n';
import { fetchMe, saveProfile } from '@/src/api/me';
import { pickImage, uploadAvatar, type PickedImage } from '@/src/profile/avatar-upload';
import { AvatarCropper, type CropRect } from '@/src/profile/AvatarCropper';
import { cameraAvailable } from '@/src/moments/media-upload';

type PhotoAction = 'camera' | 'library' | 'remove';

export default function Profile() {
  const { t: TT } = useTheme();
  const router = useRouter();
  const { t } = useI18n();
  const tr = t.profile;

  const [loading, setLoading] = useState(true);
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  /** The key to send on save. `undefined` = unchanged, `null` = remove. */
  const [avatarKey, setAvatarKey] = useState<string | null | undefined>(undefined);
  const [sheet, setSheet] = useState(false);
  /** The photo being cropped, before it is uploaded. */
  const [cropping, setCropping] = useState<PickedImage | null>(null);
  /** What to draw right now — a signed url from the server, or the freshly
   *  cropped file on this device. Either is loadable; a storage key is not. */
  const [preview, setPreview] = useState<string | null>(null);
  const [photoDone, setPhotoDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchMe().then((me) => {
      if (!alive) return;
      if (me) {
        setFirst(me.firstName ?? '');
        setLast(me.lastName ?? '');
        setAvatarUrl(me.avatarUrl);
      }
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  const back = () => (router.canGoBack() ? router.back() : router.navigate('/settings' as never));

  const choosePhoto = async (action: PhotoAction) => {
    setError(null);
    setPhotoDone(false);
    if (action === 'remove') {
      setPreview(null);
      setAvatarUrl(null);
      setAvatarKey(null);
      return;
    }
    setBusy(true);
    try {
      const picked = await pickImage(action === 'camera');
      // Null is "they cancelled" as often as "it failed", and the picker cannot
      // tell us which — so no message, and nothing changes.
      if (picked) setCropping(picked);
    } catch {
      setError(tr.photoFailed);
    } finally {
      setBusy(false);
    }
  };

  const applyCrop = async (crop: CropRect) => {
    const picked = cropping;
    setCropping(null);
    if (!picked) return;
    setBusy(true);
    setError(null);
    try {
      const out = await uploadAvatar(picked, crop);
      if (!out) { setError(tr.photoFailed); return; }
      setAvatarKey(out.key);
      // Show it AT ONCE. The previous version set the state to the storage key,
      // which is not a url, so the letter stayed on screen and choosing a photo
      // looked like it had done nothing until the app was restarted.
      setPreview(out.localUri);
      setPhotoDone(true);
    } catch {
      setError(tr.photoFailed);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const ok = await saveProfile({
      firstName: first.trim(),
      lastName: last.trim(),
      ...(avatarKey !== undefined ? { avatarKey } : {}),
    });
    setBusy(false);
    if (!ok) { setError(tr.saveFailed); return; }
    setSaved(true);
    setTimeout(() => router.back(), 450);
  };

  const initial = (first || last || '?').charAt(0).toUpperCase();
  // The local crop wins while it exists: it is what they just chose, and it is
  // newer than anything the server has been told about.
  const shown = preview ?? avatarUrl;
  const showPhoto = !!shown && !/^avatars\//.test(shown);

  return (
    <View style={{ flex: 1, backgroundColor: TT.bg }}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <EdHeader title={tr.yourDetails} onBack={back} />

          {loading ? (
            <View style={{ paddingTop: 80, alignItems: 'center' }}><ActivityIndicator color={TT.accent} /></View>
          ) : (
            <FadeIn style={{ paddingHorizontal: 22, paddingTop: 20 }}>
              {/* Photo */}
              <View style={{ alignItems: 'center', marginBottom: 26 }}>
                <Pressable onPress={() => setSheet(true)} accessibilityRole="button" accessibilityLabel={tr.changePhoto}>
                  {showPhoto ? (
                    <Image source={{ uri: shown! }} style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 1, borderColor: TT.cardLine }} />
                  ) : (
                    <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: TT.accentTint, borderWidth: 1, borderColor: TT.cardLine, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 34, fontWeight: '700', color: TT.accent }}>{initial}</Text>
                    </View>
                  )}
                  <View style={{ position: 'absolute', right: -2, bottom: -2, width: 32, height: 32, borderRadius: 16, backgroundColor: TT.accent, borderWidth: 2, borderColor: TT.bg, alignItems: 'center', justifyContent: 'center' }}>
                    <Camera size={15} color={TT.onAccent} strokeWidth={2.2} />
                  </View>
                </Pressable>
                <Pressable onPress={() => setSheet(true)} style={{ marginTop: 12 }}>
                  <Text style={{ fontSize: 13.5, fontWeight: '700', color: TT.accent }}>{tr.changePhoto}</Text>
                </Pressable>
                {/* Uploading is invisible otherwise: the picture appears, and
                    nothing says whether it reached us. */}
                {busy ? (
                  <Text style={{ fontSize: 12.5, color: TT.faint, marginTop: 8 }}>{tr.uploading}</Text>
                ) : photoDone ? (
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: TT.accent, marginTop: 8 }}>{tr.photoReady}</Text>
                ) : null}
              </View>

              {/* No section label: it would repeat the page title, and the two
                  fields already say what they are. */}
              <NameField label={tr.firstName} value={first} onChange={setFirst} />
              <View style={{ height: 12 }} />
              <NameField label={tr.lastName} value={last} onChange={setLast} />

              {error ? (
                <Text style={{ fontSize: 13, color: TT.danger, marginTop: 14, lineHeight: 19 }}>{error}</Text>
              ) : null}

              <Pressable
                onPress={save}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={tr.save}
                style={{ marginTop: 26, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: TT.ctaBg, opacity: busy ? 0.5 : 1 }}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: TT.ctaFg }}>{saved ? tr.saved : tr.save}</Text>
              </Pressable>
            </FadeIn>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {cropping ? (
        <AvatarCropper
          uri={cropping.uri}
          imageW={cropping.width}
          imageH={cropping.height}
          onCancel={() => setCropping(null)}
          onDone={(c) => void applyCrop(c)}
        />
      ) : null}

      <OptionSheet
        visible={sheet}
        title={tr.yourPhoto}
        options={[
          ...(cameraAvailable ? [{ value: 'camera' as PhotoAction, label: tr.takePhoto }] : []),
          { value: 'library' as PhotoAction, label: tr.chooseFromLibrary },
          ...(showPhoto ? [{ value: 'remove' as PhotoAction, label: tr.removePhoto }] : []),
        ]}
        // Nothing is "current" here: these are actions, not a setting, so no
        // value matches and no tick is drawn.
        selected={'none' as PhotoAction}
        onSelect={(v) => void choosePhoto(v)}
        onClose={() => setSheet(false)}
      />
    </View>
  );
}

function NameField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const { t: TT } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View>
      <Text style={{ fontSize: 12.5, color: TT.faint, marginBottom: 6 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        selectionColor={TT.accent}
        style={[
          {
            height: 52, borderRadius: 16, paddingHorizontal: 16, fontSize: 16, color: TT.ink,
            backgroundColor: TT.card,
            borderWidth: focused ? 1.5 : 1,
            borderColor: focused ? TT.accent : TT.cardLine,
          },
          Platform.OS === 'web' ? ({ outlineStyle: 'none' } as never) : null,
        ]}
      />
    </View>
  );
}
