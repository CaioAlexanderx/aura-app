// ============================================================
// Carteirinha VIRTUAL pública — Aura Karatê
// Rota: /karate/carteirinha/[token]  (PÚBLICA, sem login)
//
// Substitui a impressão física: a federação manda este link direto pro
// praticante (via CarteirinhaQueue.tsx, ação "Copiar link"/"Compartilhar")
// no lugar de imprimir a carteirinha em papel. Irmã de app/karate/verify/
// [token].tsx (mesmo bypass de auth), mas com propósito diferente:
//   - /karate/verify/[token]      → verificação pública REDUZIDA (LGPD,
//                                    oculta foto/CPF/nascimento, usada por
//                                    QUEM RECEBE o QR de um terceiro).
//   - /karate/carteirinha/[token] → carteirinha CHEIA (com foto), só
//                                    liberada depois de confirmar
//                                    identidade — é o EQUIVALENTE DIGITAL
//                                    da carteirinha impressa do PRÓPRIO
//                                    titular.
//
// Backend (aura-backend PR #416/#417, já no ar):
//   GET  /public/karate/card/:token          → passo LEVE (pré-identidade):
//        { requires_identity, dojo_name, federation_name, federation_logo }
//        — SEM foto/nome/CPF/nascimento (defesa em profundidade, o backend
//        nem faz JOIN em customers nesse passo). 404 se o token não existe.
//   POST /public/karate/card/:token/verify   → body { birth_date?, rg?, cpf? }
//        (qualquer UM que bata libera). 200 → cartão CHEIO (com foto).
//        403 IDENTITY_MISMATCH → token inexistente OU identidade errada
//        são INDISTINGUÍVEIS de propósito (anti-oráculo, não dá pra saber
//        qual dos dois aconteceu por fora). 422 VALIDATION_ERROR → nenhum
//        campo plausível. 429 → rate-limit (10 tentativas/10min, token+IP).
//
// Render do cartão: reaproveita buildSingleCardHtml (MESMO HTML/CSS da
// impressão) num <iframe>, no padrão já usado por CardPreviewFrame em
// CarteirinhaPanel.tsx — não duplicamos o desenho do cartão aqui.
//
// LGPD: nada sensível aparece antes da identidade confirmar (o passo leve
// já não manda). Cartão revogado ainda mostra o cartão (é a mesma leitura
// da página de verify — "revogada" != "não existe"), mas com um aviso
// claro no topo, nunca fingindo que está válido.
//
// ⚠️ Bypass de auth: precisa do MESMO tratamento de app/karate/verify/
// [token].tsx no app/_layout.tsx (segments[1]==="carteirinha"), senão o
// AuthGuard redireciona pro login antes do praticante deslogado ver o
// cartão.
//
// ⚠️ Data pura, nunca `new Date("YYYY-MM-DD")` (desloca um dia no fuso
// BR). DateInput (components/inputs/DateInput.tsx) já resolve isso com
// regex puro — usado aqui para o campo de nascimento.
//
// ⚠️ Corrida: cada submit de identidade dispara um POST. `submitSeqRef`
// guarda um contador incrementado a cada tentativa — uma resposta só é
// aplicada se ainda for a tentativa mais recente (evita que uma resposta
// antiga sobrescreva um novo submit em andamento).
// ============================================================
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, ScrollView, ActivityIndicator, TextInput,
  StyleSheet, ViewStyle, TextStyle, Platform, Linking, Pressable,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius, KarateFonts } from "@/constants/karateTheme";
import {
  karateCardApi, CardTokenPreview, VirtualCardResult, CardIdentityInput, CardStatus,
} from "@/services/karateCardApi";
import type { MembershipCard } from "@/services/karateCardApi";
import { buildSingleCardHtml, buildCarteirinhaHtml } from "@/components/karate/carteirinha/buildCarteirinhaHtml";
import { useShojiFonts, FpktLogo } from "@/components/karate/shoji";
import { Skeleton } from "@/components/karate/Skeleton";
import { DateInput, parseBrDate } from "@/components/inputs/DateInput";

