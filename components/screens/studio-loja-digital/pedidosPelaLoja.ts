// ============================================================
// components/screens/studio-loja-digital/pedidosPelaLoja.ts
//
// As regras da aba "Pedidos pela loja" do painel (Fase 1C, Tela 7 do
// mockup studio-vitrine-01-alicerce). Puras, com teste.
//
// ── O QUE A ABA GRAVA ──────────────────────────────────────────────────
// Seis colunas de digital_channel_config, pelo PUT da Loja Digital
// (Aura-backend, services/pedidosPelaLoja.js — BE-3):
//   pedidos_pausados        a lojista fechando na mão, agora
//   pedidos_ate             a data em que a loja fecha sozinha
//   pedidos_recado          o texto que a cliente lê (null = padrão)
//   courier_pickup_enabled  "Retirada por app" (Uber, 99) no checkout
//   ga4_measurement_id      Google Analytics
//   meta_pixel_id           Pixel da Meta
//
// ── A PRÉVIA ───────────────────────────────────────────────────────────
// A prévia não imita a vitrine: ela RODA a regra da vitrine
// (`faixaDaTemporada`, modoDaVitrine.ts) sobre o `store.pedidos` que o
// servidor montaria com o formulário (espelho de modoDaLoja.js). Se as
// duas divergirem, a lojista veria uma coisa e a cliente outra.
// ============================================================
import {
  faixaDaTemporada, dataCurta, diasAtePrazo, DIAS_PARA_AVISAR,
  type FaixaDaTemporada,
} from "@/components/studio/storefront/modoDaVitrine";
import { rastreadoresValidos } from "@/components/studio/storefront/rastreadoresDaVitrine";

/** Mesmo teto do servidor (RECADO_MAX): 280 cabe em duas linhas do celular. */
export const RECADO_MAX = 280;

/**
 * Os textos que a vitrine mostra quando a lojista não escreve recado.
 * ESPELHO de services/modoDaLoja.js (Aura-backend): o placeholder do campo
 * é o que a cliente vai ler de fato.
 */
export const RECADO_PADRAO = {
  pausado: "No momento a loja está fechada para pedidos novos. Você pode pedir um orçamento e a loja responde com prazo.",
  prazo: "Os pedidos desta temporada já fecharam. Você pode pedir um orçamento para a próxima leva.",
} as const;

export type FormPedidosPelaLoja = {
  /** O interruptor: `!pedidos_pausados`. */
  aceitando: boolean;
  recado: string;
  /** AAAA-MM-DD ou "" (sem data limite). */
  ate: string;
  retiradaPorApp: boolean;
  ga4: string;
  pixel: string;
};

function texto(v: any): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

/** O formulário a partir do GET da Loja Digital. Campo ausente = padrão. */
export function formDaConfig(config: any): FormPedidosPelaLoja {
  const c = config || {};
  const ate = /^\d{4}-\d{2}-\d{2}/.exec(texto(c.pedidos_ate));
  return {
    aceitando: c.pedidos_pausados !== true,
    recado: texto(c.pedidos_recado),
    ate: ate ? ate[0] : "",
    retiradaPorApp: c.courier_pickup_enabled === true,
    ga4: texto(c.ga4_measurement_id),
    pixel: texto(c.meta_pixel_id),
  };
}

/**
 * O corpo do PUT: só as seis colunas desta aba. O servidor grava só o que
 * vem (o resto da loja fica como está), e texto vazio vira null — é assim
 * que se tira a data, o recado ou um rastreador.
 */
export function corpoDoSalvar(f: FormPedidosPelaLoja) {
  const recado = f.recado.trim();
  return {
    pedidos_pausados: !f.aceitando,
    pedidos_ate: f.ate.trim() || null,
    pedidos_recado: recado || null,
    courier_pickup_enabled: f.retiradaPorApp,
    ga4_measurement_id: f.ga4.trim().toUpperCase() || null,
    meta_pixel_id: f.pixel.trim() || null,
  };
}

export function mesmoForm(a: FormPedidosPelaLoja, b: FormPedidosPelaLoja): boolean {
  return JSON.stringify(corpoDoSalvar(a)) === JSON.stringify(corpoDoSalvar(b));
}

export type Validacao = { estado: "vazio" | "ok" | "erro"; mensagem: string };

/**
 * GA4 ao digitar. A régua é `rastreadoresValidos` — a mesma que decide o
 * que a vitrine injeta e que o backend usa no PUT. Se o painel aceitasse
 * um formato que a vitrine descarta, a lojista veria "salvo" e o Google
 * nunca receberia visita.
 */
export function validarGa4(valor: string): Validacao {
  const v = valor.trim();
  if (!v) return { estado: "vazio", mensagem: "Opcional. Começa com G- (em Administrador > Fluxos de dados)." };
  if (rastreadoresValidos({ ga4: v }).ga4) return { estado: "ok", mensagem: "Formato válido" };
  return { estado: "erro", mensagem: "Formato: G- seguido de 6 a 14 letras ou números" };
}

