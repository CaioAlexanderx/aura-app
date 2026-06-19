// ============================================================
// Verificação Pública de Carteirinha — Aura Karatê (DESIGN-15)
// Rota: /karate/verify/[token]  (PÚBLICA, sem login — aberta via QR)
//
// Fica FORA do grupo autenticado app/karate/(federation)/* — é um segmento
// real irmão do shell, então não passa pelo gate de vertical nem pelo
// KarateShell. O AuthGuard raiz (app/_layout.tsx) tem bypass para
// segments[0]==="karate" && segments[1]==="verify".
//
// Consome GET /public/karate/verify/:token (karateCardApi.verifyCard).
// LGPD: backend já corta CPF/nascimento/histórico; menor vem com nome
// reduzido. Aqui ocultamos a foto e marcamos "dados reduzidos".
// Status (ícone + texto, nunca só cor): valida | vencida | revogada.
// ============================================================
import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, Image, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle, Platform, Linking, TouchableOpacity,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { KarateColors, KarateRadius, KarateFonts } from "@/constants/karateTheme";
import { beltHex } from "@/constants/karateBelts";
import { karateCardApi, CardVerification, VerifyStatus } from "@/services/karateCardApi";
import { useShojiFonts, FpktLogo } from "@/components/karate/shoji";

// ── helpers ──────────────────────────────────────────────
function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function beltLabel(name?: string | null, level?: string | null): string {
  if (!name) return "—";
  const lower = name.toLowerCase();
  const dan = /^(\d+)\s*dan/i.exec(level || "");
  if (dan) return `Faixa ${lower} · ${dan[1]}º dan`;
  const kyu = /^(\d+)\s*kyu/i.exec(level || "");
  if (kyu) return `Faixa ${lower} · ${kyu[1]}º kyu`;
  return `Faixa ${lower}`;
}

type Tone = "ok" | "warn" | "bad";
const STATUS_CFG: Record<VerifyStatus, { label: string; icon: string; tone: Tone }> = {
  valida:   { label: "Registro válido",   icon: "checkmark-circle", tone: "ok" },
  vencida:  { label: "Anuidade vencida",   icon: "time",             tone: "warn" },
  revogada: { label: "Registro revogado",  icon: "alert-circle",     tone: "bad" },
};

const TONE_COLOR: Record<Tone, { fg: string; soft: string }> = {
  ok:   { fg: KarateColors.ok,     soft: KarateColors.okSoft },
  warn: { fg: KarateColors.warn,   soft: KarateColors.warnSoft },
  bad:  { fg: KarateColors.danger, soft: KarateColors.dangerSoft },
};

function statusSub(v: CardVerification): string {
  if (v.status === "revogada") return "Este registro foi revogado pela federação.";
  if (v.status === "vencida")
    return v.validade ? `A anuidade venceu em ${fmtDate(v.validade)}.` : "A anuidade está em atraso.";
  if (v.is_minor) return "Perfil de menor — exibição reduzida.";
  return "Graduação confirmada e em dia.";
}

function situacaoLabel(s: VerifyStatus): { txt: string; color: string } {
  if (s === "revogada") return { txt: "Revogado", color: KarateColors.danger };
  if (s === "vencida")  return { txt: "Vencido",  color: KarateColors.warn };
  return { txt: "Ativo", color: KarateColors.ok };
}

// ── small pieces ─────────────────────────────────────────
function MinorBadge() {
  return (
    <View style={styles.minorBadge} accessibilityLabel="Dados reduzidos por se tratar de menor">
      <Ionicons name="lock-closed" size={12} color={KarateColors.ink3} />
      <Text style={styles.minorBadgeTxt}>Dados reduzidos · menor</Text>
    </View>
  );
}

function Cell({ k, v, mono, valueColor, full }: { k: string; v: string; mono?: boolean; valueColor?: string; full?: boolean }) {
  return (
    <View style={[styles.cell, full && styles.cellFull]}>
      <Text style={styles.cellK}>{k}</Text>
      <Text style={[styles.cellV, mono && styles.mono, valueColor ? { color: valueColor, fontWeight: "700" } : null]}>{v}</Text>
    </View>
  );
}

