// ============================================================
// AURA. — Regras da tela "Como você quer trazer seus produtos?" (tq-34)
//
// Funções puras: a etiqueta "Sugerido", a mensagem pronta do "Quero ajuda"
// e o destino de cada opção. Sem React, sem rede.
//
//   Um por um  → cadastro do produto (o mesmo destino de hoje); com Caixa no
//                plano, ao salvar segue ao Caixa (`depois=pdv`)
//   Quero ajuda→ wa.me da Aura com mensagem pronta (constants/suporteAura,
//                o mesmo da importação assistida) e, na mesma hora, o
//                cadastro um por um: começa pelo primeiro produto enquanto
//                o resto chega
//   Planilha   → convite "Importar sua planilha" do Estoque
// ============================================================
import type { CheckinRespostas } from "@/services/checkinApi";
import { waAura } from "@/constants/suporteAura";
import {
  ROTA_IMPORTAR_PLANILHA, ROTA_NOVO_PRODUTO, ROTA_NOVO_PRODUTO_E_CAIXA, caminhoDoEstoque,
} from "@/utils/checkinDestino";

/**
 * A etiqueta "Sugerido para 51 a 300 produtos" aparece no "Quero ajuda"?
 * Só quando o check-in respondeu 51 a 300 ou "Caderno" — e o caminho do
 * estoque é mesmo o do meio ("Caderno" com mais de 300 é importação
 * assistida, não esta faixa).
 */
export function mostrarSugerido(respostas: CheckinRespostas | null | undefined): boolean {
  if (!respostas) return false;
  const faixa = respostas.produtos_faixa || "";
  const anota = respostas.onde_anota || "";
  if (faixa !== "de_51_a_300" && anota !== "caderno") return false;
  return caminhoDoEstoque(respostas) === "medio";
}

/** Texto pronto do "Quero ajuda". Sem nome da loja, "minha loja". */
export function mensagemQueroAjuda(
  loja: string | null | undefined,
  respostas: CheckinRespostas | null | undefined,
): string {
  const nome = String(loja || "").trim() || "minha loja";
  const r = respostas || {};
  const partes: string[] = [];
  if (r.produtos_faixa === "de_51_a_300") partes.push("tenho de 51 a 300 produtos");
  if (r.onde_anota === "caderno") partes.push("anoto no caderno");
  const detalhe = partes.length ? " (" + partes.join(" e ") + ")" : "";
  return "Oi! Acabei de criar a conta da " + nome + " na Aura e quero ajuda para trazer meus produtos"
    + detalhe + ". Vou mandar a foto do caderno ou a planilha por aqui.";
}

/** "Um por um": o cadastro de produto; com Caixa, ao salvar segue ao Caixa. */
export function rotaUmPorUm(modulos: ReadonlySet<string>): string {
  return modulos.has("pdv") ? ROTA_NOVO_PRODUTO_E_CAIXA : ROTA_NOVO_PRODUTO;
}

export type AcaoTrazerProdutos = {
  /** Rota do app aberta no toque. */
  rota: string;
  /** wa.me aberto no mesmo toque (antes da navegação). */
  whatsapp?: string;
};

export function acaoUmPorUm(modulos: ReadonlySet<string>): AcaoTrazerProdutos {
  return { rota: rotaUmPorUm(modulos) };
}

export function acaoQueroAjuda(
  modulos: ReadonlySet<string>,
  loja: string | null | undefined,
  respostas: CheckinRespostas | null | undefined,
): AcaoTrazerProdutos {
  return { rota: rotaUmPorUm(modulos), whatsapp: waAura(mensagemQueroAjuda(loja, respostas)) };
}

export function acaoPlanilha(): AcaoTrazerProdutos {
  return { rota: ROTA_IMPORTAR_PLANILHA };
}
