// app/(tabs)/financeiro/produtos.tsx — /financeiro/produtos
//
// Curva ABC ("Produtos que mais dão dinheiro") dentro da casca do app.
// 24/10/2026: saiu de app/financeiro/produtos.tsx, que ficava fora do grupo
// (tabs) — abria sem a barra lateral e o Voltar caía no Painel. A URL é a
// mesma (links do relatório semanal e o redirect de ?focus=abc continuam
// valendo). Subtela do Financeiro: sem item de menu nem `mod` próprio — a
// barra lateral marca Financeiro pelo prefixo da rota.
// A tela em si vive em components/screens/financeiro/ProdutosFinanceiroScreen.tsx.
import { ProdutosFinanceiroScreen } from "@/components/screens/financeiro/ProdutosFinanceiroScreen";

export default function ProdutosFinanceiroRoute() {
  return <ProdutosFinanceiroScreen rotaFinanceiro="financeiro" hrefFinanceiro="/(tabs)/financeiro" />;
}
