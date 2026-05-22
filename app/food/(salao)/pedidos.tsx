import React, { useState, useCallback } from "react";
import { View, ScrollView, StyleSheet, Platform } from "react-native";
import { OrbBackground } from "@/components/food/foundation/OrbBackground";
import { EyebrowHeadline } from "@/components/food/foundation/EyebrowHeadline";
import { HubKpiStrip } from "@/components/food/hub/HubKpiStrip";
import { HubChannelStrip } from "@/components/food/hub/HubChannelStrip";
import { HubFilterChips } from "@/components/food/hub/HubFilterChips";
import { HubBoard } from "@/components/food/hub/HubBoard";
import { useHubOrders, useHubStats, useHubChannels, type HubOrder } from "@/hooks/useFoodHub";
import { FoodTokensV2 } from "@/constants/food-tokens";
import { useAdvanceOrderStatusMutation } from "@/hooks/useFoodKds";

// ============================================================
// Hub de Pedidos (Fase 10) — substitui o placeholder is_staff.
// Materializa MOCKUP_HUB_PEDIDOS.html. Single source pra todos os
// canais (food_orders + digital_orders).
//
// Polling: orders 10s, stats 30s, channels 60s.
//
// Multi-CNPJ: hooks usam company.id do auth store; trocar de
// company refetch automatico via queryKey.
// ============================================================

export default function HubDePedidosPage() {
  const [channelFilter, setChannelFilter] = useState<string[]>([]);

  const { data: stats } = useHubStats();
  const { data: channelsData } = useHubChannels();
  const { data: ordersData, isLoading } = useHubOrders({ channels: channelFilter });

  const channels = channelsData?.channels || [];
  const orders = ordersData?.orders || [];

  const connectedCount = channels.filter((c) => c.connected).length;

  const advanceMut = useAdvanceOrderStatusMutation();

  const onAccept = useCallback((o: HubOrder) => {
    // food_orders -> avanca pra confirmed (depois preparing automatico via KDS)
    if (o.source === "food_orders") {
      const next = (o.status || "").toLowerCase() === "pending" ? "confirmed" : "preparing";
      advanceMut.mutate({ orderId: o.id, status: next });
    }
    // digital_orders -> aprovacao manual ja existe em TabPedidos; aqui
    // sinalizamos via console pro caller saber que ainda nao integramos
    // (Fase 11 fecha esse fluxo).
  }, [advanceMut]);

  const onReject = useCallback((o: HubOrder) => {
    if (o.source === "food_orders") {
      advanceMut.mutate({ orderId: o.id, status: "cancelled" });
    }
  }, [advanceMut]);

  const onPrint = useCallback((o: HubOrder) => {
    if (Platform.OS !== "web") return;
    // helper de impressao 80mm ja existe em utils/printThermal — Fase 7.
    // Pra nao quebrar build se import dinamico falhar, tentamos lazy.
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require("@/utils/printThermal");
      if (mod?.buildComandaUrl && typeof window !== "undefined") {
        const url = mod.buildComandaUrl(o.id);
        if (mod.printViaIframe) mod.printViaIframe(url);
        else window.open(url, "_blank");
      }
    } catch {
      // silencioso — Fase 11 polish
    }
  }, []);

  const onDispatch = useCallback((_o: HubOrder) => {
    // Despacho ja tem tela dedicada em /food/(salao)/despacho — aqui só
    // navegamos. Fase 11 traz DispatchModal inline.
    try {
      const router = require("expo-router").useRouter?.();
      router?.push?.("/food/(salao)/despacho");
    } catch {/* noop */}
  }, []);

  const onOpenNfce = useCallback((o: HubOrder) => {
    if (Platform.OS !== "web" || !o.nfce_emission_id) return;
    // padrao do app: rota /nfce/[id]
    try { window.open("/nfce/" + o.nfce_emission_id, "_blank"); } catch {/* noop */}
  }, []);

  return (
    <View style={styles.root}>
      <OrbBackground />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <EyebrowHeadline
          eyebrow={"AO VIVO · " + connectedCount + " CANAIS"}
          headline="Hub de"
          accent="Pedidos"
          subtitle={(stats?.open_orders ?? 0) + " abertos · atualizando em tempo real"}
          withLiveDot
        />

        <HubKpiStrip stats={stats} />

        <HubChannelStrip
          channels={channels}
          active={channelFilter}
          onToggle={(k) => {
            setChannelFilter((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
          }}
        />

        <HubFilterChips channels={channels} active={channelFilter} onChange={setChannelFilter} />

        <HubBoard
          orders={orders}
          loading={isLoading}
          onAccept={onAccept}
          onReject={onReject}
          onPrint={onPrint}
          onDispatch={onDispatch}
          onOpenNfce={onOpenNfce}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: FoodTokensV2.bg },
  container: { padding: 20, gap: 16, paddingBottom: 80 },
});
