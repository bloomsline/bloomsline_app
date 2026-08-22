import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { EdHeader, EdCard, EdPill, EdSection, FadeIn } from '@/src/ui/editorial';
import { useI18n } from '@/src/i18n';
import { addPatient } from '@/src/api/practitioner';
import { useTheme } from '@/src/ui/theme-mode';

// Add a patient. Name is required; an email is what makes the app invitation
// possible — and whether one actually goes out is decided server-side, where the
// rules about minors and the practitioner's own preference already live.
const T = {
  en: {
    kicker: 'NEW', title: 'Add a patient', details: 'DETAILS',
    first: 'First name', last: 'Last name', email: 'Email (optional)',
    save: 'Add patient',
    inviteNote: 'If you add an email, they will be invited to the patient app.',
  },
  fr: {
    kicker: 'NOUVEAU', title: 'Ajouter un patient', details: 'INFORMATIONS',
    first: 'Prénom', last: 'Nom', email: 'E-mail (facultatif)',
    save: 'Ajouter',
    inviteNote: 'Si vous ajoutez un e-mail, la personne sera invitée sur l’application.',
  },
} as const;

export default function AddPatient() {
  const { t: TT } = useTheme();
  const router = useRouter();
  const { locale } = useI18n();
  const tr = T[locale] ?? T.en;

  const [firstName, setFirst] = useState('');
  const [lastName, setLast] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const back = () => (router.canGoBack() ? router.back() : router.navigate('/(practitioner)/people' as never));

  const save = async () => {
    if (!firstName.trim() && !lastName.trim()) return;
    setError(''); setSaving(true);
    const res = await addPatient({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim() || undefined });
    setSaving(false);
    if (!res.ok) { setError(res.error ?? ''); return; }
    back();
  };

  const field = (value: string, onChangeText: (v: string) => void, placeholder: string, extra?: object) => (
    <EdCard style={{ paddingVertical: 14, marginBottom: 10 }}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={TT.faint}
        style={{ fontSize: 15.5, color: TT.ink }}
        {...extra}
      />
    </EdCard>
  );

  return (
    <View style={{ flex: 1, backgroundColor: TT.bg }}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <EdHeader kicker={tr.kicker} title={tr.title} onBack={back} />

        <FadeIn style={{ paddingHorizontal: 22, paddingTop: 20 }}>
          <EdSection label={tr.details} />
          {field(firstName, setFirst, tr.first, { autoFocus: true })}
          {field(lastName, setLast, tr.last)}
          {field(email, setEmail, tr.email, { keyboardType: 'email-address', autoCapitalize: 'none', autoCorrect: false })}

          <Text style={{ fontSize: 12.5, color: TT.faint, lineHeight: 18, marginTop: 4 }}>{tr.inviteNote}</Text>

          <EdPill
            label={saving ? '…' : tr.save}
            onPress={save}
            disabled={saving || (!firstName.trim() && !lastName.trim())}
            style={{ marginTop: 22 }}
          />
          {saving && <ActivityIndicator style={{ marginTop: 12 }} />}
          {error ? <Text style={{ fontSize: 13.5, color: '#C0392B', marginTop: 12 }}>{error}</Text> : null}
        </FadeIn>
      </ScrollView>
    </View>
  );
}
