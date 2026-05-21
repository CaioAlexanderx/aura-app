// ─── LeadsListView ───────────────────────────────────────────────────────────
// Busca + filtros (expandivel) + lista de leads com multi-selecao.
// ============================================================================

import { useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { crmStyles as cs } from "../shared/styles";
import { STATUSES } from "../shared/constants";
import { fillWaTemplate, copyToClipboard } from "../shared/helpers";
import { FilterPanel } from "../components/FilterPanel";
import { LeadCard } from "../components/LeadCard";
import { BatchActionBar } from "../components/BatchActionBar";
import { BASE_URL } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import type { Lead, LeadStatus, Cadence } from "@/services/crmApi";
import type { LeadListFilters } from "../shared/types";

type Props = {
  leads: Lead[];
  pipeline?: Record<string, { count: number; potential_mrr: number }>;
  meta?: any;
  isLoading: boolean;
  filters: LeadListFilters;
  setFilter: <K extends keyof LeadListFilters>(k: K, v: LeadListFilters[K]) => void;
  clearFilters: () => void;
  activeFilterCount: number;
  waTemplate: string;
  onSelectLead: (id: string) => void;
  onInteractionPress: (lead: Lead) => void;
  onBatch: (action: any, payload?: any) => void;
  batchPending: boolean;
  cadences: Cadence[];
  onGoToImport: () => void;
};

export function LeadsListView({
  leads, pipeline, meta, isLoading,
  filters, setFilter, clearFilters, activeFilterCount,
  waTemplate, onSelectLead, onInteractionPress,
  onBatch, batchPending, cadences, onGoToImport,
}: Props) {
  const [showFilters, setShowFilters]   = useState(false);
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set());
  const { token } = useAuthStore();

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  function handleBatch(action: any, payload?: any) {
    onBatch({ ids: Array.from(selectedIds), action, payload });
    clearSelection();
  }

  function exportCsv() {
    const qs: string[] = [];
    if (filters.status)        qs.push("status=" + filters.status);
    if (filters.city)          qs.push("city=" + encodeURIComponent(filters.city));
    if (filters.category)      qs.push("category=" + encodeURIComponent(filters.category));
    if (filters.has_phone)     qs.push("has_phone=true");
    if (filters.min_rating)    qs.push("min_rating=" + filters.min_rating);
    if (filters.expected_plan) qs.push("expected_plan=" + filters.expected_plan);
    if (filters.search)        qs.push("search=" + encodeURIComponent(filters.search));
    const url = BASE_URL + "/admin/leads/export" + (qs.length ? "?" + qs.join("&") : "");
    if (typeof window !== "undefined") {
      // Inclui token via header nao da no link direto — abre nova aba que envia cookie/Authorization?
      // Solucao: append token na URL? Servidor aceita ?token= via query — se nao, baixa via fetch+blob.
      window.open(url, "_blank");
    }
  }

  return (
    <View>
      {/* Search + filtros + export */}
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
        <TextInput
          value={filters.search}
          onChangeText={(v) => setFilter("search", v)}
          placeholder="Buscar nome, telefone, endereco..."
          placeholderTextColor={Colors.ink3}
          style={[cs.searchInput, { flex: 1 }]}
        />
        <Pressable
          onPress={() => setShowFilters(!showFilters)}
          style={[cs.filterToggleBtn, activeFilterCount > 0 && { borderColor: Colors.violet3, backgroundColor: Colors.violetD }]}
        >
          <Icon name="filter" size={14} color={activeFilterCount > 0 ? Colors.violet3 : Colors.ink3} />
          {activeFilterCount > 0 && <Text style={cs.filterBadge}>{activeFilterCount}</Text>}
        </Pressable>
        <Pressable onPress={exportCsv} style={cs.filterToggleBtn}>
          <Icon name="download" size={14} color={Colors.ink3} />
        </Pressable>
      </View>

      {showFilters && (
        <FilterPanel
          filters={filters}
          setFilter={setFilter}
          meta={meta}
          activeCount={activeFilterCount}
          onClear={clearFilters}
        />
      )}

      {/* Status chips quick filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 10 }} contentContainerStyle={{ flexDirection: "row", gap: 6 }}>
        <Pressable onPress={() => setFilter("status", "")} style={[cs.chip, !filters.status && cs.chipActive]}>
          <Text style={[cs.chipText, !filters.status && cs.chipTextActive]}>Todos ({leads.length})</Text>
        </Pressable>
        {STATUSES.map((st) => {
          const entry = pipeline?.[st.key];
          const count = entry?.count || 0;
          if (!count) return null;
          return (
            <Pressable
              key={st.key}
              onPress={() => setFilter("status", filters.status === st.key ? "" : st.key)}
              style={[cs.chip, filters.status === st.key && { backgroundColor: st.color + "22", borderColor: st.color }]}
            >
              <Text style={[cs.chipText, filters.status === st.key && { color: st.color }]}>
                {st.label} ({count})
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Loading */}
      {isLoading && <ActivityIndicator color={Colors.violet3} style={{ padding: 40 }} />}

      {/* Empty */}
      {!isLoading && leads.length === 0 && (
        <View style={cs.emptyState}>
          <Icon name="users" size={32} color={Colors.ink3} />
          <Text style={cs.emptyTitle}>
            {activeFilterCount > 0 ? "Nenhum lead com esses filtros" : "Nenhum lead ainda"}
          </Text>
          {activeFilterCount > 0 ? (
            <Pressable onPress={clearFilters} style={[cs.importBtn, { marginTop: 16 }]}>
              <Text style={cs.importBtnText}>Limpar filtros</Text>
            </Pressable>
          ) : (
            <Pressable onPress={onGoToImport} style={[cs.importBtn, { marginTop: 16 }]}>
              <Text style={cs.importBtnText}>Importar planilha</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Lista */}
      {leads.map((lead) => (
        <LeadCard
          key={lead.id}
          lead={lead}
          selected={selectedIds.has(lead.id)}
          waTemplate={waTemplate}
          onPress={() => {
            // Se ha selecao ativa, click adiciona/remove. Caso contrario, abre detalhe.
            if (selectedIds.size > 0) toggleSelect(lead.id);
            else onSelectLead(lead.id);
          }}
          onLongPress={() => toggleSelect(lead.id)}
          onPressInteraction={() => onInteractionPress(lead)}
          onPressCopyMsg={() => copyToClipboard(fillWaTemplate(waTemplate, lead.name), "Mensagem copiada!")}
        />
      ))}

      {/* Barra flutuante de batch */}
      <BatchActionBar
        selectedCount={selectedIds.size}
        onClear={clearSelection}
        onBatch={handleBatch}
        isPending={batchPending}
        cadences={cadences}
      />
    </View>
  );
}
