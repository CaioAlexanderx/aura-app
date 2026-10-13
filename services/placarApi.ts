// ============================================================
// AURA. — Placar do dia no WhatsApp do dono (13/10/2026)
//
// Aura-backend#816: GET/PUT /companies/:id/placar-do-dia. O placar é o resumo
// de fim de dia (vendas, ticket médio, item mais vendido, comparação com o
// mês anterior e crediário recebido) enviado ao dono pelo WhatsApp da loja.
// Default desligado; sem `always` só roda na temporada (01/11/2026 a
// 31/01/2027). O GET já traz o que falta para o envio funcionar.
//   PUT: só dono/admin (403 PLACAR_FORBIDDEN); 503 MIGRATION_PENDING.
// ============================================================
import { request } from "./api";

export type PlacarDoDia = {
  enabled: boolean;
  always: boolean;
  season: { starts_at: string; ends_at: string };
  /** Hoje está dentro da temporada (independe de estar ligado). */
  in_season_today: boolean;
  whatsapp_connected: boolean;
  owner_phone_present: boolean;
  template_name: string;
  template_approved: boolean;
};

export const placarApi = {
  get: function(companyId: string) {
    return request<PlacarDoDia>("/companies/" + companyId + "/placar-do-dia");
  },
  /** `always` omitido mantém o valor que a loja já tinha. */
  save: function(companyId: string, body: { enabled: boolean; always?: boolean }) {
    return request<PlacarDoDia>("/companies/" + companyId + "/placar-do-dia", { method: "PUT", body: body, retry: 0 });
  },
};
