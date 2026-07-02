// ============================================================
// app/karate/(federation)/praticantes/[practitionerId].tsx
// Shell fina — data fetching + estado + composição de componentes.
// Comportamento idêntico ao original; extrações em components/karate/praticante-detalhe/
// ============================================================
import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, Alert, Platform,
  StyleSheet, ViewStyle, TextStyle, ActivityIndicator,
  Modal, TextInput, Pressable, Image,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius, KarateFonts, KarateBelts, BeltKey } from "@/constants/karateTheme";
import { Badge } from "@/components/karate/Badge";
import { BeltBadge } from "@/components/karate/BeltBadge";
import { Skeleton } from "@/components/karate/Skeleton";
import { KarateEmptyState as EmptyState } from "@/components/karate/EmptyState";
import { KarateButton } from "@/components/karate/KarateButton";
import { CarteirinhaPanel } from "@/components/karate/CarteirinhaPanel";
import { TransferirPraticanteModal } from "@/components/karate/TransferirPraticanteModal";
import PraticanteFichaModal from "@/components/karate/PraticanteFichaModal";
import { karateApi, HasHistoryError, PractitionerDetail, AffiliationStatus, BeltHistoryEntry, Certificate, TransferRecord } from "@/services/karateApi";
import { formatIsoToBr, maskBrDate, parseBrDate } from "@/components/inputs/DateInput";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { KarateErrorState } from "@/components/karate/ErrorState";

// Componentes extraídos
import { canTransfer, webAlert } from "@/components/karate/praticante-detalhe/helpers";
import { confirmAsync } from "@/components/karate/ConfirmDialog";
import { CadastroTab } from "@/components/karate/praticante-detalhe/CadastroTab";
import { TrajetoriaTab } from "@/components/karate/praticante-detalhe/TrajetoriaTab";
import { CertificadosTab } from "@/components/karate/praticante-detalhe/CertificadosTab";
import { TransferenciaTab } from "@/components/karate/praticante-detalhe/TransferenciaTab";
import { ExcluirComHistoricoModal } from "@/components/karate/praticante-detalhe/ExcluirComHistoricoModal";

const TABS = ["Cadastro", "Trajetória", "Certif./Exames", "Carteirinha", "Transferência", "Documentos"] as const;
type Tab = typeof TABS[number];

function PlaceholderTab({ label }: { label: string }) {
  return (
    <EmptyState
      icon="construct-outline"
      title={`${label} — Em desenvolvimento`}
      subtitle="Esta aba será implementada em uma próxima fase."
      style={{ paddingVertical: 48 }}
    />
  );
}

