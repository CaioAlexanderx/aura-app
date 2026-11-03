// ============================================================
// AURA. — Vendas por produto e numeração: contas e textos (03/11/2026)
//
// Mockup: docs/mockups/relatorio-vendas-por-numeracao.html (telas 1-4).
// Os números (vendidos, estoque, giro, repor) vêm prontos do backend; aqui
// fica o que é da TELA: calor da grade, rótulos em língua de balcão, as
// linhas da planilha, o texto do "Montar pedido" e a leitura das datas.
//
// Puro (sem React/RN/store): o jest carrega direto.
// ============================================================
import type { ModeloVendido, PeriodoDoRelatorio, VendasPorNumeracao } from "@/services/relatoriosApi";

export const SEM_NUMERACAO = "Sem numeração";

export const PERIODOS: { key: PeriodoDoRelatorio; rotulo: string }[] = [
  { key: "week", rotulo: "7 dias" },
  { key: "month", rotulo: "Este mês" },
  { key: "last_month", rotulo: "Mês passado" },
  { key: "d90", rotulo: "90 dias" },
  { key: "custom", rotulo: "Escolher datas" },
];

/** ?period= do link (o e-mail semanal manda week). Inválido = este mês. */
export function periodoDoLink(v: unknown): PeriodoDoRelatorio {
  const s = Array.isArray(v) ? v[0] : v;
  return s === "week" || s === "month" || s === "last_month" || s === "d90" ? s : "month";
}

/** 0 (nada vendido) a 4 (o mais vendido da grade), pela fração do máximo. */
export function classeDeCalor(valor: number, maximo: number): 0 | 1 | 2 | 3 | 4 {
  if (!(valor > 0) || !(maximo > 0)) return 0;
  const f = valor / maximo;
  if (f >= 0.75) return 4;
  if (f >= 0.5) return 3;
  if (f >= 0.25) return 2;
  return 1;
}

export function reporDaNumeracao(vendidos: number, estoque: number): number {
  return Math.max(0, (Number(vendidos) || 0) - Math.max(0, Number(estoque) || 0));
}

export function giroPct(vendidos: number, estoque: number): number | null {
  const v = Number(vendidos) || 0;
  const t = v + Math.max(0, Number(estoque) || 0);
  return t > 0 ? Math.round((v / t) * 100) : null;
}

