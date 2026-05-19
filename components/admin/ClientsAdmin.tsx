import { useState, useEffect } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Switch, Platform, ActivityIndicator, TextInput } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { request, adminApi, type VerticalKey } from "@/services/api";
import type { AdminNote } from "@/services/adminApi";
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
  // 19/05/2026: sub-segmentacao manual via Gestao Aura (Fase B1 do benchmark).
  sub_vertical: string | null;
  // 12/05/2026: acessos extras pagos manualmente (vem do backend)
  extra_seats_granted?: number;
};

type ActivityData = {
  usage: Record<string, number>; features_used: string[]; features_count: number;
  recent_transactions: any[]; member_since: string; plan: string; billing_status: string;
};

var fmt = function(n: number) { return "R$ " + n.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, "."); };
var fmtK = function(n: number) { return n >= 1000 ? "R$ " + (n/1000).toFixed(1).replace(".",",") + "k" : fmt(n); };

// Formata "em X dias" / "ha X dias" baseado em delta entre data e hoje.
function relativeDays(iso: string | null): { label: string; expired: boolean } {
  if (!iso) return { label: "sem data", expired: false };
  var target = new Date(iso).getTime();
  var now = Date.now();
  var deltaDays = Math.ceil((target - now) / 86400000);
  if (deltaDays > 0) return { label: "em " + deltaDays + (deltaDays === 1 ? " dia" : " dias"), expired: false };
  if (deltaDays === 0) return { label: "hoje", expired: false };
  return { label: "ha " + Math.abs(deltaDays) + (Math.abs(deltaDays) === 1 ? " dia" : " dias"), expired: true };
}

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

// 12/05/2026: seats inclusos por plano (espelho do src/services/memberSeats.js no backend).
// Hardcoded aqui pra UI calcular "X de Y seats" sem precisar fetch extra. Se mudar no backend,
// atualizar aqui — divergencia gera display incorreto mas nao falha funcional (backend e a
// fonte da verdade).
var SEATS_PER_PLAN: Record<string, number> = { essencial: 1, negocio: 3, expansao: 5, personalizado: 999 };
var SEAT_PRICE_BRL = 19;

function seatsIncludedFor(plan: string, extra: number): number {
  var base = SEATS_PER_PLAN[(plan || "").toLowerCase()] ?? 1;
  return base + Math.max(0, extra || 0);
}

