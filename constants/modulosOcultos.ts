// ============================================================
// AURA. — módulos ocultos do menu
//
// Criado: 21/09/2026
//
// Lista curta de chaves `mod` que EXISTEM, têm plano em
// MODULE_PLAN_MAP e permissão em PERM_TO_MODULES, mas que ainda não
// devem aparecer na navegação porque a feature não está operante.
//
// Pedido do Caio (21/09): WhatsApp e Reativação saem da sidebar "por
// enquanto" — as duas telas existem e abrem, mas o fluxo não está
// pronto para o cliente final.
//
// POR QUE AQUI, e não apagando o item do NAV:
//
//   1. O NAV carrega o registro da decisão de 16/09 — o grupo
//      "Clientes e WhatsApp" subiu para a quarta posição EXATAMENTE
//      para essas duas telas deixarem de ser invisíveis (uma conta de
//      trial cancelou sem nunca abrir nenhuma das duas). Apagar os
//      itens apagaria esse histórico junto com o teste que o segura
//      (__tests__/moduloReativacaoNoMenu.test.ts).
//
//   2. Reativar é remover uma linha DESTE arquivo. Sem tocar em NAV,
//      em MODULE_PLAN_MAP, em PERM_TO_MODULES nem no layout salvo do
//      cliente.
//
//   3. O filtro é de APRESENTAÇÃO. Plano e permissão continuam
//      valendo por baixo, então quando a chave sair daqui a
//      visibilidade volta a ser exatamente a de antes — inclusive
//      para quem está no Essencial, que continua não vendo.
//
// O QUE ISTO NÃO FAZ: não desliga a rota. Quem tiver a URL salva
// continua abrindo a tela, e os botões que já apontam para ela de
// dentro de outras telas continuam funcionando. Se o objetivo passar
// a ser bloquear o acesso, o lugar é um gate na própria tela (ou
// tirar a chave de MODULE_PLAN_MAP), não este arquivo.
// ============================================================

export const MODULOS_OCULTOS: ReadonlySet<string> = new Set<string>([
  // Disparo e conversa pelo WhatsApp oficial.
  'whatsapp',
  // Reativação por WhatsApp (app/(tabs)/clientes/reativacao.tsx).
  'clientes.reativacao',
]);

// ============================================================
// PENDÊNCIA CONHECIDA — o rótulo do grupo.
//
// Com `whatsapp` oculto, o cabeçalho "Clientes e WhatsApp" anuncia
// uma tela que não está mais no grupo. Cosmético, e deixado como
// está de propósito: um rótulo derivado em buildRawNav valeria só
// para quem NÃO customizou a sidebar, porque applyLayoutToNav
// (hooks/useSidebarLayout.ts) reagrupa pelo NOME de seção gravado no
// layout salvo e ignoraria o rótulo novo. Meia correção, divergindo
// silenciosamente entre dois grupos de cliente, é pior que nenhuma.
//
// Se incomodar, o caminho honesto é renomear a seção no NAV e ajustar
// __tests__/moduloReativacaoNoMenu.test.ts — aceitando que quem já
// salvou layout continua vendo o nome antigo até reeditar.
// ============================================================

export function moduloEstaOculto(mod?: string): boolean {
  return typeof mod === 'string' && MODULOS_OCULTOS.has(mod);
}
