// ============================================================
// AURA. — Vendas recentes por produto (QA De/Por, 08/11/2026)
//
// Para a opção "Parados há 60 dias ou mais" do passo 1 da Promoção em lote.
// NENHUMA rota nova: junta duas leituras que o backend já tem.
//
//  1. GET /companies/:id/products/ranking?period=custom&start_date&end_date
//     (src/services/productsRanking.js). Uma linha por produto com venda no
//     período, variantes somadas no produto (GROUP BY si.product_id), hoje
//     incluído, em Brasília. Só vendas desta loja (s.company_id = :id),
//     sem cancelada e sem troca. Paginado: até 1.000 por chamada.
//  2. GET /companies/:id/estoque/ruptura?janela=60 (src/services/ruptura.js,
//     "O que vai faltar"). Por produto/variante, com `ultima_venda`. Cobre o
//     que o ranking não vê: venda do produto compartilhado do grupo em outra
//     loja e a troca. A janela dela vai até ontem, por isso não serve sozinha.
//
// Venda em qualquer uma tira o produto dos parados (regrasDePor.vendidosDesde).
// `:id` é sempre a empresa ativa: a promoção é por empresa (multi-CNPJ).
// ============================================================
import { request } from "@/services/api";
import { estoqueRupturaApi } from "@/services/estoqueRupturaApi";
import { DIAS_PARADO, inicioDaJanelaParados, vendidosDesde } from "@/components/screens/blackfriday/dePor/regrasDePor";

/** Linhas por página do ranking (máximo que o backend aceita). */
export var LIMITE_RANKING = 1000;
/** Trava de segurança: 50 páginas = 50.000 produtos vendidos no período. */
var MAX_PAGINAS = 50;

/** Ids dos produtos vendidos no período, página a página. */
export function produtosVendidosNoRanking(companyId: string, inicio: string, fim: string): Promise<Array<{ id: string }>> {
  var out: Array<{ id: string }> = [];
  function pagina(offset: number, n: number): Promise<Array<{ id: string }>> {
    var qs = "period=custom&start_date=" + inicio + "&end_date=" + fim + "&limit=" + LIMITE_RANKING + "&offset=" + offset;
    return request<any>("/companies/" + companyId + "/products/ranking?" + qs, { retry: 1, timeout: 30000 }).then(function (r) {
      var lista: any[] = r && Array.isArray(r.products) ? r.products : [];
      lista.forEach(function (p) { if (p && p.id) out.push({ id: String(p.id) }); });
      var total = r && r.pagination && Number(r.pagination.total_items);
      var proximo = offset + LIMITE_RANKING;
      var temMais = isFinite(total as number) ? proximo < (total as number) : lista.length >= LIMITE_RANKING;
      if (temMais && n + 1 < MAX_PAGINAS) return pagina(proximo, n + 1);
      return out;
    });
  }
  return pagina(0, 0);
}

/** Produtos (id) que venderam nos últimos 60 dias, hoje incluído. */
export function vendidosNosUltimos60Dias(companyId: string, hoje: string): Promise<Record<string, true>> {
  var inicio = inicioDaJanelaParados(hoje);
  return Promise.all([
    produtosVendidosNoRanking(companyId, inicio, hoje),
    estoqueRupturaApi.get(companyId, { janela: DIAS_PARADO }),
  ]).then(function (res) {
    var rup = res[1] || ({} as any);
    var linhas = ([] as any[]).concat(Array.isArray(rup.itens) ? rup.itens : [], Array.isArray(rup.zerados) ? rup.zerados : []);
    return vendidosDesde(res[0], linhas, inicio);
  });
}
