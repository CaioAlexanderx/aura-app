// ─── FilterBar ───────────────────────────────────────────────────────────────
// Barra de filtros reusavel entre Fila, Lista e Kanban. Combina:
//   - LeadViewChips (saved views pinadas) no topo
//   - Search input
//   - Botao expand de filtros (FilterPanel)
//   - Botao Salvar lente (aparece com filtros ativos)
//
// Todos os 3 views usam essa barra; o estado vem do useLeadFiltersStore global.
// ============================================================================

import { useState } from "react";
import { View, Pressable, TextInput } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { crmStyles as cs } from "../shared/styles";
import { useLeadFiltersStore, countActiveFilters } from "../shared/useLeadFiltersStore";
import { useLeadViews } from "../hooks/useLeadViews";
import { LeadViewChips } from "./LeadViewChips";
import { FilterPanel } from "./FilterPanel";
import { viewFiltersToLocal } from "../shared/types";
import type { LeadView } from "@/services/crmApi";

type Props = {
  meta?: any;
  onSaveAsView: () => void;
  /** Esconde o input de busca (Fila nao precisa). */
  hideSearch?: boolean;
  /** Esconde os chips de saved views. */
  hideViews?: boolean;
};

export function FilterBar({ meta, onSaveAsView, hideSearch, hideViews }: Props) {
  const [showFilters, setShowFilters] = useState(false);

  const filters       = useLeadFiltersStore((s) => s.filters);
  const setFilter     = useLeadFiltersStore((s) => s.setFilter);
  const setFilters    = useLeadFiltersStore((s) => s.setFilters);
  const clearFilters  = useLeadFiltersStore((s) => s.clearFilters);
  const activeCount   = countActiveFilters(filters);
  const hasActive     = activeCount > 0 || !!filters.search;

  const { views } = useLeadViews();

  function handleApplyView(v: LeadView) {
    setFilters(viewFiltersToLocal(v.filters));
  }

  return (
    <View>
      {/* Chips de saved views */}
      {!hideViews && (
        <LeadViewChips
          views={views}
          filters={filters}
          hasActiveFilters={hasActive}
          onApplyView={handleApplyView}
          onClearFilters={clearFilters}
          onSaveAsView={onSaveAsView}
        />
      )}

      {/* Search + botao filtros */}
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
        {!hideSearch && (
          <TextInput
            value={filters.search}
            onChangeText={(v) => setFilter("search", v)}
            placeholder="Buscar nome, telefone, endereco..."
            placeholderTextColor={Colors.ink3}
            style={[cs.searchInput, { flex: 1 }]}
          />
        )}
        <Pressable
          onPress={() => setShowFilters(!showFilters)}
          style={[
            cs.filterToggleBtn,
            !hideSearch ? null : { flex: 1, flexDirection: "row", gap: 6, justifyContent: "center" },
            activeCount > 0 && { borderColor: Colors.violet3, backgroundColor: Colors.violetD },
          ]}
        >
          <Icon name="filter" size={14} color={activeCount > 0 ? Colors.violet3 : Colors.ink3} />
          {activeCount > 0 && <View style={cs.filterBadge as any}><></></View>}
          {activeCount > 0 && (
            <View style={{ paddingLeft: 4 }}>
              <FilterBadge n={activeCount} />
            </View>
          )}
        </Pressable>
      </View>

      {/* Painel expandido */}
      {showFilters && (
        <FilterPanel
          filters={filters}
          setFilter={setFilter}
          meta={meta}
          activeCount={activeCount}
          onClear={clearFilters}
        />
      )}
    </View>
  );
}

// Pequena badge numerica (n filtros ativos) — visual pequeno, in-button
function FilterBadge({ n }: { n: number }) {
  return (
    <View style={{
      backgroundColor: Colors.violet3,
      borderRadius: 999,
      minWidth: 16, height: 16,
      paddingHorizontal: 4,
      alignItems: "center", justifyContent: "center",
    }}>
      {/* @ts-ignore */}
      <span style={{ fontSize: 9, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{n}</span>
    </View>
  );
}
