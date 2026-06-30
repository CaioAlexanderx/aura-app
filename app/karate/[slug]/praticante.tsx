// ============================================================
// Portal do Praticante — Aura Karatê (DESIGN-16)
// Rota: /karate/[slug]/praticante  (PÚBLICA — login por OTP, sem conta de empresa)
//
// Fica FORA do grupo autenticado (federation). Bypass no AuthGuard raiz:
// segments[0]==="karate" && segments[2]==="praticante".
//
// Fluxo OTP: CPF → código (6 díg.) → portal. Token de portal (JWT type:'portal',
// 30 min) mantido em memória nesta tela (não persistido). Anti-enumeração: a
// resposta do request-otp é sempre genérica.
//
// Portal autenticado: cartão embutido + trajetória (timeline; legacy → "Histórico")
// + exames + certificados + "Inscrever-me no próximo exame" + opt-in público
// (bloqueado p/ menores — LGPD Art. 14).
// ============================================================
import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, ActivityIndicator,
  Switch, Linking, Platform, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius, KarateFonts } from "@/constants/karateTheme";
import { FpktLogo } from "@/components/karate/FpktLogo";
import { beltHex } from "@/constants/karateBelts";
import { Badge } from "@/components/karate/Badge";
import { KarateButton } from "@/components/karate/KarateButton";
import { karatePortalApi, PortalData } from "@/services/karatePortalApi";

const APP_ORIGIN = "https://app.getaura.com.br";

function onlyDigits(s: string) { return (s || "").replace(/\D/g, ""); }
function maskCpf(s: string) {
  const d = onlyDigits(s).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}
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
function copyText(t: string) {
  try {
    if (Platform.OS === "web" && typeof navigator !== "undefined" && (navigator as any).clipboard) {
      (navigator as any).clipboard.writeText(t);
    }
  } catch { /* noop */ }
}

type Stage = "cpf" | "code" | "portal";

