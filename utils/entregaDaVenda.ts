// ============================================================
// AURA. — Entrega da venda do Caixa (09/11/2026, parte 2)
//
// Regra do Caio: "No caso de venda com frete, sempre pedir endereço do
// cliente (caso não possua)." Mockup aprovado em 09/11/2026 (seções C a G):
//   - venda COM frete e cliente sem endereço: "Finalizar venda" abre
//     "Para onde vai a entrega?" antes do pagamento;
//   - venda COM frete sem cliente: abre "Quem recebe a entrega?" (procura
//     um cliente; se não houver, cadastra nome, telefone e endereço);
//   - obrigatórios: nome, CEP ou rua, número e cidade;
//   - venda sem frete: nada muda (a trava é só do frete).
//
// Na tela de venda concluída, a caixinha "Imprimir papel de entrega"
// aparece quando a venda tem endereço; vem marcada com frete e desmarcada
// sem frete. Marcada, o cupom e o papel saem numa janela só — o Chrome
// bloqueia o segundo pop-up.
//
// Contrato com o backend (Aura-backend, src/services/entregaDaVenda.js):
//   delivery_check: true  -> o servidor aplica a trava (422
//                            DELIVERY_ADDRESS_REQUIRED). App antigo não
//                            manda e vende como antes.
//   delivery_address      -> retrato gravado em sales.delivery_address e,
//                            para quem ainda não tem, no cadastro.
//   customer (inline)     -> cliente novo já com o endereço.
// Impressão: /print/receipt/:id/preview?entrega=1 (bobina: o papel depois
// do cupom, com linha de corte) e /print/delivery/:id?format=a4 (A4).
//
// Aqui só o que não precisa de tela nem de rede (__tests__/entregaDaVenda.test.ts).
// ============================================================
import {
  enderecoParaApi, temEnderecoDeEntrega, faltandoParaEntrega, type Endereco,
} from "@/components/endereco/endereco";

export type EntregaDaVenda = {
  /** Cliente para quem o endereço foi preenchido (null = cadastro novo,
   *  ou venda sem cliente). Se o cliente da venda mudar, a entrega deixa
   *  de valer e a trava pergunta de novo. */
  customerId: string | null;
  nome: string;
  telefone: string;
  endereco: Endereco;
  recado: string;
  /** Sem cliente: nome, telefone e endereço viram um cadastro novo. */
  novoCliente: boolean;
};

export type PedidoDeEntrega = "endereco" | "quem";

const t = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());

/** A entrega preenchida vale para o cliente que está na venda agora? */
export function entregaValeParaACliente(entrega: EntregaDaVenda | null | undefined, customerId: string | null | undefined): boolean {
  if (!entrega) return false;
  if ((entrega.customerId || null) !== (customerId || null)) return false;
  if (!temEnderecoDeEntrega(entrega.endereco)) return false;
  return !(entrega.novoCliente && !t(entrega.nome));
}

/**
 * Ao tocar em "Finalizar venda": precisa perguntar para onde vai?
 * null = segue para o pagamento.
 */
export function precisaPedirEntrega(p: {
  frete: number;
  customerId: string | null | undefined;
  clienteTemEndereco: boolean;
  entrega: EntregaDaVenda | null | undefined;
}): PedidoDeEntrega | null {
  if (!(p.frete > 0)) return null;
  if (entregaValeParaACliente(p.entrega, p.customerId)) return null;
  if (p.customerId) return p.clienteTemEndereco ? null : "endereco";
  return "quem";
}

/** O que falta no formulário. `pedeNome` na tela "Quem recebe a entrega?". */
export function faltandoNaEntrega(endereco: Endereco, opts: { pedeNome: boolean; nome?: string }): string[] {
  return faltandoParaEntrega(endereco, opts.pedeNome ? { nome: opts.nome || "" } : undefined);
}

/** "número e cidade", "nome, número e cidade". */
export function textoDoQueFalta(falta: string[]): string {
  if (falta.length <= 1) return falta.join("");
  return falta.slice(0, -1).join(", ") + " e " + falta[falta.length - 1];
}

