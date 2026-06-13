import { Redirect } from "expo-router";

// Rota legada de crédito (ficha antiga) aposentada em 13/06/2026.
// A ficha do cliente agora vive no ClienteCrediarioModal, aberto pela aba Crediário.
// Mantemos este redirect para que qualquer link/bookmark antigo caia na tela atual.
export default function LegacyCreditCustomerRoute() {
  return <Redirect href="/crediario" />;
}
