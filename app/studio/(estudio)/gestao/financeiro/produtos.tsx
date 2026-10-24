// app/studio/(estudio)/gestao/financeiro/produtos.tsx — /studio/gestao/financeiro/produtos
//
// A mesma curva ABC dentro do shell do Studio. O Financeiro do Studio
// (gestao/financeiro.tsx) renderiza o FinanceiroScreen do varejo com
// `embedded`, e o link "Produtos que mais dão dinheiro" da aba Receitas
// levava a /financeiro/produtos. Com essa rota agora dentro de (tabs), o
// AuthGuard de app/_layout.tsx devolveria o usuário do Studio para a home
// do estúdio — por isso, embutido, o link aponta para cá (24/10/2026).
import { ProdutosFinanceiroScreen } from "@/components/screens/financeiro/ProdutosFinanceiroScreen";

export default function StudioGestaoFinanceiroProdutos() {
  return <ProdutosFinanceiroScreen rotaFinanceiro="gestao/financeiro" hrefFinanceiro="/studio/gestao/financeiro" />;
}
