// ============================================================
// AURA. — Faixa de atraso no topo do Painel (tq-86, 24/10/2026)
//
// Em atraso, antes do dia em que as outras telas pausam, o Painel avisa a
// data da pausa (a mesma faixa do Caixa, components/screens/pdv/AvisoAssine).
// Depois da pausa o shell Negócio leva ao Caixa, que mostra a faixa dele.
// Só o dono vê; staff, demo e Karatê ficam fora (utils/muroDeAssinatura).
// 25/10/2026 (item 11): a faixa traz o botão "Preciso de ajuda" do AvisoAssine.
// ============================================================
import { View } from "react-native";
import { useAuthStore } from "@/stores/auth";
import { AvisoAssine } from "@/components/screens/pdv/AvisoAssine";
import { avisoDeAtraso, estadoDaLoja } from "@/utils/muroDeAssinatura";
import { IS_WIDE } from "@/components/screens/dashboard/types";

export function AvisoDeAtrasoNoPainel() {
  const company = useAuthStore((s) => s.company);
  const user = useAuthStore((s) => s.user);
  const trialActive = useAuthStore((s) => s.trialActive);
  const isDemo = useAuthStore((s) => s.isDemo);
  const isStaff = useAuthStore((s) => s.isStaff);
  const atraso = avisoDeAtraso(estadoDaLoja({ company, user, trialActive, isDemo, isStaff }));
  if (!atraso || atraso.fase !== "liberado") return null;
  return (
    // Mesma largura e margem do conteúdo do Painel (app/(tabs)/index.tsx).
    <View style={{ paddingHorizontal: IS_WIDE ? 32 : 20, paddingTop: IS_WIDE ? 24 : 16, maxWidth: 1200, alignSelf: "center", width: "100%", position: "relative", zIndex: 2 }}>
      <AvisoAssine atraso={atraso} testID="painel-aviso-atraso" />
    </View>
  );
}

export default AvisoDeAtrasoNoPainel;
