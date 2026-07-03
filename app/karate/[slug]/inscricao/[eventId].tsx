// ============================================================
// Inscrição Pública em Evento — Aura Karatê (DESIGN-17)
// Rota: /karate/[slug]/inscricao/[eventId]  (PÚBLICA, sem login)
//
// Wizard exame/curso: evento → cpf → confirma → pix (sem etapa de faixa
// pretendida — decisão Caio 08/06; a banca define depois).
// Wizard campeonato (Track E / P0-0.4): evento → categoria → cpf → confirma
// → pix — o praticante escolhe uma categoria (kata/kumite etc.) em vez de
// preencher registration_fields. Bypass AuthGuard:
// segments[0]==="karate" && segments[2]==="inscricao".
//
// Erros: praticante não localizado (404), já inscrito (409), encerrado (409).
// ============================================================
import React, { useEffect, useState } from "react";
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, Linking,
  StyleSheet, ViewStyle, TextStyle, Platform, Switch,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius, KarateFonts } from "@/constants/karateTheme";
import { FpktLogo } from "@/components/karate/FpktLogo";
import { beltHex } from "@/constants/karateBelts";
import { KarateButton } from "@/components/karate/KarateButton";
import { PixQRCode } from "@/components/karate/PixQRCode";
import { karatePortalApi, PublicEvent, LookupResult, InscricaoResult, RegistrationField, CompetitionCategory } from "@/services/karatePortalApi";
import { formatEventDateShort } from "@/utils/eventDate";

function fmtDate(iso?: string | null): string {
  return formatEventDateShort(iso, "a definir");
}
function fmtBRL(v?: number | null): string {
  if (v == null) return "—";
  return `R$ ${Number(v).toFixed(2).replace(".", ",")}`;
}
// Espelha fmtEventFee de app/karate/[slug]/index.tsx — evita mostrar
// "R$ 0,00" na etapa 1 quando fee_amount é null/0 mas o evento tem
// categorias pagas (campeonato): usa from_price ("a partir de R$ X")
// calculado pelo backend. Sem categoria/preço nenhum, mostra "Gratuito".
function fmtEventFeeSummary(feeAmount?: number | null, fromPrice?: number | null): string {
  const n = feeAmount == null ? 0 : Number(feeAmount);
  if (n > 0) return `R$ ${n.toFixed(2).replace(".", ",")}`;
  const fp = fromPrice == null ? 0 : Number(fromPrice);
  if (fp > 0) return `a partir de R$ ${fp.toFixed(2).replace(".", ",")}`;
  return "Gratuito";
}
// PIX expira em `expires_at`, um timestamp ISO completo (com hora/timezone,
// ex. "2026-07-02T15:30:00.000Z" — TIMESTAMPTZ no backend, ver
// karatePaymentProvider.js). Diferente das datas puras "YYYY-MM-DD" de
// evento, aqui `new Date(iso)` é seguro: o valor já carrega o offset UTC,
// não há ambiguidade de fuso a resolver client-side.
function fmtExpiry(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const diffMs = d.getTime() - Date.now();
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (diffMs <= 0) return `expirou às ${time}`;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "expira em instantes";
  if (mins < 60) return `expira em ${mins} min (às ${time})`;
  const hours = Math.round(mins / 60);
  return `expira em ${hours}h (às ${time})`;
}
function beltLabel(name?: string | null, level?: string | null): string {
  if (!name) return "—";
  const lower = name.toLowerCase();
  const dan = /^(\d+)\s*dan/i.exec(level || "");
  if (dan) return `Faixa ${lower} · ${dan[1]}º dan`;
  return `Faixa ${lower}`;
}
const MODALITY_LABEL: Record<string, string> = {
  kata: "Kata", kumite: "Kumitê", kihon_ippon: "Kihon Ippon",
  team_kata: "Kata em equipe", team_kumite: "Kumitê em equipe",
};
function modalityLabel(m?: string | null): string {
  if (!m) return "—";
  return MODALITY_LABEL[m] || m;
}
function categorySummary(c: CompetitionCategory): string {
  const parts: string[] = [];
  if (c.min_age != null || c.max_age != null) {
    if (c.min_age != null && c.max_age != null) parts.push(`${c.min_age}–${c.max_age} anos`);
    else if (c.min_age != null) parts.push(`a partir de ${c.min_age} anos`);
    else parts.push(`até ${c.max_age} anos`);
  }
  if (c.belt_min || c.belt_max) {
    if (c.belt_min && c.belt_max) parts.push(`${c.belt_min}–${c.belt_max}`);
    else parts.push(c.belt_min || c.belt_max || "");
  }
  if (c.sex && c.sex !== "mixed") parts.push(c.sex === "M" ? "Masculino" : "Feminino");
  if (c.weight_class) parts.push(c.weight_class);
  return parts.join(" · ");
}
function copyText(t: string) {
  try {
    if (Platform.OS === "web" && typeof navigator !== "undefined" && (navigator as any).clipboard) {
      (navigator as any).clipboard.writeText(t);
    }
  } catch { /* noop */ }
}

