// ============================================================
// Canal digital · o que vai no salvamento em lote
//
// A tela "Deixar a loja pronta" mostra N peças com o mesmo campo vazio e
// deixa a lojista preencher todas antes de salvar uma vez só. Este módulo
// é a parte que decide O QUE SOBE — e existe separado da tela porque a
// regra é testável e a tela não.
//
// COMO ESCREVER AQUI: os nomes de campo do backend (`description`,
// `size`, `brand`) só aparecem no mapa abaixo. Do resto da tela pra cá é
// tudo `descricao`/`tamanho`/`marca`, que é como a lojista pensa.
// ============================================================

/** Campos que a lojista digita. Foto e segunda foto são upload. */
export type CampoEditavel = "descricao" | "tamanho" | "marca";

export const COLUNA_DO_CAMPO: Record<CampoEditavel, "description" | "size" | "brand"> = {
  descricao: "description",
  tamanho: "size",
  marca: "brand",
};

export const EDITAVEIS: CampoEditavel[] = ["descricao", "tamanho", "marca"];

export function ehEditavel(campo: string): campo is CampoEditavel {
  return (EDITAVEIS as string[]).includes(campo);
}

export type Rascunho = Record<string, string>;

export type ItemDoLote = { id: string } & Partial<
  Record<"description" | "size" | "brand", string>
>;

/**
 * Transforma o rascunho da tela no corpo do PATCH.
 *
 * SÓ SOBE O QUE FOI PREENCHIDO. O backend trata string vazia como "limpa
 * a coluna" — mandar o rascunho inteiro escreveria vazio em cima de peça
 * que a lojista nem tocou. Aqui ela está PREENCHENDO buraco; apagar é
 * outra tela, com outra intenção.
 */
export function montarLote(rascunho: Rascunho, campo: CampoEditavel): ItemDoLote[] {
  const coluna = COLUNA_DO_CAMPO[campo];
  const itens: ItemDoLote[] = [];
  for (const [id, bruto] of Object.entries(rascunho || {})) {
    if (!id) continue;
    const valor = typeof bruto === "string" ? bruto.trim() : "";
    if (!valor) continue;
    itens.push({ id, [coluna]: valor } as ItemDoLote);
  }
  return itens;
}

/** Quantas peças serão salvas — o número que vai no botão. */
export function quantasVaoSubir(rascunho: Rascunho): number {
  return Object.values(rascunho || {}).filter(
    (v) => typeof v === "string" && v.trim() !== ""
  ).length;
}

/**
 * "Aplicar em todas": o atalho que torna marca e tamanho viáveis.
 *
 * NÃO sobrescreve o que já foi digitado. A lojista que ajustou três peças
 * à mão e depois clica em aplicar quer preencher o RESTO, não perder o
 * trabalho — e não teria como desfazer.
 */
export function aplicarEmTodos(ids: string[], valor: string, rascunho: Rascunho): Rascunho {
  const v = String(valor || "").trim();
  if (!v) return rascunho;
  const saida: Rascunho = { ...rascunho };
  for (const id of ids) {
    const atual = saida[id];
    if (typeof atual === "string" && atual.trim() !== "") continue;
    saida[id] = v;
  }
  return saida;
}

/** Texto do campo, na voz de quem vai preencher. */
/**
 * O texto de cada campo. `emMassa` e escrito por extenso, e nao montado
 * com `Mesmo ${rotulo}`: em portugues o adjetivo concorda com o genero
 * do substantivo, e o template produzia "Mesmo marca para todas".
 */
export const AJUDA: Record<CampoEditavel, { rotulo: string; dica: string; emMassa: string; multilinha: boolean; max: number }> = {
  descricao: {
    rotulo: "Descrição",
    dica: "Diga o que a cliente não vê na foto: caimento, tecido, comprimento.",
    emMassa: "Mesma descrição para todas",
    multilinha: true,
    max: 1200,
  },
  tamanho: {
    rotulo: "Tamanho",
    dica: "Sem tamanho, a peça não aparece quando a cliente filtra por tamanho.",
    emMassa: "Mesmo tamanho para todas",
    multilinha: false,
    max: 24,
  },
  marca: {
    rotulo: "Marca",
    dica: "Aparece no cartão da peça. Se for tudo da sua marca, use “aplicar em todas”.",
    emMassa: "Mesma marca para todas",
    multilinha: false,
    max: 80,
  },
};
