// app/(tabs)/financeiro/vendas-por-numeracao.tsx — /financeiro/vendas-por-numeracao
//
// 03/11/2026: "Vendas por produto e numeração" (mockup
// docs/mockups/relatorio-vendas-por-numeracao.html). Subtela do Financeiro,
// como /financeiro/produtos: sem item de menu nem `mod` próprio — a barra
// lateral marca Financeiro pelo prefixo da rota. Aceita ?period=week|month|
// last_month|d90 (o e-mail semanal linka com period=week).
// A tela vive em components/screens/financeiro/VendasPorNumeracaoScreen.tsx.
import { VendasPorNumeracaoScreen } from "@/components/screens/financeiro/VendasPorNumeracaoScreen";

export default function VendasPorNumeracaoRoute() {
  return <VendasPorNumeracaoScreen rotaFinanceiro="financeiro" hrefFinanceiro="/(tabs)/financeiro" />;
}
