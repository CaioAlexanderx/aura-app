// ============================================================
// components/studio/filtroDoHub.ts
//
// Busca do Hub de Pedidos (achado 3a do QA, 26/09/2026). O feed já vem
// carregado por inteiro (studioBulkHubApi.hubFeed, até 100 itens) — a
// API não tem parâmetro de busca, então o filtro é local, sobre o que já
// está na tela. Se um dia o feed virar paginado no servidor, troque esta
// função pelo parâmetro de busca da API; até lá, função pura pra ficar
// testável sem montar a tela inteira.
// ============================================================

function normalizar(v: string | null | undefined): string {
  return String(v || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function apenasDigitos(v: string | null | undefined): string {
  return String(v || "").replace(/\D/g, "");
}

export type ItemBuscavelDoHub = {
  id: string;
  name?: string | null;
  customer_phone?: string | null;
};

/**
 * Filtra o feed do Hub por nome, telefone (só dígitos) ou número do
 * pedido. Sem `order_number` no feed (a API não devolve — ver relatório
 * do PR), o "número" possível hoje é o id interno; funciona como atalho
 * pra quem colou o identificador de "Ver dados brutos" ou de outra tela.
 */
export function filtrarPedidosDoHub<T extends ItemBuscavelDoHub>(itens: T[], busca: string): T[] {
  const q = normalizar(busca);
  if (!q) return itens;
  const qDigitos = apenasDigitos(busca);
  return itens.filter((it) => {
    if (normalizar(it.name).includes(q)) return true;
    if (qDigitos && apenasDigitos(it.customer_phone).includes(qDigitos)) return true;
    if (normalizar(it.id).includes(q)) return true;
    return false;
  });
}

export default filtrarPedidosDoHub;
