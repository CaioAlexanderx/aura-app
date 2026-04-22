// Modo demo removido do produto (commit d2e3c0e).
// Este arquivo era o banner visual do modo demo. Agora e um shim vazio:
// mantem o export para nao quebrar os ~15 imports diretos que ainda
// existem espalhados pelos tabs/components. O componente renderiza null,
// entao nunca aparece na UI.
//
// Limpeza cirurgica dos imports pode ser feita numa proxima sessao,
// arquivo por arquivo. Quando nenhum consumer restar, deletar este arquivo.

export function DemoBanner(): null {
  return null;
}

export default DemoBanner;
