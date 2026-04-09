import { useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, Switch, Dimensions } from "react-native";
import { Colors } from "@/constants/colors";
import type { Automation } from "./types";
import { toast } from "@/components/Toast";

const IS_WIDE = (typeof window !== "undefined" ? window.innerWidth : Dimensions.get("window").width) > 768;
const STORAGE_KEY = "aura_wa_automations";

// M5: Persist automation toggle state to localStorage
function loadAutoState(): Record<string, boolean> {
  try { const s = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null; return s ? JSON.parse(s) : {}; } catch { return {}; }
}
function saveAutoState(state: Record<string, boolean>) {
  try { if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

type Props = { automations: Automation[]; activeCount: number; totalSent: number; onToggle: (id: string) => void };

export function TabAutomacoes({ automations, activeCount, totalSent, onToggle }: Props) {
  // M5: Hydrate from localStorage
  const [localAutos, setLocalAutos] = useState(() => {
    const saved = loadAutoState();
    if (Object.keys(saved).length === 0) return automations;
    return automations.map(a => ({ ...a, enabled: saved[a.id] !== undefined ? saved[a.id] : a.enabled }));
  });

  // M5: Save to localStorage on every change
  useEffect(() => {
    const state: Record<string, boolean> = {};
    localAutos.forEach(a => { state[a.id] = a.enabled; });
    saveAutoState(state);
  }, [localAutos]);

  function handleToggle(id: string) {
    setLocalAutos(prev => prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
    onToggle(id);
  }

  return (
    <View>
      <View style={s.kpiRow}>
        <View style={s.kpi}><Text style={s.kpiLabel}>ATIVAS</Text><Text style={[s.kpiValue, { color: Colors.green }]}>{localAutos.filter(a => a.enabled).length}</Text></View>
        <View style={s.kpi}><Text style={s.kpiLabel}>TOTAL ENVIADAS</Text><Text style={s.kpiValue}>{totalSent}</Text></View>
        <View style={s.kpi}><Text style={s.kpiLabel}>TEMPLATES</Text><Text style={s.kpiValue}>{localAutos.length}</Text></View>
      </View>

      <View style={s.card}>
        {localAutos.map(auto => (
          <View key={auto.id} style={s.autoRow}>
            <View style={s.autoLeft}>
              <View style={[s.autoIcon, { backgroundColor: auto.enabled ? Colors.violetD : Colors.bg4 }]}><Text style={[s.autoIconText, { color: auto.enabled ? Colors.violet3 : Colors.ink3 }]}>{auto.icon.charAt(0).toUpperCase()}</Text></View>
              <View style={s.autoInfo}>
                <Text style={s.autoName}>{auto.name}</Text>
                <Text style={s.autoDesc}>{auto.desc}</Text>
                <View style={s.autoMeta}>
                  <View style={s.autoTrigger}><Text style={s.autoTriggerText}>{auto.trigger}</Text></View>
                  {auto.sent > 0 && <Text style={s.autoSent}>{auto.sent} enviadas</Text>}
                </View>
              </View>
            </View>
            <Switch value={auto.enabled} onValueChange={() => handleToggle(auto.id)} trackColor={{ true: Colors.green, false: Colors.bg4 }} />
          </View>
        ))}
      </View>

      <View style={s.supportCard}>
        <Text style={s.supportTitle}>Automacao personalizada</Text>
        <Text style={s.supportDesc}>Precisa de uma automacao diferente? Nosso time cria fluxos sob medida para o seu negocio.</Text>
        <Pressable onPress={() => toast.success("Redirecionando para o suporte Aura...")} style={s.supportBtn}><Text style={s.supportBtnText}>Falar com meu Analista de Negocios</Text></Pressable>
        <Text style={s.supportHint}>Resposta em ate 2h uteis</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  kpiRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  kpi: { flex: 1, minWidth: IS_WIDE ? 120 : "30%", backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, alignItems: "center", gap: 6 },
  kpiLabel: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.8 },
  kpiValue: { fontSize: 20, fontWeight: "800", color: Colors.ink },
  card: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  autoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  autoLeft: { flexDirection: "row", gap: 12, flex: 1 },
  autoIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  autoIconText: { fontSize: 16, fontWeight: "700" },
  autoInfo: { flex: 1, gap: 4 },
  autoName: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  autoDesc: { fontSize: 11, color: Colors.ink3, lineHeight: 16 },
  autoMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  autoTrigger: { backgroundColor: Colors.bg4, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  autoTriggerText: { fontSize: 9, fontWeight: "600", color: Colors.ink3 },
  autoSent: { fontSize: 10, color: Colors.violet3, fontWeight: "500" },
  supportCard: { backgroundColor: Colors.violetD, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: Colors.border2, alignItems: "center", marginTop: 16, gap: 8 },
  supportTitle: { fontSize: 16, fontWeight: "700", color: Colors.ink },
  supportDesc: { fontSize: 12, color: Colors.ink3, textAlign: "center", lineHeight: 18, marginBottom: 4 },
  supportBtn: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 24 },
  supportBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  supportHint: { fontSize: 10, color: Colors.ink3, fontStyle: "italic" },
});

export default TabAutomacoes;
