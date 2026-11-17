// ============================================================
// AURA. — "Chegou mercadoria": contas e regras, sem tela
//
// Estimativa p-171, Fase 3. Tudo aqui é puro e testado em
// __tests__/chegouRegras.test.ts. As telas (ChegouMercadoriaModal e os
// passos) só leem o que estas funções devolvem.
// ============================================================
import type { Supplier } from "@/services/suppliersApi";
import type { Product } from "@/components/screens/estoque/types";
import { previaDaEntrada, custoMuitoAcima, type PreviaDaEntrada } from "@/utils/entradaDeMercadoria";

// ── Chave contra entrar em dobro ─────────────────────────────
// Criada UMA vez ao abrir o wizard (padrão TrocaModal). O backend
// (Aura-backend#1056) aceita /^[A-Za-z0-9._:-]{8,100}$/ e devolve o
// resultado guardado quando a mesma chave chega de novo.
export const CHAVE_VALIDA = /^[A-Za-z0-9._:-]{8,100}$/;

export function novaChaveDaEntrada(): string {
  try {
    const c: any = (globalThis as any).crypto;
    if (c && typeof c.randomUUID === "function") {
      const k = String(c.randomUUID());
      if (CHAVE_VALIDA.test(k)) return k;
    }
  } catch {}
  const k = "chegou-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);
  return k.slice(0, 100);
}

