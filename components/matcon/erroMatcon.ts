// ============================================================
// AURA. — Matcon: o que o lojista lê quando a chamada falha (QA 23/09/2026).
//
// Em 23/09 as rotas /matcon/* ainda respondiam 404 em produção e as telas
// (a) giravam ~10 s (3 tentativas do react-query por cima da tentativa
// extra do client), (b) ficavam presas em "Carregando…" e (c) tratavam o
// erro como lista vazia ("Nada faltando hoje" com 23 alertas de estoque
// baixo). Regras que este arquivo fixa para as telas do Matcon:
//
//   1. `RETRY_DA_TELA = false`: a única tentativa automática é a que o
//      client já faz (`retry: 1` em services/matconApi.ts, só para falha de
//      rede). 404/403/400 não mudam tentando de novo.
//   2. Erro nunca vira lista vazia: a tela mostra <EsteiraErro> (título em
//      português simples + "Tentar de novo").
//   3. Toast de ação que falhou passa por `textoDoErro` (mesma regra do
//      Caixa, components/screens/pdv/erroNoCaixa.ts): "Rota nao
//      encontrada", "Failed to fetch" e afins viram o texto neutro da tela;
//      a frase que o backend escreveu para o lojista passa como veio.
// ============================================================
import { textoDoErro, ehRotaAusente } from "@/components/screens/pdv/erroNoCaixa";

export { textoDoErro, ehRotaAusente };

/** react-query das telas do Matcon: sem tentativas por cima do client. */
export const RETRY_DA_TELA = false as const;

function ehFalhaDeConexao(err: any): boolean {
  if (!err) return false;
  return !!err.isNetworkError || err.code === "network" || err.code === "timeout";
}

/**
 * Segunda frase do bloco de erro de carga — diz ao lojista o que fazer.
 * Sem internet: conferir a conexão. Qualquer outra coisa (a rota ainda não
 * existe, erro nosso): a culpa não é dele, então não mandamos conferir a
 * internet.
 */
export function fraseDoErroDeCarga(err: any): string {
  if (ehFalhaDeConexao(err)) {
    return "Confira se a internet está funcionando e toque em Tentar de novo.";
  }
  return "A falha foi do nosso lado, não sua. Toque em Tentar de novo; se continuar, fale com o suporte da Aura.";
}
