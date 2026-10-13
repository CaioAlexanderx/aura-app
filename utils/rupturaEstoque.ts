// ============================================================
// AURA. — "O que vai faltar" (13/10/2026): regras puras da tela
//
// Tudo que a tela decide sem tocar em rede ou em React: datas-alvo,
// ordenação, busca e o texto da lista de compra. O cálculo de ruptura em
// si (ritmo, data prevista, sugestão com folga de 20%) é do backend
// (Aura-backend#814, services/ruptura.js) — aqui só se apresenta.
//
// Datas viajam como 'YYYY-MM-DD' sem fuso (mesmo contrato do backend);
// nada aqui passa por `new Date(string)`.
// ============================================================
import { matchesQuery, normalizeText } from "@/utils/productSearch";
import { qtdComUnidade } from "@/utils/matconUnits";
import type { RupturaItem, RupturaResposta } from "@/services/estoqueRupturaApi";

/** Janelas de ritmo oferecidas (dias). O backend aceita de 7 a 90. */
export const JANELAS = [7, 14, 30] as const;
export const JANELA_PADRAO = 14;
/** O backend recusa data mais de 365 dias à frente. */
export const HORIZONTE_DIAS = 365;

const DIA = /^\d{4}-\d{2}-\d{2}$/;
const pad2 = (n: number) => String(n).padStart(2, "0");

function paraUTC(ymd: string): number {
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function somaDias(ymd: string, n: number): string {
  return new Date(paraUTC(ymd) + n * 86400000).toISOString().slice(0, 10);
}

export function diasEntre(de: string, ate: string): number {
  return Math.round((paraUTC(ate) - paraUTC(de)) / 86400000);
}

/** "2026-10-17" → "17/10". Vazio ou fora do formato devolve o texto como veio. */
export function diaMes(ymd: string | null | undefined): string {
  if (!ymd || !DIA.test(ymd.slice(0, 10))) return ymd || "";
  return ymd.slice(8, 10) + "/" + ymd.slice(5, 7);
}

/** "2026-11-30" → "30/11/2026". */
export function dataBR(ymd: string | null | undefined): string {
  if (!ymd || !DIA.test(ymd.slice(0, 10))) return ymd || "";
  return ymd.slice(8, 10) + "/" + ymd.slice(5, 7) + "/" + ymd.slice(0, 4);
}

// ── Data-alvo ────────────────────────────────────────────────

export type AlvoPreset = { key: string; label: string; ate: string };

/**
 * Os atalhos de data. Black Friday (30/11) e Natal (24/12) enquanto não
 * passaram; depois deles, "30 dias à frente".
 */
export function presetsDeData(hoje: string): AlvoPreset[] {
  const ano = Number(hoje.slice(0, 4));
  const out: AlvoPreset[] = [];
  const bf = ano + "-11-30";
  const natal = ano + "-12-24";
  if (hoje <= bf) out.push({ key: "black-friday", label: "Black Friday", ate: bf });
  if (hoje <= natal) out.push({ key: "natal", label: "Natal", ate: natal });
  if (out.length === 0) out.push({ key: "30-dias", label: "Próximos 30 dias", ate: somaDias(hoje, 30) });
  return out;
}

/**
 * O valor inicial da tela: 30/11 enquanto ele não passou; depois, 30 dias à
 * frente — o mesmo critério do backend (services/ruptura.js, atePadrao).
 */
export function dataAlvoPadrao(hoje: string): string {
  const bf = hoje.slice(0, 4) + "-11-30";
  return hoje <= bf ? bf : somaDias(hoje, 30);
}

/**
 * Lê o que o lojista digitou ("30/11", "30/11/2026", "301126" não — só com
 * barras). Sem ano, vale o próximo dia assim que ainda não passou: dd/mm
 * antes de hoje vira o ano seguinte. Devolve null para data inexistente,
 * passada ou além do horizonte do backend.
 */
export function lerDataAlvo(texto: string, hoje: string): string | null {
  const m = String(texto || "").trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/);
  if (!m) return null;
  const d = Number(m[1]);
  const mes = Number(m[2]);
  let ano: number;
  if (m[3]) {
    ano = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  } else {
    ano = Number(hoje.slice(0, 4));
    const candidata = ano + "-" + pad2(mes) + "-" + pad2(d);
    if (candidata < hoje) ano += 1;
  }
  const ymd = ano + "-" + pad2(mes) + "-" + pad2(d);
  // 31/04 existe no regex mas não no calendário: ida e volta pelo Date.
  if (!DIA.test(ymd) || somaDias(ymd, 0) !== ymd) return null;
  if (ymd < hoje) return null;
  if (diasEntre(hoje, ymd) > HORIZONTE_DIAS) return null;
  return ymd;
}

