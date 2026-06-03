// ============================================================
// components/studio/storefront/SentConfirmation.tsx
// Stage="sent": confirmação do pedido enviado com Pix,
// policy de revisões e próximos passos.
// ============================================================
import { View, Text, Pressable, ScrollView, Platform } from "react-native";
import type { StorefrontState } from "./useStorefront";
import { T } from "./types";
import { NextStep } from "./ui/NextStep";

export function SentConfirmation({ sf }: { sf: StorefrontState }) {
  if (!sf.sentOrder || !sf.store) return null;
  const { sentOrder, store } = sf;
  const rev = store.revisions;
  const slaDays = store.sla.total_estimate_days;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: T.bg }}
      contentContainerStyle={{
        padding: 24, paddingBottom: 40,
        alignItems: "center", minHeight: "100%" as any,
      }}
    >
      <View
        style={{
          width: 80, height: 80, borderRadius: 40,
          backgroundColor: T.green,
          alignItems: "center", justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 40, color: "#fff" }}>✓</Text>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 }}>
        <Text style={{ fontSize: 12, color: T.accent }}>✨</Text>
        <Text style={{ fontSize: 10.5, color: T.ink3, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" }}>
          Feito no Aura Studio
        </Text>
      </View>

      <Text style={{ fontSize: 22, fontWeight: "800", color: T.ink, marginTop: 10 }}>
        Pedido enviado!
      </Text>
      <Text style={{ fontSize: 13, color: T.ink3, marginTop: 6, textAlign: "center", maxWidth: 320 }}>
        {sentOrder.pix
          ? "Pague o Pix abaixo. Depois disso, a loja inicia a arte e envia mockup pra aprovação no WhatsApp."
          : sentOrder.card
          ? "Redirecionando ao pagamento com cartão..."
          : "A loja confirmará seu pedido em breve por WhatsApp."}
      </Text>

      <View
        style={{
          backgroundColor: T.card, borderRadius: 12, padding: 16,
          borderWidth: 1, borderColor: T.border,
          alignItems: "center", gap: 6, minWidth: 260, marginTop: 16,
        }}
      >
        <Text style={{ fontSize: 11, color: T.ink3, textTransform: "uppercase" }}>Pedido</Text>
        <Text style={{ fontSize: 18, color: T.ink, fontWeight: "800" }}>#{sentOrder.order_number}</Text>
        <Text style={{ fontSize: 11, color: T.ink3, textTransform: "uppercase", marginTop: 8 }}>Total</Text>
        <Text style={{ fontSize: 26, color: T.primary, fontWeight: "800" }}>
          R$ {Number(sentOrder.total).toFixed(2)}
        </Text>
        <Text style={{ fontSize: 11, color: T.accent, fontWeight: "700", marginTop: 8 }}>
          Aguardando produção da arte
        </Text>
      </View>

      {sentOrder.pix && (
        <View style={{ marginTop: 16, maxWidth: 320, gap: 8 }}>
          <Text style={{ fontSize: 11, color: T.ink3, textAlign: "center" }}>Pix copia-e-cola</Text>
          <Text
            style={{
              fontSize: 11, color: T.ink,
              fontFamily: Platform.OS === "web" ? "monospace" : undefined,
              padding: 10, backgroundColor: T.bg, borderRadius: 8,
              borderWidth: 1, borderColor: T.border,
            }}
            numberOfLines={4}
          >
            {sentOrder.pix.payload}
          </Text>
        </View>
      )}

      <View
        style={{
          backgroundColor: T.card, borderRadius: 12, padding: 16,
          borderWidth: 1, borderColor: T.border,
          marginTop: 20, maxWidth: 380, width: "100%",
        }}
      >
        <Text
          style={{
            fontSize: 11, color: T.accent, fontWeight: "800",
            letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8,
          }}
        >
          Próximos passos
        </Text>
        <NextStep n={1} title="A loja recebe seu pedido" desc="Tudo que você personalizou já chegou. A produção entra na fila." />
        <NextStep
          n={2}
          title="Arte é preparada"
          desc={`Em até ${slaDays} ${slaDays === 1 ? "dia útil" : "dias úteis"} a loja gera o mockup digital do seu pedido.`}
        />
        <NextStep n={3} title="Você aprova pelo WhatsApp" desc="A loja te envia o mockup pra aprovar. Se quiser ajustes, é só pedir." />
        <NextStep n={4} title="Produção e entrega" desc="Após aprovado, vai pra produção. Entrega/retirada conforme combinado." last />
      </View>

      {(rev.max_included > 0 || rev.policy_text) && (
        <View
          style={{
            backgroundColor: T.bg, borderRadius: 12, padding: 14,
            borderWidth: 1, borderColor: T.border,
            marginTop: 12, maxWidth: 380, width: "100%",
            gap: 6,
          }}
        >
          <Text style={{ fontSize: 11, color: T.ink3, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase" }}>
            Política de revisões
          </Text>
          {rev.max_included > 0 && (
            <Text style={{ fontSize: 12, color: T.ink2, lineHeight: 17 }}>
              <Text style={{ fontWeight: "800", color: T.primary }}>{rev.max_included}</Text>
              {" "}revis{rev.max_included === 1 ? "ão" : "ões"} grát{rev.max_included === 1 ? "is" : "is"} no mockup.
              {rev.extra_price > 0 && (
                <>
                  {" "}Revisão extra:{" "}
                  <Text style={{ fontWeight: "800", color: T.accent }}>R$ {rev.extra_price.toFixed(2)}</Text>.
                </>
              )}
            </Text>
          )}
          {rev.policy_text && (
            <Text style={{ fontSize: 11.5, color: T.ink3, lineHeight: 16, fontStyle: "italic" }}>
              {rev.policy_text}
            </Text>
          )}
        </View>
      )}

      <Pressable
        onPress={sf.resetToList}
        style={{
          backgroundColor: T.primary, paddingHorizontal: 24, paddingVertical: 12,
          borderRadius: 10, marginTop: 20,
        }}
      >
        <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>+ Personalizar outro</Text>
      </Pressable>
    </ScrollView>
  );
}
