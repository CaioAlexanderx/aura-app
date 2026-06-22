// ============================================================
// Inscrição Pública em Evento — Aura Karatê (DESIGN-17)
// Rota: /karate/[slug]/inscricao/[eventId]  (PÚBLICA, sem login)
//
// Wizard: evento → cpf → confirma → pix (sem etapa de faixa pretendida —
// decisão Caio 08/06; a banca define depois). Bypass AuthGuard:
// segments[0]==="karate" && segments[2]==="inscricao".
//
// Erros: praticante não localizado (404), já inscrito (409), encerrado (409),
// competição (501 — fluxo não habilitado, inscrição via academia).
// ============================================================
import React, { useEffect, useState } from "react";
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, Linking,
  StyleSheet, ViewStyle, TextStyle, Platform,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { KarateColors, KarateRadius, KarateFonts } from "@/constants/karateTheme";
import { FpktLogo } from "@/components/karate/FpktLogo";
import { beltHex } from "@/constants/karateBelts";
import { KarateButton } from "@/components/karate/KarateButton";
import { PixQRCode } from "@/components/karate/PixQRCode";
import { karatePortalApi, PublicEvent, LookupResult, InscricaoResult } from "@/services/karatePortalApi";

function onlyDigits(s: string) { return (s || "").replace(/\D/g, ""); }
function maskCpf(s: string) {
  const d = onlyDigits(s).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}
