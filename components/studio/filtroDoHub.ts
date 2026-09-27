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
  order_number?: string | number | null;
};

/**
 * Filtra o feed do Hub por nome, telefone (só dígitos) ou número do
 * pedido. O número é o `order_number` que a cliente vê ("Pedido 00001",
 * backend#760); aceita "42", "00042" e "pedido 42". Telefone e id interno
 * só entram com 4+ caracteres: com menos, "7" bateria em todo telefone com
 * um 7 e "42" em todo uuid com "42", e a busca pelo número viraria ruído.
 * O id continua valendo como atalho pra quem colou o identificador de
 * "Ver dados brutos" ou de outra tela (e cobre o feed enquanto o backend
 * não manda o número).
 */
const MIN_CHARS_TELEFONE_OU_ID = 4;

export function filtrarPedidosDoHub<T extends ItemBuscavelDoHub>(itens: T[], busca: string): T[] {
  const q = normalizar(busca);
  if (!q) return itens;
  const qDigitos = apenasDigitos(busca);
  // "pedido 42" / "#42" / "nº 42" → "42", pra bater sem exigir o prefixo.
  const qNumero = q.replace(/^(pedido|n[º°o]?\.?|#)\s*/, "").trim();
  return itens.filter((it) => {
    if (normalizar(it.name).includes(q)) return true;
    if (qNumero && normalizar(it.order_number == null ? "" : String(it.order_number)).includes(qNumero)) return true;
    if (qDigitos.length >= MIN_CHARS_TELEFONE_OU_ID && apenasDigitos(it.customer_phone).includes(qDigitos)) return true;
    if (q.length >= MIN_CHARS_TELEFONE_OU_ID && normalizar(it.id).includes(q)) return true;
    return false;
  });
}

export default filtrarPedidosDoHub;
