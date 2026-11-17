// ============================================================
// AURA. — Troca · textos do "Crédito para" (p-166 e p-167, 17/11/2026)
//
// As PALAVRAS ainda são proposta (notas do mockup "Caixa e Troca", Parte 4,
// tabela "Troca"). Ficam todas aqui para trocar num lugar só.
// ============================================================

export const TEXTOS_DO_CLIENTE = {
  rotulo: "Crédito para",
  trocar: "Trocar",
  daVendaOriginal: "cliente da venda original",
  semTelefone: "sem telefone",
  dicaPresente: "É presente? Toque em Trocar e escolha quem vai usar o crédito.",
  lojaDoCredito: "O crédito vale nesta loja:",

  vendaSemCliente: "Esta venda foi feita sem cliente",
  vendaSemClienteSub: "Escolha quem vai ficar com o crédito. Se a pessoa não tem cadastro, dá para criar agora.",
  escolherCliente: "Escolher cliente",

  buscaPlaceholder: "Buscar por nome ou telefone…",
  buscaRotulo: "Buscar cliente por nome ou telefone",
  recentes: "Recentes",
  resultados: "Resultados",
  cancelar: "Cancelar",
  carregando: "Carregando os clientes…",
  semResultado: "Ninguém com esse nome ou telefone por aqui. Quer cadastrar agora?",
  semResultadoSemCadastro: "Ninguém com esse nome ou telefone por aqui.",
  semClientes: "Nenhum cliente cadastrado ainda.",

  notaPasso3: "O crédito fica guardado no nome de um cliente. Se a pessoa ainda não tem cadastro, dá para criar aqui mesmo, só com o nome.",

  rodapeFaltaCliente: "falta escolher o cliente do crédito",
  rodapeCreditoPara: (nome: string) => `crédito para ${nome}`,
  rodapeTravado: "Para confirmar, escolha o cliente que vai ficar com o crédito.",

  // Respostas do servidor (Aura-backend#1043).
  erroCreditoExigeCliente: "Para deixar o valor como crédito, escolha o cliente que vai ficar com ele.",
  erroClienteNaoEncontrado: "Não achamos esse cliente nas suas lojas. Escolha o cliente de novo.",
} as const;
