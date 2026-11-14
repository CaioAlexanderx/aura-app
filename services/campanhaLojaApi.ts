import { request } from "@/services/api";

// ============================================================
// AURA. -- Campanha de Black Friday da loja online (p-120, 14/11/2026)
//
// Contrato com o backend (p-118, Aura-backend#1025, migration 451):
//   GET /companies/:cid/digital-channel/campanha   estado para a página
//   PUT /companies/:cid/digital-channel/campanha   { ativa?, titulo? }
// Por empresa (multi-CNPJ: cada CNPJ liga a sua). Ligar sem promoção no ar
// nem agendada: 409 BF_SEM_PROMOCAO (com texto gentil). Sem loja online:
// 409 SEM_LOJA_ONLINE. Sem a migration: 503 MIGRATION_PENDING. Essencial:
// 403 do plano. O "até N% OFF" é calculado no servidor e nunca editável.
// ============================================================

export type TituloDaCampanha = "black_friday" | "black_friday_da_loja" | "ofertas_de_novembro";

export type EstadoDaCampanha = {
  loja_online: { existe: boolean; publicada: boolean; slug: string | null };
  ativa: boolean;
  titulo: TituloDaCampanha;
  titulos: Array<{ id: TituloDaCampanha; texto: string }>;
  /** A faixa está na loja agora (ligada e com promoção no ar). */
  no_ar: boolean;
  /** Ligada, sem promoção no ar e com agendada: a faixa nasce sozinha. */
  agendada: boolean;
  promocoes: {
    no_ar: number;
    agendadas: number;
    ate_pct: number;
    /** "AAAA-MM-DD" do último fim entre as no ar, em Brasília. */
    ate_data: string | null;
    /** "AAAA-MM-DD" da primeira agendada, em Brasília. */
    comeca_em: string | null;
  };
  pode_ligar: boolean;
  periodo_padrao: { inicio: string; fim: string };
  /** p-122 (migration 453): o texto escrito pela loja (null = a opção pronta
   *  / o texto padrão), o título que a faixa mostra e os limites. Backend
   *  antigo: ausentes. */
  titulo_texto?: string | null;
  frase_texto?: string | null;
  titulo_final?: string;
  limites?: { titulo: number; frase: number };
};

export type MudancaDaCampanha = {
  ativa?: boolean;
  titulo?: TituloDaCampanha;
  /** p-122: null (ou vazio) volta à opção pronta. Inválido: 422 TEXTO_DA_FAIXA_INVALIDO. */
  titulo_texto?: string | null;
  frase_texto?: string | null;
};

export const campanhaLojaApi = {
  estado: (cid: string) => request<EstadoDaCampanha>(`/companies/${cid}/digital-channel/campanha`),
  salvar: (cid: string, body: MudancaDaCampanha) =>
    request<EstadoDaCampanha>(`/companies/${cid}/digital-channel/campanha`, { method: "PUT", body }),
};
