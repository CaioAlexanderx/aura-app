// ============================================================
// waConfigApi — a aba Configurações do WhatsApp (saldo, automáticas, modelos)
//
// Cliente do backend para a tela nova de 26/11/2026. TODAS as rotas
// desta tela moram neste arquivo, e os caminhos num objeto só (ROTAS),
// para trocar uma rota ser uma linha.
//
// - Saldo e pacotes: `contrato-saldo.md` (agente A; Aura-backend #1132/#1134).
// - Automáticas e modelos: `contrato-automaticas.md` (agente B).
//
// Regra de ouro do arquivo: nada aqui "completa" resposta faltando. O que
// o servidor não mandou vira `null` na leitura e a tela trava. Na dúvida,
// bloqueia.
// ============================================================
import { request } from "@/services/api";

const base = (companyId: string) => `/companies/${companyId}/whatsapp`;

/** Caminhos desta tela. Trocar uma rota do backend = trocar uma linha aqui. */
export const ROTAS = {
  saldo: (c: string) => `${base(c)}/saldo`,
  pacotes: (c: string) => `${base(c)}/saldo/pacotes`,
};

// ── Saldo (agente A) ─────────────────────────────────────────
export type WaBucket = "novidades" | "avisos" | "aurinha";

/** Um dos três saldos. Tudo opcional: o que faltar a tela lê como "desconhecido". */
export interface WaSaldoBaldeRaw {
  bucket?: WaBucket | (string & {}) | null;
  /** Somados das fontes (franquia, boas-vindas, pacote). */
  total?: number | null;
  usado?: number | null;
  restante?: number | null;
  /** restante > 0 e <= 20% do total. */
  baixo?: boolean | null;
  /** restante == 0. */
  esgotado?: boolean | null;
  /** Chave do aviso de 20% ("novidades:2026-11"): a tela avisa uma vez por chave. */
  aviso_chave?: string | null;
  /** null no Essencial sem add-on (o saldo não volta sozinho). */
  renova_em?: string | null;
  /** "NUMERO_EM_ATENCAO" (só novidades). */
  bloqueado_por?: string | null;
  /** O que a tela oferece comprar. */
  pacote?: { qty?: number | null; preco_centavos?: number | null } | null;
}

export interface WaSaldoRaw {
  /** Trava WA_SALDO_ATIVO. Desligado: as guardas antigas valem; a leitura segue. */
  ativo?: boolean | null;
  /** "AAAA-MM" (America/Sao_Paulo). */
  mes?: string | null;
  renova_em?: string | null;
  plano?: { renova?: boolean | null; origem?: "plano" | "addon" | "vertical" | "essencial" | (string & {}) | null } | null;
  numero?: { em_atencao?: boolean | null; motivo?: "QUALIDADE" | "PAUSA" | (string & {}) | null } | null;
  saldos?: { novidades?: WaSaldoBaldeRaw | null; avisos?: WaSaldoBaldeRaw | null; aurinha?: WaSaldoBaldeRaw | null } | null;
}

// ── Pacotes (agente A, #1134) ────────────────────────────────
export interface WaPacoteRaw {
  id?: string;
  bucket?: WaBucket | (string & {});
  qty?: number;
  price_cents?: number | null;
  status?: "pending" | "active" | "cancelled" | (string & {});
  payment_url?: string | null;
}

export interface WaCompraPacoteRaw {
  pack?: WaPacoteRaw | null;
  /** Pix/link da Asaas. Só credita depois do pagamento confirmado. */
  payment_url?: string | null;
  /** Sem cliente Asaas ou Asaas fora: fica pendente e a Gestão ativa. */
  needs_manual?: boolean | null;
}

/** Erro do servidor já lido: frase para a lojista + código + extras (ex.: proxima_em). */
export interface ErroConfig { code: string | null; message: string; data: any }

export function erroConfig(e: any, fallback: string = "Não consegui falar com o servidor agora. Tente de novo."): ErroConfig {
  const data = e?.data && typeof e.data === "object" ? e.data : {};
  const code = data.code ?? e?.code ?? null;
  const message = typeof data.error === "string" && data.error ? data.error : fallback;
  return { code, message, data };
}

export const waConfigApi = {
  getSaldo: (companyId: string): Promise<WaSaldoRaw> =>
    request<WaSaldoRaw>(ROTAS.saldo(companyId)),

  /** Preço e quantidade vêm do servidor. NUNCA cobra sozinho: devolve o link de pagamento. */
  comprarPacote: (companyId: string, bucket: WaBucket): Promise<WaCompraPacoteRaw> =>
    request<WaCompraPacoteRaw>(ROTAS.pacotes(companyId), { method: "POST", body: { bucket }, timeout: 20000 }),

  /** Últimos 12 pacotes (para mostrar o que está aguardando pagamento). */
  listarPacotes: (companyId: string): Promise<{ data?: WaPacoteRaw[] | null }> =>
    request<{ data?: WaPacoteRaw[] | null }>(ROTAS.pacotes(companyId)),
};
