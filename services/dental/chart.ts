// ============================================================
// AURA. — services/dental/chart.ts
//
// Hook canonico do estado do odontograma de um paciente.
// PR42 F4 (2026-05-09): centraliza GET/POST/DELETE de
// dental_chart_entries num unico lugar pra todos os consumers
// (ConsultaOdontogramaPanel, OdontogramaTab, OdontogramaScreen
// standalone, ToothInspector etc).
//
// Backend retorna { teeth: ToothState[] } — array por dente com
// tres eixos pre-agrupados (condition / planned / completed).
// Schema: vide migration 081 (dental_chart_3_axes).
// ============================================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import {
  type ChartEntry,
  type ToothState,
  emptyToothState,
} from "@/components/verticals/odonto/Odontograma2D";

// ─── Query keys ────────────────────────────────────────────

export function dentalChartKey(companyId: string | undefined, patientId: string | null | undefined) {
  return ["dental-chart", companyId, patientId] as const;
}

// ─── Helpers exportaveis ──────────────────────────────────

/**
 * Encontra o ToothState de um dente especifico no chart.
 * Se o dente ainda nao tem entries, retorna o estado vazio (todos arrays vazios).
 */
export function getToothStateFromChart(chart: ToothState[], toothNumber: number): ToothState {
  return chart.find((t) => t.tooth === toothNumber) || emptyToothState(toothNumber);
}

// ─── Hook principal ──────────────────────────────────────

export interface UseDentalChartResult {
  chart: ToothState[];
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  refetch: () => void;
  /** Cria uma nova entry. Resolve depois do POST + invalidate. */
  addEntry: (entry: Omit<ChartEntry, "id" | "recorded_at">) => Promise<unknown>;
  /** Remove entry por id. Resolve depois do DELETE + invalidate. */
  removeEntry: (entryId: string) => Promise<unknown>;
  /** True enquanto a mutation de add esta pending. */
  isAdding: boolean;
  /** True enquanto a mutation de remove esta pending. */
  isRemoving: boolean;
  /** Helper pra extrair o estado de um dente especifico. */
  toothStateFor: (toothNumber: number) => ToothState;
}

/**
 * Hook canonico para ler e mutar o odontograma de um paciente.
 *
 * Exemplo de uso:
 * ```tsx
 * const { chart, toothStateFor, addEntry, removeEntry, isAdding } =
 *   useDentalChart(patient.id);
 * const state = toothStateFor(selectedTooth);
 * <ToothInspector
 *   toothNumber={selectedTooth}
 *   state={state}
 *   onAdd={addEntry}
 *   onRemove={removeEntry}
 *   isAdding={isAdding}
 * />
 * ```
 */
export function useDentalChart(patientId: string | null | undefined): UseDentalChartResult {
  const cid = useAuthStore().company?.id;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: dentalChartKey(cid, patientId),
    queryFn: () =>
      request(`/companies/${cid}/dental/patients/${patientId}/chart`),
    enabled: !!cid && !!patientId,
    staleTime: 15_000,
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: dentalChartKey(cid, patientId) });
  }

  const addMut = useMutation({
    mutationFn: (entry: Omit<ChartEntry, "id" | "recorded_at">) =>
      request(`/companies/${cid}/dental/patients/${patientId}/chart`, {
        method: "POST",
        body: entry as any,
      }),
    onSuccess: invalidate,
  });

  const removeMut = useMutation({
    mutationFn: (entryId: string) =>
      request(
        `/companies/${cid}/dental/patients/${patientId}/chart/${entryId}`,
        { method: "DELETE" }
      ),
    onSuccess: invalidate,
  });

  const chart: ToothState[] = (query.data as any)?.teeth || [];

  return {
    chart,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: () => query.refetch(),
    addEntry: addMut.mutateAsync,
    removeEntry: removeMut.mutateAsync,
    isAdding: addMut.isPending,
    isRemoving: removeMut.isPending,
    toothStateFor: (toothNumber: number) =>
      getToothStateFromChart(chart, toothNumber),
  };
}

export default useDentalChart;