export function qtd(n: number): string {
  return (Number(n) || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

export function brl(n: number | null | undefined, casas = 2): string {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return "—";
  return "R$ " + Number(n).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

/** "~7 dias" · "acabou" · "—" (sem venda no período, não dá para estimar). */
export function textoDura(dias: number | null | undefined): string {
  if (dias === null || dias === undefined) return "—";
  if (dias <= 0) return "acabou";
  return dias === 1 ? "~1 dia" : `~${dias} dias`;
}

/** Dura menos de 15 dias: pinta de alerta (comprar logo). */
export function duraPouco(dias: number | null | undefined): boolean {
  return dias !== null && dias !== undefined && dias < 15;
}

/** "tem 2" · "acabou" — o rodapé de cada numeração. */
export function textoEstoque(estoque: number): string {
  return (Number(estoque) || 0) > 0 ? `tem ${qtd(estoque)}` : "acabou";
}

export function textoVariacao(pct: number | null | undefined): string | null {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return null;
  if (pct === 0) return "igual ao período anterior";
  return `${pct > 0 ? "+" : ""}${pct}% que o período anterior`;
}

/** "dd/mm/aaaa" → "aaaa-mm-dd"; null se não é data de verdade. */
export function dataDoCampo(txt: string): string | null {
  const m = String(txt || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = Number(m[1]), mes = Number(m[2]), a = Number(m[3]);
  const dt = new Date(Date.UTC(a, mes - 1, d));
  if (dt.getUTCFullYear() !== a || dt.getUTCMonth() !== mes - 1 || dt.getUTCDate() !== d) return null;
  return `${a}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Máscara simples dd/mm/aaaa enquanto digita. */
export function mascaraData(v: string): string {
  const d = String(v || "").replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return d.slice(0, 2) + "/" + d.slice(2);
  return d.slice(0, 2) + "/" + d.slice(2, 4) + "/" + d.slice(4);
}

/** Grade: quanto o modelo vendeu (ou tem) em cada coluna. */
export function celula(m: ModeloVendido, coluna: string): { vendidos: number; estoque: number } {
  const n = m.numeracoes.find((x) => x.numeracao === coluna);
  return { vendidos: n ? n.vendidos : 0, estoque: n ? n.estoque : 0 };
}

/** Totais por coluna da grade (linha "Total por numeração") e o %. */
export function totaisDaGrade(modelos: ModeloVendido[], colunas: string[]) {
  const porColuna = colunas.map((c) => modelos.reduce((s, m) => s + celula(m, c).vendidos, 0));
  const total = porColuna.reduce((s, v) => s + v, 0);
  return {
    porColuna,
    total,
    pct: porColuna.map((v) => (total > 0 ? Math.round((v / total) * 100) : 0)),
    maximoCelula: modelos.reduce((mx, m) => Math.max(mx, ...m.numeracoes.map((n) => n.vendidos)), 0),
  };
}

// ── Planilha (.xlsx) ─────────────────────────────────────────────

export const COLUNAS_DA_PLANILHA = [
  "Modelo", "Tipo", "Cor", "Numeração", "Vendidos", "Receita", "Estoque hoje", "Giro %", "Comprar p/ repor",
] as const;

/**
 * Uma linha por modelo × numeração (inclui numeração com estoque e sem
 * venda: ela também importa na compra). Receita por numeração só sai quando
 * o backend manda; modelo sem numeração vira uma linha "Sem numeração" com a
 * receita do modelo. Números saem como número (a planilha soma).
 */
export function linhasDaPlanilha(d: Pick<VendasPorNumeracao, "modelos">): Array<Record<(typeof COLUNAS_DA_PLANILHA)[number], string | number | null>> {
  const linhas: Array<Record<(typeof COLUNAS_DA_PLANILHA)[number], string | number | null>> = [];
  for (const m of d.modelos) {
    const nums = m.numeracoes.length ? m.numeracoes : [{ numeracao: SEM_NUMERACAO, vendidos: m.vendidos, estoque: m.estoque, receita: m.receita }];
    for (const n of nums) {
      const umaSo = nums.length === 1;
      linhas.push({
        "Modelo": m.nome,
        "Tipo": m.tipo || "",
        "Cor": m.cor || "",
        "Numeração": n.numeracao,
        "Vendidos": n.vendidos,
        "Receita": n.receita !== undefined && n.receita !== null ? n.receita : (umaSo ? m.receita : null),
        "Estoque hoje": n.estoque,
        "Giro %": giroPct(n.vendidos, n.estoque),
        "Comprar p/ repor": reporDaNumeracao(n.vendidos, n.estoque),
      });
    }
  }
  return linhas;
}

export function nomeDaPlanilha(periodo: { inicio: string; fim: string }): string {
  return `vendas-por-numeracao-${periodo.inicio}-a-${periodo.fim}.xlsx`;
}

// ── Montar pedido ────────────────────────────────────────────────

export type PedidoDoFornecedor = {
  fornecedor: string;
  telefone: string | null;
  total: number;
  texto: string;
  whatsapp: string | null;
};

/** wa.me exige DDI: número brasileiro de 10-11 dígitos ganha 55. */
export function linkDoWhatsapp(telefone: string | null | undefined, texto: string): string | null {
  let d = String(telefone || "").replace(/\D/g, "");
  if (!d) return null;
  if (d.length === 10 || d.length === 11) d = "55" + d;
  if (d.length < 12) return null;
  return `https://wa.me/${d}?text=${encodeURIComponent(texto)}`;
}

/**
 * "Comprar p/ repor" agrupado pelo fornecedor principal de cada modelo.
 * Só numerações com repor > 0. Modelo sem fornecedor cai em "Sem
 * fornecedor" (sem WhatsApp). Fornecedores na ordem do maior pedido.
 */
export function montarPedidos(modelos: ModeloVendido[], unidade: string): PedidoDoFornecedor[] {
  const grupos = new Map<string, { fornecedor: string; telefone: string | null; itens: { linha: string; total: number }[] }>();
  for (const m of modelos) {
    const nums = m.numeracoes.length
      ? m.numeracoes.map((n) => ({ numeracao: n.numeracao, repor: reporDaNumeracao(n.vendidos, n.estoque) }))
      : [{ numeracao: SEM_NUMERACAO, repor: m.repor }];
    const comRepor = nums.filter((n) => n.repor > 0);
    if (!comRepor.length) continue;
    const chave = m.fornecedor ? m.fornecedor.id : "__sem__";
    if (!grupos.has(chave)) {
      grupos.set(chave, { fornecedor: m.fornecedor ? m.fornecedor.nome : "Sem fornecedor", telefone: m.fornecedor ? m.fornecedor.telefone : null, itens: [] });
    }
    const nome = m.cor ? `${m.nome} (${m.cor})` : m.nome;
    const partes = comRepor.map((n) => (n.numeracao === SEM_NUMERACAO ? `${qtd(n.repor)} ${unidade}` : `${n.numeracao} ×${qtd(n.repor)}`));
    grupos.get(chave)!.itens.push({ linha: `• ${nome}: ${partes.join(", ")}`, total: comRepor.reduce((s, n) => s + n.repor, 0) });
  }
  const out: PedidoDoFornecedor[] = [];
  for (const [chave, g] of Array.from(grupos.entries())) {
    const total = g.itens.reduce((s, i) => s + i.total, 0);
    const texto = [`Pedido — ${g.fornecedor}`, ...g.itens.map((i) => i.linha), `Total: ${qtd(total)} ${unidade}`].join("\n");
    out.push({
      fornecedor: g.fornecedor,
      telefone: g.telefone,
      total,
      texto,
      whatsapp: chave === "__sem__" ? null : linkDoWhatsapp(g.telefone, texto),
    });
  }
  return out.sort((a, b) => (a.fornecedor === "Sem fornecedor" ? 1 : b.fornecedor === "Sem fornecedor" ? -1 : b.total - a.total));
}