const IS_WEB = Platform.OS === "web";

// ── helpers ──────────────────────────────────────────────
function toMembershipCard(v: VirtualCardResult): MembershipCard {
  return {
    id: "",
    federation_id: "",
    student_id: "",
    dojo_id: null,
    student_name: v.student_name,
    birth_date: v.birth_date,
    cpf: v.cpf,
    card_number: v.card_number,
    cbkt_number: v.cbkt_number,
    belt: v.belt,
    belt_name: v.belt_name,
    dojo_name: v.dojo_name,
    photo_url: v.photo_url,
    is_minor: v.is_minor,
    issued_at: v.issued_at,
    verify_token: v.verify_token,
    status: v.status,
    federation_name: v.federation_name,
    federation_logo: v.federation_logo,
  };
}

// Aceita apenas letras/dígitos/pontuação leve — mesma convenção de
// maskId em app/karate/verify/[token].tsx (CardCopySection): não força
// máscara de CPF pra também aceitar RG.
function maskId(v: string): string {
  return v.replace(/\s+/g, "");
}

type Tone = "ok" | "bad";
const TONE_COLOR: Record<Tone, { fg: string; soft: string }> = {
  ok:  { fg: KarateColors.ok,     soft: KarateColors.okSoft },
  bad: { fg: KarateColors.danger, soft: KarateColors.dangerSoft },
};
const STATUS_CFG: Record<CardStatus, { label: string; sub: string; icon: string; tone: Tone }> = {
  active: {
    label: "Carteirinha válida",
    sub: "Registro ativo junto à federação.",
    icon: "checkmark-circle",
    tone: "ok",
  },
  revoked: {
    label: "Carteirinha revogada",
    sub: "Este registro foi revogado pela federação — não é mais válido.",
    icon: "alert-circle",
    tone: "bad",
  },
};

// ── card frame (render web via iframe, MESMO HTML da impressão) ──────
// `fill` é usado pelo flip 3D (CardStage): as duas faces (front/back) ficam
// empilhadas dentro do mesmo "flipper" com rotateY, então cada iframe passa
// a ocupar 100% do container da face (o tamanho/aspect-ratio físico do
// cartão é controlado por fora, em styles.flipStage) em vez do próprio
// styles.cardFrame (usado no modo antigo, sem flip).
function VirtualCardFrame({ card, face, fill }: { card: MembershipCard; face: "front" | "back"; fill?: boolean }) {
  const hostRef = useRef<any>(null);

  useEffect(() => {
    if (!IS_WEB) return;
    const host: HTMLElement | null = hostRef.current;
    if (!host) return;
    host.innerHTML = "";
    const iframe = document.createElement("iframe");
    iframe.setAttribute("title", face === "back" ? "Carteirinha — verso" : "Carteirinha — frente");
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "0";
    iframe.style.display = "block";
    iframe.style.background = "transparent";
    iframe.setAttribute("scrolling", "no");
    iframe.srcdoc = buildSingleCardHtml(card, face);
    host.appendChild(iframe);
    return () => { host.innerHTML = ""; };
  }, [card, face]);

  if (!IS_WEB) {
    return (
      <View style={styles.nativeFallback}>
        <Icon name="image" size={26} color={KarateColors.ink4} />
        <Text style={styles.nativeFallbackTxt}>Abra este link no navegador do celular para ver a carteirinha.</Text>
      </View>
    );
  }
  return <View ref={hostRef} style={fill ? styles.cardFrameFill : styles.cardFrame} />;
}

// ── main ─────────────────────────────────────────────────
type Step = "loading" | "notfound" | "loaderror" | "identity" | "card";