/**
 * Campos que a venda leva ao POST /pdv/sale. Sem frete e sem entrega:
 * objeto vazio (o corpo da venda é o de sempre).
 */
export function camposDaEntregaNaVenda(
  entrega: EntregaDaVenda | null | undefined,
  p: { frete: number; customerId: string | null | undefined },
): Record<string, any> {
  const out: Record<string, any> = {};
  if (p.frete > 0) out.delivery_check = true;
  if (!entregaValeParaACliente(entrega, p.customerId)) return out;
  const e = entrega as EntregaDaVenda;
  const endereco = enderecoParaApi(e.endereco);
  out.delivery_address = {
    ...endereco,
    name: t(e.nome) || null,
    phone: t(e.telefone).replace(/\D/g, "") || null,
    note: t(e.recado) || null,
  };
  if (e.novoCliente && !p.customerId) {
    out.customer = { name: t(e.nome), phone: t(e.telefone).replace(/\D/g, "") || undefined, ...endereco };
  }
  return out;
}

/** A caixinha da venda concluída: aparece? vem marcada? */
export function caixinhaDaEntrega(p: { frete: number; endereco: Endereco | null | undefined }): { mostra: boolean; marcada: boolean } {
  const mostra = temEnderecoDeEntrega(p.endereco || null);
  return { mostra, marcada: mostra && p.frete > 0 };
}

// ── Bobina ou A4, lembrado no computador ─────────────────────────────
export type FormatoDoPapel = "bobina" | "a4";
export const CHAVE_DO_FORMATO = "aura:papel-entrega:formato";

export function lerFormatoDoPapel(): FormatoDoPapel {
  try {
    const v = typeof localStorage !== "undefined" ? localStorage.getItem(CHAVE_DO_FORMATO) : null;
    return v === "a4" ? "a4" : "bobina";
  } catch {
    return "bobina";
  }
}

export function gravarFormatoDoPapel(f: FormatoDoPapel): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(CHAVE_DO_FORMATO, f);
  } catch { /* janela anônima ou armazenamento bloqueado: só não lembra */ }
}

// ── Impressão numa janela só ─────────────────────────────────────────
/** Rota do cupom. Sem o papel (ou no A4) é exatamente a de sempre. */
export function rotaDoCupom(base: string, companyId: string, saleId: string, papelNaBobina: boolean): string {
  return `${base}/companies/${companyId}/print/receipt/${saleId}/preview` + (papelNaBobina ? "?entrega=1" : "");
}

export function rotaDoPapelA4(base: string, companyId: string, saleId: string): string {
  return `${base}/companies/${companyId}/print/delivery/${saleId}?format=a4&autoprint=1`;
}

export const MARCA_DO_ENCADEAMENTO = "data-papel-a4";

/**
 * A4: o cupom imprime primeiro e, quando a janela de impressão fecha
 * (afterprint), a MESMA janela abre o papel em A4, que imprime sozinho.
 * Um pop-up só. O botão fica como saída manual (não sai no papel: o CSS do
 * cupom esconde botões na impressão).
 */
export function encadearPapelA4(cupomHtml: string, urlDoPapel: string): string {
  const url = JSON.stringify(String(urlDoPapel));
  const bloco =
    "<div " + MARCA_DO_ENCADEAMENTO + ' style="margin-top:8px">' +
      '<button onclick="location.href=' + url.replace(/"/g, "&quot;") + '" style="width:100%;padding:8px;cursor:pointer">Imprimir o papel de entrega (A4)</button>' +
    "</div>" +
    "<script>(function(){var foi=false;function ir(){if(foi)return;foi=true;" +
      "setTimeout(function(){location.href=" + url + ";},300);}" +
      'window.addEventListener("afterprint",ir);})();</script>';
  const fim = cupomHtml.lastIndexOf("</body>");
  return fim >= 0 ? cupomHtml.slice(0, fim) + bloco + "\n" + cupomHtml.slice(fim) : cupomHtml + bloco;
}
