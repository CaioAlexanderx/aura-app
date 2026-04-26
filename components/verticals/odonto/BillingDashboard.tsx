import { useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/services/api";
import { toast } from "@/components/Toast";
import { Icon } from "@/components/Icon";
import { MarkPaymentPaidModal, type PendingPayment } from "@/components/dental/MarkPaymentPaidModal";

// ============================================================
// AURA. — BillingDashboard
//
// PR11 (2026-04-26): adiciona botao Receber em cada parcela vencida
// + modal MarkPaymentPaidModal. Backend (068) cria transaction
// automaticamente quando paid_at sai de NULL.
// ============================================================

var fmt = function(n: number) { return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2 }); };

export function BillingDashboard() {
  var { company } = useAuthStore();
  var qc = useQueryClient();
  var [paymentToMark, setPaymentToMark] = useState<PendingPayment | null>(null);

  var { data: dashboard, isLoading: loadingDash } = useQuery({
    queryKey: ["dental-billing-dash", company?.id],
    queryFn: function() { return request("/companies/" + company!.id + "/dental/billing/dashboard"); },
    enabled: !!company?.id, staleTime: 30000,
  });

  var { data: overdue, isLoading: loadingOverdue } = useQuery({
    queryKey: ["dental-billing-overdue", company?.id],
    queryFn: function() { return request("/companies/" + company!.id + "/dental/billing/overdue"); },
    enabled: !!company?.id, staleTime: 15000,
  });

  var reminderMut = useMutation({
    mutationFn: function(paymentId: string) { return request("/companies/" + company!.id + "/dental/billing/send-reminder/" + paymentId, { method: "POST", body: { reminder_type: "manual" } }); },
    onSuccess: function(data: any) { toast.success("Lembrete enviado para " + (data as any).patient); qc.invalidateQueries({ queryKey: ["dental-billing"] }); },
    onError: function() { toast.error("Erro ao enviar lembrete"); },
  });

  var dash = (dashboard as any) || {};
  var overdueList = ((overdue as any)?.overdue) || [];
  var isLoading = loadingDash || loadingOverdue;

  return (
    <View>
      <Text style={z.title}>Cobrancas</Text>

      {isLoading && <View style={{ padding: 40, alignItems: "center" }}><ActivityIndicator color={Colors.violet3} /></View>}

      {!isLoading && (
        <View style={z.kpiRow}>
          <View style={z.kpi}>
            <Text style={z.kpiValue}>{fmt(dash.a_receber || 0)}</Text>
            <Text style={z.kpiLabel}>A receber</Text>
          </View>
          <View style={[z.kpi, dash.vencido > 0 && { borderColor: Colors.red + "44" }]}>
            <Text style={[z.kpiValue, { color: Colors.red }]}>{fmt(dash.vencido || 0)}</Text>
            <Text style={z.kpiLabel}>Vencido</Text>
          </View>
          <View style={z.kpi}>
            <Text style={[z.kpiValue, { color: Colors.green }]}>{fmt(dash.recebido_mes || 0)}</Text>
            <Text style={z.kpiLabel}>Recebido mes</Text>
          </View>
          <View style={z.kpi}>
            <Text style={[z.kpiValue, { color: Colors.amber }]}>{dash.taxa_inadimplencia || 0}%</Text>
            <Text style={z.kpiLabel}>Inadimplencia</Text>
          </View>
        </View>
      )}

      {overdueList.length > 0 && (
        <View>
          <View style={z.overdueHeader}>
            <Icon name="alert" size={14} color={Colors.red} />
            <Text style={z.overdueTitle}>{overdueList.length} parcela{overdueList.length > 1 ? "s" : ""} vencida{overdueList.length > 1 ? "s" : ""}</Text>
          </View>
          {overdueList.map(function(p: any) {
            return (
              <View key={p.payment_id} style={z.overdueCard}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={z.overdueName}>{p.patient_name}</Text>
                  <Text style={z.overdueMeta}>{fmt(parseFloat(p.amount))} | Vencida ha {p.days_overdue} dia{p.days_overdue > 1 ? "s" : ""}</Text>
                  {p.patient_phone && <Text style={z.overdueMeta}>{p.patient_phone}</Text>}
                </View>
                <View style={z.actionsRow}>
                  <Pressable onPress={function() { reminderMut.mutate(p.payment_id); }} style={z.cobrBtn} disabled={reminderMut.isPending}>
                    <Icon name="phone" size={12} color={Colors.violet3} />
                    <Text style={z.cobrBtnText}>Cobrar</Text>
                  </Pressable>
                  <Pressable
                    onPress={function() { setPaymentToMark({ payment_id: p.payment_id, patient_name: p.patient_name, amount: parseFloat(p.amount) }); }}
                    style={z.recvBtn}
                  >
                    <Icon name="check" size={12} color="#fff" />
                    <Text style={z.recvBtnText}>Receber</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {!isLoading && overdueList.length === 0 && (
        <View style={z.empty}>
          <Icon name="check" size={28} color={Colors.green} />
          <Text style={z.emptyText}>Nenhuma parcela vencida</Text>
          <Text style={z.emptyHint}>Todos os pagamentos estao em dia.</Text>
        </View>
      )}

      <MarkPaymentPaidModal
        payment={paymentToMark}
        onClose={function() { setPaymentToMark(null); }}
      />
    </View>
  );
}

var z = StyleSheet.create({
  title: { fontSize: 16, fontWeight: "700", color: Colors.ink, marginBottom: 12 },
  kpiRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 16 },
  kpi: { flex: 1, minWidth: "22%", alignItems: "center", backgroundColor: Colors.bg3, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border, gap: 4 },
  kpiValue: { fontSize: 15, fontWeight: "800", color: Colors.ink },
  kpiLabel: { fontSize: 8, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  overdueHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  overdueTitle: { fontSize: 14, fontWeight: "700", color: Colors.red },
  overdueCard: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.bg3, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.redD, marginBottom: 6, gap: 10, flexWrap: "wrap" },
  overdueName: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  overdueMeta: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  actionsRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  cobrBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.violetD, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: Colors.border2 },
  cobrBtnText: { fontSize: 11, color: Colors.violet3, fontWeight: "600" },
  recvBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#06B6D4", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  recvBtnText: { fontSize: 11, color: "#fff", fontWeight: "700" },
  empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 14, color: Colors.ink3, fontWeight: "600" },
  emptyHint: { fontSize: 12, color: Colors.ink3 },
});

export default BillingDashboard;
