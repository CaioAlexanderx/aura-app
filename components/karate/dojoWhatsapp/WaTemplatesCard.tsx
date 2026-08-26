// ============================================================
// WaTemplatesCard — templates do WhatsApp Cloud API (Onda 5b)
//
// Lista os templates da company com o status que a Meta devolveu via
// webhook (APPROVED verde / REJECTED vermelho / demais neutros) e um
// botão "Sincronizar da Meta" (POST /templates/sync).
//
// Card PRESENTACIONAL: quem carrega a lista é a WhatsAppCloudSection —
// o bloco de envio de teste precisa dos mesmos templates aprovados, e
// duas buscas para a mesma lista seria desperdício. Só o estado do
// botão de sincronizar mora aqui.
//
// Sem WABA/token o backend responde 409 NAO_CONECTADO — aqui isso NÃO é
// erro cru: vira estado vazio com orientação. Mesmo racional do
// SCHEMA_PENDING nas telas de mensalidades.
// ============================================================
import React, { useState } from "react";
import {
  View, Text, ActivityIndicator, TouchableOpacity, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { waApi, WaTemplate } from "@/services/waApi";
import { fmtWhenBR, mapWaError, waCategoryLabel, waTemplateStatusView } from "./helpers";

interface Props {
  companyId: string;
  templates: WaTemplate[];
  loading: boolean;
  /** true = 409 NAO_CONECTADO (falta WABA/token) — estado vazio, não erro. */
  notConnected: boolean;
  error: string | null;
  onReload: () => void;
}

export function WaTemplatesCard({ companyId, templates, loading, notConnected, error, onReload }: Props) {
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncErr, setSyncErr] = useState<string | null>(null);
  // Token vencido não é falha do sync: é aviso de reconexão (âmbar, não vermelho).
  const [syncErrExpired, setSyncErrExpired] = useState(false);

  async function sync() {
    setSyncing(true);
    setSyncMsg(null);
    setSyncErr(null);
    setSyncErrExpired(false);
    try {
      const res = await waApi.syncTemplates(companyId);
      const n = res?.synced ?? 0;
      setSyncMsg(n === 1 ? "1 template sincronizado da Meta." : `${n} templates sincronizados da Meta.`);
      onReload();
    } catch (e: any) {
      // Só `message` (pt-BR do backend) vai pra tela — `detail` é o inglês da Meta.
      const mapped = mapWaError(e);
      setSyncErr(mapped.message);
      setSyncErrExpired(mapped.code === "TOKEN_EXPIRADO");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.headTitle}>
          <Icon name="file_text" size={16} color={KarateColors.primary} />
          <Text style={styles.cardTitle}>Templates</Text>
        </View>
        <KarateButton
          label={syncing ? "Sincronizando…" : "Sincronizar da Meta"}
          variant="secondary"
          size="sm"
          loading={syncing}
          onPress={sync}
        />
      </View>
      <Text style={styles.cardSub}>
        Só dá para iniciar uma conversa no WhatsApp com um template aprovado pela Meta. A aprovação
        acontece do lado da Meta — aqui você acompanha o status e traz as atualizações.
      </Text>

      {!!syncErr && (
        <Text style={[styles.errTxt, syncErrExpired && styles.warnTxt]}>{syncErr}</Text>
      )}
      {!syncErr && !!syncMsg && (
        <View style={styles.okBox}>
          <Icon name="check_circle" size={14} color={KarateColors.ok} />
          <Text style={styles.okTxt}>{syncMsg}</Text>
        </View>
      )}

      {loading && (
        <View style={styles.stateBox}>
          <ActivityIndicator size="small" color={KarateColors.primary} />
        </View>
      )}

      {!loading && notConnected && (
        <View style={styles.stateBox}>
          <Icon name="link" size={20} color={KarateColors.ink3} />
          <Text style={styles.stateTxt}>Conecte o WhatsApp do dojô para ver os templates.</Text>
          <Text style={styles.stateSub}>
            É preciso ter um número e um token da Cloud API cadastrados para a Meta devolver a lista.
          </Text>
        </View>
      )}

      {!loading && !notConnected && !!error && (
        <View style={styles.stateBox}>
          <Text style={styles.errTxt}>{error}</Text>
          <TouchableOpacity onPress={onReload} accessibilityRole="button">
            <Text style={styles.retryTxt}>Tentar de novo</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !notConnected && !error && templates.length === 0 && (
        <View style={styles.stateBox}>
          <Icon name="file_text" size={20} color={KarateColors.ink3} />
          <Text style={styles.stateTxt}>Nenhum template cadastrado ainda.</Text>
          <Text style={styles.stateSub}>
            Crie o template no Gerenciador da Meta e depois toque em Sincronizar da Meta.
          </Text>
        </View>
      )}

      {!loading && !notConnected && !error && templates.length > 0 && (
        <View style={styles.list}>
          {templates.map((t) => {
            const view = waTemplateStatusView(t.status);
            return (
              <View key={`${t.name}:${t.language}`} style={styles.row}>
                <View style={styles.rowMain}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{t.name}</Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {waCategoryLabel(t.category)} · {t.language || "—"}
                    {t.last_status_at ? ` · atualizado ${fmtWhenBR(t.last_status_at)}` : ""}
                  </Text>
                  {!!t.body_preview && (
                    <Text style={styles.rowPreview} numberOfLines={2}>{t.body_preview}</Text>
                  )}
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
  list: { gap: 8, marginTop: 12 } as ViewStyle,
  row: {
    flexDirection: "row", alignItems: "flex-start", gap: 10, flexWrap: "wrap",
    backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.sm,
    borderWidth: 1, borderColor: KarateColors.border, padding: 10,
  } as ViewStyle,
  rowMain: { flex: 1, minWidth: 180, gap: 2 } as ViewStyle,
  rowTitle: { fontSize: 13, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  rowMeta: { fontSize: 11, color: KarateColors.ink3 } as TextStyle,
  rowPreview: { fontSize: 11.5, color: KarateColors.ink2, marginTop: 3, lineHeight: 16 } as TextStyle,
  badge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8 } as ViewStyle,
  badgeTxt: { fontSize: 10.5, fontWeight: "700" } as TextStyle,
  stateBox: { alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 20 } as ViewStyle,
  stateTxt: { fontSize: 12.5, fontWeight: "600", color: KarateColors.ink2, textAlign: "center" } as TextStyle,
  stateSub: { fontSize: 11.5, color: KarateColors.ink3, textAlign: "center", maxWidth: 400, lineHeight: 16 } as TextStyle,
  errTxt: { fontSize: 12, color: KarateColors.danger, marginTop: 8, textAlign: "center" } as TextStyle,
  warnTxt: { color: KarateColors.warn, fontWeight: "600" } as TextStyle,
  retryTxt: { fontSize: 12.5, fontWeight: "700", color: KarateColors.primary, marginTop: 4 } as TextStyle,
  okBox: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, backgroundColor: KarateColors.okSoft, borderRadius: KarateRadius.sm, paddingVertical: 8, paddingHorizontal: 10, alignSelf: "flex-start" } as ViewStyle,
  okTxt: { fontSize: 12, fontWeight: "700", color: KarateColors.ok } as TextStyle,
});
