import { useCallback, useMemo } from "react";
import { request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";

// ============================================================
// useFoodApi — Helper centralizado pra chamadas ao backend food.
//
// Constrói path /companies/:id/food<suffix> usando a empresa do
// useAuthStore. Reusa `request` de services/api (com retry, refresh
// de token, ApiError, etc.).
//
// Fase 0: estrutura mínima — endpoints concretos vão sendo adicionados
// em cada fase do BACKLOG_AURA_FOOD.md.
//
// Uso:
//   const { api, ready } = useFoodApi();
//   if (!ready) return null;
//   const tables = await api.get("/tables");
//   await api.post("/orders", { table_id, items });
// ============================================================

export function useFoodApi() {
  const { company } = useAuthStore();
  const companyId = company?.id;

  const path = useCallback(
    (suffix: string) => {
      if (!companyId) throw new Error("Sem empresa selecionada");
      return "/companies/" + companyId + "/food" + suffix;
    },
    [companyId]
  );

  const api = useMemo(() => ({
    get:   <T,>(suffix: string)                => request<T>(path(suffix)),
    post:  <T,>(suffix: string, body: unknown) => request<T>(path(suffix), { method: "POST",   body }),
    patch: <T,>(suffix: string, body: unknown) => request<T>(path(suffix), { method: "PATCH",  body }),
    put:   <T,>(suffix: string, body: unknown) => request<T>(path(suffix), { method: "PUT",    body }),
    del:   <T,>(suffix: string)                => request<T>(path(suffix), { method: "DELETE" }),
  }), [path]);

  return { api, companyId, ready: !!companyId };
}
