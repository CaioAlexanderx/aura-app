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

export const TABS = ["Visao Geral", "Obrigacoes", "Guias", "Historico"];

export const STATUS_COLORS: Record<ObligationStatus, string> = {
  done: Colors.green, progress: Colors.violet, pending: Colors.amber, overdue: Colors.red, future: Colors.ink3,
};

export const FILTER_CONFIG = {
  aura_resolve: { label: "Aura resolve", color: Colors.green, bg: Colors.greenD, desc: "Tudo automatico" },
  voce_faz: { label: "Voce confirma", color: Colors.amber, bg: Colors.amberD, desc: "Passo a passo com apoio da Aura" },
};

// Fallback obligations per regime (used when API not available)
export const MEI_OBLIGATIONS: Obligation[] = [
  { code: "das_mei", name: "Pagar DAS-MEI", frequency: "mensal", due_date: null, filter_label: "aura_resolve", aura_action: "Aura calcula e gera QR Code Pix", user_action: null, status: "pending", checkpoint_done: 0, checkpoint_total: 3, alert_level: null, days_until_due: null, estimated_amount: 75.90,
    steps: [{ text: "Aura calcula o valor do DAS", auto: true, hint: "INSS + ISS/ICMS" }, { text: "QR Code Pix gerado", auto: true, hint: "Escaneie com app bancario" }, { text: "Aura confirma pagamento", auto: true, hint: "Notificacao automatica" }] },
  { code: "limite_mei", name: "Monitor de faturamento", frequency: "continuo", due_date: null, filter_label: "aura_resolve", aura_action: "Aura monitora seu faturamento vs limite R$ 81 mil/ano", user_action: null, status: "done", checkpoint_done: 2, checkpoint_total: 2, alert_level: null, days_until_due: null,
    steps: [{ text: "Aura soma seu faturamento acumulado", auto: true, hint: "Baseado nas notas" }, { text: "Alerta se ultrapassar 80% do limite", auto: true, hint: "R$ 64.800" }] },
  { code: "dasn_simei", name: "DASN-SIMEI (anual)", frequency: "anual", due_date: null, filter_label: "voce_faz", aura_action: "Aura pre-preenche com faturamento anual", user_action: "Transmitir no portal do Simples Nacional", status: "future", checkpoint_done: 0, checkpoint_total: 4, alert_level: null, days_until_due: null,
    steps: [{ text: "Aura consolida faturamento anual", auto: true, hint: "Soma de todas as notas" }, { text: "Acesse portal Simples Nacional", auto: false, hint: "simplesnacional.receita.fazenda.gov.br" }, { text: "Confira valores pre-preenchidos", auto: false, hint: "Compare com Aura" }, { text: "Clique Transmitir", auto: false, hint: "Sucesso" }] },
  { code: "alertas", name: "Alertas de vencimento", frequency: "continuo", due_date: null, filter_label: "aura_resolve", aura_action: "Notificacoes 15, 7 e 3 dias antes", user_action: null, status: "done", checkpoint_done: 2, checkpoint_total: 2, alert_level: null, days_until_due: null,
    steps: [{ text: "Aura configura alertas", auto: true, hint: "15d, 7d, 3d antes" }, { text: "Voce recebe notificacao", auto: true, hint: "Push + email" }] },
];

