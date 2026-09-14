// ============================================================
// FilaCard — as cobranças do crediário que passaram pela Cloud API
//
// GET /companies/:id/whatsapp/outbox devolve a fila inteira da company
// (mensalidade do dojô, testes, crediário). Esta aba é do VAREJO, então
// filtra por `source_type` das cobranças: 'crediario' (régua automática),
// 'crediario_manual' (o lojista tocou em "Enviar pelo WhatsApp oficial")
// e 'teste'.
//
// O que o lojista vem procurar aqui é sempre a mesma coisa: "por que a
// cobrança do fulano não saiu?". Por isso skip_reason e last_error
// chegam traduzidos (waGuards) — código cru não responde nada.
// ============================================================
import React from "react";
import { View, Text, ActivityIndicator, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { WaOutboxItem } from "@/services/waApi";
import {
  fmtPhoneBR, fmtWhenBR, waErrorLabel, waOutboxStatusSpec, waSkipReasonLabel,
} from "./waGuards";
import { waTonePair } from "./varejoTheme";

/** source_type que pertencem à cobrança do crediário (o resto é do dojô). */
export const FONTES_CREDIARIO = ["crediario", "crediario_manual", "teste"];

export function filtrarCrediario(items: WaOutboxItem[] | null | undefined): WaOutboxItem[] {
  const list = Array.isArray(items) ? items : [];
  return list.filter((i) => FONTES_CREDIARIO.indexOf(String(i?.source_type || "")) !== -1);
}

interface Props {
  items: WaOutboxItem[];
  loading: boolean;
  /** true = 409 NAO_CONECTADO (falta WABA/token) — estado vazio, não erro. */
  notConnected: boolean;
  error: string | null;
  onReload: () => void;
}

export function FilaCard({ items, loading, notConnected, error, onReload }: Props) {
  return (
    <View style={s.card} testID="wa-varejo-fila">
      <View style={s.head}>
        <View style={s.headTitle}>
          <Icon name="inbox" size={16} color={Colors.violet3} />
          <Text style={s.title}>Cobranças enviadas</Text>
        </View>
        <Pressable
          onPress={onReload}
          accessibilityRole="button"
          accessibilityLabel="Atualizar lista de cobranças"
          style={s.ghostBtn}
          testID="wa-varejo-fila-atualizar"
        >
          <Icon name="refresh" size={13} color={Colors.ink3} />
          <Text style={s.ghostTxt}>Atualizar</Text>
        </Pressable>
      </View>
      <Text style={s.sub}>
        Fila da Cloud API — o que saiu, o que ainda vai sair e o motivo de cada cobrança que não foi
        enviada.
      </Text>

      {loading && (
        <View style={s.stateBox}>
          <ActivityIndicator size="small" color={Colors.violet3} />
        </View>
      )}

      {!loading && notConnected && (
        <View style={s.stateBox} testID="wa-varejo-fila-sem-conexao">
          <Icon name="link" size={20} color={Colors.ink3} />
          <Text style={s.stateTxt}>Conecte o WhatsApp da loja para ver a fila de cobranças.</Text>
        </View>
      )}

      {!loading && !notConnected && !!error && (
        <View style={s.stateBox}>
          <Text style={s.errTxt}>{error}</Text>
          <Pressable onPress={onReload} accessibilityRole="button">
            <Text style={s.retryTxt}>Tentar de novo</Text>
          </Pressable>
        </View>
      )}

      {!loading && !notConnected && !error && items.length === 0 && (
        <View style={s.stateBox} testID="wa-varejo-fila-vazia">
          <Icon name="inbox" size={20} color={Colors.ink3} />
          <Text style={s.stateTxt}>Nenhuma cobrança enviada pela Cloud API ainda.</Text>
        </View>
      )}

      {!loading && !notConnected && !error && items.length > 0 && (
        <View style={s.list}>
          {items.map((item) => {
            const spec = waOutboxStatusSpec(item.status);
            const tone = waTonePair(spec.tone);
            const skip = waSkipReasonLabel(item.skip_reason);
            const err = waErrorLabel(item.last_error);
            const attempts = typeof item.attempts === "number" && item.attempts > 1
              ? ` · ${item.attempts} tentativas`
              : "";
            return (
              <View key={item.id} style={s.row}>
                <View style={s.rowMain}>
                  <Text style={s.rowTitle} numberOfLines={1}>{fmtPhoneBR(item.to_phone)}</Text>
                  <Text style={s.rowMeta} numberOfLines={1}>
                    {item.template_name || item.kind || "Mensagem"} · {fmtWhenBR(item.created_at)}{attempts}
                  </Text>
                  {!!skip && (
                    <Text style={s.rowWhy} numberOfLines={2} testID="wa-varejo-fila-motivo">{skip}</Text>
                  )}
                  {!skip && !!err && <Text style={s.rowErr} numberOfLines={2}>{err}</Text>}
                </View>
                <View style={[s.badge, { backgroundColor: tone.bg }]}>
                  <Icon name={spec.icon} size={12} color={tone.color} />
                  <Text style={[s.badgeTxt, { color: tone.color }]}>{spec.label}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 },
  headTitle: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 14, fontWeight: "800", color: Colors.ink },
  sub: { fontSize: 12, color: Colors.ink2, marginTop: 8, lineHeight: 17, maxWidth: 620 },
  ghostBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 9, paddingVertical: 7, paddingHorizontal: 11,
  },
  ghostTxt: { fontSize: 12, fontWeight: "700", color: Colors.ink3 },
  list: { gap: 8, marginTop: 12 },
  row: {
    flexDirection: "row", alignItems: "flex-start", gap: 10, flexWrap: "wrap",
    backgroundColor: Colors.bg2, borderRadius: 11, borderWidth: 1, borderColor: Colors.border, padding: 11,
  },
  rowMain: { flex: 1, minWidth: 180, gap: 2 },
  rowTitle: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  rowMeta: { fontSize: 11, color: Colors.ink3 },
  rowWhy: { fontSize: 11.5, color: Colors.amber, marginTop: 3, lineHeight: 16 },
  rowErr: { fontSize: 11.5, color: Colors.red, marginTop: 3, lineHeight: 16 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9 },
  badgeTxt: { fontSize: 10.5, fontWeight: "700" },
  stateBox: { alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 22 },
  stateTxt: { fontSize: 12.5, fontWeight: "600", color: Colors.ink2, textAlign: "center", maxWidth: 420 },
  errTxt: { fontSize: 12, color: Colors.red, textAlign: "center" },
  retryTxt: { fontSize: 12.5, fontWeight: "700", color: Colors.violet3, marginTop: 4 },
} as any);
