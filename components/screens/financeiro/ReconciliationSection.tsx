import { useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { useQuery } from "@tanstack/react-query";
import { request, BASE_URL } from "@/services/api";
import { toast } from "@/components/Toast";
import { fmt } from "./types";

var isWeb = Platform.OS === "web";

type ReconciliationData = {
  summary: { total: number; matched: number; unmatched: number; match_rate: number };
  unmatched: { id: string; description: string; amount: number; type: string; date: string }[];
};

export function ReconciliationSection() {
  var { company, token } = useAuthStore();
  var companyId = company?.id;

  var { data, isLoading, refetch } = useQuery<ReconciliationData>({
    queryKey: ["bank-reconciliation", companyId],
    queryFn: function() { return request<ReconciliationData>("/companies/" + companyId + "/bank/summary"); },
    enabled: !!companyId,
    staleTime: 120_000,
    retry: 1,
  });

  var [uploading, setUploading] = useState(false);

  async function handleImportOFX() {
    if (!isWeb || !companyId || !token) return;
    var input = document.createElement("input");
    input.type = "file";
    input.accept = ".ofx,.csv";
    input.onchange = async function() {
      var file = input.files?.[0];
      if (!file) return;
      setUploading(true);
      try {
        var text = await file.text();
        var res = await fetch(BASE_URL + "/companies/" + companyId + "/bank/import", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
          body: JSON.stringify({ content: text, format: file.name.endsWith(".ofx") ? "ofx" : "csv", filename: file.name }),
        });
        var data = await res.json();
        if (!res.ok) { toast.error(data.error || "Erro ao importar"); return; }
        toast.success((data.imported || 0) + " lancamentos importados, " + (data.matched || 0) + " conciliados automaticamente");
        refetch();
      } catch (err: any) {
        toast.error("Erro: " + (err?.message || "tente novamente"));
      } finally { setUploading(false); }
    };
    input.click();
  }

  // Se nao tem dados, mostra call-to-action
  if (!isLoading && (!data || !data.summary || data.summary.total === 0)) {
    return (
      <View style={s.card}>
        <View style={s.headerRow}>
          <Icon name="file_text" size={16} color={Colors.violet3} />
          <Text style={s.title}>Conciliacao bancaria</Text>
        </View>
        <Text style={s.hint}>Importe seu extrato bancario (OFX ou CSV) para conciliar automaticamente com seus lancamentos.</Text>
        {isWeb && (
          <Pressable onPress={handleImportOFX} disabled={uploading} style={[s.importBtn, uploading && { opacity: 0.6 }]}>
            {uploading ? <ActivityIndicator size="small" color="#fff" /> : <Icon name="upload" size={14} color="#fff" />}
            <Text style={s.importBtnText}>{uploading ? "Importando..." : "Importar extrato"}</Text>
          </Pressable>
        )}
      </View>
    );
  }

  if (isLoading) return <View style={s.card}><ActivityIndicator color={Colors.violet3} /></View>;
  if (!data) return null;

  var sm = data.summary;
  var rate = sm.match_rate || (sm.total > 0 ? Math.round((sm.matched / sm.total) * 100) : 0);
  var rateColor = rate >= 80 ? Colors.green : rate >= 50 ? Colors.amber : Colors.red;

  return (
    <View style={s.card}>
      <View style={s.headerRow}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
          <Icon name="file_text" size={16} color={Colors.violet3} />
          <Text style={s.title}>Conciliacao bancaria</Text>
        </View>
        {isWeb && (
          <Pressable onPress={handleImportOFX} disabled={uploading} style={s.smallImportBtn}>
            <Icon name="upload" size={12} color={Colors.violet3} />
            <Text style={s.smallImportText}>Importar</Text>
          </Pressable>
        )}
      </View>

      <View style={s.statsRow}>
        <View style={s.stat}>
          <Text style={s.statVal}>{sm.total}</Text>
          <Text style={s.statLabel}>Total</Text>
        </View>
        <View style={s.stat}>
          <Text style={[s.statVal, { color: Colors.green }]}>{sm.matched}</Text>
          <Text style={s.statLabel}>Conciliados</Text>
        </View>
        <View style={s.stat}>
          <Text style={[s.statVal, { color: Colors.amber }]}>{sm.unmatched}</Text>
          <Text style={s.statLabel}>Pendentes</Text>
        </View>
        <View style={s.stat}>
          <Text style={[s.statVal, { color: rateColor }]}>{rate}%</Text>
          <Text style={s.statLabel}>Taxa</Text>
        </View>
      </View>

      <View style={s.progressTrack}>
        <View style={[s.progressFill, { width: rate + "%", backgroundColor: rateColor }, isWeb && { transition: "width 0.5s" } as any]} />
      </View>
    </View>
  );
}

var s = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 20 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  title: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  hint: { fontSize: 12, color: Colors.ink3, lineHeight: 18, marginBottom: 14 },
  importBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.violet, borderRadius: 10, paddingVertical: 12 },
  importBtnText: { fontSize: 13, color: "#fff", fontWeight: "600" },
  smallImportBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2 },
  smallImportText: { fontSize: 11, color: Colors.violet3, fontWeight: "600" },
  statsRow: { flexDirection: "row", gap: 4, marginBottom: 12 },
  stat: { flex: 1, alignItems: "center" },
  statVal: { fontSize: 18, fontWeight: "800", color: Colors.ink },
  statLabel: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.3, marginTop: 2 },
  progressTrack: { height: 6, backgroundColor: Colors.bg4, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 3 },
});

export default ReconciliationSection;
