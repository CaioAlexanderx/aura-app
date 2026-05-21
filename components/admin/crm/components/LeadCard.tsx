// ─── LeadCard ────────────────────────────────────────────────────────────────
// Card reusavel entre LeadsListView (linha) e KanbanColumn (mini-card).
// 2 layouts: "row" (full-width, lista) e "kanban" (compacto, drag handle).
//
// IMPORTANTE — DnD no Kanban (web):
//   O Pressable do RN Web faz preventDefault em pointerdown, o que bloqueia
//   o HTML5 DnD. Por isso o ramo "kanban" em web usa <View> (que renderiza
//   <div>) + onClick HTML5 nativo. Em mobile mantemos Pressable (DnD desativado).
// ============================================================================

import { View, Text, Pressable, Platform } from "react-native";
import { Icon } from "@/components/Icon";
import { Colors } from "@/constants/colors";
import type { Lead } from "@/services/crmApi";
import { statusMeta, fmtRelative, waLink, fillWaTemplate, copyToClipboard, fmtMoney } from "../shared/helpers";
import { crmStyles as cs } from "../shared/styles";
import { ScoreBadge } from "./ScoreBadge";

const isWeb = Platform.OS === "web";

type CommonProps = {
  lead: Lead;
  selected?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  onPressWa?: () => void;
  onPressCopyMsg?: () => void;
  onPressInteraction?: () => void;
  waTemplate?: string;
};

type RowProps = CommonProps & {
  layout?: "row";
};

type KanbanProps = CommonProps & {
  layout: "kanban";
  draggable?: boolean;
  onDragStart?: (id: string) => void;
};

type Props = RowProps | KanbanProps;

