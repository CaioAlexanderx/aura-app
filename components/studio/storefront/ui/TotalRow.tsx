// ============================================================
// components/studio/storefront/ui/TotalRow.tsx
// Linha de total no checkout.
// ============================================================
import { View, Text } from "react-native";
import { T } from "../types";

export function TotalRow({ l, v, big }: { l: string; v: number; big?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={{ fontSize: big ? 14 : 12, color: big ? T.ink : T.ink2, fontWeight: big ? "800" : "500" }}>{l}</Text>
      <Text style={{ fontSize: big ? 18 : 12, color: big ? T.primary : T.ink, fontWeight: big ? "800" : "600" }}>
        R$ {Number(v).toFixed(2)}
      </Text>
    </View>
  );
}
