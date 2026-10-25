// Tom das mensagens que a lojista mais encontra (levantamento de 24/10/2026):
// reconhecer a situação, dizer o que fazer agora e, quando cabe, oferecer a
// conversa com a gente. Sem jargão ("servidor", "HTTP", "sessão") e sem
// gênero. Um lugar só para os textos, para o tom não se espalhar de novo.
//
// O número do WhatsApp da Aura não aparece aqui: onde o aviso é um toast sem
// botão, o texto só cita "pelo WhatsApp"; onde houver ação, a tela usa
// waAura() de "@/constants/suporteAura".

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

export const MENSAGENS_DO_APP = [
  MSG_SEM_CONEXAO,
  MSG_SEM_CONEXAO_NA_SESSAO,
  MSG_SESSAO_TERMINOU,
  MSG_ERRO_NOSSO,
  MSG_DEMOROU_DEMAIS,
  MSG_ERRO_SEM_EXPLICACAO,
  MSG_LOGIN_FALTA_DADO,
  MSG_CNPJ_INDISPONIVEL,
];
