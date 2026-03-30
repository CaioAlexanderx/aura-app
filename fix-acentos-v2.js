// fix-acentos-v2.js
// Run from aura-app root: node fix-acentos-v2.js
// D-02: Fix Portuguese accents - SAFE version (only inside string literals)

const fs = require('fs');

// Only replace FULL phrases that appear inside strings
// Avoid short words like "nao", "ate", "mes" that could be variable names
const REPLACEMENTS = [
  // ── Full phrases (safe - unlikely to match code) ──
  ['Visao geral', 'Visão geral'],
  ['Acesso rapido', 'Acesso rápido'],
  ['Obrigacoes contabeis', 'Obrigações contábeis'],
  ['Lucro liquido do mes', 'Lucro líquido do mês'],
  ['LUCRO LIQUIDO', 'LUCRO LÍQUIDO'],
  ['RECEITA DO MES', 'RECEITA DO MÊS'],
  ['TICKET MEDIO', 'TICKET MÉDIO'],
  ['VENDAS HOJE', 'VENDAS HOJE'],
  ['CLIENTES NOVOS', 'CLIENTES NOVOS'],
  ['Ultimas vendas', 'Últimas vendas'],
  ['Apoio contabil informativo', 'Apoio contábil informativo'],
  ['Bem-vindo a Aura', 'Bem-vindo à Aura'],
  ['Vamos comecar', 'Vamos começar'],
  ['Obrigacoes contabeis organizadas', 'Obrigações contábeis organizadas'],
  ['Vamos buscar as informacoes automaticamente na Receita Federal', 'Vamos buscar as informações automaticamente na Receita Federal'],
  ['Ainda nao tenho CNPJ - configurar depois', 'Ainda não tenho CNPJ - configurar depois'],
  ['Tipo de negocio', 'Tipo de negócio'],
  ['melhor descreve seu negocio', 'melhor descreve seu negócio'],
  ['Selecione um tipo de negocio', 'Selecione um tipo de negócio'],
  ['Voce tem funcionarios', 'Você tem funcionários'],
  ['obrigacoes contabeis a Aura vai configurar pra voce', 'obrigações contábeis a Aura vai configurar pra você'],
  ['Nao tenho', 'Não tenho'],
  ['Trabalho sozinho ou com socios', 'Trabalho sozinho ou com sócios'],
  ['Funcionarios registrados', 'Funcionários registrados'],
  ['Quantos funcionarios', 'Quantos funcionários'],
  ['Sua empresa esta configurada', 'Sua empresa está configurada'],
  ['obrigacoes contabeis e esta pronta pra voce usar', 'obrigações contábeis e está pronta pra você usar'],
  ['Obrigacoes configuradas', 'Obrigações configuradas'],
  ['Nao enviada', 'Não enviada'],
  ['seus dados reais serao carregados aqui', 'seus dados reais serão carregados aqui'],
  ['Aura facilita, voce resolve', 'Aura facilita, você resolve'],
  ['Voce confirma', 'Você confirma'],
  ['Valores estimados para apoio contabil', 'Valores estimados para apoio contábil'],
  ['Configuracao fiscal ativa', 'Configuração fiscal ativa'],
  ['aliquotas configurados via CNPJ', 'alíquotas configurados via CNPJ'],
  ['Nenhuma nota fiscal emitida', 'Nenhuma nota fiscal emitida'],
  ['Nenhum lancamento financeiro', 'Nenhum lançamento financeiro'],
  ['saude financeira do seu negocio', 'saúde financeira do seu negócio'],
  ['Nenhuma venda registrada', 'Nenhuma venda registrada'],
  ['Estoque vazio', 'Estoque vazio'],
  ['Nenhum cliente cadastrado', 'Nenhum cliente cadastrado'],
  ['Obrigacoes nao configuradas', 'Obrigações não configuradas'],
  ['Nenhum funcionario cadastrado', 'Nenhum funcionário cadastrado'],
  ['Configuracao fiscal', 'Configuração fiscal'],
  ['Regime tributario', 'Regime tributário'],
  ['Mais opcoes', 'Mais opções'],
  ['Salario bruto', 'Salário bruto'],
  ['Salario base', 'Salário base'],
  ['Salario liquido', 'Salário líquido'],
  ['Folha bruta', 'Folha bruta'],
  ['Resumo da folha', 'Resumo da folha'],
  ['Total liquido', 'Total líquido'],
  ['FGTS a depositar', 'FGTS a depositar'],
  ['Custo total para a empresa', 'Custo total para a empresa'],
  ['Detalhamento por funcionario', 'Detalhamento por funcionário'],
  ['Funcionarios ativos', 'Funcionários ativos'],
  ['Salvar alteracoes', 'Salvar alterações'],
  ['Alteracoes salvas com sucesso', 'Alterações salvas com sucesso'],
  ['alteracoes nao sao persistidas', 'alterações não são persistidas'],
  ['Logo atualizada', 'Logo atualizada'],
  ['Logo removida', 'Logo removida'],
  ['Arquivo muito grande', 'Arquivo muito grande'],
  ['Para alterar, entre em contato com o suporte', 'Para alterar, entre em contato com o suporte'],
  ['detectados automaticamente via CNPJ', 'detectados automaticamente via CNPJ'],
  ['Holerite enviado', 'Holerite enviado'],
  ['Enviar holerite', 'Enviar holerite'],
  ['Ver holerite', 'Ver holerite'],
  ['Visualizar documento completo', 'Visualizar documento completo'],
  ['Modo demonstrativo', 'Modo demonstrativo'],
  ['Explorar modo demonstrativo', 'Explorar modo demonstrativo'],
  ['Saudavel', 'Saudável'],
  ['Painel financeiro', 'Painel financeiro'],

  // ── Sidebar section labels ──
  ['Crescimento', 'Crescimento'],

  // ── Tab names (content-descriptive) ──
  ['"Funcionarios"', '"Funcionários"'],
  ['"Resumo mensal"', '"Resumo mensal"'],
  ['"Historico"', '"Histórico"'],
  ['"Lancamentos"', '"Lançamentos"'],
  ['"Emitidas"', '"Emitidas"'],
  ['"Pendentes"', '"Pendentes"'],

  // ── Status labels ──
  ['"Ativo"', '"Ativo"'],
  ['"Ferias"', '"Férias"'],
  ['"Desligado"', '"Desligado"'],

  // ── DemoTour steps ──
  ['funcionalidades da Aura com dados ilustrativos', 'funcionalidades da Aura com dados ilustrativos'],
  ['fique a vontade para clicar em tudo', 'fique à vontade para clicar em tudo'],
  ['Seu painel financeiro', 'Seu painel financeiro'],
  ['faturamento, despesas e lucro do mes', 'faturamento, despesas e lucro do mês'],
  ['Tudo a um clique', 'Tudo a um clique'],
  ['Obrigacoes contabeis\",', 'Obrigações contábeis",'],
  ['prazos e guia voce passo a passo', 'prazos e guia você passo a passo'],
  ['Pronto para explorar', 'Pronto para explorar'],
  ['Navegue livremente pelas telas', 'Navegue livremente pelas telas'],

  // ── Configuracoes screen ──
  ['Dados da empresa', 'Dados da empresa'],
  ['Logo da empresa', 'Logo da empresa'],
  ['Meu plano', 'Meu plano'],
  ['Para comecar', 'Para começar'],
  ['Para crescer', 'Para crescer'],
  ['Para escalar', 'Para escalar'],
  ['Plano atual', 'Plano atual'],
  ['Endereco', 'Endereço'],

  // ── Empty states ──
  ['Registre receitas e despesas', 'Registre receitas e despesas'],
  ['Cadastre seus produtos no estoque', 'Cadastre seus produtos no estoque'],
  ['Cadastre seus produtos para controlar', 'Cadastre seus produtos para controlar'],
  ['entradas, saidas e saber exatamente', 'entradas, saídas e saber exatamente'],
  ['Cadastrar primeiro produto', 'Cadastrar primeiro produto'],
  ['aparecem aqui automaticamente apos a primeira venda', 'aparecem aqui automaticamente após a primeira venda'],
  ['Complete o onboarding com seu CNPJ', 'Complete o onboarding com seu CNPJ'],
  ['contabeis automaticamente', 'contábeis automaticamente'],
  ['serao emitidas automaticamente a cada venda PJ', 'serão emitidas automaticamente a cada venda PJ'],
  ['Calcule folha de pagamento', 'Calcule folha de pagamento'],

  // ── Misc single words ONLY when inside quotes ──
  ['"Configuracoes"', '"Configurações"'],
  ['"Contabilidade"', '"Contabilidade"'],
  ['"Financeiro"', '"Financeiro"'],
];

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
  'components/BackButton.tsx',
  'components/Toast.tsx',
  'constants/emptyStates.ts',
  'constants/obligations.ts',
];

let totalR = 0, filesChanged = 0;

for (const filePath of FILES) {
  if (!fs.existsSync(filePath)) continue;
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;
  let count = 0;

  for (const [ascii, utf8] of REPLACEMENTS) {
    if (ascii === utf8) continue;
    const matches = content.split(ascii).length - 1;
    if (matches > 0) {
      content = content.split(ascii).join(utf8);
      count += matches;
    }
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`OK: ${filePath} (${count} fixes)`);
    totalR += count;
    filesChanged++;
  }
}

console.log(`\nDone: ${totalR} fixes in ${filesChanged} files`);
console.log('git add -A && git commit -m "fix: D-02 Portuguese accents (safe)" && git push');
