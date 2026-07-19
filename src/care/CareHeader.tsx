// Shared Flow C header: a back-chevron circle, centered title, and a matching
// spacer so the title stays centered. Matches the cloud design's screen headers.
import { Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, X } from 'lucide-react-native';
import { CARE } from './theme';

export function CareHeader({ title, close = false }: { title?: string; close?: boolean }) {
  const router = useRouter();
  const back = () => (router.canGoBack() ? router.back() : router.navigate('/home' as never));
  const Icon = close ? X : ChevronLeft;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 12 }}>
      <TouchableOpacity
        onPress={back}
        activeOpacity={0.7}
        style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', borderWidth: 1, borderColor: CARE.border, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon size={18} color="#333" strokeWidth={2} />
      </TouchableOpacity>
      <Text style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '600', color: CARE.ink }}>{title ?? ''}</Text>
      <View style={{ width: 38 }} />
    </View>
  );
}
