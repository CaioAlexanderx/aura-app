// ============================================================
// WhatsAppQueueSection — fila de lembretes por WhatsApp do dia (F3c)
//
// QA 27/07 (item 3): no Brasil o responsável tem telefone, não e-mail —
// a régua por e-mail (ReguaSection) só cobre quem tem e-mail cadastrado.
// Esta seção cobre o resto via wa.me (decisão do Caio, 27/07). Cada linha
// abre o WhatsApp (nova aba/app) com a mensagem pronta e, em seguida,
// marca como enviado (POST .../whatsapp-sent) — só o item muda de estado,
// sem recarregar a lista inteira. Linhas com already_sent NASCEM marcadas
// e continuam visíveis (o sensei precisa ver o que já disparou, elas
// não somem da lista).
//
// Marcar como enviado é best-effort: o link do WhatsApp já abriu antes
// da chamada, então uma falha em whatsapp-sent não bloqueia o sensei
// com um erro — ele só veria a linha continuar sem o badge "Enviado" e
// pode tocar de novo (idempotente no backend).
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, ActivityIndicator, Platform, Linking,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { karateDojoBillingApi, DojoWhatsappQueueItem } from "@/services/karateDojoBillingApi";
import { fmtBRL, fmtDateBR, mapBillingError, offsetLabel, todayISO } from "../helpers";

export function WhatsAppQueueSection() {
  const { federationId } = useKarateFederation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<DojoWhatsappQueueItem[]>([]);
  const [sendingKey, setSendingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!federationId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await karateDojoBillingApi.getWhatsappQueue(federationId, todayISO());
      setItems(res.data ?? []);
    } catch (e: any) {
      setError(mapBillingError(e).message);
    } finally {
      setLoading(false);
    }
  }, [federationId]);

  useEffect(() => { load(); }, [load]);

  if (!federationId) return null;

  async function send(item: DojoWhatsappQueueItem) {
    const key = `${item.charge_id}:${item.offset}`;
    if (sendingKey) return;
    setSendingKey(key);
    try {
      if (Platform.OS === "web") window.open(item.wa_url, "_blank");
      else await Linking.openURL(item.wa_url);
      await karateDojoBillingApi.markWhatsappSent(federationId, item.charge_id, item.offset);
      setItems((prev) =>
        prev.map((i) =>
          i.charge_id === item.charge_id && i.offset === item.offset ? { ...i, already_sent: true } : i
        )
      );
    } catch {
      // best-effort — o WhatsApp já abriu; falhar em marcar não é erro pro sensei.
    } finally {
      setSendingKey(null);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Icon name="whatsapp" size={16} color="#25D366" />
        <Text style={styles.cardTitle}>Enviar por WhatsApp</Text>
      </View>
      <Text style={styles.cardSub}>
        Lembretes de hoje para responsáveis sem e-mail cadastrado — abre o WhatsApp com a mensagem pronta.
      </Text>

      {loading && (
        <View style={styles.stateBoxSm}>
          <ActivityIndicator size="small" color={KarateColors.primary} />
        </View>
      )}

      {!loading && !!error && (
        <View style={styles.stateBoxSm}>
          <Text style={styles.errTxt}>{error}</Text>
          <TouchableOpacity onPress={load} accessibilityRole="button">
            <Text style={styles.retryTxt}>Tentar de novo</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && items.length === 0 && (
        <View style={styles.stateBoxSm}>
          <Icon name="whatsapp" size={20} color={KarateColors.ink3} />
          <Text style={styles.stateTxt}>Ninguém elegível para lembrete por WhatsApp hoje.</Text>
        </View>
      )}

      {!loading && !error && items.length > 0 && (
        <View style={{ gap: 8, marginTop: 10 }}>
          {items.map((item) => {
            const key = `${item.charge_id}:${item.offset}`;
            const busy = sendingKey === key;
            return (
              <View key={key} style={styles.row}>
                <View style={{ flex: 1, minWidth: 150 }}>
                  <Text style={styles.nome} numberOfLines={1}>{item.student_name}</Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {item.recipient_name && item.recipient_name !== item.student_name ? `Resp.: ${item.recipient_name} · ` : ""}
                    {fmtBRL(item.amount)} · vence {fmtDateBR(item.due_date)} · {offsetLabel(item.offset)}
                  </Text>
                </View>
                {item.already_sent && (
                  <View style={styles.sentBadge}>
                    <Icon name="check_circle" size={12} color={KarateColors.ok} />
                    <Text style={styles.sentTxt}>Enviado</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={[styles.waBtn, busy && styles.waBtnBusy]}
                  onPress={() => send(item)}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={`Enviar WhatsApp para ${item.recipient_name || item.student_name}`}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color="#25D366" />
                  ) : (
                    <>
                      <Icon name="whatsapp" size={14} color="#25D366" />
                      <Text style={styles.waBtnTxt}>{item.already_sent ? "Reenviar" : "Enviar"}</Text>
                    </>
                  )}
                </TouchableOpacity>
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
  head: { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  cardTitle: { fontSize: 14, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  cardSub: { fontSize: 12.5, color: KarateColors.ink2, marginTop: 8, lineHeight: 18 } as TextStyle,
  stateBoxSm: { alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 16 } as ViewStyle,
  stateTxt: { fontSize: 12.5, fontWeight: "600", color: KarateColors.ink2, textAlign: "center" } as TextStyle,
  errTxt: { fontSize: 12, color: KarateColors.danger, textAlign: "center" } as TextStyle,
  retryTxt: { fontSize: 12.5, fontWeight: "700", color: KarateColors.primary, marginTop: 4 } as TextStyle,
  row: {
    flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap",
    backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.sm,
    borderWidth: 1, borderColor: KarateColors.border, padding: 10,
  } as ViewStyle,
  nome: { fontSize: 13, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  meta: { fontSize: 11, color: KarateColors.ink3, marginTop: 2 } as TextStyle,
  sentBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: KarateColors.okSoft, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8 } as ViewStyle,
  sentTxt: { fontSize: 10.5, fontWeight: "700", color: KarateColors.ok } as TextStyle,
  waBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(37,211,102,0.10)", borderColor: "rgba(37,211,102,0.35)", borderWidth: 1, borderRadius: KarateRadius.sm, paddingVertical: 7, paddingHorizontal: 10 } as ViewStyle,
  waBtnBusy: { opacity: 0.6 } as ViewStyle,
  waBtnTxt: { fontSize: 12, fontWeight: "700", color: "#1a8f4e" } as TextStyle,
});
