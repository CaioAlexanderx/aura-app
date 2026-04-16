import { Colors } from "@/constants/colors";

export type ObligationStatus = "done" | "progress" | "pending" | "overdue" | "future";
export type FilterLabel = "aura_resolve" | "voce_faz";
export type AlertLevel = "overdue" | "critical" | "warning" | "info" | null;

export type Step = {
  text: string;
  auto: boolean;
  hint: string;
  portal_url?: string;
  portal_label?: string;
  doc_type?: "pdf" | "gif" | "link";
  doc_note?: string;
};

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
  portal_url?: string;
  portal_label?: string;
  steps?: Step[];
};

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

function nextDay(day: number): string {
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), day);
  if (thisMonth > now) return thisMonth.toISOString();
  return new Date(now.getFullYear(), now.getMonth() + 1, day).toISOString();
}
function daysUntil(iso: string): number { return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)); }
function alertFor(days: number): AlertLevel { if (days <= 3) return "critical"; if (days <= 7) return "warning"; if (days <= 15) return "info"; return null; }

// ── Portal URLs oficiais ──
const PORTALS = {
  pgmei:     { url: "https://www8.receita.fazenda.gov.br/SimplesNacional/Aplicacoes/ATSPO/pgmei.app/Identificacao", label: "Portal PGMEI" },
  dasn:      { url: "https://www8.receita.fazenda.gov.br/SimplesNacional/Aplicacoes/ATSPO/dasnsimei.app/", label: "Portal DASN-SIMEI" },
  pgdasd:    { url: "https://www8.receita.fazenda.gov.br/SimplesNacional/Aplicacoes/ATSPO/pgdasd2018.app/", label: "Portal PGDAS-D" },
  simples:   { url: "https://www8.receita.fazenda.gov.br/SimplesNacional/", label: "Portal Simples Nacional" },
  esocial:   { url: "https://login.esocial.gov.br/", label: "Portal eSocial" },
  ecac:      { url: "https://cav.receita.fazenda.gov.br/", label: "e-CAC Receita Federal" },
  regularize:{ url: "https://www.regularize.pgfn.gov.br/", label: "Regularize PGFN" },
};

export function getMEIObligations(): Obligation[] {
  const dasDue = nextDay(20); const dasDays = daysUntil(dasDue);
  const dasnDue = new Date(new Date().getFullYear(), 4, 31).toISOString(); const dasnDays = daysUntil(dasnDue);
  return [
    {
      // ── DAS MEI — valor fixo, apenas 2 passos ──
      // 1. Aura gera o QR Code (automatico)
      // 2. Cliente escaneia e paga
      code: "das_mei", name: "Pagar DAS-MEI", frequency: "mensal", due_date: dasDue,
      filter_label: "aura_resolve",
      aura_action: "O DAS MEI tem valor fixo. A Aura gera o QR Code para voce pagar em segundos.",
      user_action: "Escanear o QR Code e pagar pelo app do banco",
      status: "pending", checkpoint_done: 0, checkpoint_total: 2,
      alert_level: alertFor(dasDays), days_until_due: dasDays, estimated_amount: 75.90,
      steps: [
        {
          text: "Aura gera o QR Code do DAS",
          auto: true,
          hint: "Valor fixo mensal: INSS + ISS/ICMS conforme seu CNAE. Nenhum calculo necessario.",
          doc_type: "pdf",
          doc_note: "QR Code para pagamento",
        },
        {
          text: "Escaneie o QR Code e confirme o pagamento",
          auto: false,
          hint: "Pelo app do seu banco ou qualquer carteira Pix",
        },
      ],
    },
    {
      code: "dasn_simei", name: "DASN-SIMEI (declaracao anual)", frequency: "anual", due_date: dasnDue,
      filter_label: "voce_faz",
      aura_action: "Aura consolida seu faturamento anual. Voce confere e transmite no portal.",
      user_action: "Transmitir no portal do Simples Nacional",
      status: "future", checkpoint_done: 0, checkpoint_total: 5,
      alert_level: null, days_until_due: dasnDays,
      portal_url: PORTALS.dasn.url, portal_label: PORTALS.dasn.label,
      steps: [
        { text: "Aura consolida faturamento anual", auto: true, hint: "Soma de todas as notas emitidas no ano", doc_type: "pdf", doc_note: "Relatorio anual de faturamento" },
        { text: "Acesse o portal DASN-SIMEI", auto: false, hint: "Use seu CNPJ e codigo de acesso", portal_url: PORTALS.dasn.url, portal_label: "Abrir DASN-SIMEI", doc_type: "gif", doc_note: "Como acessar a DASN" },
        { text: "Informe CNPJ e codigo de acesso", auto: false, hint: "O codigo e obtido no portal do Simples Nacional", doc_type: "gif", doc_note: "Tela de login" },
        { text: "Confira valores (compare com o relatorio da Aura)", auto: false, hint: "Os valores devem bater", doc_type: "gif", doc_note: "Tela de conferencia" },
        { text: "Clique em Transmitir", auto: false, hint: "Pronto! Guarde o recibo.", doc_type: "gif", doc_note: "Botao transmitir" },
      ],
    },
  ];
}

