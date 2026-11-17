// ============================================================
// AURA. — Personalizados: insumos e ficha técnica no shell Negócio (p-178)
//
// Regras sem tela de QUEM vê os insumos e a ficha técnica (composição) da
// frente Personalizados no Negócio. As telas são as do Studio, sem cópia:
//   - a lista: components/studio/TelaDeInsumos.tsx (a mesma do /studio), na
//     rota app/(tabs)/personalizados/insumos.tsx;
//   - a ficha técnica de um produto: StudioFichaTecnicaPanel, o editor
//     canônico da composição, aberto por cima (ComposicaoEmTelaCheia) a
//     partir da aba Fichas Técnicas ou do cadastro do item no Estoque.
//
// Valem juntas:
//   1. a frente está ligada: trava PERSONALIZADOS_LIBERADO,
//      pdv_settings.studio_enabled e nenhuma vertical_active
//      (utils/personalizados.ts, a mesma conta do menu);
//   2. o módulo personalizados.insumos está visível: plano Negócio em diante
//      e, para membro, a permissão personalizados.access. No Essencial tudo
//      some, sem cadeado nem convite de upgrade;
//   3. não é a visão consolidada: insumo e ficha são de UMA loja (regra da
//      casa: mutação só por CNPJ). A rota mostra "Escolha uma loja"; o
//      cadastro do item esconde a seção.
//
// Mod próprio: personalizados.insumos, já em NAV, MODULE_PLAN_MAP,
// PERM_TO_MODULES (app) e em src/services/modules.js (backend#1038, no ar).
// A ficha técnica no cadastro do item é parte da mesma tela de Insumos (no
// Studio, a aba "Fichas Técnicas" mora dentro de Insumos), por isso usa a
// mesma chave. A Personalização (p-173) segue com personalizados.ficha.
// ============================================================
import { personalizadosAtivo } from "@/utils/personalizados";

export const MOD_DOS_INSUMOS = "personalizados.insumos";

type ComStudioEnabled = { studio_enabled?: unknown } | null | undefined;

/** A frente e o módulo deixam os insumos existirem nesta empresa, agora. */
export function insumosNoNegocioLigados(p: {
  settings: ComStudioEnabled;
  verticalActive: string | null | undefined;
  visiveis: ReadonlySet<string>;
  consolidado: boolean;
}): boolean {
  if (p.consolidado) return false;
  if (!personalizadosAtivo(p.settings, p.verticalActive)) return false;
  return p.visiveis.has(MOD_DOS_INSUMOS);
}

/**
 * Os textos da TelaDeInsumos que, no /studio, citam o Catálogo. No Negócio
 * o produto mora no Estoque, e a ficha abre na própria tela.
 */
export const TEXTOS_DOS_INSUMOS_NO_NEGOCIO = {
  titulo: "Estoque de insumos",
  dicaDasFichas: "Toque numa ficha para editar a composição. A ficha de um produto novo se cria no cadastro dele, no Estoque.",
  semFichas: "Crie a ficha técnica pelo Estoque: abra o produto e use a seção Ficha técnica.",
  irParaOCatalogo: "Ir para o Estoque",
  rotuloDaFicha: "Editar a ficha técnica de {produto}",
} as const;

/** A seção do cadastro do item (components/screens/estoque/item-form/SecaoComposicao.tsx). */
export const TEXTOS_DA_COMPOSICAO = {
  titulo: "Ficha técnica",
  explicacao: "Os insumos que cada unidade consome, com o custo e a margem. Na venda de um produto personalizável, o Caixa dá baixa neles.",
  botao: "Abrir a ficha técnica",
  doGrupo: "Este item é de outra loja do grupo. A ficha técnica se faz na loja dona do item.",
  voltar: "Voltar",
} as const;
