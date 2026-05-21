// ─── LeadViewChips ───────────────────────────────────────────────────────────
// Chips horizontais com as lentes salvas (saved views) no topo da LeadsListView.
// Cada chip aplica os filtros da view + mostra count ao vivo + cor.
// Inclui chip "+ Salvar como" quando ha filtros ativos.
// ============================================================================

import { useMemo } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import type { LeadView } from "@/services/crmApi";
import type { LeadListFilters } from "../shared/types";
import { viewFiltersToLocal } from "../shared/types";

type Props = {
  views: LeadView[];
  filters: LeadListFilters;
  hasActiveFilters: boolean;
  onApplyView: (view: LeadView) => void;
  onClearFilters: () => void;
  onSaveAsView: () => void;
};

// Compara filters atuais com os de uma view (loose equality)
function filtersMatchView(current: LeadListFilters, view: LeadView): boolean {
  const target = viewFiltersToLocal(view.filters);
  const keys: Array<keyof LeadListFilters> = [
    "search", "status", "city", "category", "has_phone", "min_rating",
    "followup_due", "no_contact", "min_score", "expected_plan", "is_rotten",
    "status_in", "status_not_in", "stale_days", "recent_hours",
  ];
  return keys.every((k) => String(current[k]) === String(target[k]));
}

export function LeadViewChips({
  views, filters, hasActiveFilters,
  onApplyView, onClearFilters, onSaveAsView,
}: Props) {
  // So mostra pinadas pra nao poluir; views nao-pinadas ficam em um menu (futuro)
  const pinned = useMemo(
    () => views.filter(v => v.is_pinned).sort((a, b) => a.sort_order - b.sort_order),
    [views]
  );

  // Detecta qual view (se alguma) bate com os filters atuais
  const activeViewId = useMemo(() => {
    if (!hasActiveFilters && pinned.length > 0) return null;
    const match = pinned.find(v => filtersMatchView(filters, v));
    return match?.id ?? null;
  }, [pinned, filters, hasActiveFilters]);

  if (pinned.length === 0 && !hasActiveFilters) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0, marginBottom: 10 }}
      contentContainerStyle={{ flexDirection: "row", gap: 6, paddingRight: 16 }}
    >
      {pinned.map((view) => {
        const isActive = activeViewId === view.id;
        const color = view.color || Colors.violet3;
        return (
          <Pressable
            key={view.id}
            onPress={() => onApplyView(view)}
            style={[
              s.chip,
              { borderColor: isActive ? color : Colors.border },
              isActive && { backgroundColor: color + "18" },
            ]}
          >
            <View style={[s.dot, { backgroundColor: color }]} />
            {view.icon && (
              <Icon name={view.icon as any} size={11} color={isActive ? color : Colors.ink3} />
            )}
            <Text style={[s.label, { color: isActive ? color : Colors.ink }]} numberOfLines={1}>
              {view.name}
            </Text>
            {view.lead_count != null && (
              <View style={[s.countBadge, isActive && { backgroundColor: color + "33" }]}>
                <Text style={[s.countText, { color: isActive ? color : Colors.ink3 }]}>
                  {view.lead_count}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}

      {/* Chip "Limpar" */}
      {hasActiveFilters && (
        <Pressable onPress={onClearFilters} style={[s.chip, { borderColor: Colors.border, backgroundColor: Colors.bg4 }]}>
          <Icon name="x" size={11} color={Colors.ink3} />
          <Text style={[s.label, { color: Colors.ink3 }]}>Limpar</Text>
        </Pressable>
      )}

      {/* Chip "Salvar como lente" */}
      {hasActiveFilters && (
        <Pressable
          onPress={onSaveAsView}
          style={[s.chip, { borderColor: Colors.violet, borderStyle: "dashed" }]}
        >
          <Icon name="plus" size={11} color={Colors.violet3} />
          <Text style={[s.label, { color: Colors.violet3, fontWeight: "700" }]}>Salvar lente</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: Colors.bg3,
    minHeight: 28,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    maxWidth: 140,
  },
  countBadge: {
    backgroundColor: Colors.bg4,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    minWidth: 20,
    alignItems: "center",
  },
  countText: {
    fontSize: 10,
    fontWeight: "700",
  },
});
