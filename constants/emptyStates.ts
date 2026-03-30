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
    title: "Nenhum lancamento financeiro",
    description: "Registre receitas e despesas para acompanhar a saude financeira do seu negocio.",
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
    description: "Cadastre seus produtos para controlar entradas, saidas e saber exatamente o que tem disponivel.",
    actionLabel: "Cadastrar primeiro produto",
    secondaryLabel: "Importar planilha",
  },
  clientes: {
    icon: "users",
    title: "Nenhum cliente cadastrado",
    description: "Seus clientes aparecem aqui automaticamente apos a primeira venda, ou cadastre manualmente.",
    actionLabel: "Cadastrar cliente",
    secondaryLabel: "Importar base",
  },
  contabilidade: {
    icon: "calculator",
    title: "Obrigacoes nao configuradas",
    description: "Complete o onboarding com seu CNPJ para que a Aura configure suas obrigacoes contabeis automaticamente.",
    actionLabel: "Configurar empresa",
    actionRoute: "/onboarding",
  },
  nfe: {
    icon: "file_text",
    title: "Nenhuma nota fiscal emitida",
    description: "As notas fiscais serao emitidas automaticamente a cada venda PJ. Configure sua empresa para comecar.",
    actionLabel: "Configurar NF-e",
    secondaryLabel: "Como funciona?",
  },
  folha: {
    icon: "payroll",
    title: "Nenhum funcionario cadastrado",
    description: "Cadastre seus funcionarios para calcular folha de pagamento, FGTS e gerar holerites.",
    actionLabel: "Cadastrar funcionario",
  },
} as const;
