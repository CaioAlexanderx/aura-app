// ============================================================
// AURA. — Estoque · "Chegou mercadoria": TEXTOS DA TELA (Fase 3)
//
// Arquivo separado para a revisão do Caio. As palavras da Fase 3 precisam
// do OK dele ANTES do A8 colocar o botão "Chegou mercadoria" na barra.
// Até lá o wizard existe no código e ninguém o vê.
//
// Origem: estoque-portas-mockup-17-11.html (parte 4 e estados) e a seção
// (b) das notas do mockup. Quando um texto NÃO está no mockup, o
// comentário da linha diz "NOVO (fora do mockup)": são os que pedem
// atenção na revisão.
//
// Funções recebem os pedaços variáveis ([nome], [n], [dd/mm]).
// ============================================================

const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);

export const TEXTOS_CHEGOU = {
  // ── Cabeçalho e passos ─────────────────────────────────────
  titulo: "Chegou mercadoria",
  subtitulo: (loja: string) => "Entrada na loja " + loja,
  // NOVO (fora do mockup): loja sem nome no cadastro.
  subtituloSemLoja: "Entrada na sua loja",
  passos: { 1: "Fornecedor", 2: "De onde vêm os itens", 3: "Conferir", 4: "Pronto" } as Record<1 | 2 | 3 | 4, string>,
  /** Passo feito, com o que foi escolhido: "Fornecedor · Distribuidora Alfa". */
  passoFeitoFornecedor: (nome: string) => "Fornecedor · " + nome,
  passoFeitoNota: (numero: string) => "Nota " + numero,
  passoCelular: (n: number, rotulo: string) => "Passo " + n + " de 4 · " + rotulo,
  fechar: "Fechar",

  // ── Rodapé ─────────────────────────────────────────────────
  cancelar: "Cancelar",
  continuar: "Continuar",
  voltar: "Voltar",
  rodapeFornecedor: (nome: string) => "Fornecedor: " + nome,
  // NOVO (fora do mockup): rodapé do passo 1 antes de escolher.
  rodapeSemEscolha: "Escolha quem mandou a mercadoria",
  // NOVO (fora do mockup): rodapé quando a pessoa seguiu sem fornecedor.
  rodapeSemFornecedor: "Sem fornecedor",

  // ── Sair no meio ───────────────────────────────────────────
  // NOVO (fora do mockup): mesma ideia do "Descartar esta operação?" da Troca.
  sairTitulo: "Sair sem dar entrada?",
  sairTexto: "O que você conferiu aqui não fica guardado. O estoque não muda.",
  sairFicar: "Continuar aqui",
  sairSair: "Sair",

  // ── Passo 1 · Fornecedor ───────────────────────────────────
  pergunta1: "Quem mandou a mercadoria?",
  busca: "Buscar por nome, CNPJ ou vendedor",
  maisUsados: "Mais usados",
  linhaProdutos: (n: number) => n + " " + plural(n, "produto", "produtos"),
  linhaUltimaEntrega: (ddmm: string) => "última entrega " + ddmm,
  // NOVO (fora do mockup): a busca não achou ninguém.
  buscaVazia: "Nenhum fornecedor com esse nome ou CNPJ.",
  // NOVO (fora do mockup): a lista de fornecedores não carregou.
  listaComErro: "Não conseguimos carregar os fornecedores. Você pode cadastrar um novo ou seguir sem fornecedor.",
  novoTitulo: "Novo fornecedor",
  novoApoio: "Com o CNPJ, o resto se preenche sozinho",
  semTitulo: "Seguir sem fornecedor",
  semApoio: "A entrada soma o estoque do mesmo jeito. Dá para ligar o fornecedor depois.",
  notaCartaoTitulo: "Tem o arquivo da nota?",
  notaCartaoApoio: "Escolha o arquivo que o fornecedor mandou e a Aura acha o fornecedor pelo CNPJ da nota.",
  notaCartaoBotao: "Escolher o arquivo da nota",
  porqueTitulo: "Por que o fornecedor",
  porqueTexto: "Cada entrada guarda quem vendeu e por quanto. É assim que a Aura mostra quem vende mais barato e o custo de cada um.",

  // ── Passo 1 · Novo fornecedor (FornecedorFormSheet dentro do passo) ──
  voltarParaLista: "Voltar para a lista",
  novoSalvar: "Salvar e continuar",
  novoRodape: "O que a Receita preencheu você pode mudar",
  usarExistente: (nome: string) => "Usar " + nome,
  existenteRodape: "Assim o mesmo fornecedor não fica duas vezes na lista",

  // ── Leitura do arquivo ─────────────────────────────────────
  lendoTitulo: "Lendo a nota…",
  lendoTexto: "Estamos conferindo cada item com os produtos da sua loja. Notas grandes levam alguns segundos.",
  arquivoErradoTitulo: "Esse arquivo não parece ser a nota do fornecedor.",
  arquivoErradoTexto: "Procure no e-mail do fornecedor o anexo que termina em .xml. O PDF não serve, porque é só a imagem da nota.",
  escolherOutroArquivo: "Escolher outro arquivo",

  // ── Passo 2 · De onde vêm os itens ─────────────────────────
  pergunta2: "Como você quer trazer os itens?",
  origemNotaTitulo: "Nota de compra do fornecedor",
  origemNotaApoio: "O arquivo da nota que o fornecedor manda por e-mail ou WhatsApp, junto com o PDF. Traz itens, quantidades e custos.",
  origemNotaFormato: "Termina em .xml",
  origemNotaBotao: "Escolher o arquivo da nota",
  origemPlanilhaTitulo: "Planilha",
  origemPlanilhaApoio: "A lista que o fornecedor mandou, ou uma sua. Precisa de nome ou código, quantidade e custo.",
  origemPlanilhaFormato: "Excel ou CSV",
  origemPlanilhaBotao: "Escolher planilha",
  origemPlanilhaModelo: "Baixar modelo",
  origemDigitarTitulo: "Digitar os itens",
  origemDigitarApoio: "Para quando veio sem nota ou com poucos itens. Busca o produto, diz quantos e o custo.",
  origemDigitarFormato: "Um por linha",
  origemDigitarBotao: "Digitar",
  rodapePdf: "O PDF da nota não serve: ele é só a imagem. Procure o anexo que termina em .xml.",
  // NOVO (fora do mockup): a nota escolhida, já lida, no passo 2.
  notaLida: (numero: string, emitente: string, itens: number) =>
    "Nota " + numero + " da " + emitente + " · " + itens + " " + plural(itens, "item", "itens"),

  // Nota de outro CNPJ (pendência 2: perguntar sempre, nunca trocar sozinho).
  outroCnpjTitulo: (emitente: string, fornecedor: string) => "Esta nota é da " + emitente + ", não da " + fornecedor + ".",
  outroCnpjDetalhe: (cnpj: string, numero: string, itens: number) =>
    "CNPJ da nota " + cnpj + " · Nota " + numero + " · " + itens + " " + plural(itens, "item", "itens"),
  usarEmitente: (emitente: string) => "Usar " + emitente,
  cadastrarEmitente: (emitente: string) => "Cadastrar " + emitente,
  manterFornecedor: (fornecedor: string) => "Manter " + fornecedor,
  semFornecedorLigar: (emitente: string) => "A nota é da " + emitente + ". Ligar a ela?",

  // Nota repetida (B3: GET /products/stock-receipts).
  repetidaTitulo: (numero: string, fornecedor: string | null, ddmm: string) =>
    "A nota " + numero + (fornecedor ? " da " + fornecedor : "") + " já entrou em " + ddmm + ".",
  repetidaTexto: "Se for outra entrega com o mesmo número, pode seguir.",
  repetidaVer: "Ver aquela entrada",
  repetidaSeguir: "Seguir mesmo assim",
  // NOVO (fora do mockup): o que "Ver aquela entrada" mostra ali mesmo.
  repetidaDetalhe: (ddmm: string, hhmm: string, itens: number | null) =>
    "Entrou em " + ddmm + " às " + hhmm + (itens ? ", com " + itens + " " + plural(itens, "item", "itens") : "") + ".",

  // ── Passo 3 · Conferir ─────────────────────────────────────
  colItem: "Item da nota → produto da loja",
  colChegou: "Chegou",
  colCusto: "Custo",
  colEstoque: "Estoque e custo médio",
  achadoPor: {
    codigo_fornecedor: "achado pelo código do fornecedor",
    codigo_barras: "achado pelo código de barras",
    nome: "achado pelo nome",
  } as Record<"codigo_fornecedor" | "codigo_barras" | "nome", string>,
  codigoDoItem: (cod: string) => "cód. " + cod,
  previaEstoque: (antes: string, depois: string, un: string) => "Estoque " + antes + " → " + depois + " " + un,
  previaCusto: (antes: string, depois: string) => "Custo médio " + antes + " → " + depois,
  previaMargem: (antes: number | null, depois: number) => "Margem " + (antes !== null ? antes + "% → " : "") + depois + "%",

  semParTitulo: "Este item não está na sua loja",
  produtoNovo: "Produto novo",
  entraCom: (q: string, custo: string | null) => "Entra com " + q + " un" + (custo ? " e custo " + custo : ""),
  semParTexto: "Escolha: cadastrar como produto novo ou ligar a um que você já tem.",
  cadastrarNovo: "Cadastrar novo",
  ligarProduto: "Ligar a um produto",
  deixarDeFora: "Deixar de fora",
  vivoNovo: (q: string, custo: string | null) =>
    "Vai ser cadastrado como produto novo, com " + q + " un" + (custo ? " e custo " + custo : "") + ".",
  vivoLigar: "Busque o produto da sua loja para ligar este item.",
  vivoFora: "Fica de fora desta entrada. A nota continua guardada.",

  confere: (custo: string, costuma: string) => "Confere? " + custo + " está bem acima do que você costuma pagar (" + costuma + ").",
  corrigirCusto: "Corrigir o custo",
  estaCerto: "Está certo",

  erroQtdZero: "A nota traz este item com quantidade zero. Ele fica de fora; se chegou, diga quantos.",
  dizerQuantos: "Dizer quantos",

  // NOVO (fora do mockup): a grade na conferência não foi desenhada. O item
  // casou com um produto que tem cores e tamanhos, mas a nota não diz qual.
  gradeTexto: "Este produto tem cores e tamanhos. Diga de qual chegou antes de dar entrada.",
  // A4b: a grade reaproveita o "Quantas chegaram de cada?" da Entrada de hoje.
  gradeTitulo: "Quantas chegaram de cada?",
  gradeCarregando: "Carregando cores e tamanhos…",
  // NOVO (fora do mockup): a nota diz um total e a grade outro.
  gradeSomaDiferente: (grade: string, nota: string) => "A grade soma " + grade + "; a nota diz " + nota + ".",

  // ── Passo 3 · painéis da linha sem par (A4b) ───────────────
  novoNome: "Nome na sua loja",
  novoPreco: "Preço de venda *",
  novoCategoria: "Categoria",
  // NOVO (fora do mockup): exemplo dentro do campo de categoria.
  novoCategoriaExemplo: "Ex.: Esmaltes",
  novoMargem: (pct: number) => "Margem de " + pct + "% sobre o custo da nota",
  novoNcm: (ncm: string) => "NCM da nota: " + ncm,
  novoCelularApoio: "Fotos, cor e o resto você completa no produto depois.",
  // NOVO (fora do mockup): preço vazio de quem não vê custo.
  novoPrecoFalta: "Diga o preço de venda para cadastrar.",
  ligarEscolha: "Escolha o produto abaixo",
  // Texto de hoje da Entrada de mercadoria.
  ligarBusca: "Buscar produto…",
  ligarVazio: "Nenhum produto com esse nome.",
  ligarLinha: (estoque: string, un: string, medio: string | null) =>
    estoque + " " + un + (medio ? " · custo médio " + medio : ""),
  ligarCodigo: (cod: string) => "Ligando, a Aura guarda o código " + cod + " deste fornecedor e acha sozinha na próxima nota.",
  trocarProduto: "Trocar produto",
  margemTitulo: "Preço dos produtos novos",
  margemRotulo: "Margem sobre o custo",
  margemAplicar: "Aplicar",

  mostrarOutros: (n: number) => "Mostrar os outros " + n + " " + plural(n, "item", "itens") + ", já " + plural(n, "pronto", "prontos"),

  resumoNota: (numero: string, ddmm: string | null) => "Nota " + numero + (ddmm ? " · " + ddmm : ""),
  resumoItens: "Itens na nota",
  resumoProntos: "Prontos",
  resumoNovos: "Produtos novos",
  resumoFalta: "Falta decidir",
  resumoFora: "Ficam de fora",
  resumoTotal: "Total da compra",
  totalBate: (total: string) => "O total bate com o da nota (" + total + ").",
  // NOVO (fora do mockup): quando a soma das linhas não bate.
  totalNaoBate: (itens: string, nota: string) => "A soma dos itens (" + itens + ") não bate com o total da nota (" + nota + "). Confira as linhas.",
  usarMedio: "Usar o custo médio como custo do produto",
  usarMedioApoio: "É o custo que entra na margem e nos relatórios.",

  rodapeFaltam: (n: number) =>
    n === 1
      ? "Falta 1 item: cadastrar novo, ligar a um produto ou deixar de fora"
      : "Faltam " + n + " itens: cadastrar novo, ligar a um produto ou deixar de fora",
  rodapeFaltaLigar: (nome: string) => "Falta 1 item: escolha o produto para " + nome,
  // NOVO (fora do mockup): falta 1 item e é a grade.
  rodapeFaltaGrade: (nome: string) => "Falta 1 item: diga a cor e o tamanho de " + nome,
  rodapeFaltaCelular: (n: number) => "Falta decidir " + n + " " + plural(n, "item", "itens"),
  // NOVO (fora do mockup): todas as linhas ficaram de fora.
  rodapeNada: "Nenhum item para dar entrada",
  darEntrada: (n: number) => "Dar entrada em " + n + " " + plural(n, "item", "itens"),
  darEntradaCelular: "Dar entrada",

  // ── Passo 3 · origem "Digitar os itens" (A5) ───────────────
  passoFeitoDigitar: "Digitar",
  // Textos de hoje da Entrada de mercadoria.
  digitarPergunta: "Qual produto chegou?",
  digitarQuantidade: "Quantidade que chegou",
  digitarCusto: "Custo de cada unidade",
  notaNumero: "Nº da nota (opcional)",
  notaExemplo: "Ex.: 004512",
  cadastrarComoNovo: (busca: string) => "Cadastrar \"" + busca + "\" como produto novo",
  digitarNovoApoio: "Só nome e preço; o resto depois",
  digitarRodape: (n: number, total: string | null) => n + " " + plural(n, "item", "itens") + (total ? " · total " + total : ""),
  // NOVO (fora do mockup): linha sem quantidade (ou novo sem nome e preço).
  digitarFaltam: (n: number) =>
    n === 1 ? "Falta completar 1 item: quantos chegaram, ou o nome e o preço do novo"
      : "Faltam completar " + n + " itens: quantos chegaram, ou o nome e o preço do novo",
  // NOVO (fora do mockup): leitor de tela do "x" da linha.
  digitarTirar: "Tirar da lista",

  // ── Gravando e Pronto (A7) ─────────────────────────────────
  gravandoTitulo: "Dando entrada…",
  gravandoTexto: (x: number, n: number) =>
    x + " de " + n + " " + plural(n, "item", "itens") + ". Pode deixar esta tela aberta. Se ela fechar, o que já entrou fica gravado e nada entra em dobro.",
  prontoTitulo: "A mercadoria entrou no estoque",
  prontoTituloCelular: "Entrou no estoque",
  prontoNota: (numero: string, fornecedor: string | null, total: string | null) =>
    "Nota " + numero + (fornecedor ? " da " + fornecedor : "") + (total ? " · " + total : ""),
  // NOVO (fora do mockup): cabeçalho do Pronto quando não veio de nota.
  prontoSemNota: (fornecedor: string | null, total: string | null) =>
    [fornecedor, total].filter(Boolean).join(" · "),
  prontoComEntrada: (n: number) => n + " " + plural(n, "produto", "produtos") + " com entrada",
  prontoComEntradaDetalhe: (x: number, y: number) => x + " que você já tinha e " + y + " " + plural(y, "cadastrado", "cadastrados") + " agora",
  prontoComEntradaCelular: (n: number, x: number, y: number) =>
    n + " " + plural(n, "produto", "produtos") + " com entrada (" + x + " já " + plural(x, "existia", "existiam") + ", " + y + " " + plural(y, "novo", "novos") + ")",
  prontoCadastrados: (n: number) => n + " " + plural(n, "produto cadastrado", "produtos cadastrados"),
  prontoLigados: (n: number, fornecedor: string, comCusto: boolean) =>
    n + " " + plural(n, "produto ligado", "produtos ligados") + " à " + fornecedor + (comCusto ? ", com o custo desta nota" : ""),
  prontoLigadosCelular: (fornecedor: string) => "ligados à " + fornecedor,
  prontoForaUm: (nome: string, motivo: string) =>
    "1 item ficou de fora: " + nome + " (" + motivo + "). Se ele chegou, dê entrada pela linha dele no Estoque.",
  // NOVO (fora do mockup): mais de um item de fora.
  prontoForaVarios: (n: number) => n + " itens ficaram de fora. Se algum chegou, dê entrada pela linha dele no Estoque.",
  prontoForaCelular: (n: number) => n + " " + plural(n, "ficou", "ficaram") + " de fora",
  // NOVO (fora do mockup): os motivos entre parênteses.
  motivoFora: "você deixou de fora",
  motivoQtdZero: "veio com quantidade zero",
  prontoNovosApoio: (n: number) =>
    (n === 1 ? "O produto novo está" : "Os " + n + " produtos novos estão") + " com nome, preço, custo e estoque. Fotos e cor você completa quando quiser.",
  prontoSemDobro: "Nada entra em dobro se você abrir esta nota de novo",
  verNovos: "Ver os produtos novos",
  verNovosCelular: "Ver os novos",
  falhaTitulo: (x: number, n: number) => "Entraram " + x + " dos " + n + " itens.",
  falhaTexto: (x: number, y: number) =>
    "A conexão caiu antes do fim. Os " + x + " já estão no estoque; os outros " + y + " estão guardados aqui.",
  falhaRepetir: (y: number) => "Dar entrada nos " + y + " que faltam",
  falhaBaixar: (y: number) => "Baixar a lista dos " + y,
  falhaSemDobro: (x: number) => "Tentar de novo não soma em dobro os " + x + " que já entraram.",

  // NOVO (fora do mockup): erros ao gravar. Nada foi gravado em nenhum deles.
  erroLinhas: "Alguns itens voltaram com problema. Nada foi gravado: confira as linhas marcadas e dê entrada de novo.",
  erroLimite: (limite: number) =>
    "A loja chegou ao limite de " + limite + " produtos do plano. Nada foi gravado. Ligue os itens a produtos que você já tem ou deixe alguns de fora.",
  erroIndisponivel: "A entrada de vários itens ainda não está disponível. Tente de novo em alguns minutos.",
  erroSemResposta: "Não tivemos resposta da Aura. Tente de novo: nada entra em dobro.",
  erroVariante: "Não achamos a cor e o tamanho pelo código de barras. Diga de qual chegou.",
  erroGenerico: "Não conseguimos dar entrada. Nada foi gravado; tente de novo.",
} as const;

export type TextosChegou = typeof TEXTOS_CHEGOU;
