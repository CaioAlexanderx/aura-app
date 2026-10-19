// ============================================================
// Foco numa seção de Configurações (18/10/2026, card p-19)
//
// /configuracoes?foco=<chave> abre Configurações já rolada até a seção
// marcada com a chave, com um destaque breve (spotlight + dica ancorada,
// CLAUDE.md armadilha 6). Nasceu só para o cartão "Indique e ganhe"
// (tq-11, app#1070); agora qualquer tela pode mandar a pessoa para uma
// seção: registre a chave aqui, marque a seção com
// {...tourTarget(alvoDaSecao(chave))} e leve para rotaDeConfiguracoesNaSecao(chave).
//
// Funções puras, sem React nem expo-router, para testar sem montar tela.
// ============================================================

export const ROTA_CONFIGURACOES = "/configuracoes";
export const PARAM_FOCO = "foco";

export type SecaoComFoco = {
  chave: string;
  // Marcador data-tour da seção (utils/tourTarget).
  alvo: string;
  // Dica que aparece ancorada na seção.
  titulo: string;
  texto: string;
};

// Uma entrada por seção que aceita foco. A chave vai na URL: minúsculas,
// sem acento nem espaço.
export const SECOES_COM_FOCO: Record<string, SecaoComFoco> = {
  indicacao: {
    chave: "indicacao",
    alvo: "configuracoes.indicacao",
    titulo: "Seu código de indicação fica aqui",
    texto: "Copie o código ou mande pelo WhatsApp para um lojista que você conhece.",
  },
  // 18/10/2026 (card p-36): "Desenho: ... · mudar" na aba Etiquetas do Estoque.
  "desenho-etiqueta": {
    chave: "desenho-etiqueta",
    alvo: "configuracoes.desenho-etiqueta",
    titulo: "Desenho da etiqueta",
    texto: "Toque em Clássico ou Editorial. Vale para as próximas impressões.",
  },
};

export function secaoRegistrada(chave: string): SecaoComFoco | null {
  return Object.prototype.hasOwnProperty.call(SECOES_COM_FOCO, chave) ? SECOES_COM_FOCO[chave] : null;
}

// Marcador para a seção usar com tourTarget. Chave fora do registro é erro
// de programação: falha alto em vez de marcar um alvo que ninguém procura.
export function alvoDaSecao(chave: string): string {
  const s = secaoRegistrada(chave);
  if (!s) throw new Error("Seção sem registro em SECOES_COM_FOCO: " + chave);
  return s.alvo;
}

export function rotaDeConfiguracoesNaSecao(chave: string): string {
  return ROTA_CONFIGURACOES + "?" + PARAM_FOCO + "=" + encodeURIComponent(chave);
}

// expo-router entrega o parâmetro como string, array ou undefined
// (e, por armadilha conhecida do setParams, a string "undefined").
export function focoDoParametro(raw: unknown): string | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v !== "string") return null;
  const t = v.trim().toLowerCase();
  if (!t || t === "undefined" || t === "null") return null;
  return t;
}

// Seção pedida pelo parâmetro, ou null (sem parâmetro, lixo ou chave que
// não existe). Devolve sempre o mesmo objeto do registro, então serve de
// dependência estável num useEffect.
export function secaoDoFoco(raw: unknown): SecaoComFoco | null {
  const chave = focoDoParametro(raw);
  return chave ? secaoRegistrada(chave) : null;
}
