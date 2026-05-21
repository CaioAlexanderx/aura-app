// ─── ProspecaoAdmin (orquestrador slim) ──────────────────────────────────────
// Responsabilidades:
//  - State leve: aba atual, selectedId, modal de interacao, waTemplate
//  - Wire dos hooks (lista, detalhe, mutations, cadencias)
//  - Renderizar a view ativa + LeadDetailView quando ha selectedId
//  - Modal de interacao global (acionavel tanto da lista quanto do detalhe)
// ============================================================================

import { useMemo, useState } from "react";
import { View, ScrollView, Pressable, Text, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { crmStyles as cs } from "./shared/styles";
import { WA_TEMPLATE_DEFAULT } from "./shared/constants";
import type { ViewMode, ImportStats } from "./shared/types";
import type { Lead, LeadStatus } from "@/services/crmApi";

import { useLeadsList } from "./hooks/useLeadsList";
import { useLeadDetail } from "./hooks/useLeadDetail";
import { useLeadMutations } from "./hooks/useLeadMutations";
import { useCadences } from "./hooks/useCadences";

import { LeadsListView } from "./views/LeadsListView";
import { KanbanView } from "./views/KanbanView";
import { LeadDetailView } from "./views/LeadDetailView";
import { PipelineView } from "./views/PipelineView";
import { ImportView } from "./views/ImportView";
import { GoalsView } from "./views/GoalsView";

import { InteractionModal } from "./components/InteractionModal";

const TABS: { key: ViewMode; label: string }[] = [
  { key: "lista",     label: "Lista" },
  { key: "kanban",    label: "Kanban" },
  { key: "pipeline",  label: "Pipeline" },
  { key: "importar",  label: "Importar" },
  { key: "metas",     label: "Metas" },
];

export function ProspecaoAdmin() {
  const [view, setView]                         = useState<ViewMode>("lista");
  const [selectedId, setSelectedId]             = useState<string | null>(null);
  const [interactionLead, setInteractionLead]   = useState<Lead | null>(null);
  const [waTemplate, setWaTemplate]             = useState(WA_TEMPLATE_DEFAULT);
  const [importStats, setImportStats]           = useState<ImportStats | null>(null);

  // Hooks principais
  const list      = useLeadsList(view !== "metas");
  const detail    = useLeadDetail(selectedId);
  const mutations = useLeadMutations(selectedId);
  const cad       = useCadences(true);

  // Pipeline derivado (somente count pros chips)
  const pipelineSimple = useMemo(() => {
    const out: Record<string, { count: number; potential_mrr: number }> = {};
    Object.entries(list.pipeline || {}).forEach(([k, v]) => {
      out[k] = typeof v === "number" ? { count: v, potential_mrr: 0 } : v;
    });
    return out;
  }, [list.pipeline]);

  // Handlers consolidados pro batch
  function handleBatch(args: { ids: string[]; action: any; payload?: any }) {
    mutations.batch.mutate(args);
  }

  function handleImport(leads: any[]) {
    mutations.importLeads.mutate(leads, {
      onSuccess: (r) => setImportStats({ inserted: r.inserted, skipped: r.skipped }),
    });
  }

  function handleInteractionSubmit(p: { body: string; channel: any; new_status?: any; next_followup_at?: string; advance_cadence?: boolean }) {
    if (!interactionLead) return;
    mutations.interaction.mutate({ id: interactionLead.id, ...p }, {
      onSuccess: () => setInteractionLead(null),
    });
  }

  // ── Detalhe (vista cheia) ─────────────────────────────────────────────────
  if (selectedId) {
    if (!detail.lead) {
      return <ActivityIndicator color={Colors.violet3} style={{ padding: 40 }} />;
    }
    return (
      <View>
        <LeadDetailView
          lead={detail.lead}
          interactions={detail.interactions}
          isLoading={detail.isLoading}
          waTemplate={waTemplate}
          onBack={() => setSelectedId(null)}
          onPressInteraction={() => setInteractionLead(detail.lead!)}
          onUpdate={(body) => mutations.update.mutate({ id: detail.lead!.id, body })}
          onApplyCadence={(name, day) => mutations.applyCadence.mutate({ id: detail.lead!.id, cadence_name: name, start_day: day })}
          onClearCadence={() => mutations.update.mutate({ id: detail.lead!.id, body: { cadence_name: null, cadence_day: 0 } })}
          isUpdating={mutations.update.isPending}
          isApplyingCadence={mutations.applyCadence.isPending}
        />
        <InteractionModal
          visible={!!interactionLead}
          lead={interactionLead}
          onClose={() => setInteractionLead(null)}
          onSubmit={handleInteractionSubmit}
          isPending={mutations.interaction.isPending}
        />
      </View>
    );
  }

  // ── Tabs principais ───────────────────────────────────────────────────────
  return (
    <View>
      {/* Sub-tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, marginBottom: 12 }}
        contentContainerStyle={{ flexDirection: "row", gap: 6 }}
      >
        {TABS.map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => setView(tab.key)}
            style={[cs.chip, view === tab.key && cs.chipActive]}
          >
            <Text style={[cs.chipText, view === tab.key && cs.chipTextActive]}>{tab.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Views */}
      {view === "lista" && (
        <LeadsListView
          leads={list.leads}
          pipeline={pipelineSimple}
          meta={list.meta}
          isLoading={list.isLoading}
          filters={list.filters}
          setFilter={list.setFilter}
          clearFilters={list.clearFilters}
          activeFilterCount={list.activeFilterCount}
          waTemplate={waTemplate}
          onSelectLead={setSelectedId}
          onInteractionPress={setInteractionLead}
          onBatch={handleBatch}
          batchPending={mutations.batch.isPending}
          cadences={cad.cadences}
          onGoToImport={() => setView("importar")}
        />
      )}

      {view === "kanban" && (
        <KanbanView
          leadsByStatus={list.leadsByStatus}
          pipeline={pipelineSimple}
          onSelectLead={setSelectedId}
          onMoveStatus={(id, status) => mutations.moveStatus.mutate({ id, status })}
          waTemplate={waTemplate}
          onBatch={handleBatch}
          batchPending={mutations.batch.isPending}
          cadences={cad.cadences}
        />
      )}

      {view === "pipeline" && (
        <PipelineView
          stats={list.stats}
          metaStats={list.meta?.stats}
          pipeline={pipelineSimple}
          onStatusClick={(status) => {
            list.setFilter("status", status as LeadStatus);
            setView("lista");
          }}
        />
      )}

      {view === "importar" && (
        <ImportView
          waTemplate={waTemplate}
          setWaTemplate={setWaTemplate}
          onImport={handleImport}
          isImporting={mutations.importLeads.isPending}
          importStats={importStats}
        />
      )}

      {view === "metas" && <GoalsView />}

      {/* Modal interacao global */}
      <InteractionModal
        visible={!!interactionLead}
        lead={interactionLead}
        onClose={() => setInteractionLead(null)}
        onSubmit={handleInteractionSubmit}
        isPending={mutations.interaction.isPending}
      />
    </View>
  );
}
