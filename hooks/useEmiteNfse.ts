// ============================================================
// AURA. — A empresa emite NFS-e? (nfse_config.is_active)
//
// Critério (decisão do dono, 10/11/2026): a seção "Nota de serviço
// (NFS-e)" do cadastro e o selo/filtro do Estoque só existem para quem
// emite NFS-e — a empresa tem nfse_config ativa (GET
// /companies/:id/nfse/config → config.is_active, src/routes/nfse.js do
// backend). Para as outras, somem: sem isca, sem convite.
//
// Multi-CNPJ: na visão consolidada vale se AO MENOS UMA loja do grupo
// emite (uma consulta por loja, em paralelo, num cache só; loja que falha
// conta como "não emite").
//
// Uma loja: mesma chave e formato do NfseDashboard (['nfse-config', cid]
// → { config, has_config }), então as duas telas dividem o cache.
// Só liga quando `ativo`: o Estoque só pergunta quando há serviço na lista
// e o cadastro só quando o item é um serviço — loja só de produtos não faz
// requisição nova nenhuma.
// ============================================================
import { useQuery } from "@tanstack/react-query";
import { request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";

type RespostaConfig = { config: { is_active?: boolean } | null; has_config?: boolean };

function buscarConfig(cid: string): Promise<RespostaConfig> {
  return request<RespostaConfig>(`/companies/${cid}/nfse/config`);
}

export function useEmiteNfse(ativo: boolean): boolean {
  const { company, consolidatedView, availableCompanies } = useAuthStore();
  const cid = company?.id;
  const idsDoGrupo = consolidatedView
    ? Array.from(new Set((availableCompanies || []).map((c: any) => String(c.id)).filter(Boolean))).sort()
    : [];

  const umaLoja = useQuery({
    queryKey: ["nfse-config", cid],
    queryFn: () => buscarConfig(cid!),
    enabled: !!cid && ativo && !consolidatedView,
    staleTime: 300_000,
    retry: 1,
  });

  const grupo = useQuery({
    queryKey: ["nfse-config-grupo", idsDoGrupo.join(",")],
    queryFn: async () => {
      const r = await Promise.all(idsDoGrupo.map((id) =>
        buscarConfig(id).then((d) => !!d?.config?.is_active).catch(() => false)
      ));
      return r.some(Boolean);
    },
    enabled: ativo && !!consolidatedView && idsDoGrupo.length > 0,
    staleTime: 300_000,
    retry: 1,
  });

  if (consolidatedView) return grupo.data === true;
  return !!(umaLoja.data as any)?.config?.is_active;
}
