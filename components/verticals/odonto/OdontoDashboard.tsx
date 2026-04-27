import { Fragment, ReactNode } from "react";
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Platform } from "react-native";
import { useAuthStore } from "@/stores/auth";
import { useQuery } from "@tanstack/react-query";
import { request } from "@/services/api";
import { Icon } from "@/components/Icon";
import { DentalColors } from "@/constants/dental-tokens";
import { DentalKpiCard } from "@/components/dental/DentalKpiCard";
import { DentalSectionHeader } from "@/components/dental/DentalSectionHeader";

// ============================================================
// AURA. — OdontoDashboard
//
// Consome GET /dental/dashboard (endpoint agregado do BE).
// Aceita sectionsOrder pra reordenar por persona (PR4).
// PR16 (2026-04-27): KPI cards e section headers tokenizados
// com DentalColors, padrao visual rico do shell negocio.
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

export type SectionKey = "agenda" | "financeiro" | "cobranca" | "pacientes" | "funil" | "topProcs";

const DEFAULT_ORDER: SectionKey[] = ["agenda", "financeiro", "cobranca", "pacientes", "funil", "topProcs"];

interface Props {
  sectionsOrder?: SectionKey[];
  hideTitle?: boolean;
}

function currentMonthChip(): string {
  const m = new Date().toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");
  return m;
}

