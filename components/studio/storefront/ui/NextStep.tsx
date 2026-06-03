// ============================================================
// components/studio/storefront/ui/NextStep.tsx
// Item numerado da lista de "Próximos passos" no stage sent.
// ============================================================
import { View, Text } from "react-native";
import { T } from "../types";

export function NextStep({
  n, title, desc, last,
}: {
  n: number;
  title: string;
  desc: string;
  last?: boolean;
}) {
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
        <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>{n}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 12.5, color: T.ink, fontWeight: "800" }}>{title}</Text>
        <Text style={{ fontSize: 11.5, color: T.ink3, marginTop: 2, lineHeight: 16 }}>{desc}</Text>
      </View>
    </View>
  );
}
