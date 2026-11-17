// ============================================================
// AURA. — "Chegou mercadoria": contas e regras, sem tela
//
// Estimativa p-171, Fase 3. Tudo aqui é puro e testado em
// __tests__/chegouRegras.test.ts. As telas (ChegouMercadoriaModal e os
// passos) só leem o que estas funções devolvem.
// ============================================================
import type { Supplier } from "@/services/suppliersApi";

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