export default function VirtualCardScreen() {
  useShojiFonts();
  const { token } = useLocalSearchParams<{ token: string }>();
  const tokenStr = Array.isArray(token) ? token[0] : token || "";

  const [step, setStep] = useState<Step>("loading");
  const [preview, setPreview] = useState<CardTokenPreview | null>(null);
  const [birthDate, setBirthDate] = useState("");
  const [idValue, setIdValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [card, setCard] = useState<VirtualCardResult | null>(null);
  const [face, setFace] = useState<"front" | "back">("front");

  const loadSeqRef = useRef(0);
  const loadPreview = useCallback(() => {
    if (!tokenStr) { setStep("notfound"); return; }
    const seq = ++loadSeqRef.current;
    setStep("loading");
    karateCardApi
      .getCardPreview(tokenStr)
      .then((res) => {
        if (seq !== loadSeqRef.current) return;
        if (!res) { setStep("notfound"); return; }
        setPreview(res);
        setStep("identity");
      })
      .catch(() => { if (seq === loadSeqRef.current) setStep("loaderror"); });
  }, [tokenStr]);

  useEffect(() => { loadPreview(); }, [loadPreview]);

  // Contador de tentativas de confirmação de identidade — protege contra
  // corrida (usuário reenvia antes da resposta anterior chegar). Só a
  // resposta da tentativa mais recente é aplicada.
  const submitSeqRef = useRef(0);
  const handleSubmit = useCallback(async () => {
    setFormError(null);

    const birthTrim = birthDate.trim();
    const birthIso = birthTrim ? parseBrDate(birthTrim) : null;
    if (birthTrim && !birthIso) {
      setFormError("Data de nascimento inválida. Use o formato dd/mm/aaaa.");
      return;
    }
    const idTrim = idValue.trim();
    if (!birthIso && !idTrim) {
      setFormError("Informe ao menos um dado para confirmar sua identidade.");
      return;
    }

    const identity: CardIdentityInput = {};
    if (birthTrim) identity.birth_date = birthTrim; // backend aceita dd/mm/aaaa OU yyyy-mm-dd
    if (idTrim) { identity.rg = idTrim; identity.cpf = idTrim; } // backend valida plausibilidade de cada um

    const seq = ++submitSeqRef.current;
    setSubmitting(true);
    try {
      const res = await karateCardApi.verifyCardIdentity(tokenStr, identity);
      if (seq !== submitSeqRef.current) return;
      setCard(res);
      setFace("front");
      setStep("card");
    } catch (e: any) {
      if (seq !== submitSeqRef.current) return;
      if (e?.code === "IDENTITY_MISMATCH") {
        setFormError("Não conseguimos confirmar sua identidade com esses dados. Confira e tente de novo.");
      } else if (e?.code === "VALIDATION_ERROR") {
        setFormError("Informe uma data de nascimento, RG ou CPF válidos.");
      } else if (e?.code === "RATE_LIMITED") {
        setFormError("Muitas tentativas. Aguarde alguns minutos e tente de novo.");
      } else if (e?.code === "NOT_FOUND") {
        setFormError("Não foi possível confirmar sua identidade agora. Tente de novo em instantes.");
      } else {
        setFormError(e?.message || "Não foi possível confirmar sua identidade agora. Tente de novo.");
      }
    } finally {
      if (seq === submitSeqRef.current) setSubmitting(false);
    }
  }, [tokenStr, birthDate, idValue]);

  const tokShort = tokenStr ? `#${tokenStr.slice(0, 6).toUpperCase()}` : "#—";
  const govLogo = step === "card" ? card?.federation_logo : preview?.federation_logo;
  const govName = (step === "card" ? card?.federation_name : preview?.federation_name) || "FPKT";

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
      <View style={styles.container}>
        {/* gov header */}
        <View style={styles.gov}>
          {govLogo ? (
            <View style={styles.govLogoWrap}>
              <img src={govLogo} style={{ width: 42, height: 42, objectFit: "contain" } as any} alt="" />
            </View>
          ) : (
            <FpktLogo size={42} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.govTitle}>{govName}</Text>
            <Text style={styles.govSub}>Carteirinha digital</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.govK}>CARTEIRINHA</Text>
            <Text style={styles.govTok}>{tokShort}</Text>
          </View>
        </View>

        {step === "loading" && (
          <View style={{ paddingVertical: 20, gap: 16 }}>
            {/* intro */}
            <View style={{ gap: 10, alignItems: "center" }}>
              <Skeleton width={180} height={13} />
              <Skeleton width="80%" height={22} />
            </View>
            {/* card face */}
            <Skeleton width="100%" height={220} radius={KarateRadius.lg} />
            {/* face toggle + action */}
            <View style={{ flexDirection: "row", gap: 10, justifyContent: "center" }}>
              <Skeleton width={110} height={36} radius={KarateRadius.pill} />
              <Skeleton width={110} height={36} radius={KarateRadius.pill} />
            </View>
            <Skeleton width="100%" height={46} radius={KarateRadius.md} />
          </View>
        )}

        {step === "notfound" && <NotFound token={tokenStr} isError={false} />}
        {step === "loaderror" && <NotFound token={tokenStr} isError onRetry={loadPreview} />}

        {step === "identity" && preview && (
          <IdentityForm
            preview={preview}
            birthDate={birthDate}
            setBirthDate={setBirthDate}
            idValue={idValue}
            setIdValue={(v) => setIdValue(maskId(v))}
            error={formError}
            submitting={submitting}
            onSubmit={handleSubmit}
          />
        )}

        {step === "card" && card && (
          <CardStage card={card} face={face} setFace={setFace} />
        )}

        {/* aura footer */}
        <Pressable
          style={styles.auraFooter}
          onPress={() => Linking.openURL("https://www.getaura.com.br")}
          accessibilityRole="link"
        >
          <View style={styles.footSeal}><Text style={styles.footSealK}>空</Text></View>
          <View>
            <Text style={styles.footWm}>Aura · Karatê</Text>
            <Text style={styles.footSub}>Plataforma oficial da federação</Text>
          </View>
        </Pressable>
      </View>
    </ScrollView>
  );
}