// ── Lista ────────────────────────────────────────────────────

/** Mais cedo primeiro; no empate, quem mais pesa no caixa; depois o nome. */
export function ordenarPorDataPrevista(itens: RupturaItem[]): RupturaItem[] {
  return itens.slice().sort(function (a, b) {
    if (a.data_prevista !== b.data_prevista) return a.data_prevista < b.data_prevista ? -1 : 1;
    if (a.valor_em_risco !== b.valor_em_risco) return b.valor_em_risco - a.valor_em_risco;
    return String(a.nome).localeCompare(String(b.nome), "pt-BR");
  });
}

/** O que a tela lista de verdade: só quem falta, na ordem da data prevista. */
export function itensQueVaoFaltar(r: Pick<RupturaResposta, "itens">): RupturaItem[] {
  return ordenarPorDataPrevista((r.itens || []).filter((i) => i.faltara));
}

/** Busca por nome, variante, código e loja — acento e ordem das palavras não importam. */
export function filtrarPorBusca(itens: RupturaItem[], busca: string): RupturaItem[] {
  const q = String(busca || "").trim();
  if (!q) return itens;
  return itens.filter(function (i) {
    const palheiro = normalizeText([i.nome, i.variante, i.codigo, i.loja && i.loja.nome].filter(Boolean).join(" "));
    return matchesQuery(palheiro, q);
  });
}

/** Cor do "acaba em": vermelho até 7 dias, âmbar até 21, neutro depois. */
export function urgencia(dias: number): "alta" | "media" | "baixa" {
  if (dias <= 7) return "alta";
  if (dias <= 21) return "media";
  return "baixa";
}

export function ritmoPorDia(v: number): string {
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + "/dia";
}

// ── Lista de compra (texto simples) ──────────────────────────

/**
 * O texto que vai para o WhatsApp do fornecedor ou para o bloco de notas:
 * uma linha por item — nome, variante e quantidade sugerida. Quem já zerou
 * vem primeiro (é o mais urgente); depois a ordem da data prevista. Item
 * sem sugestão (0) não entra: lista de compra não tem linha "comprar 0".
 * No consolidado a loja dona do estoque vai entre colchetes, senão o
 * fornecedor não sabe para onde mandar.
 */
export function textoListaDeCompra(
  r: Pick<RupturaResposta, "itens" | "zerados" | "ate">,
  opts: { mostrarLoja?: boolean } = {}
): string {
  const linhas = [...ordenarPorDataPrevista(r.zerados || []), ...itensQueVaoFaltar(r)]
    .filter((i) => i.sugestao_compra > 0)
    .map(function (i) {
      const variante = i.variante ? " (" + i.variante + ")" : "";
      const loja = opts.mostrarLoja && i.loja && i.loja.nome ? " [" + i.loja.nome + "]" : "";
      return i.nome + variante + ": " + qtdComUnidade(i.sugestao_compra, i.unidade) + loja;
    });
  if (linhas.length === 0) return "";
  return ["Lista de compra (até " + diaMes(r.ate) + ")", ...linhas].join("\n");
}
