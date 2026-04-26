import { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, ScrollView } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/services/api";
import { toast } from "@/components/Toast";
import { Icon } from "@/components/Icon";
import { invalidateDentalFinancials } from "@/lib/dentalQueryHelpers";

// ============================================================
// AURA. — RepasseDentista
// Consome:
//   GET  /dental/repasses?month=YYYY-MM
//   POST /dental/repasses/calculate
//   PATCH /dental/repasses/:rid/status
//   GET  /dental/repasse-config  (renomeado de /practitioners pra nao
//                                 conflitar com dentalPractitioners.js)
//   PATCH /dental/repasse-config/:pid
// Pos-D-UNIFY: usa dental_practitioners (cro/specialty) em vez de employees.
//
// PR7 (2026-04-26): markPaidMut agora invalida queries financeiras
// cruzadas (transactions, dre, dashboard) porque marcar repasse como
// pago dispara trigger backend (064_dental_to_transactions_p0) que
// cria transaction (expense, repasse_dentista). Sem isso, /financeiro
// genericos mostra dado stale por ate 30s.
// ============================================================

const fmt = (n: number) => "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
function currentMonth() { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0"); }

export function RepasseDentista() {
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const [month, setMonth] = useState(currentMonth());

  const { data, isLoading } = useQuery({
    queryKey: ["dental-repasses", company?.id, month],
    queryFn: () => request<any>(`/companies/${company!.id}/dental/repasses?month=${month}`),
    enabled: !!company?.id, staleTime: 30000,
  });

  const { data: configData } = useQuery({
    queryKey: ["dental-repasse-config", company?.id],
    queryFn: () => request<any>(`/companies/${company!.id}/dental/repasse-config`),
    enabled: !!company?.id, staleTime: 60000,
  });

  const calcMut = useMutation({
    mutationFn: () => request<any>(`/companies/${company!.id}/dental/repasses/calculate`, { method: "POST", body: { month } }),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["dental-repasses"] });
      toast.success(`${(res as any).calculated || 0} procedimentos calculados`);
    },
    onError: () => { toast.error("Erro ao calcular repasses"); },
  });

  const patchPctMut = useMutation({
    mutationFn: (p: { pid: string; pct: number }) =>
      request<any>(`/companies/${company!.id}/dental/repasse-config/${p.pid}`, { method: "PATCH", body: { repasse_pct: p.pct } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dental-repasse-config"] });
      toast.success("Taxa atualizada");
    },
  });

  const markPaidMut = useMutation({
    mutationFn: (rid: string) =>
      request<any>(`/companies/${company!.id}/dental/repasses/${rid}/status`, { method: "PATCH", body: { status: "paid" } }),
    onSuccess: () => {
      // Repasse marcado como pago dispara trigger backend que cria
      // transaction (expense, repasse_dentista). Invalidamos tanto a
      // query dental original quanto as queries financeiras cruzadas
      // pra UI de /financeiro e DRE atualizarem instantaneamente.
      qc.invalidateQueries({ queryKey: ["dental-repasses"] });
      invalidateDentalFinancials(qc);
      toast.success("Marcado como pago");
    },
  });

  const repData = (data as any) || {};
  const practitioners = repData.practitioners || [];
  const totals = repData.totals || {};
  const allPractitioners = ((configData as any)?.practitioners) || [];

  function changeMonth(delta: number) {
    const p = month.split("-"); let y = parseInt(p[0]); let m = parseInt(p[1]) + delta;
    if (m > 12) { m = 1; y++; }
    if (m < 1)  { m = 12; y--; }
    setMonth(y + "-" + String(m).padStart(2, "0"));
  }

  const monthLabel = (() => {
    const p = month.split("-");
    const names = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
    return names[parseInt(p[1])-1] + "/" + p[0];
  })();

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={z.header}>
        <Pressable onPress={() => changeMonth(-1)} style={z.monthBtn} hitSlop={8}>
          <Text style={z.monthBtnText}>{"‹"}</Text>
        </Pressable>
        <Text style={z.monthLabel}>{monthLabel}</Text>
        <Pressable onPress={() => changeMonth(1)} style={z.monthBtn} hitSlop={8}>
          <Text style={z.monthBtnText}>{"›"}</Text>
        </Pressable>
        <Pressable onPress={() => calcMut.mutate()} style={z.calcBtn} disabled={calcMut.isPending}>
          <Icon name="refresh" size={14} color={Colors.violet3 || "#a78bfa"} />
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
            <Text style={[z.totalValue, { color: Colors.amber || "#F59E0B" }]}>{fmt(totals.repasse)}</Text>
          </View>
          <View style={z.totalCol}>
            <Text style={z.totalLabel}>CLINICA</Text>
            <Text style={[z.totalValue, { color: Colors.green || "#10B981" }]}>{fmt(totals.clinica)}</Text>
          </View>
        </View>
      )}

      {isLoading && (
        <View style={{ padding: 40, alignItems: "center" }}>
          <ActivityIndicator color={Colors.violet3 || "#a78bfa"} />
        </View>
      )}

      {!isLoading && practitioners.map((p: any) => {
        const pending = (p.procedures || []).filter((pr: any) => pr.status === "pending").length;
        const paid    = (p.procedures || []).filter((pr: any) => pr.status === "paid").length;

        return (
          <View key={p.practitioner_id} style={z.practCard}>
            <View style={z.practHeader}>
              <View style={{ flex: 1 }}>
                <Text style={z.practName}>{p.name}</Text>
                <Text style={z.practRole}>
                  {p.specialty || "Dentista"}{p.cro ? " • " + p.cro : ""} • {p.repasse_pct}%
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[z.practValue, { color: Colors.green || "#10B981" }]}>{fmt(p.total_repasse)}</Text>
                <Text style={z.practSub}>de {fmt(p.total_bruto)}</Text>
              </View>
            </View>

            <View style={z.practStats}>
              <View style={z.practStat}>
                <Text style={z.practStatV}>{(p.procedures || []).length}</Text>
                <Text style={z.practStatL}>Proced.</Text>
              </View>
              <View style={z.practStat}>
                <Text style={z.practStatV}>{fmt(p.total_bruto)}</Text>
                <Text style={z.practStatL}>Bruto</Text>
              </View>
              <View style={[z.practStat, { backgroundColor: Colors.greenD }]}>
                <Text style={[z.practStatV, { color: Colors.green || "#10B981" }]}>{fmt(p.total_repasse)}</Text>
                <Text style={z.practStatL}>Repasse</Text>
              </View>
              <View style={z.practStat}>
                <Text style={z.practStatV}>{fmt(p.total_clinica)}</Text>
                <Text style={z.practStatL}>Clinica</Text>
              </View>
            </View>

            {pending > 0 && (
              <Pressable onPress={() => {
                const pendingIds = (p.procedures || [])
                  .filter((pr: any) => pr.status === "pending")
                  .map((pr: any) => pr.id);
                if (pendingIds.length === 0) { toast.info("Todos ja pagos"); return; }
                pendingIds.forEach((id: string) => markPaidMut.mutate(id));
              }} style={z.payBtn}>
                <Icon name="check" size={14} color="#fff" />
                <Text style={z.payBtnText}>
                  Marcar {pending} como pago{pending > 1 ? "s" : ""}{paid > 0 ? ` (${paid} ja pago${paid > 1 ? "s" : ""})` : ""}
                </Text>
              </Pressable>
            )}
            {pending === 0 && (p.procedures || []).length > 0 && (
              <View style={z.allPaidBanner}>
                <Icon name="check" size={12} color={Colors.green || "#10B981"} />
                <Text style={z.allPaidText}>Todos os repasses deste dentista estao pagos</Text>
              </View>
            )}
          </View>
        );
      })}

      {!isLoading && practitioners.length === 0 && (
        <View style={z.empty}>
          <Icon name="dollar" size={28} color={Colors.ink3} />
          <Text style={z.emptyText}>Nenhum repasse em {monthLabel}</Text>
          <Text style={z.emptyHint}>
            Clique em "Recalcular" para gerar repasses com base nos atendimentos concluidos no mes.
          </Text>
        </View>
      )}

      {allPractitioners.length > 0 && (
        <View style={z.configSection}>
          <Text style={z.configTitle}>Configuracao de repasse</Text>
          <Text style={z.configHint}>Percentual que cada dentista recebe sobre o valor do procedimento concluido.</Text>
          {allPractitioners.map((pr: any) => (
            <View key={pr.id} style={z.configRow}>
              <View style={{ flex: 1 }}>
                <Text style={z.configName}>{pr.name}</Text>
                <Text style={z.configMeta}>
                  {pr.specialty || "Dentista"}{pr.cro ? " • " + pr.cro : ""}
                </Text>
              </View>
              <View style={z.configPctRow}>
                <TextInput
                  style={z.configInput}
                  defaultValue={String(parseFloat(pr.repasse_pct) || 50)}
                  onEndEditing={(e) => {
                    const n = parseFloat(e.nativeEvent.text.replace(",", "."));
                    if (!isNaN(n) && n >= 0 && n <= 100) patchPctMut.mutate({ pid: pr.id, pct: n });
                  }}
                  keyboardType="decimal-pad"
                  maxLength={5}
                />
                <Text style={z.configPct}>%</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const z = StyleSheet.create({
  header:       { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  monthBtn:     { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  monthBtnText: { fontSize: 18, color: Colors.ink3, fontWeight: "700" },
  monthLabel:   { fontSize: 16, color: Colors.ink, fontWeight: "700", minWidth: 80, textAlign: "center" },
  calcBtn:      { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: "auto", backgroundColor: Colors.violetD, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: Colors.border2 },
  calcBtnText:  { fontSize: 11, color: Colors.violet3 || "#a78bfa", fontWeight: "600" },

  totalsCard:   { flexDirection: "row", gap: 8, marginBottom: 16 },
  totalCol:     { flex: 1, alignItems: "center", backgroundColor: Colors.bg3, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border2, gap: 4 },
  totalLabel:   { fontSize: 8, color: Colors.ink3, letterSpacing: 0.8, fontWeight: "600" },
  totalValue:   { fontSize: 18, fontWeight: "800", color: Colors.ink },

  practCard:    { backgroundColor: Colors.bg3, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 10, gap: 10 },
  practHeader:  { flexDirection: "row", alignItems: "center" },
  practName:    { fontSize: 15, fontWeight: "700", color: Colors.ink },
  practRole:    { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  practValue:   { fontSize: 16, fontWeight: "800" },
  practSub:     { fontSize: 10, color: Colors.ink3 },
  practStats:   { flexDirection: "row", gap: 4 },
  practStat:    { flex: 1, alignItems: "center", backgroundColor: Colors.bg4, borderRadius: 8, paddingVertical: 8 },
  practStatV:   { fontSize: 12, fontWeight: "700", color: Colors.ink },
  practStatL:   { fontSize: 7, color: Colors.ink3, textTransform: "uppercase", marginTop: 2 },

  payBtn:       { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: Colors.green || "#10B981", borderRadius: 10, paddingVertical: 10 },
  payBtnText:   { color: "#fff", fontSize: 13, fontWeight: "700" },

  allPaidBanner:{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.greenD, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  allPaidText:  { fontSize: 11, color: Colors.green || "#10B981", fontWeight: "600" },

  empty:        { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyText:    { fontSize: 14, color: Colors.ink3, fontWeight: "600" },
  emptyHint:    { fontSize: 12, color: Colors.ink3, textAlign: "center", maxWidth: 320 },

  configSection:{ marginTop: 16, backgroundColor: Colors.bg3, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border },
  configTitle:  { fontSize: 13, fontWeight: "700", color: Colors.ink, marginBottom: 4 },
  configHint:   { fontSize: 11, color: Colors.ink3, marginBottom: 10 },
  configRow:    { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10 },
  configName:   { fontSize: 13, color: Colors.ink, fontWeight: "500" },
  configMeta:   { fontSize: 10, color: Colors.ink3, marginTop: 2 },
  configPctRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  configInput:  { width: 54, backgroundColor: Colors.bg4, borderRadius: 6, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 8, paddingVertical: 4, fontSize: 13, color: Colors.ink, textAlign: "center", fontWeight: "700" } as any,
  configPct:    { fontSize: 13, color: Colors.ink3, fontWeight: "600" },
});

export default RepasseDentista;