function fmtDate(iso?: string | null): string {
  if (!iso) return "a definir";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtBRL(v?: number | null): string {
  if (v == null) return "—";
  return `R$ ${Number(v).toFixed(2).replace(".", ",")}`;
}
function beltLabel(name?: string | null, level?: string | null): string {
  if (!name) return "—";
  const lower = name.toLowerCase();
  const dan = /^(\d+)\s*dan/i.exec(level || "");
  if (dan) return `Faixa ${lower} · ${dan[1]}º dan`;
  return `Faixa ${lower}`;
}
function copyText(t: string) {
  try {
    if (Platform.OS === "web" && typeof navigator !== "undefined" && (navigator as any).clipboard) {
      (navigator as any).clipboard.writeText(t);
    }
  } catch { /* noop */ }
}

type Step = "evento" | "cpf" | "confirma" | "pix";
type Err = "nao" | "ja" | "fim" | "comp" | "evento" | "generic" | null;
const STEP_IDX: Record<Step, number> = { evento: 0, cpf: 1, confirma: 2, pix: 3 };

export default function InscricaoScreen() {
  const { slug, eventId } = useLocalSearchParams<{ slug: string; eventId: string }>();
  const slugStr = String(slug || "");
  const eventIdStr = String(eventId || "");

  const [loadingEvent, setLoadingEvent] = useState(true);
  const [event, setEvent] = useState<PublicEvent["event"] | null>(null);
  const [fedName, setFedName] = useState("FPKT");

  const [step, setStep] = useState<Step>("evento");
  const [err, setErr] = useState<Err>(null);
  const [errMsg, setErrMsg] = useState<string>("");
  const [cpf, setCpf] = useState("");
  const [busy, setBusy] = useState(false);
  const [pract, setPract] = useState<LookupResult["practitioner"] | null>(null);
  const [payment, setPayment] = useState<InscricaoResult["payment"]>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    karatePortalApi.getEvent(slugStr, eventIdStr)
      .then((d) => { if (alive) { setEvent(d.event); setFedName(d.federation?.name || "FPKT"); } })
      .catch((e: any) => {
        if (!alive) return;
        if (e?.status === 409) { setErr("fim"); }
        else { setErr("evento"); setErrMsg(e?.message || "Evento não encontrado."); }
      })
      .finally(() => { if (alive) setLoadingEvent(false); });
    return () => { alive = false; };
  }, [slugStr, eventIdStr]);

  const handleErr = (e: any) => {
    const code = e?.code;
    if (e?.status === 501) setErr("comp");
    else if (code === "PRACTITIONER_NOT_FOUND" || e?.status === 404) setErr("nao");
    else if (code === "CONFLICT" || (e?.status === 409 && code !== "CLOSED")) setErr("ja");
    else if (code === "CLOSED" || e?.status === 409) setErr("fim");
    else { setErr("generic"); setErrMsg(e?.message || "Não foi possível continuar."); }
  };

  const doLookup = async () => {
    if (onlyDigits(cpf).length < 11) { setErr("generic"); setErrMsg("Informe um CPF válido."); return; }
    setBusy(true); setErr(null);
    try {
      const r = await karatePortalApi.lookup(slugStr, eventIdStr, cpf);
      if (r.already_enrolled) { setErr("ja"); return; }
      setPract(r.practitioner);
      setStep("confirma");
    } catch (e) { handleErr(e); }
    finally { setBusy(false); }
  };

  const doSubmit = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await karatePortalApi.submitInscricao(slugStr, eventIdStr, cpf);
      setPayment(r.payment);
      setStep("pix");
    } catch (e) { handleErr(e); }
    finally { setBusy(false); }
  };

  const resetToEvent = () => { setErr(null); setStep("evento"); setCpf(""); setPract(null); };

  // ── progress ──
  const Progress = () => (
    <View style={styles.prog}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={[styles.progSeg, i <= STEP_IDX[step] && styles.progSegOn]} />
      ))}
    </View>
  );

  // ── error block ──
  if (err && err !== "generic") {
    const cfg = {
      nao:    { tone: "bad",  icon: "search",       title: "Praticante não localizado", msg: "Não encontramos um cadastro federativo para este CPF. Verifique os números ou cadastre-se na sua federação antes de se inscrever." },
      ja:     { tone: "warn", icon: "checkmark-circle", title: "Você já está inscrito", msg: "Encontramos uma inscrição para este CPF neste evento. Não é necessário se inscrever novamente." },
      fim:    { tone: "warn", icon: "time",         title: "Inscrições encerradas", msg: "O prazo de inscrição para este evento terminou. Acompanhe a agenda para os próximos eventos." },
      comp:   { tone: "bad",  icon: "alert-circle", title: "Inscrição de competição", msg: "Competições não são inscritas por este fluxo. A inscrição é feita pela sua academia junto à federação, com chaveamento por categoria e peso." },
      evento: { tone: "bad",  icon: "search",       title: "Evento não encontrado", msg: errMsg || "Este evento não está disponível para inscrição online." },
    }[err]!;
    const toneColor = cfg.tone === "bad" ? KarateColors.danger : KarateColors.warn;
    const toneSoft = cfg.tone === "bad" ? KarateColors.dangerSoft : KarateColors.warnSoft;
    return (
      <ScrollView style={styles.page} contentContainerStyle={styles.wrap}>
        <Card fed={fedName}>
          <View style={styles.errBlock}>
            <View style={[styles.errGlyph, { backgroundColor: toneSoft }]}>
              <Ionicons name={cfg.icon as any} size={30} color={toneColor} />
            </View>
            <Text style={styles.errTitle}>{cfg.title}</Text>
            <Text style={styles.errMsg}>{cfg.msg}</Text>
            {err === "comp" ? <Text style={styles.code501}>erro 501 · fluxo não habilitado</Text> : null}
          </View>
          <View style={styles.foot}>
            {err === "nao" ? (
              <>
                <KarateButton label="Corrigir CPF" variant="secondary" onPress={() => { setErr(null); setStep("cpf"); }} style={{ flex: 1 }} />
                <KarateButton label="Falar com a federação" onPress={() => Linking.openURL("https://www.getaura.com.br")} style={{ flex: 2 }} />
              </>
            ) : (
              <KarateButton label="Fechar" variant="secondary" onPress={resetToEvent} style={{ flex: 1 }} />
            )}
          </View>
        </Card>
        <AuraFooter />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.wrap}>
      <Card fed={fedName}>
        {step !== "pix" ? <Progress /> : null}

        <View style={styles.body}>
          {loadingEvent ? (
            <View style={{ paddingVertical: 40, alignItems: "center" }}><ActivityIndicator color={KarateColors.primary} /></View>
          ) : step === "evento" ? (
            <>
              <Text style={styles.stepLabel}>ETAPA 1 DE 3 · EVENTO</Text>
              <Text style={styles.h2}>{event?.name || "Inscrição em evento"}</Text>
              <Text style={styles.sub}>Confira os dados antes de iniciar sua inscrição.</Text>
              <View style={styles.evSum}>
                <SumRow icon="calendar-outline" k="Data" v={fmtDate(event?.event_date)} />
                <SumRow icon="location-outline" k="Local" v={event?.location || "a definir"} />
                {event?.capacity ? (
                  <SumRow icon="people-outline" k="Vagas" v={`${event.capacity.filled}${event.capacity.max ? ` de ${event.capacity.max}` : ""} preenchidas`} />
                ) : null}
                <SumRow icon="pricetag-outline" k="Inscrição" v={fmtBRL(event?.fee_amount)} price />
              </View>
            </>
          ) : step === "cpf" ? (
            <>
              <Text style={styles.stepLabel}>ETAPA 2 DE 3 · IDENTIFICAÇÃO</Text>
              <Text style={styles.h2}>Informe seu CPF</Text>
              <Text style={styles.sub}>Usamos seu CPF apenas para localizar seu registro na federação.</Text>
              <Text style={styles.label}>CPF do praticante</Text>
              <TextInput
                style={styles.input}
                inputMode="numeric"
                placeholder="000.000.000-00"
                placeholderTextColor={KarateColors.ink4}
                value={cpf}
                onChangeText={(t) => setCpf(maskCpf(t))}
                maxLength={14}
                autoFocus
              />
              <Text style={styles.hint}>Seu CPF não fica visível em nenhuma página pública.</Text>
              {err === "generic" ? <Text style={styles.inlineErr}>{errMsg}</Text> : null}
            </>
          ) : step === "confirma" ? (
            <>
              <Text style={styles.stepLabel}>ETAPA 3 DE 3 · CONFIRMAÇÃO</Text>
              <Text style={styles.h2}>Confirme sua inscrição</Text>
              <Text style={styles.sub}>Revise os dados. O pagamento é feito via PIX na próxima etapa.</Text>
              <View style={styles.conf}>
                <ConfRow k="Praticante" v={pract?.name || "—"} />
                <View style={styles.confRow}>
                  <Text style={styles.confK}>Faixa atual</Text>
                  <View style={styles.beltVal}>
                    <View style={[styles.beltSw, { backgroundColor: beltHex(pract?.current_belt_name) }]} />
                    <Text style={styles.confV}>{beltLabel(pract?.current_belt_name, pract?.current_belt)}</Text>
                  </View>
                </View>
                <ConfRow k="Evento" v={event?.name || "—"} />
                <ConfRow k="Data" v={fmtDate(event?.event_date)} />
                <View style={[styles.confRow, styles.confTotal]}>
                  <Text style={styles.confK}>Total</Text>
                  <Text style={styles.confTotalV}>{fmtBRL(event?.fee_amount)}</Text>
                </View>
              </View>
            </>
          ) : (
            // PIX / sucesso
            <View style={{ alignItems: "center" }}>
              {payment?.payload ? (
                <>
                  <Text style={styles.stepLabel}>PAGAMENTO · PIX</Text>
                  <Text style={styles.h2}>Escaneie para pagar</Text>
                  <PixQRCode payload={payment.payload} qrImage={payment.qr_image || undefined} size={196} style={{ marginTop: 14 }} />
                  <Text style={styles.amt}>{fmtBRL(payment.amount ?? event?.fee_amount)}</Text>
                  <View style={styles.expire}>
                    <Ionicons name="time-outline" size={14} color={KarateColors.warn} />
                    <Text style={styles.expireTxt}>Aguardando confirmação do pagamento</Text>
                  </View>
                  <View style={styles.copyBox}>
                    <Text style={styles.copyLbl}>PIX COPIA E COLA</Text>
                    <View style={styles.copyRow}>
                      <Text style={styles.copyCode} numberOfLines={1} selectable>{payment.payload}</Text>
                      <TouchableOpacity style={styles.copyBtn} onPress={() => { copyText(payment.payload!); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
                        <Ionicons name={copied ? "checkmark" : "copy-outline"} size={16} color={KarateColors.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              ) : (
                <>
                  <View style={[styles.errGlyph, { backgroundColor: KarateColors.okSoft }]}>
                    <Ionicons name="checkmark-circle" size={30} color={KarateColors.ok} />
                  </View>
                  <Text style={styles.h2}>Inscrição registrada</Text>
                  <Text style={styles.sub}>
                    {payment?.error
                      ? payment.error
                      : "Sua inscrição foi registrada. A federação confirmará e, se houver taxa, enviará as instruções de pagamento."}
                  </Text>
                </>
              )}
            </View>
          )}
        </View>

        {/* footer actions */}
        {!loadingEvent && (
          <View style={styles.foot}>
            {step === "evento" ? (
              <KarateButton label="Iniciar inscrição" onPress={() => { setErr(null); setStep("cpf"); }} style={{ flex: 1 }} />
            ) : step === "cpf" ? (
              <>
                <KarateButton label="Voltar" variant="secondary" onPress={() => setStep("evento")} style={{ flex: 1 }} />
                <KarateButton label={busy ? "Localizando…" : "Continuar"} onPress={doLookup} loading={busy} style={{ flex: 2 }} />
              </>
            ) : step === "confirma" ? (
              <>
                <KarateButton label="Voltar" variant="secondary" onPress={() => setStep("cpf")} style={{ flex: 1 }} />
                <KarateButton label={busy ? "Gerando…" : "Confirmar e gerar PIX"} onPress={doSubmit} loading={busy} style={{ flex: 2 }} />
              </>
            ) : (
              <KarateButton label="Concluir" variant="secondary" onPress={resetToEvent} style={{ flex: 1 }} />
            )}
          </View>
        )}
      </Card>
      <AuraFooter />
    </ScrollView>
  );
}

function SumRow({ icon, k, v, price }: { icon: string; k: string; v: string; price?: boolean }) {
  return (
    <View style={styles.sumRow}>
      <Ionicons name={icon as any} size={16} color={KarateColors.ink4} />
      <Text style={styles.sumK}>{k}</Text>
      <Text style={[styles.sumV, price && styles.sumPrice]}>{v}</Text>
    </View>
  );
}
function ConfRow({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.confRow}>
      <Text style={styles.confK}>{k}</Text>
      <Text style={styles.confV}>{v}</Text>
    </View>
  );
}
function Card({ fed, children }: { fed: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <FpktLogo size={38} />
        <View style={{ flex: 1 }}>
          <Text style={styles.headT}>Inscrição</Text>
          <Text style={styles.headS}>{fed}</Text>
        </View>
      </View>
      {children}
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
  wrap: { alignItems: "center", padding: 20, paddingTop: 32, paddingBottom: 56 } as ViewStyle,
  card: {
    width: "100%", maxWidth: 440, backgroundColor: KarateColors.glass, borderWidth: 1, borderColor: KarateColors.border,
    borderRadius: KarateRadius.lg, overflow: "hidden",
    ...Platform.select({
      web: { boxShadow: "0 24px 60px rgba(28,23,20,0.18)" } as any,
      default: { shadowColor: "#000", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.18, shadowRadius: 28, elevation: 6 },
    }),
  } as ViewStyle,

  head: { flexDirection: "row", alignItems: "center", gap: 12, padding: 18, paddingBottom: 14 } as ViewStyle,
  seal: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: KarateColors.primaryLine, backgroundColor: KarateColors.primarySoft, alignItems: "center", justifyContent: "center" } as ViewStyle,
  sealK: { fontFamily: KarateFonts.heading, fontSize: 18, color: KarateColors.primary } as TextStyle,
  headT: { fontFamily: KarateFonts.heading, fontSize: 17, fontWeight: "400", color: KarateColors.ink } as TextStyle,
  headS: { fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", color: KarateColors.ink3, fontFamily: KarateFonts.mono, marginTop: 2 } as TextStyle,

  prog: { flexDirection: "row", gap: 5, paddingHorizontal: 20, paddingBottom: 16 } as ViewStyle,
  progSeg: { flex: 1, height: 4, borderRadius: 999, backgroundColor: KarateColors.border } as ViewStyle,
  progSegOn: { backgroundColor: KarateColors.primary } as ViewStyle,

  body: { paddingHorizontal: 24, paddingBottom: 8, minHeight: 200 } as ViewStyle,
  stepLabel: { fontSize: 10, letterSpacing: 1, color: KarateColors.primary, fontFamily: KarateFonts.mono, marginBottom: 10 } as TextStyle,
  h2: { fontFamily: KarateFonts.heading, fontSize: 25, fontWeight: "400", color: KarateColors.ink, textAlign: "center" } as TextStyle,
  sub: { fontSize: 14, color: KarateColors.ink2, marginTop: 7, lineHeight: 20, textAlign: "center" } as TextStyle,

  evSum: { marginTop: 18, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.md, overflow: "hidden" } as ViewStyle,
  sumRow: { flexDirection: "row", alignItems: "center", gap: 11, padding: 12, borderTopWidth: 1, borderTopColor: KarateColors.border } as ViewStyle,
  sumK: { fontSize: 12, color: KarateColors.ink3, width: 72 } as TextStyle,
  sumV: { flex: 1, fontSize: 13.5, fontWeight: "600", color: KarateColors.ink, textAlign: "right" } as TextStyle,
  sumPrice: { fontFamily: KarateFonts.mono, color: KarateColors.primary } as TextStyle,

  label: { fontSize: 12, fontWeight: "700", color: KarateColors.ink2, marginTop: 18, marginBottom: 6 } as TextStyle,
  input: { borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.md, paddingVertical: 12, paddingHorizontal: 14, fontSize: 15, color: KarateColors.ink, fontFamily: KarateFonts.mono, backgroundColor: KarateColors.glass } as TextStyle,
  hint: { fontSize: 11.5, color: KarateColors.ink3, marginTop: 7 } as TextStyle,
  inlineErr: { fontSize: 12.5, color: KarateColors.danger, marginTop: 8 } as TextStyle,

  conf: { marginTop: 18, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.md, overflow: "hidden" } as ViewStyle,
  confRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, padding: 13, borderTopWidth: 1, borderTopColor: KarateColors.border } as ViewStyle,
  confK: { fontSize: 13.5, color: KarateColors.ink3 } as TextStyle,
  confV: { fontSize: 13.5, fontWeight: "700", color: KarateColors.ink, textAlign: "right", flexShrink: 1 } as TextStyle,
  beltVal: { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  beltSw: { width: 22, height: 12, borderRadius: 3, borderWidth: 1, borderColor: "rgba(0,0,0,0.18)" } as ViewStyle,
  confTotal: { backgroundColor: KarateColors.bg2 } as ViewStyle,
  confTotalV: { fontSize: 16, fontWeight: "800", color: KarateColors.primary, fontFamily: KarateFonts.mono } as TextStyle,

  amt: { fontSize: 22, fontWeight: "800", color: KarateColors.ink, fontFamily: KarateFonts.mono, marginTop: 16 } as TextStyle,
  expire: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: KarateColors.warnSoft, borderWidth: 1, borderColor: KarateColors.warn, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 13, marginTop: 12 } as ViewStyle,
  expireTxt: { fontSize: 12.5, color: KarateColors.warn } as TextStyle,
  copyBox: { alignSelf: "stretch", marginTop: 16 } as ViewStyle,
  copyLbl: { fontSize: 11, color: KarateColors.ink3, fontFamily: KarateFonts.mono, letterSpacing: 0.6, marginBottom: 7 } as TextStyle,
  copyRow: { flexDirection: "row", gap: 9, alignItems: "stretch" } as ViewStyle,
  copyCode: { flex: 1, fontFamily: KarateFonts.mono, fontSize: 11.5, color: KarateColors.ink2, backgroundColor: KarateColors.glass, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.sm, paddingVertical: 11, paddingHorizontal: 12 } as TextStyle,
  copyBtn: { paddingHorizontal: 14, borderWidth: 1, borderColor: KarateColors.primaryLine, borderRadius: KarateRadius.sm, alignItems: "center", justifyContent: "center" } as ViewStyle,

  errBlock: { alignItems: "center", paddingHorizontal: 24, paddingTop: 8, paddingBottom: 8 } as ViewStyle,
  errGlyph: { width: 66, height: 66, borderRadius: 33, alignItems: "center", justifyContent: "center", marginBottom: 16 } as ViewStyle,
  errTitle: { fontFamily: KarateFonts.heading, fontSize: 24, fontWeight: "400", color: KarateColors.ink, textAlign: "center" } as TextStyle,
  errMsg: { fontSize: 13.5, color: KarateColors.ink2, textAlign: "center", marginTop: 9, lineHeight: 20 } as TextStyle,
  code501: { fontSize: 11, color: KarateColors.ink3, fontFamily: KarateFonts.mono, backgroundColor: KarateColors.bg2, borderWidth: 1, borderColor: KarateColors.border, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 11, marginTop: 14, overflow: "hidden" } as TextStyle,

  foot: { flexDirection: "row", gap: 10, padding: 20, paddingTop: 16 } as ViewStyle,

  auraFooter: { flexDirection: "row", alignItems: "center", gap: 10, justifyContent: "center", marginTop: 24 } as ViewStyle,
  footSeal: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: KarateColors.border, alignItems: "center", justifyContent: "center" } as ViewStyle,
  footSealK: { fontFamily: KarateFonts.heading, fontSize: 16, color: KarateColors.ink3 } as TextStyle,
  footWm: { fontFamily: KarateFonts.heading, fontSize: 14, color: KarateColors.ink2 } as TextStyle,
  footSub: { fontSize: 11, color: KarateColors.ink4 } as TextStyle,
});
