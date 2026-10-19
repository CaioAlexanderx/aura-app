// ============================================================
// AURA. — Para onde o Continuar do check-in leva (19/10/2026, card tq-31)
//
// Antes o Continuar sempre voltava ao Painel, mesmo com o "Vamos abrir com…"
// prometendo outra coisa. Tabela aprovada pelo Caio no mockup "O primeiro
// minuto de quem acabou de criar a conta"
// (claude.ai/artifact/WjWnEitYY49kPCapdY4hcV):
//
//   comeco = caixa        → cadastro do primeiro produto e, ao salvar, o
//                           Caixa; loja que já tem produto vai direto ao Caixa
//   comeco = estoque      → depende do tamanho e de onde anota:
//     mais de 300 (de_301_a_1000, mais_de_1000) ou outro_sistema
//                         → importação assistida (wa.me da Aura) + cadastro
//     planilha com até 300 → convite "Importar sua planilha" no Estoque
//     51 a 300 (de_51_a_300), caderno ou nao_anoto
//                         → destinoDoEstoqueMedio(): a tela "Como você quer
//                           trazer seus produtos?" (tq-34, /trazer-produtos)
//     até 50 e o resto    → cadastro "um por um" (modal Novo item do Estoque)
//   (caminhoDoEstoque decide; o texto do "Vamos abrir com" usa a mesma regra)
//   comeco = fiado        → Novo lançamento do crediário (plano libera)
//   comeco = nota_fiscal  → aba Certificado A1 das Notas fiscais
//   comeco = loja_online  → Canal Digital (plano libera)
//   comeco = sumidos      → Reativação ("Chamar quem sumiu" no Essencial)
//   comeco = outra, Pular → Painel
//
// Sem "comeco", mas com as outras duas respostas: a regra do estoque, a
// mesma que o "Vamos abrir com" já mostra (abrirCom cai no estoque).
//
// Tela que o plano (ou a permissão) não libera nunca é destino: cai no
// Painel. Quem chama passa os módulos visíveis JÁ revalidados (/auth/me).
// Função pura: sem React, sem rede. A nota fiscal nunca barra a primeira
// venda: o destino dela é a aba do certificado, e o Caixa segue aberto.
// ============================================================
import type { CheckinRespostas } from "@/services/checkinApi";
import { waAura } from "@/constants/suporteAura";
import { MOD_TRAZER_PRODUTOS, ROTA_TRAZER_PRODUTOS } from "@/constants/trazerProdutos";

export const ROTA_PAINEL = "/(tabs)";
export const ROTA_CAIXA = "/pdv";
/** Abre o modal "Novo item" do Estoque (app/(tabs)/estoque.tsx lê `novo`). */
export const ROTA_NOVO_PRODUTO = "/estoque?novo=produto";
/** O mesmo, e ao fechar depois de salvar segue para o Caixa (`depois=pdv`). */
export const ROTA_NOVO_PRODUTO_E_CAIXA = "/estoque?novo=produto&depois=pdv";
/** Abre o "Novo lançamento" do Crediário (app/(tabs)/crediario.tsx lê `novo`). */
export const ROTA_NOVO_FIADO = "/crediario?novo=1";
/** Abre a aba "Certificado A1" das Notas fiscais (app/(tabs)/nfe.tsx lê `tab`). */
export const ROTA_CERTIFICADO = "/nfe?tab=certificado";
export const ROTA_CANAL = "/canal";
export const ROTA_REATIVACAO = "/clientes/reativacao";

export type DestinoCheckin = {
  /** Rota do app que abre depois do Continuar. */
  rota: string;
  /** wa.me da Aura aberto no mesmo toque (importação assistida). */
  whatsapp?: string;
  /** Rótulo curto, para teste e para o corpo do PR. */
  motivo: string;
};

export type ContextoDoDestino = {
  /** Módulos visíveis (computeVisibleModules), já com o plano revalidado. */
  modulos: ReadonlySet<string>;
  /** A loja já tem pelo menos um produto? null = não deu para saber. */
  temProduto: boolean | null;
  /** Nome da loja, para a mensagem pronta do WhatsApp. */
  loja?: string | null;
};

