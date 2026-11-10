// ============================================================
// AURA. — Regras da transferência de estoque entre lojas (10/11/2026)
//
// Sem React: o modal monta as linhas (produto simples ou cada variante),
// a pessoa digita a quantidade, e estas funções validam, montam o corpo do
// POST, dividem em lotes de até 1.000 itens e leem os erros do backend.
// ============================================================
import type { ItemParaTransferir } from "@/services/estoqueTransferenciasApi";

/** Limite do backend por envio. Seleção maior vai em lotes, um depois do outro. */
export const MAX_ITENS_POR_LOTE = 1000;

/** Uma linha do formulário: produto sem grade, ou uma variante (cor/tamanho). */
export type LinhaTransferencia = {
  chave: string;
  product_id: string;
  variant_id: string | null;
  nome: string;
  rotulo: string | null;
  disponivel: number;
  unidade: string;
};

export function chaveDaLinha(productId: string, variantId: string | null | undefined): string {
  return variantId ? "v:" + productId + ":" + variantId : "p:" + productId;
}

/**
 * Lê o que a pessoa digitou. Vazio ou zero = não transfere (null).
 * NaN = texto que não é número, ou número negativo.
 */
export function lerQuantidade(texto: string | undefined | null): number | null {
  var t = String(texto == null ? "" : texto).trim();
  if (!t) return null;
  // "1.234,5" e "1234,5" viram 1234.5; "2.5" (ponto decimal) também vale.
  var normal = /,/.test(t) ? t.replace(/\./g, "").replace(",", ".") : t;
  if (!/^\d+(\.\d+)?$/.test(normal)) return NaN;
  var n = parseFloat(normal);
  if (!isFinite(n) || n < 0) return NaN;
  if (n === 0) return null;
  return n;
}

/** Texto do "Tudo": o estoque atual, sem casas a mais. */
export function textoDoTudo(disponivel: number): string {
  if (!(disponivel > 0)) return "";
  return String(Math.round(disponivel * 1000) / 1000).replace(".", ",");
}

export type ResultadoValidacao = {
  itens: ItemParaTransferir[];
  erros: Record<string, string>;
  pecas: number;
};

export function validar(linhas: LinhaTransferencia[], quantidades: Record<string, string>): ResultadoValidacao {
  var itens: ItemParaTransferir[] = [];
  var erros: Record<string, string> = {};
  var pecas = 0;
  linhas.forEach(function (l) {
    var q = lerQuantidade(quantidades[l.chave]);
    if (q === null) return;
    if (isNaN(q)) { erros[l.chave] = "Use só números, como 3 ou 2,5."; return; }
    if (String(l.unidade || "un").toLowerCase() === "un" && Math.round(q) !== q) { erros[l.chave] = "Peça inteira: use um número sem vírgula."; return; }
    if (q > l.disponivel + 1e-9) {
      erros[l.chave] = l.disponivel > 0
        ? "Só tem " + textoDoTudo(l.disponivel) + " nesta loja."
        : "Não tem estoque nesta loja.";
      return;
    }
    itens.push({ product_id: l.product_id, variant_id: l.variant_id, quantidade: q });
    pecas += q;
  });
  return { itens: itens, erros: erros, pecas: Math.round(pecas * 1000) / 1000 };
}

export function dividirEmLotes<T>(itens: T[], tamanho: number = MAX_ITENS_POR_LOTE): T[][] {
  var lotes: T[][] = [];
  for (var i = 0; i < itens.length; i += tamanho) lotes.push(itens.slice(i, i + tamanho));
  return lotes;
}

/** Um item citado no erro do backend ({ error, code, itens? }). */
export type ItemDoErro = {
  chave: string;
  product_id: string;
  variant_id: string | null;
  disponivel: number | null;
  nome: string | null;
  rotulo: string | null;
  motivo: string | null;
};

/**
 * Lê `itens` do corpo do erro (aceita também `items`/`detalhes`, e
 * `available`/`estoque` no lugar de `disponivel`). Aura-backend#994 manda
 * `nome`, `quantidade` e, em alguns códigos, `motivo` em cada item.
 */
