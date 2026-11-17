// ============================================================
// AURA. — Personalizados: o banner da loja no Meu Site › Design (p-193)
//
// Regras sem tela da seção "Banner de personalizados"
// (components/screens/canal/SecaoBannerPersonalizados.tsx). O banner é o A
// do mockup p-132 (decisão D9 do Caio): a foto da peça, o título, o texto,
// "Personalizar agora" e "Ver como fica em 3D", e a faixa de confiança. O
// backend desenha (backend#1055, services/bannerPersonalizados.js) e guarda
// em digital_channel_config.banner_personalizados pela rota própria
// GET/PUT /companies/:id/digital-channel/banner-personalizados.
//
// Quem vê a seção, quando TODAS valem:
//   1. a frente Personalizados está ligada na empresa: a trava geral
//      PERSONALIZADOS_LIBERADO, pdv_settings.studio_enabled e nenhuma
//      vertical_active (utils/personalizados.ts, a mesma conta do menu);
//   2. o módulo personalizados.loja está visível: plano Negócio em diante e,
//      para membro, a permissão personalizados.access. No Essencial a seção
//      some, sem cadeado nem convite;
//   3. é a loja comum (a aba Design da Loja Digital do Studio não mostra);
//   4. não é a visão consolidada: uma loja por CNPJ, então o consolidado
//      mostra só o aviso para escolher a loja (mutação só por CNPJ).
//
// Mod próprio: personalizados.loja, já em MODULE_PLAN_MAP, PERM_TO_MODULES
// (hooks/useVisibleModules.ts) e no backend (services/modules.js, #1038). É
// subseção do Meu Site, sem item de menu.
//
// A capa é a foto da peça (products.image_url). Nunca o mockup nem o render
// de um pedido: são a arte de uma cliente e não vão à vitrine pública sem o
// consentimento dela. `imagem_url` (a foto própria do banner) só faz a ida e
// volta: quando o backend ganhar o tipo de upload do banner, a seção liga o
// botão sem mudar o formato.
// ============================================================
import { personalizadosAtivo } from "@/utils/personalizados";

export const MOD_DO_BANNER = "personalizados.loja";

type ComStudioEnabled = { studio_enabled?: unknown } | null | undefined;

export type SituacaoDoBanner = "fora" | "escolha-a-loja" | "ligada";

/** Se a seção aparece nesta empresa, agora, e de que jeito. */
export function situacaoDoBanner(p: {
  settings: ComStudioEnabled;
  verticalActive: string | null | undefined;
  visiveis: ReadonlySet<string>;
  consolidado: boolean;
}): SituacaoDoBanner {
  if (!personalizadosAtivo(p.settings, p.verticalActive)) return "fora";
  if (!p.visiveis.has(MOD_DO_BANNER)) return "fora";
  if (p.consolidado) return "escolha-a-loja";
  return "ligada";
}

/** O objeto que a rota grava e devolve (sanearBanner do backend). */
export type BannerPersonalizados = {
  ativo: boolean;
  produto_id: string | null;
  imagem_url: string | null;
  kicker: string;
  titulo: string;
  texto: string;
  botao: string;
  botao_3d: string;
  mostrar_3d: boolean;
};

export type CampoDeTexto = "kicker" | "titulo" | "texto" | "botao" | "botao_3d";

export type PecaDoBanner = { id: string; name: string; image_url: string | null };

/** Os textos do modelo (PADRAO do backend). Valem até o GET chegar. */
export const PADRAO_DO_BANNER: Record<CampoDeTexto, string> = {
  kicker: "Feito sob encomenda",
  titulo: "Presentes com a sua cara",
  texto: "Escolha a peça, coloque o seu nome ou a sua arte e veja como fica antes de comprar. A gente mostra a arte para você aprovar antes de produzir.",
  botao: "Personalizar agora",
  botao_3d: "Ver como fica em 3D",
};

export const LIMITES_DO_BANNER: Record<CampoDeTexto, number> = {
  kicker: 40, titulo: 80, texto: 240, botao: 40, botao_3d: 40,
};

