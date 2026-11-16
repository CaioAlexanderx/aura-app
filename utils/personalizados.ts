// ============================================================
// AURA. — Personalizados: a frente Studio dentro do shell Negócio (p-128)
//
// Decisão do Caio (16/11/2026): Personalizados vira frente do Negócio e
// deixam de nascer empresas no /studio. Nesta primeira fase a seção só
// existe para a empresa que:
//
//   1. tem pdv_settings.studio_enabled === true (o mesmo interruptor que o
//      backend lê em ehLojaStudio), E
//   2. NÃO tem vertical_active. Quem tem vertical_active = 'studio' continua
//      no shell /studio (app/_layout.tsx manda para lá) e não vê nada disto;
//      outra vertical (food, odonto, karatê) tem shell próprio.
//
// Função pura, sem hook: o menu (app/(tabs)/_layout.tsx), a linha de
// permissão (components/MembersSection.tsx) e as telas de
// app/(tabs)/personalizados leem a MESMA conta.
//
// Multi-CNPJ: no consolidado ("Todas as empresas") não existe uma loja só
// para ler o interruptor. As telas da frente mostram "escolha uma loja"
// (regra da casa: mutação só por CNPJ).
// ============================================================

type ComStudioEnabled = { studio_enabled?: unknown } | null | undefined;

// 16/11/2026 (Caio): nada de Personalizados aparece na tela de ninguém até a
// migração completa do Studio para o shell Negócio. Antes de ligar, o Caio
// fala com as clientes. Enquanto isto for false, a seção do menu, a linha de
// permissão em Membros e a tela /personalizados/producao não existem para
// nenhuma empresa, com ou sem studio_enabled. Ligar é trocar para true num
// PR próprio, com o OK do Caio.
export const PERSONALIZADOS_LIBERADO = false;

export function personalizadosAtivo(
  settings: ComStudioEnabled,
  verticalActive: string | null | undefined,
  liberado: boolean = PERSONALIZADOS_LIBERADO,
): boolean {
  if (!liberado) return false;
  if (!settings || settings.studio_enabled !== true) return false;
  return verticalActive == null || verticalActive === "";
}

/** As chaves de módulo da frente: primeiro os itens do menu, depois as subtelas. */
export const MODS_PERSONALIZADOS = [
  "personalizados.orcamentos",
  "personalizados.producao",
  "personalizados.insumos",
  "personalizados.galeria",
  "personalizados.pedido",
  "personalizados.ficha",
  "personalizados.loja",
  "personalizados.config",
] as const;
