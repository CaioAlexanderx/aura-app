// ============================================================
// Regras da conferência dos nomes de cor (CP5 da revisão de cores, 14/11/2026)
//
// Decisões do Caio (14/11):
//   1. até a lojista confirmar, o nome cortado sai como o da paleta;
//   4. "Confirmar todas" só leva sugestão ÚNICA DA PALETA (nome cortado);
//   5. nome inteiro em maiúsculas: só sugerir a caixa de frase, nunca mudar
//      sozinho — fica para ela confirmar um por um;
//   8. dentro do Estoque, aviso + modal, sem mod próprio.
// Nada é gravado sem o toque dela: a tela manda item a item o que ela
// confirmou, e o backend grava só isso.
// ============================================================
import type { GrupoParaConferir } from "@/services/coresParaConferirApi";
import { nomeGravadoParaEtiqueta } from "@/utils/nomeDaCor";
import { hexToName } from "@/utils/colorNames";

/** O nome que o campo começa mostrando: a sugestão, ou nada. */
export function nomeInicial(g: GrupoParaConferir): string {
  return g.sugestao ? g.sugestao.nome : "";
}

/** Texto da origem da sugestão, para ela saber de onde veio. */
export function deOndeVem(g: GrupoParaConferir): string {
  if (g.sugestao && g.sugestao.fonte === "loja") return "um nome que você já usa em outro produto";
  if (g.sugestao && g.sugestao.fonte === "paleta") return g.tipo === "cortado" ? "o único nome da paleta que começa assim" : "o mesmo nome da paleta, sem as maiúsculas";
  if (g.sugestao && g.sugestao.fonte === "caixa_de_frase") return "o mesmo nome, só sem as maiúsculas";
  if (g.opcoes.length > 1) return "mais de um nome começa assim — escolha um";
  return "nada na loja nem na paleta começa assim — escreva o nome inteiro";
}

/** O que "Confirmar todas" leva: só as sugestões únicas da paleta, ainda não feitas. */
export function gruposDoConfirmarTodas(grupos: GrupoParaConferir[], feitos: ReadonlySet<string>): GrupoParaConferir[] {
  return grupos.filter((g) => g.unica_da_paleta && !!g.sugestao && !feitos.has(g.chave));
}

/** O corpo do POST para um grupo: um item por produto e cor, com o nome dela. */
export function itensParaGravar(g: GrupoParaConferir, nome: string): Array<{ product_id: string; hex: string; nome: string }> {
  const n = String(nome || "").trim();
  if (!n) return [];
  return g.itens.map((i) => ({ product_id: i.product_id, hex: i.hex, nome: n }));
}

/** A etiqueta de hoje e depois da confirmação (a regra da etiqueta, intocada). */
export function etiquetaHojeEDepois(g: GrupoParaConferir, nome: string): { hoje: string; depois: string } {
  const doGravado = g.tipo === "maiusculo" ? nomeGravadoParaEtiqueta(g.pedaco) : null;
  const hoje = doGravado || hexToName(g.hex) || g.hex;
  const depois = nomeGravadoParaEtiqueta(String(nome || "").trim()) || hexToName(g.hex) || g.hex;
  return { hoje, depois };
}
