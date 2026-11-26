// ============================================================
// waConfigApi — a aba Configurações do WhatsApp (saldo, automáticas, modelos)
//
// Cliente do backend para a tela nova de 26/11/2026. TODAS as rotas
// desta tela moram neste arquivo, e os caminhos num objeto só (ROTAS),
// para trocar uma rota ser uma linha: os contratos do backend
// (contrato-saldo.md, do agente A; contrato-automaticas.md, do agente B)
// ainda não estavam no ar quando este arquivo nasceu, então os caminhos
// e os formatos abaixo são a melhor leitura do plano e podem mudar.
//
// Regra de ouro do arquivo: nada aqui "completa" resposta faltando. O que
// o servidor não mandou vira `null` na leitura (waSaldo.ts) e a tela
// trava. Na dúvida, bloqueia.
// ============================================================
import { request } from "@/services/api";

const base = (companyId: string) => `/companies/${companyId}/whatsapp`;

/** Caminhos desta tela. Trocar uma rota do backend = trocar uma linha aqui. */
export const ROTAS = {
  saldo: (c: string) => `${base(c)}/saldo`,
};

// ── Saldo ─────────────────────────────────────────────────────
/** Um dos três baldes. Tudo opcional: o que faltar a tela lê como "desconhecido". */
export interface WaSaldoBaldeRaw {
  total?: number | null;
  usado?: number | null;
  restante?: number | null;
}

export interface WaSaldoRaw {
  /** "AAAA-MM" do mês a que o saldo se refere (America/Sao_Paulo). */
  mes_ref?: string | null;
  /** "negocio" | "essencial" | ... Aberto a string. */
  plano?: string | null;
  /** Essencial: o saldo é o presente de boas-vindas (uma vez só, não renova). */
  presente_boas_vindas?: boolean | null;
  novidades?: WaSaldoBaldeRaw | null;
  avisos?: WaSaldoBaldeRaw | null;
  aurinha?: WaSaldoBaldeRaw | null;
}

export const waConfigApi = {
  getSaldo: (companyId: string): Promise<WaSaldoRaw> =>
    request<WaSaldoRaw>(ROTAS.saldo(companyId)),
};
