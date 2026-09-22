// ============================================================================
// AURA. — CEST sugerido a partir do NCM (Matcon M2, docs/CONTRACT_MATCON.md §M2)
//
// AVISO: esta tabela cobre só as famílias de materiais de construção do
// Matcon (cimento, argamassa, tinta/verniz, revestimento cerâmico, tubo/
// conexão de PVC, fio/cabo, ferragem/fechadura, telha de fibrocimento,
// tijolo/bloco cerâmico) e foi CONFERIDA PARCIALMENTE contra a tabela CEST
// do Convênio ICMS 142/18. A tela só SUGERE — aceitar o código é decisão
// do lojista. Confira com o contador antes do piloto.
//
// Zero jargão na tela (regra do CLAUDE.md): este módulo fala em "código
// fiscal do produto (CEST)" e "imposto recolhido"; CSOSN/CST/ST/CFOP nunca
// aparecem em texto de usuário — eles só existem no backend, na emissão.
// ============================================================================

export type CestFamilyRow = {
  /** Prefixo do NCM (sem pontuação) que identifica a família. */
  prefix: string;
  /** CEST sugerido, 7 dígitos sem pontuação. */
  cest: string;
  /** Nome curto da família, usado na frase da tela ("Pelo NCM ...: cimento"). */
  family: string;
  /** Famílias desta tabela costumam vir com o ICMS-ST já recolhido pelo
   *  distribuidor — é o sinal que alimenta a sugestão "Sim" da pergunta. */
  stLikely: boolean;
};

// O match usa o prefixo mais LONGO que casar (382450, 6 dígitos, vence 3824
// se algum dia entrar; hoje as duas famílias com 6 dígitos não colidem com
// nenhuma de 4).
const CEST_TABLE: CestFamilyRow[] = [
  { prefix: "2523",   cest: "0500100", family: "cimento",      stLikely: true },
  { prefix: "3214",   cest: "1002600", family: "argamassa",    stLikely: true },
  { prefix: "382450", cest: "1002600", family: "argamassa",    stLikely: true },
  // Convênio 142/18, segmento 24: 3208 tende a verniz (base não aquosa);
  // 3209/3210 tende a tinta (látex/acrílica — caso medido no mockup:
  // "Tinta acrílica fosca 18L", NCM 3209.10.10 → 24.001.00). Aproximação:
  // o contador confirma pela composição real do produto.
  { prefix: "3208",   cest: "2400200", family: "verniz",       stLikely: true },
  { prefix: "3209",   cest: "2400100", family: "tinta",        stLikely: true },
  { prefix: "3210",   cest: "2400100", family: "tinta",        stLikely: true },
  { prefix: "6907",   cest: "1003200", family: "revestimento", stLikely: true },
  { prefix: "6908",   cest: "1003200", family: "revestimento", stLikely: true },
  { prefix: "3917",   cest: "1000800", family: "tubo/conexão", stLikely: true },
  { prefix: "8544",   cest: "1200100", family: "fio/cabo",     stLikely: true },
  // 8301 = fechaduras e cadeados; 8302 = ferragens e guarnições em geral.
  { prefix: "8301",   cest: "1001800", family: "fechadura",    stLikely: true },
  { prefix: "8302",   cest: "1001700", family: "ferragem",     stLikely: true },
  { prefix: "6811",   cest: "1001100", family: "telha",        stLikely: true },
  { prefix: "6904",   cest: "1003000", family: "tijolo/bloco", stLikely: true },
];

function digits(v: string | null | undefined): string {
  return (v || "").replace(/\D/g, "");
}

export type CestSuggestion = {
  /** 7 dígitos, sem pontuação. */
  cest: string;
  family: string;
  stLikely: boolean;
};

/**
 * Sugere um CEST a partir do NCM (8 dígitos, com ou sem pontuação). Só
 * cobre as famílias de matcon acima; fora delas devolve null — não
 * sugerir é sempre melhor que sugerir errado (mesma regra do utils/ncm.ts).
 */
export function suggestCest(ncm: string | null | undefined): CestSuggestion | null {
  const d = digits(ncm);
  if (!d) return null;
  let best: CestFamilyRow | null = null;
  for (const row of CEST_TABLE) {
    if (d.indexOf(row.prefix) === 0 && (!best || row.prefix.length > best.prefix.length)) {
      best = row;
    }
  }
  if (!best) return null;
  return { cest: best.cest, family: best.family, stLikely: best.stLikely };
}

/** true quando o NCM é de uma família que costuma vir com ST recolhida —
 *  alimenta a sugestão "Sim" da pergunta do fornecedor. */
export function isStLikely(ncm: string | null | undefined): boolean {
  const sug = suggestCest(ncm);
  return !!sug && sug.stLikely;
}

export type CestStatus = "empty" | "partial" | "valid";
export function getCestStatus(cest: string | null | undefined): CestStatus {
  const d = digits(cest);
  if (!d) return "empty";
  if (d.length === 7) return "valid";
  return "partial";
}

/** "0500100" -> "05.001.00" (mesmo padrão de formatNcmDisplay, formato
 *  próprio do CEST: 2 + 3 + 2 dígitos). */
export function formatCestDisplay(cest: string | null | undefined): string {
  const d = digits(cest);
  if (d.length !== 7) return cest || "";
  return d.slice(0, 2) + "." + d.slice(2, 5) + "." + d.slice(5, 7);
}

/** Família pelo CEST já preenchido — o inverso de suggestCest, pro hint
 *  quando o campo tem valor que não veio do botão Gerar. */
export function cestFamilyByCode(cest: string | null | undefined): string | null {
  const d = digits(cest);
  if (d.length !== 7) return null;
  const row = CEST_TABLE.find((r) => r.cest === d);
  return row ? row.family : null;
}

// ─── Aviso fiscal do Estoque (AlertsList + FiscalGapsModal) ────────────────

type ProdutoParaGap = {
  id: string;
  name: string;
  unit: string;
  ncm?: string | null;
  cest?: string | null;
};

/**
 * Produtos de família com ST provável (NCM bate com a tabela acima) e sem
 * código fiscal (CEST) ainda. Puro e sem chamada nova: a tela de Estoque
 * já tem a lista de produtos em memória.
 */
export function calcularFiscalGaps<T extends ProdutoParaGap>(products: T[] | null | undefined): T[] {
  if (!Array.isArray(products)) return [];
  return products.filter((p) => {
    if (!p || p.unit === "srv") return false;
    if (p.cest) return false;
    return !!suggestCest(p.ncm);
  });
}