export function LeadCard(props: Props) {
  const { lead, selected, onPress, onLongPress, onPressWa, onPressCopyMsg, onPressInteraction, waTemplate } = props;
  const sm = statusMeta(lead.status);
  const wa = waLink(lead.phone);
  const rel = fmtRelative(lead.last_contact_at);

  function handleWa() {
    if (onPressWa) return onPressWa();
    if (wa && typeof window !== "undefined") window.open(wa, "_blank");
  }

  function handleCopy() {
    if (onPressCopyMsg) return onPressCopyMsg();
    if (waTemplate) {
      copyToClipboard(fillWaTemplate(waTemplate, lead.name), "Mensagem copiada!");
    }
  }

  // ── Layout Kanban (compacto) ───────────────────────────────────────────────
  if (props.layout === "kanban") {
    const isDraggable = !!(props as KanbanProps).draggable && isWeb;

    const cardStyle = [
      cs.leadRow,
      { padding: 10, marginBottom: 6 },
      isWeb && {
        cursor: isDraggable ? "grab" : "pointer",
        userSelect: "none",
        WebkitUserSelect: "none",
        MozUserSelect: "none",
        msUserSelect: "none",
        WebkitUserDrag: "element",
        WebkitTouchCallout: "none",
      } as any,
      lead.followup_overdue && cs.leadRowOverdue,
      lead.rotten_since && cs.leadRowRotten,
      selected && cs.leadRowSelected,
    ];

    const cardChildren = (
      <>
        {lead.followup_overdue && (
          <View style={cs.overdueChip}>
            <Text style={cs.overdueChipText} selectable={false}>Atrasado</Text>
          </View>
        )}
        {lead.rotten_since && !lead.followup_overdue && (
          <View style={cs.rottenChip}>
            <Text style={cs.rottenChipText} selectable={false}>Rotten</Text>
          </View>
        )}

        <Text style={[cs.leadName, { fontSize: 13 }]} numberOfLines={1} selectable={false}>{lead.name}</Text>
        <Text style={[cs.leadMeta, { fontSize: 10 }]} numberOfLines={1} selectable={false}>
          {[lead.city, lead.category].filter(Boolean).join(" · ")}
        </Text>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
          <ScoreBadge score={lead.dynamic_score} variant="compact" />
          {lead.expected_mrr ? (
            <Text style={{ fontSize: 10, color: Colors.violet3, fontWeight: "700" }} selectable={false}>
              {fmtMoney(lead.expected_mrr)}
            </Text>
          ) : null}
          {lead.cadence_name && (
            <Text style={{ fontSize: 9, color: Colors.amber, fontWeight: "700" }} selectable={false}>
              📋 {lead.cadence_name}
            </Text>
          )}
          {rel && <Text style={{ fontSize: 9, color: Colors.ink3 }} selectable={false}>{rel}</Text>}
        </View>
      </>
    );

    // Em web, renderiza <View> (= div) com HTML5 DnD nativo + onClick HTML
    if (isWeb) {
      const webProps: Record<string, any> = {
        onClick: onPress,
        // long-press substituto: dblclick adiciona pra selecao
        onDoubleClick: onLongPress,
      };
      if (isDraggable) {
        webProps.draggable = true;
        webProps.onDragStart = (e: any) => {
          e.dataTransfer.setData("text/plain", lead.id);
          e.dataTransfer.effectAllowed = "move";
          (props as KanbanProps).onDragStart?.(lead.id);
        };
      }
      return (
        // @ts-ignore — RN Web aceita props HTML em View
        <View style={cardStyle} {...webProps}>
          {cardChildren}
        </View>
      );
    }

    // Em mobile, Pressable normal (sem DnD)
    return (
      <Pressable onPress={onPress} onLongPress={onLongPress} style={cardStyle}>
        {cardChildren}
      </Pressable>
    );
  }

  // ── Layout row (lista padrao) ──────────────────────────────────────────────
  return (
    <View style={[
      cs.leadRow,
      lead.followup_overdue && cs.leadRowOverdue,
      lead.rotten_since && cs.leadRowRotten,
      selected && cs.leadRowSelected,
    ]}>
      {lead.followup_overdue && (
        <View style={cs.overdueChip}>
          <Text style={cs.overdueChipText}>Follow-up</Text>
        </View>
      )}
      {lead.rotten_since && !lead.followup_overdue && (
        <View style={cs.rottenChip}>
          <Text style={cs.rottenChipText}>Rotten</Text>
        </View>
      )}

      <Pressable style={{ flex: 1 }} onPress={onPress} onLongPress={onLongPress}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={[cs.statusDotSm, { backgroundColor: sm.color + "22" }]}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: sm.color }} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={cs.leadName} numberOfLines={1}>{lead.name}</Text>
              {lead.dynamic_score >= 50 && <Text style={{ fontSize: 9, color: Colors.green, fontWeight: "700" }}>★</Text>}
              {lead.expected_plan && (
                <View style={[cs.badge, { backgroundColor: Colors.violetD, paddingHorizontal: 6, paddingVertical: 2 }]}>
                  <Text style={{ fontSize: 9, color: Colors.violet3, fontWeight: "700", textTransform: "uppercase" }}>
                    {lead.expected_plan}
                  </Text>
                </View>
              )}
            </View>
            <Text style={cs.leadMeta} numberOfLines={1}>
              {[lead.city, lead.category].filter(Boolean).join(" · ")}
              {rel ? " · " + rel : ""}
              {lead.google_rating ? " · " + lead.google_rating + "★" : ""}
              {lead.cadence_name ? " · 📋 " + lead.cadence_name : ""}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end", gap: 4 }}>
            <View style={[cs.badge, { backgroundColor: sm.color + "18" }]}>
              <Text style={[cs.badgeText, { color: sm.color }]}>{sm.label}</Text>
            </View>
            <ScoreBadge score={lead.dynamic_score} variant="compact" />
          </View>
        </View>
      </Pressable>

      <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
        {wa && (
          <Pressable onPress={handleWa} style={[cs.rowBtn, { borderColor: Colors.green + "44" }]}>
            <Text style={[cs.rowBtnText, { color: Colors.green }]}>WA</Text>
          </Pressable>
        )}
        {wa && waTemplate && (
          <Pressable onPress={handleCopy} style={cs.rowBtn}>
            <Text style={cs.rowBtnText}>Copiar msg</Text>
          </Pressable>
        )}
        {onPressInteraction && (
          <Pressable onPress={onPressInteraction} style={cs.rowBtn}>
            <Text style={cs.rowBtnText}>+ Contato</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
