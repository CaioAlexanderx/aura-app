// ============================================================
// AURA STUDIO · PDV — sucesso pós-venda (Fase 6).
// ============================================================
import { View, Text, Pressable, Platform } from "react-native";
import type { StudioPalette } from "@/contexts/StudioThemeMode";
import type { SaleDone } from "./types";
import { money } from "./ui";
import { Ic } from "./icons";

export function StageDone({ t, done, onNewSale }: { t: StudioPalette; done: SaleDone; onNewSale: () => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: t.bg, alignItems: "center", justifyContent: "center", padding: 24 }}>
      <View style={{ width: 78, height: 78, borderRadius: 39, backgroundColor: t.success, alignItems: "center", justifyContent: "center" }}>
        <Ic name="check" size={38} color="#fff" />
      </View>
      <Text style={{ fontSize: 22, fontWeight: "800", color: t.ink, marginTop: 16 }}>Venda registrada!</Text>
      <Text style={{ fontSize: 13, color: t.ink3, marginTop: 6, textAlign: "center", maxWidth: 360 }}>
        O pedido entrou em “Aguardando arte” no Fluxo de Produção automaticamente.
      </Text>
      <View style={{ backgroundColor: t.paperCardElev, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: t.ink5, alignItems: "center", gap: 6, minWidth: 280, marginTop: 18 }}>
        <Text style={{ fontSize: 11, color: t.ink3, textTransform: "uppercase", letterSpacing: 0.5 }}>Total</Text>
        <Text style={{ fontSize: 28, color: t.primary, fontWeight: "800" }}>R$ {money(done.total)}</Text>
      </View>
      {done.wa_link && Platform.OS === "web" && (
        <Pressable
          onPress={() => { if (typeof window !== "undefined") window.open(done.wa_link!, "_blank"); }}
          style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#25D366", paddingHorizontal: 20, paddingVertical: 13, borderRadius: 12, marginTop: 18, ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}) }}
        >
          <Ic name="whatsapp" size={18} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "800" }}>Mandar WhatsApp pro cliente</Text>
        </Pressable>
      )}
      <Pressable onPress={onNewSale} style={{ backgroundColor: t.primary, paddingHorizontal: 26, paddingVertical: 13, borderRadius: 12, marginTop: 12, ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}) }}>
        <Text style={{ color: "#fff", fontSize: 14, fontWeight: "800" }}>+ Nova venda</Text>
      </Pressable>
    </View>
  );
}
