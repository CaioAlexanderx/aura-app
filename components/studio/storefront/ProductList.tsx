// ============================================================
// components/studio/storefront/ProductList.tsx
// Stage="list": hero da loja + grid de produtos + CartBar.
// ============================================================
import { View, Text, Pressable, ScrollView, Platform } from "react-native";
import type { StorefrontState } from "./useStorefront";
import { T } from "./types";
import { LivePreview } from "./LivePreview";
import { CartBar } from "./Cart";
import { PoweredByAura } from "./ui/PoweredByAura";

export function ProductList({ sf }: { sf: StorefrontState }) {
  if (!sf.store) return null;
  const { store } = sf;
  const accent = store.site.accent_color || T.accent;
  const primary = store.site.primary_color || T.primary;

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {/* Hero */}
      <View
        style={[
          { padding: 24, paddingBottom: 28, backgroundColor: primary },
          Platform.OS === "web"
            ? ({ background: "linear-gradient(135deg, " + primary + ", " + accent + ")" } as any)
            : {},
        ]}
      >
        <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase" }}>
          Aura Studio · Personalizados
        </Text>
        <View
          style={{
            alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5,
            backgroundColor: "rgba(255,255,255,0.18)",
            paddingHorizontal: 10, paddingVertical: 4,
            borderRadius: 999, marginTop: 8,
            borderWidth: 1, borderColor: "rgba(255,255,255,0.25)",
          }}
        >
          <Text style={{ color: "#fff", fontSize: 10 }}>●</Text>
          <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase" }}>
            Loja oficial · Arte personalizada
          </Text>
        </View>
        <Text style={{ color: "#fff", fontSize: 32, fontWeight: "900", marginTop: 10, letterSpacing: -0.5 }}>
          {store.site.name}
        </Text>
        {store.site.tagline ? (
          <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 6 }}>{store.site.tagline}</Text>
        ) : null}
        <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, marginTop: 10 }}>
          Prazo de produção: ~{store.sla.total_estimate_days}{" "}
          {store.sla.total_estimate_days === 1 ? "dia útil" : "dias úteis"}
        </Text>
      </View>

      {/* Grade de produtos */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: sf.cart.length > 0 ? 150 : 60 }}
      >
        {store.products.length === 0 ? (
          <View style={{ padding: 32, alignItems: "center" }}>
            <Text style={{ fontSize: 36 }}>🎨</Text>
            <Text style={{ color: T.ink, fontWeight: "700", marginTop: 12, textAlign: "center" }}>
              Esta loja ainda não tem produtos personalizáveis publicados.
            </Text>
            <Text style={{ color: T.ink3, fontSize: 12, marginTop: 6, textAlign: "center" }}>
              Volte em breve!
            </Text>
          </View>
        ) : (
          store.products.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => sf.openConfigure(p)}
              style={[
                {
                  backgroundColor: T.card, borderRadius: 12, padding: 12,
                  paddingLeft: 14,
                  borderWidth: 1, borderColor: T.border,
                  borderLeftWidth: 3, borderLeftColor: T.primary,
                  flexDirection: "row", gap: 12, alignItems: "center",
                  position: "relative",
                },
                Platform.OS === "web"
                  ? ({ boxShadow: "0 4px 12px -4px rgba(30,58,138,0.15)" } as any)
                  : ({ elevation: 3 } as any),
              ]}
            >
              <LivePreview
                config={p.customization_config}
                values={{}}
                size={72}
                productName={p.name}
                showLabel={false}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, color: T.ink, fontWeight: "700" }}>{p.name}</Text>
                {p.description ? (
                  <Text style={{ fontSize: 11, color: T.ink3, marginTop: 2 }} numberOfLines={2}>
                    {p.description}
                  </Text>
                ) : null}
                <Text style={{ fontSize: 14, color: primary, fontWeight: "800", marginTop: 4 }}>
                  A partir de R$ {Number(p.price).toFixed(2)}
                </Text>
              </View>
              <View
                style={{
                  alignSelf: "center", paddingHorizontal: 10, paddingVertical: 6,
                  borderRadius: 999, backgroundColor: accent,
                }}
              >
                <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>Personalizar →</Text>
              </View>
              <View
                style={{
                  position: "absolute", top: 6, right: 6,
                  backgroundColor: T.accent,
                  paddingHorizontal: 6, paddingVertical: 2,
                  borderRadius: 4,
                }}
              >
                <Text style={{ color: "#fff", fontSize: 9, fontWeight: "800", letterSpacing: 0.5 }}>
                  PERSONALIZÁVEL
                </Text>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>

      <CartBar sf={sf} accent={accent} />
      <PoweredByAura />
    </View>
  );
}
