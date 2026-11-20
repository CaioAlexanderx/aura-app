// ============================================================
// AURA. — Cadastro de item · "Em quais lojas este produto entra?"
//
// 20/11/2026 (plano empresa-do-produto, D1–D15; mockup aprovado). Regras
// puras, sem React, para o ItemFormModal e os testes.
//
// O QUE NÃO PODE MUDAR (D9): loja sem grupo, funcionário de uma loja só,
// resposta com menos de 2 lojas, erro ao ler a lista, edição, consolidado
// ou demo -> o campo não existe e o corpo do POST /products é o de hoje.
// A cópia para as outras lojas é uma chamada À PARTE, depois de tudo
// gravado na loja ativa (produto, grade, fornecedores, lotes e fotos).
// ============================================================
import type { LojaParaCadastro, PedidoDeCopia, ResultadoDaCopia, RespostaLojasParaCadastro } from "@/services/lojasDoProdutoApi";
import { normalizarChaveDaGrade, numeroDaCelula } from "./types";

export type ModoDoCampo = "nenhum" | "aviso" | "escolha";

export type CampoDeLojas = {
  modo: ModoDoCampo;
  /** A loja ativa primeiro; depois as outras, na ordem do servidor. */
  lojas: LojaParaCadastro[];
};

const NENHUM: CampoDeLojas = { modo: "nenhum", lojas: [] };

/**
 * O que o cadastro mostra. A loja ativa precisa estar na lista que o
 * servidor devolveu: sem ela não há loja de origem, e o campo some.
 */
export function campoDeLojas(resp: RespostaLojasParaCadastro | null | undefined, ativaId: string | null | undefined): CampoDeLojas {
  if (!resp || !ativaId || !Array.isArray(resp.lojas)) return NENHUM;
  const lojas = resp.lojas.filter((l) => l && l.company_id);
  // Uma loja por id (o servidor não deveria repetir; se repetir, a
  // contagem do botão mentiria).
  const vistos = new Set<string>();
  const unicas = lojas.filter((l) => {
    const id = String(l.company_id);
    if (vistos.has(id)) return false;
    vistos.add(id);
    return true;
  });
  if (unicas.length < 2) return NENHUM;
  const ativa = unicas.find((l) => String(l.company_id) === String(ativaId));
  if (!ativa) return NENHUM;
  const ordenadas = [ativa, ...unicas.filter((l) => l !== ativa)];
  return { modo: resp.estoque_unico ? "aviso" : "escolha", lojas: ordenadas };
}

/** Marcadas na ordem da lista (a ativa primeiro). */
export function lojasEscolhidas(campo: CampoDeLojas, marcadas: string[]): LojaParaCadastro[] {
  if (campo.modo !== "escolha") return [];
  const set = new Set(marcadas.map(String));
  return campo.lojas.filter((l) => set.has(String(l.company_id)));
}

export function pecasTxt(n: number): string {
  const v = Number(n) || 0;
  return v === 1 ? "1 peça" : fmtNumero(v) + " peças";
}

function fmtNumero(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n).replace(".", ",");
}

function juntarComE(itens: string[]): string {
  if (itens.length <= 1) return itens.join("");
  return itens.slice(0, -1).join(", ") + " e " + itens[itens.length - 1];
}

/** "Salvar nas 2 lojas" (mockup b e f). */
export function rotuloSalvarNasLojas(n: number): string {
  return "Salvar nas " + n + " lojas";
}

/** "Estoque mínimo (vale para as duas)" (mockup b). */
export function rotuloDoMinimo(n: number): string {
  return n === 2 ? "Estoque mínimo (vale para as duas)" : "Estoque mínimo (vale para as " + n + ")";
}

/** "Matriz · 12" no seletor da grade (mockup b). */
export function rotuloDaLojaNaGrade(nome: string, total: number): string {
  return nome + " · " + fmtNumero(Number(total) || 0);
}

export type FraseDoRodape = { antes: string; forte: string; depois: string };

