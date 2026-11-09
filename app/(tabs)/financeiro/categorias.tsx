// app/(tabs)/financeiro/categorias.tsx — /financeiro/categorias
//
// 09/11/2026: Categorias e subcategorias do Financeiro (mockup
// mockup-categorias-financeiro.html, seção A). Subtela do Financeiro, como
// /financeiro/produtos: sem item de menu nem `mod` próprio — a barra lateral
// marca Financeiro pelo prefixo da rota. Entrada pelo botão "Categorias" da
// aba Lançamentos e pelo "Organizar categorias" do lançamento.
import { CategoriasFinanceiroScreen } from "@/components/screens/financeiro/categorias/CategoriasFinanceiroScreen";

export default function CategoriasFinanceiroRoute() {
  return <CategoriasFinanceiroScreen hrefFinanceiro="/(tabs)/financeiro" />;
}
