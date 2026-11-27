// ============================================================
// /clientes/reativacao — rota legada (virada do WhatsApp, 27/11/2026)
//
// A reativação (Venda+) vive na aba Venda+ do WhatsApp, para todos os
// planos: esta rota só redireciona para lá. Sem item de menu; a chave de
// módulo "clientes.reativacao" segue nos mapas como legado. O "Chamar no
// WhatsApp" (wa.me) de cada cliente em Clientes continua.
// ============================================================
import { Redirect } from "expo-router";

export default function ReativacaoScreen() {
  return <Redirect href={"/whatsapp?aba=venda_mais" as any} />;
}
