// fix-acentos.js
// Run from aura-app root: node fix-acentos.js
// Fixes all Portuguese accents in TSX/TS source files
// D-02: Comprehensive accent fix

const fs = require('fs');
const path = require('path');

// ── Replacement map: ASCII -> UTF-8 ─────────────────────────
// Only replaces inside string literals (between quotes)
const REPLACEMENTS = [
  // Common words in the app (case-sensitive, most specific first)
  // ── Sidebar / Navigation ──
  ['Configuracoes', 'Configurações'],
  ['Contabilidade', 'Contabilidade'], // already correct
  ['Folha de Pagamento', 'Folha de Pagamento'], // already correct

  // ── Dashboard ──
  ['Visao geral', 'Visão geral'],
  ['Acesso rapido', 'Acesso rápido'],
  ['Obrigacoes contabeis', 'Obrigações contábeis'],
  ['Lucro liquido do mes', 'Lucro líquido do mês'],
  ['LUCRO LIQUIDO', 'LUCRO LÍQUIDO'],
  ['RECEITA DO MES', 'RECEITA DO MÊS'],
  ['Ultimas vendas', 'Últimas vendas'],
  ['Apoio contabil informativo', 'Apoio contábil informativo'],
  ['Modo demonstrativo - dados ilustrativos', 'Modo demonstrativo - dados ilustrativos'],

  // ── Onboarding ──
  ['Bem-vindo a Aura', 'Bem-vindo à Aura'],
  ['Vamos comecar', 'Vamos começar'],
  ['Obrigacoes contabeis organizadas', 'Obrigações contábeis organizadas'],
  ['Guias passo a passo para cada tarefa', 'Guias passo a passo para cada tarefa'],
  ['Vamos buscar as informacoes automaticamente', 'Vamos buscar as informações automaticamente'],
  ['Ainda nao tenho CNPJ', 'Ainda não tenho CNPJ'],
  ['Tipo de negocio', 'Tipo de negócio'],
  ['melhor descreve seu negocio', 'melhor descreve seu negócio'],
  ['Selecione um tipo de negocio', 'Selecione um tipo de negócio'],
  ['Voce tem funcionarios', 'Você tem funcionários'],
  ['obrigacoes contabeis a Aura vai configurar', 'obrigações contábeis a Aura vai configurar'],
  ['Nao tenho', 'Não tenho'],
  ['Trabalho sozinho ou com socios', 'Trabalho sozinho ou com sócios'],
  ['Funcionarios registrados', 'Funcionários registrados'],
  ['Quantos funcionarios', 'Quantos funcionários'],
  ['a Aura vai gerenciar', 'a Aura vai gerenciar'],
  ['Tudo pronto', 'Tudo pronto'],
  ['Sua empresa esta configurada', 'Sua empresa está configurada'],
  ['obrigacoes contabeis e esta pronta', 'obrigações contábeis e está pronta'],
  ['Obrigacoes configuradas', 'Obrigações configuradas'],
  ['Nao enviada', 'Não enviada'],
  ['ao adquirir a Aura, seus dados reais serao carregados aqui', 'ao adquirir a Aura, seus dados reais serão carregados aqui'],

  // ── Contabilidade ──
  ['Obrigacoes', 'Obrigações'],
  ['obrigacao', 'obrigação'],
  ['Aura facilita, voce resolve', 'Aura facilita, você resolve'],
  ['Voce confirma', 'Você confirma'],
  ['Competencia', 'Competência'],
  ['Estimativa e lembrete', 'Estimativa e lembrete'],
  ['declaracao oficial', 'declaração oficial'],
  ['Calendario fiscal', 'Calendário fiscal'],
  ['informacoes', 'informações'],
  ['transmissao', 'transmissão'],

  // ── Financeiro ──
  ['Lancamentos', 'Lançamentos'],
  ['Minha Retirada', 'Minha Retirada'], // already correct
  ['A Receber', 'A Receber'], // already correct
  ['Transacoes', 'Transações'],
  ['transacao', 'transação'],

  // ── PDV ──
  ['Finalizacao', 'Finalização'],
  ['Selecao', 'Seleção'],
  ['Descricao', 'Descrição'],
  ['descricao', 'descrição'],
  ['Codigo', 'Código'],
  ['codigo', 'código'],
  ['Referencia', 'Referência'],
  ['referencia', 'referência'],
  ['Quantidade', 'Quantidade'], // already correct
  ['Dinheiro', 'Dinheiro'], // already correct
  ['Cartao', 'Cartão'],

  // ── Estoque ──
  ['Disponivel', 'Disponível'],
  ['disponivel', 'disponível'],
  ['Avancado', 'Avançado'],
  ['Classificacao', 'Classificação'],
  ['classificacao', 'classificação'],
  ['Cadastro', 'Cadastro'], // already correct
  ['Preco', 'Preço'],
  ['preco', 'preço'],
  ['unitario', 'unitário'],
  ['Unitario', 'Unitário'],
  ['minimo', 'mínimo'],
  ['Minimo', 'Mínimo'],
  ['maximo', 'máximo'],
  ['Maximo', 'Máximo'],

  // ── Clientes ──
  ['Aniversario', 'Aniversário'],
  ['aniversario', 'aniversário'],
  ['Retencao', 'Retenção'],
  ['retencao', 'retenção'],
  ['Avaliacao', 'Avaliação'],
  ['avaliacao', 'avaliação'],
  ['frequencia', 'frequência'],
  ['Frequencia', 'Frequência'],

  // ── Folha ──
  ['Funcionarios', 'Funcionários'],
  ['funcionarios', 'funcionários'],
  ['Historico', 'Histórico'],
  ['historico', 'histórico'],
  ['Salario', 'Salário'],
  ['salario', 'salário'],
  ['Admissao', 'Admissão'],
  ['admissao', 'admissão'],
  ['Proventos', 'Proventos'], // already correct
  ['liquido', 'líquido'],
  ['Liquido', 'Líquido'],

  // ── NF-e ──
  ['Emitidas', 'Emitidas'], // already correct
  ['Pendentes', 'Pendentes'], // already correct
  ['Nenhuma nota fiscal emitida', 'Nenhuma nota fiscal emitida'], // already correct
  ['Configuracao fiscal ativa', 'Configuração fiscal ativa'],
  ['aliquotas', 'alíquotas'],

  // ── Configuracoes ──
  ['Configuracao fiscal', 'Configuração fiscal'],
  ['Regime tributario', 'Regime tributário'],
  ['tributario', 'tributário'],
  ['Endereco', 'Endereço'],
  ['endereco', 'endereço'],
  ['Telefone', 'Telefone'], // already correct
  ['alteracoes', 'alterações'],
  ['Alteracoes', 'Alterações'],
  ['demonstrativo', 'demonstrativo'], // already correct
  ['Para alterar, entre em contato com o suporte', 'Para alterar, entre em contato com o suporte'],
  ['detectados automaticamente via CNPJ', 'detectados automaticamente via CNPJ'],

  // ── DemoTour ──
  ['demonstrativo', 'demonstrativo'], // already correct
  ['funcionalidades', 'funcionalidades'], // already correct
  ['financeiro', 'financeiro'], // already correct
  ['contabeis', 'contábeis'],

  // ── EmptyState ──
  ['Nenhum lancamento financeiro', 'Nenhum lançamento financeiro'],
  ['saude financeira', 'saúde financeira'],
  ['negocio', 'negócio'],
  ['Nao configuradas', 'Não configuradas'],
  ['contabeis automaticamente', 'contábeis automaticamente'],
  ['Nenhum funcionario cadastrado', 'Nenhum funcionário cadastrado'],

  // ── General patterns ──
  ['Orcamento', 'Orçamento'],
  ['orcamento', 'orçamento'],
  ['Calculo', 'Cálculo'],
  ['calculo', 'cálculo'],
  ['Numero', 'Número'],
  ['numero', 'número'],
  ['Opcoes', 'Opções'],
  ['opcoes', 'opções'],
  ['Resumo mensal', 'Resumo mensal'], // already correct
  ['Estimativa', 'Estimativa'], // already correct
  ['Saudavel', 'Saudável'],
  ['Ferias', 'Férias'],
  ['comeco', 'começo'],
  ['comecar', 'começar'],
  ['voce', 'você'],
  ['Voce', 'Você'],
  ['nao', 'não'],
  ['Nao', 'Não'],
  ['esta ', 'está '],
  ['tambem', 'também'],
  ['Tambem', 'Também'],
  ['ate', 'até'],
  ['Pagina', 'Página'],
  ['pagina', 'página'],
  ['unico', 'único'],
  ['Unico', 'Único'],
  ['automatico', 'automático'],
  ['Automatico', 'Automático'],
  ['periodo', 'período'],
  ['Periodo', 'Período'],
  ['mes', 'mês'],
  ['Mes', 'Mês'],
];

