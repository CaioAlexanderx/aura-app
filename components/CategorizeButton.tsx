import { useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { companiesApi } from "@/services/api";
import { useAuthStore } from "@/stores/auth";

type Suggestion = { description: string; suggested_category: string; confidence: string; type_hint: string | null };

type Props = {
  descriptions: string[];
  onApply?: (results: Suggestion[]) => void;
};

export function CategorizeButton({ descriptions, onApply }: Props) {
  const { company } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Suggestion[] | null>(null);

  async function handleCategorize() {
    if (!company?.id || descriptions.length === 0) return;
    setLoading(true);
    try {
      const data = await companiesApi.categorize(company.id, descriptions);
      setResults(data.categorized);
      toast.success(`${data.categorized.length} lancamentos categorizados`);
      onApply?.(data.categorized);
    } catch { toast.error('Erro ao categorizar. Tente novamente.'); }
    finally { setLoading(false); }
  }

  if (descriptions.length === 0) return null;

  return (
    <View style={s.wrap}>
      <Pressable onPress={handleCategorize} disabled={loading} style={[s.btn, loading && { opacity: 0.6 }]}>
        {loading ? <ActivityIndicator size="small" color={Colors.violet3} /> : <Icon name="brain" size={14} color={Colors.violet3} />}
        <Text style={s.btnText}>{loading ? 'Categorizando...' : `Categorizar ${descriptions.length} lancamento(s)`}</Text>
      </Pressable>
      {results && (
        <View style={s.results}>
          {results.map((r, i) => (
            <View key={i} style={s.resultRow}>
              <Text style={s.resultDesc} numberOfLines={1}>{r.description}</Text>
              <View style={[s.badge, r.confidence === 'high' ? s.badgeHigh : r.confidence === 'medium' ? s.badgeMed : s.badgeLow]}>
                <Text style={[s.badgeText, r.confidence === 'high' ? { color: Colors.green } : r.confidence === 'medium' ? { color: Colors.amber } : { color: Colors.ink3 }]}>{r.suggested_category.replace(/_/g, ' ')}</Text>
              </View>
            </View>
          ))}
          <Text style={s.note}>Sugestoes geradas por IA — revise antes de confirmar</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginBottom: 12 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.violetD, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: Colors.border2, alignSelf: 'flex-start' },
  btnText: { fontSize: 12, color: Colors.violet3, fontWeight: '600' },
  results: { marginTop: 8, backgroundColor: Colors.bg3, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: Colors.border, gap: 4 },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  resultDesc: { flex: 1, fontSize: 11, color: Colors.ink3, marginRight: 8 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeHigh: { backgroundColor: Colors.greenD },
  badgeMed: { backgroundColor: Colors.amberD },
  badgeLow: { backgroundColor: Colors.bg4 },
  badgeText: { fontSize: 10, fontWeight: '600' },
  note: { fontSize: 9, color: Colors.ink3, fontStyle: 'italic', marginTop: 4, textAlign: 'center' },
});

export default CategorizeButton;
