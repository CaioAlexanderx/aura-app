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
    /** p-123a: peças com promoção (no ar ou agendada) que a loja online NÃO
     *  mostra (fora da vitrine, sem foto, sem estoque). Os números acima
     *  contam só o que a loja mostra. Backend antigo: ausente. */
    fora_da_loja?: number;
  };
  pode_ligar: boolean;
  periodo_padrao: { inicio: string; fim: string };
};

export type MudancaDaCampanha = { ativa?: boolean; titulo?: TituloDaCampanha };

/** Por que a peça não aparece na loja online (GET /campanha/fora-da-loja). */
export type MotivoForaDaLoja = "fora_da_vitrine" | "sem_foto" | "sem_estoque";

export const campanhaLojaApi = {
  estado: (cid: string) => request<EstadoDaCampanha>(`/companies/${cid}/digital-channel/campanha`),
  salvar: (cid: string, body: MudancaDaCampanha) =>
    request<EstadoDaCampanha>(`/companies/${cid}/digital-channel/campanha`, { method: "PUT", body }),
  /** As peças que a loja online não mostra, com o motivo (p-123a). */
  foraDaLoja: (cid: string) =>
    request<{ produtos: Array<{ id: string; motivo: MotivoForaDaLoja }> }>(`/companies/${cid}/digital-channel/campanha/fora-da-loja`)
      .then(function (r) {
        var mapa: Record<string, MotivoForaDaLoja> = {};
        ((r && r.produtos) || []).forEach(function (p) { if (p && p.id) mapa[String(p.id)] = p.motivo; });
        return mapa;
      }),
};