export default function FichaPraticanteScreen() {
  const { practitionerId } = useLocalSearchParams<{ practitionerId: string }>();
  const { federationId, karateRole } = useKarateFederation();
  const [data, setData] = useState<PractitionerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("Cadastro");
  // Modal de edição (reusa a ficha de cadastro com o id atual)
  const [editOpen, setEditOpen] = useState(false);
  // Exclusão com histórico (modal in-app) + estado de busy
  const [hasHistory, setHasHistory] = useState<Record<string, number> | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [delBusy, setDelBusy] = useState<"deactivate" | "delete" | null>(null);

  const allowed = canTransfer(karateRole); // admin/staff podem excluir/editar

  const reload = useCallback(() => {
    if (!practitionerId) return;
    setError(false);
    karateApi.getPractitioner(federationId, practitionerId)
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [federationId, practitionerId]);

  useEffect(() => { reload(); }, [reload]);

  function goBackToList() {
    if (router.canGoBack()) router.back();
    else router.replace("/karate/praticantes" as any);
  }

  // Header "Excluir praticante": tenta hard delete; se HAS_HISTORY, abre modal.
  async function handleDeletePractitioner() {
    if (!practitionerId) return;
    if (!(await confirmAsync({ title: "Excluir praticante?", message: "Excluir este praticante?", confirmLabel: "Excluir", destructive: true }))) return;
    setDeleting(true);
    try {
      await karateApi.deletePractitioner(federationId, practitionerId);
      goBackToList();
    } catch (e: any) {
      if (e instanceof HasHistoryError || e?.code === "HAS_HISTORY") {
        setHasHistory(e.counts || {});
      } else {
        webAlert(e?.message || "Não foi possível excluir o praticante.");
      }
    } finally {
      setDeleting(false);
    }
  }

  async function handleDesativar() {
    if (!practitionerId) return;
    setDelBusy("deactivate");
    try {
      await karateApi.updatePractitioner(federationId, practitionerId, { is_active: false });
      setHasHistory(null);
      setDelBusy(null);
      reload();
    } catch (e: any) {
      setDelBusy(null);
      webAlert(e?.message || "Não foi possível desativar o praticante.");
    }
  }

  async function handleExcluirDefinitivo() {
    if (!practitionerId) return;
    if (!(await confirmAsync({ title: "Excluir definitivamente?", message: "Excluir DEFINITIVAMENTE este praticante e TODO o seu histórico? Esta ação não pode ser desfeita.", confirmLabel: "Excluir definitivamente", destructive: true }))) return;
    setDelBusy("delete");
    try {
      await karateApi.deletePractitioner(federationId, practitionerId, { cascade: true });
      setHasHistory(null);
      setDelBusy(null);
      goBackToList();
    } catch (e: any) {
      setDelBusy(null);
      webAlert(e?.message || "Não foi possível excluir o praticante.");
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: KarateColors.bg, padding: 16, gap: 12 }}>
        {[1,2,3,4].map((k) => <Skeleton key={k} height={24} />)}
      </View>
    );
  }

  if (error || !data) return <KarateErrorState onRetry={reload} />;

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          <View style={styles.avatar}>
            <Icon name="users" size={24} color={KarateColors.ink3} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.regNum}>{data.karate_registration_number}</Text>
            <Text style={styles.fullName}>{data.full_name}</Text>
            {data.current_belt && (
              <BeltBadge
                beltLevel={data.current_belt.belt_level}
                beltName={data.current_belt.belt_name}
                style={{ marginTop: 6 }}
              />
            )}
          </View>
          <View style={styles.headerActions}>
            <Badge affiliationStatus={data.affiliation_status as AffiliationStatus} />
            <View style={styles.headerBtnRow}>
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => setEditOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Editar praticante"
              >
                <Icon name="edit" size={15} color={KarateColors.primary} />
                <Text style={styles.editBtnText}>Editar</Text>
              </TouchableOpacity>
              {allowed && (
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={handleDeletePractitioner}
                  disabled={deleting}
                  accessibilityRole="button"
                  accessibilityLabel="Excluir praticante"
                >
                  {deleting
                    ? <ActivityIndicator size="small" color={KarateColors.primary} />
                    : <Icon name="trash" size={15} color={KarateColors.primary} />}
                  <Text style={styles.deleteBtnText}>Excluir</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === tab }}
          >
            <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tab Content */}
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 32 }}>
        {activeTab === "Cadastro"       && <CadastroTab practitioner={data} />}
        {activeTab === "Trajetória"     && <TrajetoriaTab history={data.belt_history} currentBelt={data.current_belt} federationId={federationId} practitionerId={practitionerId!} karateRole={karateRole} onChanged={reload} />}
        {activeTab === "Certif./Exames" && <CertificadosTab federationId={federationId} practitionerId={practitionerId!} />}
        {activeTab === "Carteirinha"    && <CarteirinhaPanel federationId={federationId} practitionerId={practitionerId!} />}
        {activeTab === "Transferência"  && <TransferenciaTab federationId={federationId} practitioner={data} karateRole={karateRole} onTransferred={reload} />}
        {activeTab === "Documentos"     && <PlaceholderTab label="Documentos" />}
      </ScrollView>

      {/* Modal de edição da ficha (reusa o cadastro com o id atual) */}
      <PraticanteFichaModal
        federationId={federationId}
        visible={editOpen}
        practitionerId={practitionerId!}
        onClose={() => setEditOpen(false)}
        onSaved={() => reload()}
      />

      {/* Modal in-app: praticante com histórico (Desativar / Excluir definitivo) */}
      <ExcluirComHistoricoModal
        visible={hasHistory !== null}
        counts={hasHistory}
        busy={delBusy}
        onDesativar={handleDesativar}
        onExcluir={handleExcluirDefinitivo}
        onClose={() => { if (!delBusy) setHasHistory(null); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen:     { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  headerCard: { backgroundColor: "#fff", padding: 16, borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,
  headerRow:  { flexDirection: "row", alignItems: "flex-start", gap: 12 } as ViewStyle,
  headerActions: { alignItems: "flex-end", gap: 8 } as ViewStyle,
  headerBtnRow: { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  editBtn:    { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 6, paddingHorizontal: 12, borderRadius: KarateRadius.sm, backgroundColor: KarateColors.primarySoft, borderWidth: 1, borderColor: KarateColors.primaryLine } as ViewStyle,
  editBtnText: { fontSize: 12, fontWeight: "700", color: KarateColors.primary } as TextStyle,
  deleteBtn:  { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 6, paddingHorizontal: 12, borderRadius: KarateRadius.sm, backgroundColor: KarateColors.primarySoft, borderWidth: 1, borderColor: KarateColors.primaryLine } as ViewStyle,
  deleteBtnText: { fontSize: 12, fontWeight: "700", color: KarateColors.primary } as TextStyle,
  avatar:     { width: 52, height: 52, borderRadius: 26, backgroundColor: KarateColors.bg2, alignItems: "center", justifyContent: "center" } as ViewStyle,
  regNum:     { fontSize: 11, fontWeight: "800", color: KarateColors.primary, letterSpacing: 0.8, fontFamily: KarateFonts.mono } as TextStyle,
  fullName:   { fontFamily: KarateFonts.heading, fontSize: 20, fontWeight: "400", color: KarateColors.ink, marginTop: 2 } as TextStyle,
  tabBar:     { maxHeight: 44, borderBottomWidth: 1, borderBottomColor: KarateColors.border, backgroundColor: "#fff" } as ViewStyle,
  tabBarContent: { flexDirection: "row", paddingHorizontal: 8 } as ViewStyle,
  tab:        { paddingVertical: 12, paddingHorizontal: 14 } as ViewStyle,
  tabActive:  { borderBottomWidth: 2, borderBottomColor: KarateColors.primary } as ViewStyle,
  tabLabel:   { fontSize: 13, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  tabLabelActive: { color: KarateColors.primary, fontWeight: "700" } as TextStyle,
  content:    { flex: 1 } as ViewStyle,
});
