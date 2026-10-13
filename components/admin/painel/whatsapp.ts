// Abre o WhatsApp (wa.me) de uma loja ou contato. O link reaproveita o
// waLink da Gestão Aura (prefixa 55 em número nacional, recusa < 10 dígitos).
import { Linking } from "react-native";
import { waLink } from "../clientLifecycle";

// true quando abriu; false quando não há telefone utilizável.
export function abrirWhatsApp(telefone: string | null | undefined): boolean {
  var url = waLink(telefone);
  if (!url) return false;
  Linking.openURL(url);
  return true;
}
