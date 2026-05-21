// ─── LeadDetailView ──────────────────────────────────────────────────────────
// Slide-over de detalhe: cabecalho + ações + dados + cadencia + timeline.
// Editor inline de expected_plan/expected_mrr.
// ============================================================================

import { useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, TextInput } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { crmStyles as cs } from "../shared/styles";
import { PLANS } from "../shared/constants";
import { fmtDate, fmtMoney, fmtPhone, statusMeta, waLink, fillWaTemplate, copyToClipboard } from "../shared/helpers";
import { ScoreBadge } from "../components/ScoreBadge";
import { LeadTimeline } from "../components/LeadTimeline";
import { CadenceSelector } from "../components/CadenceSelector";
import type { Lead, LeadInteraction, ExpectedPlan } from "@/services/crmApi";

type Props = {
  lead: Lead;
  interactions: LeadInteraction[];
  isLoading?: boolean;
  waTemplate: string;
  onBack: () => void;
  onPressInteraction: () => void;
  onUpdate: (body: Record<string, any>) => void;
  onApplyCadence: (cadence_name: string, start_day?: number) => void;
  onClearCadence: () => void;
  isUpdating?: boolean;
  isApplyingCadence?: boolean;
};

export function LeadDetailView({
  lead, interactions, isLoading, waTemplate,
  onBack, onPressInteraction, onUpdate, onApplyCadence, onClearCadence,
  isUpdating, isApplyingCadence,
}: Props) {
  const [editingPlan, setEditingPlan] = useState(false);
  const [draftMrr, setDraftMrr] = useState<string>(String(lead.expected_mrr || ""));

  if (isLoading) return <ActivityIndicator color={Colors.violet3} style={{ padding: 40 }} />;

  const sm = statusMeta(lead.status);
  const wa = waLink(lead.phone);

  return (
    <View>
      <Pressable onPress={onBack} style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 13, color: Colors.violet3, fontWeight: "600" }}>{"<"} Voltar aos leads</Text>
      </Pressable>

      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <View style={[cs.statusDot, { backgroundColor: sm.color + "22" }]}>
          <Text style={[cs.statusDotText, { color: sm.color }]}>{lead.name[0]?.toUpperCase() || "?"}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: "800", color: Colors.ink }}>{lead.name}</Text>
          <Text style={{ fontSize: 11, color: Colors.ink3, marginTop: 2 }}>
            {[lead.city, lead.category].filter(Boolean).join(" · ")}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 6 }}>
          <View style={[cs.badge, { backgroundColor: sm.color + "20" }]}>
            <Text style={[cs.badgeText, { color: sm.color }]}>{sm.label}</Text>
          </View>
          <ScoreBadge score={lead.dynamic_score} variant="full" />
        </View>
      </View>

      {/* Alerts */}
      {lead.followup_overdue && (
        <View style={cs.overdueBar}>
          <Icon name="clock" size={12} color={Colors.red} />
          <Text style={cs.overdueText}>Follow-up vencido em {fmtDate(lead.next_followup_at)}</Text>
        </View>
      )}
      {lead.rotten_since && !lead.followup_overdue && (
        <View style={[cs.overdueBar, { backgroundColor: Colors.ink3 + "15", borderColor: Colors.ink3 + "33" }]}>
          <Icon name="alert" size={12} color={Colors.ink3} />
          <Text style={[cs.overdueText, { color: Colors.ink3 }]}>
            Rotten desde {fmtDate(lead.rotten_since)} (sem atividade prolongada)
          </Text>
        </View>
      )}

      {/* Acoes principais */}
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {wa && (
          <Pressable
            onPress={() => { if (typeof window !== "undefined") window.open(wa!, "_blank"); }}
            style={[cs.actionBtn, { backgroundColor: Colors.green + "18", borderColor: Colors.green + "44" }]}
          >
            <Icon name="message" size={14} color={Colors.green} />
            <Text style={[cs.actionBtnText, { color: Colors.green }]}>WhatsApp</Text>
          </Pressable>
        )}
        {wa && (
          <Pressable
            onPress={() => copyToClipboard(fillWaTemplate(waTemplate, lead.name), "Mensagem copiada!")}
            style={[cs.actionBtn, { backgroundColor: Colors.violetD, borderColor: Colors.border2 }]}
          >
            <Icon name="copy" size={14} color={Colors.violet3} />
            <Text style={[cs.actionBtnText, { color: Colors.violet3 }]}>Copiar msg</Text>
          </Pressable>
        )}
        <Pressable onPress={onPressInteraction} style={cs.actionBtn}>
          <Icon name="edit" size={14} color={Colors.ink3} />
          <Text style={cs.actionBtnText}>+ Contato</Text>
        </Pressable>
      </View>

      {/* Cadencia */}
      <View style={{ marginBottom: 12 }}>
        <CadenceSelector
          currentCadence={lead.cadence_name}
          currentDay={lead.cadence_day}
          onApply={onApplyCadence}
          onClear={onClearCadence}
          isPending={isApplyingCadence}
        />
      </View>

      {/* Plano esperado + MRR */}
      <View style={cs.section}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <Text style={cs.sectionTitle}>Plano esperado</Text>
          <Pressable onPress={() => setEditingPlan(!editingPlan)}>
            <Text style={{ fontSize: 11, color: Colors.violet3, fontWeight: "600" }}>
              {editingPlan ? "Cancelar" : "Editar"}
            </Text>
          </Pressable>
        </View>

        {editingPlan ? (
          <View>
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              <Pressable
                onPress={() => { onUpdate({ expected_plan: null, expected_mrr: null }); setEditingPlan(false); }}
                style={[cs.chip, !lead.expected_plan && cs.chipActive]}
              >
                <Text style={[cs.chipText, !lead.expected_plan && cs.chipTextActive]}>Nenhum</Text>
              </Pressable>
              {PLANS.map((p) => (
                <Pressable
                  key={p.key}
                  onPress={() => {
                    const mrr = parseFloat(draftMrr) || p.price;
                    onUpdate({ expected_plan: p.key, expected_mrr: mrr });
                    setEditingPlan(false);
                  }}
                  style={[cs.chip, lead.expected_plan === p.key && cs.chipActive]}
                >
                  <Text style={[cs.chipText, lead.expected_plan === p.key && cs.chipTextActive]}>
                    {p.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={cs.fieldLabel}>MRR esperado (R$)</Text>
            <TextInput
              value={draftMrr}
              onChangeText={setDraftMrr}
              keyboardType="decimal-pad"
              placeholder="89.00"
              placeholderTextColor={Colors.ink3}
              style={[cs.noteInput, { minHeight: 40 }]}
            />
          </View>
        ) : (
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: lead.expected_plan ? Colors.violet3 : Colors.ink3 }}>
              {lead.expected_plan ? PLANS.find((p) => p.key === lead.expected_plan)?.label || lead.expected_plan : "Nao definido"}
            </Text>
            <Text style={{ fontSize: 14, fontWeight: "800", color: Colors.green }}>
              {lead.expected_mrr ? fmtMoney(lead.expected_mrr) + "/mes" : ""}
            </Text>
          </View>
        )}
      </View>

      {/* Dados */}
      <View style={cs.section}>
        <Text style={cs.sectionTitle}>Dados</Text>
        {[
          ["Telefone", fmtPhone(lead.phone)],
          ["Endereco", lead.address],
          ["Site", lead.website],
          ["Nota Google", lead.google_rating ? `${lead.google_rating} (${lead.google_reviews || 0} av.)` : null],
          ["Ultimo contato", fmtDate(lead.last_contact_at)],
          ["Ultima atividade", fmtDate(lead.last_activity_at)],
          ["Proximo follow-up", lead.next_followup_at ? fmtDate(lead.next_followup_at) + (lead.followup_overdue ? " ⚠" : "") : null],
          ["Cadastrado", fmtDate(lead.created_at)],
        ].map(([label, val]) => {
          if (!val || val === "-") return null;
          return (
            <View key={String(label)} style={cs.infoRow}>
              <Text style={cs.infoLabel}>{label}</Text>
              <Text style={cs.infoVal} numberOfLines={2}>{String(val)}</Text>
            </View>
          );
        })}
      </View>

      {/* Historico / timeline */}
      <View style={cs.section}>
        <Text style={cs.sectionTitle}>Historico ({interactions.length})</Text>
        <LeadTimeline interactions={interactions} />
      </View>

      {isUpdating && (
        <View style={{ padding: 8, alignItems: "center" }}>
          <ActivityIndicator size="small" color={Colors.violet3} />
        </View>
      )}
    </View>
  );
}
