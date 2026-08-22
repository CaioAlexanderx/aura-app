// ============================================================
// AURA STUDIO · vitrine — ordenação e densidade da grade (fase 03)
//
// Regra do plano: filtros e densidade valem quando a loja passa de ~20
// itens. Antes disso atrapalham — numa loja de 9 produtos a barra de
// controle é mais alta que a vitrine.
//
// Por isso o limiar mora AQUI e não espalhado em `length > 20` pela tela:
// é uma decisão de produto, e quando ela mudar tem que mudar num lugar só.
// ============================================================

/** A partir de quantos itens a barra de controle se paga. */
export const LIMIAR_CONTROLES = 20;

export type OrdemVitrine = "destaque" | "novidades" | "preco_asc" | "preco_desc" | "nome";

export const ORDENS: Array<{ chave: OrdemVitrine; rotulo: string }> = [
  { chave: "destaque", rotulo: "Destaque" },
  { chave: "novidades", rotulo: "Novidades" },
  { chave: "preco_asc", rotulo: "Menor preço" },
  { chave: "preco_desc", rotulo: "Maior preço" },
  { chave: "nome", rotulo: "Nome (A-Z)" },
];

export function mostrarControles(quantidade: number): boolean {
  return quantidade >= LIMIAR_CONTROLES;
}

/**
 * Ordena as ENTRADAS da vitrine, não os produtos crus.
 *
 * Uma entrada pode ser um grupo ("Camisetas · 3 modelos"), e aí o preço
 * que vale é o menor do grupo e a data é a do modelo mais recente —
 * senão o grupo afundaria no fim de "Menor preço" e de "Novidades" só
 * porque o primeiro modelo dele é velho ou caro.
 */
export type EntradaOrdenavel = {
  nome: string;
  preco: number;
  criadoEm?: string | null;
};

export function ordenarEntradas<T extends EntradaOrdenavel>(lista: T[], ordem: OrdemVitrine): T[] {
  // Nunca ordena no lugar: `sf.vitrine` é memoizado e mutá-lo faz a
  // ordem "vazar" para o próximo render com outro filtro.
  const l = lista.slice();

  switch (ordem) {
    case "preco_asc":
      return l.sort((a, b) => a.preco - b.preco);
    case "preco_desc":
      return l.sort((a, b) => b.preco - a.preco);
    case "nome":
      // localeCompare com pt-BR: sem isso "Água" cai depois de "Zebra".
      return l.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    case "novidades":
      return l.sort((a, b) => String(b.criadoEm || "").localeCompare(String(a.criadoEm || "")));
    case "destaque":
    default:
      // A ordem que o servidor mandou já é a curadoria da lojista.
      return l;
  }
}

/**
 * Colunas da grade.
 *
 * "Densidade" no plano do Oscar é o cliente escolher 3 ou 4 colunas. Aqui
 * a escolha é RELATIVA ao que a largura comporta: numa tela de celular
 * "mais colunas" tem que continuar legível, então o passo é de um só e o
 * piso é 2.
 */
export function colunasComDensidade(base: number, denso: boolean): number {
  return denso ? Math.min(base + 1, 6) : Math.max(base, 2);
}
