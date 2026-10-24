// ============================================================
// AURA. — Configurações › E-mails (tq-89/tq-90, 24/10/2026)
//
// Aura-backend#896: rotas em /companies/:id/emails (src/routes/companyEmails.js).
//   GET    /                          preferências, endereços, plano, limites
//   PUT    /                          parcial, por tipo; devolve o estado inteiro
//   POST   /enderecos                 { email } grava o extra e manda o link
//   DELETE /enderecos/:enderecoId     remove o extra
//   GET    /ultimos                   últimos 30 dias do email_log
//   POST   /relatorio/enviar-agora    "Me enviar um agora" (3 por dia)
//
// Só o dono (ou a equipe Aura em modo admin): funcionário recebe 403
// EMAILS_FORBIDDEN. Migration 409 pendente: 503 MIGRATION_PENDING.
// Multi-CNPJ: vale a empresa da rota (a empresa ativa do app).
// ============================================================
import { request } from "./api";

export type BlocoRelatorio =
  | "vendas" | "mais_vendidos" | "pagamentos_estoque"
  | "crediario" | "equipe_margem" | "clientes" | "loja_online";

export type EnderecoEmail = {
  /** null no principal (e-mail do dono, sem linha na tabela). */
  id: string | null;
  email: string;
  principal: boolean;
  confirmado: boolean;
  confirmado_em: string | null;
  confirmacao_enviada_em: string | null;
};

export type PrefRelatorio = {
  ligado: boolean;
  explicito: boolean;
  /** 0 = domingo … 6 = sábado. */
  dia: number;
  hora: number;
  versao: "completa" | "resumo";
  blocos: BlocoRelatorio[];
  /** null = todos os confirmados. */
  destinatarios: string[] | null;
  /** Confirmados que recebem hoje (já filtrados pela marcação). */
  destinatarios_efetivos: string[];
};

export type PrefSimples = { ligado: boolean; explicito: boolean };

export type PrefPedidoLoja = {
  ligado: boolean;
  explicito: boolean;
  pedido_destino: "equipe" | "enderecos";
  destinatarios: string[] | null;
  destinatarios_efetivos: string[];
  pedido_destino_escolhido: boolean;
};

export type EstadoEmails = {
  remetente: string;
  plano: string;
  sempre_enviamos: string[];
  blocos: BlocoRelatorio[];
  blocos_do_plano: BlocoRelatorio[];
  enderecos: EnderecoEmail[];
  preferencias: {
    relatorio: PrefRelatorio;
    ajuda: PrefSimples;
    acompanhamento: PrefSimples;
    novidades: PrefSimples;
    pedido_loja: PrefPedidoLoja;
  };
  limites: { enderecos_extras: number; relatorio_agora_por_dia: number };
};

export type MudancasEmails = {
  relatorio?: Partial<{ ligado: boolean; dia: number; hora: number; versao: "completa" | "resumo"; blocos: BlocoRelatorio[]; destinatarios: string[] | null }>;
  ajuda?: { ligado: boolean };
  acompanhamento?: { ligado: boolean };
  novidades?: { ligado: boolean };
  pedido_loja?: Partial<{ ligado: boolean; pedido_destino: "equipe" | "enderecos"; destinatarios: string[] | null }>;
};

/** A situação vem pronta do backend; "entregue" só existe com o webhook do Resend ligado. */
export type SituacaoEmail = "enviado" | "entregue" | "devolvido" | "falhou";

export type EmailEnviado = {
  id: string;
  data: string;
  assunto: string | null;
  tipo: string;
  categoria: string;
  destinatario: string | null;
  situacao: SituacaoEmail;
  situacao_rotulo?: string;
};

export type UltimosEmails = { dias: number; webhook_ligado: boolean; emails: EmailEnviado[] };

export type RespostaEndereco = {
  endereco: { id: string; email: string; confirmado: boolean };
  /** 'sent' = link enviado agora; 'duplicate' = já enviado nesta hora. */
  confirmacao: "sent" | "duplicate" | "ja_confirmado" | string;
  estado: EstadoEmails;
};

function base(companyId: string) {
  return "/companies/" + companyId + "/emails";
}

export const emailsApi = {
  get: function(companyId: string) {
    return request<EstadoEmails>(base(companyId), { retry: 1 });
  },
  salvar: function(companyId: string, mudancas: MudancasEmails) {
    return request<EstadoEmails>(base(companyId), { method: "PUT", body: mudancas, retry: 0 });
  },
  adicionarEndereco: function(companyId: string, email: string) {
    return request<RespostaEndereco>(base(companyId) + "/enderecos", { method: "POST", body: { email: email }, retry: 0 });
  },
  removerEndereco: function(companyId: string, enderecoId: string) {
    return request<{ ok: boolean; estado: EstadoEmails }>(base(companyId) + "/enderecos/" + encodeURIComponent(enderecoId), { method: "DELETE", retry: 0 });
  },
  ultimos: function(companyId: string) {
    return request<UltimosEmails>(base(companyId) + "/ultimos", { retry: 1 });
  },
  // retry 0: o 429 do limite diário não pode virar novas tentativas.
  enviarAgora: function(companyId: string) {
    return request<{ ok: boolean; para: string; restantes: number }>(base(companyId) + "/relatorio/enviar-agora", { method: "POST", retry: 0, timeout: 30000 });
  },
};
