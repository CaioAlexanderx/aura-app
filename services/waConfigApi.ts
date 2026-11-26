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
  automaticas: (c: string) => `${base(c)}/automaticas`,
  divisao: (c: string) => `${base(c)}/automaticas/divisao`,
  automatica: (c: string, key: string) => `${base(c)}/automaticas/${key}`,
  publico: (c: string, key: string) => `${base(c)}/automaticas/${key}/publico`,
  enviarAgora: (c: string, key: string) => `${base(c)}/automaticas/${key}/enviar-agora`,
  modelos: (c: string) => `${base(c)}/modelos`,
  modeloValidar: (c: string, key: string) => `${base(c)}/modelos/${key}/validar`,
  modelo: (c: string, key: string) => `${base(c)}/modelos/${key}`,
  modeloRestaurar: (c: string, key: string) => `${base(c)}/modelos/${key}/restaurar`,
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

// ── Automáticas (agente B) ───────────────────────────────────
/** Partes da divisão das novidades. */
export type WaParte = "aniversario" | "venda_mais" | "crediario";
/** Chaves das automáticas (crediario_vender usa a parte `crediario`; crediario_cobrar usa AVISOS). */
export type WaAutoKey = "aniversario" | "venda_mais" | "crediario_cobrar" | "crediario_vender";

export interface WaPresenteRaw { tipo?: "percent" | "fixed" | (string & {}); valor?: number }

export interface WaAutomaticaRaw {
  key?: WaAutoKey | (string & {});
  ligada?: boolean | null;
  usa?: "novidades" | "avisos" | (string & {});
  parte?: WaParte | (string & {}) | null;
  /** Parte da divisão menos o já usado no mês. */
  livres?: number | null;
  config?: Record<string, any> | null;
  resumo?: string | null;
}

export interface WaNovidadesRaw {
  total?: number | null;
  livres?: number | null;
  divisao?: Partial<Record<WaParte, number>> | null;
  usadas?: Partial<Record<WaParte, number>> | null;
  sem_dono?: number | null;
}

export interface WaAutomaticasRaw {
  mes?: string | null;
  /** ISO do aceite das novidades; null = a pergunta ainda não foi respondida. */
  aceite_novidades_em?: string | null;
  novidades?: WaNovidadesRaw | null;
  automaticas?: WaAutomaticaRaw[] | null;
}

export interface WaPessoaRaw {
  customer_id?: string | null;
  nome?: string | null;
  iniciais?: string | null;
  detalhe?: string | null;
  motivo?: string | null;
}

/** GET /automaticas/:key/publico (Aniversário, Venda+, Crediário vender e cobrar). */
export interface WaPublicoRaw {
  key?: string | null;
  periodo?: string | null;
  elegiveis?: number | null;
  cabem?: number | null;
  ordem?: string | null;
  vao?: WaPessoaRaw[] | null;
  ficam_guardados?: number | null;
  guardados?: WaPessoaRaw[] | null;
  fora?: { recebeu_ha_menos_de_7_dias?: number | null; pediu_para_nao_receber?: number | null; sem_telefone?: number | null } | null;
  fora_lista?: WaPessoaRaw[] | null;
  falta_para_todos?: number | null;
  novidades_por_pessoa?: number | null;
  novidades_necessarias?: number | null;
  /** crediario_cobrar: quem recebe o aviso amanhã. */
  amanha?: { saem?: number | null; itens?: (WaPessoaRaw & { ponto?: string | null })[] | null } | null;
  avisos_livres?: number | null;
}

export interface WaEnviarAgoraRaw {
  enfileiradas?: number | null;
  guardadas?: number | null;
  sem_saldo?: boolean | null;
  puladas?: Record<string, number> | null;
}

// ── Modelos (16) ─────────────────────────────────────────────
export type WaModeloEstado = "PRONTA" | "EM_APROVACAO" | "NAO_APROVADA" | "AGUARDANDO_PADRAO" | (string & {});

export interface WaModeloRaw {
  key?: string | null;
  automatica?: "aniversario" | "venda_mais" | "crediario" | (string & {}) | null;
  titulo?: string | null;
  /** UTILITY = aviso; MARKETING = novidade. */
  categoria?: "UTILITY" | "MARKETING" | (string & {}) | null;
  /** Campos permitidos, como nomes: Nome, Parcela... (no texto: {Nome}). */
  campos?: string[] | null;
  texto_padrao?: string | null;
  /** O que VAI no envio (último aprovado; ou o padrão). */
  texto_em_uso?: string | null;
  texto_novo?: string | null;
  estado?: WaModeloEstado | null;
  motivo?: string | null;
  edicao?: { pode?: boolean | null; proxima_em?: string | null; restam_30_dias?: number | null } | null;
}

