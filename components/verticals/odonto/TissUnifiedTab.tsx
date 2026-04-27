// ============================================================
// TissUnifiedTab — fluxo TISS unificado (PR20 — Item #4).
//
// Antes: TissTab abria Modal full-screen com 3 sub-tabs +
// uma tab separada "Reconciliar TISS" no faturamento.
// Resultado: dois pontos de entrada, modal sobre tab, confuso.
//
// Agora: 4 sub-tabs INLINE no faturamento — Convênios | Guias |
// Lotes | Reconciliar. Sem modal. Fluxo natural: cadastra
// convênio → emite guia → fecha lote → reconcilia pagamento.
// ============================================================

import { useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { useAuthStore } from "@/stores/auth";
import { DentalColors } from "@/constants/dental-tokens";
import type { Insurance, Guide } from "./tissTypes";
import { TissInsuranceTab, TissCatalogModal, TissInsuranceFormModal } from "./TissInsuranceTab";
import { TissGuidesTab, TissGuideFormModal } from "./TissGuidesTab";
import { TissBatchesTab, TissBatchFormModal } from "./TissBatchesTab";
import { TissReconcilePanel } from "@/components/dental/TissReconcilePanel";

type SubTab = "convenios" | "guias" | "lotes" | "reconciliar";

const SUBTABS: ReadonlyArray<{ id: SubTab; label: string; hint: string }> = [
  { id: "convenios",   label: "Convênios",   hint: "Cadastre operadoras e tabelas de procedimentos" },
  { id: "guias",       label: "Guias",       hint: "Crie e acompanhe guias TISS por paciente" },
  { id: "lotes",       label: "Lotes",       hint: "Agrupe guias em lotes pra envio à operadora" },
  { id: "reconciliar", label: "Reconciliar", hint: "Marque guias pagas/parciais com retorno do plano" },
];

export function TissUnifiedTab() {
  const cid = useAuthStore().company?.id;
  const [tab, setTab] = useState<SubTab>("guias");
  const [showCatalog,      setShowCatalog]      = useState(false);
  const [showGuideForm,    setShowGuideForm]    = useState(false);
  const [showBatchForm,    setShowBatchForm]    = useState(false);
  const [editingInsurance, setEditingInsurance] = useState<Insurance | null>(null);
  const [editingGuide,     setEditingGuide]     = useState<Guide | null>(null);

  if (!cid) {
    return (
      <View style={s.empty}>
        <Text style={s.emptyText}>Carregando empresa...</Text>
      </View>
    );
  }

  const active = SUBTABS.find(t => t.id === tab) || SUBTABS[1];

  return (
    <View>
      {/* Sub-nav */}
      <View style={s.tabsRow}>
        {SUBTABS.map(t => (
          <Pressable
            key={t.id}
            onPress={() => setTab(t.id)}
            style={[s.tab, tab === t.id && s.tabActive]}
          >
            <Text style={[s.tabText, tab === t.id && s.tabTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Hint da sub-tab ativa */}
      <Text style={s.hint}>{active.hint}</Text>

      {/* Conteúdo */}
      <View style={{ marginTop: 6 }}>
        {tab === "convenios" && (
          <TissInsuranceTab
            cid={cid}
            onAddFromCatalog={() => setShowCatalog(true)}
            onEdit={(ins: Insurance) => setEditingInsurance(ins)}
          />
        )}
        {tab === "guias" && (
          <TissGuidesTab
            cid={cid}
            onCreate={() => { setEditingGuide(null); setShowGuideForm(true); }}
            onEdit={(g: Guide) => { setEditingGuide(g); setShowGuideForm(true); }}
          />
        )}
        {tab === "lotes" && (
          <TissBatchesTab
            cid={cid}
            onCreate={() => setShowBatchForm(true)}
          />
        )}
        {tab === "reconciliar" && <TissReconcilePanel />}
      </View>

      {/* Modais auxiliares (catalog / forms) */}
      <TissCatalogModal
        visible={showCatalog}
        cid={cid}
        onClose={() => setShowCatalog(false)}
      />
      <TissInsuranceFormModal
        visible={!!editingInsurance}
        cid={cid}
        insurance={editingInsurance}
        onClose={() => setEditingInsurance(null)}
      />
      <TissGuideFormModal
        visible={showGuideForm}
        cid={cid}
        guide={editingGuide}
        onClose={() => { setShowGuideForm(false); setEditingGuide(null); }}
      />
      <TissBatchFormModal
        visible={showBatchForm}
        cid={cid}
        onClose={() => setShowBatchForm(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  tabsRow: {
    flexDirection: "row", flexWrap: "wrap", gap: 6,
    marginBottom: 4,
    ...(Platform.OS === "web" ? { overflowX: "auto" as any } : {}),
  },
  tab: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8,
    borderWidth: 1, borderColor: DentalColors.border,
    backgroundColor: "transparent",
  },
  tabActive: {
    backgroundColor: DentalColors.cyanDim,
    borderColor: DentalColors.cyanBorder,
  },
  tabText: { fontSize: 12, color: DentalColors.ink2, fontWeight: "600" },
  tabTextActive: { color: DentalColors.cyan, fontWeight: "700" },
  hint: { fontSize: 11, color: DentalColors.ink3, marginTop: 4, marginBottom: 12, fontStyle: "italic" },
  empty: { padding: 40, alignItems: "center" },
  emptyText: { fontSize: 12, color: DentalColors.ink3 },
});

export default TissUnifiedTab;