const PAINEL: DestinoCheckin = { rota: ROTA_PAINEL, motivo: "painel" };

/**
 * "Fazer a primeira venda": cadastro do primeiro produto e, ao salvar, o
 * Caixa; com produto, direto ao Caixa. Também é o botão principal do Painel
 * de conta nova (tq-32). Sem saber se tem produto (rede falhou), vai ao
 * cadastro: o "depois=pdv" leva ao Caixa do mesmo jeito.
 */
export function destinoDaPrimeiraVenda(ctx: ContextoDoDestino): DestinoCheckin {
  if (!ctx.modulos.has("pdv")) return PAINEL;
  if (ctx.temProduto === true || !ctx.modulos.has("estoque")) return { rota: ROTA_CAIXA, motivo: "caixa" };
  return { rota: ROTA_NOVO_PRODUTO_E_CAIXA, motivo: "primeiro_produto_e_caixa" };
}

/**
 * 51 a 300 produtos, "Caderno" ou "Ainda não anoto": a tela "Como você quer
 * trazer seus produtos?" (Um por um · Quero ajuda · Planilha), card tq-34.
 * O "Vamos abrir com" mostra TEXTO_ESTOQUE_MEDIO_TQ34 (utils/checkinRegras.ts):
 * "Trazer seus produtos do seu jeito" / "Um por um, por planilha ou com a
 * nossa ajuda.". Com a chave da tela escondida (override ou permissão), o
 * "um por um" de antes.
 */
export function destinoDoEstoqueMedio(ctx: ContextoDoDestino): DestinoCheckin {
  if (!ctx.modulos.has(MOD_TRAZER_PRODUTOS)) return { rota: ROTA_NOVO_PRODUTO, motivo: "cadastro_um_por_um" };
  return { rota: ROTA_TRAZER_PRODUTOS, motivo: "trazer_produtos" };
}

/** Texto pronto da importação assistida. Sem nome da loja, "minha loja". */
export function mensagemImportacaoAssistida(
  loja: string | null | undefined,
  respostas: CheckinRespostas,
): string {
  const nome = String(loja || "").trim() || "minha loja";
  const partes: string[] = [];
  if (respostas.produtos_faixa === "de_301_a_1000") partes.push("tenho de 301 a 1.000 produtos");
  else if (respostas.produtos_faixa === "mais_de_1000") partes.push("tenho mais de 1.000 produtos");
  if (respostas.onde_anota === "outro_sistema") partes.push("hoje uso outro sistema");
  const detalhe = partes.length ? " (" + partes.join(" e ") + ")" : "";
  return "Oi! Acabei de criar a conta da " + nome + " na Aura e quero ajuda para trazer meus produtos" + detalhe + ".";
}

/**
 * Caminho do estoque, decidido UMA vez e usado pelo destino e pelo texto do
 * "Vamos abrir com" (abrirCom), para os dois nunca divergirem.
 *   assistida  mais de 300 produtos ou "Outro sistema" (o maior vence:
 *              "Caderno" com mais de 1.000 é assistida)
 *   planilha   "Planilha" com até 300 produtos (ou sem faixa)
 *   medio      "Caderno", "Ainda não anoto" ou 51 a 300 (tela do tq-34)
 *   um_por_um  o resto (até 50, ou só "Organizar meu estoque")
 */
export type CaminhoDoEstoque = "assistida" | "planilha" | "medio" | "um_por_um";

export function caminhoDoEstoque(respostas: CheckinRespostas): CaminhoDoEstoque {
  const faixa = respostas.produtos_faixa || "";
  const anota = respostas.onde_anota || "";
  if (faixa === "de_301_a_1000" || faixa === "mais_de_1000" || anota === "outro_sistema") return "assistida";
  if (anota === "planilha") return "planilha";
  if (faixa === "de_51_a_300" || anota === "caderno" || anota === "nao_anoto") return "medio";
  return "um_por_um";
}

/** Abre o Estoque com o convite "Importar sua planilha" (lê `importar`). */
export const ROTA_IMPORTAR_PLANILHA = "/estoque?importar=planilha";

/** Texto do convite no Estoque: o mesmo do "Vamos abrir com". */
export const TEXTO_CONVITE_PLANILHA = {
  titulo: "Importar sua planilha",
  sub: "Você confere tudo antes de gravar.",
} as const;

