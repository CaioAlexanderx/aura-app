// ============================================================
// components/studio/orcamentoVideo/mensagemDoOrcamento.ts
//
// O texto que vai junto do vídeo no WhatsApp do cliente (orçamento em
// vídeo 3D, 28/09/2026). Função pura: a lojista pode editar o texto no
// passo 3, e o que sai daqui é o ponto de partida.
//
// Sem link e sem endereço público (decisão do PO): valores e condições
// vão por extenso na própria mensagem. *asteriscos* viram negrito no
// WhatsApp. Sem emoji — a mensagem é da loja, não nossa.
// ============================================================
import { reais, pct, type ValoresDasCondicoes } from "./condicoesDoOrcamento";

export type ItemDaMensagem = { description: string; quantity: number | string; unit_price: number | string };

export type EntradaDaMensagem = {
  nomeDoCliente: string | null | undefined;
  nomeDaLoja: string | null | undefined;
  itens: ItemDaMensagem[];
  desconto: number;
  total: number;
  valores: ValoresDasCondicoes;
  /** Data até quando os valores valem (ISO ou Date). */
  validaAte: string | Date | null | undefined;
  /** O que vai anexado: vídeo, foto ou nada. */
  anexo: "video" | "foto" | "nada";
};

export function primeiroNome(nome: string | null | undefined): string {
  const p = String(nome || "").trim().split(/\s+/)[0] || "";
  return p ? p.charAt(0).toUpperCase() + p.slice(1) : "";
}

function quantidade(q: number | string): string {
  const n = Number(q) || 0;
  if (Number.isInteger(n)) return n === 1 ? "1 unidade" : `${n} unidades`;
  return `${String(n).replace(".", ",")} un.`;
}

function diaMes(d: string | Date | null | undefined): string | null {
  if (!d) return null;
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  return String(x.getDate()).padStart(2, "0") + "/" + String(x.getMonth() + 1).padStart(2, "0");
}

export function mensagemDoOrcamento(e: EntradaDaMensagem): string {
  const nome = primeiroNome(e.nomeDoCliente);
  const loja = String(e.nomeDaLoja || "").trim();
  const L: string[] = [];

  L.push(nome ? `Oi, ${nome}!` + (loja ? ` Aqui é da ${loja}.` : "") : loja ? `Oi! Aqui é da ${loja}.` : "Oi!");
  if (e.anexo === "video") L.push("Fiz um vídeo da peça para você ver como ela fica de todos os lados.");
  else if (e.anexo === "foto") L.push("Segue uma imagem da peça, do jeito que vai ficar.");
  else L.push("Segue o seu orçamento.");
  L.push("");

  for (const it of e.itens) {
    const linha = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
    L.push(`*${String(it.description).trim()}* · ${quantidade(it.quantity)} · ${reais(linha)}`);
  }
  if (e.desconto > 0) L.push(`Desconto: ${reais(e.desconto)}`);
  L.push(`*Total: ${reais(e.total)}*`);

  const v = e.valores;
  if (v.pix) L.push(`• No Pix: *${reais(v.pix.valor)}* (${pct(v.pix.pct)}% de desconto)`);
  if (v.cartao) L.push(`• No cartão: até ${v.cartao.parcelas}x de ${reais(v.cartao.valor)} sem juros`);
  if (v.sinal) {
    L.push(`• Sinal${v.sinal.pct != null ? ` de ${pct(v.sinal.pct)}%` : ""} (${reais(v.sinal.valor)}) para começar a produção`);
  }
  if (v.prazo) L.push(`• Prazo: ${v.prazo.dias_uteis} ${v.prazo.dias_uteis === 1 ? "dia útil" : "dias úteis"} depois que você aprovar a arte`);
  if (v.observacao) L.push(`• ${v.observacao}`);

  const ate = diaMes(e.validaAte);
  if (ate) L.push(`Vale até ${ate}.`);
  L.push("");
  L.push("Posso seguir com o pedido?");
  return L.join("\n");
}