/**
 * Rodapé do cadastro com o campo à vista (mockup a, b e f):
 *   1 loja:  "Entra na **Matriz**."
 *   N lojas: "Entra em **2 lojas**: Matriz (12) e Filial Centro (0)."
 *   celular: "Entra em **2 lojas**"
 * `qtd` null (serviço, lote): a lista sai sem os números.
 */
export function fraseDoRodape(
  lojas: Array<{ nome: string; qtd: number | null }>,
  narrow: boolean
): FraseDoRodape | null {
  if (!lojas.length) return null;
  if (lojas.length === 1) return { antes: "Entra na ", forte: lojas[0].nome, depois: "." };
  const forte = lojas.length + " lojas";
  if (narrow) return { antes: "Entra em ", forte, depois: "" };
  const lista = juntarComE(lojas.map((l) => (l.qtd == null ? l.nome : l.nome + " (" + fmtNumero(l.qtd) + ")")));
  return { antes: "Entra em ", forte, depois: ": " + lista + "." };
}

// ── resultado por loja (D15) ─────────────────────────────────

export type LinhaDoResultado = {
  company_id: string;
  nome: string;
  estado: "criando" | "criado" | "ja_existia" | "erro";
  texto: string;
  /** "Tentar de novo" (D15). Código já em uso não adianta repetir. */
  podeTentar: boolean;
  avisoFiscal: boolean;
};

export const TEXTO_CRIANDO = "Criando nesta loja…";
export const TEXTO_FALHA_GERAL = "Não deu para criar nesta loja. Tente de novo.";
export const TEXTO_JA_EXISTIA = "Já estava nesta loja";
export const TEXTO_AVISO_FISCAL = "Confira o fiscal deste produto nesta loja.";

export function textoDeCriado(pecas: number | null): string {
  return pecas == null ? "Criado" : "Criado com " + pecasTxt(pecas);
}

// Contrato, "Mudanças" de 20/11 (B1): repetir não resolve estes. Os outros
// (ERRO_AO_CRIAR, ou um código que o app ainda não conhece) têm "Tentar de novo".
const SEM_REPETIR_NA_LOJA = ["BARCODE_EM_USO", "CODIGO_EM_USO", "MESMA_LOJA", "SEM_ACESSO", "LIMITE_PLANO"];
// Erros do pedido inteiro (nada gravado): só estes valem repetir.
const REPETIR_O_PEDIDO = ["TENTE_DE_NOVO", "SCHEMA_PENDENTE"];

export function linhaDoResultado(r: ResultadoDaCopia): LinhaDoResultado {
  const avisoFiscal = Array.isArray(r.avisos) && r.avisos.indexOf("fiscal_conferir") >= 0;
  if (r.status === "criado") {
    return { company_id: r.company_id, nome: r.nome, estado: "criado", texto: textoDeCriado(Number(r.stock_qty) || 0), podeTentar: false, avisoFiscal };
  }
  if (r.status === "ja_existia") {
    return { company_id: r.company_id, nome: r.nome, estado: "ja_existia", texto: TEXTO_JA_EXISTIA, podeTentar: false, avisoFiscal };
  }
  const code = r.erro?.code || "";
  return {
    company_id: r.company_id, nome: r.nome, estado: "erro",
    texto: (r.erro?.message || "").trim() || TEXTO_FALHA_GERAL,
    podeTentar: SEM_REPETIR_NA_LOJA.indexOf(code) < 0,
    avisoFiscal,
  };
}

/**
 * Falha da chamada inteira: cada loja pedida vira erro. Sem resposta (rede,
 * 5xx) ou com TENTE_DE_NOVO: "Tentar de novo" e o texto geral. Recusa com
 * código (PRODUTO_COMPARTILHADO, VARIANTE_INVALIDA, SEM_ACESSO...): o texto
 * do servidor, sem repetir.
 */