export function getSNObligations(hasEmployee: boolean): Obligation[] {
  const dasDue = nextDay(20); const dasDays = daysUntil(dasDue);
  const fgtsDue = nextDay(7); const fgtsDays = daysUntil(fgtsDue);
  const esocialDue = nextDay(15); const esocialDays = daysUntil(esocialDue);
  const defisDue = new Date(new Date().getFullYear(), 2, 31).toISOString(); const defisDays = daysUntil(defisDue);

  const obls: Obligation[] = [
    {
      code: "das_sn", name: "Pagar DAS Simples Nacional", frequency: "mensal", due_date: dasDue,
      filter_label: "aura_resolve",
      aura_action: "Aura apura sua receita, calcula o DAS conforme seu anexo e gera a guia.",
      user_action: "Pagar via Pix ou boleto",
      status: "pending", checkpoint_done: 0, checkpoint_total: 4,
      alert_level: alertFor(dasDays), days_until_due: dasDays,
      portal_url: PORTALS.simples.url, portal_label: PORTALS.simples.label,
      steps: [
        { text: "Aura apura receita bruta do mes (notas emitidas)", auto: true, hint: "Baseado nas notas fiscais", doc_type: "pdf", doc_note: "Relatorio receita mensal" },
        { text: "Calcula DAS conforme seu anexo (III ou V) e Fator R", auto: true, hint: "Considera pro-labore e folha", doc_type: "pdf", doc_note: "Demonstrativo calculo DAS" },
        { text: "Gera guia DAS para pagamento", auto: true, hint: "Boleto ou Pix disponivel", doc_type: "pdf", doc_note: "Guia DAS" },
        { text: "Pagar a guia", auto: false, hint: "Via app bancario, Pix ou boleto" },
      ],
    },
    {
      code: "pgdas_d", name: "PGDAS-D (transmitir declaracao)", frequency: "mensal", due_date: dasDue,
      filter_label: "voce_faz",
      aura_action: "Aura calcula o DAS estimado. Voce confere os valores e transmite no portal.",
      user_action: "Acessar portal PGDAS-D e transmitir",
      status: "pending", checkpoint_done: 0, checkpoint_total: 6,
      alert_level: alertFor(dasDays), days_until_due: dasDays,
      portal_url: PORTALS.pgdasd.url, portal_label: PORTALS.pgdasd.label,
      steps: [
        { text: "Aura apura receita bruta e calcula DAS estimado", auto: true, hint: "Resumo disponivel para conferencia", doc_type: "pdf", doc_note: "Resumo para conferencia" },
        { text: "Acesse o portal PGDAS-D", auto: false, hint: "Portal da Receita Federal", portal_url: PORTALS.pgdasd.url, portal_label: "Abrir PGDAS-D", doc_type: "gif", doc_note: "Como acessar o PGDAS-D" },
        { text: "Login com certificado digital ou codigo de acesso", auto: false, hint: "Certificado A1 ou codigo obtido no e-CAC", portal_url: PORTALS.ecac.url, portal_label: "Abrir e-CAC", doc_type: "gif", doc_note: "Tela de login" },
        { text: "Preencha a receita bruta do periodo", auto: false, hint: "Use o valor calculado pela Aura", doc_type: "gif", doc_note: "Preenchimento receita" },
        { text: "Confira o calculo e clique em Transmitir", auto: false, hint: "Compare com o demonstrativo da Aura", doc_type: "gif", doc_note: "Tela de transmissao" },
        { text: "Imprima o DAS gerado e pague", auto: false, hint: "Boleto disponivel para impressao", doc_type: "gif", doc_note: "Imprimir guia" },
      ],
    },
    {
      code: "prolabore", name: "Pro-labore + GPS/DARF", frequency: "mensal", due_date: dasDue,
      filter_label: "aura_resolve",
      aura_action: "Aura calcula pro-labore considerando o Fator R, gera holerite e guia GPS/DARF.",
      user_action: "Pagar a guia GPS/DARF",
      status: "pending", checkpoint_done: 0, checkpoint_total: 3,
      alert_level: alertFor(dasDays), days_until_due: dasDays,
      steps: [
        { text: "Aura calcula pro-labore minimo (Fator R)", auto: true, hint: "Pro-labore >= 28% da receita para Anexo III", doc_type: "pdf", doc_note: "Holerite socio" },
        { text: "Calcula INSS (patronal + retido) e gera GPS/DARF", auto: true, hint: "Guia pronta para pagamento", doc_type: "pdf", doc_note: "Guia GPS/DARF" },
        { text: "Pague a guia", auto: false, hint: "Via Pix, boleto ou debito" },
      ],
    },
    {
      code: "defis", name: "DEFIS (declaracao anual)", frequency: "anual", due_date: defisDue,
      filter_label: "voce_faz",
      aura_action: "Aura consolida todos os dados do ano e prepara um resumo para conferencia.",
      user_action: "Transmitir no portal do Simples Nacional",
      status: "future", checkpoint_done: 0, checkpoint_total: 5,
      alert_level: null, days_until_due: defisDays,
      portal_url: PORTALS.simples.url, portal_label: PORTALS.simples.label,
      steps: [
        { text: "Aura consolida dados anuais (receita, despesa, folha)", auto: true, hint: "Relatorio completo disponivel", doc_type: "pdf", doc_note: "Relatorio anual consolidado" },
        { text: "Acesse o portal DEFIS", auto: false, hint: "Dentro do portal do Simples Nacional", portal_url: PORTALS.simples.url, portal_label: "Abrir Simples Nacional", doc_type: "gif", doc_note: "Como acessar a DEFIS" },
        { text: "Login com certificado ou codigo de acesso", auto: false, hint: "Mesmo acesso do PGDAS-D", doc_type: "gif", doc_note: "Tela de login" },
        { text: "Confira os dados pre-preenchidos", auto: false, hint: "Compare com o relatorio da Aura", doc_type: "gif", doc_note: "Tela de conferencia" },
        { text: "Transmita a declaracao", auto: false, hint: "Guarde o recibo de transmissao", doc_type: "gif", doc_note: "Botao transmitir" },
      ],
    },
  ];

  if (hasEmployee) {
    obls.splice(2, 0,
      {
        code: "fgts", name: "Pagar FGTS", frequency: "mensal", due_date: fgtsDue,
        filter_label: "aura_resolve",
        aura_action: "Aura calcula FGTS com base na folha de pagamento e gera a guia GRF.",
        user_action: "Pagar a guia GRF",
        status: "pending", checkpoint_done: 0, checkpoint_total: 2,
        alert_level: alertFor(fgtsDays), days_until_due: fgtsDays,
        steps: [
          { text: "Aura calcula FGTS (8% sobre salarios da folha)", auto: true, hint: "Baseado na folha do mes", doc_type: "pdf", doc_note: "Guia GRF/FGTS" },
          { text: "Pague a guia gerada", auto: false, hint: "Via app bancario" },
        ],
      },
      {
        code: "esocial", name: "eSocial (enviar eventos)", frequency: "mensal", due_date: esocialDue,
        filter_label: "voce_faz",
        aura_action: "Aura prepara os dados da folha e gera o arquivo. Voce envia pelo portal gov.br.",
        user_action: "Enviar pelo portal eSocial (5 min)",
        status: "pending", checkpoint_done: 0, checkpoint_total: 6,
        alert_level: alertFor(esocialDays), days_until_due: esocialDays,
        portal_url: PORTALS.esocial.url, portal_label: PORTALS.esocial.label,
        steps: [
          { text: "Aura prepara dados da folha e gera arquivo", auto: true, hint: "Arquivo disponivel na secao Documentos", doc_type: "pdf", doc_note: "Arquivo XML + guia de envio" },
          { text: "Acesse o portal eSocial", auto: false, hint: "Portal do governo federal", portal_url: PORTALS.esocial.url, portal_label: "Abrir eSocial", doc_type: "gif", doc_note: "Pagina inicial eSocial" },
          { text: "Faca login com Gov.br (CPF + senha)", auto: false, hint: "Use suas credenciais Gov.br", doc_type: "gif", doc_note: "Tela de login Gov.br" },
          { text: "Navegue ate Enviar arquivo/evento", auto: false, hint: "Menu lateral do portal", doc_type: "gif", doc_note: "Navegacao no menu" },
          { text: "Selecione o arquivo gerado pela Aura", auto: false, hint: "Na pasta Downloads do seu computador", doc_type: "gif", doc_note: "Selecao de arquivo" },
          { text: "Confirme o envio e salve o recibo", auto: false, hint: "Guarde o numero do recibo", doc_type: "gif", doc_note: "Confirmacao de envio" },
        ],
      },
    );
  }

  return obls;
}

export const MEI_OBLIGATIONS = getMEIObligations();
export const SN_OBLIGATIONS = getSNObligations(false);
