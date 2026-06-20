// ============================================================
// Portal Autenticado do Dojô — Aura Karatê (Canal B / link fixo)
//
// Rota: /karate/[slug]/dojo/portal
// Requer o token do link fixo (DojoPortalContext). Escopo DECIDIDO:
// consulta (identidade, praticantes nominal read-only, certificados) +
// pagar anuidade (PIX self-service). As demais funções (inscrição, ranking,
// verificação) o sensei acessa pelas páginas públicas normais.
// ============================================================
import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ActivityIndicator, ScrollView, ViewStyle, TextStyle,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { KarateColors, KarateFonts } from "@/constants/karateTheme";
import { FpktLogo } from "@/components/karate/FpktLogo";
import {
  karateDojoPortalApi, DojoMe, DojoPractitioner, AnnuityStatus,
  AnnuityRow, PixIntent, DojoCertificate,
} from "@/services/karateDojoPortalApi";
import { useDojoPortal } from "./_layout";

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString("pt-BR");
}
function statusColor(s: string): string {
  if (s === "active" || s === "paid" || s === "issued") return KarateColors.ok;
  if (s === "inactive" || s === "overdue" || s === "refused") return KarateColors.danger;
  return KarateColors.warn;
}

export default function DojoPortal() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { token, clearToken } = useDojoPortal();

  const [dojo, setDojo] = useState<DojoMe | null>(null);
  const [annuity, setAnnuity] = useState<AnnuityStatus | null>(null);
  const [practitioners, setPractitioners] = useState<DojoPractitioner[]>([]);
  const [certificates, setCertificates] = useState<DojoCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pix, setPix] = useState<PixIntent | null>(null);
  const [pixLoading, setPixLoading] = useState(false);

  const load = useCallback(async (tk: string) => {
    setLoading(true);
    setError(null);
    try {
      const [me, ann, pracs, certs] = await Promise.all([
        karateDojoPortalApi.getMe(tk),
        karateDojoPortalApi.getAnnuity(tk).catch(() => ({ pending: null, history: [] }) as AnnuityStatus),
        karateDojoPortalApi.getPractitioners(tk).catch(() => ({ practitioners: [], count: 0 })),
        karateDojoPortalApi.getCertificates(tk).catch(() => ({ orders: [], count: 0 })),
      ]);
      setDojo(me);
      setAnnuity(ann);
      setPractitioners(pracs.practitioners);
      setCertificates(certs.orders);
    } catch (e: any) {
      setError(e?.message || "Não foi possível carregar o portal.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token) { router.replace(`/karate/${slug}/dojo` as any); return; }
    load(token);
  }, [token, load, router, slug]);

  async function handlePix(row: AnnuityRow) {
    if (!token) return;
    setPixLoading(true);
    try {
      const intent = await karateDojoPortalApi.createAnnuityPix(token, row.annuity_history_id);
      setPix(intent);
    } catch (e: any) {
      setError(e?.message || "Erro ao gerar PIX.");
    } finally {
      setPixLoading(false);
    }
  }

  function handleLogout() {
    clearToken();
    router.replace(`/karate/${slug}/dojo` as any);
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.topbar}>
        <FpktLogo size={34} />
        <View style={{ flex: 1 }}>
          <Text style={styles.dojoName} numberOfLines={1}>{dojo?.name ?? "Carregando…"}</Text>
          <Text style={styles.dojoSub}>Portal do Dojô · FPKT</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn} accessibilityLabel="Sair">
          <Ionicons name="log-out-outline" size={20} color={KarateColors.ink3} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator color={KarateColors.primary} style={{ marginTop: 48 }} />
        ) : error ? (
          <View style={styles.card}><Text style={styles.errorText}>{error}</Text></View>
        ) : dojo ? (
          <>
            {/* Identidade */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Filiação</Text>
              <Row label="Registro FPKT" value={dojo.fpkt_affiliation_id || "—"} mono />
              <Row label="Situação" value={dojo.status === "active" ? "Ativo" : dojo.status === "pending" ? "Pendente" : "Inativo"} color={statusColor(dojo.status)} />
              {dojo.region && <Row label="Região" value={dojo.region} />}
              {dojo.affiliation_model && <Row label="Modelo" value={dojo.affiliation_model} />}
              <Row label="Filiado desde" value={fmtDate(dojo.affiliation_since)} />
              <Row label="Praticantes" value={String(dojo.practitioner_count)} mono />
            </View>

            {/* Anuidade */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Anuidade</Text>
              {annuity?.pending ? (
                <>
                  <Row label="Período" value={annuity.pending.reference_period} mono />
                  <Row label="Valor" value={fmtBRL(annuity.pending.amount)} mono />
                  <Row label="Vencimento" value={fmtDate(annuity.pending.due_date)} />
                  <Row label="Situação" value="Em aberto" color={KarateColors.warn} />
                  {pix ? (
                    <View style={styles.pixBox}>
                      <Text style={styles.pixLabel}>PIX Copia e Cola</Text>
                      <Text style={styles.pixCode} selectable>{pix.payload}</Text>
                      <Text style={styles.pixHint}>Copie o código e pague no app do seu banco.</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.payBtn, pixLoading && styles.btnDisabled]}
                      onPress={() => handlePix(annuity.pending!)}
                      disabled={pixLoading}
                    >
                      {pixLoading
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.payBtnText}>Gerar PIX da anuidade</Text>}
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                <Text style={styles.emptyText}>Nenhuma anuidade em aberto.</Text>
              )}
              {!!annuity?.history?.length && (
                <View style={styles.histWrap}>
                  {annuity.history.slice(0, 6).map((h) => (
                    <View key={h.annuity_history_id} style={styles.histRow}>
                      <Text style={styles.histPeriod}>{h.reference_period}</Text>
                      <Text style={styles.histAmount}>{fmtBRL(h.amount)}</Text>
                      <Text style={[styles.histStatus, { color: statusColor(h.status) }]}>
                        {h.status === "paid" ? "Pago" : "Em aberto"}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Praticantes (read-only) */}
            <View style={styles.card}>
              <View style={styles.secHead}>
                <Text style={styles.sectionTitle}>Praticantes</Text>
                <Text style={styles.secCount}>{practitioners.length}</Text>
              </View>
              {practitioners.length ? (
                practitioners.slice(0, 50).map((p) => (
                  <View key={p.practitioner_id} style={styles.listRow}>
                    <Text style={styles.listName} numberOfLines={1}>{p.name}</Text>
                    <Text style={styles.listBelt}>{p.belt_name || "—"}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>Nenhum praticante cadastrado pela federação.</Text>
              )}
              <Text style={styles.readonlyNote}>Lista nominal mantida pela federação · somente leitura.</Text>
            </View>

            {/* Certificados */}
            <View style={styles.card}>
              <View style={styles.secHead}>
                <Text style={styles.sectionTitle}>Certificados</Text>
                <Text style={styles.secCount}>{certificates.length}</Text>
              </View>
              {certificates.length ? (
                certificates.slice(0, 30).map((c) => (
                  <View key={c.id} style={styles.listRow}>
                    <Text style={styles.listName} numberOfLines={1}>{c.practitioner_name || c.practitioner_id}</Text>
                    <Text style={styles.listBelt}>{c.belt_name}</Text>
                    <Text style={[styles.histStatus, { color: statusColor(c.status) }]}>{c.status}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>Nenhum pedido de certificado.</Text>
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, mono, color }: { label: string; value: string; mono?: boolean; color?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, mono && { fontFamily: KarateFonts.mono }, color && { color }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  topbar: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: KarateColors.border, backgroundColor: KarateColors.glass } as ViewStyle,
  dojoName: { fontFamily: KarateFonts.heading, fontSize: 17, fontWeight: "400", color: KarateColors.ink } as TextStyle,
  dojoSub: { fontSize: 11, color: KarateColors.ink3, marginTop: 1 } as TextStyle,
  logoutBtn: { padding: 8 } as ViewStyle,
  content: { padding: 16, gap: 16, maxWidth: 720, width: "100%", alignSelf: "center" } as ViewStyle,

  card: { backgroundColor: KarateColors.glass, borderRadius: 14, borderWidth: 1, borderColor: KarateColors.border, padding: 16, gap: 10 } as ViewStyle,
  sectionTitle: { fontFamily: KarateFonts.heading, fontSize: 18, fontWeight: "400", color: KarateColors.ink } as TextStyle,
  secHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" } as ViewStyle,
  secCount: { fontFamily: KarateFonts.mono, fontSize: 13, color: KarateColors.ink3 } as TextStyle,

  row: { flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center" } as ViewStyle,
  rowLabel: { fontSize: 13.5, color: KarateColors.ink3, flex: 1 } as TextStyle,
  rowValue: { fontSize: 14, fontWeight: "600", color: KarateColors.ink, flex: 1.6, textAlign: "right" } as TextStyle,

  payBtn: { backgroundColor: KarateColors.primary, borderRadius: 10, paddingVertical: 13, alignItems: "center", marginTop: 6 } as ViewStyle,
  payBtnText: { color: "#fff", fontWeight: "800", fontSize: 14.5 } as TextStyle,
  btnDisabled: { opacity: 0.6 } as ViewStyle,

  pixBox: { marginTop: 8, gap: 6, borderTopWidth: 1, borderTopColor: KarateColors.border, paddingTop: 12 } as ViewStyle,
  pixLabel: { fontSize: 11, fontFamily: KarateFonts.mono, letterSpacing: 0.6, color: KarateColors.ink3, textTransform: "uppercase" } as TextStyle,
  pixCode: { fontFamily: KarateFonts.mono, fontSize: 12, color: KarateColors.ink2, backgroundColor: KarateColors.bg2, borderWidth: 1, borderColor: KarateColors.border, borderRadius: 8, padding: 11 } as TextStyle,
  pixHint: { fontSize: 12, color: KarateColors.ink3 } as TextStyle,

  histWrap: { borderTopWidth: 1, borderTopColor: KarateColors.border, paddingTop: 10, gap: 7, marginTop: 4 } as ViewStyle,
  histRow: { flexDirection: "row", alignItems: "center", gap: 10 } as ViewStyle,
  histPeriod: { fontFamily: KarateFonts.mono, fontSize: 13, color: KarateColors.ink2, flex: 1 } as TextStyle,
  histAmount: { fontFamily: KarateFonts.mono, fontSize: 13, color: KarateColors.ink, flex: 1, textAlign: "right" } as TextStyle,
  histStatus: { fontSize: 12, fontWeight: "700", flex: 1, textAlign: "right" } as TextStyle,

  listRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: KarateColors.border } as ViewStyle,
  listName: { fontSize: 14, fontWeight: "600", color: KarateColors.ink, flex: 1.6 } as TextStyle,
  listBelt: { fontSize: 12.5, color: KarateColors.ink2, flex: 1, textAlign: "right" } as TextStyle,

  readonlyNote: { fontSize: 11.5, color: KarateColors.ink4, marginTop: 6 } as TextStyle,
  emptyText: { fontSize: 13.5, color: KarateColors.ink3, paddingVertical: 4 } as TextStyle,
  errorText: { color: KarateColors.danger, fontSize: 14, textAlign: "center" } as TextStyle,
});