// ── passo de identidade ───────────────────────────────────
function IdentityForm({
  preview, birthDate, setBirthDate, idValue, setIdValue, error, submitting, onSubmit,
}: {
  preview: CardTokenPreview;
  birthDate: string;
  setBirthDate: (v: string) => void;
  idValue: string;
  setIdValue: (v: string) => void;
  error: string | null;
  submitting: boolean;
  onSubmit: () => void;
}) {
  const context = [preview.federation_name, preview.dojo_name].filter(Boolean).join(" · ");
  return (
    <>
      <View style={styles.intro}>
        <View style={styles.eyebrow}><Text style={styles.eyebrowTxt}>Carteirinha digital</Text></View>
        <Text style={styles.h1}>Confirme sua identidade</Text>
        <Text style={styles.lead}>
          {context ? `Carteirinha de ${context}. ` : ""}
          Para sua segurança, confirme um dos dados abaixo antes de ver o cartão.
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.body}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Data de nascimento</Text>
            <DateInput
              value={birthDate}
              onChangeText={setBirthDate}
              style={styles.dateInput}
              accessibilityLabel="Data de nascimento"
            />
          </View>

          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orTxt}>ou</Text>
            <View style={styles.orLine} />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>RG ou CPF</Text>
            <TextInput
              style={styles.textInput}
              value={idValue}
              onChangeText={setIdValue}
              placeholder="Nº do RG ou CPF"
              placeholderTextColor={KarateColors.ink4}
              autoCapitalize="none"
              accessibilityLabel="RG ou CPF"
            />
          </View>

          {error ? <Text style={styles.formErr}>{error}</Text> : null}

          <Pressable
            style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
            onPress={onSubmit}
            disabled={submitting}
            accessibilityRole="button"
          >
            {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitBtnTxt}>Confirmar identidade</Text>}
          </Pressable>

          <View style={styles.privacy}>
            <Icon name="lock-closed" size={14} color={KarateColors.ink4} />
            <Text style={styles.privacyTxt}>
              Nenhum dado pessoal é exibido nesta página antes da confirmação. Seus dados não ficam salvos aqui.
            </Text>
          </View>
        </View>
      </View>
    </>
  );
}

