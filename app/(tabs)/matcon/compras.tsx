// ============================================================
// AURA. — /matcon/compras → /fornecedores (25/09/2026)
//
// A esteira de Compras (M4, 22/09) virou parte da tela de Fornecedores,
// organizada por fornecedor. A rota fica só para não quebrar links e o
// guia do Matcon; a folha do pedido mora em
// components/matcon/PedidoCompraSheet.tsx.
// ============================================================
import { Redirect } from "expo-router";

export default function MatconComprasRedirect() {
  return <Redirect href={"/fornecedores" as any} />;
}
