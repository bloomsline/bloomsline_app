// Documents & forms — the patient's documents with sign status. Wired to GET
// /api/mobile/care/documents. Read-only list; signing still happens on the web
// token link for now, so tapping a pending doc explains that.
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FileText, Check } from 'lucide-react-native';
import { CareHeader } from '@/src/care/CareHeader';
import { CARE } from '@/src/care/theme';
import { fetchDocuments, type CareDocument } from '@/src/api/care';

export default function Documents() {
  const [items, setItems] = useState<CareDocument[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetchDocuments().then((d) => { if (alive) setItems(d ?? []); });
    return () => { alive = false; };
  }, []);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: CARE.canvas }}>
      <CareHeader title="Documents & forms" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {items === null ? (
          <View style={{ paddingTop: 40, alignItems: 'center' }}><ActivityIndicator color={CARE.teal} /></View>
        ) : items.length === 0 ? (
          <View style={{ backgroundColor: CARE.card, borderWidth: 1, borderColor: CARE.border, borderRadius: 18, padding: 24, alignItems: 'center', marginTop: 8 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: CARE.ink }}>No documents yet</Text>
            <Text style={{ fontSize: 13, color: '#999', marginTop: 6, textAlign: 'center' }}>Forms your practitioner sends will appear here.</Text>
          </View>
        ) : (
          <View style={{ gap: 10, marginTop: 4 }}>
            {items.map((d) => (
              <TouchableOpacity
                key={d.id}
                activeOpacity={0.8}
                onPress={() => !d.signed && Platform.OS === 'web' && globalThis.alert?.('Open this document from the link your practitioner sent to sign it.')}
                style={{ backgroundColor: CARE.card, borderWidth: 1, borderColor: CARE.border, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: d.signed ? CARE.mint : '#F1F1EF', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={19} color={d.signed ? CARE.teal : '#9A9A9A'} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: CARE.ink }}>{d.title}</Text>
                  <Text style={{ fontSize: 12, color: '#999', marginTop: 1 }}>{d.signed && d.signedAt ? `Signed ${shortDate(d.signedAt)}` : 'Awaiting your signature'}</Text>
                </View>
                {d.signed ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: CARE.mint, borderRadius: 10, paddingVertical: 4, paddingHorizontal: 9 }}>
                    <Check size={12} color={CARE.teal} strokeWidth={3} />
                    <Text style={{ fontSize: 11.5, fontWeight: '600', color: CARE.teal }}>Signed</Text>
                  </View>
                ) : (
                  <View style={{ backgroundColor: '#F6EEE8', borderRadius: 10, paddingVertical: 4, paddingHorizontal: 9 }}>
                    <Text style={{ fontSize: 11.5, fontWeight: '600', color: '#9A6A54' }}>Pending</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