export function OdontoDashboard({ sectionsOrder = DEFAULT_ORDER, hideTitle = false }: Props = {}) {
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

  const budgetSent = funil.find(f => f.stage === "budget_sent")?.qtd || 0;
  const budgetApproved = funil.find(f => f.stage === "budget_approved")?.qtd || 0;
  const inTreatment = funil.find(f => f.stage === "in_treatment")?.qtd || 0;
  const conversionRate = budgetSent > 0
    ? ((budgetApproved + inTreatment) / (budgetSent + budgetApproved + inTreatment)) * 100
    : 0;

  if (isLoading) {
    return <View style={{ padding: 40, alignItems: "center" }}><ActivityIndicator color={DentalColors.cyan} /></View>;
  }

  if (error) {
    return (
      <View style={z.errorBox}>
        <Icon name="alert" size={16} color={DentalColors.red} />
        <Text style={z.errorText}>Nao foi possivel carregar o dashboard odonto. Tente recarregar a pagina.</Text>
      </View>
    );
  }

  const SECTIONS: Record<SectionKey, () => ReactNode> = {
    agenda: () => (
      <Fragment>
        <DentalSectionHeader title="Agenda" chip="Hoje" />
        <View style={z.row}>
          <DentalKpiCard value={String(hoje.total || 0)} label="Consultas hoje" color={DentalColors.cyan} icon="calendar"
            sublabel={hoje.confirmados > 0 ? `${hoje.confirmados} confirmadas` : undefined} />
          <DentalKpiCard value={String(hoje.pendentes || 0)} label="A confirmar" color={DentalColors.amber} icon="clock" />
          <DentalKpiCard value={String(hoje.concluidos || 0)} label="Concluidas" color={DentalColors.green} icon="check" />
          <DentalKpiCard value={String(hoje.faltas || 0)} label="Faltas" color={DentalColors.red} icon="alert" />
        </View>
        <View style={[z.row, { marginTop: 8 }]}>
          <DentalKpiCard value={String(semana.ativos || 0)} label="Proximos 7 dias" color={DentalColors.cyan} icon="calendar"
            sublabel={`${semana.total || 0} no total`} />
        </View>
      </Fragment>
    ),

    financeiro: () => (
      <Fragment>
        <DentalSectionHeader title="Financeiro do mes" chip={currentMonthChip()} />
        <View style={z.row}>
          <DentalKpiCard value={fmt(fat.realizado)} label="Realizado" color={DentalColors.green} icon="wallet"
            sublabel="Atendimentos concluidos" />
          <DentalKpiCard value={fmt(fat.previsto)} label="Previsto" color={DentalColors.cyan} icon="trending_up"
            sublabel="Na agenda" />
          <DentalKpiCard value={fmt(repasse.a_pagar)} label="Repasse a pagar" color={DentalColors.amber} icon="dollar"
            sublabel={fmt(repasse.pago) + " ja pago"} />
        </View>
      </Fragment>
    ),

    cobranca: () => (
      <Fragment>
        <DentalSectionHeader title="Cobranca" />
        <View style={z.row}>
          <DentalKpiCard value={fmt(parcVenc.valor)} label="Parcelas vencidas" color={DentalColors.red} icon="alert"
            sublabel={`${parcVenc.qtd} parcela${parcVenc.qtd !== 1 ? "s" : ""}`} />
          <DentalKpiCard value={fmt(parc7d.valor)} label="Vencem em 7 dias" color={DentalColors.amber} icon="clock"
            sublabel={`${parc7d.qtd} parcela${parc7d.qtd !== 1 ? "s" : ""}`} />
        </View>
      </Fragment>
    ),

    pacientes: () => (
      <Fragment>
        <DentalSectionHeader title="Pacientes" />
        <View style={z.row}>
          <DentalKpiCard value={String(pacientes.total || 0)} label="Base ativa" color={DentalColors.cyan} icon="users"
            sublabel={`+${pacientes.novos_mes || 0} este mes`} />
          <DentalKpiCard value={String(recall)} label="Recall pendente" color={DentalColors.violet} icon="phone"
            sublabel="Sem visita ha 150+ dias" />
        </View>
      </Fragment>
    ),

    funil: () => (
      pipelineTotal > 0 ? (
        <Fragment>
          <DentalSectionHeader title="Funil comercial" />
          <View style={z.glassCard}>
            <View style={z.funnelHeader}>
              <View>
                <Text style={z.funnelTotal}>{fmt(pipelineTotal)}</Text>
                <Text style={z.funnelSub}>em pipeline</Text>
              </View>
              {conversionRate > 0 && (
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[z.funnelTotal, { color: DentalColors.green }]}>{pct(conversionRate)}</Text>
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
        </Fragment>
      ) : null
    ),

    topProcs: () => (
      procs.length > 0 ? (
        <Fragment>
          <DentalSectionHeader title="Top procedimentos" chip={currentMonthChip()} />
          <View style={z.glassCard}>
            {procs.map((p, idx) => (
              <View key={p.nome + idx} style={z.procRow}>
                <Text style={z.procRank}>#{idx + 1}</Text>
                <Text style={z.procName} numberOfLines={1}>{p.nome}</Text>
                <Text style={z.procQtd}>{p.qtd}x</Text>
                <Text style={z.procValue}>{fmt(p.receita)}</Text>
              </View>
            ))}
          </View>
        </Fragment>
      ) : null
    ),
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {!hideTitle && <Text style={z.title}>Dashboard Odonto</Text>}
      {sectionsOrder.map((key) => (
        <Fragment key={key}>{SECTIONS[key]()}</Fragment>
      ))}
      <View style={z.infoCard}>
        <Icon name="star" size={12} color={DentalColors.violet} />
        <Text style={z.infoText}>
          A IA Aura analisa estes mesmos dados pra sugerir acoes durante a consulta. Disponivel no plano Expansao.
        </Text>
      </View>
    </ScrollView>
  );
}

const glassWeb = Platform.OS === "web" ? {
  background: "rgba(255,255,255,0.04)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
} as any : {};

const z = StyleSheet.create({
  title:       { fontSize: 16, fontWeight: "700", color: DentalColors.ink, marginBottom: 6 },
  row:         { flexDirection: "row", flexWrap: "wrap", gap: 8 },

  glassCard:   { backgroundColor: DentalColors.bg2, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: DentalColors.border, ...glassWeb },

  funnelHeader:{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: DentalColors.border },
  funnelTotal: { fontSize: 18, fontWeight: "800", color: DentalColors.ink, letterSpacing: -0.3 },
  funnelSub:   { fontSize: 10, color: DentalColors.ink3, marginTop: 2 },
  funnelRow:   { flexDirection: "row", alignItems: "center", paddingVertical: 6, gap: 8 },
  funnelStage: { flex: 1, fontSize: 12, color: DentalColors.ink },
  funnelQtd:   { fontSize: 12, color: DentalColors.cyan, fontWeight: "700", minWidth: 30, textAlign: "right" },
  funnelValue: { fontSize: 11, color: DentalColors.ink3, fontWeight: "600", minWidth: 90, textAlign: "right" },

  procRow:     { flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 8 },
  procRank:    { fontSize: 11, color: DentalColors.ink3, fontWeight: "700", width: 22 },
  procName:    { flex: 1, fontSize: 12, color: DentalColors.ink, fontWeight: "500" },
  procQtd:     { fontSize: 11, color: DentalColors.cyan, fontWeight: "700", minWidth: 30, textAlign: "right" },
  procValue:   { fontSize: 12, color: DentalColors.green, fontWeight: "700", minWidth: 90, textAlign: "right" },

  empty:       { fontSize: 12, color: DentalColors.ink3, textAlign: "center", paddingVertical: 16 },

  infoCard:    { flexDirection: "row", gap: 8, backgroundColor: "rgba(124,58,237,0.06)", borderRadius: 10, padding: 12, marginTop: 22, borderWidth: 1, borderColor: "rgba(124,58,237,0.25)" },
  infoText:    { fontSize: 11, color: DentalColors.violet, flex: 1, lineHeight: 16 },

  errorBox:    { flexDirection: "row", gap: 10, alignItems: "center", backgroundColor: DentalColors.bg2, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: DentalColors.red },
  errorText:   { flex: 1, fontSize: 12, color: DentalColors.ink },
});

export default OdontoDashboard;
