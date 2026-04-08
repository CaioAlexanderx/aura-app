import { View, Text, StyleSheet, Pressable } from "react-native";
import { Colors } from "@/constants/colors";
import type { Obligation } from "./types";

type Props = { auraResolve: Obligation[]; voceFaz: Obligation[]; onSelect: (code: string) => void };

const GROUPS = [
  { key: "aura", label: "Automatico", desc: "A Aura cuida de tudo", color: Colors.green, bg: Colors.greenD },
  { key: "voce", label: "Voce precisa agir", desc: "Passo a passo com apoio da Aura", color: Colors.amber, bg: Colors.amberD },
];

export function GuidesList({ auraResolve, voceFaz, onSelect }: Props) {
  const data = [{ ...GROUPS[0], items: auraResolve }, { ...GROUPS[1], items: voceFaz }];
  return (
    <View>
      <View style={s.instruction}><Text style={s.iIcon}>i</Text><Text style={s.iText}>Guias visuais para cada obrigacao. A Aura prepara os dados e te guia pelo processo.</Text></View>
      {data.map(g => {
        if (g.items.length === 0) return null;
        return (
          <View key={g.key} style={{ marginBottom: 20 }}>
            <View style={s.groupHeader}><View style={[s.groupDot, { backgroundColor: g.color }]} /><View><Text style={s.groupTitle}>{g.label}</Text><Text style={s.groupSub}>{g.desc}</Text></View></View>
            {g.items.map(o => (
              <Pressable key={o.code} onPress={() => onSelect(o.code)} style={s.row}>
                <View style={[s.rowIcon, { backgroundColor: g.color + "18" }]}><Text style={[s.rowIconText, { color: g.color }]}>{(o.steps?.length || 0)}</Text></View>
                <View style={{ flex: 1 }}><Text style={s.rowName}>{o.name}</Text><Text style={s.rowSub}>{(o.steps?.length || 0)} passos • {o.frequency}</Text></View>
                <Text style={s.rowArrow}>{'>'}</Text>
              </Pressable>
            ))}
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  instruction: { flexDirection: "row", gap: 8, backgroundColor: Colors.violetD, borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: Colors.border2 },
  iIcon: { fontSize: 14, color: Colors.violet3, fontWeight: "700" },
  iText: { fontSize: 12, color: Colors.ink3, flex: 1, lineHeight: 18 },
  groupHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  groupDot: { width: 10, height: 10, borderRadius: 5 },
  groupTitle: { fontSize: 15, color: Colors.ink, fontWeight: "700" },
  groupSub: { fontSize: 11, color: Colors.ink3, marginTop: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 14, paddingHorizontal: 14, borderRadius: 12, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, marginBottom: 6 },
  rowIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rowIconText: { fontSize: 14, fontWeight: "800" },
  rowName: { fontSize: 14, color: Colors.ink, fontWeight: "600" },
  rowSub: { fontSize: 11, color: Colors.ink3, marginTop: 1 },
  rowArrow: { fontSize: 16, color: Colors.ink3 },
});

export default GuidesList;
