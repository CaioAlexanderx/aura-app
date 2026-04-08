import { Colors } from "@/constants/colors";

export type ObligationStatus = "done" | "progress" | "pending" | "overdue" | "future";
export type FilterLabel = "aura_resolve" | "voce_faz";
export type AlertLevel = "overdue" | "critical" | "warning" | "info" | null;

export type Obligation = {
  code: string;
  name: string;
  frequency: string;
  due_date: string | null;
  filter_label: FilterLabel;
  aura_action: string;
  user_action: string | null;
  status: ObligationStatus;
  checkpoint_done: number;
  checkpoint_total: number;
  alert_level: AlertLevel;
  days_until_due: number | null;
  estimated_amount?: number | null;
  steps?: Step[];
};

export type Step = { text: string; auto: boolean; hint: string };

export type CalendarResponse = {
  company: { id: string; name: string; tax_regime: string; has_employee: boolean; cnae_category: string };
  calendar: Obligation[];
  summary: { aura_resolve: number; voce_faz: number; overdue: number; upcoming: number };
};

export type AutoFeature = { name: string; desc: string; icon: string };

export const AURA_AUTO_FEATURES: Record<string, AutoFeature[]> = {
  mei: [
    { name: "Monitor de faturamento", desc: "Acompanha seu faturamento vs limite de R$ 81 mil/ano e alerta se ultrapassar 80%.", icon: "$" },
    { name: "Alertas de vencimento", desc: "Notificacoes automaticas 15, 7 e 3 dias antes de cada vencimento.", icon: "!" },
    { name: "Resumo gerencial", desc: "Relatorio mensal gerado automaticamente com receitas, despesas e resultado.", icon: "#" },
  ],
  simples: [
    { name: "Alertas de vencimento", desc: "Notificacoes automaticas 15, 7 e 3 dias antes de cada vencimento.", icon: "!" },
    { name: "Resumo gerencial", desc: "Relatorio mensal gerado automaticamente com dados financeiros.", icon: "#" },
    { name: "Monitor Fator R", desc: "Acompanha pro-labore vs receita para manter enquadramento no Anexo III.", icon: "F" },
  ],
};

export const TABS = ["Visao Geral", "Obrigacoes", "Guias", "Historico"];

export const STATUS_COLORS: Record<ObligationStatus, string> = {
  done: Colors.green, progress: Colors.violet, pending: Colors.amber, overdue: Colors.red, future: Colors.ink3,
};

// Helper: next day N of current or next month
function nextDay(day: number): string {
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), day);
  if (thisMonth > now) return thisMonth.toISOString();
  return new Date(now.getFullYear(), now.getMonth() + 1, day).toISOString();
}
function daysUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
}
function alertFor(days: number): AlertLevel {
  if (days <= 3) return "critical";
  if (days <= 7) return "warning";
  if (days <= 15) return "info";
  return null;
}

export function getMEIObligations(): Obligation[] {
  const dasDue = nextDay(20);
  const dasDays = daysUntil(dasDue);
  const dasnDue = new Date(new Date().getFullYear(), 4, 31).toISOString(); // May 31
  const dasnDays = daysUntil(dasnDue);
  return [
    { code: "das_mei", name: "Pagar DAS-MEI", frequency: "mensal", due_date: dasDue, filter_label: "aura_resolve", aura_action: "Aura calcula e gera QR Code Pix. Voce so precisa pagar.", user_action: "Escanear QR Code e pagar", status: "pending", checkpoint_done: 0, checkpoint_total: 3, alert_level: alertFor(dasDays), days_until_due: dasDays, estimated_amount: 75.90,
      steps: [{ text: "Aura calcula o valor do DAS", auto: true, hint: "INSS + ISS/ICMS" }, { text: "QR Code Pix gerado", auto: true, hint: "Escaneie com app bancario" }, { text: "Confirme o pagamento", auto: false, hint: "Apos pagar, marque como concluido" }] },
    { code: "dasn_simei", name: "DASN-SIMEI (declaracao anual)", frequency: "anual", due_date: dasnDue, filter_label: "voce_faz", aura_action: "Aura pre-preenche com seu faturamento anual.", user_action: "Transmitir no portal do Simples Nacional", status: "future", checkpoint_done: 0, checkpoint_total: 4, alert_level: null, days_until_due: dasnDays,
      steps: [{ text: "Aura consolida faturamento anual", auto: true, hint: "Soma de todas as notas" }, { text: "Acesse portal Simples Nacional", auto: false, hint: "simplesnacional.receita.fazenda.gov.br" }, { text: "Confira valores pre-preenchidos", auto: false, hint: "Compare com Aura" }, { text: "Clique Transmitir", auto: false, hint: "Pronto!" }] },
  ];
}