// ── passo do cartão ───────────────────────────────────────
// Flip 3D (rotateY) entre frente e verso: as duas faces são renderizadas
// SIMULTANEAMENTE em dois VirtualCardFrame (dois iframes, cada um só-frente
// ou só-verso via buildSingleCardHtml(card, face) — já suportava o parâmetro
// face antes desta mudança, não foi preciso tocar em buildCarteirinhaHtml.ts).
// Ambas ficam empilhadas dentro de um "flipper" com transformStyle:
// preserve-3d + backfaceVisibility: hidden em cada face; girar o flipper
// (rotateY 0deg <-> 180deg) já esconde/revela a face certa — não recriamos o
// desenho do cartão, só giramos o mesmo HTML gerado pelo módulo existente.
function CardStage({
  card, face, setFace,
}: {
  card: VirtualCardResult;
  face: "front" | "back";
  setFace: (f: "front" | "back") => void;
}) {
  const cfg = STATUS_CFG[card.status];
  const tone = TONE_COLOR[cfg.tone];
  const membershipCard = toMembershipCard(card);
  const flipped = face === "back";

  const toggleFace = useCallback(() => {
    setFace(flipped ? "front" : "back");
  }, [flipped, setFace]);

  return (
    <>
      <View style={[styles.statusBar, { backgroundColor: tone.soft }]}>
        <View style={[styles.ring, { borderColor: tone.fg }]}>
          <Icon name={cfg.icon as any} size={22} color={tone.fg} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.stL, { color: tone.fg }]}>{cfg.label}</Text>
          <Text style={styles.stS}>{cfg.sub}</Text>
        </View>
      </View>

      <Text style={styles.faceCaption}>
        {flipped ? "Verso da carteirinha" : "Frente da carteirinha"} · toque no cartão para virar
      </Text>

      <Pressable
        style={styles.flipStage}
        onPress={toggleFace}
        accessibilityRole="button"
        accessibilityLabel={flipped ? "Carteirinha — verso. Toque para ver a frente." : "Carteirinha — frente. Toque para ver o verso."}
      >
        <View style={[styles.flipper, flipped && styles.flipperFlipped]}>
          <View style={[styles.flipFace, styles.flipFaceFront]} pointerEvents="none">
            <VirtualCardFrame card={membershipCard} face="front" fill />
          </View>
          <View style={[styles.flipFace, styles.flipFaceBack]} pointerEvents="none">
            <VirtualCardFrame card={membershipCard} face="back" fill />
          </View>
        </View>
      </Pressable>

      <Pressable
        style={styles.flipBtn}
        onPress={toggleFace}
        accessibilityRole="button"
        accessibilityLabel="Virar carteirinha"
      >
        <Icon name="swap-horizontal" size={15} color={KarateColors.ink2} />
        <Text style={styles.flipBtnTxt}>Virar carteirinha</Text>
      </Pressable>

      <DownloadPdfButton card={card} />
    </>
  );
}

