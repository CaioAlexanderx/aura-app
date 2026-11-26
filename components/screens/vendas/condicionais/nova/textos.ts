// ============================================================
// AURA. — Nova condicional · textos (C6, 26/11/2026)
//
// Palavras do mockup aprovado (condicional/mockup.html, fluxo "Nova
// condicional"), copiadas sem mudar. O que NÃO está no mockup vem marcado
// "FORA DO MOCKUP" para o Teo ver.
// ============================================================

const pecas = (n: number) => `${n} ${n === 1 ? "peça" : "peças"}`;

export const TEXTOS_DA_NOVA = {
  titulo: "Nova condicional",
  subtitulo: "A cliente leva para experimentar e decide depois",
  tituloGuardada: "Condicional guardada",
  fechar: "Fechar",
  passos: ["Cliente", "Peças", "Prazo e conferência", "Pronto"] as const,
  passoDe: (n: number, nome: string) => `Passo ${n} de 4 · ${nome}`,
  pecas,

  // Consolidado: antes do passo 1.
  loja: {
    titulo: "De qual loja as peças vão sair?",
    sub: "A condicional é de uma loja só. A cliente vale nas duas.",
  },

  // Passo 1
  quemVaiLevar: "Quem vai levar as peças?",
  buscaPlaceholder: "Buscar cliente por nome ou telefone",
  escolhida: "Escolhida",
  novoCliente: "+ Novo cliente",
  notaObrigatorios: "Nome e telefone são obrigatórios na condicional: é por eles que a loja lembra a cliente do prazo.",
  rodapeCliente: (nome: string) => `Para ${nome}`,
  // FORA DO MOCKUP: o mockup só mostra o passo com a cliente escolhida.
  rodapeSemCliente: "Escolha a cliente para continuar",
  // FORA DO MOCKUP: cliente cadastrada sem telefone (o backend recusa com COND_TELEFONE).
  semTelefoneTitulo: "Esta cliente está sem telefone",
  semTelefoneTexto: "Informe o WhatsApp dela: é por ele que a loja lembra o prazo. Fica salvo no cadastro.",
  rodapeSemTelefone: "Falta o telefone da cliente",
  cancelar: "Cancelar",
  continuar: "Continuar",
  voltar: "Voltar",

  // Novo cliente
  voltarParaBusca: "Voltar para a busca",
  novoClienteTitulo: "Novo cliente",
  campoNome: "Nome",
  campoTelefone: "Telefone (WhatsApp)",
  campoCpf: "CPF (opcional)",
  cpfPlaceholder: "000.000.000-00",
  cpfDica: "Dá para completar depois, na ficha da cliente.",
  notaGrupo: "A cliente fica cadastrada para todas as lojas do grupo.",
  rodapeNovoCliente: "As peças e o prazo vêm a seguir.",
  salvarCliente: "Salvar cliente",
  // FORA DO MOCKUP: erros do cadastro.
  erroNome: "Informe o nome da cliente.",
  erroTelefone: "Informe o telefone com DDD, como (11) 98888-7777.",
  erroCpf: "O CPF não está certo. Confira ou apague o campo.",
  erroAoSalvar: "Não deu para salvar a cliente. Tente de novo.",

  // Passo 2
  buscaPeca: "Bipe a etiqueta ou busque por nome ou código",
  comeceTitulo: "Comece pelas peças.",
  comeceTexto: " Bipe a etiqueta de cada uma ou busque pelo nome. Cada peça entra com cor e tamanho, uma unidade por linha.",
  sugestoes: "Sugestões da busca",
  oQueElaVaiLevar: "O que ela vai levar",
  cor: "Cor",
  tamanho: "Tamanho",
  nLivres: (n: number) => (n === 1 ? "1 livre" : `${n} livres`),
  comCliente: "com cliente",
  // FORA DO MOCKUP: variante zerada que nenhuma cliente segura.
  semEstoque: "sem estoque",
  semEstoqueLivre: "sem estoque livre",
  nComClientes: (n: number) => (n === 1 ? "1 com cliente" : `${n} com clientes`),
  escolhaCorETamanho: (preco: string) => `${preco} · escolha a cor e o tamanho`,
  colocar: "Colocar na condicional",
  umaUn: "1 un.",
  tirar: (nome: string) => `Tirar ${nome}`,
  semUnidadeLivreChip: "Sem unidade livre",
  semUnidadeLivre: "Sem unidade livre. Entra mesmo assim porque sua loja vende sem estoque.",
  nenhumaPeca: "Nenhuma peça ainda",
  tirarPeca: "Tirar a peça",
  // FORA DO MOCKUP: a busca e o bipe.
  carregandoPecas: "Carregando as peças…",
  semResultadoPeca: "Nenhuma peça com esse nome ou código.",
  naoAchouCodigo: (codigo: string) => `Não achei a peça do código ${codigo}.`,
  noLimite: "Uma condicional leva até 60 peças.",
  tamanhoUnico: "tamanho único",
  ate: (a: string, b: string) => `${a} ao ${b}`,
  cores: (n: number) => `${n} cores`,

  // 409 COND_SEM_SALDO: a condicional que segura a peça.
  faltaTitulo: (nome: string) => `${nome} não tem unidade livre.`,
  faltaComCondicional: (num: string, cliente: string) =>
    ` A única do estoque consta com a ${cliente} (${num}). Se a peça está na sua mão, a ${cliente} já devolveu: registre a devolução dela primeiro.`,
  faltaSemCondicional: " Não há unidade livre no estoque.",

  // Trilho (Resumo)
  resumo: "Resumo",
  rCliente: "Cliente",
  rAEscolher: "a escolher",
  rPecas: "Peças",
  rNenhuma: "nenhuma ainda",
  rVoltaAte: "Volta até",
  rACombinar: "a combinar",
  rVendedora: "Vendedora",
  rTotal: "Total das peças",
  notaNadaCobrado: "Nada é cobrado agora. As peças saem da loja, mas continuam no estoque como \"com cliente\".",
} as const;
