import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Switch, Platform, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { request, adminApi, type VerticalKey } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import { ListSkeleton } from "@/components/ListSkeleton";
import { PLAN_C, MODULE_LABELS } from "./types";
import { MODULE_PLAN_MAP, PLAN_LEVEL } from "@/hooks/useVisibleModules";

var isWeb = Platform.OS === "web";

type Client360 = {
  id: string; trade_name: string; legal_name: string; plan: string;
  is_active: boolean; billing_status: string; billing_cycle: string;
  module_overrides: Record<string, boolean> | null; created_at: string;
  last_active_at: string | null; tax_regime: string; trial_ends_at: string | null;
  owner_email: string; owner_name: string;
  health_score: number | null; risk_level: string | null;
  activity_score: number; usage_score: number; payment_score: number; adoption_score: number;
  tx_count: number; prod_count: number; cust_count: number; total_revenue: number;
  vertical_active: VerticalKey | null;
  vertical_enabled_at: string | null;
  suggested_vertical: string | null;
};

type ActivityData = {
  usage: Record<string, number>; features_used: string[]; features_count: number;
  recent_transactions: any[]; member_since: string; plan: string; billing_status: string;
};

var fmt = function(n: number) { return "R$ " + n.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, "."); };
var fmtK = function(n: number) { return n >= 1000 ? "R$ " + (n/1000).toFixed(1).replace(".",",") + "k" : fmt(n); };

var HEALTH_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  healthy:   { bg: Colors.greenD, text: Colors.green, label: "Saudavel" },
  attention: { bg: Colors.amberD, text: Colors.amber, label: "Atencao" },
  at_risk:   { bg: Colors.redD,   text: Colors.red,   label: "Risco" },
  critical:  { bg: Colors.redD,   text: Colors.red,   label: "Critico" },
};

var BILLING_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: "Ativo", color: Colors.green },
  trial: { label: "Trial", color: Colors.amber },
  pending: { label: "Pendente", color: Colors.amber },
  overdue: { label: "Inadimplente", color: Colors.red },
  cancelled: { label: "Cancelado", color: Colors.red },
};

var FILTERS = [
  { key: "all", label: "Todos" },
  { key: "at_risk", label: "Em risco" },
  { key: "attention", label: "Atencao" },
  { key: "healthy", label: "Saudaveis" },
  { key: "trial", label: "Trial" },
];

// Labels + plano minimo. Expande MODULE_LABELS pra cobrir todos os modulos reais
// do MODULE_PLAN_MAP (alinhado com services/modules.js do backend).
var MODULE_CATALOG: Array<{ key: string; label: string; minPlan: string }> = [
  { key: "painel",        label: "Painel",          minPlan: "essencial" },
  { key: "financeiro",    label: "Financeiro",      minPlan: "essencial" },
  { key: "pdv",           label: "Caixa (PDV)",     minPlan: "essencial" },
  { key: "estoque",       label: "Estoque",         minPlan: "essencial" },
  { key: "nfe",           label: "NF-e",            minPlan: "essencial" },
  { key: "contabilidade", label: "Contabilidade",   minPlan: "essencial" },
  { key: "suporte",       label: "Seu Analista",    minPlan: "essencial" },
  { key: "configuracoes", label: "Configuracoes",   minPlan: "essencial" },
  { key: "clientes",      label: "Clientes",        minPlan: "negocio" },
  { key: "folha",         label: "Folha",           minPlan: "negocio" },
  { key: "agendamento",   label: "Agenda",          minPlan: "negocio" },
  { key: "canal",         label: "Canal Digital",   minPlan: "negocio" },
  { key: "whatsapp",      label: "WhatsApp",        minPlan: "negocio" },
  { key: "agentes",       label: "Agentes IA",      minPlan: "expansao" },
];

var PLAN_LABEL_MAP: Record<string, string> = { essencial: "Essencial", negocio: "Negocio+", expansao: "Expansao" };

