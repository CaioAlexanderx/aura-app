// ============================================================
// AURA STUDIO · Novo pedido pra evento (rota dedicada)
//
// Item #12 da análise UX/UI: wizard evento estava preso ao botão
// do hub. Vira rota própria pra ficar bookmarkável e abrir em tela
// cheia (melhor pra entrada de grandes listas de pessoas).
//
// Reaproveita BulkOrderWizard. Quando o wizard fecha (sucesso ou
// cancel), navega de volta pro hub /studio/pedidos.
// ============================================================
import { useRouter } from "expo-router";
import { View, StyleSheet } from "react-native";
import { BulkOrderWizard } from "@/components/studio/BulkOrderWizard";
import { StudioColors } from "@/constants/studio-tokens";
import { StudioBreadcrumb } from "@/components/studio/StudioBreadcrumb";

export default function NovoEvento() {
  const router = useRouter();
  return (
    <View style={s.root}>
      <StudioBreadcrumb
        items={[
          { label: "Estúdio", href: "/studio" },
          { label: "Pedidos", href: "/studio/pedidos" },
          { label: "Novo pedido pra evento" },
        ]}
      />
      <View style={s.body}>
        <BulkOrderWizard
          asPage
          onClose={() => router.push("/studio/pedidos" as any)}
          onDone={() => router.push("/studio/pedidos" as any)}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: StudioColors.bg },
  body: { flex: 1, padding: 22, maxWidth: 980, alignSelf: "center", width: "100%" },
});
