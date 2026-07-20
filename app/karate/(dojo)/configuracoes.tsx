// ============================================================
// Aura Karatê (dojô) — Configurações (F1, tela nova; F3a: card Pix)
// Dados cadastrais do dojô vindos do /dojo/me REAL (contexts/KarateDojo)
// em modo READ-ONLY: nome, código FPKT, federação, região, contato,
// filiação. Edições são feitas PELA FEDERAÇÃO — a nota no rodapé deixa
// isso explícito (dado faltante é neutro "—", não erro).
// Datas: parse manual tz-safe (nunca Date UTC de 'YYYY-MM-DD').
//
// F3a: card "Recebimento Pix" (PixConfigCard, alwaysShow) — a mesma
// chave Pix usada nas cobranças de mensalidade em (dojo)/mensalidades.
// ============================================================
import React from "react";
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { useKarateDojo } from "@/contexts/KarateDojo";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { PixConfigCard } from "@/components/karate/dojoMensalidades/PixConfigCard";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function fmtDataLonga(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = String(iso).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(iso);
  const [, y, mo, d] = m;
  const mi = parseInt(mo, 10) - 1;
  if (mi < 0 || mi > 11) return String(iso);
  return `${parseInt(d, 10)} de ${MESES[mi]} de ${y}`;
}

const STATUS_LABEL: Record<string, string> = {
  active: "Ativo",
  pending: "Pendente",
  inactive: "Inativo",
};

export default function DojoConfiguracoes() {
  const { dojoMe, loading, error, reload, dojoName, dojoCode } = useKarateDojo();
  const { federationId } = useKarateFederation();

  // Dado faltante é NEUTRO ("—"), não pendência/erro.
  const rows: { label: string; value: string }[] = [
    { label: "Nome do dojô", value: dojoName },
    { label: "Código FPKT", value: dojoCode ?? "—" },
    { label: "Federação", value: dojoMe?.federation_name ?? "—" },
    { label: "Situação", value: dojoMe?.status ? (STATUS_LABEL[dojoMe.status] ?? dojoMe.status) : "—" },
    { label: "Região", value: dojoMe?.region ?? "—" },
    { label: "CNPJ", value: dojoMe?.cnpj ?? "—" },
    { label: "E-mail", value: dojoMe?.email ?? "—" },
    { label: "Telefone", value: dojoMe?.phone ?? "—" },
    { label: "Modelo de filiação", value: dojoMe?.affiliation_model ?? "—" },
    { label: "Filiado desde", value: fmtDataLonga(dojoMe?.affiliation_since) ?? "—" },
    {
      label: "Dojô fundado em",
      value: dojoMe?.dojo_founded_year != null ? String(dojoMe.dojo_founded_year) : "—",
    },
    {
      label: "Praticantes registrados",
      value: dojoMe?.practitioner_count != null ? String(dojoMe.practitioner_count) : "—",
    },
  ];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View>
        <Text style={styles.eyebrow}>Aura Karatê · {dojoName}</Text>
        <Text style={styles.title}>Configurações</Text>
        <Text style={styles.lead}>Os dados cadastrais do seu dojô junto à federação.</Text>
      </View>

      {loading && (
        <View style={styles.stateBox}>
          <ActivityIndicator size="large" color={KarateColors.primary} />
        </View>
      )}

      {!loading && error && (
        <View style={styles.stateBox}>
          <Icon name="alert-circle-outline" size={28} color={KarateColors.ink3} />
          <Text style={styles.stateTxt}>Não foi possível carregar os dados do dojô.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={reload} accessibilityRole="button">
            <Text style={styles.retryTxt}>Tentar de novo</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Dados do dojô</Text>
          <Text style={styles.cardSub}>Somente leitura — mantidos pela federação</Text>
          <View style={{ marginTop: 6 }}>
            {rows.map((r) => (
              <View key={r.label} style={styles.infoRow}>
                <Text style={styles.infoLabel}>{r.label}</Text>
                <Text style={styles.infoValue} numberOfLines={2}>{r.value}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* F3a: chave Pix de recebimento das mensalidades */}
      {!!federationId && <PixConfigCard federationId={federationId} alwaysShow />}

      {/* Nota: edições via federação */}
      <View style={styles.note}>
        <Icon name="alert-circle-outline" size={16} color={KarateColors.ink3} />
        <Text style={styles.noteTxt}>
          Edições são feitas pela federação. Se algum dado estiver errado ou desatualizado, avise a sua
          federação para corrigir o cadastro — a mudança aparece aqui automaticamente.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content: { padding: 16, gap: 14, paddingBottom: 40 } as ViewStyle,
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, color: KarateColors.primary, textTransform: "uppercase" } as TextStyle,
  title: { fontSize: 24, fontWeight: "800", color: KarateColors.ink, marginTop: 2 } as TextStyle,
  lead: { fontSize: 13, color: KarateColors.ink3, marginTop: 4, lineHeight: 18, maxWidth: 460 } as TextStyle,
  stateBox: { alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 40 } as ViewStyle,
  stateTxt: { fontSize: 14, fontWeight: "600", color: KarateColors.ink2, textAlign: "center" } as TextStyle,
  retryBtn: { marginTop: 6, backgroundColor: KarateColors.primarySoft, borderRadius: KarateRadius.sm, paddingVertical: 8, paddingHorizontal: 16 } as ViewStyle,
  retryTxt: { fontSize: 13, fontWeight: "700", color: KarateColors.primary } as TextStyle,
  card: { backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14 } as ViewStyle,
  cardTitle: { fontSize: 14, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  cardSub: { fontSize: 12, color: KarateColors.ink3, marginTop: 2 } as TextStyle,
  infoRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: KarateColors.border } as ViewStyle,
  infoLabel: { fontSize: 12, color: KarateColors.ink3 } as TextStyle,
  infoValue: { flex: 1, textAlign: "right", fontSize: 13, fontWeight: "600", color: KarateColors.ink } as TextStyle,
  note: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 12 } as ViewStyle,
  noteTxt: { flex: 1, fontSize: 12, color: KarateColors.ink3, lineHeight: 17 } as TextStyle,
});
