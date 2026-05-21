// ─── KanbanView ──────────────────────────────────────────────────────────────
// 7 colunas (uma por status), scroll horizontal, DnD HTML5 (web).
// Cada coluna usa useDropZoneRef via DOM ref. Cards usam useDraggableCardRef.
// Em mobile, DnD desativa — fica como list-only por coluna (Caio decidiu).
// ============================================================================

import { useState, useCallback } from "react";
import { View, Text, ScrollView, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { crmStyles as cs } from "../shared/styles";
import { STATUSES } from "../shared/constants";
import { KanbanColumn } from "../kanban/KanbanColumn";
import { useDragAndDrop } from "../kanban/useDragAndDrop";
import { BatchActionBar } from "../components/BatchActionBar";
import type { Lead, LeadStatus, Cadence } from "@/services/crmApi";

const isWeb = Platform.OS === "web";

type Props = {
  leadsByStatus: Record<string, Lead[]>;
  pipeline?: Record<string, { count: number; potential_mrr: number }>;
  onSelectLead: (id: string) => void;
  onMoveStatus: (leadId: string, toStatus: LeadStatus) => void;
  waTemplate: string;
  onBatch: (action: any, payload?: any) => void;
  batchPending: boolean;
  cadences: Cadence[];
};

export function KanbanView({
  leadsByStatus, pipeline,
  onSelectLead, onMoveStatus,
  waTemplate, onBatch, batchPending, cadences,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const handleDrop = useCallback((leadId: string, toStatus: LeadStatus) => {
    onMoveStatus(leadId, toStatus);
  }, [onMoveStatus]);

  const handleBatch = useCallback((action: any, payload?: any) => {
    onBatch({ ids: Array.from(selectedIds), action, payload });
    clearSelection();
  }, [selectedIds, onBatch, clearSelection]);

  const dnd = useDragAndDrop(handleDrop);

  const handleCardPress = useCallback((id: string) => {
    if (selectedIds.size > 0) toggleSelect(id);
    else onSelectLead(id);
  }, [selectedIds, toggleSelect, onSelectLead]);

  return (
    <View>
      {!isWeb && (
        <View style={[cs.section, { backgroundColor: Colors.amber + "12", borderColor: Colors.amber + "44", marginBottom: 12 }]}>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <Icon name="alert" size={14} color={Colors.amber} />
            <Text style={{ fontSize: 11, color: Colors.amber, fontWeight: "600", flex: 1 }}>
              Arrastar-e-soltar so funciona na versao web. Use a tab "Lista" no mobile.
            </Text>
          </View>
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator style={{ paddingBottom: 8 }}>
        <View style={{ flexDirection: "row", padding: 4 }}>
          {STATUSES.map((status) => {
            const columnLeads = leadsByStatus[status.key] || [];
            const entry = pipeline?.[status.key];
            return (
              <KanbanColumn
                key={status.key}
                status={status}
                leads={columnLeads}
                potentialMrr={entry?.potential_mrr}
                selectedIds={selectedIds}
                isHover={dnd.hoverStatus === status.key}
                onDropLead={dnd.onDrop}
                onHoverChange={dnd.onHoverChange}
                onCardPress={handleCardPress}
                onCardLongPress={toggleSelect}
                onCardDragStart={dnd.onCardDragStart}
                onCardDragEnd={dnd.onCardDragEnd}
                waTemplate={waTemplate}
              />
            );
          })}
        </View>
      </ScrollView>

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
