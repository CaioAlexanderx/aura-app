// ============================================================
// AURA STUDIO · Novo pedido pra evento (rota dedicada)
//
// Item #12 da análise UX/UI: wizard evento estava preso ao botão
// do hub. Vira rota própria pra ficar bookmarkável e abrir em tela
// cheia (melhor pra entrada de grandes listas de pessoas).
//
// Reaproveita BulkOrderWizard. Quando o wizard fecha (sucesso ou
// cancel), navega de volta pro hub /studio/pedidos.
//
// Fase 1b: container via StudioScreen (reading), tema dinâmico.
// ============================================================
import { useRouter } from "expo-router";
import { View } from "react-native";
import { BulkOrderWizard } from "@/components/studio/BulkOrderWizard";
import { StudioBreadcrumb } from "@/components/studio/StudioBreadcrumb";
import { StudioScreen } from "@/components/studio/StudioScreen";

export default function NovoEvento() {
  const router = useRouter();
  return (
    <StudioScreen variant="reading" scroll={false}>
      <StudioBreadcrumb
        items={[
          { label: "Estúdio", href: "/studio" },
          { label: "Pedidos", href: "/studio/pedidos" },
          { label: "Novo pedido pra evento" },
        ]}
      />
      <View style={{ flex: 1, marginTop: 8 }}>
        <BulkOrderWizard
          asPage
          onClose={() => router.push("/studio/pedidos" as any)}
          onDone={() => router.push("/studio/pedidos" as any)}
        />
      </View>
    </StudioScreen>
  );
}
