// Obligations configuration by CNAE and tax regime
// Used by Contabilidade screen to show relevant checkpoints
// Updated during onboarding when CNPJ is registered

export type TaxRegime = "mei" | "simples" | "lucro_presumido";

export type ObligationTemplate = {
  id: string;
  name: string;
  icon: string;
  category: "aura_resolve" | "aura_facilita";
  frequency: "monthly" | "annual" | "initial" | "always";
  description: string;
  dueDay: number | null; // day of month, null for annual/initial
  dueMonth: number | null; // month of year for annual obligations
  hasAmount: boolean;
  steps: { text: string; auto: boolean; media: string | null; hint: string }[];
};

export type CnaeProfile = {
  label: string;
  regime: TaxRegime;
  obligations: string[]; // references to OBLIGATION_TEMPLATES keys
};

// ── Base obligation templates ────────────────────────────────

export const OBLIGATION_TEMPLATES: Record<string, ObligationTemplate> = {
  // === INITIAL (all regimes) ===
  cnpj_config: {
    id: "cnpj_config", name: "CNPJ e regime configurados", icon: "#",
    category: "aura_resolve", frequency: "initial",
    description: "Regime tributário detectado via Receita Federal. Obrigacoes carregadas automaticamente.",
    dueDay: null, dueMonth: null, hasAmount: false,
    steps: [
      { text: "Aura detecta seu regime tributario", auto: true, media: null, hint: "Via consulta ao CNPJ" },
      { text: "Obrigacoes carregadas automaticamente", auto: true, media: null, hint: "Baseado no seu regime" },
    ],
  },
  alerts_config: {
    id: "alerts_config", name: "Alertas de vencimento ativos", icon: "!",
    category: "aura_resolve", frequency: "always",
    description: "Notificacoes configuradas: 15 dias, 7 dias e 3 dias antes do vencimento.",
    dueDay: null, dueMonth: null, hasAmount: false,
    steps: [
      { text: "Aura configura os alertas", auto: true, media: null, hint: "15d, 7d e 3d antes" },
      { text: "Voce recebe notificacao no app", auto: true, media: null, hint: "Push + email" },
    ],
  },
  monthly_summary: {
    id: "monthly_summary", name: "Resumo gerencial do mes", icon: "$",
    category: "aura_resolve", frequency: "monthly",
    description: "Resumo financeiro mensal gerado automaticamente com base nos lancamentos.",
    dueDay: null, dueMonth: null, hasAmount: false,
    steps: [
      { text: "Aura compila os dados do mes", auto: true, media: null, hint: "Receitas, despesas, lucro" },
      { text: "Relatorio disponivel no Financeiro", auto: true, media: null, hint: "Aba Resumo" },
    ],
  },

  // === MEI ===
  das_mei: {
    id: "das_mei", name: "DAS-MEI", icon: "$",
    category: "aura_resolve", frequency: "monthly",
    description: "Guia mensal que reune INSS, ISS e ICMS em um unico pagamento. Valor fixo definido pelo governo.",
    dueDay: 20, dueMonth: null, hasAmount: true,
    steps: [
      { text: "Aura calcula o valor do DAS", auto: true, media: null, hint: "INSS + ISS + ICMS" },
      { text: "QR Code Pix gerado", auto: true, media: null, hint: "Escaneie com app bancario" },
      { text: "Aura confirma o pagamento", auto: true, media: null, hint: "Notificacao automatica" },
    ],
  },
  dasn_simei: {
    id: "dasn_simei", name: "DASN-SIMEI", icon: "D",
    category: "aura_facilita", frequency: "annual",
    description: "Declaracao anual que resume o faturamento do ano anterior. Prazo ate 31 de maio.",
    dueDay: 31, dueMonth: 5, hasAmount: false,
    steps: [
      { text: "Aura consolida faturamento anual", auto: true, media: null, hint: "Soma de todas as notas" },
      { text: "Aura pre-preenche declaracao", auto: true, media: null, hint: "Revise antes" },
      { text: "Acesse portal Simples Nacional", auto: false, media: null, hint: "receita.fazenda.gov.br" },
      { text: "Confira e clique Transmitir", auto: false, media: null, hint: "Compare valores" },
    ],
  },
  mei_faturamento: {
    id: "mei_faturamento", name: "Controle limite MEI", icon: "!",
    category: "aura_resolve", frequency: "always",
    description: "Aura monitora seu faturamento e alerta quando se aproximar do limite de R$ 81.000/ano.",
    dueDay: null, dueMonth: null, hasAmount: false,
    steps: [
      { text: "Aura acompanha faturamento acumulado", auto: true, media: null, hint: "Atualizado a cada venda" },
      { text: "Alerta em 80% do limite", auto: true, media: null, hint: "R$ 64.800" },
    ],
  },

  // === SIMPLES NACIONAL (ME) ===
  pgdas_d: {
    id: "pgdas_d", name: "PGDAS-D", icon: "P",
    category: "aura_facilita", frequency: "monthly",
    description: "Apuracao mensal da receita bruta para calculo do DAS no Simples Nacional.",
    dueDay: 20, dueMonth: null, hasAmount: true,
    steps: [
      { text: "Aura apura receita bruta", auto: true, media: null, hint: "Baseado nas notas" },
      { text: "Aura calcula DAS estimado", auto: true, media: null, hint: "Conforme seu anexo" },
      { text: "Acesse o portal PGDAS-D", auto: false, media: null, hint: "simplesnacional.receita.fazenda.gov.br" },
      { text: "Confira valores e transmita", auto: false, media: null, hint: "Compare com Aura" },
      { text: "Pague o DAS gerado", auto: false, media: null, hint: "Pix ou boleto" },
    ],
  },
  defis: {
    id: "defis", name: "DEFIS", icon: "D",
    category: "aura_facilita", frequency: "annual",
    description: "Declaracao de Informacoes Socioeconomicas e Fiscais do Simples Nacional.",
    dueDay: 31, dueMonth: 3, hasAmount: false,
    steps: [
      { text: "Aura consolida dados do ano", auto: true, media: null, hint: "Receitas, despesas, folha" },
      { text: "Aura pre-preenche campos", auto: true, media: null, hint: "Revise antes" },
      { text: "Acesse portal Simples Nacional", auto: false, media: null, hint: "Aba DEFIS" },
      { text: "Confira e transmita", auto: false, media: null, hint: "Compare com Aura" },
    ],
  },

  // === WITH EMPLOYEES (any regime) ===
  fgts: {
    id: "fgts", name: "FGTS", icon: "F",
    category: "aura_resolve", frequency: "monthly",
    description: "Fundo de Garantia para funcionarios. 8% sobre salario. Obrigatorio todo mes.",
    dueDay: 7, dueMonth: null, hasAmount: true,
    steps: [
      { text: "Aura calcula com base na folha", auto: true, media: null, hint: "8% sobre salario" },
      { text: "Guia gerada automaticamente", auto: true, media: null, hint: "Pronta para pagar" },
    ],
  },
  esocial: {
    id: "esocial", name: "eSocial", icon: "e",
    category: "aura_facilita", frequency: "monthly",
    description: "Envio digital de informacoes sobre funcionarios ao governo. Aura gera o XML, voce envia.",
    dueDay: 15, dueMonth: null, hasAmount: false,
    steps: [
      { text: "Aura prepara os dados e gera o XML", auto: true, media: null, hint: "Arquivo na secao Documentos" },
      { text: "Acesse gov.br/esocial", auto: false, media: null, hint: "Use seu navegador" },
      { text: "Faca login com Gov.br", auto: false, media: null, hint: "CPF e senha" },
      { text: "Clique em Enviar arquivo", auto: false, media: null, hint: "Menu lateral" },
      { text: "Selecione o XML da Aura", auto: false, media: null, hint: "Pasta Downloads" },
      { text: "Confirme - pronto!", auto: false, media: null, hint: "Sucesso" },
    ],
  },

  // === NFe (commerce/services) ===
  nfe_emission: {
    id: "nfe_emission", name: "NF-e automatica", icon: "N",
    category: "aura_resolve", frequency: "always",
    description: "Emissao automatica de NF-e/NFS-e em toda venda PJ. Integrado com NFE.io.",
    dueDay: null, dueMonth: null, hasAmount: false,
    steps: [
      { text: "Aura emite nota automaticamente", auto: true, media: null, hint: "Apos cada venda PJ" },
      { text: "XML armazenado por 5 anos", auto: true, media: null, hint: "Cloudflare R2" },
    ],
  },
};