export function linhasDeFalhaGeral(lojas: Array<{ company_id: string; nome: string }>, erro?: any): LinhaDoResultado[] {
  const code = String((erro && (erro.code || (erro.data && erro.data.code))) || "");
  const status = Number(erro && erro.status) || 0;
  const recusa = !!code && REPETIR_O_PEDIDO.indexOf(code) < 0 && status >= 400 && status < 500;
  const msg = recusa ? String((erro.data && erro.data.error) || erro.message || "").trim() : "";
  return lojas.map((l) => ({
    company_id: l.company_id, nome: l.nome, estado: "erro" as const,
    texto: msg || TEXTO_FALHA_GERAL, podeTentar: !recusa, avisoFiscal: false,
  }));
}

export function linhasCriando(lojas: Array<{ company_id: string; nome: string }>): LinhaDoResultado[] {
  return lojas.map((l) => ({
    company_id: l.company_id, nome: l.nome, estado: "criando" as const,
    texto: TEXTO_CRIANDO, podeTentar: false, avisoFiscal: false,
  }));
}

/** Troca, pelo id da loja, as linhas que voltaram; as outras ficam. */
export function mesclarResultado(atual: LinhaDoResultado[], novas: LinhaDoResultado[]): LinhaDoResultado[] {
  const porId: Record<string, LinhaDoResultado> = {};
  novas.forEach((l) => { porId[String(l.company_id)] = l; });
  const out = atual.map((l) => porId[String(l.company_id)] || l);
  // Loja que o servidor devolveu e não estava na tela (não deveria): entra no fim.
  novas.forEach((l) => { if (!atual.some((a) => String(a.company_id) === String(l.company_id))) out.push(l); });
  return out;
}

// ── corpo da cópia (POST …/products/:pid/lojas) ──────────────

/**
 * Variante da origem por chave da grade ("#HEX|M"), a partir do GET
 * /products/:pid/variants (atributos 'Cor' e 'Tamanho').
 */
export function idsDasVariantes(variants: Array<{ id: string; attributes?: Array<{ attribute: string; value: string }> }> | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  (variants || []).forEach((v) => {
    if (!v || !v.id) return;
    let cor: string | null = null;
    let tam: string | null = null;
    (v.attributes || []).forEach((a) => {
      const n = String(a?.attribute || "").toLowerCase();
      if (n === "cor" || n === "color") cor = a.value;
      else if (n === "tamanho" || n === "size") tam = a.value;
    });
    if (cor == null && tam == null) return;
    out[normalizarChaveDaGrade((cor || "") + "|" + (tam || ""))] = String(v.id);
  });
  return out;
}

export type EstoqueDaLojaNaCopia =
  | { tipo: "simples"; qtd: number }
  | { tipo: "grade"; matriz: Record<string, number> }
  | { tipo: "zero" };

/**
 * Monta o pedido. Com grade, cada combinação vai com o id da variante da
 * origem; combinação com peças e sem id (a grade da origem não voltou
 * inteira) faz o pedido falhar antes de sair, para não criar a loja com
 * estoque a menos sem ninguém saber.
 */
export function pedidoDeCopia(
  lojas: Array<{ company_id: string; estoque: EstoqueDaLojaNaCopia }>,
  idsPorChave: Record<string, string> | null
): { pedido: PedidoDeCopia; faltouVariante: boolean } {
  let faltou = false;
  const out = lojas.map((l) => {
    const e = l.estoque;
    if (e.tipo === "simples") return { company_id: l.company_id, stock_qty: Math.max(0, Number(e.qtd) || 0) };
    if (e.tipo === "zero") return { company_id: l.company_id, stock_qty: 0 };
    const variantes: Array<{ variant_id: string; stock_qty: number }> = [];
    let total = 0;
    Object.keys(e.matriz).forEach((k) => {
      const qtd = Math.max(0, numeroDaCelula(e.matriz[k]));
      const id = (idsPorChave || {})[normalizarChaveDaGrade(k)];
      if (!id) { if (qtd > 0) faltou = true; return; }
      variantes.push({ variant_id: id, stock_qty: qtd });
      total += qtd;
    });
    return { company_id: l.company_id, stock_qty: total, variantes };
  });
  return { pedido: { lojas: out }, faltouVariante: faltou };
}