// Catalogo de verticais — cor tematica, icone e se esta pronta ou em desenvolvimento.
// 'ready=false' mostra badge "em breve" e ainda permite ativacao (mostra tela de
// "modulo em desenvolvimento" pro cliente) pra sinalizar interesse.
type VerticalMeta = { key: VerticalKey; label: string; color: string; icon: string; ready: boolean };
var VERTICAL_META: VerticalMeta[] = [
  { key: "odonto",   label: "Odontologia",   color: "#06b6d4", icon: "\uD83E\uDE7A", ready: true  }, // cyan 🦷
  { key: "barber",   label: "Barber / Salao", color: Colors.amber, icon: "\u2702\uFE0F", ready: true  }, // amber ✂️
  { key: "food",     label: "Food Service",  color: "#fb7185", icon: "\uD83C\uDF7D\uFE0F", ready: true  }, // coral 🍽️
  { key: "estetica", label: "Estetica",      color: Colors.ink3, icon: "\u2728", ready: false }, // em dev ✨
  { key: "pet",      label: "Pet Shop",      color: Colors.ink3, icon: "\uD83D\uDC3E", ready: false }, // em dev 🐾
  { key: "academia", label: "Academia",      color: Colors.ink3, icon: "\uD83C\uDFCB\uFE0F", ready: false }, // em dev 🏋️
];

// Calcula visibilidade real de um modulo pra uma empresa,
// aplicando override acima do plano (mesma logica do backend).
function computeVisible(plan: string, overrides: Record<string, boolean> | null, modKey: string): { visible: boolean; reason: "admin_show" | "admin_hide" | "plan" | "plan_required" } {
  var ov = overrides?.[modKey];
  if (ov === true)  return { visible: true,  reason: "admin_show" };
  if (ov === false) return { visible: false, reason: "admin_hide" };
  var planLvl = PLAN_LEVEL[plan] ?? 0;
  var modMin  = MODULE_PLAN_MAP[modKey];
  var modLvl  = PLAN_LEVEL[modMin] ?? 0;
  if (planLvl >= modLvl) return { visible: true,  reason: "plan" };
  return { visible: false, reason: "plan_required" };
}

