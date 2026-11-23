// ============================================================
// useModelosDeMensagem — modelos do Cobrar da loja ativa (21/11/2026)
//
// Modelo é da LOJA (company_id). No consolidado multi-CNPJ, quem chama
// passa o companyId da loja da cobrança; a chave da query leva o id, então
// trocar de loja nunca mostra o modelo da outra.
//
// Se a rota falhar (rede, backend sem a 462), o Cobrar segue com os prontos
// da Aura embutidos no app (utils/crediarioMensagem.MODELOS_DA_AURA): a
// prévia nunca fica sem texto. `reserva` diz que é isso que está na tela.
// ============================================================
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { creditApi, type MessageTemplatesList } from "@/services/creditApi";
import { MODELOS_DA_AURA, type ModeloDeMensagem, type Situacao } from "@/utils/crediarioMensagem";

export const chaveDosModelos = (companyId?: string | null) => ["credit-msg-templates", companyId || null];

export type NovoModelo = { name: string; body: string; situation?: Situacao | null; replaces_aura?: string | null };

export function useModelosDeMensagem(companyId?: string | null) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: chaveDosModelos(companyId),
    queryFn: () => creditApi.listMessageTemplates(companyId as string),
    enabled: !!companyId,
    staleTime: 60_000,
    retry: 1,
  });

  const lista: MessageTemplatesList | undefined =
    q.data && Array.isArray(q.data.templates) && q.data.templates.length ? q.data : undefined;
  const modelos: ModeloDeMensagem[] = lista ? lista.templates : MODELOS_DA_AURA;
  const daAura = !lista || lista.source !== "loja";
  const limite = (lista && lista.limit) || 10;

  const guardar = useCallback((res: MessageTemplatesList | undefined | null) => {
    if (res && Array.isArray(res.templates)) {
      qc.setQueryData(chaveDosModelos(companyId), {
        source: res.source, templates: res.templates, limit: res.limit, max_body: res.max_body, variables: res.variables,
      });
    } else {
      qc.invalidateQueries({ queryKey: chaveDosModelos(companyId) });
    }
  }, [qc, companyId]);

  const criar = useCallback(async (novo: NovoModelo) => {
    const res = await creditApi.createMessageTemplate(companyId as string, novo);
    guardar(res);
    return res.template;
  }, [companyId, guardar]);

  const atualizar = useCallback(async (id: string, patch: { name?: string; body?: string; situation?: Situacao | null }) => {
    const res = await creditApi.updateMessageTemplate(companyId as string, id, patch);
    guardar(res);
    return res.template;
  }, [companyId, guardar]);

  const definirPadrao = useCallback(async (id: string, situation: Situacao | null) => {
    const res = await creditApi.setDefaultMessageTemplate(companyId as string, id, situation);
    guardar(res);
    return res.template;
  }, [companyId, guardar]);

  const excluir = useCallback(async (id: string) => {
    const res = await creditApi.deleteMessageTemplate(companyId as string, id);
    guardar(res);
  }, [companyId, guardar]);

  return {
    modelos,
    daAura,
    limite,
    carregando: q.isLoading,
    reserva: q.isError,
    criar, atualizar, definirPadrao, excluir,
  };
}

/**
 * Salvar a partir de um modelo: atualizar o da loja, ou — se for um pronto
 * da Aura — gravar a cópia que toma o lugar dele (replaces_aura).
 */
export async function salvarSobre(
  api: Pick<ReturnType<typeof useModelosDeMensagem>, "criar" | "atualizar">,
  modelo: ModeloDeMensagem,
  dados: { name: string; body: string; situation: Situacao | null },
): Promise<ModeloDeMensagem> {
  if (modelo.origin === "aura") {
    return api.criar({ ...dados, replaces_aura: modelo.aura_key || modelo.id.replace(/^aura:/, "") });
  }
  return api.atualizar(modelo.id, dados);
}
