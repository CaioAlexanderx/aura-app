// ============================================================
// AURA. — Legenda do cartão "Total produtos" do Estoque no celular
//
// 23/11/2026 (p-202): o cartão mostrava "13034.5 unidades + 1 servico"
// (número em inglês, sem acento). Agora o número sai no formato brasileiro
// (até 3 casas, como o resto do Estoque) e o plural concorda:
// "1 unidade", "13.034,5 unidades + 1 serviço", "+ 2 serviços".
// ============================================================
import { fmtQty } from "@/utils/matconUnits";

/** "13.034,5 unidades + 1 serviço". Serviço só entra quando há algum. */
export function legendaUnidadesEServicos(unidades: number, servicos: number): string {
  const u = Number.isFinite(unidades) ? Math.round(unidades * 1000) / 1000 : 0;
  let texto = fmtQty(u) + (u === 1 ? " unidade" : " unidades");
  const n = Number.isFinite(servicos) ? Math.max(0, Math.floor(servicos)) : 0;
  if (n > 0) texto += " + " + n + (n === 1 ? " serviço" : " serviços");
  return texto;
}