// ── main ─────────────────────────────────────────────────
export default function VerifyCardScreen() {
  useShojiFonts();
  const { token } = useLocalSearchParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CardVerification | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!token) { setLoading(false); return; }
    setLoading(true);
    setError(false);
    karateCardApi
      .verifyCard(String(token))
      .then((res) => { if (alive) setData(res); })
      .catch(() => { if (alive) setError(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [token]);

  const tokShort = token ? `#${String(token).slice(0, 6).toUpperCase()}` : "#—";

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
      <View style={styles.container}>
        {/* gov header */}
        <View style={styles.gov}>
          {data?.federation_logo ? (
            <Image source={{ uri: data.federation_logo }} style={styles.govLogo} resizeMode="contain" />
          ) : (
            <FpktLogo size={42} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.govTitle}>{data?.federation_name || "FPKT"}</Text>
            <Text style={styles.govSub}>Federação de Karatê Tradicional</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.govK}>VERIFICAÇÃO</Text>
            <Text style={styles.govTok}>{tokShort}</Text>
          </View>
        </View>

        {/* intro */}
        <View style={styles.intro}>
          <View style={styles.eyebrow}><Text style={styles.eyebrowTxt}>Verificação de registro</Text></View>
          <Text style={styles.h1}>Autenticidade do registro federativo</Text>
          <Text style={styles.lead}>Documento público emitido pela federação. Confira a graduação e a situação.</Text>
        </View>

        {/* stage */}
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={KarateColors.primary} />
            <Text style={styles.loadingTxt}>Verificando registro…</Text>
          </View>
        ) : data ? (
          <VerifiedCard v={data} />
        ) : (
          <NotFound token={String(token || "")} isError={error} />
        )}

        {/* aura footer */}
        <TouchableOpacity
          style={styles.auraFooter}
          onPress={() => Linking.openURL("https://www.getaura.com.br")}
          accessibilityRole="link"
        >
          <View style={styles.footSeal}><Text style={styles.footSealK}>空</Text></View>
          <View>
            <Text style={styles.footWm}>Aura · Karatê</Text>
            <Text style={styles.footSub}>Plataforma oficial da FPKT</Text>
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ── verified card (variante "documento") ─────────────────
function VerifiedCard({ v }: { v: CardVerification }) {
  const cfg = STATUS_CFG[v.status];
  const tone = TONE_COLOR[cfg.tone];
  const sit = situacaoLabel(v.status);
  const swatch = beltHex(v.belt_name);
  const revoked = v.status === "revogada";

  return (
    <View style={styles.card}>
      {/* status bar */}
      <View style={[styles.statusBar, { backgroundColor: tone.soft }]}>
        <View style={[styles.ring, { borderColor: tone.fg }]}>
          <Ionicons name={cfg.icon as any} size={24} color={tone.fg} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.stL, { color: tone.fg }]}>{cfg.label}</Text>
          <Text style={styles.stS}>{statusSub(v)}</Text>
        </View>
      </View>

      <View style={styles.body}>
        {/* who */}
        <View style={styles.who}>
          {v.is_minor ? (
            <View style={[styles.avatar, styles.avatarHidden]}>
              <Ionicons name="person" size={30} color={KarateColors.ink3} />
            </View>
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarInitial}>{(v.display_name || "?").trim().charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{v.display_name || "—"}</Text>
            <View style={styles.beltNameRow}>
              <Text style={styles.beltNameTxt}>{beltLabel(v.belt_name, v.belt)}</Text>
              {v.is_minor ? <MinorBadge /> : null}
            </View>
          </View>
        </View>

        {/* belt swatch */}
        <View style={styles.beltBlock}>
          <View
            style={[styles.beltBar, { backgroundColor: swatch, opacity: revoked ? 0.55 : 1 }]}
            accessibilityLabel={`Faixa ${v.belt_name || "—"}`}
          />
          <View style={styles.beltCap}>
            <Text style={styles.beltCapTxt}>Graduação atual</Text>
            <Text style={styles.beltCapTxt}>{v.belt_since ? `desde ${fmtDate(v.belt_since)}` : ""}</Text>
          </View>
        </View>

        {/* data grid */}
        <View style={styles.grid}>
          <View style={styles.gridRow}>
            <Cell k="Validade" v={fmtDate(v.validade)} />
            <Cell k="Situação" v={sit.txt} valueColor={sit.color} />
          </View>
          <Cell k="Dojo / academia" v={v.dojo_name || "—"} full />
          {v.card_number ? <Cell k="Nº de registro FPKT" v={v.card_number} mono full /> : null}
        </View>

        {/* privacy note */}
        <View style={styles.privacy}>
          <Ionicons name="lock-closed" size={14} color={KarateColors.ink4} />
          <Text style={styles.privacyTxt}>
            Por proteção de dados, este documento não exibe CPF, data de nascimento nem histórico de graduações.
          </Text>
        </View>
      </View>

      {/* foot */}
      <View style={styles.cardFoot}>
        <View style={styles.footItem}>
          <Ionicons name="lock-closed" size={13} color={KarateColors.ink3} />
          <Text style={styles.footTxt}>Verificação oficial FPKT</Text>
        </View>
      </View>
    </View>
  );
}