function destinoDoEstoque(respostas: CheckinRespostas, ctx: ContextoDoDestino): DestinoCheckin {
  if (!ctx.modulos.has("estoque")) return PAINEL;
  switch (caminhoDoEstoque(respostas)) {
    case "assistida":
      return {
        // Enquanto a Aura importa, a loja já começa pelo primeiro produto.
        rota: ROTA_NOVO_PRODUTO,
        whatsapp: waAura(mensagemImportacaoAssistida(ctx.loja, respostas)),
        motivo: "importacao_assistida",
      };
    case "planilha":
      return { rota: ROTA_IMPORTAR_PLANILHA, motivo: "importar_planilha" };
    case "medio":
      return destinoDoEstoqueMedio(ctx);
    default:
      return { rota: ROTA_NOVO_PRODUTO, motivo: "cadastro_um_por_um" };
  }
}

/** Destino do Continuar. Nada respondido (ou Pular) = Painel. */
export function destinoDoCheckin(respostas: CheckinRespostas, ctx: ContextoDoDestino): DestinoCheckin {
  const comeco = respostas.comeco || "";
  switch (comeco) {
    case "caixa":
      return destinoDaPrimeiraVenda(ctx);
    case "estoque":
      return destinoDoEstoque(respostas, ctx);
    case "fiado":
      return ctx.modulos.has("crediario") ? { rota: ROTA_NOVO_FIADO, motivo: "novo_fiado" } : PAINEL;
    case "nota_fiscal":
      return ctx.modulos.has("nfe") ? { rota: ROTA_CERTIFICADO, motivo: "certificado_a1" } : PAINEL;
    case "loja_online":
      return ctx.modulos.has("canal") ? { rota: ROTA_CANAL, motivo: "canal_digital" } : PAINEL;
    case "sumidos":
      return ctx.modulos.has("clientes.reativacao") ? { rota: ROTA_REATIVACAO, motivo: "reativacao" } : PAINEL;
    case "outra":
      return PAINEL;
    default:
      break;
  }
  // Valor desconhecido em "comeco" (versão nova do backend): Painel.
  if (comeco) return PAINEL;
  if (respostas.onde_anota || respostas.produtos_faixa) return destinoDoEstoque(respostas, ctx);
  return PAINEL;
}

/** Leitura defensiva de GET /companies/:id/products?limit=1 → { total }. */
export function temProdutoNaResposta(raw: unknown): boolean | null {
  if (Array.isArray(raw)) return raw.length > 0;
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.total === "number" && Number.isFinite(r.total)) return r.total > 0;
  const lista = Array.isArray(r.products) ? r.products : Array.isArray(r.rows) ? r.rows : null;
  return lista ? lista.length > 0 : null;
}

// ── Leitura dos parâmetros nas telas de destino ─────────────
// Valor exato, nada de "truthy": o expo-router 4 transforma
// setParams({ x: undefined }) na string "undefined".

function primeiro(v: string | string[] | null | undefined): string {
  return Array.isArray(v) ? String(v[0] ?? "") : String(v ?? "");
}

/** Estoque: ?novo=produto abre o modal "Novo item" (produto). */
export function querNovoProduto(v: string | string[] | null | undefined): boolean {
  return primeiro(v) === "produto";
}

/** Estoque: ?depois=pdv segue para o Caixa ao fechar depois de salvar. */
export function depoisVaiAoCaixa(v: string | string[] | null | undefined): boolean {
  return primeiro(v) === "pdv";
}

/** Crediário: ?novo=1 abre o "Novo lançamento". */
export function querNovoFiado(v: string | string[] | null | undefined): boolean {
  return primeiro(v) === "1";
}

/** Estoque: ?importar=planilha mostra o convite "Importar sua planilha". */
export function querImportarPlanilha(v: string | string[] | null | undefined): boolean {
  return primeiro(v) === "planilha";
}

/** Notas fiscais: ?tab=certificado abre a aba "Certificado A1". */
export function querAbaCertificado(v: string | string[] | null | undefined): boolean {
  return primeiro(v) === "certificado";
}
