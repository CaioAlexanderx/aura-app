// ============================================================
// Recebe na Aura — a situação da subconta em linguagem de loja (RA-06)
//
// Os quatro blocos da Asaas (GET /v3/myAccount/status/): dados comerciais,
// documentos, dados bancários e aprovação geral, cada um PENDING |
// AWAITING_APPROVAL | APPROVED | REJECTED. A tela diz o que falta e quem
// resolve (mockup aprovado, aba "Status da subconta"). Nenhuma frase
// promete prazo de aprovação: quem aprova é a Asaas.
// ============================================================
import type { RecebeBloco, RecebeBlocoKey, RecebeBlocoStatus, RecebeStatus } from "@/services/recebeApi";

export type Tom = "ok" | "warn" | "bad" | "neutro";

export const ORDEM_DOS_BLOCOS: RecebeBlocoKey[] = ["dados_comerciais", "documentos", "dados_bancarios", "geral"];

export const NOME_DO_BLOCO: Record<RecebeBlocoKey, string> = {
  dados_comerciais: "Dados da empresa",
  documentos: "Documentos",
  dados_bancarios: "Dados bancários",
  geral: "Situação geral",
};

export function pillDoBloco(key: RecebeBlocoKey, st: RecebeBlocoStatus): { tom: Tom; texto: string } {
  if (st === "APPROVED") return { tom: "ok", texto: "aprovado" };
  if (st === "AWAITING_APPROVAL") return { tom: "warn", texto: "em análise" };
  if (st === "REJECTED") return { tom: "bad", texto: "recusado" };
  if (st === "PENDING") {
    if (key === "documentos") return { tom: "bad", texto: "falta documento" };
    if (key === "geral") return { tom: "warn", texto: "aguardando" };
    return { tom: "bad", texto: "falta dado" };
  }
  return { tom: "neutro", texto: "sem leitura" };
}

/** O que a loja faz agora, por bloco. Sem prazo prometido. */
export function oQueFazer(key: RecebeBlocoKey, st: RecebeBlocoStatus): string {
  if (st === "APPROVED") return key === "geral" ? "Pronto. A loja online já pode receber." : "Nada.";
  if (st === "AWAITING_APPROVAL") return "Nada. A Asaas está conferindo.";
  if (st === "REJECTED") {
    return key === "geral"
      ? "A Asaas recusou a conta. Fale com a Asaas pelos canais abaixo."
      : "A Asaas recusou esta etapa. Fale com a Asaas pelos canais abaixo.";
  }
  if (st === "PENDING") {
    if (key === "dados_comerciais") return "Complete os dados da empresa.";
    if (key === "documentos") return "Envie os documentos que faltam.";
    if (key === "dados_bancarios") return "Informe a conta bancária para o saque.";
    return "Libera quando as etapas acima estiverem aprovadas.";
  }
  return "Aguardando a primeira leitura da Asaas.";
}

/** Precisa de ação da loja (botão de enviar documento etc.). */
export function pedeAcaoDaLoja(key: RecebeBlocoKey, st: RecebeBlocoStatus): boolean {
  return key !== "geral" && (st === "PENDING" || st === "REJECTED");
}

/** Selo do topo do cartão: ativo / ação sua / em análise. */
export function resumoDaConta(blocos: RecebeBloco[] | null): { tom: Tom; texto: string } {
  if (!blocos || blocos.length === 0) return { tom: "neutro", texto: "sem conta" };
  const geral = blocos.find((b) => b.key === "geral");
  if (geral && geral.status === "APPROVED") return { tom: "ok", texto: "ativo" };
  if (geral && geral.status === "REJECTED") return { tom: "bad", texto: "recusada" };
  if (blocos.some((b) => pedeAcaoDaLoja(b.key, b.status))) return { tom: "bad", texto: "ação sua" };
  return { tom: "warn", texto: "em análise" };
}

/** Sempre na ordem da tela, com bloco ausente como "sem leitura". */
export function blocosEmOrdem(blocos: RecebeBloco[] | null): RecebeBloco[] {
  return ORDEM_DOS_BLOCOS.map((key) => {
    const b = (blocos || []).find((x) => x.key === key);
    return { key, status: b ? b.status : null };
  });
}

// ── Prévia da equipe (QA) ─────────────────────────────────────
// Só para conta da equipe (is_staff gravado no usuário) quando o servidor
// responde que o produto está desligado. Os três estados do mockup.
export type CenarioDeExemplo = "analise" | "pendente" | "ok";

export function statusDeExemplo(c: CenarioDeExemplo): RecebeStatus {
  const b = (dc: RecebeBlocoStatus, doc: RecebeBlocoStatus, banco: RecebeBlocoStatus, geral: RecebeBlocoStatus): RecebeBloco[] => [
    { key: "dados_comerciais", status: dc },
    { key: "documentos", status: doc },
    { key: "dados_bancarios", status: banco },
    { key: "geral", status: geral },
  ];
  const blocks = c === "ok"
    ? b("APPROVED", "APPROVED", "APPROVED", "APPROVED")
    : c === "pendente"
      ? b("APPROVED", "PENDING", "APPROVED", "PENDING")
      : b("AWAITING_APPROVAL", "AWAITING_APPROVAL", "AWAITING_APPROVAL", "AWAITING_APPROVAL");
  return {
    enabled: true,
    product_name: "Recebe na Aura",
    status: c === "ok" ? "approved" : c === "pendente" ? "docs_pending" : "under_review",
    holder_type: "PJ",
    onboarding_url: null,
    account: null,
    blocks,
    blocks_updated_at: null,
    created_at: null,
  };
}
