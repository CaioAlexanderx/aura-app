// ============================================================
// AURA. — Novo pedido · textos de tela (A2, p-63b, 17/11/2026)
//
// Saem do mockup "Pedido separado de venda" aprovado pelo Caio em 17/11
// (partes 2 e 7). Os marcados FORA DO MOCKUP foram escritos no card e esperam
// o OK do Caio (lista no PR). Ficam todos aqui para trocar num lugar só.
// Sem sinal neste card: o sinal é o A3 (passo 2 vira "Sinal e data").
// ============================================================

const pecas = (n: number) => `${n} ${n === 1 ? "peça" : "peças"}`;

export const TEXTOS_DO_PEDIDO = {
  titulo: "Novo pedido",
  subtitulo: "As peças ficam reservadas até a cliente buscar",
  tituloPronto: "Pedido guardado",
  fechar: "Fechar",

  passos: {
    itensECliente: "Itens e cliente",
    // FORA DO MOCKUP: o mockup diz "Sinal e data"; sem o sinal (A3) o passo é só a data.
    data: "Data",
    pronto: "Pronto",
  },

  // Passo 1
  oQueFicaSeparado: "O que vai ficar separado",
  paraQuemE: "Para quem é",
  avisoTelefone: "Com o telefone, o aviso de \"pedido pronto\" vai pelo WhatsApp em um toque.",
  un: "un.",

  // Trilho
  resumo: "Resumo do pedido",
  pecas,
  reservadas: (n: number) => `${pecas(n)} ${n === 1 ? "reservada" : "reservadas"}. Elas continuam no estoque, mas o Caixa avisa antes de vender.`,
  faltaNaRetirada: "Falta na retirada",
  vemBuscar: (quando: string) => `Vem buscar ${quando}`,

  // Rodapé
  rodapePasso1: (n: number, nome: string | null) => (nome ? `${pecas(n)} · para ${nome}` : pecas(n)),
  // FORA DO MOCKUP
  rodapeEscolherCliente: "Escolha para quem é o pedido",
  rodapePasso2: (falta: string) => `Sem sinal · falta ${falta} na retirada`,
  // FORA DO MOCKUP
  rodapeEscolherData: "Escolha quando ela vem buscar",
  voltarAoCarrinho: "Voltar ao carrinho",
  continuar: "Continuar →",
  voltar: "← Voltar",
  guardarPedido: "Guardar pedido",
  tentarDeNovo: "Tentar de novo",

  // Passo 2
  quandoVemBuscar: "Quando ela vem buscar",
  amanha: "Amanhã",
  sexta: "Sexta",
  em7Dias: "Em 7 dias",
  outraData: "Outra data",

  // Erros
  erroDeRede: "Não deu para guardar o pedido agora. A internet pode ter caído. Nada foi cobrado e tudo continua preenchido.",
  // FORA DO MOCKUP (409 PEDIDO_SEM_SALDO; as frases das peças repetem as do backend)
  semSaldoTitulo: "Não dá para separar estas peças:",
  faltaComReserva: (nome: string, livre: number, reservado: number) =>
    `"${nome}": só ${livre} ${livre === 1 ? "livre" : "livres"} (${reservado} já ${reservado === 1 ? "separada" : "separadas"} em outro pedido).`,
  faltaSemReserva: (nome: string, livre: number) => `"${nome}": só ${livre} no estoque.`,
  semSaldoDica: "Volte ao carrinho e ajuste as quantidades.",

  // Cliente (troca/CreditoPara e troca/NovoClienteNaTroca com os textos do pedido)
  cliente: {
    rotulo: "Cliente do pedido",
    // FORA DO MOCKUP (estado sem cliente escolhido)
    vendaSemCliente: "Nenhum cliente escolhido",
    vendaSemClienteSub: "Busque pelo nome ou telefone, cadastre agora ou siga sem cliente.",
    escolherCliente: "Escolher cliente",
    voltarParaTroca: "Voltar para o pedido",
    novoClienteIntro: () => "Só o nome já resolve. O pedido fica no nome dessa pessoa.",
    campoTelefoneDica: "Com o telefone dá para avisar quando o pedido estiver pronto.",
    rodapeNovoCliente: "As peças do pedido continuam no lugar.",
    // FORA DO MOCKUP (a troca diz "Cliente salvo. Os itens da troca continuam no lugar.")
    clienteSalvo: "Cliente salvo. As peças do pedido continuam no lugar.",
  },
  seguirSemCliente: "Seguir sem cliente",
  seguirSemClienteSub: "O pedido fica só com um nome",
  // FORA DO MOCKUP: nome mostrado quando ela segue sem cliente e sem digitar nome.
  semClienteSemNome: "Sem cliente",

  // Passo 3
  pedidoGuardado: (numero: string) => `Pedido ${numero} guardado`,
  reservadasPara: (n: number, nome: string | null, quando: string) =>
    n === 1
      ? `A peça está reservada${nome ? ` para a ${nome}` : ""} até ${quando}.`
      : `As ${pecas(n)} estão reservadas${nome ? ` para a ${nome}` : ""} até ${quando}.`,
  enviar: "Enviar",
  novaVenda: "Nova venda",
  // FORA DO MOCKUP: texto do WhatsApp do "Enviar".
  textoDoWhatsApp: (nome: string, numero: string, quando: string) =>
    `Oi, ${nome}! Seu pedido ${numero} está separado aqui na loja. Fica guardado até ${quando}.`,
} as const;