export interface WaCheckRaw {
  id?: string;
  ok?: boolean;
  texto?: string;
  correcao?: "PONTO_FINAL" | "SEPARAR" | "TIRAR_OFERTA" | (string & {}) | null;
  trecho?: string | null;
  usado?: number;
  limite?: number;
}

export interface WaValidacaoRaw {
  ok?: boolean;
  checks?: WaCheckRaw[] | null;
  texto_corrigido_sugerido?: string | null;
  previa?: string | null;
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
  // retry: 0 — compra não se repete sozinha (nem em 429 nem em falha de rede).
  comprarPacote: (companyId: string, bucket: WaBucket): Promise<WaCompraPacoteRaw> =>
    request<WaCompraPacoteRaw>(ROTAS.pacotes(companyId), { method: "POST", body: { bucket }, timeout: 20000, retry: 0 }),

  /** Últimos 12 pacotes (para mostrar o que está aguardando pagamento). */
  listarPacotes: (companyId: string): Promise<{ data?: WaPacoteRaw[] | null }> =>
    request<{ data?: WaPacoteRaw[] | null }>(ROTAS.pacotes(companyId)),

  getAutomaticas: (companyId: string): Promise<WaAutomaticasRaw> =>
    request<WaAutomaticasRaw>(ROTAS.automaticas(companyId)),

  /** 422 DIVISAO_ACIMA_DO_SALDO / DIVISAO_ABAIXO_DO_USADO. Resposta: o bloco `novidades`. */
  putDivisao: (companyId: string, divisao: Record<WaParte, number>): Promise<WaNovidadesRaw> =>
    request<WaNovidadesRaw>(ROTAS.divisao(companyId), { method: "PUT", body: divisao }),

  /** Liga/desliga e/ou muda a config. 409 SEM_ACEITE_NOVIDADES pede a pergunta; reenviar com aceite_novidades. */
  putAutomatica: (
    companyId: string, key: WaAutoKey,
    body: { ligada: boolean; config?: Record<string, any>; aceite_novidades?: boolean },
  ): Promise<WaAutomaticaRaw & { aceite_novidades_em?: string | null }> =>
    request(ROTAS.automatica(companyId, key), { method: "PUT", body }),

  getPublico: (companyId: string, key: WaAutoKey, segmento?: string): Promise<WaPublicoRaw> =>
    request<WaPublicoRaw>(ROTAS.publico(companyId, key) + (segmento ? `?segmento=${encodeURIComponent(segmento)}` : "")),

  /** Só venda_mais e crediario_vender. O servidor refaz o corte; a lista da tela não é aceita. */
  enviarAgora: (companyId: string, key: WaAutoKey, segmento?: string): Promise<WaEnviarAgoraRaw> =>
    request<WaEnviarAgoraRaw>(ROTAS.enviarAgora(companyId, key), { method: "POST", body: segmento ? { segmento } : {}, retry: 0 }),

  getModelos: (companyId: string, automatica?: string): Promise<{ data?: WaModeloRaw[] | null }> =>
    request<{ data?: WaModeloRaw[] | null }>(ROTAS.modelos(companyId) + (automatica ? `?automatica=${automatica}` : "")),

  validarModelo: (companyId: string, key: string, texto: string): Promise<WaValidacaoRaw> =>
    request<WaValidacaoRaw>(ROTAS.modeloValidar(companyId, key), { method: "POST", body: { texto } }),

  /** 202 {modelo, versao}. 422 TEXTO_INVALIDO, 429 EDICAO_LIMITE_24H/30D, 409 EM_APROVACAO. */
  enviarModelo: (companyId: string, key: string, texto: string): Promise<{ modelo?: WaModeloRaw | null; versao?: number | null }> =>
    request(ROTAS.modelo(companyId, key), { method: "PUT", body: { texto }, timeout: 20000, retry: 0 }),

  restaurarModelo: (companyId: string, key: string): Promise<WaModeloRaw> =>
    request<WaModeloRaw>(ROTAS.modeloRestaurar(companyId, key), { method: "POST", body: {}, retry: 0 }),
};
