// ============================================================
// Vitrine Studio · o erro de carregar a loja, com a voz da loja
//
// Até 25/09/2026 a tela de erro era um "!" de 36 px e a mensagem crua da
// API ("Loja nao encontrada", "Failed to fetch", "Unexpected token <").
// Quem clicava num link do WhatsApp da lojista não sabia se o link estava
// errado, se a loja tinha fechado ou se era a própria internet — e não
// tinha o que fazer a não ser fechar a aba.
//
// Dois casos, porque pedem duas atitudes diferentes (Tela 4 do mockup
// docs/mockups/studio-vitrine-01-alicerce.html):
//   - "nao_achamos": o endereço não leva a uma loja publicada. Tentar de
//     novo não resolve; o que ajuda é conferir o link com quem mandou.
//   - "nao_carregou": rede ou servidor. A loja existe; tentar de novo
//     costuma resolver, então o botão refaz o carregamento.
//
// Função pura, com teste: a tela só desenha o que sai daqui.
// ============================================================

export type TipoDeErroDaLoja = "nao_achamos" | "nao_carregou";

/** O que sobrou de uma carga que falhou. `status` null = nem chegou resposta. */
export type ErroDeCarga = { status: number | null; mensagem?: string | null };

export type ErroDaLoja = {
  tipo: TipoDeErroDaLoja;
  titulo: string;
  texto: string;
  /** Rótulo do botão. */
  acao: string;
};

/** Para onde leva o "Ir para a Aura" quando a loja não existe. */
export const LINK_DA_AURA = "https://getaura.com.br";

/**
 * 4xx que NÃO querem dizer "essa loja não existe": tempo esgotado,
 * cedo demais e excesso de pedidos. Esses passam com uma nova tentativa.
 */
const QUATROCENTOS_PASSAGEIROS = new Set([408, 425, 429]);

export function classificarErroDaLoja(erro: ErroDeCarga | null | undefined): TipoDeErroDaLoja {
  const status = erro?.status;
  if (typeof status !== "number" || !Number.isFinite(status)) return "nao_carregou";
  // 404 é o caso real (slug errado ou loja despublicada: a rota filtra
  // is_published). 400/403/410 também dizem "este endereço não é uma
  // loja aberta" — insistir não muda a resposta.
  if (status >= 400 && status < 500 && !QUATROCENTOS_PASSAGEIROS.has(status)) return "nao_achamos";
  // 5xx, 408/429 e até um 200 com corpo quebrado (proxy devolvendo HTML):
  // a loja provavelmente existe e a próxima tentativa pode dar certo.
  return "nao_carregou";
}

export function erroDaLoja(erro: ErroDeCarga | null | undefined): ErroDaLoja {
  const tipo = classificarErroDaLoja(erro);
  if (tipo === "nao_achamos") {
    return {
      tipo,
      titulo: "Não achamos essa loja",
      texto: "Confira o link com quem te mandou, ou é possível que a loja ainda não esteja publicada.",
      acao: "Ir para a Aura",
    };
  }
  return {
    tipo,
    titulo: "A loja não carregou",
    texto: "Pode ter sido a conexão. Os produtos e preços continuam os mesmos.",
    acao: "Tentar de novo",
  };
}
