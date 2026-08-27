// ============================================================
// AURA STUDIO · Baixa do saldo da encomenda — a matemática
//
// 27/08/2026. Separado da tela pelo mesmo motivo do checkoutMath do PDV:
// isto decide DINHEIRO, e regra que decide dinheiro tem que ser testável sem
// montar componente.
//
// O servidor é quem manda — ele relê a parcela e recusa o que não fecha. Isto
// aqui existe pra a lojista não descobrir o erro depois de apertar o botão.
// ============================================================

// Tolerância de centavo. Comparar float de dinheiro com `===` deixaria uma
// encomenda "quitada" devendo R$ 0,004.
const EPS = 0.005;

export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

// "75,00" e "75.00" chegam do mesmo teclado dependendo do aparelho — os dois
// valem. Devolve null pro que não é número, pra o botão travar em vez de
// mandar NaN pro servidor.
export function parseValorBR(txt: string): number | null {
  const limpo = String(txt ?? "").trim().replace(/\s/g, "").replace(",", ".");
  if (!limpo) return null;
  if (!/^\d*\.?\d*$/.test(limpo)) return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

// Valor igual ao saldo → a chamada vai SEM `amount`, e o servidor baixa o
// saldo que ele mesmo calculou. É o que impede um centavo de arredondamento
// na tela de deixar a encomenda aberta devendo R$ 0,01.
export function ehBaixaIntegral(valor: number, saldo: number): boolean {
  return Math.abs(valor - saldo) < EPS;
}

export type ErroDoValor = "invalido" | "acima" | null;

// `invalido`: zero, negativo ou não-número — não há o que lançar.
// `acima`: o excedente viraria crédito do cliente no ledger, vocabulário de
// crediário que este fluxo existe justamente pra evitar.
export function erroDoValor(valor: number | null, saldo: number): ErroDoValor {
  if (valor == null || !Number.isFinite(valor) || valor <= 0) return "invalido";
  if (valor > saldo + EPS) return "acima";
  return null;
}

// Quanto sobra devendo. Nunca negativo — com valor acima do saldo o
// `erroDoValor` já barrou antes de chegar aqui.
export function restanteApos(valor: number, saldo: number): number {
  return Math.max(0, round2(saldo - valor));
}

// Pagamento parcial de verdade: válido, e menor que o saldo.
export function ehParcial(valor: number | null, saldo: number): boolean {
  if (erroDoValor(valor, saldo) !== null) return false;
  return (valor as number) < saldo - EPS;
}