export const SN_OBLIGATIONS: Obligation[] = [
  { code: "das_sn", name: "Pagar DAS Simples", frequency: "mensal", due_date: null, filter_label: "aura_resolve", aura_action: "Aura calcula DAS com base na receita e anexo", user_action: null, status: "pending", checkpoint_done: 0, checkpoint_total: 3, alert_level: null, days_until_due: null,
    steps: [{ text: "Aura apura receita bruta do mes", auto: true, hint: "Baseado nas notas" }, { text: "Calcula DAS conforme seu anexo", auto: true, hint: "Anexo III ou V" }, { text: "Guia gerada com QR Code", auto: true, hint: "Pix ou boleto" }] },
  { code: "pgdas_d", name: "PGDAS-D (transmitir)", frequency: "mensal", due_date: null, filter_label: "voce_faz", aura_action: "Aura calcula o DAS estimado", user_action: "Transmitir no portal PGDAS-D", status: "pending", checkpoint_done: 0, checkpoint_total: 5, alert_level: null, days_until_due: null,
    steps: [{ text: "Aura apura receita bruta", auto: true, hint: "Baseado nas notas" }, { text: "Aura calcula DAS estimado", auto: true, hint: "Conforme seu anexo" }, { text: "Acesse portal PGDAS-D", auto: false, hint: "simplesnacional.receita.fazenda.gov.br" }, { text: "Confira valores e transmita", auto: false, hint: "Compare com Aura" }, { text: "Pague o DAS gerado", auto: false, hint: "Pix ou boleto" }] },
  { code: "fgts", name: "FGTS (guia gerada)", frequency: "mensal", due_date: null, filter_label: "aura_resolve", aura_action: "Aura calcula FGTS com base na folha", user_action: null, status: "pending", checkpoint_done: 0, checkpoint_total: 2, alert_level: null, days_until_due: null,
    steps: [{ text: "Aura calcula com base na folha", auto: true, hint: "8% sobre salario" }, { text: "Guia gerada automaticamente", auto: true, hint: "Pronta para pagar" }] },
  { code: "esocial", name: "eSocial (enviar XML)", frequency: "mensal", due_date: null, filter_label: "voce_faz", aura_action: "Aura gera o arquivo XML", user_action: "Enviar pelo portal gov.br em 5 minutos", status: "pending", checkpoint_done: 0, checkpoint_total: 6, alert_level: null, days_until_due: null,
    steps: [{ text: "Aura prepara dados e gera XML", auto: true, hint: "Arquivo na secao Documentos" }, { text: "Acesse gov.br/esocial", auto: false, hint: "Use seu navegador" }, { text: "Faca login com Gov.br", auto: false, hint: "CPF e senha" }, { text: "Clique em Enviar arquivo", auto: false, hint: "Menu lateral" }, { text: "Selecione o XML da Aura", auto: false, hint: "Pasta Downloads" }, { text: "Confirme - pronto!", auto: false, hint: "Sucesso" }] },
  { code: "defis", name: "DEFIS (anual)", frequency: "anual", due_date: null, filter_label: "voce_faz", aura_action: "Aura consolida dados e pre-preenche", user_action: "Transmitir no portal do Simples", status: "future", checkpoint_done: 0, checkpoint_total: 4, alert_level: null, days_until_due: null,
    steps: [{ text: "Aura consolida dados do ano", auto: true, hint: "Receitas, despesas, folha" }, { text: "Acesse portal do Simples", auto: false, hint: "receita.fazenda.gov.br" }, { text: "Confira dados pre-preenchidos", auto: false, hint: "Compare com Aura" }, { text: "Transmita", auto: false, hint: "Sucesso" }] },
  { code: "prolabore", name: "Pro-labore mensal", frequency: "mensal", due_date: null, filter_label: "aura_resolve", aura_action: "Aura calcula pro-labore e INSS", user_action: null, status: "pending", checkpoint_done: 0, checkpoint_total: 2, alert_level: null, days_until_due: null,
    steps: [{ text: "Aura calcula pro-labore + INSS", auto: true, hint: "Fator R considerado" }, { text: "Guia GPS gerada", auto: true, hint: "Pronta para pagar" }] },
  { code: "alertas", name: "Alertas de vencimento", frequency: "continuo", due_date: null, filter_label: "aura_resolve", aura_action: "Notificacoes 15, 7 e 3 dias antes", user_action: null, status: "done", checkpoint_done: 2, checkpoint_total: 2, alert_level: null, days_until_due: null,
    steps: [{ text: "Aura configura alertas", auto: true, hint: "15d, 7d, 3d" }, { text: "Voce recebe notificacao", auto: true, hint: "Push + email" }] },
];
