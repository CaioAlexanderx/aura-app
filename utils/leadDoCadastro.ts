// ============================================================
// Lead do cadastro por etapa e carimbo da Receita (tq-68, 21/10/2026)
//
// Lead (POST /auth/signup-lead, backend#886): a tela grava o lead ao
// concluir as etapas 1 e 2 para a equipe não perder quem abandona no meio.
// REGRA: o lead nunca trava o cadastro. `gravarLeadSemTravar` nunca lança:
// rede, 400, 404, 429, 503 ou rota ainda inexistente em produção viram um
// resultado que a tela ignora em silêncio. A tela chama sem await na
// navegação.
//
// Resultados:
//   ok               200 com lead_token (guarda para o register)
//   conta_existente  200 da etapa 1 com lead_token null: o backend só faz
//                    isso quando o lead daquele e-mail já virou conta
//   nao_encontrado   404 LEAD_NOT_FOUND nas etapas 2/3 (token velho)
//   falhou           todo o resto
// ============================================================

export type LeadEtapa1 = {
  etapa: 1; nome: string; email: string; terms_accepted: true; terms_version?: string; origem?: unknown;
};
export type LeadEtapa2 = { etapa: 2; lead_token: string; cnpj?: string; cpf?: string; company_name?: string };
export type LeadBody = LeadEtapa1 | LeadEtapa2;

export type ResultadoDoLead =
  | { tipo: "ok"; token: string }
  | { tipo: "conta_existente" }
  | { tipo: "nao_encontrado" }
  | { tipo: "falhou" };

export async function gravarLeadSemTravar(
  enviar: ((body: LeadBody) => Promise<{ lead_token?: string | null } | null | undefined>) | undefined,
  body: LeadBody,
): Promise<ResultadoDoLead> {
  try {
    if (typeof enviar !== "function") return { tipo: "falhou" };
    const r = await enviar(body);
    const token = r && typeof r.lead_token === "string" && r.lead_token ? r.lead_token : null;
    if (token) return { tipo: "ok", token };
    if (body.etapa === 1 && r && r.lead_token === null) return { tipo: "conta_existente" };
    return { tipo: "falhou" };
  } catch (err: any) {
    if (err && err.status === 404) return { tipo: "nao_encontrado" };
    return { tipo: "falhou" };
  }
}

// ── Carimbo da Receita ─────────────────────────────────────────
function rotuloDoRegime(raw?: string | null): string {
  const v = String(raw || "").toLowerCase();
  if (v === "mei") return "MEI";
  if (v === "simples" || v === "simples_nacional") return "Simples Nacional";
  if (v === "lucro_presumido") return "Lucro Presumido";
  if (v === "lucro_real") return "Lucro Real";
  return "";
}

/**
 * Linha de baixo do carimbo ("Modas da Maria · Campinas, SP · Simples
 * Nacional"), com o que a consulta trouxe. O regime só aparece quando a
 * Receita confirma (MEI pelo bloco do Simples, ou regime_confirmar !==
 * true): estimado não é afirmado.
 */
export function linhaDoCarimbo(data: any): string {
  if (!data || typeof data !== "object") return "";
  const partes: string[] = [];
  const fantasia = String(data.trade_name || data.nome_fantasia || "").trim();
  const razao = String(data.legal_name || data.razao_social || "").trim();
  if (fantasia && fantasia.toUpperCase() !== razao.toUpperCase()) partes.push(fantasia);
  const cidade = String(data.address_city || "").trim();
  const uf = String(data.address_state || "").trim();
  if (cidade) partes.push(uf ? cidade + ", " + uf : cidade);
  // is_mei vem do bloco do Simples da Receita (fonte confirmada).
  const regime = data.is_mei ? "MEI" : data.regime_confirmar !== true ? rotuloDoRegime(data.suggested_regime) : "";
  if (regime) partes.push(regime);
  return partes.join(" · ");
}