// ── CNAE profiles ────────────────────────────────────────────
// Maps CNAE groups to their required obligations

export const CNAE_PROFILES: Record<string, CnaeProfile> = {
  // === MEI profiles ===
  mei_comercio: {
    label: "MEI - Comercio",
    regime: "mei",
    obligations: ["cnpj_config", "alerts_config", "monthly_summary", "das_mei", "dasn_simei", "mei_faturamento", "nfe_emission"],
  },
  mei_servicos: {
    label: "MEI - Servicos",
    regime: "mei",
    obligations: ["cnpj_config", "alerts_config", "monthly_summary", "das_mei", "dasn_simei", "mei_faturamento", "nfe_emission"],
  },
  mei_com_funcionario: {
    label: "MEI - Com 1 funcionario",
    regime: "mei",
    obligations: ["cnpj_config", "alerts_config", "monthly_summary", "das_mei", "dasn_simei", "mei_faturamento", "fgts", "esocial", "nfe_emission"],
  },

  // === ME Simples Nacional ===
  me_comercio: {
    label: "ME - Comercio (Simples)",
    regime: "simples",
    obligations: ["cnpj_config", "alerts_config", "monthly_summary", "pgdas_d", "defis", "nfe_emission"],
  },
  me_servicos: {
    label: "ME - Servicos (Simples)",
    regime: "simples",
    obligations: ["cnpj_config", "alerts_config", "monthly_summary", "pgdas_d", "defis", "nfe_emission"],
  },
  me_com_funcionarios: {
    label: "ME - Com funcionarios (Simples)",
    regime: "simples",
    obligations: ["cnpj_config", "alerts_config", "monthly_summary", "pgdas_d", "defis", "fgts", "esocial", "nfe_emission"],
  },

  // === Vertical-specific ===
  odontologia: {
    label: "Odontologia (Simples)",
    regime: "simples",
    obligations: ["cnpj_config", "alerts_config", "monthly_summary", "pgdas_d", "defis", "fgts", "esocial", "nfe_emission"],
  },
  barbearia_salao: {
    label: "Barbearia / Salao",
    regime: "mei",
    obligations: ["cnpj_config", "alerts_config", "monthly_summary", "das_mei", "dasn_simei", "mei_faturamento", "nfe_emission"],
  },
  barbearia_salao_func: {
    label: "Barbearia / Salao com funcionarios",
    regime: "mei",
    obligations: ["cnpj_config", "alerts_config", "monthly_summary", "das_mei", "dasn_simei", "mei_faturamento", "fgts", "esocial", "nfe_emission"],
  },
  food_service: {
    label: "Alimentacao / Restaurante",
    regime: "simples",
    obligations: ["cnpj_config", "alerts_config", "monthly_summary", "pgdas_d", "defis", "fgts", "esocial", "nfe_emission"],
  },
  varejo_roupas: {
    label: "Varejo / Roupas",
    regime: "simples",
    obligations: ["cnpj_config", "alerts_config", "monthly_summary", "pgdas_d", "defis", "nfe_emission"],
  },
  estetica: {
    label: "Estetica / Bem-estar",
    regime: "mei",
    obligations: ["cnpj_config", "alerts_config", "monthly_summary", "das_mei", "dasn_simei", "mei_faturamento", "nfe_emission"],
  },
  pet_shop: {
    label: "Pet Shop",
    regime: "simples",
    obligations: ["cnpj_config", "alerts_config", "monthly_summary", "pgdas_d", "defis", "nfe_emission"],
  },
  ti_saas: {
    label: "TI / SaaS",
    regime: "simples",
    obligations: ["cnpj_config", "alerts_config", "monthly_summary", "pgdas_d", "defis", "nfe_emission"],
  },
};

