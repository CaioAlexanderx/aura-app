import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { BeltBadge } from "@/components/karate/BeltBadge";
import { KarateEmptyState as EmptyState } from "@/components/karate/EmptyState";
import { KarateButton } from "@/components/karate/KarateButton";
import { karateApi, PractitionerDetail, BeltHistoryEntry } from "@/services/karateApi";
import { formatIsoToBr } from "@/components/inputs/DateInput";
import { canTransfer, isUnknownBeltDate, webConfirm, webAlert } from "./helpers";
import { RegistrarGraduacaoModal } from "./RegistrarGraduacaoModal";
import { EditarGraduacaoModal } from "./EditarGraduacaoModal";

interface Props {
  history: BeltHistoryEntry[];
  currentBelt: PractitionerDetail["current_belt"];
  federationId: string;
  practitionerId: string;
  karateRole: string | null;
  onChanged: () => void;
}

export function TrajetoriaTab({
  history, currentBelt, federationId, practitionerId, karateRole, onChanged,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<BeltHistoryEntry | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const allowed = canTransfer(karateRole); // mesmos papéis de escrita (admin/staff)

  // CTA primário em sumi, tamanho normal, alinhado à direita (ação da aba).
  const AddButton = allowed ? (
    <View style={tabStyles.tabActions}>
      <KarateButton
        label="Registrar graduação"
        variant="sumi"
        size="md"
        onPress={() => setModalOpen(true)}
      />
    </View>
  ) : null;

  // Fix C4: só mostra "Desde:" quando a data é conhecida (≠ sentinela 1900).
  const currentSinceUnknown = currentBelt ? isUnknownBeltDate(currentBelt.current_since) : true;

  async function handleDelete(entry: BeltHistoryEntry) {
    if (!webConfirm("Excluir esta graduação? A faixa atual será recalculada.")) return;
    setBusyId(entry.id);
    try {
      await karateApi.deleteGraduation(federationId, practitionerId, entry.id);
      onChanged();
    } catch (e: any) {
      webAlert(e?.message || "Não foi possível excluir a graduação.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View style={tabStyles.tab}>
      {AddButton}

      {/* Faixa atual (derivada do histórico) — Track C */}
      {currentBelt && (
        <View style={tabStyles.currentBeltBanner}>
          <Icon name="ribbon" size={16} color={KarateColors.primary} />
          <View style={tabStyles.currentBeltInfo}>
            <Text style={tabStyles.currentBeltLabel}>Faixa atual</Text>
            <BeltBadge beltLevel={currentBelt.belt_level} beltName={currentBelt.belt_name} />
            {!currentSinceUnknown && (
              <Text style={tabStyles.currentBeltSince}>Desde: {formatIsoToBr(currentBelt.current_since) || currentBelt.current_since}</Text>
            )}
          </View>
        </View>
      )}

      {history.length === 0 ? (
        <EmptyState
          icon="ribbon-outline"
          title="Sem histórico de faixas"
          subtitle={allowed ? "Use “Registrar graduação” para adicionar a primeira faixa." : undefined}
          style={{ paddingVertical: 32 }}
        />
      ) : (
        history.map((entry) => {
          // Fix C4: data-sentinela 1900 = data desconhecida (backfill).
          // Não renderizamos a data; mantemos o rótulo "Registro histórico".
          const dateUnknown = isUnknownBeltDate(entry.graduated_at);
          const dateLabel = dateUnknown
            ? null
            : (formatIsoToBr(entry.graduated_at) || new Date(entry.graduated_at).toLocaleDateString("pt-BR"));
          const isLegacy = entry.belt_schema === "legacy";
          const metaParts: string[] = [];
          if (dateLabel) metaParts.push(dateLabel);
          if (isLegacy) metaParts.push("Registro histórico");
          if (entry.exam_id) metaParts.push(`Exame: ${entry.exam_id}`);
          return (
            <View key={entry.id} style={tabStyles.beltEntry}>
              <View style={tabStyles.beltLine} />
              <View style={{ flex: 1, gap: 4 }}>
                <BeltBadge
                  beltLevel={entry.belt_level}
                  beltName={entry.belt_name}
                  isLegacy={entry.is_legacy}
                />
                {metaParts.length > 0 ? (
                  <Text style={tabStyles.beltDate}>{metaParts.join(" · ")}</Text>
                ) : (
                  <Text style={tabStyles.beltDate}>Data não informada</Text>
                )}
              </View>
              {allowed && (
                <View style={tabStyles.itemActions}>
                  <TouchableOpacity
                    style={tabStyles.iconBtn}
                    onPress={() => setEditEntry(entry)}
                    disabled={busyId === entry.id}
                    accessibilityRole="button"
                    accessibilityLabel="Editar graduação"
                  >
                    <Icon name="edit" size={15} color={KarateColors.ink2} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[tabStyles.iconBtn, tabStyles.iconBtnDanger]}
                    onPress={() => handleDelete(entry)}
                    disabled={busyId === entry.id}
                    accessibilityRole="button"
                    accessibilityLabel="Excluir graduação"
                  >
                    {busyId === entry.id
                      ? <ActivityIndicator size="small" color={KarateColors.primary} />
                      : <Icon name="trash" size={15} color={KarateColors.primary} />}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })
      )}

      <RegistrarGraduacaoModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        federationId={federationId}
        practitionerId={practitionerId}
        onDone={() => { setModalOpen(false); onChanged(); }}
      />

      <EditarGraduacaoModal
        entry={editEntry}
        onClose={() => setEditEntry(null)}
        federationId={federationId}
        practitionerId={practitionerId}
        onDone={() => { setEditEntry(null); onChanged(); }}
      />
    </View>
  );
}

const tabStyles = StyleSheet.create({
  tab:              { padding: 16, gap: 10 } as ViewStyle,
  tabActions:       { flexDirection: "row", justifyContent: "flex-end", flexWrap: "wrap", gap: 8 } as ViewStyle,
  itemActions:      { flexDirection: "row", alignItems: "center", gap: 6 } as ViewStyle,
  iconBtn:          { width: 32, height: 32, borderRadius: KarateRadius.sm, borderWidth: 1, borderColor: KarateColors.border, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" } as ViewStyle,
  iconBtnDanger:    { borderColor: KarateColors.primaryLine, backgroundColor: KarateColors.primarySoft } as ViewStyle,
  currentBeltBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: KarateColors.primarySoft, padding: 12,
    borderRadius: KarateRadius.md, marginBottom: 4,
  } as ViewStyle,
  currentBeltInfo:  { flex: 1, gap: 4 } as ViewStyle,
  currentBeltLabel: { fontSize: 11, fontWeight: "800", color: KarateColors.primary, textTransform: "uppercase", letterSpacing: 0.8 } as TextStyle,
  currentBeltSince: { fontSize: 11, color: KarateColors.ink3 } as TextStyle,
  beltEntry:        { flexDirection: "row", gap: 12, alignItems: "flex-start", paddingVertical: 8 } as ViewStyle,
  beltLine:         { width: 3, borderRadius: 2, backgroundColor: KarateColors.border, alignSelf: "stretch", minHeight: 40 } as ViewStyle,
  beltDate:         { fontSize: 11, color: KarateColors.ink3, marginTop: 2 } as TextStyle,
});