// "categoria" só é usado quando o evento é kind==='competition' (Track E).
type Step = "evento" | "categoria" | "cpf" | "confirma" | "pix";
type Err = "nao" | "ja" | "fim" | "evento" | "generic" | null;
// Índices do progresso: exame/curso tem 3 passos visíveis (evento/cpf/confirma);
// campeonato tem 4 (evento/categoria/cpf/confirma). getProgressSteps() abaixo
// decide quantos segmentos desenhar conforme o kind do evento.
const STEP_IDX: Record<Step, number> = { evento: 0, categoria: 1, cpf: 2, confirma: 3, pix: 4 };

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

  // Bloco A — campos extras do formulário de inscrição (registration_fields).
  // Vazio para campeonato (o "formulário" da competição é a escolha da categoria).
  const registrationFields: RegistrationField[] = event?.registration_fields ?? [];
  const [responses, setResponses] = useState<Record<string, string | boolean>>({});
  const [missingFieldLabels, setMissingFieldLabels] = useState<string[]>([]);
  const setResponse = (key: string, value: string | boolean) =>
    setResponses((prev) => ({ ...prev, [key]: value }));

  // Track E / P0-0.4 — categoria escolhida quando o evento é campeonato.
  const isCompetition = event?.kind === "competition";
  const categories: CompetitionCategory[] = event?.categories ?? [];
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const selectedCategory = categories.find((c) => c.id === selectedCategoryId) || null;
  // Taxa efetiva desta inscrição (categoria, quando campeonato; senão o
  // evento) — usada no passo PIX pra distinguir "evento gratuito" (payment
  // fica null por não ter cobrança) de "falha ao gerar PIX" (payment null
  // mas havia taxa > 0). payment.amount, quando presente, é a fonte mais
  // confiável (retornada pelo backend após o submit); fora do passo pix
  // caímos no preço já conhecido do evento/categoria.
  const feeDue = payment?.amount ?? (isCompetition ? (selectedCategory?.fee_amount ?? 0) : (event?.fee_amount ?? 0));

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
    if (code === "PRACTITIONER_NOT_FOUND" || e?.status === 404) setErr("nao");
    else if (code === "CONFLICT" || (e?.status === 409 && code !== "CLOSED")) setErr("ja");
    else if (code === "CLOSED" || e?.status === 409) setErr("fim");
    else if (code === "VALIDATION_ERROR" && Array.isArray(e?.data?.missingFields)) {
      // Backend já resolve key -> label antes de responder (ver karatePublic.js).
      setMissingFieldLabels(e.data.missingFields);
      setErrMsg("Preencha os campos obrigatórios destacados abaixo antes de continuar.");
    } else { setErr("generic"); setErrMsg(e?.message || "Não foi possível continuar."); }
  };

  // Validação client-side (sóbria, espelha a regra do backend): só sinaliza
  // quais campos obrigatórios estão vazios — a validação final é sempre do
  // servidor (422 + missingFields), isto é só feedback antecipado.
  const clientMissingFields = registrationFields
    .filter((f) => f.required)
    .filter((f) => {
      const v = responses[f.key];
      return v === undefined || v === null || (typeof v === "string" && v.trim() === "");
    })
    .map((f) => f.label);

  const doLookup = async () => {
    // A4 — identificação livre (CPF, e-mail ou nº FPKT): validação client-side
    // é só "não vazio, min. 3 caracteres" — a validação de formato específico
    // (CPF/e-mail/registro) é sempre do backend, que já sabe distinguir os 3.
    if (cpf.trim().length < 3) { setErr("generic"); setErrMsg("Informe seu CPF, e-mail ou nº de registro FPKT."); return; }
    setBusy(true); setErr(null);
    try {
      const r = await karatePortalApi.lookup(slugStr, eventIdStr, cpf.trim(), isCompetition ? selectedCategoryId || undefined : undefined);
      if (r.already_enrolled) { setErr("ja"); return; }
      setPract(r.practitioner);
      setStep("confirma");
    } catch (e) { handleErr(e); }
    finally { setBusy(false); }
  };

  const doSubmit = async () => {
    setMissingFieldLabels([]);
    if (!isCompetition && clientMissingFields.length > 0) {
      setMissingFieldLabels(clientMissingFields);
      setErrMsg("Preencha os campos obrigatórios destacados abaixo antes de continuar.");
      return;
    }
    setBusy(true); setErr(null);
    try {
      const r = await karatePortalApi.submitInscricao(
        slugStr, eventIdStr, cpf.trim(),
        isCompetition ? undefined : responses,
        isCompetition ? selectedCategoryId || undefined : undefined
      );
      setPayment(r.payment);
      setStep("pix");
    } catch (e) { handleErr(e); }
    finally { setBusy(false); }
  };

  const resetToEvent = () => {
    setErr(null); setStep("evento"); setCpf(""); setPract(null);
    setResponses({}); setMissingFieldLabels([]); setSelectedCategoryId(null);
  };

  // ── progress ──
  // Campeonato tem um passo a mais (categoria) — desenha 4 segmentos em vez
  // de 3. STEP_IDX já reserva o índice 1 pra "categoria" (só usado quando
  // isCompetition), então o segmento extra só aparece nesse fluxo.
  const progressSteps = isCompetition ? [0, 1, 2, 3] : [0, 2, 3];
  const Progress = () => (
    <View style={styles.prog}>
      {progressSteps.map((i) => (
        <View key={i} style={[styles.progSeg, i <= STEP_IDX[step] && styles.progSegOn]} />
      ))}
    </View>
  );

  // ── error block ──
  if (err && err !== "generic") {
    const cfg = {
      nao:    { tone: "bad",  icon: "search",       title: "Praticante não localizado", msg: "Não encontramos um cadastro federativo para este CPF. Verifique os números ou cadastre-se na sua federação antes de se inscrever." },
      ja:     { tone: "warn", icon: "checkmark-circle", title: "Você já está inscrito", msg: isCompetition ? "Encontramos uma inscrição para este CPF nesta categoria. Não é necessário se inscrever novamente." : "Encontramos uma inscrição para este CPF neste evento. Não é necessário se inscrever novamente." },
      fim:    { tone: "warn", icon: "time",         title: "Inscrições encerradas", msg: "O prazo de inscrição para este evento terminou. Acompanhe a agenda para os próximos eventos." },
      evento: { tone: "bad",  icon: "search",       title: "Evento não encontrado", msg: errMsg || "Este evento não está disponível para inscrição online." },
    }[err]!;
    const toneColor = cfg.tone === "bad" ? KarateColors.danger : KarateColors.warn;
    const toneSoft = cfg.tone === "bad" ? KarateColors.dangerSoft : KarateColors.warnSoft;
    return (
      <ScrollView style={styles.page} contentContainerStyle={styles.wrap}>
        <Card fed={fedName}>
          <View style={styles.errBlock}>
            <View style={[styles.errGlyph, { backgroundColor: toneSoft }]}>
              <Icon name={cfg.icon as any} size={30} color={toneColor} />
            </View>
            <Text style={styles.errTitle}>{cfg.title}</Text>
            <Text style={styles.errMsg}>{cfg.msg}</Text>
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
              <Text style={styles.stepLabel}>{isCompetition ? "ETAPA 1 DE 4" : "ETAPA 1 DE 3"} · EVENTO</Text>
              <Text style={styles.h2}>{event?.name || "Inscrição em evento"}</Text>
              <Text style={styles.sub}>Confira os dados antes de iniciar sua inscrição.</Text>
              <View style={styles.evSum}>
                <SumRow icon="calendar-outline" k="Data" v={fmtDate(event?.event_date)} />
                <SumRow icon="location-outline" k="Local" v={event?.location || "a definir"} />
                {event?.capacity ? (
                  <SumRow icon="people-outline" k="Vagas" v={`${event.capacity.filled}${event.capacity.max ? ` de ${event.capacity.max}` : ""} preenchidas`} />
                ) : null}
                <SumRow icon="pricetag-outline" k="Inscrição" v={fmtEventFeeSummary(event?.fee_amount, (event as any)?.from_price)} price />
              </View>
              {!!(event as any)?.description && (
                <Text style={{ fontSize: 13, color: KarateColors.ink2, lineHeight: 20, marginTop: 14 }}>{(event as any).description}</Text>
              )}
            </>
          ) : step === "categoria" ? (
            <>
              <Text style={styles.stepLabel}>ETAPA 2 DE 4 · CATEGORIA</Text>
              <Text style={styles.h2}>Escolha sua categoria</Text>
              <Text style={styles.sub}>Selecione a categoria em que deseja competir.</Text>
              {categories.length === 0 ? (
                <Text style={[styles.inlineErr, { marginTop: 16 }]}>
                  Nenhuma categoria disponível para esta competição no momento.
                </Text>
              ) : (
                <View style={{ marginTop: 16, gap: 10 }}>
                  {categories.map((c) => {
                    const active = selectedCategoryId === c.id;
                    const full = c.max_entries != null && c.entry_count >= c.max_entries;
                    const summary = categorySummary(c);
                    return (
                      <TouchableOpacity
                        key={c.id}
                        onPress={() => setSelectedCategoryId(c.id)}
                        style={[styles.catCard, active && styles.catCardActive]}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.catCardTitle, active && styles.catCardTitleActive]}>{c.name}</Text>
                          <Text style={styles.catCardMeta}>{modalityLabel(c.modality)}{summary ? ` · ${summary}` : ""}</Text>
                          {full ? <Text style={styles.catCardFull}>Vagas preenchidas — entra em lista de espera</Text> : null}
                        </View>
                        {c.fee_amount != null ? <Text style={styles.catCardFee}>{fmtBRL(c.fee_amount)}</Text> : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
              {err === "generic" ? <Text style={styles.inlineErr}>{errMsg}</Text> : null}
            </>
          ) : step === "cpf" ? (
            <>
              <Text style={styles.stepLabel}>{isCompetition ? "ETAPA 3 DE 4" : "ETAPA 2 DE 3"} · IDENTIFICAÇÃO</Text>
              <Text style={styles.h2}>Informe seus dados</Text>
              <Text style={styles.sub}>Usamos seu CPF, e-mail ou nº FPKT apenas para localizar seu registro.</Text>
              <Text style={styles.label}>CPF, e-mail ou nº de registro FPKT</Text>
              <TextInput
                style={styles.input}
                placeholder="000.000.000-00, voce@email.com ou nº FPKT"
                placeholderTextColor={KarateColors.ink4}
                value={cpf}
                onChangeText={setCpf}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
              />
              <Text style={styles.hint}>Esses dados não ficam visíveis em nenhuma página pública.</Text>
              {err === "generic" ? <Text style={styles.inlineErr}>{errMsg}</Text> : null}
            </>
          ) : step === "confirma" ? (
            <>
              <Text style={styles.stepLabel}>{isCompetition ? "ETAPA 4 DE 4" : "ETAPA 3 DE 3"} · CONFIRMAÇÃO</Text>
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
                {isCompetition ? <ConfRow k="Categoria" v={selectedCategory?.name || "—"} /> : null}
                <ConfRow k="Data" v={fmtDate(event?.event_date)} />
                <View style={[styles.confRow, styles.confTotal]}>
                  <Text style={styles.confK}>Total</Text>
                  <Text style={styles.confTotalV}>
                    {fmtBRL(isCompetition && selectedCategory?.fee_amount != null ? selectedCategory.fee_amount : event?.fee_amount)}
                  </Text>
                </View>
              </View>

              {!isCompetition && registrationFields.length > 0 && (
                <View style={styles.extraFields}>
                  <Text style={styles.extraFieldsTitle}>Informações adicionais</Text>
                  {registrationFields.map((f) => (
                    <RegistrationFieldInput
                      key={f.key}
                      field={f}
                      value={responses[f.key]}
                      onChange={(v) => setResponse(f.key, v)}
                    />
                  ))}
                </View>
              )}
              {!isCompetition && missingFieldLabels.length > 0 ? (
                <Text style={styles.inlineErr}>
                  {errMsg} {"\n"}Faltando: {missingFieldLabels.join(", ")}.
                </Text>
              ) : null}
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
                  {!!fmtExpiry(payment.expires_at) && (
                    <Text style={styles.expiryLine}>{fmtExpiry(payment.expires_at)}</Text>
                  )}
                  <View style={styles.expire}>
                    <Icon name="time-outline" size={14} color={KarateColors.warn} />
                    <Text style={styles.expireTxt}>Aguardando confirmação do pagamento</Text>
                  </View>
                  <Text style={styles.pixHonestNote}>
                    A federação confirma o pagamento manualmente; sua inscrição fica pendente até lá.
                  </Text>
                  <View style={styles.copyBox}>
                    <Text style={styles.copyLbl}>PIX COPIA E COLA</Text>
                    <View style={styles.copyRow}>
                      <Text style={styles.copyCode} numberOfLines={1} selectable>{payment.payload}</Text>
                      <TouchableOpacity style={styles.copyBtn} onPress={() => { copyText(payment.payload!); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
                        <Icon name={copied ? "checkmark" : "copy-outline"} size={16} color={KarateColors.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              ) : (
                <>
                  {/* payment null/sem payload: dois casos distintos —
                      (a) evento gratuito (nenhuma cobrança a fazer) ou
                      (b) taxa > 0 mas o provider falhou/não gerou o PIX
                      (payment?.error carrega o motivo, quando houver).
                      Nunca simular um QR code aqui — só copy honesta. */}
                  {feeDue <= 0 ? (
                    <>
                      <View style={[styles.errGlyph, { backgroundColor: KarateColors.okSoft }]}>
                        <Icon name="checkmark-circle" size={30} color={KarateColors.ok} />
                      </View>
                      <Text style={styles.h2}>Inscrição registrada</Text>
                      <Text style={styles.sub}>Este evento não tem taxa de inscrição. Sua inscrição já foi registrada — a federação cuida do resto.</Text>
                    </>
                  ) : (
                    <>
                      <View style={[styles.errGlyph, { backgroundColor: KarateColors.warnSoft }]}>
                        <Icon name="time-outline" size={30} color={KarateColors.warn} />
                      </View>
                      <Text style={styles.h2}>Pagamento a confirmar</Text>
                      <Text style={styles.sub}>
                        {payment?.error
                          ? payment.error
                          : "Sua inscrição foi registrada, mas não foi possível gerar o QR code PIX agora. A federação entrará em contato com as instruções de pagamento."}
                      </Text>
                    </>
                  )}
                </>
              )}
            </View>
          )}
        </View>

        {/* footer actions */}
        {!loadingEvent && (
          <View style={styles.foot}>
            {step === "evento" ? (
              <KarateButton
                label="Iniciar inscrição"
                onPress={() => { setErr(null); setStep(isCompetition ? "categoria" : "cpf"); }}
                style={{ flex: 1 }}
              />
            ) : step === "categoria" ? (
              <>
                <KarateButton label="Voltar" variant="secondary" onPress={() => setStep("evento")} style={{ flex: 1 }} />
                <KarateButton
                  label="Continuar"
                  onPress={() => { setErr(null); setStep("cpf"); }}
                  disabled={!selectedCategoryId}
                  style={{ flex: 2 }}
                />
              </>
            ) : step === "cpf" ? (
              <>
                <KarateButton label="Voltar" variant="secondary" onPress={() => setStep(isCompetition ? "categoria" : "evento")} style={{ flex: 1 }} />
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
      <Icon name={icon as any} size={16} color={KarateColors.ink4} />
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

// Bloco A — input dinâmico para um registration_field, conforme o `type`.
// checkbox usa Switch (Sim/Não); select usa pílulas (sem dependência de
// Picker nativo); os demais (text/number/date/phone) usam TextInput com
// keyboardType/placeholder apropriados.
function RegistrationFieldInput({
  field, value, onChange,
}: {
  field: RegistrationField;
  value: string | boolean | undefined;
  onChange: (v: string | boolean) => void;
}) {
  const label = field.label + (field.required ? " *" : "");

  if (field.type === "checkbox") {
    return (
      <View style={styles.extraFieldRow}>
        <Text style={styles.extraFieldLabel}>{label}</Text>
        <Switch
          value={value === true}
          onValueChange={(v) => onChange(v)}
          trackColor={{ false: KarateColors.border, true: KarateColors.primaryLine }}
          thumbColor={value === true ? KarateColors.primary : "#fff"}
        />
      </View>
    );
  }

  if (field.type === "select") {
    const opts = (field.options ?? []).map((o) => (typeof o === "string" ? { value: o, label: o } : o));
    return (
      <View style={{ marginBottom: 12 }}>
        <Text style={styles.extraFieldLabel}>{label}</Text>
        <View style={styles.selectRow}>
          {opts.map((o) => {
            const active = value === o.value;
            return (
              <TouchableOpacity
                key={o.value}
                onPress={() => onChange(o.value)}
                style={[styles.selectPill, active && styles.selectPillActive]}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.selectPillText, active && styles.selectPillTextActive]}>{o.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }

  const keyboardType = field.type === "number" ? "numeric" : field.type === "phone" ? "phone-pad" : "default";
  const placeholder = field.type === "date" ? "dd/mm/aaaa" : undefined;

  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.extraFieldLabel}>{label}</Text>
      <TextInput
        style={styles.extraFieldInput}
        value={typeof value === "string" ? value : ""}
        onChangeText={(v) => onChange(v)}
        placeholder={placeholder}
        placeholderTextColor={KarateColors.ink4}
        keyboardType={keyboardType as any}
      />
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

  extraFields: { marginTop: 18 } as ViewStyle,
  extraFieldsTitle: { fontSize: 12, fontWeight: "700", color: KarateColors.ink2, marginBottom: 10 } as TextStyle,
  extraFieldRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 } as ViewStyle,
  extraFieldLabel: { fontSize: 12.5, color: KarateColors.ink2, marginBottom: 6, fontWeight: "600" } as TextStyle,
  extraFieldInput: {
    borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.md,
    paddingVertical: 11, paddingHorizontal: 14, fontSize: 14, color: KarateColors.ink,
    backgroundColor: KarateColors.glass,
  } as TextStyle,
  selectRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 } as ViewStyle,
  selectPill: {
    borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.pill,
    paddingVertical: 7, paddingHorizontal: 14, backgroundColor: KarateColors.glass,
  } as ViewStyle,
  selectPillActive: { borderColor: KarateColors.primary, backgroundColor: KarateColors.primarySoft } as ViewStyle,
  selectPillText: { fontSize: 12.5, fontWeight: "600", color: KarateColors.ink2 } as TextStyle,
  selectPillTextActive: { color: KarateColors.primary } as TextStyle,

  // Track E / P0-0.4 — cartão de seleção de categoria de campeonato.
  catCard: {
    flexDirection: "row", alignItems: "center", gap: 10, padding: 13,
    borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.md,
    backgroundColor: KarateColors.glass,
  } as ViewStyle,
  catCardActive: { borderColor: KarateColors.primary, backgroundColor: KarateColors.primarySoft } as ViewStyle,
  catCardTitle: { fontSize: 14, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  catCardTitleActive: { color: KarateColors.primary } as TextStyle,
  catCardMeta: { fontSize: 12, color: KarateColors.ink3, marginTop: 3 } as TextStyle,
  catCardFull: { fontSize: 11, color: KarateColors.warn, marginTop: 4 } as TextStyle,
  catCardFee: { fontSize: 13, fontWeight: "700", color: KarateColors.primary, fontFamily: KarateFonts.mono } as TextStyle,

  conf: { marginTop: 18, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.md, overflow: "hidden" } as ViewStyle,
  confRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, padding: 13, borderTopWidth: 1, borderTopColor: KarateColors.border } as ViewStyle,
  confK: { fontSize: 13.5, color: KarateColors.ink3 } as TextStyle,
  confV: { fontSize: 13.5, fontWeight: "700", color: KarateColors.ink, textAlign: "right", flexShrink: 1 } as TextStyle,
  beltVal: { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  beltSw: { width: 22, height: 12, borderRadius: 3, borderWidth: 1, borderColor: "rgba(0,0,0,0.18)" } as ViewStyle,
  confTotal: { backgroundColor: KarateColors.bg2 } as ViewStyle,
  confTotalV: { fontSize: 16, fontWeight: "800", color: KarateColors.primary, fontFamily: KarateFonts.mono } as TextStyle,

  amt: { fontSize: 22, fontWeight: "800", color: KarateColors.ink, fontFamily: KarateFonts.mono, marginTop: 16 } as TextStyle,
  expiryLine: { fontSize: 12, color: KarateColors.ink3, marginTop: 4, fontFamily: KarateFonts.mono } as TextStyle,
  expire: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: KarateColors.warnSoft, borderWidth: 1, borderColor: KarateColors.warn, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 13, marginTop: 12 } as ViewStyle,
  expireTxt: { fontSize: 12.5, color: KarateColors.warn } as TextStyle,
  pixHonestNote: { fontSize: 12, color: KarateColors.ink3, textAlign: "center", marginTop: 10, lineHeight: 17, maxWidth: 320 } as TextStyle,
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
