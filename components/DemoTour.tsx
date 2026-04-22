// Modo demo removido do produto (commit d2e3c0e).
// Este arquivo era o tour guiado do modo demo. Agora e um shim vazio:
// mantem o export para nao quebrar imports diretos que ainda existem.
// Aceita a prop `visible` que alguns consumers passam, mas ignora e
// sempre renderiza null.
//
// Quando nenhum consumer restar, deletar este arquivo.

export function DemoTour(_props?: { visible?: boolean }): null {
  return null;
}

export default DemoTour;
