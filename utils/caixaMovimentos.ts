// ============================================================
// AURA. — Caixa: retirada (sangria) e reforço (suprimento), 30/10/2026
//
// A lojista tira dinheiro da gaveta com o caixa aberto, ou reforça o
// troco. Não é venda: só mexe no dinheiro esperado do fechamento
// (Aura-backend#944, migration 422). Aqui fica o que não precisa de tela
// nem de rede (__tests__/caixaMovimentos.test.ts):
//   · esperadoNaGaveta  — troco + vendas em dinheiro + reforços − retiradas;
//   · podeRetirar       — a retirada nunca passa do que há na gaveta;
//   · rotuloDoMovimento — "14:10 · Retirada · depósito no banco".
// ============================================================

export type TipoDeMovimento = "sangria" | "suprimento";

export type MovimentoDoCaixa = {
  id: string;
  tipo: TipoDeMovimento;
  valor: number;
  motivo: string | null;
  created_at: string;
  created_by_name?: string;
};

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** O que deve estar na gaveta: troco + vendas em dinheiro (já líquidas de
 *  reembolso) + reforços − retiradas. É o mesmo número do fechamento. */
export function esperadoNaGaveta(p: { troco: number; dinheiro: number; suprimentos?: number; sangrias?: number }): number {
  return r2((Number(p.troco) || 0) + (Number(p.dinheiro) || 0) + (Number(p.suprimentos) || 0) - (Number(p.sangrias) || 0));
}

/** Retirada só até o que o sistema diz estar na gaveta (1 centavo de folga). */
export function podeRetirar(valor: number, emCaixa: number): boolean {
  return valor > 0 && valor <= r2(emCaixa) + 0.004;
}

export function nomeDoTipo(tipo: TipoDeMovimento): string {
  return tipo === "sangria" ? "Retirada" : "Reforço";
}

/** "14:10 · Retirada · depósito no banco" (sem motivo: "14:10 · Retirada"). */
export function rotuloDoMovimento(m: Pick<MovimentoDoCaixa, "tipo" | "motivo" | "created_at">): string {
  const t = Date.parse(m.created_at);
  const hora = isFinite(t)
    ? new Date(t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })
    : "";
  const partes = [hora, nomeDoTipo(m.tipo)];
  if (m.motivo && m.motivo.trim()) partes.push(m.motivo.trim());
  return partes.filter(Boolean).join(" · ");
}