// ── not found / erro ─────────────────────────────────────
function NotFound({ token, isError }: { token: string; isError: boolean }) {
  return (
    <View style={[styles.card, styles.nf]}>
      <View style={styles.nfGlyph}>
        <Ionicons name={isError ? "cloud-offline" : "search"} size={32} color={KarateColors.danger} />
      </View>
      <Text style={styles.nfH2}>{isError ? "Não foi possível verificar" : "Registro não encontrado"}</Text>
      <Text style={styles.nfP}>
        {isError
          ? "Houve um erro ao consultar a verificação. Tente novamente em instantes."
          : "Não localizamos um registro federativo para este código de verificação."}
      </Text>
      {!!token && (
        <View style={styles.tokenBox}>
          <Text style={styles.tokenBoxTxt}>verify/{token}</Text>
        </View>
      )}
      {!isError && (
        <View style={styles.nfList}>
          {[
            { i: "refresh", t: "Confira se o QR Code foi lido por completo." },
            { i: "time", t: "Registros muito antigos podem não estar digitalizados." },
            { i: "chatbubble-ellipses", t: "Em caso de dúvida, fale com a sua federação." },
          ].map((row) => (
            <View key={row.i} style={styles.nfLi}>
              <Ionicons name={row.i as any} size={16} color={KarateColors.ink4} />
              <Text style={styles.nfLiTxt}>{row.t}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page:        { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  pageContent: { alignItems: "center", paddingHorizontal: 16, paddingVertical: 22, paddingBottom: 56 } as ViewStyle,
  container:   { width: "100%", maxWidth: 480 } as ViewStyle,

  gov:      { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,
  govLogo:  { width: 42, height: 42 } as any,
  seal:     { width: 42, height: 42, borderRadius: 21, borderWidth: 1.5, borderColor: KarateColors.primaryLine, backgroundColor: KarateColors.primarySoft, alignItems: "center", justifyContent: "center" } as ViewStyle,
  sealKanji:{ fontFamily: KarateFonts.heading, fontSize: 22, color: KarateColors.primary } as TextStyle,
  govTitle: { fontFamily: KarateFonts.heading, fontSize: 19, fontWeight: "400", color: KarateColors.ink } as TextStyle,
  govSub:   { fontSize: 11, color: KarateColors.ink3, marginTop: 1 } as TextStyle,
  govK:     { fontSize: 9.5, letterSpacing: 1.4, color: KarateColors.ink4, fontFamily: KarateFonts.mono } as TextStyle,
  govTok:   { fontSize: 13, color: KarateColors.ink2, fontFamily: KarateFonts.mono } as TextStyle,

  intro:      { alignItems: "center", paddingVertical: 24 } as ViewStyle,
  eyebrow:    { backgroundColor: KarateColors.primarySoft, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 12, marginBottom: 12 } as ViewStyle,
  eyebrowTxt: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6, color: KarateColors.primary, textTransform: "uppercase" } as TextStyle,
  h1:         { fontFamily: KarateFonts.heading, fontSize: 26, fontWeight: "400", color: KarateColors.ink, textAlign: "center", lineHeight: 30 } as TextStyle,
  lead:       { fontSize: 14, color: KarateColors.ink2, textAlign: "center", marginTop: 8, lineHeight: 20 } as TextStyle,

  loadingBox: { alignItems: "center", gap: 10, paddingVertical: 48 } as ViewStyle,
  loadingTxt: { fontSize: 13, color: KarateColors.ink3 } as TextStyle,

  card: {
    backgroundColor: KarateColors.glass, borderRadius: KarateRadius.lg, borderWidth: 1, borderColor: KarateColors.border,
    overflow: "hidden",
    ...Platform.select({
      web: { boxShadow: "0 10px 30px rgba(28,23,20,0.10)" } as any,
      default: { shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 18, elevation: 4 },
    }),
  } as ViewStyle,

  statusBar: { flexDirection: "row", alignItems: "center", gap: 14, padding: 18 } as ViewStyle,
  ring:      { width: 46, height: 46, borderRadius: 23, backgroundColor: KarateColors.glass, borderWidth: 1, alignItems: "center", justifyContent: "center" } as ViewStyle,
  stL:       { fontSize: 19, fontWeight: "800" } as TextStyle,
  stS:       { fontSize: 12.5, color: KarateColors.ink2, marginTop: 3 } as TextStyle,

  body: { padding: 22, gap: 18 } as ViewStyle,
  who:  { flexDirection: "row", alignItems: "center", gap: 16 } as ViewStyle,
  avatar:       { width: 72, height: 72, borderRadius: KarateRadius.md, backgroundColor: KarateColors.primarySoft, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: KarateColors.primaryLine } as ViewStyle,
  avatarHidden: { backgroundColor: KarateColors.bg2, borderColor: KarateColors.border } as ViewStyle,
  avatarInitial:{ fontSize: 30, fontWeight: "800", color: KarateColors.primary } as TextStyle,
  name:         { fontFamily: KarateFonts.heading, fontSize: 24, fontWeight: "400", color: KarateColors.ink, lineHeight: 28 } as TextStyle,
  beltNameRow:  { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 4 } as ViewStyle,
  beltNameTxt:  { fontSize: 13, color: KarateColors.ink2 } as TextStyle,

  minorBadge:   { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: KarateColors.neutralSoft, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9, borderWidth: 1, borderColor: KarateColors.border } as ViewStyle,
  minorBadgeTxt:{ fontSize: 11, fontWeight: "700", color: KarateColors.ink3 } as TextStyle,

  beltBlock: { gap: 7 } as ViewStyle,
  beltBar:   { height: 26, borderRadius: 6, borderWidth: 1, borderColor: "rgba(0,0,0,0.12)" } as ViewStyle,
  beltCap:   { flexDirection: "row", justifyContent: "space-between" } as ViewStyle,
  beltCapTxt:{ fontSize: 11, color: KarateColors.ink3, fontFamily: KarateFonts.mono } as TextStyle,

  grid:    { borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, overflow: "hidden" } as ViewStyle,
  gridRow: { flexDirection: "row" } as ViewStyle,
  cell:    { flex: 1, padding: 14, backgroundColor: KarateColors.glass, borderTopWidth: 1, borderColor: KarateColors.border } as ViewStyle,
  cellFull:{ borderTopWidth: 1 } as ViewStyle,
  cellK:   { fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase", color: KarateColors.ink3, fontFamily: KarateFonts.mono, marginBottom: 5 } as TextStyle,
  cellV:   { fontSize: 15, color: KarateColors.ink, fontWeight: "500" } as TextStyle,
  mono:    { fontFamily: KarateFonts.mono, fontWeight: "400" } as TextStyle,

  privacy:   { flexDirection: "row", alignItems: "flex-start", gap: 9 } as ViewStyle,
  privacyTxt:{ flex: 1, fontSize: 12, color: KarateColors.ink3, lineHeight: 18 } as TextStyle,

  cardFoot: { flexDirection: "row", justifyContent: "flex-end", padding: 14, borderTopWidth: 1, borderTopColor: KarateColors.border } as ViewStyle,
  footItem: { flexDirection: "row", alignItems: "center", gap: 7 } as ViewStyle,
  footTxt:  { fontSize: 11, color: KarateColors.ink3, fontFamily: KarateFonts.mono } as TextStyle,

  // not found
  nf:       { padding: 36, alignItems: "center" } as ViewStyle,
  nfGlyph:  { width: 72, height: 72, borderRadius: 36, backgroundColor: KarateColors.dangerSoft, alignItems: "center", justifyContent: "center", marginBottom: 20 } as ViewStyle,
  nfH2:     { fontFamily: KarateFonts.heading, fontSize: 24, fontWeight: "400", color: KarateColors.ink, textAlign: "center" } as TextStyle,
  nfP:      { fontSize: 14, color: KarateColors.ink2, textAlign: "center", marginTop: 10, lineHeight: 20 } as TextStyle,
  tokenBox: { marginTop: 20, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.sm, borderWidth: 1, borderColor: KarateColors.border, borderStyle: "dashed", alignSelf: "stretch" } as ViewStyle,
  tokenBoxTxt: { fontSize: 12, color: KarateColors.ink2, fontFamily: KarateFonts.mono, textAlign: "center" } as TextStyle,
  nfList:   { marginTop: 20, gap: 10, alignSelf: "stretch" } as ViewStyle,
  nfLi:     { flexDirection: "row", alignItems: "flex-start", gap: 10 } as ViewStyle,
  nfLiTxt:  { flex: 1, fontSize: 13, color: KarateColors.ink2, lineHeight: 18 } as TextStyle,

  auraFooter: { flexDirection: "row", alignItems: "center", gap: 10, justifyContent: "center", marginTop: 28 } as ViewStyle,
  footSeal:   { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: KarateColors.border, alignItems: "center", justifyContent: "center" } as ViewStyle,
  footSealK:  { fontFamily: KarateFonts.heading, fontSize: 16, color: KarateColors.ink3 } as TextStyle,
  footWm:     { fontSize: 13, fontWeight: "800", color: KarateColors.ink2 } as TextStyle,
  footSub:    { fontSize: 11, color: KarateColors.ink4 } as TextStyle,
});