export function validarPixel(valor: string): Validacao {
  const v = valor.trim();
  if (!v) return { estado: "vazio", mensagem: "Opcional. O número do Pixel no Gerenciador de Eventos." };
  if (rastreadoresValidos({ pixel: v }).pixel) return { estado: "ok", mensagem: "Formato válido" };
  if (/\D/.test(v)) return { estado: "erro", mensagem: "Só números — o Pixel da Meta tem 15 ou 16 dígitos" };
  if (v.length < 15) return { estado: "erro", mensagem: "Faltam dígitos — o Pixel da Meta tem 15 ou 16 números" };
  return { estado: "erro", mensagem: "Dígitos demais — o Pixel da Meta tem 15 ou 16 números" };
}

/** O que impede salvar, antes mesmo de ir ao servidor. `null` = pode. */
export function problemaDoForm(f: FormPedidosPelaLoja): string | null {
  if (f.recado.trim().length > RECADO_MAX) return `O recado pode ter até ${RECADO_MAX} caracteres.`;
  if (f.ate.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(f.ate.trim())) return "Data limite inválida. Use o formato AAAA-MM-DD.";
  if (validarGa4(f.ga4).estado === "erro") return "Confira o ID do Google Analytics.";
  if (validarPixel(f.pixel).estado === "erro") return "Confira o ID do Pixel da Meta.";
  return null;
}

/** "Hoje" em AAAA-MM-DD, no fuso do aparelho. */
function iso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * O `store.pedidos` que o servidor montaria com este formulário.
 * ESPELHO de modoDaLoja (Aura-backend, services/modoDaLoja.js).
 */
export function pedidosDoForm(f: FormPedidosPelaLoja, hoje: Date = new Date()) {
  const ate = f.ate.trim() || null;
  const recado = f.recado.trim() || null;
  if (!f.aceitando) {
    return { aceita: false, motivo: "pausado" as const, recado: recado || RECADO_PADRAO.pausado, pedidos_ate: ate };
  }
  if (ate && iso(hoje) > ate) {
    return { aceita: false, motivo: "prazo" as const, recado: recado || RECADO_PADRAO.prazo, pedidos_ate: ate };
  }
  return { aceita: true, motivo: null, recado: null, pedidos_ate: ate };
}

export type PreviaNaVitrine = {
  /** A loja aceita pedido agora, com o que está no formulário? */
  aberta: boolean;
  /** A faixa como a vitrine desenharia — ou null quando não há faixa. */
  faixa: FaixaDaTemporada | null;
  /** O botão principal do produto. */
  botao: string;
  /** Uma frase explicando QUANDO a cliente vê isso. */
  legenda: string;
};

/**
 * A prévia ao vivo. Com data limite ainda longe, a vitrine só mostra o
 * aviso nos últimos 21 dias (DIAS_PARA_AVISAR) — a prévia mostra COMO ele
 * vai aparecer e diz a partir de quando.
 */
export function previaNaVitrine(f: FormPedidosPelaLoja, hoje: Date = new Date()): PreviaNaVitrine {
  const pedidos = pedidosDoForm(f, hoje);
  if (!pedidos.aceita) {
    const faixa = faixaDaTemporada({ pedidos }, hoje);
    return {
      aberta: false,
      faixa,
      botao: "Pedir orçamento",
      legenda: pedidos.motivo === "prazo"
        ? "A data limite já passou: a loja está fechada para pedidos. Tire a data ou escolha outra para reabrir."
        : "A vitrine troca o botão de comprar por \"Pedir orçamento\" e mostra este recado em todas as telas.",
    };
  }

  const dias = diasAtePrazo(pedidos.pedidos_ate, hoje);
  if (dias == null) {
    return {
      aberta: true, faixa: null, botao: "Adicionar à sacola",
      legenda: "Loja aberta, sem data limite: a vitrine não mostra aviso.",
    };
  }

  // Ainda longe: simula o primeiro dia do aviso.
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + Math.max(0, dias - DIAS_PARA_AVISAR));
  const faixa = faixaDaTemporada({ pedidos }, inicio);
  const fim = dataCurta(pedidos.pedidos_ate, hoje);
  return {
    aberta: true,
    faixa,
    botao: "Adicionar à sacola",
    legenda: dias > DIAS_PARA_AVISAR
      ? `O aviso aparece na vitrine a partir de ${dataCurta(iso(inicio), hoje)}. Depois de ${fim}, a loja fecha para pedidos sozinha.`
      : `A vitrine já mostra este aviso. Depois de ${fim}, a loja fecha para pedidos sozinha.`,
  };
}