// ── Pedaços de texto ─────────────────────────────────────────
export function semAcento(s: string): string {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** "aaaa-mm-dd…" (ou ISO com hora) → "dd/mm". Sem fuso: lê os dígitos. */
export function diaMes(iso: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  return m ? m[3] + "/" + m[2] : null;
}

/** Hora local "hh:mm" de um ISO com fuso. */
export function horaMinuto(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

/** Dia e mês locais de um ISO com fuso (a entrega das 23h de 12/11 é 12/11). */
export function diaMesLocal(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return diaMes(iso);
  return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0");
}

export function iniciais(nome: string): string {
  const partes = String(nome || "").trim().split(/\s+/)
    .filter((p) => (p.length > 1 || /\d/.test(p)) && !/^(de|da|do|das|dos|e)$/i.test(p));
  const letras = (partes.length >= 2 ? partes[0][0] + partes[1][0] : (partes[0] || "?").slice(0, 2));
  return letras.toUpperCase();
}

export const soDigitos = (v: string | null | undefined) => String(v || "").replace(/\D/g, "");

export function cnpjComMascara(v: string | null | undefined): string {
  const d = soDigitos(v);
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return String(v || "");
}

// ── Passo 1 · lista de fornecedores ──────────────────────────
export type FornecedorDaLista = Supplier & { last_delivery_at?: string | null };

const NO_PASSO = 6;
const NA_BUSCA = 8;

/**
 * O que o passo 1 mostra.
 * - Sem busca: os que receberam entrada nesta loja primeiro (mais recente
 *   antes, `last_delivery_at` do B3), depois os outros pelo nome. Título
 *   "Mais usados" só quando há pelo menos um com entrega.
 * - Com busca: nome, CNPJ (com ou sem máscara) ou vendedor, sem acento.
 */
export function fornecedoresDoPasso1(
  lista: FornecedorDaLista[] | null | undefined,
  busca: string,
): { maisUsados: boolean; itens: FornecedorDaLista[] } {
  const todos = (lista || []).filter((f) => f && f.is_active !== false);
  const q = semAcento(busca.trim());
  if (q) {
    const d = soDigitos(busca);
    const achados = todos.filter((f) =>
      semAcento(f.name).includes(q)
      || (f.contact_name ? semAcento(f.contact_name).includes(q) : false)
      || (d.length >= 3 && soDigitos(f.cnpj).includes(d)),
    );
    return { maisUsados: false, itens: achados.slice(0, NA_BUSCA) };
  }
  const ordenados = [...todos].sort((a, b) => {
    const ta = a.last_delivery_at ? Date.parse(a.last_delivery_at) : NaN;
    const tb = b.last_delivery_at ? Date.parse(b.last_delivery_at) : NaN;
    const va = Number.isFinite(ta), vb = Number.isFinite(tb);
    if (va && vb && ta !== tb) return tb - ta;
    if (va !== vb) return va ? -1 : 1;
    return semAcento(a.name).localeCompare(semAcento(b.name));
  });
  return {
    maisUsados: ordenados.some((f) => !!f.last_delivery_at),
    itens: ordenados.slice(0, NO_PASSO),
  };
}

// ── Escolha do fornecedor ────────────────────────────────────
/** null = ainda não escolheu (só no passo 1, ou no 2 depois do atalho da nota). */
export type EscolhaDoFornecedor =
  | { tipo: "existente"; fornecedor: FornecedorDaLista }
  | { tipo: "sem" }
  | null;

export function nomeDaEscolha(e: EscolhaDoFornecedor): string | null {
  return e && e.tipo === "existente" ? e.fornecedor.name : null;
}

/** Fornecedor da lista com o mesmo CNPJ (ou CPF) da nota. */
export function fornecedorPeloCnpj(lista: FornecedorDaLista[] | null | undefined, cnpj: string | null | undefined): FornecedorDaLista | null {
  const d = soDigitos(cnpj);
  if (!d) return null;
  return (lista || []).find((f) => f && f.is_active !== false && soDigitos(f.cnpj) === d) || null;
}

/**
 * Pendência 2 (Caio, 17/11): nota de outro CNPJ, perguntar sempre e nunca
 * trocar sozinho. A única troca automática é quando ainda não há escolha
 * nenhuma (atalho "Tem o arquivo da nota?"): aí a Aura ACHA o fornecedor
 * pelo CNPJ, não troca.
 */
export type ConferenciaDoEmitente =
  | { tipo: "ok" }
  | { tipo: "achou"; fornecedor: FornecedorDaLista }
  | {
      tipo: "perguntar";
      /** O que estava escolhido (null = nada; "sem" = seguiu sem fornecedor). */
      atual: EscolhaDoFornecedor;
      /** Cadastrado com o CNPJ da nota, ou null (aí o botão é "Cadastrar"). */
      achado: FornecedorDaLista | null;
    };

export function conferirEmitente(
  emitente: { nome: string; cnpj: string | null },
  escolha: EscolhaDoFornecedor,
  lista: FornecedorDaLista[] | null | undefined,
): ConferenciaDoEmitente {
  const cnpj = soDigitos(emitente.cnpj);
  const achado = cnpj ? fornecedorPeloCnpj(lista, cnpj) : null;
  if (escolha === null) return achado ? { tipo: "achou", fornecedor: achado } : { tipo: "perguntar", atual: null, achado: null };
  if (escolha.tipo === "sem") return { tipo: "perguntar", atual: escolha, achado };
  const doEscolhido = soDigitos(escolha.fornecedor.cnpj);
  if (!cnpj) return { tipo: "ok" };
  if (doEscolhido) return doEscolhido === cnpj ? { tipo: "ok" } : { tipo: "perguntar", atual: escolha, achado };
  // Escolhido sem CNPJ cadastrado: só pergunta se OUTRO fornecedor tem o CNPJ da nota.
  return achado && achado.id !== escolha.fornecedor.id ? { tipo: "perguntar", atual: escolha, achado } : { tipo: "ok" };
}

// ── Passo 2 · nota já lançada (A3) ───────────────────────────
export type EntradaAnterior = {
  /** ISO de quando entrou. */
  quando: string;
  fornecedor: string | null;
  /** Linhas (entrada nova) ou produtos (entrada antiga de um produto). */
  itens: number | null;
};

/**
 * A entrada anterior mais recente desta nota (GET /products/stock-receipts),
 * juntando as entradas novas e as antigas. null = nenhuma (ou a consulta
 * falhou: na dúvida, não trava a pessoa).
 */
export function entradaAnteriorDaNota(
  r: { receipts?: Array<{ created_at: string; supplier_name: string | null; lines?: number | null }>; legacy?: Array<{ created_at: string; supplier_name: string | null; products?: number | null }> } | null | undefined,
): EntradaAnterior | null {
  if (!r) return null;
  const todas: EntradaAnterior[] = [
    ...(r.receipts || []).map((x) => ({ quando: x.created_at, fornecedor: x.supplier_name || null, itens: x.lines ?? null })),
    ...(r.legacy || []).map((x) => ({ quando: x.created_at, fornecedor: x.supplier_name || null, itens: x.products ?? null })),
  ].filter((x) => x.quando && Number.isFinite(Date.parse(x.quando)));
  if (!todas.length) return null;
  todas.sort((a, b) => Date.parse(b.quando) - Date.parse(a.quando));
  return todas[0];
}

/** O que mandar para "nota já lançada?". null = nada para procurar. */
export function consultaDaNota(
  nota: { numero: string; chave: string | null } | null,
  escolha: EscolhaDoFornecedor,
): { nfe_key: string | null; invoice_number: string | null; supplier_id: string | null } | null {
  if (!nota) return null;
  const chave = nota.chave && nota.chave.length === 44 ? nota.chave : null;
  const numero = nota.numero ? nota.numero.trim() : "";
  if (!chave && !numero) return null;
  return {
    nfe_key: chave,
    invoice_number: numero || null,
    supplier_id: escolha && escolha.tipo === "existente" ? escolha.fornecedor.id : null,
  };
}

// ── Passo 3 · conferência (A4a) ──────────────────────────────
// Cada linha da nota (ou da planilha, no A6) acha o produto da loja, nesta
// ordem: código do fornecedor (GET /suppliers/:sid/codes, B3), código de
// barras (o do produto e os das variantes, `variant_barcodes`) e nome.
// Só casa quando a resposta é uma só: dois produtos com o mesmo código de
// barras ou o mesmo nome não casam sozinhos (a pessoa decide).

export type ItemParaConferir = {
  n: number;
  descricao: string;
  codigoFornecedor: string | null;
  codigoBarras: string | null;
  ncm: string | null;
  quantidade: number;
  custoUnitario: number;
  total: number;
};

export type ProdutoDaLoja = Pick<Product, "id" | "name" | "barcode" | "code" | "stock" | "cost" | "price" | "unit"> &
  Partial<Pick<Product, "has_variants" | "variant_barcodes">>;

export type ComoAchou = "codigo_fornecedor" | "codigo_barras" | "nome";

export type IndiceDosProdutos = {
  porId: Map<string, ProdutoDaLoja>;
  /** código de barras normalizado -> produtos (e se veio de uma variante). */
  porBarras: Map<string, Array<{ produto: ProdutoDaLoja; daVariante: boolean }>>;
  porNome: Map<string, ProdutoDaLoja[]>;
};

/** Só dígitos, sem zeros à esquerda (o GTIN-14 da nota casa com o EAN-13 do cadastro). */
export function normalizarBarras(v: string | null | undefined): string | null {
  const t = String(v || "").trim();
  if (!t) return null;
  if (/^\d+$/.test(t)) {
    const d = t.replace(/^0+/, "");
    return d.length >= 6 ? d : null;
  }
  return t.toUpperCase();
}

export function normalizarNome(v: string | null | undefined): string {
  return semAcento(String(v || "")).replace(/[^a-z0-9]+/g, " ").trim();
}

export function indexarProdutos(produtos: ProdutoDaLoja[] | null | undefined): IndiceDosProdutos {
  const porId = new Map<string, ProdutoDaLoja>();
  const porBarras = new Map<string, Array<{ produto: ProdutoDaLoja; daVariante: boolean }>>();
  const porNome = new Map<string, ProdutoDaLoja[]>();
  const pushBarras = (k: string | null, produto: ProdutoDaLoja, daVariante: boolean) => {
    if (!k) return;
    const lista = porBarras.get(k) || [];
    if (!lista.some((x) => x.produto.id === produto.id && x.daVariante === daVariante)) lista.push({ produto, daVariante });
    porBarras.set(k, lista);
  };
  for (const p of produtos || []) {
    if (!p || !p.id) continue;
    porId.set(p.id, p);
    pushBarras(normalizarBarras(p.barcode), p, false);
    for (const vb of p.variant_barcodes || []) pushBarras(normalizarBarras(vb), p, true);
    const nome = normalizarNome(p.name);
    if (nome) porNome.set(nome, [...(porNome.get(nome) || []), p]);
  }
  return { porId, porBarras, porNome };
}

export type ParDaLinha = { produto: ProdutoDaLoja; como: ComoAchou; daVariante: boolean };

export function acharProduto(
  item: Pick<ItemParaConferir, "descricao" | "codigoFornecedor" | "codigoBarras">,
  indice: IndiceDosProdutos,
  codigosDoFornecedor: Record<string, string> | null | undefined,
): ParDaLinha | null {
  const cod = item.codigoFornecedor ? item.codigoFornecedor.trim() : "";
  if (cod && codigosDoFornecedor && codigosDoFornecedor[cod]) {
    const p = indice.porId.get(codigosDoFornecedor[cod]);
    if (p) return { produto: p, como: "codigo_fornecedor", daVariante: false };
  }
  const barras = normalizarBarras(item.codigoBarras);
  if (barras) {
    const achados = indice.porBarras.get(barras) || [];
    const distintos = new Set(achados.map((a) => a.produto.id));
    if (distintos.size === 1) {
      // Código do próprio produto vale mais que o de uma variante dele.
      const doProduto = achados.some((a) => !a.daVariante);
      return { produto: achados[0].produto, como: "codigo_barras", daVariante: !doProduto };
    }
  }
  const nome = normalizarNome(item.descricao);
  const porNome = nome ? indice.porNome.get(nome) || [] : [];
  if (porNome.length === 1) return { produto: porNome[0], como: "nome", daVariante: false };
  return null;
}

/** Decisão da pessoa numa linha. Sem decisão = o que a Aura achou. */
export type DecisaoDaLinha =
  | { tipo: "novo"; nome: string; preco: number | null }
  | { tipo: "ligar"; produtoId: string | null }
  | { tipo: "fora" };

export type AjusteDaLinha = {
  /** Custo corrigido ("Corrigir o custo"). */
  custo?: number;
  /** "Está certo" no "Confere?". */
  custoConferido?: boolean;
  /** "Dizer quantos" na linha com quantidade zero. */
  quantidade?: number;
};

export type EstadoDaLinha =
  | "pronta"   // achou o produto (ou foi ligada): entra
  | "confere"  // pronta, mas o custo está bem acima do de costume (não trava)
  | "sem_par"  // não achou e ninguém decidiu (trava)
  | "novo"     // vai ser cadastrada (trava se faltar nome ou preço)
  | "ligar"    // a pessoa escolheu ligar e ainda não disse a qual (trava)
  | "grade"    // casou com produto de grade sem dizer a variante (trava)
  | "fora"     // a pessoa deixou de fora
  | "erro";    // quantidade zero: fica de fora sozinha e diz por quê

export type LinhaConferida = {
  item: ItemParaConferir;
  estado: EstadoDaLinha;
  /** Trava o "Dar entrada" (pendência 5). */
  falta: boolean;
  /** Entra na entrada. */
  entra: boolean;
  /** O que a Aura achou sozinha (null quando ligada à mão ou sem par). */
  par: ParDaLinha | null;
  /** Produto da linha: o achado ou o ligado. */
  produto: ProdutoDaLoja | null;
  quantidade: number;
  custo: number;
  previa: PreviaDaEntrada | null;
  decisao: DecisaoDaLinha | null;
};

export const MARGEM_PADRAO_DOS_NOVOS = 100;

/** Preço sugerido para o produto novo (pendência 6: obrigatório e sugerido). */
export function precoSugerido(custo: number | null | undefined, margemPct: number = MARGEM_PADRAO_DOS_NOVOS): number | null {
  const c = Number(custo);
  if (!(c > 0)) return null;
  return Math.round(c * (1 + (Number(margemPct) || 0) / 100) * 100) / 100;
}

/**
 * Decisão "Cadastrar novo" já preenchida: nome da nota e preço pela margem.
 * Quem não vê custo não recebe sugestão (o preço entregaria o custo).
 */
export function decisaoDeNovo(item: Pick<ItemParaConferir, "descricao" | "custoUnitario">, semCusto: boolean): DecisaoDaLinha {
  return { tipo: "novo", nome: item.descricao.trim(), preco: semCusto ? null : precoSugerido(item.custoUnitario) };
}

export function conferirLinha(
  item: ItemParaConferir,
  ctx: {
    indice: IndiceDosProdutos;
    codigos: Record<string, string> | null | undefined;
    decisao?: DecisaoDaLinha | null;
    ajuste?: AjusteDaLinha | null;
    semCusto: boolean;
  },
): LinhaConferida {
  const ajuste = ctx.ajuste || {};
  const decisao = ctx.decisao || null;
  const quantidade = ajuste.quantidade !== undefined ? ajuste.quantidade : item.quantidade;
  const custo = ajuste.custo !== undefined ? ajuste.custo : item.custoUnitario;
  const base = { item, quantidade, custo, decisao, par: null as ParDaLinha | null, produto: null as ProdutoDaLoja | null, previa: null as PreviaDaEntrada | null };

  if (!(quantidade > 0)) return { ...base, estado: "erro", falta: false, entra: false };
  if (decisao && decisao.tipo === "fora") return { ...base, estado: "fora", falta: false, entra: false };
  if (decisao && decisao.tipo === "novo") {
    const completo = !!decisao.nome.trim() && Number(decisao.preco) > 0;
    return { ...base, estado: "novo", falta: !completo, entra: completo };
  }
  if (decisao && decisao.tipo === "ligar") {
    const p = decisao.produtoId ? ctx.indice.porId.get(decisao.produtoId) : undefined;
    if (!p) return { ...base, estado: "ligar", falta: true, entra: false };
    return linhaComProduto(base, p, ctx.semCusto, ajuste);
  }
  const par = acharProduto(item, ctx.indice, ctx.codigos);
  if (!par) return { ...base, estado: "sem_par", falta: true, entra: false };
  if (par.produto.has_variants && par.daVariante === false) {
    return { ...base, par, produto: par.produto, estado: "grade", falta: true, entra: false };
  }
  return linhaComProduto({ ...base, par }, par.produto, ctx.semCusto, ajuste);
}

function linhaComProduto(
  base: Omit<LinhaConferida, "estado" | "falta" | "entra">,
  produto: ProdutoDaLoja,
  semCusto: boolean,
  ajuste: AjusteDaLinha,
): LinhaConferida {
  const custoAtual = Number(produto.cost) > 0 ? Number(produto.cost) : null;
  const previa = previaDaEntrada({
    estoqueAntes: Number(produto.stock) || 0,
    custoAtual,
    quantidade: base.quantidade,
    custoUnitario: semCusto ? null : base.custo,
    preco: Number(produto.price) || null,
  });
  const acima = !semCusto && !ajuste.custoConferido && custoMuitoAcima(custoAtual, base.custo);
  return { ...base, produto, previa, estado: acima ? "confere" : "pronta", falta: false, entra: true };
}

export type ResumoDaConferencia = {
  itens: number;
  prontos: number;
  novos: number;
  falta: number;
  fora: number;
  /** Linhas que entram ao confirmar (prontas + novos completos). */
  entram: number;
  /** Soma das linhas como vieram (vProd − vDesc). */
  totalDosItens: number;
  /** null = a nota não traz o total; true/false = bate ou não (1 centavo). */
  bate: boolean | null;
  podeDarEntrada: boolean;
};

export function resumirConferencia(linhas: LinhaConferida[], totalDaNota: number | null | undefined): ResumoDaConferencia {
  let prontos = 0, novos = 0, falta = 0, fora = 0, entram = 0, total = 0;
  for (const l of linhas) {
    total += Number(l.item.total) || 0;
    if (l.estado === "pronta" || l.estado === "confere") prontos++;
    if (l.estado === "novo") novos++;
    if (l.falta) falta++;
    if (l.estado === "fora" || l.estado === "erro") fora++;
    if (l.entra) entram++;
  }
  const totalDosItens = Math.round(total * 100) / 100;
  const bate = totalDaNota === null || totalDaNota === undefined ? null : Math.abs(totalDosItens - Number(totalDaNota)) < 0.011;
  return { itens: linhas.length, prontos, novos, falta, fora, entram, totalDosItens, bate, podeDarEntrada: falta === 0 && entram > 0 };
}

/**
 * O que fica à vista e o que fica atrás de "Mostrar os outros n": as linhas
 * que pedem atenção ficam todas à vista; das prontas sem aviso, as primeiras
 * `prontasVisiveis` (na ordem da nota).
 */
export function linhasVisiveis(linhas: LinhaConferida[], mostrarTodas: boolean, prontasVisiveis = 3): { visiveis: LinhaConferida[]; escondidas: number } {
  if (mostrarTodas) return { visiveis: linhas, escondidas: 0 };
  let vistas = 0;
  let escondidas = 0;
  const visiveis: LinhaConferida[] = [];
  for (const l of linhas) {
    if (l.estado !== "pronta") { visiveis.push(l); continue; }
    if (vistas < prontasVisiveis) { visiveis.push(l); vistas++; } else escondidas++;
  }
  // Esconder uma só não vale o botão.
  if (escondidas === 1) return { visiveis: linhas, escondidas: 0 };
  return { visiveis, escondidas };
}

/** O que o rodapé do passo 3 diz (pendência 5: linha sem decisão trava). */
export type MotivoDoRodape =
  | { tipo: "faltam"; n: number }
  | { tipo: "falta_ligar"; nome: string }
  | { tipo: "falta_grade"; nome: string }
  | { tipo: "nada" }
  | { tipo: "pronto"; n: number };

export function motivoDoRodape(linhas: LinhaConferida[], resumo: ResumoDaConferencia): MotivoDoRodape {
  if (resumo.falta === 1) {
    const l = linhas.find((x) => x.falta)!;
    if (l.estado === "ligar") return { tipo: "falta_ligar", nome: l.item.descricao };
    if (l.estado === "grade") return { tipo: "falta_grade", nome: (l.produto && l.produto.name) || l.item.descricao };
  }
  if (resumo.falta > 0) return { tipo: "faltam", n: resumo.falta };
  if (resumo.entram === 0) return { tipo: "nada" };
  return { tipo: "pronto", n: resumo.entram };
}
