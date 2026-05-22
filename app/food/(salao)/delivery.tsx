import { useEffect } from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { FoodColors } from "@/constants/food-tokens";

// ============================================================
// /food/(salao)/delivery — stub legado.
//
// 2026-05-22 (Fase 8): a tela "Delivery" passou a se referir ao
// despacho do delivery próprio. A UI antiga (import CSV do iFood)
// foi movida para /food/(salao)/ifood.
//
// Mantemos este arquivo como redirect-stub para não quebrar links
// salvos / atalhos antigos. Aponta para /despacho.
// ============================================================

export default function DeliveryStub() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/food/(salao)/despacho" as any);
  }, [router]);
  return (
    <View style={{ padding: 20 }}>
      <Text style={{ color: FoodColors.ink3, fontSize: 13 }}>Abrindo despacho...</Text>
    </View>
  );
}
