// ============================================================
// AURA. — POST /companies/:id/condicionais (C6/C7, 26/11/2026)
//
// Contrato: Aura-backend#1110. Guardar não é venda: não cria venda,
// lançamento nem movimento de caixa e não baixa estoque.
//
// Idempotency-Key no cabeçalho, a MESMA em toda nova tentativa de guardar a
// mesma condicional (erro de rede seguido de "Tentar de novo" e a repetição
// automática do request()): o servidor devolve a condicional já guardada em
// vez de criar outra.
//
// Respostas que a tela trata:
//   201 {condicional, avisos}  guardada; `avisos[].mensagem` vem para quem
//                              vende sem estoque;
//   409 COND_SEM_SALDO         {faltas:[{product_id, variant_id, nome,
//                              condicionais:[{numero_exibicao, customer_name,
//                              due_date}]}]}: nada foi guardado;
//   409 IDEMPOTENCY_KEY_REUSED a chave já guardou OUTRA condicional;
//   422 COND_*                 corpo recusado, com a frase pronta em `error`.
// ============================================================
import { request } from "@/services/api";

export type ItemDaCondicional = { product_id: string; variant_id?: string | null };

export type CorpoDaCondicional = {
  customer_id: string;
  customer_phone?: string | null;
  items: ItemDaCondicional[];
  /** AAAA-MM-DD. Ausente = o prazo padrão da loja. */
  due_date?: string | null;
  seller_id?: string | null;
  employee_id?: string | null;
  seller_name?: string | null;
  notes?: string | null;
};

export type ItemGuardado = {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  color_name?: string | null;
  size_label?: string | null;
  variant_label?: string | null;
  unit_price: number | string;
  situacao?: string;
};

export type CondicionalGuardada = {
  id: string;
  numero_exibicao: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  seller_name?: string | null;
  created_at?: string | null;
  due_date: string | null;
  terms?: string | null;
  items: ItemGuardado[];
  resumo?: { pecas?: number; valor_total?: number };
};

export type AvisoDaCondicional = { product_id?: string | null; variant_id?: string | null; nome?: string; mensagem?: string };

export type FaltaDaCondicional = {
  product_id: string | null;
  variant_id: string | null;
  nome: string;
  condicionais?: Array<{ id?: string; numero_exibicao: string; customer_name?: string | null; due_date?: string | null }>;
};

export type RespostaDoGuardar = {
  condicional: CondicionalGuardada;
  avisos?: AvisoDaCondicional[];
  idempotent_replay?: boolean;
};

export const condicionaisApi = {
  guardar(companyId: string, corpo: CorpoDaCondicional, chave: string): Promise<RespostaDoGuardar> {
    return request<RespostaDoGuardar>(`/companies/${companyId}/condicionais`, {
      method: "POST",
      body: corpo,
      headers: { "Idempotency-Key": chave },
    });
  },
};

/** As peças sem unidade livre do 409 COND_SEM_SALDO (ou null se for outro erro). */
export function faltasDoErro(e: any): FaltaDaCondicional[] | null {
  const code = e?.data?.code || e?.code;
  const faltas = e?.data?.faltas ?? e?.faltas;
  if (e?.status === 409 && code === "COND_SEM_SALDO" && Array.isArray(faltas)) return faltas as FaltaDaCondicional[];
  return null;
}

/** 422 COND_*: a frase pronta do servidor. */
export function frasePronta(e: any): string | null {
  const code = String(e?.data?.code || e?.code || "");
  if (e?.status === 422 && code.startsWith("COND_")) return e?.data?.error || e?.message || null;
  return null;
}