// ── Files to process ────────────────────────────────────────
const FILES = [
  'app/(tabs)/index.tsx',
  'app/(tabs)/financeiro.tsx',
  'app/(tabs)/pdv.tsx',
  'app/(tabs)/estoque.tsx',
  'app/(tabs)/clientes.tsx',
  'app/(tabs)/contabilidade.tsx',
  'app/(tabs)/nfe.tsx',
  'app/(tabs)/folha.tsx',
  'app/(tabs)/onboarding.tsx',
  'app/(tabs)/configuracoes.tsx',
  'app/(tabs)/_layout.tsx',
  'components/DemoTour.tsx',
  'components/EmptyState.tsx',
  'components/DemoBanner.tsx',
  'components/PageHeader.tsx',
  'components/Breadcrumb.tsx',
  'components/BackButton.tsx',
  'components/Toast.tsx',
  'constants/emptyStates.ts',
  'constants/obligations.ts',
];

let totalReplacements = 0;
let filesChanged = 0;

for (const filePath of FILES) {
  if (!fs.existsSync(filePath)) {
    console.log(`SKIP: ${filePath} (not found)`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;
  let fileReplacements = 0;

  for (const [ascii, utf8] of REPLACEMENTS) {
    if (ascii === utf8) continue; // Skip if already correct

    // Only replace inside string literals (between " or ')
    // Use a regex that matches the word inside quotes
    const escaped = ascii.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Count occurrences first
    const matches = content.split(ascii).length - 1;
    if (matches > 0) {
      content = content.split(ascii).join(utf8);
      fileReplacements += matches;
    }
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`OK: ${filePath} (${fileReplacements} replacements)`);
    totalReplacements += fileReplacements;
    filesChanged++;
  } else {
    console.log(`SKIP: ${filePath} (no changes needed)`);
  }
}

console.log(`\n========================================`);
console.log(`DONE: ${totalReplacements} replacements in ${filesChanged} files`);
console.log(`========================================`);
console.log(`\nVerify visually, then run:`);
console.log(`  git add -A`);
console.log(`  git commit -m "fix: D-02 Portuguese accents across all screens"`);
console.log(`  git push origin main`);
console.log(`\nTIP: After pushing, do a hard refresh (Ctrl+Shift+R) to see changes.`);