// Catalogo de verticais — cor tematica, icone e se esta pronta ou em desenvolvimento.
// 'ready=false' mostra badge "em breve" e ainda permite ativacao (mostra tela de
// "modulo em desenvolvimento" pro cliente) pra sinalizar interesse.
type VerticalMeta = { key: VerticalKey; label: string; color: string; icon: string; ready: boolean };
var VERTICAL_META: VerticalMeta[] = [
  { key: "odonto",   label: "Odontologia",   color: "#06b6d4", icon: "🩺", ready: true  }, // cyan 🦷
  { key: "barber",   label: "Barber / Salao", color: Colors.amber, icon: "✂️", ready: true  }, // amber ✂️
  { key: "food",     label: "Food Service",  color: "#fb7185", icon: "🍽️", ready: true  }, // coral 🍽️
  { key: "estetica", label: "Estetica",      color: Colors.ink3, icon: "✨", ready: false }, // em dev ✨
  { key: "pet",      label: "Pet Shop",      color: Colors.ink3, icon: "🐾", ready: false }, // em dev 🐾
  { key: "academia", label: "Academia",      color: Colors.ink3, icon: "🏋️", ready: false }, // em dev 🏋️
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
  // company aqui eh a empresa do proprio usuario logado (staff).
  // Usamos isso pra sincronizar o store local quando o admin altera
  // plano/vertical/modulos da propria empresa (senao o app NAO reflete
  // ate o proximo logout/login, porque /me so eh chamado no hydrate).
  var { token, isStaff, company: ownCompany } = useAuthStore();
  var qc = useQueryClient();
  var [filter, setFilter] = useState("all");
  var [selectedId, setSelectedId] = useState<string | null>(null);

  // 12/05/2026: estados das novas secoes (notas + estender trial + extra seats)
  var [noteDraft, setNoteDraft] = useState("");
  var [trialDaysStr, setTrialDaysStr] = useState("7");
  var [trialReason, setTrialReason] = useState("");
  var [extraSeatsStr, setExtraSeatsStr] = useState("0");
  var [extraSeatsReason, setExtraSeatsReason] = useState("");

  var { data, isLoading } = useQuery<{ total: number; clients: Client360[] }>({
    queryKey: ["admin-clients-360"],
    queryFn: function() { return request("/admin/clients-360"); },
    enabled: !!token && isStaff,
    staleTime: 60_000,
  });

  var selectedClient = selectedId ? (data?.clients || []).find(function(c) { return c.id === selectedId; }) : null;

  // 12/05/2026: sincroniza input de extra seats com o valor atual do cliente
  // quando seleciona novo cliente ou quando o backend invalida a query.
  useEffect(function() {
    if (selectedClient) {
      setExtraSeatsStr(String(selectedClient.extra_seats_granted ?? 0));
      setExtraSeatsReason("");
    }
  }, [selectedClient?.id, selectedClient?.extra_seats_granted]);

  var { data: activityData, isLoading: loadingActivity } = useQuery<ActivityData>({
    queryKey: ["admin-client-activity", selectedId],
    queryFn: function() { return request("/admin/clients/" + selectedId + "/activity"); },
    enabled: !!selectedId,
    staleTime: 120_000,
  });

  // 12/05/2026: notas internas do cliente selecionado
  var { data: notesData, isLoading: loadingNotes } = useQuery<{ notes: AdminNote[] }>({
    queryKey: ["admin-client-notes", selectedId],
    queryFn: function() { return adminApi.notes.list(selectedId!); },
    enabled: !!selectedId,
    staleTime: 30_000,
  });

  var toggleMutation = useMutation({
    mutationFn: function(p: { companyId: string; overrides: Record<string, boolean> }) { return adminApi.updateModules(p.companyId, p.overrides); },
    onSuccess: function(_data: any, variables: { companyId: string; overrides: Record<string, boolean> }) {
      qc.invalidateQueries({ queryKey: ["admin-clients-360"] });
      // Se o admin mexeu na propria empresa, atualiza store local pra
      // refletir na UI imediatamente (sidebar, gates de modulos, etc).
      if (ownCompany?.id === variables.companyId) {
        useAuthStore.getState().updateCompany({ module_overrides: variables.overrides });
      }
      toast.success("Modulos atualizados");
    },
    onError: function() { toast.error("Erro ao atualizar"); },
  });

  var planMutation = useMutation({
    mutationFn: function(p: { companyId: string; plan: string }) { return adminApi.setPlan(p.companyId, p.plan); },
    onSuccess: function(result: any) {
      qc.invalidateQueries({ queryKey: ["admin-clients-360"] });
      if (ownCompany?.id === result.company?.id) {
        useAuthStore.getState().updateCompany({ plan: result.company.plan });
      }
      toast.success("Plano alterado para " + (PLAN_LABEL_MAP[result.company?.plan] || result.company?.plan));
    },
    onError: function(err: any) { toast.error(err?.data?.error || "Erro ao alterar plano"); },
  });

  var verticalMutation = useMutation({
    mutationFn: function(p: { companyId: string; vertical: VerticalKey | null }) { return adminApi.setVertical(p.companyId, p.vertical); },
    onSuccess: function(result: any) {
      qc.invalidateQueries({ queryKey: ["admin-clients-360"] });
      // Se o admin ativou/desativou a vertical da propria empresa,
      // propaga pro store local pra tab Vertical renderizar a tela nova
      // sem precisar logout/login.
      if (ownCompany?.id === result.company?.id) {
        useAuthStore.getState().updateCompany({ vertical_active: result.company.vertical_active });
      }
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

  // 19/05/2026 — Fase B1 benchmark: sub-vertical manual.
  var subVerticalMutation = useMutation({
    mutationFn: function(p: { companyId: string; subVertical: string | null }) { return adminApi.setSubVertical(p.companyId, p.subVertical); },
    onSuccess: function(result: any) {
      qc.invalidateQueries({ queryKey: ["admin-clients-360"] });
      toast.success(result.message || "Sub-vertical atualizada");
    },
    onError: function(err: any) { toast.error(err?.data?.error || "Erro ao alterar sub-vertical"); },
  });

  // Carrega opcoes de sub-vertical do backend (1x — cached na sessao)
  var subVerticalOptionsQuery = useQuery({
    queryKey: ["admin-sub-verticals-options"],
    queryFn: function() { return adminApi.subVerticalOptions(); },
    staleTime: 5 * 60 * 1000, // 5min
  });

  // 12/05/2026: notas + estender trial + extra seats mutations
  var notesMutation = useMutation({
    mutationFn: function(p: { companyId: string; body: string }) { return adminApi.notes.create(p.companyId, p.body); },
    onSuccess: function() {
      qc.invalidateQueries({ queryKey: ["admin-client-notes", selectedId] });
      setNoteDraft("");
      toast.success("Nota adicionada");
    },
    onError: function(err: any) { toast.error(err?.data?.error || "Erro ao adicionar nota"); },
  });

  var trialMutation = useMutation({
    mutationFn: function(p: { companyId: string; days: number; reason?: string }) {
      return adminApi.extendTrial(p.companyId, p.days, p.reason);
    },
    onSuccess: function() {
      qc.invalidateQueries({ queryKey: ["admin-clients-360"] });
      setTrialReason("");
      toast.success("Trial estendido com sucesso");
    },
    onError: function(err: any) { toast.error(err?.data?.error || "Erro ao estender trial"); },
  });

  var extraSeatsMutation = useMutation({
    mutationFn: function(p: { companyId: string; count: number; reason?: string }) {
      return adminApi.setExtraSeats(p.companyId, p.count, p.reason);
    },
    onSuccess: function(result: any) {
      qc.invalidateQueries({ queryKey: ["admin-clients-360"] });
      setExtraSeatsReason("");
      if (result?.changed === false) {
        toast.info("Sem alteracao — count ja estava em " + result.extra_seats_granted);
      } else {
        toast.success("Acessos extras: " + result.extra_seats_granted);
      }
    },
    onError: function(err: any) { toast.error(err?.data?.error || "Erro ao atualizar acessos"); },
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

  // 19/05/2026: troca sub-vertical via dropdown. null = limpar.
  function handleChangeSubVertical(client: Client360, nextSubVertical: string | null) {
    if (client.sub_vertical === nextSubVertical) return;
    subVerticalMutation.mutate({ companyId: client.id, subVertical: nextSubVertical });
  }

  // 12/05/2026: handlers das novas secoes
  function handleAddNote() {
    if (!selectedClient) return;
    var trimmed = noteDraft.trim();
    if (!trimmed) { toast.info("Digite uma nota antes de adicionar"); return; }
    notesMutation.mutate({ companyId: selectedClient.id, body: trimmed });
  }

  function handleExtendTrial() {
    if (!selectedClient) return;
    var n = parseInt(trialDaysStr, 10);
    if (!isFinite(n) || n <= 0 || n > 365) {
      toast.error("Informe entre 1 e 365 dias");
      return;
    }
    trialMutation.mutate({
      companyId: selectedClient.id,
      days: n,
      reason: trialReason.trim() || undefined,
    });
  }

  function handleSaveExtraSeats() {
    if (!selectedClient) return;
    var n = parseInt(extraSeatsStr, 10);
    if (!isFinite(n) || n < 0 || n > 100) {
      toast.error("Informe entre 0 e 100 acessos");
      return;
    }
    extraSeatsMutation.mutate({
      companyId: selectedClient.id,
      count: n,
      reason: extraSeatsReason.trim() || undefined,
    });
  }

  // Slide-over do cliente selecionado
  if (selectedClient) {
    var sc = selectedClient;
    var hc = HEALTH_COLORS[sc.risk_level || "attention"] || HEALTH_COLORS.attention;
    var bc = BILLING_LABELS[sc.billing_status] || { label: sc.billing_status, color: Colors.ink3 };
    var pc = PLAN_C[sc.plan] || { color: Colors.ink3, label: sc.plan || "?" };
    var act = activityData;
    // 12/05/2026: deriva info do trial pra secao Estender Trial
    var trialRel = relativeDays(sc.trial_ends_at);
    var showTrialSection = sc.billing_status === "trial" || !!sc.trial_ends_at;
    var notes = notesData?.notes || [];
    // 12/05/2026: derivacoes pra secao Acessos extras
    var currentExtraSeats = sc.extra_seats_granted ?? 0;
    var basePlanSeats = SEATS_PER_PLAN[(sc.plan || "").toLowerCase()] ?? 1;
    var totalSeats = seatsIncludedFor(sc.plan, currentExtraSeats);
    var pendingExtraSeats = parseInt(extraSeatsStr, 10);
    var pendingValid = isFinite(pendingExtraSeats) && pendingExtraSeats >= 0 && pendingExtraSeats <= 100;
    var pendingChanged = pendingValid && pendingExtraSeats !== currentExtraSeats;

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
          {currentExtraSeats > 0 && (
            <View style={[s.badge, { backgroundColor: Colors.violet + "20" }]}>
              <Text style={[s.badgeText, { color: Colors.violet3 }]}>+{currentExtraSeats} {currentExtraSeats === 1 ? "acesso extra" : "acessos extras"}</Text>
            </View>
          )}
        </View>

        {/* 12/05/2026: Estender Trial — visivel quando billing_status=trial ou trial_ends_at set */}
        {showTrialSection && (
          <View style={s.section}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <Text style={s.sectionTitle}>Estender trial</Text>
              {trialMutation.isPending && <ActivityIndicator size="small" color={Colors.violet3} />}
            </View>
            <View style={s.trialStatusRow}>
              <Text style={s.trialStatusLabel}>Trial atual</Text>
              <Text style={[s.trialStatusValue, trialRel.expired && { color: Colors.red }]}>
                {sc.trial_ends_at
                  ? new Date(sc.trial_ends_at).toLocaleDateString("pt-BR") + " (" + trialRel.label + ")"
                  : "sem trial ativo"}
              </Text>
            </View>
            <View style={s.trialFormRow}>
              <View style={{ width: 90 }}>
                <Text style={s.fieldLabel}>Dias</Text>
                <TextInput
                  value={trialDaysStr}
                  onChangeText={setTrialDaysStr}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  placeholder="7"
                  placeholderTextColor={Colors.ink3}
                  style={s.trialDaysInput}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Motivo (opcional)</Text>
                <TextInput
                  value={trialReason}
                  onChangeText={setTrialReason}
                  placeholder="ex: cliente pediu prazo extra"
                  placeholderTextColor={Colors.ink3}
                  style={s.trialReasonInput}
                />
              </View>
            </View>
            <Pressable
              onPress={handleExtendTrial}
              disabled={trialMutation.isPending}
              style={[s.trialBtn, trialMutation.isPending && { opacity: 0.5 }]}
            >
              <Text style={s.trialBtnText}>Estender trial</Text>
            </Pressable>
            <Text style={s.trialHint}>
              Se o trial ja vencer, conta a partir de hoje. Se ativo, soma ao final atual.
              Acao registrada em admin_audit_log com seu user + motivo.
            </Text>
          </View>
        )}

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

        {/* 12/05/2026: Acessos extras — caso Alynne/Encanto Presentes */}
        <View style={s.section}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <Text style={s.sectionTitle}>Acessos extras (equipe)</Text>
            {extraSeatsMutation.isPending && <ActivityIndicator size="small" color={Colors.violet3} />}
          </View>
          <View style={s.seatsSummaryGrid}>
            <View style={s.seatsBox}>
              <Text style={s.seatsBoxLabel}>No plano</Text>
              <Text style={s.seatsBoxValue}>{basePlanSeats}</Text>
              <Text style={s.seatsBoxSub}>{PLAN_LABEL_MAP[(sc.plan || "").toLowerCase()] || sc.plan}</Text>
            </View>
            <View style={s.seatsBox}>
              <Text style={s.seatsBoxLabel}>Extras pagos</Text>
              <Text style={[s.seatsBoxValue, currentExtraSeats > 0 && { color: Colors.violet3 }]}>+{currentExtraSeats}</Text>
              <Text style={s.seatsBoxSub}>R$ {currentExtraSeats * SEAT_PRICE_BRL}/mes</Text>
            </View>
            <View style={s.seatsBox}>
              <Text style={s.seatsBoxLabel}>Total</Text>
              <Text style={[s.seatsBoxValue, { color: Colors.green }]}>{totalSeats}</Text>
              <Text style={s.seatsBoxSub}>{totalSeats === 1 ? "acesso" : "acessos"}</Text>
            </View>
          </View>
          <View style={s.trialFormRow}>
            <View style={{ width: 110 }}>
              <Text style={s.fieldLabel}>Extras (total)</Text>
              <TextInput
                value={extraSeatsStr}
                onChangeText={setExtraSeatsStr}
                keyboardType="number-pad"
                inputMode="numeric"
                placeholder="0"
                placeholderTextColor={Colors.ink3}
                style={s.trialDaysInput}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>Motivo (opcional)</Text>
              <TextInput
                value={extraSeatsReason}
                onChangeText={setExtraSeatsReason}
                placeholder="ex: cliente pagou 1 acesso extra em 12/05"
                placeholderTextColor={Colors.ink3}
                style={s.trialReasonInput}
              />
            </View>
          </View>
          <Pressable
            onPress={handleSaveExtraSeats}
            disabled={extraSeatsMutation.isPending || !pendingValid || !pendingChanged}
            style={[
              s.trialBtn,
              (extraSeatsMutation.isPending || !pendingValid || !pendingChanged) && { opacity: 0.5 },
            ]}
          >
            <Text style={s.trialBtnText}>
              {pendingChanged && pendingValid
                ? "Salvar (" + pendingExtraSeats + " extras = " + seatsIncludedFor(sc.plan, pendingExtraSeats) + " total)"
                : "Salvar acessos extras"}
            </Text>
          </Pressable>
          <Text style={s.trialHint}>
            Define o numero ABSOLUTO de seats extras (R$ {SEAT_PRICE_BRL}/mes cada) acima do plano. Soma com
            os inclusos pra expandir o limite de equipe. O cliente nao paga automaticamente — marque
            apenas quando o pagamento for confirmado. Acao registrada em admin_audit_log.
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
              <Text style={s.verticalIcon}>—</Text>
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

        {/* 19/05/2026 — Sub-vertical (Fase B1 benchmark de mercado) */}
        <View style={s.section}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={s.sectionTitle}>Sub-vertical</Text>
            {subVerticalMutation.isPending && <ActivityIndicator size="small" color={Colors.violet3} />}
          </View>
          <Text style={s.verticalHint}>
            Subsegmentacao usada pelo benchmark de mercado pra agrupar clientes
            similares (ex: varejo de calcados vs varejo de moda).
          </Text>
          {(function() {
            var options = subVerticalOptionsQuery.data?.by_vertical || {};
            var key: string = sc.vertical_active ? sc.vertical_active : "null";
            var list: string[] = options[key] || [];
            if (list.length === 0) {
              // Vertical sem whitelist — usa input livre
              return (
                <View style={{ flexDirection: "row", gap: 8, marginTop: 10, alignItems: "center" }}>
                  <Text style={[s.verticalHint, { color: Colors.ink }]}>Atual:</Text>
                  <Text style={[s.verticalHint, { color: sc.sub_vertical ? Colors.violet3 : Colors.ink3, fontWeight: "600" }]}>
                    {sc.sub_vertical || "nenhuma"}
                  </Text>
                  <Text style={[s.verticalHint, { fontStyle: "italic" }]}>
                    (sem whitelist pra esta vertical — peca pro time setar via DB se precisar)
                  </Text>
                </View>
              );
            }
            return (
              <View style={s.verticalGrid}>
                <Pressable
                  onPress={function() { handleChangeSubVertical(sc, null); }}
                  disabled={!sc.sub_vertical || subVerticalMutation.isPending}
                  style={[s.verticalOption, !sc.sub_vertical && { borderColor: Colors.ink3, backgroundColor: Colors.bg4 }]}
                >
                  <Text style={s.verticalIcon}>—</Text>
                  <Text style={[s.verticalLabel, !sc.sub_vertical && { color: Colors.ink }]}>Nenhuma</Text>
                  {!sc.sub_vertical && <Text style={[s.verticalMeta, { color: Colors.ink3 }]}>atual</Text>}
                </Pressable>
                {list.map(function(sv: string) {
                  var active = sc.sub_vertical === sv;
                  return (
                    <Pressable
                      key={sv}
                      onPress={function() { handleChangeSubVertical(sc, sv); }}
                      disabled={active || subVerticalMutation.isPending}
                      style={[s.verticalOption, active && { borderColor: Colors.violet, backgroundColor: Colors.violetD }]}
                    >
                      <Text style={s.verticalIcon}>•</Text>
                      <Text style={[s.verticalLabel, active && { color: Colors.violet3 }]}>{sv}</Text>
                      {active && <Text style={[s.verticalMeta, { color: Colors.violet3 }]}>ativo</Text>}
                    </Pressable>
                  );
                })}
              </View>
            );
          })()}
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

        {/* 12/05/2026: Notas internas (CRM basico) */}
        <View style={s.section}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <Text style={s.sectionTitle}>Notas internas</Text>
            {notesMutation.isPending && <ActivityIndicator size="small" color={Colors.violet3} />}
          </View>
          <TextInput
            value={noteDraft}
            onChangeText={setNoteDraft}
            placeholder="ex: cliente ligou pedindo treinamento da NFC-e em 14/05"
            placeholderTextColor={Colors.ink3}
            multiline
            numberOfLines={3}
            style={s.noteInput}
          />
          <Pressable
            onPress={handleAddNote}
            disabled={notesMutation.isPending || !noteDraft.trim()}
            style={[s.noteBtn, (notesMutation.isPending || !noteDraft.trim()) && { opacity: 0.5 }]}
          >
            <Text style={s.noteBtnText}>Adicionar nota</Text>
          </Pressable>

          {loadingNotes ? (
            <ActivityIndicator color={Colors.violet3} style={{ padding: 16 }} />
          ) : notes.length === 0 ? (
            <Text style={s.notesEmpty}>Nenhuma nota ainda. Use o campo acima pra registrar contato/observacao.</Text>
          ) : (
            <View style={{ marginTop: 12 }}>
              {notes.map(function(n) {
                return (
                  <View key={n.id} style={s.noteRow}>
                    <View style={s.noteHead}>
                      <Text style={s.noteAuthor}>{n.author_name || n.author_email || "Staff"}</Text>
                      <Text style={s.noteDate}>{new Date(n.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</Text>
                    </View>
                    <Text style={s.noteBody}>{n.body}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

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
              <Text style={s.clientMeta}>{client.owner_email} · {client.tx_count} tx · {fmtK(client.total_revenue)}</Text>
            </View>
            <View style={[s.badge, { backgroundColor: pc.color + "18" }]}><Text style={[s.badgeText, { color: pc.color }]}>{pc.label}</Text></View>
            {(client.extra_seats_granted ?? 0) > 0 && (
              <View style={[s.badge, { backgroundColor: Colors.violet + "20" }]}>
                <Text style={[s.badgeText, { color: Colors.violet3 }]}>+{client.extra_seats_granted}</Text>
              </View>
            )}
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
  // 12/05/2026: Estender Trial
  trialStatusRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border, marginBottom: 12 },
  trialStatusLabel: { fontSize: 11, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.3 },
  trialStatusValue: { fontSize: 13, color: Colors.ink, fontWeight: "700" },
  trialFormRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  fieldLabel: { fontSize: 10, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4 },
  trialDaysInput: { backgroundColor: Colors.bg4, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, paddingVertical: 10, paddingHorizontal: 12, fontSize: 14, fontWeight: "700", color: Colors.ink, textAlign: "center" },
  trialReasonInput: { backgroundColor: Colors.bg4, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, paddingVertical: 10, paddingHorizontal: 12, fontSize: 12, color: Colors.ink },
  trialBtn: { backgroundColor: Colors.violet, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  trialBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  trialHint: { fontSize: 10, color: Colors.ink3, marginTop: 10, lineHeight: 14 },
  // 12/05/2026: Acessos extras (seats)
  seatsSummaryGrid: { flexDirection: "row", gap: 8, marginBottom: 12 },
  seatsBox: { flex: 1, backgroundColor: Colors.bg4, borderRadius: 10, padding: 12, alignItems: "center", borderWidth: 1, borderColor: Colors.border },
  seatsBoxLabel: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.4, fontWeight: "700", marginBottom: 4 },
  seatsBoxValue: { fontSize: 22, fontWeight: "800", color: Colors.ink, letterSpacing: -0.5 },
  seatsBoxSub: { fontSize: 9, color: Colors.ink3, marginTop: 2, fontWeight: "600" },
  // 12/05/2026: Notas internas
  noteInput: { backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingVertical: 10, paddingHorizontal: 12, fontSize: 13, color: Colors.ink, minHeight: 60, textAlignVertical: "top" },
  noteBtn: { backgroundColor: Colors.violet, borderRadius: 10, paddingVertical: 10, alignItems: "center", marginTop: 8 },
  noteBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  notesEmpty: { fontSize: 11, color: Colors.ink3, textAlign: "center", marginTop: 16, lineHeight: 16 },
  noteRow: { backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, padding: 12, marginBottom: 8 },
  noteHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  noteAuthor: { fontSize: 11, color: Colors.violet3, fontWeight: "700" },
  noteDate: { fontSize: 10, color: Colors.ink3 },
  noteBody: { fontSize: 12, color: Colors.ink, lineHeight: 18 },
});

export default ClientsAdmin;
