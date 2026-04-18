import { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/services/api";
import { toast } from "@/components/Toast";
import { Icon } from "@/components/Icon";

var fmt = function(n: number) { return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2 }); };
function currentMonth() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0"); }

export function RepasseDentista() {
  var { company } = useAuthStore();
  var qc = useQueryClient();
  var [month, setMonth] = useState(currentMonth());

  var { data, isLoading } = useQuery({
    queryKey: ["dental-repasses", company?.id, month],
    queryFn: function() { return request("/companies/" + company!.id + "/dental/repasses?month=" + month); },
    enabled: !!company?.id, staleTime: 30000,
  });

  var { data: practData } = useQuery({
    queryKey: ["dental-practitioners", company?.id],
    queryFn: function() { return request("/companies/" + company!.id + "/dental/practitioners"); },
    enabled: !!company?.id, staleTime: 60000,
  });

  var calcMut = useMutation({
    mutationFn: function() { return request("/companies/" + company!.id + "/dental/repasses/calculate", { method: "POST", body: { month: month } }); },
    onSuccess: function(res: any) { qc.invalidateQueries({ queryKey: ["dental-repasses"] }); toast.success((res as any).calculated + " procedimentos calculados"); },
    onError: function() { toast.error("Erro ao calcular"); },
  });

  var patchPctMut = useMutation({
    mutationFn: function(p: { pid: string; pct: number }) { return request("/companies/" + company!.id + "/dental/practitioners/" + p.pid, { method: "PATCH", body: { repasse_pct: p.pct } }); },
    onSuccess: function() { qc.invalidateQueries({ queryKey: ["dental-practitioners"] }); toast.success("Taxa atualizada"); },
  });

  var markPaidMut = useMutation({
    mutationFn: function(rid: string) { return request("/companies/" + company!.id + "/dental/repasses/" + rid + "/status", { method: "PATCH", body: { status: "paid" } }); },
    onSuccess: function() { qc.invalidateQueries({ queryKey: ["dental-repasses"] }); toast.success("Marcado como pago"); },
  });

  var repData = (data as any) || {};
  var practitioners = repData.practitioners || [];
  var totals = repData.totals || {};
  var allPractitioners = ((practData as any)?.practitioners) || [];

  function changeMonth(delta: number) {
    var p = month.split("-"); var y = parseInt(p[0]); var m = parseInt(p[1]) + delta;
    if (m > 12) { m = 1; y++; } if (m < 1) { m = 12; y--; }
    setMonth(y + "-" + String(m).padStart(2, "0"));
  }
  var monthLabel = (function() { var p = month.split("-"); var names = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"]; return names[parseInt(p[1])-1] + "/" + p[0]; })();

  return (
    <View>
      <View style={z.header}>
        <Pressable onPress={function() { changeMonth(-1); }} style={z.monthBtn}><Text style={z.monthBtnText}>{"\u2039"}</Text></Pressable>
        <Text style={z.monthLabel}>{monthLabel}</Text>
        <Pressable onPress={function() { changeMonth(1); }} style={z.monthBtn}><Text style={z.monthBtnText}>{"\u203A"}</Text></Pressable>
        <Pressable onPress={function() { calcMut.mutate(); }} style={z.calcBtn} disabled={calcMut.isPending}>
          <Icon name="refresh" size={14} color={Colors.violet3} />
          <Text style={z.calcBtnText}>{calcMut.isPending ? "Calculando..." : "Recalcular"}</Text>
        </Pressable>
      </View>

      {totals.bruto > 0 && (
        <View style={z.totalsCard}>
          <View style={z.totalCol}>
            <Text style={z.totalLabel}>FATURAMENTO</Text>
            <Text style={z.totalValue}>{fmt(totals.bruto)}</Text>
          </View>
          <View style={z.totalCol}>
            <Text style={z.totalLabel}>REPASSES</Text>
            <Text style={[z.totalValue, { color: Colors.amber }]}>{fmt(totals.repasse)}</Text>
          </View>
          <View style={z.totalCol}>
            <Text style={z.totalLabel}>CLINICA</Text>
            <Text style={[z.totalValue, { color: Colors.green }]}>{fmt(totals.clinica)}</Text>
          </View>
        </View>
      )}

      {isLoading && <View style={{ padding: 40, alignItems: "center" }}><ActivityIndicator color={Colors.violet3} /></View>}

      {!isLoading && practitioners.map(function(p: any) {
        return (
          <View key={p.practitioner_id} style={z.practCard}>
            <View style={z.practHeader}>
              <View style={{ flex: 1 }}>
                <Text style={z.practName}>{p.name}</Text>
                <Text style={z.practRole}>{p.role || "Dentista"} | {p.repasse_pct}%</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[z.practValue, { color: Colors.green }]}>{fmt(p.total_repasse)}</Text>
                <Text style={z.practSub}>de {fmt(p.total_bruto)}</Text>
              </View>
            </View>
            <View style={z.practStats}>
              <View style={z.practStat}><Text style={z.practStatV}>{p.procedures.length}</Text><Text style={z.practStatL}>Proced.</Text></View>
              <View style={z.practStat}><Text style={z.practStatV}>{fmt(p.total_bruto)}</Text><Text style={z.practStatL}>Bruto</Text></View>
              <View style={[z.practStat, { backgroundColor: Colors.greenD }]}><Text style={[z.practStatV, { color: Colors.green }]}>{fmt(p.total_repasse)}</Text><Text style={z.practStatL}>Repasse</Text></View>
              <View style={z.practStat}><Text style={z.practStatV}>{fmt(p.total_clinica)}</Text><Text style={z.practStatL}>Clinica</Text></View>
            </View>
            <Pressable onPress={function() {
              var pendingIds = p.procedures.filter(function(pr: any) { return pr.status === 'pending'; }).map(function(pr: any) { return pr.id; });
              if (pendingIds.length === 0) { toast.info("Todos ja pagos"); return; }
              for (var id of pendingIds) markPaidMut.mutate(id);
            }} style={z.payBtn}>
              <Icon name="check" size={14} color="#fff" />
              <Text style={z.payBtnText}>Marcar todos como pago</Text>
            </Pressable>
          </View>
        );
      })}

      {!isLoading && practitioners.length === 0 && (
        <View style={z.empty}>
          <Icon name="dollar" size={28} color={Colors.ink3} />
          <Text style={z.emptyText}>Nenhum repasse em {monthLabel}</Text>
          <Text style={z.emptyHint}>Clique em "Recalcular" para gerar repasses com base nos procedimentos concluidos.</Text>
        </View>
      )}

      {allPractitioners.length > 0 && (
        <View style={z.configSection}>
          <Text style={z.configTitle}>Configuracao de repasse</Text>
          {allPractitioners.map(function(pr: any) {
            return (
              <View key={pr.id} style={z.configRow}>
                <Text style={z.configName}>{pr.name}</Text>
                <View style={z.configPctRow}>
                  <TextInput style={z.configInput} value={String(parseFloat(pr.repasse_pct) || 50)} onChangeText={function(v) {
                    var n = parseFloat(v.replace(",","."));
                    if (!isNaN(n) && n >= 0 && n <= 100) patchPctMut.mutate({ pid: pr.id, pct: n });
                  }} keyboardType="decimal-pad" maxLength={5} />
                  <Text style={z.configPct}>%</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

var z = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  monthBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  monthBtnText: { fontSize: 18, color: Colors.ink3, fontWeight: "700" },
  monthLabel: { fontSize: 16, color: Colors.ink, fontWeight: "700", minWidth: 80, textAlign: "center" },
  calcBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: "auto", backgroundColor: Colors.violetD, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: Colors.border2 },
  calcBtnText: { fontSize: 11, color: Colors.violet3, fontWeight: "600" },
  totalsCard: { flexDirection: "row", gap: 8, marginBottom: 16 },
  totalCol: { flex: 1, alignItems: "center", backgroundColor: Colors.bg3, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border2, gap: 4 },
  totalLabel: { fontSize: 8, color: Colors.ink3, letterSpacing: 0.8, fontWeight: "600" },
  totalValue: { fontSize: 18, fontWeight: "800", color: Colors.ink },
  practCard: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 10, gap: 10 },
  practHeader: { flexDirection: "row", alignItems: "center" },
  practName: { fontSize: 15, fontWeight: "700", color: Colors.ink },
  practRole: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  practValue: { fontSize: 16, fontWeight: "800" },
  practSub: { fontSize: 10, color: Colors.ink3 },
  practStats: { flexDirection: "row", gap: 4 },
  practStat: { flex: 1, alignItems: "center", backgroundColor: Colors.bg4, borderRadius: 8, paddingVertical: 8 },
  practStatV: { fontSize: 12, fontWeight: "700", color: Colors.ink },
  practStatL: { fontSize: 7, color: Colors.ink3, textTransform: "uppercase", marginTop: 2 },
  payBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: Colors.green, borderRadius: 10, paddingVertical: 10 },
  payBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 14, color: Colors.ink3, fontWeight: "600" },
  emptyHint: { fontSize: 12, color: Colors.ink3, textAlign: "center", maxWidth: 280 },
  configSection: { marginTop: 16, backgroundColor: Colors.bg3, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border },
  configTitle: { fontSize: 13, fontWeight: "700", color: Colors.ink, marginBottom: 10 },
  configRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  configName: { fontSize: 13, color: Colors.ink, fontWeight: "500" },
  configPctRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  configInput: { width: 50, backgroundColor: Colors.bg4, borderRadius: 6, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 8, paddingVertical: 4, fontSize: 13, color: Colors.ink, textAlign: "center", fontWeight: "700" },
  configPct: { fontSize: 13, color: Colors.ink3, fontWeight: "600" },
});

export default RepasseDentista;