export function getSNObligations(hasEmployee: boolean): Obligation[] {
  const dasDue = nextDay(20);
  const dasDays = daysUntil(dasDue);
  const fgtsDue = nextDay(7);
  const fgtsDays = daysUntil(fgtsDue);
  const esocialDue = nextDay(15);
  const esocialDays = daysUntil(esocialDue);
  const defisDue = new Date(new Date().getFullYear(), 2, 31).toISOString(); // Mar 31
  const defisDays = daysUntil(defisDue);

  const obls: Obligation[] = [
    { code: "das_sn", name: "Pagar DAS Simples", frequency: "mensal", due_date: dasDue, filter_label: "aura_resolve", aura_action: "Aura calcula o DAS com base na receita e gera a guia.", user_action: "Pagar via Pix ou boleto", status: "pending", checkpoint_done: 0, checkpoint_total: 3, alert_level: alertFor(dasDays), days_until_due: dasDays,
      steps: [{ text: "Aura apura receita bruta do mes", auto: true, hint: "Baseado nas notas" }, { text: "Calcula DAS conforme seu anexo", auto: true, hint: "Anexo III ou V" }, { text: "Pague a guia gerada", auto: false, hint: "Pix ou boleto" }] },
    { code: "pgdas_d", name: "PGDAS-D (transmitir)", frequency: "mensal", due_date: dasDue, filter_label: "voce_faz", aura_action: "Aura calcula o DAS estimado. Voce confere e transmite.", user_action: "Transmitir no portal PGDAS-D", status: "pending", checkpoint_done: 0, checkpoint_total: 5, alert_level: alertFor(dasDays), days_until_due: dasDays,
      steps: [{ text: "Aura apura receita bruta", auto: true, hint: "Baseado nas notas" }, { text: "Aura calcula DAS estimado", auto: true, hint: "Conforme seu anexo" }, { text: "Acesse portal PGDAS-D", auto: false, hint: "simplesnacional.receita.fazenda.gov.br" }, { text: "Confira valores e transmita", auto: false, hint: "Compare com Aura" }, { text: "Pague o DAS gerado", auto: false, hint: "Pix ou boleto" }] },
    { code: "prolabore", name: "Pro-labore + GPS", frequency: "mensal", due_date: dasDue, filter_label: "aura_resolve", aura_action: "Aura calcula pro-labore, INSS e gera guia GPS.", user_action: "Pagar a guia GPS", status: "pending", checkpoint_done: 0, checkpoint_total: 2, alert_level: alertFor(dasDays), days_until_due: dasDays,
      steps: [{ text: "Aura calcula pro-labore + INSS", auto: true, hint: "Fator R considerado" }, { text: "Pague a guia GPS", auto: false, hint: "Pronta para pagar" }] },
    { code: "defis", name: "DEFIS (declaracao anual)", frequency: "anual", due_date: defisDue, filter_label: "voce_faz", aura_action: "Aura consolida dados e pre-preenche a declaracao.", user_action: "Transmitir no portal do Simples", status: "future", checkpoint_done: 0, checkpoint_total: 4, alert_level: null, days_until_due: defisDays,
      steps: [{ text: "Aura consolida dados do ano", auto: true, hint: "Receitas, despesas, folha" }, { text: "Acesse portal do Simples", auto: false, hint: "receita.fazenda.gov.br" }, { text: "Confira dados pre-preenchidos", auto: false, hint: "Compare com Aura" }, { text: "Transmita", auto: false, hint: "Pronto!" }] },
  ];

  if (hasEmployee) {
    obls.splice(2, 0,
      { code: "fgts", name: "Pagar FGTS", frequency: "mensal", due_date: fgtsDue, filter_label: "aura_resolve", aura_action: "Aura calcula FGTS com base na folha e gera a guia.", user_action: "Pagar a guia", status: "pending", checkpoint_done: 0, checkpoint_total: 2, alert_level: alertFor(fgtsDays), days_until_due: fgtsDays,
        steps: [{ text: "Aura calcula com base na folha", auto: true, hint: "8% sobre salario" }, { text: "Pague a guia gerada", auto: false, hint: "Pronta para pagar" }] },
      { code: "esocial", name: "eSocial (enviar XML)", frequency: "mensal", due_date: esocialDue, filter_label: "voce_faz", aura_action: "Aura gera o arquivo XML. Voce envia no portal gov.br.", user_action: "Enviar XML pelo portal gov.br (5 min)", status: "pending", checkpoint_done: 0, checkpoint_total: 6, alert_level: alertFor(esocialDays), days_until_due: esocialDays,
        steps: [{ text: "Aura prepara dados e gera XML", auto: true, hint: "Arquivo na secao Documentos" }, { text: "Acesse gov.br/esocial", auto: false, hint: "Use seu navegador" }, { text: "Faca login com Gov.br", auto: false, hint: "CPF e senha" }, { text: "Clique em Enviar arquivo", auto: false, hint: "Menu lateral" }, { text: "Selecione o XML da Aura", auto: false, hint: "Pasta Downloads" }, { text: "Confirme", auto: false, hint: "Pronto!" }] },
    );
  }

  return obls;
}

// Keep old exports for backward compat
export const MEI_OBLIGATIONS = getMEIObligations();
export const SN_OBLIGATIONS = getSNObligations(false);
