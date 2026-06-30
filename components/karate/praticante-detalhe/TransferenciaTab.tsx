import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { KarateEmptyState as EmptyState } from "@/components/karate/EmptyState";
import { KarateButton } from "@/components/karate/KarateButton";
import { TransferirPraticanteModal } from "@/components/karate/TransferirPraticanteModal";
import { karateApi, PractitionerDetail, TransferRecord } from "@/services/karateApi";
import { canTransfer, webConfirm, webAlert } from "./helpers";
import { EditarTransferenciaModal } from "./EditarTransferenciaModal";

interface Props {
  federationId: string;
  practitioner: PractitionerDetail;
  karateRole: string | null;
  onTransferred: () => void;
}

// Track N: aba de transferências — histórico + ação de transferir/editar/excluir
export function TransferenciaTab({
  federationId,
  practitioner,
  karateRole,
  onTransferred,
}: Props) {
  const [transfers, setTransfers] = useState<TransferRecord[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTransfer, setEditTransfer] = useState<TransferRecord | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    karateApi.listTransfers(federationId, practitioner.id)
      .then((res: any) => setTransfers(Array.isArray(res?.data) ? res.data : (res?.data ?? [])))
      .catch(() => setTransfers([]))
      .finally(() => setLoading(false));
  }, [federationId, practitioner.id]);

  useEffect(() => { load(); }, [load]);

  const handleDone = () => { load(); onTransferred(); };

  const allowed = canTransfer(karateRole);

  async function handleDelete(t: TransferRecord) {
    if (!webConfirm("Excluir este registro? Isso NÃO move o praticante de volta.")) return;
    setBusyId(t.id);
    try {
      await karateApi.deleteTransfer(federationId, practitioner.id, t.id);
      load();
    } catch (e: any) {
      webAlert(e?.message || "Não foi possível excluir a transferência.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View style={tabStyles.tab}>
      {allowed && (
        // CTA primário em sumi, tamanho normal, alinhado à direita (ação da aba).
        <View style={tabStyles.tabActions}>
          <KarateButton
            label="Transferir para outro dojô"
            variant="sumi"
            size="md"
            onPress={() => setModalOpen(true)}
          />
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginVertical: 20 }} color={KarateColors.primary} />
      ) : !transfers || transfers.length === 0 ? (
        <EmptyState
          icon="swap-horizontal-outline"
          title="Sem transferências"
          subtitle="Este praticante nunca foi transferido de dojô."
          style={{ paddingVertical: 32 }}
        />
      ) : (
        <View style={{ gap: 10, marginTop: 4 }}>
          <Text style={tabStyles.transferHint}>
            Histórico de transferências entre dojôs.
          </Text>
          {transfers.map((t) => (
            <View key={t.id} style={tabStyles.transferCard}>
              <View style={tabStyles.transferRow}>
                <Text style={tabStyles.transferDojo} numberOfLines={1}>{t.origin_dojo_name || "Sem dojô"}</Text>
                <Icon name="arrow_right" size={15} color={KarateColors.primary} />
                <Text style={[tabStyles.transferDojo, { color: KarateColors.primary }]} numberOfLines={1}>
                  {t.destination_dojo_name || "—"}
                </Text>
                {allowed && (
                  <View style={tabStyles.itemActions}>
                    <TouchableOpacity
                      style={tabStyles.iconBtn}
                      onPress={() => setEditTransfer(t)}
                      disabled={busyId === t.id}
                      accessibilityRole="button"
                      accessibilityLabel="Editar transferência"
                    >
                      <Icon name="edit" size={15} color={KarateColors.ink2} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[tabStyles.iconBtn, tabStyles.iconBtnDanger]}
                      onPress={() => handleDelete(t)}
                      disabled={busyId === t.id}
                      accessibilityRole="button"
                      accessibilityLabel="Excluir transferência"
                    >
                      {busyId === t.id
                        ? <ActivityIndicator size="small" color={KarateColors.primary} />
                        : <Icon name="trash" size={15} color={KarateColors.primary} />}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              <Text style={tabStyles.transferMeta}>
                {new Date(t.transferred_at).toLocaleDateString("pt-BR")}
                {t.initiated_by_name ? ` · por ${t.initiated_by_name}` : ""}
              </Text>
              {t.reason ? <Text style={tabStyles.transferReason}>{t.reason}</Text> : null}
            </View>
          ))}
        </View>
      )}

      <TransferirPraticanteModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        federationId={federationId}
        practitionerId={practitioner.id}
        practitionerName={practitioner.full_name}
        originDojoId={practitioner.dojo_id ?? null}
        originDojoName={transfers && transfers[0]?.destination_dojo_name ? transfers[0].destination_dojo_name : null}
        onDone={handleDone}
      />

      <EditarTransferenciaModal
        transfer={editTransfer}
        onClose={() => setEditTransfer(null)}
        federationId={federationId}
        practitionerId={practitioner.id}
        onDone={() => { setEditTransfer(null); load(); }}
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
  transferHint:     { fontSize: 12, color: KarateColors.ink3, marginBottom: 2 } as TextStyle,
  transferCard:     { backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 12, gap: 6 } as ViewStyle,
  transferRow:      { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  transferDojo:     { flex: 1, fontSize: 14, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  transferMeta:     { fontSize: 11, color: KarateColors.ink3 } as TextStyle,
  transferReason:   { fontSize: 12, color: KarateColors.ink2, fontStyle: "italic" } as TextStyle,
});

