// ─── WorkModeView ────────────────────────────────────────────────────────────
// Fila do dia (Work Mode). Mostra 1 lead por vez, com priorizacao do backend,
// botoes grandes de acao rapida, atalhos de teclado (web) e contador de
// progresso da sessao.
//
// Fase 5.1 (21/05): suporta filtros globais (store) — quando Caio aplica city
// ou category na FilterBar, a fila ja vem filtrada (endpoint /queue aceita).
// ============================================================================

import { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, Platform, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useLeadQueue, priorityReasonLabel, priorityReasonColor, priorityReasonDescription } from "../hooks/useLeadQueue";
import { useLeadMutations } from "../hooks/useLeadMutations";
import { useLeadFiltersStore, countActiveFilters } from "../shared/useLeadFiltersStore";
import { InteractionModal } from "../components/InteractionModal";
import { FilterBar } from "../components/FilterBar";
import { STATUSES, WA_TEMPLATE_DEFAULT } from "../shared/constants";
import {
  statusMeta, fmtRelative, fmtDateTime, fmtMoney, fmtPhone,
  waLink, fillWaTemplate, copyToClipboard,
} from "../shared/helpers";
import { ScoreBadge } from "../components/ScoreBadge";
import type { Lead, LeadStatus, PriorityReason } from "@/services/crmApi";
import { toast } from "@/components/Toast";

const isWeb = Platform.OS === "web";

type Props = {
  waTemplate?: string;
  onSelectLead?: (id: string) => void;
  meta?: any;
  onSaveAsView?: () => void;
};

