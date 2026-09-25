// ============================================================
// components/studio/storefront/ui/TotalRow.tsx
// Linha de total no checkout.
//
// 25/09/2026: rótulo em `Texto` (fonte da loja) e valor em `Numero`
// (Bricolage, dígitos tabulares) — o total não muda de largura quando o
// frete entra. O total grande usa a marca como TEXTO legível: `primary` é
// preenchimento e numa loja amarela o valor sumia no papel.
// ============================================================
import { View } from "react-native";
import { usePaletaDaVitrine } from "../TemaDaVitrine";
import { Texto, Numero } from "../TipografiaVitrine";
import { dinheiro } from "../moeda";

export function TotalRow({ l, v, big }: { l: string; v: number; big?: boolean }) {
  const T = usePaletaDaVitrine();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
      <Texto style={{ fontSize: big ? 14 : 12.5, color: big ? T.ink : T.ink2, fontWeight: big ? "800" : "500" }}>{l}</Texto>
      <Numero style={{ fontSize: big ? 18 : 12.5, color: big ? T.primaryTexto : T.ink, fontWeight: big ? "700" : "600" }}>
        {dinheiro(Number(v))}
      </Numero>
    </View>
  );
}
