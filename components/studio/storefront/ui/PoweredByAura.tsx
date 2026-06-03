// ============================================================
// components/studio/storefront/ui/PoweredByAura.tsx
// Footer "Powered by Aura" — presente em todos os stages exceto sent.
// ============================================================
import { View, Text } from "react-native";
import { T } from "../types";

export function PoweredByAura() {
  return (
    <View
      style={{
        position: "absolute", left: 0, right: 0, bottom: 0,
        paddingVertical: 6, paddingHorizontal: 12,
        alignItems: "center", justifyContent: "center",
        backgroundColor: "rgba(250,250,252,0.92)",
        borderTopWidth: 1, borderTopColor: T.border,
      }}
      pointerEvents="none"
    >
      <Text style={{ fontSize: 9.5, color: T.ink4, letterSpacing: 0.4 }}>
        Powered by <Text style={{ fontWeight: "800", color: T.ink3 }}>Aura</Text> · loja.getaura.com.br/aura
      </Text>
    </View>
  );
}
