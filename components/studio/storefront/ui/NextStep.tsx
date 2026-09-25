// ============================================================
// components/studio/storefront/ui/NextStep.tsx
// Item numerado da lista de "Próximos passos" no stage sent.
//
// 25/09/2026: `Texto` no lugar de `Text` (o `Text` puro saía na fonte do
// sistema no meio da loja) e o número na tinta do par legível da loja —
// era branco cravado sobre a cor dela.
// ============================================================
import { View } from "react-native";
import { usePaletaDaVitrine } from "../TemaDaVitrine";
import { Texto, Numero } from "../TipografiaVitrine";

export function NextStep({
  n, title, desc, last,
}: {
  n: number;
  title: string;
  desc: string;
  last?: boolean;
}) {
  const T = usePaletaDaVitrine();
  return (
    <View style={{ flexDirection: "row", gap: 10, paddingBottom: last ? 0 : 12 }}>
      <View
        style={{
          width: 22, height: 22, borderRadius: 11,
          backgroundColor: T.primary,
          alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Numero style={{ color: T.sobrePrimary, fontSize: 11, fontWeight: "700" }}>{n}</Numero>
      </View>
      <View style={{ flex: 1 }}>
        <Texto style={{ fontSize: 13, color: T.ink, fontWeight: "800" }}>{title}</Texto>
        <Texto style={{ fontSize: 12, color: T.ink3, marginTop: 2, lineHeight: 17 }}>{desc}</Texto>
      </View>
    </View>
  );
}
