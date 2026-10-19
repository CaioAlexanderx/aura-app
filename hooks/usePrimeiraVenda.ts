// ============================================================
// AURA. — "Fazer a primeira venda" no Painel de conta nova (19/10/2026, tq-32)
//
// Botão PRINCIPAL do estado vazio de conta nova (EmptyDashboard). Destino
// pela mesma função do Continuar do check-in (destinoDaPrimeiraVenda, tq-31):
// sem produto, o cadastro do primeiro produto e, ao salvar, o Caixa; com
// produto, direto ao Caixa.
//
// Some depois da primeira venda pelo sinal que o aviso do trial já usa
// (company.trial.started_by_sale_at, app#1065 → vendeuNoTrial). Conta em
// modo fixo (código de acesso, convite) não tem esse sinal: ali quem tira o
// botão da tela é o próprio estado vazio, que só aparece com o mês zerado e
// sem histórico (classifyEmptyDashboard).
//
// Não aparece na visão consolidada (a venda é de uma loja), em demo, nem
// sem o Caixa visível (plano/permissão: o que o plano não tem some).
// ============================================================
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/stores/auth";
import { useVisibleModules } from "@/hooks/useVisibleModules";
import { garantirTemProduto, useTemProduto } from "@/hooks/useTemProduto";
import { destinoDaPrimeiraVenda } from "@/utils/checkinDestino";
import { lerTrial, vendeuNoTrial } from "@/utils/trialAviso";

export type PrimeiraVenda = { mostrar: boolean; ir: () => Promise<void> };

/** Regra pura: o botão aparece? */
export function mostrarPrimeiraVenda(args: {
  temEmpresa: boolean;
  consolidado: boolean;
  isDemo: boolean;
  caixaVisivel: boolean;
  trial: unknown;
}): boolean {
  if (!args.temEmpresa || args.consolidado || args.isDemo || !args.caixaVisivel) return false;
  return !vendeuNoTrial(lerTrial(args.trial));
}

/** @param ativo false = nem consulta (o Painel não está no estado de conta nova). */
export function usePrimeiraVenda(ativo: boolean = true): PrimeiraVenda {
  const router = useRouter();
  const qc = useQueryClient();
  const company = useAuthStore((s) => s.company);
  const consolidado = useAuthStore((s) => s.consolidatedView);
  const isDemo = useAuthStore((s) => s.isDemo);
  const modulos = useVisibleModules();
  const cid = company?.id || null;

  const mostrar = ativo && mostrarPrimeiraVenda({
    temEmpresa: !!cid,
    consolidado: !!consolidado,
    isDemo: !!isDemo,
    caixaVisivel: modulos.has("pdv"),
    trial: (company as any)?.trial,
  });
  // Pergunta já com o Painel aberto: o toque não espera a rede.
  const temProdutoQ = useTemProduto(cid, mostrar);

  const ir = useCallback(async () => {
    let temProduto = temProdutoQ.data ?? null;
    if (temProduto === null && cid) temProduto = await garantirTemProduto(qc, cid);
    const destino = destinoDaPrimeiraVenda({ modulos, temProduto });
    router.push(destino.rota as any);
  }, [temProdutoQ.data, cid, qc, modulos, router]);

  return { mostrar, ir };
}
