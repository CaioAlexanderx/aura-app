// ============================================================
// Foco no cartão "Indique e ganhe" (14/10/2026, tq-11)
//
// O banner de indicação do sino manda a pessoa para /configuracoes, mas o
// cartão fica no fim da página e o clique caía no topo: ninguém achava.
// Agora o banner leva para /configuracoes?foco=indicacao e a tela rola até
// o cartão e o destaca (spotlight, CLAUDE.md armadilha 6).
//
// 18/10/2026 (card p-19): o foco virou mecanismo de qualquer seção
// (utils/focoNaSecao.ts). Aqui fica só o que é do banner de indicação.
//
// Funções puras, sem React nem expo-router, para testar sem montar tela.
// ============================================================

import {
  ROTA_CONFIGURACOES, PARAM_FOCO, SECOES_COM_FOCO, focoDoParametro, rotaDeConfiguracoesNaSecao,
} from "@/utils/focoNaSecao";

export { ROTA_CONFIGURACOES, PARAM_FOCO, focoDoParametro };
export const FOCO_INDICACAO = "indicacao";
export const ROTA_CONFIGURACOES_INDICACAO = rotaDeConfiguracoesNaSecao(FOCO_INDICACAO);

// Os banners de indicação ainda não têm um campo de tipo: nascem com o
// título "Indique um lojista e ganhe ...". Detecção por título é o critério
// combinado (sem mexer no banco); a constante é testada para não derivar.
export const TITULO_BANNER_INDICACAO = "Indique um lojista";

// Chave do alvo do spotlight (utils/tourTarget).
export const ALVO_INDICACAO = SECOES_COM_FOCO[FOCO_INDICACAO].alvo;

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function ehBannerDeIndicacao(titulo?: string | null): boolean {
  if (!titulo) return false;
  return semAcento(String(titulo)).toLowerCase().includes(semAcento(TITULO_BANNER_INDICACAO).toLowerCase());
}

// /configuracoes, /(tabs)/configuracoes e a mesma com barra final, sem query.
function ehConfiguracoesSemParametro(rota: string): boolean {
  const r = rota.trim();
  if (r.includes("?") || r.includes("#")) return false;
  const limpa = r.replace(/\/+$/, "");
  return limpa === ROTA_CONFIGURACOES || limpa === "/(tabs)" + ROTA_CONFIGURACOES;
}

// Rota que o CTA do banner deve abrir. Só reescreve o banner de indicação
// que aponta para Configurações sem parâmetro; todo o resto passa intacto.
export function rotaDoCtaDoBanner(banner: { cta_route?: string | null; title?: string | null }): string | null {
  const rota = banner.cta_route;
  if (!rota) return null;
  if (ehConfiguracoesSemParametro(rota) && ehBannerDeIndicacao(banner.title)) {
    return ROTA_CONFIGURACOES_INDICACAO;
  }
  return rota;
}

export function pedeFocoNaIndicacao(raw: unknown): boolean {
  return focoDoParametro(raw) === FOCO_INDICACAO;
}
