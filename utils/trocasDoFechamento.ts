// ============================================================
// AURA. — Trocas e devoluções no fechamento de caixa (16/11/2026)
//
// "Vendas do período" não soma a troca (Aura-backend#1039) e "Entradas no
// caixa" soma o que entrou por forma de pagamento. Num dia com troca os dois
// diferem, e o papel não dizia por quê. Estas funções montam a conta que
// liga um ao outro e a linha da diferença de cada troca; o relatório
// (utils/cashClosePdf.ts) e a tela do fechamento (OpenCloseCashModal) só
// desenham. Mockup aprovado: docs/mockups/fechamento-trocas.html.
//
// A conta SEMPRE fecha em Entradas: o que as trocas não explicam (venda no
// crediário, recebimento de crediário antigo, receita manual) vira a linha
// "± Crediário e outros ajustes".
// ============================================================
import type { CaixaTrocaDaSessao, CaixaTrocasResumo } from "@/services/caixaApi";

export type TrocaDoFechamento = CaixaTrocaDaSessao;
export type ResumoDasTrocas = CaixaTrocasResumo;

function r2(n: unknown): number {
  const v = typeof n === "number" ? n : parseFloat(String(n == null ? 0 : n));
  return isFinite(v) ? Math.round(v * 100) / 100 : 0;
}

export function temTrocas(trocas?: TrocaDoFechamento[] | null): trocas is TrocaDoFechamento[] {
  return Array.isArray(trocas) && trocas.length > 0;
}

/** "no débito", "em dinheiro", "no Pix"... — a forma com a preposição. */
export function metodoComPreposicao(method: string): string {
  const m = String(method || "").toLowerCase();
  switch (m) {
    case "dinheiro": return "em dinheiro";
    case "pix": return "no Pix";
    case "debito":
    case "cartao_debito": return "no débito";
    case "cartao":
    case "credito":
    case "cartao_credito": return "no crédito";
    case "cartao_estorno": return "no estorno do cartão";
    case "crediario":
    case "crediario_credito": return "no crediário";
    case "fiado": return "no fiado";
    case "vale": return "em vale";
    default: return m ? "em " + m.replace(/_/g, " ") : "";
  }
}

function frasesDosMetodos(metodos: { method: string; amount: number }[] | undefined): string {
  const vistas: string[] = [];
  (metodos || []).forEach((m) => {
    const f = metodoComPreposicao(m.method);
    if (f && vistas.indexOf(f) < 0) vistas.push(f);
  });
  return vistas.join(" e ");
}

export type LinhaDaDiferenca = {
  /** in = entrou no caixa; out = saiu do caixa; zero = não mexeu na gaveta. */
  kind: "in" | "out" | "zero";
  texto: string;
  /** Com sinal; null quando a linha não leva valor (crédito na carteira). */
  valor: number | null;
};

/** A(s) linha(s) "Cliente pagou a diferença no débito" / "Devolvido ao
 *  cliente em dinheiro" / "Sem diferença" / crédito na carteira. */
export function linhasDaDiferenca(t: TrocaDoFechamento, fmt: (n: number) => string): LinhaDaDiferenca[] {
  const linhas: LinhaDaDiferenca[] = [];
  const recebido = r2(t.recebido?.total);
  const devolvido = r2(t.devolvido_cliente?.total);
  const credito = r2(t.credito_carteira);
  if (recebido > 0) {
    const f = frasesDosMetodos(t.recebido?.metodos);
    linhas.push({ kind: "in", texto: "Cliente pagou a diferença" + (f ? " " + f : ""), valor: recebido });
  }
  if (devolvido > 0) {
    const f = frasesDosMetodos(t.devolvido_cliente?.metodos);
    linhas.push({ kind: "out", texto: "Devolvido ao cliente" + (f ? " " + f : ""), valor: -devolvido });
  }
  if (credito > 0) {
    linhas.push({ kind: "zero", texto: fmt(credito) + " em crédito na carteira do cliente (não saiu da gaveta)", valor: null });
  }
  if (!linhas.length) linhas.push({ kind: "zero", texto: "Sem diferença", valor: 0 });
  return linhas;
}

/** O valor da linha da diferença: "+ R$ 59,90", "− R$ 0,10", "R$ 0,00" ou "". */
export function valorDaDiferenca(valor: number | null, fmt: (n: number) => string): string {
  if (valor == null) return "";
  if (valor === 0) return fmt(0);
  return (valor > 0 ? "+ " : "− ") + fmt(Math.abs(valor));
}

