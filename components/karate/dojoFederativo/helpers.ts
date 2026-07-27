// ============================================================
// Helpers — certificados/eventos/exames federativos (F5b)
//
// Traduz os códigos de skip do backend (Aura-backend#426) pra pt-BR
// acionável — cada motivo aparece junto do nome do aluno, ex.:
// "Ana Souza — já existe pedido para esta graduação".
//
// mapDojoFederativoError segue o mesmo racional de
// dojoAlunos/helpers.ts (mapFederationError), mas para as rotas
// federativas de certificados/eventos/exames (não vive lá porque é um
// domínio diferente — nunca mistura com o service de alunos).
//
// QA 27/07 (item 1): o backend distingue dois erros de infraestrutura
// que antes caíam ambos no fallback genérico de e.message (às vezes uma
// string em inglês/técnica, pouco acionável pro sensei):
//   • 503 SCHEMA_PENDING       — a migration/feature ainda não foi
//     habilitada neste ambiente. Ação: tentar mais tarde.
//   • 500 SQL_SCHEMA_MISMATCH  — o schema do banco não bate com o que o
//     backend espera (bug real). Ação: avisar o suporte.
// Mapeados explicitamente aqui pra nunca aparecer um erro cru na tela.
// ============================================================
import { SkipReasonCode } from "@/services/karateDojoFederativoApi";

const SKIP_REASON_PT: Record<string, string> = {
  ALUNO_NAO_FEDERADO: "aluno não é federado — federe-o antes de continuar",
  ALUNO_NAO_ENCONTRADO: "aluno não encontrado neste dojô",
  JA_INSCRITO: "já está inscrito neste evento",
  JA_SOLICITADO: "já existe um pedido para esta graduação",
  SEM_GRADUACAO: "sem graduação registrada",
  GRADUACAO_NAO_ENCONTRADA: "graduação informada não foi encontrada",
  EVENTO_FECHADO: "este evento não está mais aberto para inscrições",
  COMPETICAO_NAO_SUPORTADA: "competições não aceitam candidatos a exame de faixa",
  ID_INVALIDO: "identificador inválido",
};

/** Frase pt-BR pronta pra exibir junto do nome, ex.: "— já existe pedido para esta graduação". */
export function mapSkipReason(reason: SkipReasonCode, fallback?: string | null): string {
  return SKIP_REASON_PT[reason] || fallback || "não foi possível processar este item";
}

/** true quando a razão é "não federado" — usada pra oferecer o atalho de federar. */
export function isNaoFederadoReason(reason: SkipReasonCode): boolean {
  return reason === "ALUNO_NAO_FEDERADO";
}

/** Mapeia erros de chamada (409/403/500/503) das rotas federativas, pt-BR. */
export function mapDojoFederativoError(e: any): string {
  const code = e?.data?.code ?? e?.code ?? null;
  const status = e?.status;
  if (code === "DOJO_NAO_CONECTADO") {
    return "Seu dojô ainda não está conectado à federação — conecte primeiro para continuar.";
  }
  if (code === "PORTAL_READ_ONLY") {
    return "O portal do dojô é somente leitura. Entre com a conta do dojô para alterar dados.";
  }
  // 503: feature/migration ainda não habilitada neste ambiente — degrada,
  // não é bug. 500: schema não bate com o esperado pelo backend — é bug
  // real, vale avisar o suporte em vez de tentar de novo sozinho.
  if (code === "SCHEMA_PENDING" || status === 503) {
    return "O serviço está indisponível no momento. Tente novamente mais tarde.";
  }
  if (code === "SQL_SCHEMA_MISMATCH" || status === 500) {
    return "Não foi possível registrar o pedido — avise o suporte.";
  }
  return e?.message || "Não foi possível concluir. Tente de novo.";
}

/** 'YYYY-MM-DD' → 'DD/MM/AAAA' tz-safe (parse manual — nunca new Date() direto). */
export function fmtDataCurta(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = String(iso).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(iso);
  return `${m[3]}/${m[2]}/${m[1]}`;
}
