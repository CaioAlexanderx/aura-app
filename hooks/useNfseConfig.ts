// ============================================================
// AURA. — Configuração da NFS-e de UMA loja (10/11/2026)
//
// Contratos do backend (PR "configuração da loja passo a passo", migration
// 440, src/routes/nfse.js e src/routes/nfseAutomatica.js):
//   GET  /companies/:id/nfse/config            → { config, has_config, nacional? }
//   PUT  /companies/:id/nfse/config            → grava; is_active=true só com
//        a nota de teste aceita (409 NAO_PODE_LIGAR) e com a produção
//        liberada no servidor (409 PRODUCAO_NAO_LIBERADA)
//   POST /companies/:id/nfse/teste             → { resultado, nota, nacional }
//   GET  /companies/:id/nfse/automatica/config → { ligada_no_servidor, emissao_automatica, ... }
//   PUT  /companies/:id/nfse/automatica/config { emissao_automatica }
//
// Mesma chave de cache do useEmiteNfse (['nfse-config', cid]): ligar a
// NFS-e aqui já faz a seção "Nota de serviço" aparecer no cadastro.
// Multi-CNPJ: tudo recebe o id da loja; o grupo usa useNfseConfigDoGrupo.
// ============================================================
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "@/services/api";
import type { RespostaConfigNfse, ResultadoTeste, SituacaoNfse } from "@/utils/nfseProntoParaEmitir";

export type RespostaAutomatica = {
  ligada_no_servidor: boolean;
  tem_config?: boolean;
  provider?: string | null;
  emissao_automatica: boolean;
  emissao_automatica_desde?: string | null;
  ativa?: boolean;
};

export type RespostaTeste = {
  resultado: ResultadoTeste;
  nota: { nfse_id: string; status: string; dps_serie?: string; dps_number?: string } | null;
  replay?: boolean;
  nacional?: SituacaoNfse | null;
};

export const chaveConfigNfse = (cid: string | null | undefined) => ["nfse-config", cid];
export const chaveAutomaticaNfse = (cid: string | null | undefined) => ["nfse-automatica-config", cid];

export const nfseConfigApi = {
  ler: (cid: string) => request<RespostaConfigNfse>(`/companies/${cid}/nfse/config`),
  salvar: (cid: string, body: Record<string, unknown>) =>
    request<{ ok: boolean; config_id: string }>(`/companies/${cid}/nfse/config`, { method: "PUT", body, retry: 0 }),
  // A nota de teste fala com o gov.br (pode levar alguns segundos e tem
  // retentativa no servidor). Sem retry aqui: a chave é a mesma, então
  // apertar de novo é seguro e retoma o mesmo número.
  emitirTeste: (cid: string, idempotencyKey: string) =>
    request<RespostaTeste>(`/companies/${cid}/nfse/teste`, {
      method: "POST", body: { idempotency_key: idempotencyKey }, retry: 0, timeout: 60000,
    }),
  lerAutomatica: (cid: string) => request<RespostaAutomatica>(`/companies/${cid}/nfse/automatica/config`),
  salvarAutomatica: (cid: string, emissao_automatica: boolean) =>
    request<{ ok: boolean; emissao_automatica: boolean }>(`/companies/${cid}/nfse/automatica/config`, {
      method: "PUT", body: { emissao_automatica }, retry: 0,
    }),
};

export function useNfseConfig(cid: string | null | undefined, ativo = true) {
  const qc = useQueryClient();
  const config = useQuery({
    queryKey: chaveConfigNfse(cid),
    queryFn: () => nfseConfigApi.ler(cid!),
    enabled: !!cid && ativo,
    staleTime: 30_000,
    retry: 1,
  });
  const automatica = useQuery({
    queryKey: chaveAutomaticaNfse(cid),
    queryFn: () => nfseConfigApi.lerAutomatica(cid!),
    enabled: !!cid && ativo,
    staleTime: 60_000,
    retry: 1,
  });
  function recarregar() {
    qc.invalidateQueries({ queryKey: chaveConfigNfse(cid) });
    qc.invalidateQueries({ queryKey: chaveAutomaticaNfse(cid) });
    qc.invalidateQueries({ queryKey: ["nfse-config-grupo"] });
    qc.invalidateQueries({ queryKey: ["nfse-lojas-do-grupo"] });
  }
  return { config, automatica, recarregar };
}

export type LojaDoGrupo = {
  id: string;
  nome: string;
  cnpj: string;
  resposta: RespostaConfigNfse | null;
  automatica: boolean;
  erro: boolean;
};

/** Uma consulta por loja, em paralelo; loja que falha aparece com erro, sem derrubar as outras. */
export function useNfseConfigDoGrupo(lojas: { id: string; nome: string; cnpj: string }[], ativo: boolean) {
  const ids = lojas.map((l) => l.id).sort().join(",");
  return useQuery({
    queryKey: ["nfse-lojas-do-grupo", ids],
    queryFn: async (): Promise<LojaDoGrupo[]> => Promise.all(lojas.map(async (l) => {
      try {
        const [resposta, auto] = await Promise.all([
          nfseConfigApi.ler(l.id),
          nfseConfigApi.lerAutomatica(l.id).catch(() => null),
        ]);
        return { ...l, resposta, automatica: !!(auto && auto.emissao_automatica), erro: false };
      } catch {
        return { ...l, resposta: null, automatica: false, erro: true };
      }
    })),
    enabled: ativo && lojas.length > 0,
    staleTime: 30_000,
    retry: 1,
  });
}
