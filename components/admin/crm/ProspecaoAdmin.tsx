// ─── ProspecaoAdmin (orquestrador slim) ──────────────────────────────────────
// Responsabilidades:
//  - State leve: aba atual, selectedId, modal de interacao, waTemplate, saveModal
//  - Wire dos hooks (lista, detalhe, mutations, cadencias, views, queue)
//  - Renderizar a view ativa + LeadDetailView quando ha selectedId
//  - Modal de interacao global + Modal salvar lente
//
// Fase 5 (21/05/2026): adicionada tab "Fila" (Work Mode) + Saved Views.
// Fase 5.1 (21/05/2026): filtros (city/category/etc) compartilhados entre as
// 3 views via store global useLeadFiltersStore. Lista/Kanban/Fila usam o
// mesmo conjunto de filtros — Caio aplica cidade no Kanban, ao trocar pra
// Fila os leads ja vem filtrados pela mesma cidade.
// ============================================================================

import { useMemo, useState } from "react";
import { View, ScrollView, Pressable, Text, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { crmStyles as cs } from "./shared/styles";
import { WA_TEMPLATE_DEFAULT } from "./shared/constants";
import type { ViewMode, ImportStats } from "./shared/types";
import { viewFiltersToLocal } from "./shared/types";
import type { Lead, LeadStatus, LeadView } from "@/services/crmApi";

import { useLeadsList }    from "./hooks/useLeadsList";
import { useLeadDetail }   from "./hooks/useLeadDetail";
import { useLeadMutations } from "./hooks/useLeadMutations";
import { useCadences }     from "./hooks/useCadences";
import { useLeadViews }    from "./hooks/useLeadViews";

import { LeadsListView } from "./views/LeadsListView";
import { KanbanView }    from "./views/KanbanView";
import { LeadDetailView } from "./views/LeadDetailView";
import { PipelineView }  from "./views/PipelineView";
import { ImportView }    from "./views/ImportView";
import { GoalsView }     from "./views/GoalsView";
import { WorkModeView }  from "./views/WorkModeView";

import { InteractionModal } from "./components/InteractionModal";
import { SaveViewModal }    from "./components/SaveViewModal";

const TABS: { key: ViewMode; label: string }[] = [
  { key: "fila",      label: "Fila" },     // Fase 5: nova tab default
  { key: "lista",     label: "Lista" },
  { key: "kanban",    label: "Kanban" },
  { key: "pipeline",  label: "Pipeline" },
  { key: "importar",  label: "Importar" },
  { key: "metas",     label: "Metas" },
];

export function ProspecaoAdmin() {
  const [view, setView]                         = useState<ViewMode>("fila");
  const [selectedId, setSelectedId]             = useState<string | null>(null);
  const [interactionLead, setInteractionLead]   = useState<Lead | null>(null);
  const [waTemplate, setWaTemplate]             = useState(WA_TEMPLATE_DEFAULT);
  const [importStats, setImportStats]           = useState<ImportStats | null>(null);
  const [showSaveModal, setShowSaveModal]       = useState(false);

  // Hooks principais. useLeadsList agora SEMPRE ativo (exceto em metas/importar)
  // pra a FilterBar ter `meta` (cidades/categorias) disponivel em todas as views.
  const listEnabled = view === "lista" || view === "kanban" || view === "fila" || view === "pipeline";
  const list      = useLeadsList(listEnabled);
  const detail    = useLeadDetail(selectedId);
  const mutations = useLeadMutations(selectedId);
  const cad       = useCadences(true);
  const views     = useLeadViews();

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

  // ── Saved Views handlers ──────────────────────────────────────────────────
  function handleApplyView(v: LeadView) {
    list.setFilters(viewFiltersToLocal(v.filters));
    // Diferente da v anterior: NAO troca de view automaticamente. O usuario
    // aplica a lente onde estiver (Fila/Lista/Kanban) e os filtros valem em
    // todas via store global. Se quiser ver a lista, ele troca a aba.
  }

  function handleSaveAsView() {
    setShowSaveModal(true);
  }

  async function handleSaveView(body: any) {
    await views.create.mutateAsync(body);
    setShowSaveModal(false);
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
      {view === "fila" && (
        <WorkModeView
          waTemplate={waTemplate}
          onSelectLead={setSelectedId}
          meta={list.meta}
          onSaveAsView={handleSaveAsView}
        />
      )}

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
          views={views.views}
          onApplyView={handleApplyView}
          onSaveAsView={handleSaveAsView}
        />
      )}

      {view === "kanban" && (
        <KanbanView
          leadsByStatus={list.leadsByStatus}
          pipeline={pipelineSimple}
          meta={list.meta}
          onSelectLead={setSelectedId}
          onMoveStatus={(id, status) => mutations.moveStatus.mutate({ id, status })}
          waTemplate={waTemplate}
          onBatch={handleBatch}
          batchPending={mutations.batch.isPending}
          cadences={cad.cadences}
          onSaveAsView={handleSaveAsView}
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

      {/* Modal salvar lente (Fase 5) */}
      <SaveViewModal
        visible={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        filters={list.filters}
        activeFilterCount={list.activeFilterCount}
        onSave={handleSaveView}
        isSaving={views.create.isPending}
      />
    </View>
  );
}