// ── Helper: get obligations for a company ────────────────────

export function getObligationsForProfile(profileKey: string): ObligationTemplate[] {
  const profile = CNAE_PROFILES[profileKey];
  if (!profile) return Object.values(OBLIGATION_TEMPLATES);
  return profile.obligations
    .map(key => OBLIGATION_TEMPLATES[key])
    .filter(Boolean);
}

export function detectProfileFromCnae(cnae: string, hasEmployees: boolean): string {
  // CNAE prefix mapping
  const prefix = cnae.substring(0, 4);
  const map: Record<string, string> = {
    "6202": "ti_saas",
    "6204": "ti_saas",
    "6311": "ti_saas",
    "6209": "ti_saas",
    "9602": hasEmployees ? "barbearia_salao_func" : "barbearia_salao",
    "9601": hasEmployees ? "barbearia_salao_func" : "barbearia_salao",
    "8630": "odontologia",
    "8650": "estetica",
    "5611": "food_service",
    "5612": "food_service",
    "4781": "varejo_roupas",
    "4782": "varejo_roupas",
    "4789": "varejo_roupas",
    "9609": "pet_shop",
    "7500": "pet_shop",
  };
  const detected = map[prefix];
  if (detected) return detected;
  // Fallback by regime
  return hasEmployees ? "me_com_funcionarios" : "mei_comercio";
}

// Default profile for demo mode
export const DEFAULT_PROFILE = "mei_com_funcionario";