export function itensDoErro(err: any): ItemDoErro[] {
  var data = (err && err.data) || {};
  var lista: any[] = Array.isArray(data.itens) ? data.itens
    : Array.isArray(data.items) ? data.items
    : Array.isArray(data.detalhes) ? data.detalhes
    : [];
  var out: ItemDoErro[] = [];
  lista.forEach(function (it) {
    if (!it || !it.product_id) return;
    var d = it.disponivel != null ? it.disponivel : it.available != null ? it.available : it.estoque;
    var n = d == null ? null : Number(d);
    out.push({
      chave: chaveDaLinha(it.product_id, it.variant_id),
      product_id: String(it.product_id),
      variant_id: it.variant_id ? String(it.variant_id) : null,
      disponivel: n == null || isNaN(n) ? null : n,
      nome: it.nome ? String(it.nome) : null,
      rotulo: it.rotulo ? String(it.rotulo) : null,
      motivo: it.motivo ? String(it.motivo) : null,
    });
  });
  return out;
}

/** ESTOQUE_INSUFICIENTE: chave → disponível (null quando não veio). */
export function itensSemEstoque(err: any): Record<string, number | null> {
  var out: Record<string, number | null> = {};
  itensDoErro(err).forEach(function (it) { out[it.chave] = it.disponivel; });
  return out;
}

/** O backend mandou `motivo` no corpo ou em algum item. */
export function temMotivo(err: any, motivo: string): boolean {
  var data = (err && err.data) || {};
  if (data.motivo === motivo) return true;
  return itensDoErro(err).some(function (it) { return it.motivo === motivo; });
}

/** "Vestido midi, Bolsa e mais 2" — para achar a linha mesmo fora da página. */
export function nomesDoErro(err: any, max: number = 3): string {
  var nomes: string[] = [];
  itensDoErro(err).forEach(function (it) {
    if (!it.nome) return;
    var n = it.nome + (it.rotulo ? " (" + it.rotulo + ")" : "");
    if (nomes.indexOf(n) < 0) nomes.push(n);
  });
  if (nomes.length === 0) return "";
  if (nomes.length <= max) return nomes.join(", ");
  return nomes.slice(0, max).join(", ") + " e mais " + (nomes.length - max);
}

/** Texto da marca vermelha na linha, por código (null = o código não marca linha). */
export function problemaDaLinha(code: string | null, motivo: string | null, destino: string): string | null {
  switch (code) {
    case "GRADE_DIFERENTE":
      return "Cores e tamanhos diferentes na " + destino + ". Confira o cadastro deste produto nas duas lojas.";
    case "QUANTIDADE_INVALIDA":
      return motivo === "servico" ? "Serviço não tem estoque: deixe vazio." : "Quantidade não aceita. Confira o número.";
    case "ITEM_NAO_ENCONTRADO":
      return motivo === "informe_a_variante"
        ? "Este produto tem tamanhos e cores: informe a quantidade em cada um."
        : "Não encontramos este produto nesta loja (pode ter sido excluído).";
    default:
      return null;
  }
}

export var MSG_TENTE_DE_NOVO = "Muita gente mexendo no estoque ao mesmo tempo. Tente de novo em instantes.";
export var MSG_SCHEMA_PENDENTE = "A transferência fica disponível em alguns minutos. Nada foi mudado; tente daqui a pouco.";

