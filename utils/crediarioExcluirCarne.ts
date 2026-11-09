// ============================================================
// Excluir carnê — Aura · Crediário (09/11/2026)
//
// O que a ficha diz antes e depois do DELETE /credit/customers/:cid/accounts/:id
// (Aura-backend#971). Puro, sem tela: testado sozinho.
//
// Regras do Caio:
//   - sem recebimento (manual ou renegociado): exclui, com confirmação;
//   - com recebimento: 409 CARNE_TEM_RECEBIMENTO + a lista — desfazer cada um
//     na Linha do tempo e depois excluir;
//   - de venda do Caixa: 409 CARNE_DE_VENDA + sale_id — a devolução da venda
//     tira a dívida e devolve o estoque.
// ============================================================
import { diaSP } from "@/utils/crediarioPagamento";

export type RecebimentoDoCarne = { id: string | null; date: string | null; amount: number };

export type RespostaDaExclusao =
  | { tipo: "recebimentos"; recebimentos: RecebimentoDoCarne[] }
  | { tipo: "venda"; saleId: string }
  /** O carnê já não está na ficha (excluído ou juntado): recarregar. */
  | { tipo: "sumiu"; mensagem: string }
  | { tipo: "erro"; mensagem: string };

const MSG_RECEBIMENTOS =
  "Este carnê já tem recebimentos. Desfaça cada um na Linha do tempo e depois exclua o carnê.";
const MSG_VENDA =
  "A dívida deste carnê vem de uma venda do Caixa. Para tirá-la, faça a devolução da venda: ela também devolve os produtos ao estoque.";
const MSG_DIVERGENTE =
  "As parcelas deste carnê não batem com o saldo dele. Para não mexer no valor errado, ele não pode ser excluído por aqui. Fale com o suporte da Aura que a gente resolve.";
const MSG_GENERICA = "Não foi possível excluir o carnê. Tente novamente.";

/** Texto do diálogo de confirmação. */
export function textoConfirmarExclusao(falta: number, fmt: (n: number) => string): string {
  return falta > 0.009
    ? `Excluir este carnê? As parcelas em aberto (${fmt(falta)}) saem do saldo do cliente.`
    : "Excluir este carnê? Ele sai da ficha do cliente.";
}

/** Lê o erro do DELETE e diz o que a tela faz. */
export function lerErroDaExclusao(err: any): RespostaDaExclusao {
  const data = err?.data || {};
  const code = data.code;
  if (code === "CARNE_TEM_RECEBIMENTO") {
    const recebimentos: RecebimentoDoCarne[] = Array.isArray(data.receipts)
      ? data.receipts.map((r: any) => ({
          id: r?.id ?? null,
          date: r?.date ?? null,
          amount: Number(r?.amount) || 0,
        }))
      : [];
    return { tipo: "recebimentos", recebimentos };
  }
  if (code === "CARNE_DE_VENDA" && data.sale_id) {
    return { tipo: "venda", saleId: String(data.sale_id) };
  }
  if (code === "CARNE_JA_EXCLUIDO") return { tipo: "sumiu", mensagem: "Este carnê já tinha sido excluído." };
  if (code === "CARNE_JUNTADO") return { tipo: "sumiu", mensagem: "Este carnê foi juntado a outro. Exclua o carnê que ficou com as parcelas." };
  if (code === "CARNE_NAO_ENCONTRADO") return { tipo: "sumiu", mensagem: "Não achamos este carnê. A ficha foi atualizada." };
  if (code === "CARNE_DIVERGENTE") return { tipo: "erro", mensagem: MSG_DIVERGENTE };
  return { tipo: "erro", mensagem: MSG_GENERICA };
}

/** DD/MM do recebimento (dia em São Paulo). */
function diaMesSP(iso: string | null): string {
  const ymd = diaSP(iso);
  if (!ymd) return "";
  const [, mm, dd] = ymd.split("-");
  return `${dd}/${mm}`;
}

/** Mensagem do diálogo "já tem recebimentos", com a lista (até 5). */
export function mensagemDosRecebimentos(recebimentos: RecebimentoDoCarne[], fmt: (n: number) => string): string {
  const linhas = recebimentos
    .filter(r => r.amount > 0)
    .slice(0, 5)
    .map(r => {
      const dia = diaMesSP(r.date);
      return dia ? `${dia} · ${fmt(r.amount)}` : fmt(r.amount);
    });
  const mais = recebimentos.length > 5 ? `\n…e mais ${recebimentos.length - 5}.` : "";
  return linhas.length > 0 ? `${MSG_RECEBIMENTOS}\n\n${linhas.join("\n")}${mais}` : MSG_RECEBIMENTOS;
}

export const MENSAGEM_CARNE_DE_VENDA = MSG_VENDA;
