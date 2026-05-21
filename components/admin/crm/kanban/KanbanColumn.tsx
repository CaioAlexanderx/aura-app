// ─── KanbanColumn ────────────────────────────────────────────────────────────
// Coluna individual do Kanban. Recebe leads filtrados pelo status,
// usa useDropZoneRef pra ser drop-target via DOM nativo,
// e renderiza header + scroll dos cards.
// ============================================================================

import { useCallback } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { crmStyles as cs } from "../shared/styles";
import { fmtMoney } from "../shared/helpers";
import { LeadCard } from "../components/LeadCard";
import { useDropZoneRef } from "./useDragAndDrop";
import type { StatusMeta } from "../shared/constants";
import type { Lead, LeadStatus } from "@/services/crmApi";

type Props = {
  status: StatusMeta;
  leads: Lead[];
  potentialMrr?: number;
  selectedIds: Set<string>;
  isHover?: boolean;
  onDropLead: (leadId: string, toStatus: LeadStatus) => void;
  onHoverChange: (s: LeadStatus | null) => void;
  onCardPress: (id: string) => void;
  onCardLongPress: (id: string) => void;
  onCardDragStart: (id: string) => void;
  onCardDragEnd: () => void;
  waTemplate?: string;
};

export function KanbanColumn({
  status, leads, potentialMrr, selectedIds, isHover,
  onDropLead, onHoverChange,
  onCardPress, onCardLongPress, onCardDragStart, onCardDragEnd,
  waTemplate,
}: Props) {
  // Ref que aplica os listeners HTML5 drop no nó DOM
  const dropRef = useDropZoneRef(status.key, onDropLead, onHoverChange);

  // Memoiza handlers do card pra nao recriar a cada render
  const handleCardPress = useCallback((id: string) => onCardPress(id), [onCardPress]);
  const handleCardLongPress = useCallback((id: string) => onCardLongPress(id), [onCardLongPress]);

  return (
    <View
      ref={dropRef as any}
      style={[
        s.column,
        { borderColor: status.color + (isHover ? "" : "44") },
        isHover && { borderColor: status.color, backgroundColor: status.color + "10" },
      ]}
    >
      {/* Header */}
      <View style={[s.header, { borderBottomColor: status.color + "44" }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={[s.dot, { backgroundColor: status.color }]} />
          <Text style={[s.title, { color: status.color }]}>{status.label}</Text>
          <Text style={s.count}>{leads.length}</Text>
        </View>
        {potentialMrr != null && potentialMrr > 0 && (
          <Text style={[s.mrr, { color: status.color }]}>{fmtMoney(potentialMrr)}</Text>
        )}
      </View>

      {/* Scroll de cards */}
      <ScrollView style={s.scroll} contentContainerStyle={{ padding: 8, gap: 6 }}>
        {leads.length === 0 ? (
          <Text style={s.empty}>Vazio</Text>
        ) : (
          leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              layout="kanban"
              draggable
              selected={selectedIds.has(lead.id)}
              onDragStart={onCardDragStart}
              onDragEnd={onCardDragEnd}
              onPress={() => handleCardPress(lead.id)}
              onLongPress={() => handleCardLongPress(lead.id)}
              waTemplate={waTemplate}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  column: {
    width: 260,
    backgroundColor: Colors.bg3,
    borderRadius: 12,
    borderWidth: 1.5,
    marginRight: 10,
    maxHeight: 700,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  title: { fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4 },
  count: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.ink,
    backgroundColor: Colors.bg4,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    minWidth: 22,
    textAlign: "center",
  },
  mrr: { fontSize: 10, fontWeight: "700" },
  scroll: { maxHeight: 640 },
  empty: { fontSize: 10, color: Colors.ink3, fontStyle: "italic", textAlign: "center", padding: 12 },
});