export const BANNER_VAZIO: BannerPersonalizados = {
  ativo: false, produto_id: null, imagem_url: null,
  kicker: "", titulo: "", texto: "", botao: "", botao_3d: "", mostrar_3d: true,
};

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** O que veio do GET (ou null: a loja nunca escolheu) no formato da tela. */
export function bannerDaResposta(raw: unknown): BannerPersonalizados {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...BANNER_VAZIO };
  const b = raw as Record<string, unknown>;
  return {
    ativo: b.ativo === true,
    produto_id: typeof b.produto_id === "string" && b.produto_id ? b.produto_id : null,
    imagem_url: typeof b.imagem_url === "string" && b.imagem_url ? b.imagem_url : null,
    kicker: str(b.kicker), titulo: str(b.titulo), texto: str(b.texto),
    botao: str(b.botao), botao_3d: str(b.botao_3d),
    mostrar_3d: b.mostrar_3d !== false,
  };
}

/** O corpo do PUT: textos aparados; vazio = o texto do modelo. */
export function corpoDoPut(b: BannerPersonalizados): BannerPersonalizados {
  return {
    ...b,
    kicker: b.kicker.trim(), titulo: b.titulo.trim(), texto: b.texto.trim(),
    botao: b.botao.trim(), botao_3d: b.botao_3d.trim(),
  };
}

/** O texto que a loja mostra: o da lojista ou, vazio, o do modelo. */
export function textoFinal(b: BannerPersonalizados, campo: CampoDeTexto, padrao: Record<CampoDeTexto, string> = PADRAO_DO_BANNER): string {
  return b[campo].trim() || padrao[campo];
}

/**
 * A peça que a loja vai mostrar: a escolhida, se ainda está na lista e tem
 * foto; senão a mais nova com foto (a lista vem do GET, da mais nova para a
 * mais antiga), como o backend faz.
 */
export function pecaDaCapa(b: BannerPersonalizados, pecas: PecaDoBanner[]): PecaDoBanner | null {
  const escolhida = b.produto_id ? pecas.find((x) => x.id === b.produto_id) : undefined;
  // Com a foto própria do banner, a peça não precisa de foto (comImagemPropria).
  if (b.imagem_url) return escolhida || pecas[0] || null;
  if (escolhida && escolhida.image_url) return escolhida;
  return pecas.find((x) => !!x.image_url) || null;
}

/** A foto do banner: a própria (quando houver upload) ou a da peça. */
export function capaDoBanner(b: BannerPersonalizados, pecas: PecaDoBanner[]): string | null {
  if (b.imagem_url) return b.imagem_url;
  const peca = pecaDaCapa(b, pecas);
  return (peca && peca.image_url) || null;
}

/** Preto ou branco sobre a cor da loja (o textoSobre do backend, WCAG). */
export function textoSobre(hex: string | null | undefined): "#000000" | "#ffffff" {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const canal = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const lum = 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
  // Contraste com branco = 1,05 / (lum + 0,05); com preto = (lum + 0,05) / 0,05.
  return (1.05 / (lum + 0.05)) >= ((lum + 0.05) / 0.05) ? "#ffffff" : "#000000";
}

export const TEXTOS_DO_BANNER = {
  titulo: "Banner de personalizados",
  explicacao: "No lugar do banner do topo, a loja mostra uma das suas peças personalizáveis com o botão para personalizar e, logo abaixo, a faixa de confiança.",
  ligar: "Usar o banner de personalizados",
  ligarDica: "Desligado, a loja mostra os banners do topo de sempre.",
  semPeca: "Você ainda não tem peça personalizável. Ligue a personalização de um produto no Estoque e o banner fica disponível aqui.",
  semFoto: "Nenhuma peça personalizável tem foto. Sem foto o banner não aparece na loja: coloque uma foto na peça pelo Estoque.",
  escolhaALoja: "Você está vendo todas as lojas juntas. Escolha uma loja para configurar o banner de personalizados dela.",
  automatico: "Automático",
  automaticoDica: "a mais nova com foto",
  vazioUsaModelo: "Campo vazio usa o texto do modelo.",
  mostrar3d: "Mostrar o botão “Ver como fica em 3D”",
  faixaDica: "Entrega e pagamento entram na faixa conforme o que a loja oferece.",
  salvar: "Salvar banner",
  salvo: "Banner salvo",
  erroAoCarregar: "Não deu para carregar o banner. Tente de novo.",
} as const;
