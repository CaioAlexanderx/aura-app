// ============================================================
// AURA. — Personalizados: a ficha de personalização no Estoque do Negócio (p-173)
//
// Regras sem tela de QUEM vê a entrada "Personalização" no cadastro do item
// (components/screens/estoque/item-form/SecaoPersonalizacao.tsx). O editor em
// si é o do Studio, sem cópia: StudioPersonalizacaoPanel, o editor canônico de
// customization_config (docs/studio/PERSONALIZACAO_CANONICA.md).
//
// A entrada só existe quando TODAS valem:
//   1. a frente Personalizados está ligada na empresa: a trava geral
//      PERSONALIZADOS_LIBERADO, pdv_settings.studio_enabled e nenhuma
//      vertical_active (utils/personalizados.ts, a mesma conta do menu);
//   2. o módulo personalizados.ficha está visível: plano Negócio em diante e,
//      para membro, a permissão personalizados.access. No Essencial a entrada
//      some, sem cadeado nem convite de upgrade;
//   3. não é a visão consolidada (multi-CNPJ): a ficha grava no produto de
//      UMA loja (regra da casa: mutação só por CNPJ);
//   4. o item é um PRODUTO que já existe (o editor carrega pelo id). Serviço
//      não é personalizável, e o cadastro novo ainda não tem id.
//
// Multi-CNPJ, item do grupo: a rota da ficha grava só no produto da própria
// empresa (products.company_id). Item compartilhado de outra loja do grupo
// mostra o aviso de que a personalização mora na loja dona dele.
//
// Mod próprio: personalizados.ficha, já em MODULE_PLAN_MAP, PERM_TO_MODULES
// (hooks/useVisibleModules.ts) e no backend (services/modules.js, #1038). É
// subtela do Estoque, sem item de menu, como a Galeria.
// ============================================================
import { personalizadosAtivo } from "@/utils/personalizados";

export const MOD_DA_FICHA = "personalizados.ficha";

type ComStudioEnabled = { studio_enabled?: unknown } | null | undefined;

/** A frente e o módulo deixam a entrada existir nesta empresa, agora. */
export function fichaNoEstoqueLigada(p: {
  settings: ComStudioEnabled;
  verticalActive: string | null | undefined;
  visiveis: ReadonlySet<string>;
  consolidado: boolean;
}): boolean {
  if (p.consolidado) return false;
  if (!personalizadosAtivo(p.settings, p.verticalActive)) return false;
  return p.visiveis.has(MOD_DA_FICHA);
}

export type SituacaoDoItem = "editar" | "do-grupo" | "fora";

/**
 * O que o cartão mostra para ESTE item:
 *   - "editar": o botão que abre o editor;
 *   - "do-grupo": item compartilhado que é de outra loja do grupo, só o aviso;
 *   - "fora": nada (serviço, ou cadastro novo ainda sem id).
 * `ownerCompanyId` ausente (backend antigo) não bloqueia: a rota devolve 404 e
 * o editor mostra o erro, como no Studio.
 */
export function situacaoDoItem(p: {
  produtoId: string | null | undefined;
  isProduto: boolean;
  companyId: string | null | undefined;
  ownerCompanyId?: string | null;
}): SituacaoDoItem {
  if (!p.isProduto || !p.produtoId || !p.companyId) return "fora";
  if (p.ownerCompanyId && String(p.ownerCompanyId) !== String(p.companyId)) return "do-grupo";
  return "editar";
}

export const TEXTOS_DA_FICHA = {
  titulo: "Personalização",
  explicacao: "O cliente envia texto e arte na loja e na venda do Caixa. Ligue aqui e diga o que ele escolhe.",
  botao: "Abrir a personalização",
  doGrupo: "Este item é de outra loja do grupo. A personalização se faz na loja dona do item.",
  voltar: "Voltar ao item",
} as const;
