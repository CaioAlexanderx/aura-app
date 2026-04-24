import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { useQuery } from "@tanstack/react-query";
import { request } from "@/services/api";
import { Icon } from "@/components/Icon";

// ============================================================
// AURA. — OdontoDashboard
// Consome GET /dental/dashboard (endpoint agregado do BE).
// 10 KPIs em UM request, status PT-BR, TZ SP, D-UNIFY ok.
// ============================================================

const fmt = (n: number) => "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
const pct = (n: number) => `${n.toFixed(0)}%`;

const STAGE_LABELS: Record<string, string> = {
  lead:                 "Lead",
  contacted:            "Contato",
  evaluation_scheduled: "Avaliacao marcada",
  evaluation_done:      "Avaliacao feita",
  budget_sent:          "Orcamento enviado",
  budget_approved:      "Orcamento aprovado",
  in_treatment:         "Em tratamento",
};

function KpiCard({ value, label, color, icon, sublabel }: { value: string; label: string; color: string; icon: string; sublabel?: string }) {
  return (
    <View style={z.kpi}>
      <View style={[z.kpiIcon, { backgroundColor: color + "18" }]}>
        <Icon name={icon as any} size={14} color={color} />
      </View>
      <Text style={[z.kpiValue, { color }]}>{value}</Text>
      <Text style={z.kpiLabel}>{label}</Text>
      {sublabel && <Text style={z.kpiSub}>{sublabel}</Text>}
    </View>
  );
}

