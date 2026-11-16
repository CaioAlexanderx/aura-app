// ============================================================
// AURA. — módulos ocultos do menu
//
// Criado: 21/09/2026
//
// Lista curta de chaves `mod` que EXISTEM, têm plano em
// MODULE_PLAN_MAP e permissão em PERM_TO_MODULES, mas que ainda não
// devem aparecer na navegação porque a feature não está operante.
//
// HISTÓRICO
//   21/09/2026  WhatsApp ('whatsapp') e Reativação ('clientes.reativacao')
//               saíram da sidebar "por enquanto": o fluxo pela API paga da
//               Meta não estava pronto para o cliente final.
//   14/10/2026  As duas VOLTARAM (decisão do Caio, 13/10; card t3-06). A
//               Reativação ganhou o caminho sem a Meta — "Chamar" abre o
//               WhatsApp da própria loja com a mensagem pronta (wa.me) — e
//               por isso vale também para o Essencial. A lista ficou vazia
//               de propósito: o mecanismo (e o filtro em buildRawNav) continua
//               aqui para a próxima feature que precise ficar fora do menu
//               sem apagar o item do NAV.
//   16/11/2026  Entram os quatro itens da seção Personalizados (p-128): o
//               menu foi declarado antes das telas. Ver a lista abaixo.
//   16/11/2026  A Produção sai da lista (p-129): a tela nasceu.
//
// POR QUE ESTE MECANISMO, e não apagando o item do NAV:
//
//   1. O NAV carrega o registro da decisão de 16/09 — o grupo
//      "Clientes e WhatsApp" subiu para a quarta posição para essas telas
//      deixarem de ser invisíveis. Apagar os itens apagaria esse histórico
//      junto com o teste que o segura
//      (__tests__/moduloReativacaoNoMenu.test.ts).
//
//   2. Esconder é adicionar uma linha DESTE arquivo; mostrar de novo é
//      removê-la. Sem tocar em NAV, em MODULE_PLAN_MAP, em PERM_TO_MODULES
//      nem no layout salvo do cliente.
//
//   3. O filtro é de APRESENTAÇÃO. Plano e permissão continuam valendo por
//      baixo.
//
// O QUE ISTO NÃO FAZ: não desliga a rota. Quem tiver a URL salva continua
// abrindo a tela. Se o objetivo for bloquear o acesso, o lugar é um gate
// na própria tela (ou tirar a chave de MODULE_PLAN_MAP), não este arquivo.
// ============================================================

export const MODULOS_OCULTOS: ReadonlySet<string> = new Set<string>([
  // 16/11/2026 (p-128) — Personalizados no shell Negócio. Os quatro itens já
  // estão declarados no NAV, com plano e permissão, mas a tela de cada um
  // ainda não nasceu em app/(tabs)/personalizados. Item sem tela não vai ao
  // menu: cada linha sai daqui no PR que criar a tela dela. A Produção saiu
  // no p-129 (app/(tabs)/personalizados/producao.tsx).
  'personalizados.orcamentos',
  'personalizados.insumos',
  'personalizados.galeria',
]);

// ============================================================
// PENDÊNCIA CONHECIDA — o rótulo do grupo.
//
// O grupo "Clientes e WhatsApp" volta a ter as quatro telas no Negócio. No
// Essencial ele mostra Clientes e Reativação (o WhatsApp oficial é da
// Meta/Negócio e some, sem botão desabilitado: premissa de 16/09), então o
// cabeçalho continua verdadeiro nos dois casos.
// ============================================================

export function moduloEstaOculto(mod?: string): boolean {
  return typeof mod === 'string' && MODULOS_OCULTOS.has(mod);
}
