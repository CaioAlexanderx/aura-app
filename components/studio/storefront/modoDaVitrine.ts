// ============================================================
// components/studio/storefront/modoDaVitrine.ts
//
// O que muda na vitrine quando a loja fecha para pedidos.
//
// ── A IDEIA ────────────────────────────────────────────────────────────
// Em dezembro a lojista vende o que não consegue produzir. A saída que
// ela tinha era despublicar a loja — e junto ia a vitrine, o Instagram
// e o orçamento que ela produziria em janeiro.
//
// Fechar não pode apagar a loja. Produtos, fotos, preço e mockup 3D
// continuam inteiros; o que muda é o BOTÃO: "Comprar agora" vira "Pedir
// orçamento", e o carrinho sai de cena.
//
// ── A REGRA ────────────────────────────────────────────────────────────
// Quem decide é o servidor (`store.pedidos`), não esta tela: a mesma
// decisão precisa valer no POST do pedido, senão uma página aberta antes
// de a lojista fechar continuaria enviando.
//
// Payload antigo — cache do navegador, backend anterior — não tem o
// campo. Sem ele, a loja aceita: é como sempre foi, e o erro seguro aqui
// é deixar vender, nunca travar uma loja que está aberta.
// ============================================================

export type ModoDaVitrine = {
  /** A loja aceita pedido agora? */
  aceita: boolean;
  /** O que dizer à cliente. Vazio quando a loja está aberta. */
  recado: string;
  /** O rótulo do botão principal do produto. */
  rotuloDoBotao: string;
  /** Até quando ela aceita, quando há data. */
  ate: string | null;
};

/** "2026-12-20" → "20/12". O ano só aparece quando não é o corrente. */
export function dataCurta(iso: string | null | undefined, hoje: Date = new Date()): string {
  const s = typeof iso === "string" ? iso.trim() : "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return "";
  const [, ano, mes, dia] = m;
  return Number(ano) === hoje.getFullYear() ? `${dia}/${mes}` : `${dia}/${mes}/${ano}`;
}

export function modoDaVitrine(store: any, hoje: Date = new Date()): ModoDaVitrine {
  const p = store?.pedidos;

  // Sem o campo, a loja aceita — payload antigo não pode fechar uma loja.
  if (!p || typeof p !== "object" || p.aceita !== false) {
    return { aceita: true, recado: "", rotuloDoBotao: "Comprar agora", ate: null };
  }

  const recado = typeof p.recado === "string" && p.recado.trim()
    ? p.recado.trim()
    // Rede de segurança: o servidor sempre manda recado, mas uma loja sem
    // botão de comprar e sem explicação parece quebrada.
    : "No momento a loja não está aceitando pedidos novos. Peça um orçamento e a loja responde com prazo.";

  return {
    aceita: false,
    recado,
    rotuloDoBotao: "Pedir orçamento",
    ate: typeof p.pedidos_ate === "string" ? p.pedidos_ate : null,
  };
}

/**
 * O aviso que a loja mostra no topo enquanto ainda aceita pedidos.
 *
 * Só aparece quando falta pouco: "aceito até 20/12" em setembro não
 * informa, ocupa. Perto da data, é o que faz a cliente decidir hoje.
 */
export const DIAS_PARA_AVISAR = 21;

export function avisoDePrazo(store: any, hoje: Date = new Date()): string | null {
  const p = store?.pedidos;
  if (!p || p.aceita === false) return null;

  const ate = typeof p.pedidos_ate === "string" ? p.pedidos_ate : null;
  if (!ate) return null;

  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ate);
  if (!m) return null;
  const alvo = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const agora = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const dias = Math.round((alvo - agora) / 86400000);

  if (dias < 0 || dias > DIAS_PARA_AVISAR) return null;
  if (dias === 0) return "Último dia para pedir com entrega nesta temporada.";
  if (dias === 1) return "Amanhã é o último dia para pedir nesta temporada.";
  return `Pedidos até ${dataCurta(ate, hoje)} — depois disso, só orçamento.`;
}