export default function PortalPraticanteScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const slugStr = String(slug || "");

  const [stage, setStage] = useState<Stage>("cpf");
  const [cpf, setCpf] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const [portal, setPortal] = useState<PortalData | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [optBusy, setOptBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const sendOtp = async () => {
    if (onlyDigits(cpf).length < 11) { setErr("Informe um CPF válido."); return; }
    setBusy(true); setErr(null);
    try {
      const r = await karatePortalApi.requestOtp(slugStr, cpf);
      setHint(r.channel_hint || null);
      setStage("code");
      setCode("");
    } catch (e: any) {
      setErr(e?.message || "Não foi possível enviar o código.");
    } finally { setBusy(false); }
  };

  const confirmOtp = async () => {
    if (onlyDigits(code).length < 6) { setErr("Digite os 6 dígitos do código."); return; }
    setBusy(true); setErr(null);
    try {
      const r = await karatePortalApi.verifyOtp(slugStr, cpf, onlyDigits(code));
      if (!r.ok || !r.token) { setErr(r.error || "Código inválido ou expirado."); return; }
      setToken(r.token);
      setStage("portal");
    } catch (e: any) {
      setErr(e?.message || "Falha ao validar o código.");
    } finally { setBusy(false); }
  };

  useEffect(() => {
    if (stage !== "portal" || !token) return;
    let alive = true;
    setLoadingPortal(true);
    karatePortalApi.getPortal(token)
      .then((d) => { if (alive) setPortal(d); })
      .catch(() => { if (alive) { setErr("Sessão expirada. Entre novamente."); setStage("cpf"); setToken(null); } })
      .finally(() => { if (alive) setLoadingPortal(false); });
    return () => { alive = false; };
  }, [stage, token]);

  const logout = () => {
    setToken(null); setPortal(null); setCode(""); setErr(null); setHint(null); setStage("cpf");
  };

  const toggleOptIn = async (next: boolean) => {
    if (!token) return;
    setOptBusy(true);
    try {
      const r = await karatePortalApi.setOptIn(token, next);
      setPortal((prev) => prev ? { ...prev, public_portal: { opt_in: r.opt_in, public_token: r.public_token } } : prev);
    } catch (e: any) {
      setErr(e?.code === "MINOR_PUBLIC_BLOCKED"
        ? "Perfil público não é permitido para menores (LGPD)."
        : (e?.message || "Não foi possível atualizar."));
    } finally { setOptBusy(false); }
  };

  const enrollNext = async () => {
    setBusy(true);
    try {
      const r = await karatePortalApi.getEvents(slugStr);
      const exam = r.events.find((e) => e.kind === "exam") || r.events[0];
      if (!exam) { setErr("Nenhum evento aberto para inscrição no momento."); return; }
      router.push(`/karate/${slugStr}/inscricao/${exam.id}` as any);
    } catch {
      setErr("Não foi possível carregar a agenda.");
    } finally { setBusy(false); }
  };

  // ── LOGIN (CPF / código) ──
  if (stage !== "portal") {
    return (
      <ScrollView style={styles.page} contentContainerStyle={styles.authWrap}>
        <View style={styles.authCard}>
          <View style={styles.brand}>
            <FpktLogo size={44} />
            <Text style={styles.brandOrg}>Portal do praticante</Text>
            <Text style={styles.brandSub}>FPKT · Federação de Karatê Tradicional</Text>
          </View>

          {stage === "cpf" ? (
            <>
              <Text style={styles.h1}>Acesse seu portal</Text>
              <Text style={styles.lede}>Informe seu CPF para receber um código de acesso de uso único.</Text>
              <Text style={styles.label}>CPF</Text>
              <TextInput
                style={styles.input}
                inputMode="numeric"
                placeholder="000.000.000-00"
                placeholderTextColor={KarateColors.ink4}
                value={cpf}
                onChangeText={(t) => setCpf(maskCpf(t))}
                maxLength={14}
              />
              {err ? <Notice kind="err" text={err} /> : null}
              <KarateButton label={busy ? "Enviando…" : "Receber código"} onPress={sendOtp} loading={busy} style={{ marginTop: 8 }} />
            </>
          ) : (
            <>
              <Text style={styles.h1}>Confirme o código</Text>
              <Notice kind="info" text={`Se houver um cadastro para este CPF, enviamos um código de 6 dígitos${hint ? ` para ${hint}` : " ao contato registrado"}.`} />
              <TextInput
                style={[styles.input, styles.otpInput]}
                inputMode="numeric"
                placeholder="• • • • • •"
                placeholderTextColor={KarateColors.ink4}
                value={code}
                onChangeText={(t) => setCode(onlyDigits(t).slice(0, 6))}
                maxLength={6}
                autoFocus
              />
              {err ? <Notice kind="err" text={err} /> : null}
              <KarateButton label={busy ? "Entrando…" : "Entrar"} onPress={confirmOtp} loading={busy} style={{ marginTop: 8 }} />
              <View style={styles.authFootRow}>
                <TouchableOpacity onPress={sendOtp} disabled={busy}><Text style={styles.link}>Reenviar código</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => { setStage("cpf"); setErr(null); }}><Text style={styles.linkMuted}>Usar outro CPF</Text></TouchableOpacity>
              </View>
            </>
          )}
        </View>
        <AuraFooter />
      </ScrollView>
    );
  }

  // ── PORTAL ──
  const p = portal?.practitioner;
  const card = portal?.card;
  const minor = !!card?.is_minor;
  const initial = (p?.name || "?").trim().charAt(0).toUpperCase();
  const revoked = card?.status === "revoked";
  const timeline = [...(portal?.belt_history || [])].reverse();
  const optIn = !!portal?.public_portal?.opt_in;
  const publicUrl = portal?.public_portal?.public_token
    ? `${APP_ORIGIN}/karate/${slugStr}/p/${portal.public_portal.public_token}`
    : null;

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ paddingBottom: 56 }}>
      <View style={styles.topbar}>
        <FpktLogo size={28} />
        <Text style={styles.topCtx}>Portal do praticante · FPKT</Text>
        <View style={{ flex: 1 }} />
        <Text style={styles.topName}>{(p?.name || "").split(" ")[0]}</Text>
        <TouchableOpacity onPress={logout} style={styles.outBtn}>
          <Icon name="log-out-outline" size={16} color={KarateColors.ink3} />
          <Text style={styles.outTxt}>Sair</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.portal}>
        {loadingPortal || !portal ? (
          <View style={{ paddingVertical: 60, alignItems: "center" }}><ActivityIndicator color={KarateColors.primary} /></View>
        ) : (
          <>
            <View style={styles.greet}>
              <Text style={styles.eyebrow}>SEU REGISTRO FEDERATIVO</Text>
              <Text style={styles.greetH1}>Olá, {(p?.name || "").split(" ")[0]}</Text>
              <Text style={styles.greetP}>Acompanhe sua graduação, exames e certificados em um só lugar.</Text>
            </View>

            {/* cartão embutido */}
            <View style={styles.embed}>
              <View style={styles.embedTop}>
                <View style={styles.embedAv}><Text style={styles.embedAvTxt}>{initial}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.embedName}>{p?.name}</Text>
                  <Text style={styles.embedBl}>{beltLabel(p?.current_belt_name, p?.current_belt)}</Text>
                </View>
                <Badge status={revoked ? "danger" : "ok"} label={revoked ? "Revogado" : "Registro válido"} />
              </View>
              <View style={styles.beltWrap}>
                <View style={[styles.beltBar, { backgroundColor: beltHex(p?.current_belt_name), opacity: revoked ? 0.55 : 1 }]} />
              </View>
              <View style={styles.embedRow}>
                <View style={styles.embedCell}><Text style={styles.cellK}>Registro FPKT</Text><Text style={[styles.cellV, styles.mono]}>{card?.card_number || p?.karate_registration_number || "—"}</Text></View>
                <View style={[styles.embedCell, styles.embedCellBorder]}><Text style={styles.cellK}>Dojo</Text><Text style={styles.cellV}>{p?.dojo_name || "—"}</Text></View>
              </View>
              {card?.verify_token ? (
                <TouchableOpacity style={styles.pubrow} onPress={() => router.push(`/karate/verify/${card.verify_token}` as any)}>
                  <Text style={styles.pubrowHint}>Documento oficial verificável por QR.</Text>
                  <View style={styles.pubrowLink}>
                    <Icon name="eye-outline" size={14} color={KarateColors.primary} />
                    <Text style={styles.pubrowLinkTxt}>Ver verificação pública</Text>
                  </View>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* trajetória */}
            <View style={styles.sec}>
              <View style={styles.secH}>
                <Icon name="ribbon-outline" size={18} color={KarateColors.ink2} />
                <Text style={styles.secTitle}>Linha do tempo de faixas</Text>
                <Text style={styles.secCnt}>{timeline.length} graduações</Text>
              </View>
              {timeline.length === 0 ? (
                <Text style={styles.emptyTxt}>Sem graduações registradas.</Text>
              ) : timeline.map((t, i) => {
                const legacy = t.belt_schema === "legacy";
                return (
                  <View key={i} style={styles.tlItem}>
                    <View style={[styles.tlDot, { backgroundColor: beltHex(t.belt_name) }]} />
                    <View style={{ flex: 1 }}>
                      <View style={styles.tlTitleRow}>
                        <Text style={styles.tlName}>{beltLabel(t.belt_name, t.belt_level)}</Text>
                        {legacy ? <View style={styles.histBadge}><Text style={styles.histBadgeTxt}>Histórico</Text></View> : null}
                      </View>
                      <Text style={styles.tlDate}>{fmtDate(t.graduated_at)}</Text>
                      <Text style={styles.tlDojo}>{legacy ? "Reg. histórico FPKT" : (p?.dojo_name || "—")}</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* exames */}
            <View style={styles.sideCard}>
              <Text style={styles.sideTitle}>Exames</Text>
              {(portal.exams || []).length === 0 ? (
                <Text style={styles.emptyTxt}>Nenhum exame registrado.</Text>
              ) : portal.exams.map((e, i) => {
                const ok = e.status === "approved";
                return (
                  <View key={i} style={styles.listRow}>
                    <View style={[styles.listIc, { backgroundColor: ok ? KarateColors.okSoft : KarateColors.neutralSoft }]}>
                      <Icon name={ok ? "checkmark" : "time-outline"} size={16} color={ok ? KarateColors.ok : KarateColors.ink3} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.listA}>{e.target_belt_name ? `Exame ${e.target_belt_name}` : "Exame de faixa"}</Text>
                      <Text style={styles.listB}>{statusLabel(e.status)}{e.event_date ? ` · ${fmtDate(e.event_date)}` : ""}</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* certificados */}
            <View style={styles.sideCard}>
              <Text style={styles.sideTitle}>Certificados</Text>
              {(portal.certificates || []).length === 0 ? (
                <Text style={styles.emptyTxt}>Nenhum certificado emitido.</Text>
              ) : portal.certificates.map((c, i) => (
                <View key={i} style={styles.listRow}>
                  <View style={[styles.listIc, { backgroundColor: KarateColors.primarySoft }]}>
                    <Icon name="document-text-outline" size={16} color={KarateColors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listA}>Certificado{c.target_belt ? ` · ${c.target_belt}` : ""}</Text>
                    <Text style={styles.listB}>{c.status}{c.issued_at ? ` · ${fmtDate(c.issued_at)}` : ""}</Text>
                  </View>
                  {c.certificate_url ? (
                    <TouchableOpacity onPress={() => Linking.openURL(c.certificate_url!)}>
                      <Icon name="download-outline" size={18} color={KarateColors.ink3} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}
            </View>

            {/* inscrever-se */}
            <KarateButton label={busy ? "Carregando…" : "Inscrever-me no próximo exame"} onPress={enrollNext} loading={busy} style={{ marginTop: 16 }} />

            {/* opt-in público */}
            <View style={styles.opt}>
              <View style={styles.optHead}>
                <View style={{ flex: 1 }}>
                  <View style={styles.optTitleRow}>
                    <Icon name="globe-outline" size={16} color={KarateColors.ink2} />
                    <Text style={styles.optTitle}>Perfil público</Text>
                  </View>
                  <Text style={styles.optDesc}>
                    {minor
                      ? "Indisponível para praticantes menores de idade. O responsável pode solicitar à federação."
                      : optIn
                        ? "Ativo — qualquer pessoa com o link vê seu perfil reduzido."
                        : "Permite compartilhar um perfil reduzido por link."}
                  </Text>
                </View>
                <Switch
                  value={optIn}
                  onValueChange={toggleOptIn}
                  disabled={minor || optBusy}
                  trackColor={{ true: KarateColors.ok, false: KarateColors.border }}
                />
              </View>
              {minor ? (
                <View style={styles.minorLock}>
                  <Icon name="lock-closed" size={15} color={KarateColors.warn} />
                  <Text style={styles.minorLockTxt}>Bloqueado por proteção de dados de menores (LGPD Art. 14).</Text>
                </View>
              ) : optIn && publicUrl ? (
                <View style={styles.optLink}>
                  <Text style={styles.optUrl} numberOfLines={1} selectable>{publicUrl}</Text>
                  <TouchableOpacity
                    style={styles.copyBtn}
                    onPress={() => { copyText(publicUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                  >
                    <Icon name={copied ? "checkmark" : "copy-outline"} size={15} color={KarateColors.primary} />
                    <Text style={styles.copyBtnTxt}>{copied ? "Copiado" : "Copiar"}</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>

            {err ? <Notice kind="err" text={err} /> : null}
          </>
        )}
        <AuraFooter />
      </View>
    </ScrollView>
  );
}

function statusLabel(s: string): string {
  const m: Record<string, string> = { approved: "Aprovado", rejected: "Reprovado", pending: "Pendente", enrolled: "Inscrito" };
  return m[s] || s;
}

function Notice({ kind, text }: { kind: "info" | "err"; text: string }) {
  const isErr = kind === "err";
  return (
    <View style={[styles.notice, { backgroundColor: isErr ? KarateColors.dangerSoft : KarateColors.bg2, borderColor: isErr ? KarateColors.danger : KarateColors.border }]}>
      <Icon name={isErr ? "alert-circle" : "information-circle-outline"} size={16} color={isErr ? KarateColors.danger : KarateColors.ink3} />
      <Text style={[styles.noticeTxt, isErr ? { color: KarateColors.danger } : null]}>{text}</Text>
    </View>
  );
}

function AuraFooter() {
  return (
    <TouchableOpacity style={styles.auraFooter} onPress={() => Linking.openURL("https://www.getaura.com.br")} accessibilityRole="link">
      <View style={styles.footSeal}><Text style={styles.footSealK}>空</Text></View>
      <View>
        <Text style={styles.footWm}>Aura · Karatê</Text>
        <Text style={styles.footSub}>Plataforma oficial da FPKT</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,

  // auth
  authWrap: { alignItems: "center", justifyContent: "center", padding: 24, paddingTop: 48, minHeight: "100%" } as ViewStyle,
  authCard: { width: "100%", maxWidth: 420, backgroundColor: KarateColors.glass, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.lg, padding: 28, ...cardShadow() } as ViewStyle,
  brand: { alignItems: "center", gap: 6, marginBottom: 18 } as ViewStyle,
  seal: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: KarateColors.primaryLine, backgroundColor: KarateColors.primarySoft, alignItems: "center", justifyContent: "center" } as ViewStyle,
  sealK: { fontFamily: KarateFonts.heading, fontSize: 22, color: KarateColors.primary } as TextStyle,
  brandOrg: { fontFamily: KarateFonts.heading, fontSize: 19, fontWeight: "400", color: KarateColors.ink, marginTop: 6 } as TextStyle,
  brandSub: { fontSize: 11, color: KarateColors.ink3 } as TextStyle,
  h1: { fontFamily: KarateFonts.heading, fontSize: 26, fontWeight: "400", color: KarateColors.ink, textAlign: "center" } as TextStyle,
  lede: { fontSize: 14, color: KarateColors.ink2, textAlign: "center", marginTop: 8, marginBottom: 18, lineHeight: 20 } as TextStyle,
  label: { fontSize: 12, fontWeight: "700", color: KarateColors.ink2, marginBottom: 6 } as TextStyle,
  input: { borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.md, paddingVertical: 12, paddingHorizontal: 14, fontSize: 15, color: KarateColors.ink, backgroundColor: KarateColors.glass, fontFamily: KarateFonts.mono } as TextStyle,
  otpInput: { textAlign: "center", letterSpacing: 8, fontSize: 22 } as TextStyle,
  authFootRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 16 } as ViewStyle,
  link: { fontSize: 13, fontWeight: "700", color: KarateColors.primary } as TextStyle,
  linkMuted: { fontSize: 13, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,

  notice: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 12, borderRadius: KarateRadius.md, borderWidth: 1, marginTop: 14 } as ViewStyle,
  noticeTxt: { flex: 1, fontSize: 13, color: KarateColors.ink2, lineHeight: 18 } as TextStyle,

  // topbar
  topbar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: KarateColors.border, backgroundColor: KarateColors.glass } as ViewStyle,
  topCtx: { fontSize: 11, color: KarateColors.ink3, paddingLeft: 10, borderLeftWidth: 1, borderLeftColor: KarateColors.border } as TextStyle,
  topName: { fontSize: 12.5, fontWeight: "700", color: KarateColors.ink2 } as TextStyle,
  outBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 6, paddingHorizontal: 8, borderRadius: KarateRadius.sm } as ViewStyle,
  outTxt: { fontSize: 12, color: KarateColors.ink3 } as TextStyle,

  portal: { width: "100%", maxWidth: 880, alignSelf: "center", paddingHorizontal: 20, paddingTop: 24 } as ViewStyle,
  greet: { marginBottom: 20 } as ViewStyle,
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, color: KarateColors.primary } as TextStyle,
  greetH1: { fontFamily: KarateFonts.heading, fontSize: 32, fontWeight: "400", color: KarateColors.ink, marginTop: 8 } as TextStyle,
  greetP: { fontSize: 14, color: KarateColors.ink2, marginTop: 5 } as TextStyle,

  embed: { backgroundColor: KarateColors.glass, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.lg, overflow: "hidden", ...cardShadow() } as ViewStyle,
  embedTop: { flexDirection: "row", alignItems: "center", gap: 14, padding: 18 } as ViewStyle,
  embedAv: { width: 56, height: 56, borderRadius: KarateRadius.md, backgroundColor: KarateColors.primarySoft, borderWidth: 1, borderColor: KarateColors.primaryLine, alignItems: "center", justifyContent: "center" } as ViewStyle,
  embedAvTxt: { fontSize: 24, fontWeight: "800", color: KarateColors.primary } as TextStyle,
  embedName: { fontFamily: KarateFonts.heading, fontSize: 22, fontWeight: "400", color: KarateColors.ink } as TextStyle,
  embedBl: { fontSize: 13, color: KarateColors.ink2, marginTop: 3 } as TextStyle,
  beltWrap: { paddingHorizontal: 18, paddingBottom: 14 } as ViewStyle,
  beltBar: { height: 22, borderRadius: 6, borderWidth: 1, borderColor: "rgba(0,0,0,0.12)" } as ViewStyle,
  embedRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: KarateColors.border } as ViewStyle,
  embedCell: { flex: 1, padding: 13 } as ViewStyle,
  embedCellBorder: { borderLeftWidth: 1, borderLeftColor: KarateColors.border } as ViewStyle,
  cellK: { fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", color: KarateColors.ink3, fontFamily: KarateFonts.mono } as TextStyle,
  cellV: { fontSize: 14, fontWeight: "600", color: KarateColors.ink, marginTop: 3 } as TextStyle,
  mono: { fontFamily: KarateFonts.mono, fontWeight: "400" } as TextStyle,
  pubrow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, padding: 13, borderTopWidth: 1, borderTopColor: KarateColors.border } as ViewStyle,
  pubrowHint: { flex: 1, fontSize: 12, color: KarateColors.ink3 } as TextStyle,
  pubrowLink: { flexDirection: "row", alignItems: "center", gap: 6 } as ViewStyle,
  pubrowLinkTxt: { fontSize: 12.5, fontWeight: "700", color: KarateColors.primary } as TextStyle,

  sec: { marginTop: 22 } as ViewStyle,
  secH: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 12 } as ViewStyle,
  secTitle: { fontFamily: KarateFonts.heading, fontSize: 19, fontWeight: "400", color: KarateColors.ink } as TextStyle,
  secCnt: { marginLeft: "auto", fontSize: 12, color: KarateColors.ink3, fontFamily: KarateFonts.mono } as TextStyle,
  emptyTxt: { fontSize: 13, color: KarateColors.ink3, paddingVertical: 8 } as TextStyle,

  tlItem: { flexDirection: "row", gap: 14, paddingBottom: 18 } as ViewStyle,
  tlDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: KarateColors.bg, marginTop: 2 } as ViewStyle,
  tlTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" } as ViewStyle,
  tlName: { fontSize: 14.5, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  histBadge: { backgroundColor: KarateColors.neutralSoft, borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8, borderWidth: 1, borderColor: KarateColors.border } as ViewStyle,
  histBadgeTxt: { fontSize: 10, fontWeight: "700", color: KarateColors.ink3 } as TextStyle,
  tlDate: { fontSize: 12.5, color: KarateColors.ink3, fontFamily: KarateFonts.mono, marginTop: 2 } as TextStyle,
  tlDojo: { fontSize: 12.5, color: KarateColors.ink2, marginTop: 1 } as TextStyle,

  sideCard: { backgroundColor: KarateColors.glass, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.md, padding: 16, marginTop: 16 } as ViewStyle,
  sideTitle: { fontFamily: KarateFonts.heading, fontSize: 17, fontWeight: "400", color: KarateColors.ink, marginBottom: 8 } as TextStyle,
  listRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: KarateColors.border } as ViewStyle,
  listIc: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" } as ViewStyle,
  listA: { fontSize: 13.5, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  listB: { fontSize: 12, color: KarateColors.ink3, marginTop: 1 } as TextStyle,

  opt: { backgroundColor: KarateColors.glass, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.md, padding: 16, marginTop: 16 } as ViewStyle,
  optHead: { flexDirection: "row", alignItems: "flex-start", gap: 12 } as ViewStyle,
  optTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  optTitle: { fontFamily: KarateFonts.heading, fontSize: 15, fontWeight: "400", color: KarateColors.ink } as TextStyle,
  optDesc: { fontSize: 12.5, color: KarateColors.ink3, lineHeight: 18, marginTop: 3 } as TextStyle,
  minorLock: { flexDirection: "row", alignItems: "flex-start", gap: 9, backgroundColor: KarateColors.warnSoft, borderWidth: 1, borderColor: KarateColors.warn, borderRadius: KarateRadius.sm, padding: 11, marginTop: 12 } as ViewStyle,
  minorLockTxt: { flex: 1, fontSize: 12.5, color: KarateColors.warn, lineHeight: 18 } as TextStyle,
  optLink: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: KarateColors.border } as ViewStyle,
  optUrl: { flex: 1, fontFamily: KarateFonts.mono, fontSize: 12, color: KarateColors.ink2, backgroundColor: KarateColors.bg2, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.sm, paddingVertical: 9, paddingHorizontal: 11 } as TextStyle,
  copyBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 9, paddingHorizontal: 12, borderWidth: 1, borderColor: KarateColors.primaryLine, borderRadius: KarateRadius.sm } as ViewStyle,
  copyBtnTxt: { fontSize: 12.5, fontWeight: "700", color: KarateColors.primary } as TextStyle,

  auraFooter: { flexDirection: "row", alignItems: "center", gap: 10, justifyContent: "center", marginTop: 28, marginBottom: 12 } as ViewStyle,
  footSeal: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: KarateColors.border, alignItems: "center", justifyContent: "center" } as ViewStyle,
  footSealK: { fontFamily: KarateFonts.heading, fontSize: 16, color: KarateColors.ink3 } as TextStyle,
  footWm: { fontFamily: KarateFonts.heading, fontSize: 14, color: KarateColors.ink2 } as TextStyle,
  footSub: { fontSize: 11, color: KarateColors.ink4 } as TextStyle,
});

function cardShadow() {
  return Platform.select({
    web: { boxShadow: "0 10px 30px rgba(28,23,20,0.08)" } as any,
    default: { shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.10, shadowRadius: 16, elevation: 3 },
  });
}
