// app/studio/(estudio)/gestao/financeiro/categorias.tsx
//
// 09/11/2026: a mesma tela de Categorias do Financeiro dentro do Studio. Como
// em ./produtos.tsx: a rota de (tabs) levaria o usuário do Studio de volta
// para a home do estúdio (AuthGuard de app/_layout.tsx).
import { CategoriasFinanceiroScreen } from "@/components/screens/financeiro/categorias/CategoriasFinanceiroScreen";

export default function StudioGestaoFinanceiroCategorias() {
  return <CategoriasFinanceiroScreen hrefFinanceiro="/studio/gestao/financeiro" />;
}
