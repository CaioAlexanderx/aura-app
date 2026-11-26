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
  automaticas: (c: string) => `${base(c)}/automaticas`,
  divisao: (c: string) => `${base(c)}/automaticas/divisao`,
  ligada: (c: string, key: string) => `${base(c)}/automaticas/${key}/ligada`,
  automatica: (c: string, key: string) => `${base(c)}/automaticas/${key}`,
  config: (c: string, key: string) => `${base(c)}/automaticas/${key}/config`,
  enviar: (c: string, key: string) => `${base(c)}/automaticas/${key}/enviar`,
  modelos: (c: string) => `${base(c)}/modelos`,
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

// ── Automáticas ───────────────────────────────────────────────
export type WaAutoKey = "aniversario" | "vendamais" | "crediario";

export interface WaAutomaticaRaw {
  ligada?: boolean | null;
  /** Linhas de resumo já calculadas pelo servidor ("11 clientes aptos hoje"). */
  linhas?: string[] | null;
}

export interface WaAutomaticasRaw {
  /** Divisão das novidades do mês entre as três. */
  divisao?: Partial<Record<WaAutoKey, number>> | null;
  /** Quanto cada parte já gastou no mês. */
  usadas?: Partial<Record<WaAutoKey, number>> | null;
  automaticas?: Partial<Record<WaAutoKey, WaAutomaticaRaw>> | null;
}

/** Uma pessoa da prévia, já na ordem do corte (mais compra / mais limite livre). */
export interface WaPessoaRaw {
  nome?: string | null;
  detalhe?: string | null;
}

export interface WaPreviaRaw {
  /** Quem entra no corte, na ordem declarada. Pode ser só uma amostra. */
  pessoas?: WaPessoaRaw[] | null;
  /** Total de aptos (maior que `pessoas` quando o servidor manda amostra). */
  total?: number | null;
  /** Novidades que ainda sobram para esta automática no mês. */
  reserva?: number | null;
  /** Mensagens por cliente com a configuração atual (Aniversário: 1 a 3). */
  por_cliente?: number | null;
  /** Fora por motivo (Venda+): recebeu há menos de 7 dias, pediu para sair, sem telefone. */
  fora?: { recente?: number | null; sair?: number | null; sem_telefone?: number | null } | null;
  /** Frase de exemplo já montada com um cliente real, para a bolha. */
  mensagem?: string | null;
}

export interface WaAutomaticaDetalheRaw {
  /** Escolhas da lojista (tom, presente, passos...). Formato por automática. */
  config?: Record<string, any> | null;
  previa?: WaPreviaRaw | null;
}

export type WaModeloEstado = "pronta" | "em_aprovacao" | "aprovado" | "nao_aprovado" | (string & {});

export interface WaModeloRaw {
  chave?: string | null;
  /** Automática a que o modelo pertence. */
  grupo?: WaAutoKey | (string & {}) | null;
  titulo?: string | null;
  /** Texto que vale hoje (o da Aura ou o último aprovado). */
  texto?: string | null;
  estado?: WaModeloEstado | null;
  /** Texto novo esperando a aprovação do WhatsApp. */
  texto_pendente?: string | null;
  /** Por que o WhatsApp não aprovou, já em português. */
  motivo?: string | null;
}

export const waConfigApi = {
  getSaldo: (companyId: string): Promise<WaSaldoRaw> =>
    request<WaSaldoRaw>(ROTAS.saldo(companyId)),

  getAutomaticas: (companyId: string): Promise<WaAutomaticasRaw> =>
    request<WaAutomaticasRaw>(ROTAS.automaticas(companyId)),

  /** O servidor recusa uma divisão cuja soma passe do saldo (resposta 4xx). */
  putDivisao: (companyId: string, divisao: Record<WaAutoKey, number>): Promise<WaAutomaticasRaw> =>
    request<WaAutomaticasRaw>(ROTAS.divisao(companyId), { method: "PUT", body: divisao }),

  setLigada: (companyId: string, key: WaAutoKey, ligada: boolean): Promise<WaAutomaticasRaw> =>
    request<WaAutomaticasRaw>(ROTAS.ligada(companyId, key), { method: "PUT", body: { ligada } }),

  /** Escolhas + prévia (quem cabe) de uma automática. */
  getAutomatica: (companyId: string, key: WaAutoKey): Promise<WaAutomaticaDetalheRaw> =>
    request<WaAutomaticaDetalheRaw>(ROTAS.automatica(companyId, key)),

  /** Salva só o que mudou; a resposta traz a prévia refeita. */
  putConfig: (companyId: string, key: WaAutoKey, patch: Record<string, any>): Promise<WaAutomaticaDetalheRaw> =>
    request<WaAutomaticaDetalheRaw>(ROTAS.config(companyId, key), { method: "PUT", body: patch }),

  /** Manda agora para quem cabe. `quantidade` é o que a tela prometeu; o servidor refaz o corte. */
  enviarAgora: (companyId: string, key: WaAutoKey, quantidade: number): Promise<{ enfileiradas?: number | null }> =>
    request<{ enfileiradas?: number | null }>(ROTAS.enviar(companyId, key), { method: "POST", body: { quantidade } }),

  getModelos: (companyId: string): Promise<{ data?: WaModeloRaw[] | null }> =>
    request<{ data?: WaModeloRaw[] | null }>(ROTAS.modelos(companyId)),
};