/** "2× Blusa" quando leva mais de uma; a quantidade inteira sem casas. */
export function nomeComQuantidade(nome: string, quantidade: number): string {
  const q = r2(quantidade);
  if (!(q > 1)) return nome;
  return String(q).replace(".", ",") + "× " + nome;
}

export function valorDoDevolvido(d: { quantity: number; unit_price: number }): number {
  return r2(r2(d.quantity) * r2(d.unit_price));
}

export function valorDoLevado(l: { quantity: number; unit_price: number; total_price?: number | null }): number {
  return l.total_price != null ? r2(l.total_price) : r2(r2(l.quantity) * r2(l.unit_price));
}

/** Os 4 totais da seção. Usa o resumo do backend; sem ele, soma as trocas. */
export function resumoDasTrocas(trocas: TrocaDoFechamento[], resumo?: ResumoDasTrocas | null): ResumoDasTrocas {
  if (resumo) {
    return {
      quantidade: r2(resumo.quantidade) || trocas.length,
      pecas_devolvidas: r2(resumo.pecas_devolvidas),
      pecas_levadas: r2(resumo.pecas_levadas),
      diferenca_recebida: r2(resumo.diferenca_recebida),
      devolvido_cliente: r2(resumo.devolvido_cliente),
    };
  }
  let dev = 0, lev = 0, rec = 0, saiu = 0;
  trocas.forEach((t) => {
    (t.devolvidos || []).forEach((d) => { dev += valorDoDevolvido(d); });
    (t.levados || []).forEach((l) => { lev += valorDoLevado(l); });
    rec += r2(t.recebido?.total);
    saiu += r2(t.devolvido_cliente?.total);
  });
  return {
    quantidade: trocas.length,
    pecas_devolvidas: r2(dev),
    pecas_levadas: r2(lev),
    diferenca_recebida: r2(rec),
    devolvido_cliente: r2(saiu),
  };
}

export type LinhaDaConta = {
  chave: "vendas" | "diferenca" | "devolvido" | "ajustes";
  rotulo: string;
  /** "1 troca", "2 trocas", "nenhuma" — vazio na linha de Vendas e de ajustes. */
  obs: string;
  /** Com sinal: a linha de devolvido é negativa; ajustes pode ser ±. */
  valor: number;
};

function trocasNoPlural(n: number): string {
  return n === 0 ? "nenhuma" : n === 1 ? "1 troca" : n + " trocas";
}

/**
 * A conta de Vendas do período até Entradas no caixa. Sempre fecha:
 * vendas + diferença − devolvido ± ajustes = entradas.
 */
export function contaDoFechamento(params: {
  vendas: number;
  entradas: number;
  trocas: TrocaDoFechamento[];
  resumo?: ResumoDasTrocas | null;
}): { linhas: LinhaDaConta[]; entradas: number } {
  const vendas = r2(params.vendas);
  const entradas = r2(params.entradas);
  const res = resumoDasTrocas(params.trocas, params.resumo);
  const comDiferenca = params.trocas.filter((t) => r2(t.recebido?.total) > 0).length;
  const comDevolucao = params.trocas.filter((t) => r2(t.devolvido_cliente?.total) > 0).length;

  const linhas: LinhaDaConta[] = [
    { chave: "vendas", rotulo: "Vendas do período", obs: "", valor: vendas },
    { chave: "diferenca", rotulo: "+ Diferença paga em trocas", obs: trocasNoPlural(comDiferenca), valor: res.diferenca_recebida },
  ];
  if (res.devolvido_cliente > 0) {
    linhas.push({ chave: "devolvido", rotulo: "− Devolvido ao cliente", obs: trocasNoPlural(comDevolucao), valor: -res.devolvido_cliente });
  }
  const explicado = r2(vendas + res.diferenca_recebida - res.devolvido_cliente);
  const residuo = r2(entradas - explicado);
  if (Math.abs(residuo) >= 0.01) {
    linhas.push({ chave: "ajustes", rotulo: "± Crediário e outros ajustes", obs: "", valor: residuo });
  }
  return { linhas, entradas };
}

/** Valor de uma linha da conta: "R$ 59,90" ou "− R$ 10,10". O ajuste, que
 *  pode ir para os dois lados, leva o sinal também quando é positivo. */
export function valorDaLinhaDaConta(linha: LinhaDaConta, fmt: (n: number) => string): string {
  if (linha.valor < 0) return "− " + fmt(-linha.valor);
  return (linha.chave === "ajustes" ? "+ " : "") + fmt(linha.valor);
}