export function OdontoDashboard() {
  const { company } = useAuthStore();

  const { data, isLoading, error } = useQuery({
    queryKey: ["dental-dashboard", company?.id],
    queryFn: () => request<any>(`/companies/${company!.id}/dental/dashboard`),
    enabled: !!company?.id,
    staleTime: 30000,
  });

  const d = (data as any) || {};
  const hoje = d.consultas_hoje || {};
  const semana = d.consultas_semana || { total: 0, ativos: 0 };
  const fat = d.faturamento_mes || { realizado: 0, previsto: 0 };
  const parcVenc = d.parcelas_vencidas || { qtd: 0, valor: 0 };
  const parc7d = d.parcelas_proximas_7d || { qtd: 0, valor: 0 };
  const repasse = d.repasse_mes || { a_pagar: 0, pago: 0, bruto: 0 };
  const pacientes = d.pacientes || { total: 0, novos_mes: 0 };
  const recall = d.pacientes_recall || 0;
  const funil: Array<{ stage: string; qtd: number; valor: number }> = d.funil || [];
  const pipelineTotal = d.pipeline_total || 0;
  const procs: Array<{ nome: string; qtd: number; receita: number }> = d.top_procedimentos_mes || [];

  // Conversao: orcamento_aprovado / orcamento_enviado (estimativa simples)
  const budgetSent = funil.find(f => f.stage === "budget_sent")?.qtd || 0;
  const budgetApproved = funil.find(f => f.stage === "budget_approved")?.qtd || 0;
  const inTreatment = funil.find(f => f.stage === "in_treatment")?.qtd || 0;
  const conversionRate = budgetSent > 0 ? ((budgetApproved + inTreatment) / (budgetSent + budgetApproved + inTreatment)) * 100 : 0;

  if (isLoading) {
    return <View style={{ padding: 40, alignItems: "center" }}><ActivityIndicator color={Colors.violet3} /></View>;
  }

  if (error) {
    return (
      <View style={z.errorBox}>
        <Icon name="alert" size={16} color={Colors.red} />
        <Text style={z.errorText}>
          Nao foi possivel carregar o dashboard odonto. Tente recarregar a pagina.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Text style={z.title}>Dashboard Odonto</Text>

      {/* Agenda do dia */}
      <Text style={z.section}>Agenda</Text>
      <View style={z.row}>
        <KpiCard value={String(hoje.total || 0)} label="Consultas hoje" color="#06B6D4" icon="calendar"
          sublabel={hoje.confirmados > 0 ? `${hoje.confirmados} confirmadas` : undefined} />
        <KpiCard value={String(hoje.pendentes || 0)} label="A confirmar" color="#F59E0B" icon="clock" />
        <KpiCard value={String(hoje.concluidos || 0)} label="Concluidas" color={Colors.green || "#10B981"} icon="check" />
        <KpiCard value={String(hoje.faltas || 0)} label="Faltas" color={Colors.red || "#EF4444"} icon="alert" />
      </View>
      <View style={z.row}>
        <KpiCard value={String(semana.ativos || 0)} label="Proximos 7 dias" color="#06B6D4" icon="calendar"
          sublabel={`${semana.total || 0} no total`} />
      </View>

      {/* Financeiro */}
      <Text style={z.section}>Financeiro do mes</Text>
      <View style={z.row}>
        <KpiCard value={fmt(fat.realizado)} label="Realizado" color={Colors.green || "#10B981"} icon="wallet"
          sublabel="Atendimentos concluidos" />
        <KpiCard value={fmt(fat.previsto)} label="Previsto" color="#06B6D4" icon="trending_up"
          sublabel="Na agenda" />
        <KpiCard value={fmt(repasse.a_pagar)} label="Repasse a pagar" color={Colors.amber || "#F59E0B"} icon="dollar"
          sublabel={fmt(repasse.pago) + " ja pago"} />
      </View>

      {/* Cobranca */}
      <Text style={z.section}>Cobranca</Text>
      <View style={z.row}>
        <KpiCard value={fmt(parcVenc.valor)} label="Parcelas vencidas" color={Colors.red || "#EF4444"} icon="alert"
          sublabel={`${parcVenc.qtd} parcela${parcVenc.qtd !== 1 ? "s" : ""}`} />
        <KpiCard value={fmt(parc7d.valor)} label="Vencem em 7 dias" color={Colors.amber || "#F59E0B"} icon="clock"
          sublabel={`${parc7d.qtd} parcela${parc7d.qtd !== 1 ? "s" : ""}`} />
      </View>

      {/* Pacientes */}
      <Text style={z.section}>Pacientes</Text>
      <View style={z.row}>
        <KpiCard value={String(pacientes.total || 0)} label="Base ativa" color="#06B6D4" icon="users"
          sublabel={`+${pacientes.novos_mes || 0} este mes`} />
        <KpiCard value={String(recall)} label="Recall pendente" color={Colors.violet3 || "#a78bfa"} icon="phone"
          sublabel="Sem visita ha 150+ dias" />
      </View>

      {/* Funil */}
      {pipelineTotal > 0 && (
        <>
          <Text style={z.section}>Funil comercial</Text>
          <View style={z.funnelCard}>
            <View style={z.funnelHeader}>
              <View>
                <Text style={z.funnelTotal}>{fmt(pipelineTotal)}</Text>
                <Text style={z.funnelSub}>em pipeline</Text>
              </View>
              {conversionRate > 0 && (
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[z.funnelTotal, { color: Colors.green || "#10B981" }]}>{pct(conversionRate)}</Text>
                  <Text style={z.funnelSub}>de conversao</Text>
                </View>
              )}
            </View>
            {funil.filter(f => f.qtd > 0).map(f => (
              <View key={f.stage} style={z.funnelRow}>
                <Text style={z.funnelStage}>{STAGE_LABELS[f.stage] || f.stage}</Text>
                <Text style={z.funnelQtd}>{f.qtd}</Text>
                <Text style={z.funnelValue}>{fmt(f.valor)}</Text>
              </View>
            ))}
            {funil.every(f => f.qtd === 0) && (
              <Text style={z.empty}>Nenhum lead ativo no funil.</Text>
            )}
          </View>
        </>
      )}

      {/* Top procedimentos */}
      {procs.length > 0 && (
        <>
          <Text style={z.section}>Top procedimentos do mes</Text>
          <View style={z.procsCard}>
            {procs.map((p, idx) => (
              <View key={p.nome + idx} style={z.procRow}>
                <Text style={z.procRank}>#{idx + 1}</Text>
                <Text style={z.procName} numberOfLines={1}>{p.nome}</Text>
                <Text style={z.procQtd}>{p.qtd}x</Text>
                <Text style={z.procValue}>{fmt(p.receita)}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Info IA */}
      <View style={z.infoCard}>
        <Icon name="star" size={12} color={Colors.violet3 || "#a78bfa"} />
        <Text style={z.infoText}>
          O agente IA odonto analisa estes mesmos dados para sugerir acoes. Abra pelo botao flutuante → Odonto.
        </Text>
      </View>
    </ScrollView>
  );
}

const z = StyleSheet.create({
  title:       { fontSize: 16, fontWeight: "700", color: Colors.ink, marginBottom: 6 },
  section:     { fontSize: 11, fontWeight: "700", color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 16, marginBottom: 8 },
  row:         { flexDirection: "row", flexWrap: "wrap", gap: 6 },

  kpi:         { flex: 1, minWidth: "22%", alignItems: "center", backgroundColor: Colors.bg3, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border, gap: 3 },
  kpiIcon:     { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  kpiValue:    { fontSize: 15, fontWeight: "800", marginTop: 2 },
  kpiLabel:    { fontSize: 8, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5, textAlign: "center" },
  kpiSub:      { fontSize: 9, color: Colors.ink3, textAlign: "center", marginTop: 1 },

  funnelCard:  { backgroundColor: Colors.bg3, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border },
  funnelHeader:{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  funnelTotal: { fontSize: 18, fontWeight: "800", color: Colors.ink },
  funnelSub:   { fontSize: 10, color: Colors.ink3, marginTop: 2 },
  funnelRow:   { flexDirection: "row", alignItems: "center", paddingVertical: 6, gap: 8 },
  funnelStage: { flex: 1, fontSize: 12, color: Colors.ink },
  funnelQtd:   { fontSize: 12, color: Colors.violet3 || "#a78bfa", fontWeight: "700", minWidth: 30, textAlign: "right" },
  funnelValue: { fontSize: 11, color: Colors.ink3, fontWeight: "600", minWidth: 80, textAlign: "right" },

  procsCard:   { backgroundColor: Colors.bg3, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: Colors.border },
  procRow:     { flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 10, gap: 8 },
  procRank:    { fontSize: 11, color: Colors.ink3, fontWeight: "700", width: 22 },
  procName:    { flex: 1, fontSize: 12, color: Colors.ink, fontWeight: "500" },
  procQtd:     { fontSize: 11, color: Colors.violet3 || "#a78bfa", fontWeight: "700", minWidth: 30, textAlign: "right" },
  procValue:   { fontSize: 12, color: Colors.green || "#10B981", fontWeight: "700", minWidth: 80, textAlign: "right" },

  empty:       { fontSize: 12, color: Colors.ink3, textAlign: "center", paddingVertical: 16 },

  infoCard:    { flexDirection: "row", gap: 8, backgroundColor: Colors.violetD, borderRadius: 10, padding: 12, marginTop: 20, borderWidth: 1, borderColor: Colors.border2 },
  infoText:    { fontSize: 11, color: Colors.violet3 || "#a78bfa", flex: 1, lineHeight: 16 },

  errorBox:    { flexDirection: "row", gap: 10, alignItems: "center", backgroundColor: Colors.bg3, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: Colors.red || "#EF4444" },
  errorText:   { flex: 1, fontSize: 12, color: Colors.ink },
});

export default OdontoDashboard;
