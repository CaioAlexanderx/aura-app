// ============================================================
// AURA. — Check-in de entrada: perguntas, opções e textos (14/10/2026)
//
// Fonte: board da Aura, aba Produto (seção 5) e aba CS (seção 3.8, v2 da
// Cassie fechada com a Nina em 13/10) + mockup "Check-in de entrada"
// (claude.ai/artifact/2FzKTdEMq3DSbmPgNkJjnj). Cartão t1-12, parte 2.
//
// Regras do desenho:
//   · só 3 perguntas no app; todas em chip, nenhum campo digitado;
//   · "Pular" sempre visível; leva menos de 1 minuto;
//   · cada pergunta muda o que a loja vê logo depois (o "Vamos abrir com");
//   · opção que o plano não tem SOME (premissa do Essencial, 16/09): cada
//     opção de "por onde começar" aponta o módulo da tela de destino
//     (`mod`) e é filtrada por useVisibleModules — nunca fica desabilitada.
//
// Contrato com o backend (frente C): PUT /companies/:id/checkin recebe
// { comeco?, onde_anota?, produtos_faixa?, pulou? }, strings de até 40
// caracteres. Os `valor` abaixo são esses códigos (estáveis: o painel da
// Cassie lê por eles), e `rotulo` é o que a loja lê.
// ============================================================

/** Chave de módulo própria da tela (CLAUDE.md, armadilha 3). */
export const MOD_CHECKIN = "onboarding.checkin";
/** Versão do conjunto de perguntas (o backend devolve `versao`). */
export const VERSAO_CHECKIN = 1;
/** Limite do backend para cada resposta. */
export const MAX_RESPOSTA = 40;

export type ChaveResposta = "comeco" | "onde_anota" | "produtos_faixa";

export type OpcaoCheckin = {
  valor: string;
  rotulo: string;
  /** Módulo da tela de destino; sem `mod` vale para todos. */
  mod?: string;
};

export type PerguntaCheckin = {
  chave: ChaveResposta;
  pergunta: string;
  opcoes: OpcaoCheckin[];
};

export const PERGUNTAS_CHECKIN: PerguntaCheckin[] = [
  {
    chave: "comeco",
    pergunta: "Por onde você quer começar?",
    opcoes: [
      { valor: "estoque", rotulo: "Organizar meu estoque", mod: "estoque" },
      { valor: "caixa", rotulo: "Vender no caixa", mod: "pdv" },
      { valor: "fiado", rotulo: "Controlar fiado", mod: "crediario" },
      { valor: "nota_fiscal", rotulo: "Emitir nota fiscal", mod: "nfe" },
      { valor: "loja_online", rotulo: "Vender pela internet", mod: "canal" },
      { valor: "sumidos", rotulo: "Chamar clientes que sumiram", mod: "clientes.reativacao" },
      { valor: "outra", rotulo: "Outra coisa" },
    ],
  },
  {
    chave: "onde_anota",
    pergunta: "Hoje, onde você anota o que tem e o que vende?",
    opcoes: [
      { valor: "caderno", rotulo: "Caderno" },
      { valor: "planilha", rotulo: "Planilha" },
      { valor: "outro_sistema", rotulo: "Outro sistema" },
      { valor: "nao_anoto", rotulo: "Ainda não anoto" },
    ],
  },
  {
    chave: "produtos_faixa",
    pergunta: "Mais ou menos quantos produtos você tem?",
    opcoes: [
      { valor: "ate_50", rotulo: "Até 50" },
      { valor: "de_51_a_300", rotulo: "51 a 300" },
      { valor: "de_301_a_1000", rotulo: "301 a 1.000" },
      { valor: "mais_de_1000", rotulo: "Mais de 1.000" },
    ],
  },
];

export const TEXTOS_CHECKIN = {
  marca: "Aura.",
  tempo: "Menos de 1 minuto",
  saudacao: "Sua Aura já abre como loja em geral.",
  titulo: "Três perguntas para abrir do seu jeito",
  subtitulo: "Dá para pular. Nada aqui é obrigatório.",
  abrirComRotulo: "Vamos abrir com",
  abrirComVazio: "Responda acima, ou pule",
  continuar: "Continuar",
  pular: "Pular por enquanto",
  rodape: "Você muda isso depois em Configurações.",
} as const;
