// Tom das mensagens que a lojista mais encontra (levantamento de 24/10/2026):
// reconhecer a situação, dizer o que fazer agora e, quando cabe, oferecer a
// conversa com a gente. Sem jargão ("servidor", "HTTP", "sessão") e sem
// gênero. Um lugar só para os textos, para o tom não se espalhar de novo.
//
// O número do WhatsApp da Aura não aparece aqui: onde o aviso é um toast sem
// botão, o texto só cita "pelo WhatsApp"; onde houver ação, a tela usa
// waAura() de "@/constants/suporteAura".

import { waAura } from "@/constants/suporteAura";

/** Falha de conexão em qualquer tela (fetch rejeitado). */
export const MSG_SEM_CONEXAO =
  "Não conseguimos falar com a Aura agora. Confira sua internet e tente de novo. Se continuar, a gente ajuda pelo WhatsApp.";

/** Não deu para renovar o acesso por falta de rede; a pessoa NÃO foi desconectada. */
export const MSG_SEM_CONEXAO_NA_SESSAO =
  "Não conseguimos confirmar o seu acesso agora, mas você continua com acesso. Confira sua internet e tente de novo.";

/** Sessão terminou (refresh recusado ou login vencido). */
export const MSG_SESSAO_TERMINOU =
  "Por segurança, sua sessão terminou. Entre de novo, que está tudo guardado aqui.";

/** Resposta de erro do nosso lado (5xx) sem texto próprio. */
export const MSG_ERRO_NOSSO =
  "Isso foi um erro nosso, não seu. Tente de novo em instantes. Se era uma venda ou um lançamento, confira se já foi registrado antes de repetir.";

/** Tempo esgotado: a operação pode ter dado certo, então não incentiva repetir. */
export const MSG_DEMOROU_DEMAIS =
  "Demorou mais do que deveria. Pode ser que já tenha dado certo, então confira antes de tentar de novo.";

/** Erro sem texto do backend. O código HTTP fica no ApiError.status e no console, nunca na tela. */
export const MSG_ERRO_SEM_EXPLICACAO =
  "Não deu certo desta vez. Tente de novo, e se persistir, a gente resolve com você pelo WhatsApp.";

/** Login com campo faltando. */
export const MSG_LOGIN_FALTA_DADO = "Falta o e-mail e a senha por aqui.";

/** Cadastro: a consulta de CNPJ não completou. */
export const MSG_CNPJ_INDISPONIVEL = "Não conseguimos consultar o CNPJ agora. Tente de novo em instantes.";

/** Conversa que os botões "Preciso de ajuda" e "Falar com a gente" abrem no WhatsApp da Aura. */
export const MSG_PEDIDO_DE_AJUDA = "Oi, preciso de ajuda com a minha conta da Aura.";

/** Link do WhatsApp da Aura com o pedido de ajuda já escrito (número só em constants/suporteAura). */
export function linkPedidoDeAjuda(): string {
  return waAura(MSG_PEDIDO_DE_AJUDA);
}

// ── Estados vazios (item 12) ─────────────────────────────────────────────
// Regra: uma frase que reconhece, uma que diz o que fazer agora e um botão.

export type EstadoVazio = { titulo: string; texto: string; botao: string };

export const VAZIO_CUPONS: EstadoVazio = {
  titulo: "Você ainda não criou nenhum cupom.",
  texto: "Que tal começar por um de boas-vindas?",
  botao: "Criar cupom",
};

export const VAZIO_ATIVIDADES: EstadoVazio = {
  titulo: "Os agentes ainda não registraram nenhuma atividade.",
  texto: "Comece com uma pergunta a um agente, aqui embaixo.",
  botao: "Fazer uma pergunta",
};

/**
 * Lista de vendas vazia. `acao` diz o que o botão faz na tela:
 *   caixa   → abre o Caixa (nenhum filtro: ainda não há venda nenhuma);
 *   todas   → mostra o histórico inteiro (só o período filtra);
 *   limpar  → limpa busca, situação e período.
 */
export function vazioDeVendas(f: {
  periodo: string;
  /** "outubro de 2026", quando o período é o mês. */
  mes?: string;
  /** Há busca ou filtro de situação ligado. */
  filtrando: boolean;
}): EstadoVazio & { acao: "caixa" | "todas" | "limpar" } {
  if (f.filtrando) {
    return {
      titulo: "Não encontramos vendas com esses filtros.",
      texto: "Tente outro período ou limpe a busca.",
      botao: "Limpar filtros",
      acao: "limpar",
    };
  }
  if (f.periodo === "all") {
    return {
      titulo: "Ainda não há vendas por aqui.",
      texto: "As vendas feitas no Caixa aparecem aqui para você conferir.",
      botao: "Abrir o Caixa",
      acao: "caixa",
    };
  }
  const quando = f.periodo === "today" ? "hoje"
    : f.periodo === "week" ? "nesta semana"
    : f.periodo === "month" && f.mes ? "em " + f.mes
    : "neste período";
  return {
    titulo: "Ainda não há vendas " + quando + ".",
    texto: f.periodo === "month"
      ? "Use as setas do mês para olhar outro período, ou veja o histórico inteiro."
      : "Escolha outro período, ou veja o histórico inteiro.",
    botao: "Ver todas as vendas",
    acao: "todas",
  };
}

// ── Indicação: "Como funciona" no cartão Indique e ganhe (extra 2) ─────────
// Regras que valem hoje, conferidas no backend (scripts/indicacao-lib.js e
// docs/indicacao-concessao.md do Aura-backend, cartão t2-19): o mês grátis
// nasce do PRIMEIRO pagamento recebido do indicado; quem indicou e já paga
// ganha a próxima cobrança futura da assinatura; quem indicou e ainda está
// no teste tem 60 dias, contados desse pagamento, para assinar, e o mês
// grátis sai na segunda mensalidade (nunca na primeira); até 3 por ano e
// com a mensalidade de quem indicou em dia (sem atraso de mais de 3 dias).
export const COMO_FUNCIONA_INDICACAO = [
  "O mês grátis vale quando o lojista que você indicou paga a primeira mensalidade.",
  "Se você já assina a Aura, a sua próxima mensalidade a vencer sai por conta da Aura.",
  "Se você ainda está no teste, o mês grátis fica reservado por 60 dias a partir desse pagamento. Assinando nesse prazo, a sua segunda mensalidade sai por conta da Aura.",
  "Vale para até 3 indicações por ano, com a sua mensalidade em dia.",
] as const;

export const MENSAGENS_DO_APP = [
  MSG_SEM_CONEXAO,
  MSG_SEM_CONEXAO_NA_SESSAO,
  MSG_SESSAO_TERMINOU,
  MSG_ERRO_NOSSO,
  MSG_DEMOROU_DEMAIS,
  MSG_ERRO_SEM_EXPLICACAO,
  MSG_LOGIN_FALTA_DADO,
  MSG_CNPJ_INDISPONIVEL,
  MSG_PEDIDO_DE_AJUDA,
];
