// Empty state configurations for each screen
// Used when isDemo is false and no real data exists

export const EMPTY_STATES = {
  dashboard: {
    icon: "dashboard",
    title: "Seu painel esta vazio",
    description: "Comece registrando sua primeira venda ou cadastrando produtos para ver seus dados aqui.",
    actionLabel: "Registrar primeira venda",
    actionRoute: "/pdv",
    secondaryLabel: "Cadastrar produto",
    secondaryRoute: "/estoque",
  },
  financeiro: {
    icon: "wallet",
    title: "Nenhum lançamento financeiro",
    description: "Registre receitas e despesas para acompanhar a saúde financeira do seu negócio.",
    actionLabel: "Novo lancamento",
    actionRoute: "/financeiro",
  },
  pdv: {
    icon: "cart",
    title: "Nenhuma venda registrada",
    description: "Cadastre seus produtos no estoque e comece a vender pelo PDV da Aura.",
    actionLabel: "Cadastrar produtos",
    actionRoute: "/estoque",
    secondaryLabel: "Como funciona o PDV?",
  },
  estoque: {
    icon: "package",
    title: "Estoque vazio",
    description: "Cadastre seus produtos para controlar entradas, saídas e saber exatamente o que tem disponivel.",
    actionLabel: "Cadastrar primeiro produto",
    secondaryLabel: "Importar planilha",
  },
  clientes: {
    icon: "users",
    title: "Nenhum cliente cadastrado",
    description: "Seus clientes aparecem aqui automaticamente após a primeira venda, ou cadastre manualmente.",
    actionLabel: "Cadastrar cliente",
    secondaryLabel: "Importar base",
  },
  contabilidade: {
    icon: "calculator",
    title: "Obrigações não configuradas",
    description: "Complete o onboarding com seu CNPJ para que a Aura configure suas obrigacoes contábeis automaticamente.",
    actionLabel: "Configurar empresa",
    actionRoute: "/onboarding",
  },
  nfe: {
    icon: "file_text",
    title: "Nenhuma nota fiscal emitida",
    description: "As notas fiscais serão emitidas automaticamente a cada venda PJ. Configure sua empresa para comecar.",
    actionLabel: "Configurar NF-e",
    secondaryLabel: "Como funciona?",
  },
  folha: {
    icon: "payroll",
    title: "Nenhum funcionário cadastrado",
    description: "Cadastre seus funcionarios para calcular folha de pagamento, FGTS e gerar holerites.",
    actionLabel: "Cadastrar funcionario",
  },
} as const;
