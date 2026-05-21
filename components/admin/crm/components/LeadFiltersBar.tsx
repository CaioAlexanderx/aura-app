// ─── LeadFiltersBar ──────────────────────────────────────────────────────────
// Barra de filtros UNIFICADA, reusada em Fila/Lista/Kanban. Le e escreve no
// store global useLeadFiltersStore.
//
// Contem:
//   - Saved Views (chips horizontais com count ao vivo + match automatico)
//   - Search input (debounced via state local pra nao bater backend a cada tecla)
//   - Botao filtros expansiveis (FilterPanel)
//   - Botao export CSV (respeitando filtros atuais)
//   - Quick chips de status (mostrando contagem do conjunto filtrado)
//
// Props sao "extras" — tudo que precisar pra Saved Views vem de fora,
// state de filtros e read+write direto no store.
// ============================================================================

import { useState, useEffect } from "react";
import { View, Text, ScrollView, Pressable, TextInput } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { crmStyles as cs } from "../shared/styles";
import { STATUSES } from "../shared/constants";
import { FilterPanel } from "./FilterPanel";
import { LeadViewChips } from "./LeadViewChips";
import { useLeadFiltersStore } from "../shared/useLeadFiltersStore";
import { BASE_URL } from "@/services/api";
import type { LeadView, LeadStatus } from "@/services/crmApi";
import type { LeadListFilters } from "../shared/types";

type Props = {
  // Pipeline pra mostrar contagens nos chips de status
  pipeline?: Record<string, { count: number; potential_mrr: number }>;
  // Total visivel pro chip "Todos"
  totalVisible?: number;
  meta?: any;
  // Saved Views
  views?: LeadView[];
  onApplyView?: (view: LeadView) => void;
  onSaveAsView?: () => void;
  // Mostrar export CSV?
  showExport?: boolean;
  // Esconder chips de status (pro Kanban onde as colunas ja sao por status)
  hideStatusChips?: boolean;
  // Placeholder customizado da busca
  searchPlaceholder?: string;
};

export function LeadFiltersBar({
  pipeline, totalVisible, meta,
  views, onApplyView, onSaveAsView,
  showExport = true,
  hideStatusChips = false,
  searchPlaceholder = "Buscar nome, telefone, endereco...",
}: Props) {
  const filters            = useLeadFiltersStore((s) => s.filters);
  const setFilter          = useLeadFiltersStore((s) => s.setFilter);
  const clearFilters       = useLeadFiltersStore((s) => s.clearFilters);

  const [showFilters, setShowFilters] = useState(false);

  // Debounce do search (300ms) — evita refetch a cada tecla
  const [searchLocal, setSearchLocal] = useState(filters.search);
  useEffect(() => {
    setSearchLocal(filters.search); // sincroniza quando view aplica
  }, [filters.search]);

  useEffect(() => {
    if (searchLocal === filters.search) return;
    const t = setTimeout(() => setFilter("search", searchLocal), 300);
    return () => clearTimeout(t);
  }, [searchLocal]);

  // Conta filtros ativos (sem search) pro badge
  const activeFilterCount = (() => {
    let n = 0;
    if (filters.status)        n++;
    if (filters.city)          n++;
    if (filters.category)      n++;
    if (filters.has_phone)     n++;
    if (filters.min_rating)    n++;
    if (filters.followup_due)  n++;
    if (filters.no_contact)    n++;
    if (filters.min_score)     n++;
    if (filters.expected_plan) n++;
    if (filters.is_rotten)     n++;
    if (filters.status_in)     n++;
    if (filters.status_not_in) n++;
    if (filters.stale_days)    n++;
    if (filters.recent_hours)  n++;
    return n;
  })();

  const hasActiveFilters = activeFilterCount > 0 || !!filters.search;

  function exportCsv() {
    const qs: string[] = [];
    if (filters.status)        qs.push("status=" + filters.status);
    if (filters.city)          qs.push("city=" + encodeURIComponent(filters.city));
    if (filters.category)      qs.push("category=" + encodeURIComponent(filters.category));
    if (filters.has_phone)     qs.push("has_phone=true");
    if (filters.min_rating)    qs.push("min_rating=" + filters.min_rating);
    if (filters.expected_plan) qs.push("expected_plan=" + filters.expected_plan);
    if (filters.search)        qs.push("search=" + encodeURIComponent(filters.search));
    if (filters.status_in)     qs.push("status_in=" + encodeURIComponent(filters.status_in));
    if (filters.status_not_in) qs.push("status_not_in=" + encodeURIComponent(filters.status_not_in));
    if (filters.stale_days)    qs.push("stale_days=" + filters.stale_days);
    if (filters.recent_hours)  qs.push("recent_hours=" + filters.recent_hours);
    if (filters.min_score)     qs.push("min_score=" + filters.min_score);
    if (filters.is_rotten)     qs.push("is_rotten=" + filters.is_rotten);
    if (filters.no_contact)    qs.push("no_contact=true");
    if (filters.followup_due)  qs.push("followup_due=true");
    const url = BASE_URL + "/admin/leads/export" + (qs.length ? "?" + qs.join("&") : "");
    if (typeof window !== "undefined") window.open(url, "_blank");
  }

  return (
    <View>
      {/* Saved Views chips */}
      {views && onApplyView && onSaveAsView && (
        <LeadViewChips
          views={views}
          filters={filters}
          hasActiveFilters={hasActiveFilters}
          onApplyView={onApplyView}
          onClearFilters={clearFilters}
          onSaveAsView={onSaveAsView}
        />
      )}

      {/* Search + botoes */}
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
        <TextInput
          value={searchLocal}
          onChangeText={setSearchLocal}
          placeholder={searchPlaceholder}
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
        {showExport && (
          <Pressable onPress={exportCsv} style={cs.filterToggleBtn}>
            <Icon name="download" size={14} color={Colors.ink3} />
          </Pressable>
        )}
      </View>

      {/* Painel expansivel de filtros */}
      {showFilters && (
        <FilterPanel
          filters={filters}
          setFilter={setFilter}
          meta={meta}
          activeCount={activeFilterCount}
          onClear={clearFilters}
        />
      )}

      {/* Quick chips de status (apenas se nao escondidos) */}
      {!hideStatusChips && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, marginBottom: 10 }}
          contentContainerStyle={{ flexDirection: "row", gap: 6 }}
        >
          <Pressable onPress={() => setFilter("status", "")} style={[cs.chip, !filters.status && cs.chipActive]}>
            <Text style={[cs.chipText, !filters.status && cs.chipTextActive]}>
              Todos {totalVisible != null ? `(${totalVisible})` : ""}
            </Text>
          </Pressable>
          {STATUSES.map((st) => {
            const entry = pipeline?.[st.key];
            const count = entry?.count ?? 0;
            return (
              <Pressable
                key={st.key}
                onPress={() => setFilter("status", (filters.status === st.key ? "" : st.key) as LeadStatus | "")}
                style={[cs.chip, filters.status === st.key && { backgroundColor: st.color + "22", borderColor: st.color }]}
              >
                <Text style={[cs.chipText, filters.status === st.key && { color: st.color }]}>
                  {st.label}{count ? ` (${count})` : ""}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
