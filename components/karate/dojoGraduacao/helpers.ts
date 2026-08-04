// ============================================================
// Helpers — exame de faixa do dojô (F10)
//
// Traduz os códigos de erro do lote (karateDojoBeltExamService.js) e os
// motivos por aluno (certificado / espelho na federação) para pt-BR
// acionável. Mesmo racional de components/karate/dojoFederativo/helpers.ts,
// domínio diferente (nunca mistura os dois arquivos).
// ============================================================
import { QuesitoValue } from "@/services/karateDojoBeltExamApi";

// ── Os três quesitos: símbolo é apresentação, dado é o nome ────────────
export const QUESITO_SYMBOL: Record<QuesitoValue, string> = {
  circulo: "〇",
  triangulo: "△",
  quadrado: "□",
};

export const QUESITO_LABEL: Record<QuesitoValue, string> = {
  circulo: "Ótimo",
  triangulo: "Regular",
  quadrado: "A melhorar",
};

export const QUESITO_ORDER: QuesitoValue[] = ["circulo", "triangulo", "quadrado"];

/** "〇 Ótimo" / "—" quando ausente (ausente é neutro, nunca pendência). */
export function quesitoDisplay(v: QuesitoValue | null | undefined): string {
  if (!v) return "—";
  return `${QUESITO_SYMBOL[v]} ${QUESITO_LABEL[v]}`;
}

// ── Erros do lote (POST .../results, 422 — derruba o lote inteiro) ─────
// A mensagem do backend já vem pronta em pt-BR e explica o motivo
// concretamente (ex.: "Marrom tem 3 kyus — informe to_belt_kyu"); este
// mapa só dá um rótulo curto por código para agrupar/destacar.
const RESULT_ERROR_LABEL: Record<string, string> = {
  ID_INVALIDO: "Identificador inválido",
  ALUNO_DUPLICADO: "Aluno duplicado no lote",
  ALUNO_NAO_ENCONTRADO: "Aluno não encontrado neste dojô",
  RESULTADO_INVALIDO: "Resultado não informado",
  QUESITO_INVALIDO: "Quesito fora da escala",
  FAIXA_DESTINO_OBRIGATORIA: "Faixa de destino obrigatória",
  FAIXA_DESCONHECIDA: "Faixa fora da escala da FPKT",
  TETO_DO_SENSEI: "Acima do que o sensei pode conceder",
  GRAU_OBRIGATORIO: "Grau (kyu) obrigatório",
  GRAU_INVALIDO: "Grau (kyu) inválido",
  FAIXA_NAO_SUPERIOR: "Faixa de destino não é superior à atual",
  VALIDATION_ERROR: "Dado inválido",
};

export function resultErrorLabel(code: string): string {
  return RESULT_ERROR_LABEL[code] || "Pendência";
}

// ── Motivo do certificado NÃO ter sido pedido/criado (por aluno) ───────
const CERTIFICATE_REASON_PT: Record<string, string> = {
  ALUNO_NAO_FEDERADO: "aluno não é federado — certificado exige praticante federado",
  SEM_GRADUACAO_FEDERATIVA: "graduação não pôde ser espelhada na federação",
  DOJO_NAO_CONECTADO: "dojô não conectado à federação",
  JA_SOLICITADO: "já existe pedido ativo para esta graduação",
  SCHEMA_PENDING: "serviço de certificados indisponível no momento",
  ERRO: "não foi possível registrar o pedido — a graduação está registrada",
};

export function mapCertificateReason(reason: string | null, fallback?: string | null): string {
  if (!reason) return fallback || "";
  return CERTIFICATE_REASON_PT[reason] || fallback || "não foi possível processar o certificado";
}

// ── Motivo do espelho na federação (karate_belt_history) não ter sido criado ──
const BELT_HISTORY_SKIP_PT: Record<string, string> = {
  ALUNO_NAO_FEDERADO: "aluno não federado — fica registrado só no dojô",
  SEM_FEDERACAO: "dojô sem federação vinculada — fica registrado só no dojô",
};

export function mapBeltHistorySkipReason(reason: string | null): string | null {
  if (!reason) return null;
  return BELT_HISTORY_SKIP_PT[reason] || reason;
}

// ── Erros de chamada (409/403/500/503) das rotas de graduação ──────────
export function mapGraduacaoError(e: any): string {
  const code = e?.data?.code ?? e?.code ?? null;
  const status = e?.status;
  if (code === "PORTAL_READ_ONLY") {
    return "O portal do dojô é somente leitura. Entre com a conta do dojô para lançar graduações.";
  }
  if (code === "EXAME_CANCELADO") {
    return "Este exame foi cancelado — não é possível lançar resultado.";
  }
  if (code === "EXAME_NAO_EDITAVEL") {
    return e?.message || "Este exame não pode mais ser editado.";
  }
  if (code === "EXAME_CONCLUIDO") {
    return "Exame já concluído: as graduações foram registradas e o histórico de faixas é imutável.";
  }
  if (code === "SCHEMA_PENDING" || status === 503) {
    return "O serviço está indisponível no momento. Tente novamente mais tarde.";
  }
  if (code === "SQL_SCHEMA_MISMATCH" || code === "CHECK_VIOLATION" || status === 500) {
    return "Não foi possível registrar — avise o suporte. Nada foi gravado.";
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