export function mensagemDoErro(code: string | null, err: any, destino?: string): string {
  var loja = destino || "outra loja";
  var nomes = nomesDoErro(err);
  var confira = nomes ? " Confira: " + nomes + "." : "";
  var msgBackend = err && err.data && typeof err.data.error === "string" ? err.data.error : null;
  switch (code) {
    case "ESTOQUE_INSUFICIENTE":
      return "Alguns itens não têm essa quantidade na loja agora (pode ter vendido no meio do caminho). Marcamos as linhas em vermelho: ajuste e confirme de novo." + confira;
    case "GRADE_DIFERENTE":
      return "Alguns produtos têm cores e tamanhos diferentes na " + loja + ". Marcamos em vermelho: confira o cadastro deles nas duas lojas e tente de novo." + confira;
    case "QUANTIDADE_INVALIDA":
      if (temMotivo(err, "servico")) {
        return (msgBackend || "Serviço não tem estoque para transferir.") + " Deixe vazio o que é serviço e confirme de novo.";
      }
      return "Alguma quantidade não está certa. Use números maiores que zero e confira as linhas." + confira;
    case "MESMA_LOJA":
      return "A loja de destino é a mesma de origem. Escolha outra loja.";
    case "NAO_E_DO_GRUPO":
      return "Essa loja não é do mesmo grupo, ou você não tem acesso para mexer no estoque dela. Escolha outra loja ou peça acesso ao dono.";
    case "ITEM_NAO_ENCONTRADO":
      if (temMotivo(err, "informe_a_variante")) {
        return "Um produto tem tamanhos e cores: abrimos a grade dele. Informe a quantidade em cada tamanho e cor e confirme de novo." + confira;
      }
      return "Um dos produtos não foi encontrado nesta loja (pode ter sido excluído). Feche, atualize o Estoque e tente de novo." + confira;
    case "TENTE_DE_NOVO":
      return MSG_TENTE_DE_NOVO;
    case "SCHEMA_PENDENTE":
      return MSG_SCHEMA_PENDENTE;
    default:
      if (err && err.isNetworkError) return "A conexão caiu antes da resposta. Confira em Transferências se ela entrou antes de tentar de novo.";
      return "Não conseguimos transferir agora. Tente de novo em instantes.";
  }
}

export function plural(n: number, um: string, varios: string): string {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 3 }) + " " + (n === 1 ? um : varios);
}

/** "nº 12" ou "nº 12 a 14" (lotes). */
export function textoDosNumeros(numeros: Array<string | number>): string {
  if (numeros.length === 0) return "";
  if (numeros.length === 1) return "nº " + numeros[0];
  return "nº " + numeros[0] + " a " + numeros[numeros.length - 1];
}

// ── Quem vê o "Transferir para outra loja" ─────────────────────────

type LojaDoSwitcher = { id: string; trade_name?: string | null; name?: string | null; legal_name?: string | null };

export function nomeDaLoja(c: LojaDoSwitcher | null | undefined): string {
  return String((c && (c.trade_name || c.name || c.legal_name)) || "Loja");
}

export type LojasDaTransferencia = {
  origem: { id: string; nome: string };
  destinos: Array<{ id: string; nome: string }>;
  nomes: Record<string, string>;
};

/**
 * null = não mostra o botão nem o histórico. Precisa: uma loja específica
 * (nunca o consolidado), pelo menos 2 lojas do grupo que o usuário acessa
 * (o switcher só lista essas), fora do modo consulta e do demo.
 */
export function lojasDaTransferencia(
  lojas: LojaDoSwitcher[] | null | undefined,
  companyId: string | null | undefined,
  ctx: { consolidado: boolean; consulta: boolean; demo: boolean; nomeAtual?: string | null },
): LojasDaTransferencia | null {
  var todas = lojas || [];
  if (!companyId || ctx.consolidado || ctx.consulta || ctx.demo || todas.length < 2) return null;
  var destinos = todas.filter(function (c) { return c.id !== companyId; }).map(function (c) { return { id: c.id, nome: nomeDaLoja(c) }; });
  if (destinos.length === 0) return null;
  var atual = todas.find(function (c) { return c.id === companyId; });
  var nomes: Record<string, string> = {};
  todas.forEach(function (c) { nomes[c.id] = nomeDaLoja(c); });
  return {
    origem: { id: companyId, nome: atual ? nomeDaLoja(atual) : String(ctx.nomeAtual || "Esta loja") },
    destinos: destinos,
    nomes: nomes,
  };
}