// ── download PDF (frente e verso) ─────────────────────────
// Reusa 1:1 o mecanismo de "Imprimir" da fila (CarteirinhaQueue.tsx
// doPrint): monta a folha A4 com buildCarteirinhaHtml (mesma função da
// impressão em lote — já emite frente E verso por carteirinha), gera um
// Blob e abre em nova aba via window.open(url, "_blank") — com fallback
// para window.open("") + document.write se o navegador bloquear blob URL.
// A folha aberta já tem seu próprio botão flutuante "Imprimir"; no celular
// o caminho é o mesmo da fila: imprimir → "Salvar como PDF" no diálogo do
// navegador. Nenhuma lib de PDF nova, nenhuma chamada autenticada — os
// dados vêm só do VirtualCardResult que a página já tem em memória (mesmo
// resultado do POST /verify), então funciona igual pra quem não está
// logado (praticante no link público).
function DownloadPdfButton({ card }: { card: VirtualCardResult }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handlePress = useCallback(() => {
    if (!IS_WEB) return;
    setErr(null);
    setBusy(true);
    try {
      const membershipCard = toMembershipCard(card);
      const html = buildCarteirinhaHtml([membershipCard], { federationName: card.federation_name || undefined });
      let opened = false;
      try {
        const blob = new Blob([html], { type: "text/html;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const w = window.open(url, "_blank");
        if (w) {
          opened = true;
        } else {
          const w2 = window.open("", "_blank");
          if (w2) { w2.document.write(html); w2.document.close(); opened = true; }
        }
      } catch (blobErr) {
        console.error("[VirtualCardScreen] Erro ao gerar PDF:", blobErr);
      }
      if (!opened) {
        setErr("Não foi possível abrir o PDF — permita pop-ups para este site e tente de novo.");
      }
    } finally {
      setBusy(false);
    }
  }, [card]);

  if (!IS_WEB) return null;

  return (
    <View style={styles.downloadWrap}>
      <Pressable
        style={[styles.downloadBtn, busy && { opacity: 0.7 }]}
        onPress={handlePress}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Baixar carteirinha em PDF, frente e verso"
      >
        {busy ? <ActivityIndicator color="#fff" size="small" /> : <Icon name="download" size={16} color="#fff" />}
        <Text style={styles.downloadBtnTxt}>Baixar PDF (frente e verso)</Text>
      </Pressable>
      {err ? <Text style={styles.downloadErrTxt}>{err}</Text> : null}
      <Text style={styles.downloadHint}>Abre a folha de impressão · no celular, use "Salvar como PDF" na tela de impressão.</Text>
    </View>
  );
}

// ── not found / erro ──────────────────────────────────────
function NotFound({ token, isError, onRetry }: { token: string; isError: boolean; onRetry?: () => void }) {
  return (
    <View style={[styles.card, styles.nf]}>
      <View style={styles.nfGlyph}>
        <Icon name={isError ? "cloud-offline" : "search"} size={30} color={KarateColors.danger} />
      </View>
      <Text style={styles.nfH2}>{isError ? "Não foi possível carregar" : "Link inválido"}</Text>
      <Text style={styles.nfP}>
        {isError
          ? "Houve um erro ao consultar a carteirinha. Tente novamente em instantes."
          : "Não localizamos uma carteirinha para este link. Confira com a sua federação se o link está completo."}
      </Text>
      {!!token && (
        <View style={styles.tokenBox}>
          <Text style={styles.tokenBoxTxt}>carteirinha/{token}</Text>
        </View>
      )}
      {isError && onRetry ? (
        <Pressable style={styles.retryBtn} onPress={onRetry} accessibilityRole="button">
          <Icon name="refresh" size={14} color="#fff" />
          <Text style={styles.retryBtnTxt}>Tentar novamente</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page:        { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  pageContent: { alignItems: "center", paddingHorizontal: 16, paddingVertical: 22, paddingBottom: 56 } as ViewStyle,
  container:   { width: "100%", maxWidth: 480 } as ViewStyle,

  gov:      { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,
  govLogoWrap: { width: 42, height: 42, alignItems: "center", justifyContent: "center" } as ViewStyle,
  govTitle: { fontFamily: KarateFonts.heading, fontSize: 19, fontWeight: "400", color: KarateColors.ink } as TextStyle,
  govSub:   { fontSize: 11, color: KarateColors.ink3, marginTop: 1 } as TextStyle,
  govK:     { fontSize: 9.5, letterSpacing: 1.4, color: KarateColors.ink4, fontFamily: KarateFonts.mono } as TextStyle,
  govTok:   { fontSize: 13, color: KarateColors.ink2, fontFamily: KarateFonts.mono } as TextStyle,

  intro:      { alignItems: "center", paddingVertical: 24 } as ViewStyle,
  eyebrow:    { backgroundColor: KarateColors.primarySoft, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 12, marginBottom: 12 } as ViewStyle,
  eyebrowTxt: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6, color: KarateColors.primary, textTransform: "uppercase" } as TextStyle,
  h1:         { fontFamily: KarateFonts.heading, fontSize: 24, fontWeight: "400", color: KarateColors.ink, textAlign: "center", lineHeight: 29 } as TextStyle,
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

  body:  { padding: 22, gap: 16 } as ViewStyle,
  field: { gap: 7 } as ViewStyle,
  fieldLabel: { fontSize: 12, fontWeight: "700", color: KarateColors.ink2, textTransform: "uppercase", letterSpacing: 0.4 } as TextStyle,
  dateInput: { backgroundColor: KarateColors.bg, borderColor: KarateColors.border2, borderRadius: KarateRadius.md, fontSize: 15, color: KarateColors.ink } as any,
  textInput: {
    borderWidth: 1, borderColor: KarateColors.border2, borderRadius: KarateRadius.md, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: KarateColors.ink, backgroundColor: KarateColors.bg,
  } as TextStyle,

  orRow:  { flexDirection: "row", alignItems: "center", gap: 10 } as ViewStyle,
  orLine: { flex: 1, height: 1, backgroundColor: KarateColors.border } as ViewStyle,
  orTxt:  { fontSize: 11, color: KarateColors.ink4, fontWeight: "700", textTransform: "uppercase" } as TextStyle,

  formErr: { color: KarateColors.danger, fontSize: 12.5, lineHeight: 17 } as TextStyle,

  submitBtn:    { backgroundColor: KarateColors.primary, borderRadius: KarateRadius.md, paddingVertical: 14, alignItems: "center" } as ViewStyle,
  submitBtnTxt: { color: "#fff", fontSize: 14.5, fontWeight: "700" } as TextStyle,

  privacy:   { flexDirection: "row", alignItems: "flex-start", gap: 9 } as ViewStyle,
  privacyTxt:{ flex: 1, fontSize: 11.5, color: KarateColors.ink3, lineHeight: 16 } as TextStyle,

  statusBar: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: KarateRadius.lg, marginBottom: 14 } as ViewStyle,
  ring:      { width: 42, height: 42, borderRadius: 21, backgroundColor: KarateColors.glass, borderWidth: 1, alignItems: "center", justifyContent: "center" } as ViewStyle,
  stL:       { fontSize: 17, fontWeight: "800" } as TextStyle,
  stS:       { fontSize: 12, color: KarateColors.ink2, marginTop: 2 } as TextStyle,

  faceCaption: { fontSize: 12, color: KarateColors.ink3, textAlign: "center", marginBottom: 10 } as TextStyle,

  // Flip 3D: flipStage fixa o tamanho físico do cartão (mesma proporção
  // CR80 de cardFrame); flipper gira em Y; cada flipFace cobre 100% do
  // flipper e esconde a própria face quando de costas (backfaceVisibility).
  // `perspective`/`transformStyle` são propriedades CSS sem equivalente
  // "oficial" no ViewStyle do RN — só existem no runtime web, por isso o
  // cast `as any` dentro de Platform.select({ web: ... }) (mesmo padrão já
  // usado acima em `card` com boxShadow).
  flipStage: {
    width: "100%", maxWidth: 480, alignSelf: "center", aspectRatio: 85.6 / 54, marginBottom: 14,
    ...Platform.select({ web: { perspective: 1600 } as any, default: {} }),
  } as ViewStyle,
  flipper: {
    flex: 1,
    ...Platform.select({
      web: { transformStyle: "preserve-3d", transition: "transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)" } as any,
      default: {},
    }),
  } as ViewStyle,
  flipperFlipped: { transform: [{ rotateY: "180deg" }] } as ViewStyle,
  flipFace: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backfaceVisibility: "hidden",
  } as ViewStyle,
  flipFaceFront: {} as ViewStyle,
  flipFaceBack: { transform: [{ rotateY: "180deg" }] } as ViewStyle,

  flipBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    alignSelf: "center", marginTop: 14, paddingVertical: 10, paddingHorizontal: 18,
    borderRadius: KarateRadius.pill, backgroundColor: KarateColors.glass2,
    borderWidth: 1, borderColor: KarateColors.border,
  } as ViewStyle,
  flipBtnTxt: { fontSize: 13, fontWeight: "700", color: KarateColors.ink2 } as TextStyle,

  downloadWrap: { marginTop: 16, alignItems: "center" } as ViewStyle,
  downloadBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9,
    alignSelf: "stretch", backgroundColor: KarateColors.ink, borderRadius: KarateRadius.md,
    paddingVertical: 14, paddingHorizontal: 18,
  } as ViewStyle,
  downloadBtnTxt: { color: "#fff", fontSize: 14.5, fontWeight: "700" } as TextStyle,
  downloadErrTxt: { color: KarateColors.danger, fontSize: 12.5, lineHeight: 17, textAlign: "center", marginTop: 8 } as TextStyle,
  downloadHint: { fontSize: 11.5, color: KarateColors.ink4, textAlign: "center", marginTop: 8, lineHeight: 15 } as TextStyle,

  cardFrame: { width: "100%", maxWidth: 480, alignSelf: "center", aspectRatio: 85.6 / 54 } as ViewStyle,
  cardFrameFill: { width: "100%", height: "100%" } as ViewStyle,
  nativeFallback: { alignItems: "center", justifyContent: "center", gap: 12, paddingVertical: 40 } as ViewStyle,
  nativeFallbackTxt: { fontSize: 13, color: KarateColors.ink3, textAlign: "center", maxWidth: 280 } as TextStyle,

  // not found
  nf:       { padding: 36, alignItems: "center" } as ViewStyle,
  nfGlyph:  { width: 72, height: 72, borderRadius: 36, backgroundColor: KarateColors.dangerSoft, alignItems: "center", justifyContent: "center", marginBottom: 20 } as ViewStyle,
  nfH2:     { fontFamily: KarateFonts.heading, fontSize: 22, fontWeight: "400", color: KarateColors.ink, textAlign: "center" } as TextStyle,
  nfP:      { fontSize: 14, color: KarateColors.ink2, textAlign: "center", marginTop: 10, lineHeight: 20 } as TextStyle,
  tokenBox: { marginTop: 20, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.sm, borderWidth: 1, borderColor: KarateColors.border, borderStyle: "dashed", alignSelf: "stretch" } as ViewStyle,
  tokenBoxTxt: { fontSize: 12, color: KarateColors.ink2, fontFamily: KarateFonts.mono, textAlign: "center" } as TextStyle,
  retryBtn: { marginTop: 20, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: KarateColors.ink, borderRadius: KarateRadius.md, paddingVertical: 11, paddingHorizontal: 18 } as ViewStyle,
  retryBtnTxt: { color: "#fff", fontSize: 13, fontWeight: "700" } as TextStyle,

  auraFooter: { flexDirection: "row", alignItems: "center", gap: 10, justifyContent: "center", marginTop: 28 } as ViewStyle,
  footSeal:   { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: KarateColors.border, alignItems: "center", justifyContent: "center" } as ViewStyle,
  footSealK:  { fontFamily: KarateFonts.heading, fontSize: 16, color: KarateColors.ink3 } as TextStyle,
  footWm:     { fontSize: 13, fontWeight: "800", color: KarateColors.ink2 } as TextStyle,
  footSub:    { fontSize: 11, color: KarateColors.ink4 } as TextStyle,
});
