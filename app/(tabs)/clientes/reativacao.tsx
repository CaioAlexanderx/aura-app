// ============================================================
// /clientes/reativacao — virada do WhatsApp (27/11/2026)
//
// A reativação pela Meta (cupom, prévia, cota, automático semanal) passou
// para a aba Venda+ do WhatsApp: esta rota só redireciona para lá. A rota
// do servidor e os dados não mudam.
//
// Essencial NÃO tem o WhatsApp oficial (o módulo é do Negócio): continua
// com o "Chamar" por wa.me, um toque por cliente (ChamarSumidos). Por isso
// a chave de módulo "clientes.reativacao" segue em MODULE_PLAN_MAP
// (essencial) e em PERM_TO_MODULES (clientes).
// ============================================================
import { Redirect } from "expo-router";
import { useAuthStore } from "@/stores/auth";
import { ChamarSumidos } from "@/components/screens/clientes/ChamarSumidos";

export default function ReativacaoScreen() {
  const plano = useAuthStore((s) => (s.company as any)?.plan);
  if (String(plano || "").toLowerCase() === "essencial") return <ChamarSumidos />;
  return <Redirect href={"/whatsapp?aba=venda_mais" as any} />;
}
