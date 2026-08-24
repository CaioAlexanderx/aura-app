// ============================================================
// WaOutboxCard — fila de envio do WhatsApp Cloud API (Onda 5b)
//
// Últimos 50 itens de GET /companies/:id/whatsapp/outbox: destino,
// template, status e — o que realmente importa pro sensei — o MOTIVO
// quando não saiu (skip_reason) ou o erro que a Meta devolveu
// (last_error), sempre em pt-BR legível (ver helpers.ts).
//
// Sem WABA/token (409 NAO_CONECTADO) vira estado vazio com orientação,
// nunca erro cru.
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, ActivityIndicator, TouchableOpacity, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { waApi, WaOutboxItem } from "@/services/waApi";
import {
  fmtPhoneBR, fmtWhenBR, mapWaError, waErrorLabel, waOutboxStatusView, waSkipReasonLabel,
} from "./helpers";

interface Props {
  companyId: string;
  /** Muda após envio de teste / recarga do status — refaz a lista. */
  refreshKey?: number;
}

export function WaOutboxCard({ companyId, refreshKey }: Props) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<WaOutboxItem[]>([]);
  const [notConnected, setNotConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    setNotConnected(false);
    try {
      const res = await waApi.listOutbox(companyId);
      setItems(res.data ?? []);
    } catch (e: any) {
      const mapped = mapWaError(e);
      if (mapped.code === "NAO_CONECTADO") setNotConnected(true);
      else setError(mapped.message);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.headTitle}>
          <Icon name="inbox" size={16} color={KarateColors.primary} />
          <Text style={styles.cardTitle}>Últimos envios</Text>
        </View>
        <TouchableOpacity onPress={load} accessibilityRole="button" accessibilityLabel="Atualizar lista de envios" style={styles.iconBtn}>
          <Icon name="refresh" size={14} color={KarateColors.ink2} />
          <Text style={styles.iconBtnTxt}>Atualizar</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.cardSub}>
        Fila da Cloud API — mostra o que saiu, o que ainda vai sair e o motivo de cada mensagem que
        não foi enviada.
      </Text>

      {loading && (
        <View style={styles.stateBox}>
          <ActivityIndicator size="small" color={KarateColors.primary} />
        </View>
      )}

      {!loading && notConnected && (
        <View style={styles.stateBox}>
          <Icon name="link" size={20} color={KarateColors.ink3} />
          <Text style={styles.stateTxt}>Conecte o WhatsApp do dojô para ver a fila de envios.</Text>
        </View>
      )}

      {!loading && !notConnected && !!error && (
        <View style={styles.stateBox}>
          <Text style={styles.errTxt}>{error}</Text>
          <TouchableOpacity onPress={load} accessibilityRole="button">
            <Text style={styles.retryTxt}>Tentar de novo</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !notConnected && !error && items.length === 0 && (
        <View style={styles.stateBox}>
          <Icon name="inbox" size={20} color={KarateColors.ink3} />
          <Text style={styles.stateTxt}>Nenhuma mensagem enviada por aqui ainda.</Text>
        </View>
      )}

      {!loading && !notConnected && !error && items.length > 0 && (
        <View style={styles.list}>
          {items.map((item) => {
            const view = waOutboxStatusView(item.status);
            const skip = waSkipReasonLabel(item.skip_reason);
            const err = waErrorLabel(item.last_error);
            const attempts = typeof item.attempts === "number" && item.attempts > 1
              ? ` · ${item.attempts} tentativas`
              : "";
            return (
              <View key={item.id} style={styles.row}>
                <View style={styles.rowMain}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{fmtPhoneBR(item.to_phone)}</Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {item.template_name || item.kind || "Mensagem"} · {fmtWhenBR(item.created_at)}{attempts}
                  </Text>
                  {!!skip && <Text style={styles.rowWhy} numberOfLines={2}>{skip}</Text>}
                  {!skip && !!err && <Text style={styles.rowErr} numberOfLines={2}>{err}</Text>}
                </View>
                <View style={[styles.badge, { backgroundColor: view.bg }]}>
                  <Icon name={view.icon} size={12} color={view.color} />
                  <Text style={[styles.badgeTxt, { color: view.color }]}>{view.label}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14 } as ViewStyle,
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 } as ViewStyle,
  headTitle: { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  cardTitle: { fontSize: 14, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  cardSub: { fontSize: 12.5, color: KarateColors.ink2, marginTop: 8, lineHeight: 18, maxWidth: 560 } as TextStyle,
  iconBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.sm, paddingVertical: 6, paddingHorizontal: 10 } as ViewStyle,
  iconBtnTxt: { fontSize: 12, fontWeight: "700", color: KarateColors.ink2 } as TextStyle,
  list: { gap: 8, marginTop: 12 } as ViewStyle,
  row: {
    flexDirection: "row", alignItems: "flex-start", gap: 10, flexWrap: "wrap",
    backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.sm,
    borderWidth: 1, borderColor: KarateColors.border, padding: 10,
  } as ViewStyle,
  rowMain: { flex: 1, minWidth: 180, gap: 2 } as ViewStyle,
  rowTitle: { fontSize: 13, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  rowMeta: { fontSize: 11, color: KarateColors.ink3 } as TextStyle,
  rowWhy: { fontSize: 11.5, color: KarateColors.warn, marginTop: 3, lineHeight: 16 } as TextStyle,
  rowErr: { fontSize: 11.5, color: KarateColors.danger, marginTop: 3, lineHeight: 16 } as TextStyle,
  badge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8 } as ViewStyle,
  badgeTxt: { fontSize: 10.5, fontWeight: "700" } as TextStyle,
  stateBox: { alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 20 } as ViewStyle,
  stateTxt: { fontSize: 12.5, fontWeight: "600", color: KarateColors.ink2, textAlign: "center" } as TextStyle,
  errTxt: { fontSize: 12, color: KarateColors.danger, textAlign: "center" } as TextStyle,
  retryTxt: { fontSize: 12.5, fontWeight: "700", color: KarateColors.primary, marginTop: 4 } as TextStyle,
});