export function WorkModeView({ waTemplate = WA_TEMPLATE_DEFAULT, onSelectLead, meta, onSaveAsView }: Props) {
  const { queue, leads, total, byReason, isLoading, isFetching, refetch, invalidate } = useLeadQueue(50);
  const mutations = useLeadMutations();

  // Pra mostrar resumo de filtros ativos no topo do card
  const filters       = useLeadFiltersStore((s) => s.filters);
  const filterCount   = countActiveFilters(filters);

  const [currentIndex, setCurrentIndex]       = useState(0);
  const [doneToday, setDoneToday]             = useState(0);
  const [showInteraction, setShowInteraction] = useState(false);

  // Quando filtros mudam, volta pro topo da fila (lead pode ter sido excluido do conjunto)
  useEffect(() => { setCurrentIndex(0); }, [filters]);

  // ── Lead atual ───────────────────────────────────────────────────────────
  const currentLead = leads[currentIndex];
  const remaining = Math.max(0, total - currentIndex);

  // ── Avanca pro proximo ────────────────────────────────────────────────────
  const nextLead = useCallback((count = true) => {
    if (count) setDoneToday((n) => n + 1);
    setCurrentIndex((i) => i + 1);
  }, []);

  const skipLead = useCallback(() => {
    setCurrentIndex((i) => i + 1);
    toast.info("Pulado");
  }, []);

  // ── Acoes ─────────────────────────────────────────────────────────────────
  const handleWhatsApp = useCallback(() => {
    if (!currentLead?.phone) return toast.error("Lead sem telefone");
    const url = waLink(currentLead.phone);
    if (url && isWeb && typeof window !== "undefined") window.open(url, "_blank");
  }, [currentLead]);

  const handleCopyMsg = useCallback(() => {
    if (!currentLead) return;
    const msg = fillWaTemplate(waTemplate, currentLead.name);
    copyToClipboard(msg, "Mensagem copiada");
  }, [currentLead, waTemplate]);

  const handleChangeStatus = useCallback(async (newStatus: LeadStatus) => {
    if (!currentLead) return;
    try {
      await mutations.update.mutateAsync({ id: currentLead.id, body: { status: newStatus } });
      nextLead(); // nao invalida fila durante sessao — progresso preservado
    } catch {
      // toast ja exibido pelo onError do mutation
    }
  }, [currentLead, mutations.update, nextLead]);

  const handleMarkRotten = useCallback(async () => {
    if (!currentLead) return;
    try {
      await mutations.update.mutateAsync({ id: currentLead.id, body: { rotten_since: new Date().toISOString() } });
      nextLead();
    } catch {
      // toast ja exibido pelo onError do mutation
    }
  }, [currentLead, mutations.update, nextLead]);

  const handleSubmitInteraction = useCallback(async (p: any) => {
    if (!currentLead) return;
    await mutations.interaction.mutateAsync({ id: currentLead.id, ...p });
    setShowInteraction(false);
    invalidate();
    nextLead();
  }, [currentLead, mutations.interaction, invalidate, nextLead]);

  // ── Atalhos de teclado (web) ─────────────────────────────────────────────
  const handlersRef = useRef({ handleWhatsApp, handleCopyMsg, handleChangeStatus, handleMarkRotten, nextLead, skipLead });
  handlersRef.current = { handleWhatsApp, handleCopyMsg, handleChangeStatus, handleMarkRotten, nextLead, skipLead };

  useEffect(() => {
    if (!isWeb) return;
    function onKey(e: KeyboardEvent) {
      const tag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || showInteraction) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const k = e.key.toLowerCase();
      switch (k) {
        case "w": handlersRef.current.handleWhatsApp(); break;
        case "c": handlersRef.current.handleCopyMsg(); break;
        case "i": setShowInteraction(true); break;
        case "n":
        case "arrowright":
        case " ": e.preventDefault(); handlersRef.current.skipLead(); break;
        case "r": handlersRef.current.handleMarkRotten(); break;
        case "1": handlersRef.current.handleChangeStatus("new"); break;
        case "2": handlersRef.current.handleChangeStatus("contacted"); break;
        case "3": handlersRef.current.handleChangeStatus("responded"); break;
        case "4": handlersRef.current.handleChangeStatus("interested"); break;
        case "5": handlersRef.current.handleChangeStatus("demo"); break;
        case "6": handlersRef.current.handleChangeStatus("converted"); break;
        case "7": handlersRef.current.handleChangeStatus("lost"); break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showInteraction]);

  // ── Render ────────────────────────────────────────────────────────────────

  // FilterBar SEMPRE renderiza (mesmo em loading/empty), pra Caio poder ajustar filtros.
  const filterBar = onSaveAsView ? (
    <FilterBar meta={meta} onSaveAsView={onSaveAsView} hideSearch />
  ) : null;

  // Resumo de filtros ativos pra mostrar no topo do card
  const activeFilterSummary = (() => {
    const parts: string[] = [];
    if (filters.city)          parts.push(filters.city);
    if (filters.category)      parts.push(filters.category);
    if (filters.expected_plan) parts.push(`plano ${filters.expected_plan}`);
    if (filters.min_score)     parts.push(`score ≥ ${filters.min_score}`);
    if (filters.min_rating)    parts.push(`${filters.min_rating}★+`);
    if (filters.has_phone)     parts.push("com telefone");
    return parts.length ? parts.join(" · ") : null;
  })();

  if (isLoading) {
    return (
      <View>
        {filterBar}
        <View style={s.center}>
          <ActivityIndicator color={Colors.violet3} />
          <Text style={s.dimText}>Carregando fila...</Text>
        </View>
      </View>
    );
  }

  // Fila vazia / acabou
  if (!currentLead) {
    return (
      <View>
        {filterBar}
        <View style={s.center}>
          <View style={s.emptyIconWrap}>
            <Icon name="check" size={32} color={Colors.green} />
          </View>
          <Text style={s.emptyTitle}>
            {leads.length === 0
              ? (filterCount > 0 ? "Nenhum lead nesses filtros" : "Tudo em dia!")
              : "Voce zerou a fila"}
          </Text>
          <Text style={s.emptyMsg}>
            {leads.length === 0
              ? (filterCount > 0
                ? "Tente afrouxar os filtros (cidade, categoria, etc) ou recarregar."
                : "Nada urgente pra atacar agora. Bom momento pra prospectar novos leads.")
              : `Voce processou ${doneToday} lead(s) nesta sessao. Volte mais tarde ou recarregue.`}
          </Text>
          <Pressable onPress={() => { setCurrentIndex(0); refetch(); }} style={s.refetchBtn}>
            <Icon name="refresh" size={14} color={Colors.violet3} />
            <Text style={s.refetchBtnText}>Recarregar fila</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const reason = currentLead.priority_reason as PriorityReason;
  const reasonColor = priorityReasonColor(reason);
  const sm = statusMeta(currentLead.status);
  const hasPhone = !!currentLead.phone;
  const lastActivityRel = fmtRelative(currentLead.last_activity_at || currentLead.last_contact_at);

  return (
    <View>
      {filterBar}

      {/* Indicador de filtros ativos quando ha algum */}
      {activeFilterSummary && (
        <View style={s.activeFiltersBanner}>
          <Icon name="filter" size={12} color={Colors.violet3} />
          <Text style={s.activeFiltersText} numberOfLines={1}>
            Filtrando por: {activeFilterSummary}
          </Text>
        </View>
      )}

      {/* ── Stats topo ──────────────────────────────────────────────────── */}
      <View style={s.statsRow}>
        <View style={s.statBox}>
          <Text style={s.statValue}>{doneToday}</Text>
          <Text style={s.statLabel}>Feitos</Text>
        </View>
        <View style={[s.statBox, s.statBoxMain]}>
          <Text style={[s.statValue, { color: Colors.violet3 }]}>{remaining}</Text>
          <Text style={s.statLabel}>Na fila</Text>
        </View>
        <View style={s.statBox}>
          <Text style={s.statValue}>{currentIndex + 1}</Text>
          <Text style={s.statLabel}>Posicao</Text>
        </View>
        {isFetching && (
          <View style={[s.statBox, { backgroundColor: "transparent", borderColor: "transparent" }]}>
            <ActivityIndicator size="small" color={Colors.ink3} />
          </View>
        )}
      </View>

      {/* ── Distribuicao por razao (mini badges) ─────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, marginBottom: 14 }}
        contentContainerStyle={{ flexDirection: "row", gap: 6 }}
      >
        {(["followup_overdue", "funnel_stalled", "hot_cold", "new_lead"] as PriorityReason[]).map((r) => {
          const count = byReason[r] || 0;
          if (!count) return null;
          const c = priorityReasonColor(r);
          return (
            <View key={r} style={[s.reasonBadge, { borderColor: c + "55", backgroundColor: c + "12" }]}>
              <View style={[s.reasonDot, { backgroundColor: c }]} />
              <Text style={[s.reasonText, { color: c }]}>{priorityReasonLabel(r)}</Text>
              <Text style={[s.reasonCount, { color: c }]}>{count}</Text>
            </View>
          );
        })}
      </ScrollView>

      {/* ── Card do lead atual ──────────────────────────────────────────── */}
      <View style={[s.leadCard, { borderColor: reasonColor + "66" }]}>
        <View style={[s.reasonBanner, { backgroundColor: reasonColor }]}>
          <Icon name="alert" size={14} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={s.reasonBannerLabel}>{priorityReasonLabel(reason)}</Text>
            <Text style={s.reasonBannerDesc}>{priorityReasonDescription(reason)}</Text>
          </View>
        </View>

        <Pressable
          onPress={() => onSelectLead?.(currentLead.id)}
          style={s.leadHeader}
        >
          <View style={{ flex: 1 }}>
            <Text style={s.leadName} numberOfLines={1}>{currentLead.name}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
              <View style={[s.statusBadge, { backgroundColor: sm.color + "22" }]}>
                <View style={[s.statusDot, { backgroundColor: sm.color }]} />
                <Text style={[s.statusText, { color: sm.color }]}>{sm.label}</Text>
              </View>
              <ScoreBadge score={currentLead.dynamic_score} variant="full" />
              {currentLead.expected_plan && (
                <View style={s.planBadge}>
                  <Text style={s.planBadgeText}>{String(currentLead.expected_plan).toUpperCase()}</Text>
                </View>
              )}
            </View>
          </View>
          <Icon name="chevron-right" size={16} color={Colors.ink3} />
        </Pressable>

        <View style={s.dataGrid}>
          {hasPhone && (
            <View style={s.dataItem}>
              <Icon name="phone" size={12} color={Colors.ink3} />
              <Text style={s.dataText}>{fmtPhone(currentLead.phone)}</Text>
            </View>
          )}
          {currentLead.city && (
            <View style={s.dataItem}>
              <Icon name="map-pin" size={12} color={Colors.ink3} />
              <Text style={s.dataText}>{currentLead.city}</Text>
            </View>
          )}
          {currentLead.category && (
            <View style={s.dataItem}>
              <Icon name="tag" size={12} color={Colors.ink3} />
              <Text style={s.dataText}>{currentLead.category}</Text>
            </View>
          )}
          {currentLead.google_rating != null && (
            <View style={s.dataItem}>
              <Icon name="star" size={12} color={Colors.amber} />
              <Text style={s.dataText}>{currentLead.google_rating}★ ({currentLead.google_reviews || 0})</Text>
            </View>
          )}
          {currentLead.expected_mrr != null && currentLead.expected_mrr > 0 && (
            <View style={s.dataItem}>
              <Icon name="trending-up" size={12} color={Colors.green} />
              <Text style={[s.dataText, { color: Colors.green, fontWeight: "700" }]}>
                {fmtMoney(currentLead.expected_mrr)}/mes
              </Text>
            </View>
          )}
          {lastActivityRel && (
            <View style={s.dataItem}>
              <Icon name="clock" size={12} color={Colors.ink3} />
              <Text style={s.dataText}>Ult. atividade: {lastActivityRel}</Text>
            </View>
          )}
          {currentLead.cadence_name && (
            <View style={s.dataItem}>
              <Icon name="repeat" size={12} color={Colors.amber} />
              <Text style={s.dataText}>{currentLead.cadence_name} (dia {currentLead.cadence_day})</Text>
            </View>
          )}
        </View>

        <View style={s.actionsGrid}>
          <Pressable
            onPress={handleWhatsApp}
            disabled={!hasPhone}
            style={[
              s.actionBtn,
              { backgroundColor: Colors.green },
              !hasPhone && { opacity: 0.4 },
            ]}
          >
            <Icon name="message-circle" size={16} color="#fff" />
            <Text style={s.actionBtnText}>WhatsApp</Text>
            {isWeb && <Text style={s.kbdHint}>W</Text>}
          </Pressable>

          <Pressable onPress={handleCopyMsg} style={[s.actionBtn, { backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border }]}>
            <Icon name="copy" size={16} color={Colors.ink} />
            <Text style={[s.actionBtnText, { color: Colors.ink }]}>Copiar msg</Text>
            {isWeb && <Text style={[s.kbdHint, { color: Colors.ink3 }]}>C</Text>}
          </Pressable>

          <Pressable
            onPress={() => setShowInteraction(true)}
            style={[s.actionBtn, { backgroundColor: Colors.violet }]}
          >
            <Icon name="plus" size={16} color="#fff" />
            <Text style={s.actionBtnText}>+ Contato</Text>
            {isWeb && <Text style={s.kbdHint}>I</Text>}
          </Pressable>
        </View>

        <Text style={s.sectionLabel}>Avancar status</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", gap: 6 }}>
          {STATUSES.map((st, i) => {
            const isCurrent = st.key === currentLead.status;
            return (
              <Pressable
                key={st.key}
                onPress={() => handleChangeStatus(st.key)}
                disabled={isCurrent || mutations.update.isPending}
                style={[
                  s.statusChip,
                  { borderColor: st.color + "55" },
                  isCurrent && { backgroundColor: st.color + "22", borderColor: st.color, opacity: 0.5 },
                ]}
              >
                <Text style={[s.statusChipText, { color: st.color }]}>{st.label}</Text>
                {isWeb && !isCurrent && <Text style={s.kbdHintSm}>{i + 1}</Text>}
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={[s.actionsRow, { marginTop: 14 }]}>
          <Pressable onPress={handleMarkRotten} style={[s.secondaryBtn, { borderColor: Colors.red + "55" }]}>
            <Icon name="archive" size={13} color={Colors.red} />
            <Text style={[s.secondaryBtnText, { color: Colors.red }]}>Rotten</Text>
            {isWeb && <Text style={[s.kbdHintSm, { color: Colors.red }]}>R</Text>}
          </Pressable>
          <Pressable onPress={skipLead} style={[s.secondaryBtn, { borderColor: Colors.border }]}>
            <Icon name="chevron-right" size={13} color={Colors.ink3} />
            <Text style={[s.secondaryBtnText, { color: Colors.ink3 }]}>Pular</Text>
            {isWeb && <Text style={[s.kbdHintSm, { color: Colors.ink3 }]}>N</Text>}
          </Pressable>
        </View>
      </View>

      <InteractionModal
        visible={showInteraction}
        lead={currentLead as Lead}
        onClose={() => setShowInteraction(false)}
        onSubmit={handleSubmitInteraction}
        isPending={mutations.interaction.isPending}
      />
    </View>
  );
}

const s = StyleSheet.create({
  center:        { padding: 60, alignItems: "center", justifyContent: "center", minHeight: 400 },
  dimText:       { fontSize: 13, color: Colors.ink3, marginTop: 12 },
  emptyIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Colors.green + "22",
    alignItems: "center", justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: Colors.ink, marginBottom: 8, textAlign: "center" },
  emptyMsg:   { fontSize: 13, color: Colors.ink3, textAlign: "center", maxWidth: 340, lineHeight: 19 },
  refetchBtn: {
    marginTop: 20, flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.violet + "55", backgroundColor: Colors.violetD,
  },
  refetchBtnText: { fontSize: 13, color: Colors.violet3, fontWeight: "700" },

  activeFiltersBanner: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1,
    borderColor: Colors.violet + "44",
    backgroundColor: Colors.violetD,
    marginBottom: 10,
  },
  activeFiltersText: {
    fontSize: 11, color: Colors.violet3, fontWeight: "700", flex: 1,
  },

  statsRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  statBox: {
    flex: 1, padding: 12, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg3,
    alignItems: "center",
  },
  statBoxMain: { borderColor: Colors.violet + "55", backgroundColor: Colors.violetD },
  statValue: { fontSize: 22, fontWeight: "800", color: Colors.ink },
  statLabel: { fontSize: 10, color: Colors.ink3, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.4 },

  reasonBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, borderWidth: 1,
  },
  reasonDot:   { width: 6, height: 6, borderRadius: 3 },
  reasonText:  { fontSize: 11, fontWeight: "700" },
  reasonCount: { fontSize: 11, fontWeight: "800", marginLeft: 2 },

  leadCard: {
    backgroundColor: Colors.bg3, borderRadius: 14, padding: 16,
    borderWidth: 1.5,
  },
  reasonBanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 10, marginBottom: 14,
  },
  reasonBannerLabel: { fontSize: 13, color: "#fff", fontWeight: "800" },
  reasonBannerDesc:  { fontSize: 11, color: "#fff", opacity: 0.92, marginTop: 1 },

  leadHeader: {
    flexDirection: "row", alignItems: "center",
    paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  leadName: { fontSize: 18, fontWeight: "800", color: Colors.ink },

  statusBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  statusDot:  { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.3 },
  planBadge: {
    paddingHorizontal: 6, paddingVertical: 2,
    backgroundColor: Colors.violetD, borderRadius: 4,
  },
  planBadgeText: { fontSize: 9, color: Colors.violet3, fontWeight: "800" },

  dataGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 12,
    paddingVertical: 14,
  },
  dataItem: { flexDirection: "row", alignItems: "center", gap: 6, minWidth: 120 },
  dataText: { fontSize: 12, color: Colors.ink },

  actionsGrid: {
    flexDirection: "row", gap: 8, flexWrap: "wrap",
    marginTop: 4, marginBottom: 14,
  },
  actionBtn: {
    flex: 1, minWidth: 110,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 14, paddingHorizontal: 14,
    borderRadius: 10,
  },
  actionBtnText: { fontSize: 13, color: "#fff", fontWeight: "800" },
  kbdHint: {
    position: "absolute", top: 4, right: 8,
    fontSize: 9, color: "#fff", opacity: 0.7, fontWeight: "700",
  },

  sectionLabel: {
    fontSize: 10, color: Colors.ink3, fontWeight: "700",
    textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8,
  },
  statusChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 8, borderWidth: 1,
    backgroundColor: Colors.bg4,
  },
  statusChipText: { fontSize: 11, fontWeight: "700" },
  kbdHintSm: {
    fontSize: 9, color: Colors.ink3, fontWeight: "700",
    backgroundColor: Colors.bg3, paddingHorizontal: 4, paddingVertical: 1,
    borderRadius: 3, marginLeft: 2,
  },

  actionsRow: { flexDirection: "row", gap: 8 },
  secondaryBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 10, borderRadius: 8,
    borderWidth: 1, backgroundColor: "transparent",
  },
  secondaryBtnText: { fontSize: 12, fontWeight: "700" },
});