export function ClientsAdmin() {
  var { token, isStaff } = useAuthStore();
  var qc = useQueryClient();
  var [filter, setFilter] = useState("all");
  var [selectedId, setSelectedId] = useState<string | null>(null);

  var { data, isLoading } = useQuery<{ total: number; clients: Client360[] }>({
    queryKey: ["admin-clients-360"],
    queryFn: function() { return request("/admin/clients-360"); },
    enabled: !!token && isStaff,
    staleTime: 60_000,
  });

  var selectedClient = selectedId ? (data?.clients || []).find(function(c) { return c.id === selectedId; }) : null;

  var { data: activityData, isLoading: loadingActivity } = useQuery<ActivityData>({
    queryKey: ["admin-client-activity", selectedId],
    queryFn: function() { return request("/admin/clients/" + selectedId + "/activity"); },
    enabled: !!selectedId,
    staleTime: 120_000,
  });

  var toggleMutation = useMutation({
    mutationFn: function(p: { companyId: string; overrides: Record<string, boolean> }) { return adminApi.updateModules(p.companyId, p.overrides); },
    onSuccess: function() { qc.invalidateQueries({ queryKey: ["admin-clients-360"] }); toast.success("Modulos atualizados"); },
    onError: function() { toast.error("Erro ao atualizar"); },
  });

  var planMutation = useMutation({
    mutationFn: function(p: { companyId: string; plan: string }) { return adminApi.setPlan(p.companyId, p.plan); },
    onSuccess: function(result: any) {
      qc.invalidateQueries({ queryKey: ["admin-clients-360"] });
      toast.success("Plano alterado para " + (PLAN_LABEL_MAP[result.company?.plan] || result.company?.plan));
    },
    onError: function(err: any) { toast.error(err?.data?.error || "Erro ao alterar plano"); },
  });

  var verticalMutation = useMutation({
    mutationFn: function(p: { companyId: string; vertical: VerticalKey | null }) { return adminApi.setVertical(p.companyId, p.vertical); },
    onSuccess: function(result: any) {
      qc.invalidateQueries({ queryKey: ["admin-clients-360"] });
      var v = result.company?.vertical_active as VerticalKey | null;
      if (v) {
        var meta = VERTICAL_META.find(function(x) { return x.key === v; });
        toast.success("Vertical ativada: " + (meta?.label || v));
      } else {
        toast.success("Vertical desativada");
      }
    },
    onError: function(err: any) { toast.error(err?.data?.error || "Erro ao alterar vertical"); },
  });

  if (isLoading) return <ListSkeleton rows={4} showCards />;

  var clients = data?.clients || [];
  var filtered = clients.filter(function(c) {
    if (filter === "all") return true;
    if (filter === "trial") return c.billing_status === "trial";
    if (filter === "at_risk") return c.risk_level === "at_risk" || c.risk_level === "critical";
    return c.risk_level === filter;
  });

  function handleToggle(client: Client360, moduleKey: string, enabled: boolean) {
    // Determina se o valor desejado difere do default do plano.
    // Se for igual ao default, podemos remover o override (limpar).
    var planLvl = PLAN_LEVEL[client.plan] ?? 0;
    var modMin  = MODULE_PLAN_MAP[moduleKey];
    var modLvl  = PLAN_LEVEL[modMin] ?? 0;
    var planDefault = planLvl >= modLvl;

    var current = { ...(client.module_overrides || {}) } as Record<string, boolean>;
    if (enabled === planDefault) {
      // volta ao default do plano — limpar override
      delete current[moduleKey];
    } else {
      current[moduleKey] = enabled;
    }
    toggleMutation.mutate({ companyId: client.id, overrides: current });
  }

  function handleChangePlan(client: Client360, newPlan: string) {
    if (newPlan === client.plan) return;
    planMutation.mutate({ companyId: client.id, plan: newPlan });
  }

  // Clicar na vertical ja ativa = desativa (toggle).
  // Clicar em outra = troca pra essa.
  function handleChangeVertical(client: Client360, nextVertical: VerticalKey | null) {
    if (client.vertical_active === nextVertical) return;
    verticalMutation.mutate({ companyId: client.id, vertical: nextVertical });
  }

  // Slide-over do cliente selecionado
  if (selectedClient) {
    var sc = selectedClient;
    var hc = HEALTH_COLORS[sc.risk_level || "attention"] || HEALTH_COLORS.attention;
    var bc = BILLING_LABELS[sc.billing_status] || { label: sc.billing_status, color: Colors.ink3 };
    var pc = PLAN_C[sc.plan] || { color: Colors.ink3, label: sc.plan || "?" };
    var act = activityData;

    return (
      <View>
        <Pressable onPress={function() { setSelectedId(null); }} style={s.backBtn}>
          <Text style={s.backText}>{"<"} Voltar aos clientes</Text>
        </Pressable>

        {/* Header */}
        <View style={s.slideHeader}>
          <View style={s.slideAvatar}><Text style={s.slideAvatarText}>{(sc.trade_name || sc.legal_name || "?")[0].toUpperCase()}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.slideName}>{sc.trade_name || sc.legal_name}</Text>
            <Text style={s.slideEmail}>{sc.owner_email}</Text>
          </View>
          <View style={[s.healthBadgeLg, { backgroundColor: hc.bg }]}>
            <Text style={[s.healthScoreLg, { color: hc.text }]}>{sc.health_score || 0}</Text>
            <Text style={[s.healthLabelLg, { color: hc.text }]}>{hc.label}</Text>
          </View>
        </View>

        {/* Badges */}
        <View style={s.badgesRow}>
          <View style={[s.badge, { backgroundColor: pc.color + "18" }]}><Text style={[s.badgeText, { color: pc.color }]}>{pc.label}</Text></View>
          <View style={[s.badge, { backgroundColor: bc.color + "18" }]}><Text style={[s.badgeText, { color: bc.color }]}>{bc.label}</Text></View>
          <View style={[s.badge, { backgroundColor: Colors.bg4 }]}><Text style={[s.badgeText, { color: Colors.ink3 }]}>{sc.tax_regime === "mei" ? "MEI" : "Simples"}</Text></View>
          <View style={[s.badge, { backgroundColor: Colors.bg4 }]}><Text style={[s.badgeText, { color: Colors.ink3 }]}>Desde {sc.created_at ? new Date(sc.created_at).toLocaleDateString("pt-BR") : "?"}</Text></View>
        </View>

        {/* Seletor de plano */}
        <View style={s.section}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <Text style={s.sectionTitle}>Plano de acesso</Text>
            {planMutation.isPending && <ActivityIndicator size="small" color={Colors.violet3} />}
          </View>
          <View style={s.planSelector}>
            {["essencial", "negocio", "expansao"].map(function(planKey) {
              var active = sc.plan === planKey;
              var pcc = PLAN_C[planKey] || { color: Colors.ink3, label: planKey };
              return (
                <Pressable
                  key={planKey}
                  onPress={function() { handleChangePlan(sc, planKey); }}
                  disabled={active || planMutation.isPending}
                  style={[
                    s.planOption,
                    active && { borderColor: pcc.color, backgroundColor: pcc.color + "12" },
                  ]}
                >
                  <Text style={[s.planOptionLabel, active && { color: pcc.color }]}>{pcc.label}</Text>
                  {active && <Text style={[s.planOptionMeta, { color: pcc.color }]}>atual</Text>}
                </Pressable>
              );
            })}
          </View>
          <Text style={s.planHint}>
            Alterar plano aqui ajusta apenas os modulos visiveis.
            Nao altera a cobranca no Asaas — faca isso separadamente se necessario.
          </Text>
        </View>

        {/* Seletor de modulo vertical */}
        <View style={s.section}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <Text style={s.sectionTitle}>Modulo vertical</Text>
            {verticalMutation.isPending && <ActivityIndicator size="small" color={Colors.violet3} />}
          </View>
          <View style={s.verticalGrid}>
            {/* Card "Nenhuma" — desativa a vertical */}
            <Pressable
              onPress={function() { handleChangeVertical(sc, null); }}
              disabled={!sc.vertical_active || verticalMutation.isPending}
              style={[
                s.verticalOption,
                !sc.vertical_active && { borderColor: Colors.ink3, backgroundColor: Colors.bg4 },
              ]}
            >
              <Text style={s.verticalIcon}>\u2014</Text>
              <Text style={[s.verticalLabel, !sc.vertical_active && { color: Colors.ink }]}>Nenhuma</Text>
              {!sc.vertical_active && <Text style={[s.verticalMeta, { color: Colors.ink3 }]}>atual</Text>}
            </Pressable>

            {/* 6 verticais */}
            {VERTICAL_META.map(function(v) {
              var active = sc.vertical_active === v.key;
              return (
                <Pressable
                  key={v.key}
                  onPress={function() { handleChangeVertical(sc, v.key); }}
                  disabled={active || verticalMutation.isPending}
                  style={[
                    s.verticalOption,
                    active && { borderColor: v.color, backgroundColor: v.color + "14" },
                  ]}
                >
                  <Text style={s.verticalIcon}>{v.icon}</Text>
                  <Text style={[s.verticalLabel, active && { color: v.color }]}>{v.label}</Text>
                  {active && <Text style={[s.verticalMeta, { color: v.color }]}>ativo</Text>}
                  {!active && !v.ready && (
                    <View style={s.soonBadge}><Text style={s.soonText}>em breve</Text></View>
                  )}
                </Pressable>
              );
            })}
          </View>
          <Text style={s.verticalHint}>
            Ativa uma tab dedicada no app do cliente com funcionalidades do segmento.
            {sc.suggested_vertical ? " Sugestao baseada no CNAE: " + sc.suggested_vertical + "." : ""}
            {" "}Sem custo extra no alpha — R$69/mes no pricing oficial.
          </Text>
        </View>

        {/* Health Breakdown */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Health score</Text>
          <View style={s.healthGrid}>
            {[{ label: "Atividade", score: sc.activity_score, max: 25, icon: "clock" },
              { label: "Volume uso", score: sc.usage_score, max: 25, icon: "bar_chart" },
              { label: "Pagamento", score: sc.payment_score, max: 25, icon: "dollar" },
              { label: "Adocao", score: sc.adoption_score, max: 25, icon: "star" },
            ].map(function(dim) {
              var pct = Math.round((dim.score / dim.max) * 100);
              var color = pct >= 80 ? Colors.green : pct >= 40 ? Colors.amber : Colors.red;
              return (
                <View key={dim.label} style={s.healthDim}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={s.healthDimLabel}>{dim.label}</Text>
                    <Text style={[s.healthDimScore, { color: color }]}>{dim.score}/{dim.max}</Text>
                  </View>
                  <View style={s.healthBar}>
                    <View style={[s.healthBarFill, { width: pct + "%", backgroundColor: color }, isWeb && { transition: "width 0.4s" } as any]} />
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Metricas de uso */}
        {loadingActivity ? <ActivityIndicator color={Colors.violet3} style={{ padding: 20 }} /> : act && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Uso da plataforma</Text>
            <View style={s.usageGrid}>
              <View style={s.usageStat}><Text style={s.usageVal}>{act.usage.total_transactions}</Text><Text style={s.usageLabel}>Lancamentos</Text></View>
              <View style={s.usageStat}><Text style={s.usageVal}>{act.usage.tx_30d}</Text><Text style={s.usageLabel}>Ultimos 30d</Text></View>
              <View style={s.usageStat}><Text style={s.usageVal}>{act.usage.total_sales}</Text><Text style={s.usageLabel}>Vendas PDV</Text></View>
              <View style={s.usageStat}><Text style={[s.usageVal, { color: Colors.green }]}>{fmtK(act.usage.total_revenue)}</Text><Text style={s.usageLabel}>Receita total</Text></View>
            </View>
            <View style={s.usageGrid}>
              <View style={s.usageStat}><Text style={s.usageVal}>{act.usage.total_products}</Text><Text style={s.usageLabel}>Produtos</Text></View>
              <View style={s.usageStat}><Text style={s.usageVal}>{act.usage.total_customers}</Text><Text style={s.usageLabel}>Clientes</Text></View>
              <View style={s.usageStat}><Text style={s.usageVal}>{act.usage.active_employees}</Text><Text style={s.usageLabel}>Empregados</Text></View>
              <View style={s.usageStat}><Text style={s.usageVal}>{act.features_count}</Text><Text style={s.usageLabel}>Features usadas</Text></View>
            </View>
            {act.features_used.length > 0 && (
              <View style={s.featuresRow}>
                {act.features_used.map(function(f) {
                  return <View key={f} style={s.featureBadge}><Text style={s.featureText}>{f}</Text></View>;
                })}
              </View>
            )}
          </View>
        )}

        {/* Ultimas transacoes */}
        {act && act.recent_transactions.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Ultimas transacoes</Text>
            {act.recent_transactions.map(function(tx: any) {
              var isIncome = tx.type === "income";
              return (
                <View key={tx.id} style={s.txRow}>
                  <View style={[s.txDot, { backgroundColor: isIncome ? Colors.green : Colors.red }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.txDesc} numberOfLines={1}>{tx.description || tx.category || "Lancamento"}</Text>
                    <Text style={s.txMeta}>{new Date(tx.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</Text>
                  </View>
                  <Text style={[s.txAmount, { color: isIncome ? Colors.green : Colors.red }]}>{isIncome ? "+" : "-"}{fmt(tx.amount)}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Modulos — com logica REAL de visibilidade (override > plano) */}
        <View style={s.section}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <Text style={s.sectionTitle}>Modulos</Text>
            {toggleMutation.isPending && <ActivityIndicator size="small" color={Colors.violet3} />}
          </View>
          <Text style={s.modulesHint}>
            Por padrao, seguem o plano do cliente. Toggle manual cria um override
            (o modulo fica destacado como "forcado ativo" ou "forcado inativo").
          </Text>
          {MODULE_CATALOG.map(function(mod) {
            var r = computeVisible(sc.plan, sc.module_overrides, mod.key);
            var overridden = r.reason === "admin_show" || r.reason === "admin_hide";
            var planLabel = PLAN_LABEL_MAP[mod.minPlan] || mod.minPlan;
            var reasonText =
              r.reason === "admin_show"     ? "forcado ativo" :
              r.reason === "admin_hide"     ? "forcado inativo" :
              r.reason === "plan_required"  ? "requer " + planLabel :
              "plano " + planLabel;
            var reasonColor =
              r.reason === "admin_show"     ? Colors.violet3 :
              r.reason === "admin_hide"     ? Colors.red :
              r.reason === "plan_required"  ? Colors.amber :
              Colors.ink3;

            return (
              <View key={mod.key} style={[s.toggleRow, overridden && s.toggleRowOverride]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.toggleLabel}>{mod.label}</Text>
                  <Text style={[s.toggleReason, { color: reasonColor }]}>{reasonText}</Text>
                </View>
                <Switch
                  value={r.visible}
                  trackColor={{ false: Colors.bg4, true: Colors.violet + "66" }}
                  thumbColor={r.visible ? Colors.violet : Colors.ink3}
                  onValueChange={function(val) { handleToggle(sc, mod.key, val); }}
                  disabled={toggleMutation.isPending}
                />
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  // Lista de clientes
  return (
    <View>
      {/* Filtros */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 16 }} contentContainerStyle={{ flexDirection: "row", gap: 6 }}>
        {FILTERS.map(function(f) {
          var count = f.key === "all" ? clients.length
            : f.key === "trial" ? clients.filter(function(c) { return c.billing_status === "trial"; }).length
            : f.key === "at_risk" ? clients.filter(function(c) { return c.risk_level === "at_risk" || c.risk_level === "critical"; }).length
            : clients.filter(function(c) { return c.risk_level === f.key; }).length;
          return (
            <Pressable key={f.key} onPress={function() { setFilter(f.key); }} style={[s.chip, filter === f.key && s.chipActive]}>
              <Text style={[s.chipText, filter === f.key && s.chipTextActive]}>{f.label} ({count})</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Tabela */}
      {filtered.length === 0 && <Text style={{ fontSize: 13, color: Colors.ink3, textAlign: "center", padding: 40 }}>Nenhum cliente encontrado</Text>}

      {filtered.map(function(client) {
        var pc = PLAN_C[client.plan] || { color: Colors.ink3, label: client.plan || "?" };
        var hc = HEALTH_COLORS[client.risk_level || "attention"] || HEALTH_COLORS.attention;
        var bc = BILLING_LABELS[client.billing_status] || { label: "?", color: Colors.ink3 };
        var displayName = client.trade_name || client.legal_name || "Sem nome";
        var vMeta = client.vertical_active ? VERTICAL_META.find(function(x) { return x.key === client.vertical_active; }) : null;
        return (
          <Pressable key={client.id} onPress={function() { setSelectedId(client.id); }} style={[s.clientRow, isWeb && { cursor: "pointer", transition: "background-color 0.15s" } as any]}>
            <View style={[s.healthDot, { backgroundColor: hc.bg }]}>
              <Text style={[s.healthDotText, { color: hc.text }]}>{client.health_score || "?"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.clientName} numberOfLines={1}>{displayName}</Text>
              <Text style={s.clientMeta}>{client.owner_email} \u00b7 {client.tx_count} tx \u00b7 {fmtK(client.total_revenue)}</Text>
            </View>
            <View style={[s.badge, { backgroundColor: pc.color + "18" }]}><Text style={[s.badgeText, { color: pc.color }]}>{pc.label}</Text></View>
            {vMeta && <View style={[s.badge, { backgroundColor: vMeta.color + "18" }]}><Text style={[s.badgeText, { color: vMeta.color }]}>{vMeta.icon}</Text></View>}
            <View style={[s.badge, { backgroundColor: bc.color + "18" }]}><Text style={[s.badgeText, { color: bc.color }]}>{bc.label}</Text></View>
            <Icon name="chevron_right" size={14} color={Colors.ink3} />
          </Pressable>
        );
      })}
    </View>
  );
}

var s = StyleSheet.create({
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  chipText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  chipTextActive: { color: Colors.violet3, fontWeight: "600" },
  clientRow: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.bg3, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 6, gap: 10 },
  healthDot: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  healthDotText: { fontSize: 13, fontWeight: "800" },
  clientName: { fontSize: 14, fontWeight: "600", color: Colors.ink },
  clientMeta: { fontSize: 10, color: Colors.ink3, marginTop: 1 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: "600" },
  // Slide-over
  backBtn: { marginBottom: 16 },
  backText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  slideHeader: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16 },
  slideAvatar: { width: 52, height: 52, borderRadius: 16, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center" },
  slideAvatarText: { fontSize: 22, fontWeight: "800", color: Colors.violet3 },
  slideName: { fontSize: 20, fontWeight: "800", color: Colors.ink },
  slideEmail: { fontSize: 12, color: Colors.ink3, marginTop: 2 },
  healthBadgeLg: { alignItems: "center", borderRadius: 12, padding: 12, minWidth: 70 },
  healthScoreLg: { fontSize: 24, fontWeight: "800" },
  healthLabelLg: { fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.3 },
  badgesRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 20 },
  section: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: Colors.ink, marginBottom: 12 },
  healthGrid: { gap: 10 },
  healthDim: { gap: 4 },
  healthDimLabel: { fontSize: 11, color: Colors.ink3, fontWeight: "500" },
  healthDimScore: { fontSize: 12, fontWeight: "700" },
  healthBar: { height: 6, backgroundColor: Colors.bg4, borderRadius: 3, overflow: "hidden" },
  healthBarFill: { height: 6, borderRadius: 3 },
  usageGrid: { flexDirection: "row", gap: 8, marginBottom: 10 },
  usageStat: { flex: 1, backgroundColor: Colors.bg4, borderRadius: 10, padding: 10, alignItems: "center" },
  usageVal: { fontSize: 15, fontWeight: "800", color: Colors.ink },
  usageLabel: { fontSize: 8, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.3, marginTop: 2, textAlign: "center" },
  featuresRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  featureBadge: { backgroundColor: Colors.violetD, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: Colors.border2 },
  featureText: { fontSize: 10, color: Colors.violet3, fontWeight: "600" },
  txRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  txDot: { width: 8, height: 8, borderRadius: 4 },
  txDesc: { fontSize: 12, color: Colors.ink, fontWeight: "500" },
  txMeta: { fontSize: 10, color: Colors.ink3 },
  txAmount: { fontSize: 12, fontWeight: "700" },
  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8 },
  toggleRowOverride: { backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border2 },
  toggleLabel: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  toggleReason: { fontSize: 10, marginTop: 2, textTransform: "lowercase" },
  modulesHint: { fontSize: 10, color: Colors.ink3, marginBottom: 12, lineHeight: 14 },
  // Plan selector
  planSelector: { flexDirection: "row", gap: 8 },
  planOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.bg4,
    alignItems: "center",
    gap: 4,
  },
  planOptionLabel: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  planOptionMeta: { fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  planHint: { fontSize: 10, color: Colors.ink3, marginTop: 10, lineHeight: 14 },
  // Vertical selector — grid 3 col desktop / 2 col mobile
  verticalGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  verticalOption: {
    width: isWeb ? "31%" : "48%",
    minHeight: 82,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.bg4,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    position: "relative",
  },
  verticalIcon: { fontSize: 22 },
  verticalLabel: { fontSize: 11, fontWeight: "700", color: Colors.ink3, textAlign: "center" },
  verticalMeta: { fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  soonBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: Colors.amber + "22",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  soonText: { fontSize: 8, color: Colors.amber, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.3 },
  verticalHint: { fontSize: 10, color: Colors.ink3, marginTop: 10, lineHeight: 14 },
});

export default ClientsAdmin;
