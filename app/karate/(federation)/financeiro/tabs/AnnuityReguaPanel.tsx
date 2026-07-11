// ============================================================
// AnnuityReguaPanel — "Régua de e-mail" (Fase F4) · Shoji
//
// Terceira área do hub de Anuidades (?area=regua), fiel ao mockup v2
// (seção .mail): editor de assunto/mensagem com chips de variável,
// pré-visualização ao vivo (client-side, dados de exemplo — nunca chama
// o backend pra montar a prévia), offsets da régua, remetente travado
// (com selo) e o card "Recebimento automático — em preparação".
//
// Contexto de produto (ver CLAUDE.md do app): das faixas-pretas/dojôs
// ativos da federação de referência, só uma fração mínima tem e-mail
// cadastrado — e-mail é infraestrutura para o futuro (portal de
// atualização cadastral), o WhatsApp é o canal real hoje. Esta tela NUNCA
// trata "sem e-mail" como problema — é sobre CONFIGURAR o canal pra
// quando a base estiver mais preenchida, coexistindo com o WhatsApp.
//
// Régua automática fica sempre OFF/travada aqui (mockup: o switch não tem
// onclick nenhum) — ativar régua automática é um controle que já existe
// em Configurações → Régua de cobrança (Track I) e não é reimplementado
// aqui; salvar nesta tela NUNCA muda `enabled`/`channel`, só
// subject_template/body_template/offsets_days (mesmo registro
// karate_reminder_config, então preservar o que não é desta tela é
// obrigatório pra não regredir a régua automática de quem já configurou
// pela outra tela).
// ============================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, Pressable, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle, Platform, useWindowDimensions,
  NativeSyntheticEvent, TextInputSelectionChangeEventData,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F, KarateSpacing as SP } from "@/constants/karateTheme";
import { SectionHead } from "@/components/karate/shoji";
import { Skeleton } from "@/components/karate/Skeleton";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { toast } from "@/components/Toast";
import { useKarateFederation } from "@/contexts/KarateFederation";
import {
  karateApi, karateSettingsApi, ReminderConfig, AnnuityFeePlan, KARATE_REMINDER_VARS, KarateReminderVar,
} from "@/services/karateApi";

// Mesmo default hardcoded de src/services/karateReminderTemplate.js — é
// literalmente o texto que a régua/envio manual usam quando a federação
// não configurou nada (subject_template/body_template === null). Manter
// os DOIS textos em sincronia é intencional: a prévia tem que mostrar a
// verdade do que seria enviado hoje.
const DEFAULT_SUBJECT = "Lembrete: anuidade {{competencia}} — {{valor}}";
const DEFAULT_BODY =
  "Olá, {{nome}}!\n\n" +
  "A anuidade referente a {{competencia}}, no valor de {{valor}}, vence em {{vencimento}}.\n\n" +
  "Para manter o cadastro em dia junto à federação, realize o pagamento e registre o comprovante assim que possível.";

const DEFAULT_OFFSETS = [-7, -1, 3, 15, 30];

const VAR_LABEL: Record<KarateReminderVar, string> = {
  nome: "{{nome}}",
  competencia: "{{competencia}}",
  valor: "{{valor}}",
  vencimento: "{{vencimento}}",
  planos: "{{planos}}",
  pix_copia_cola: "{{pix_copia_cola}}",
};

const MONTH_ABBR = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const PLAN_LABEL: Record<string, string> = { anual: "Anual", semestral: "Semestral", trimestral: "Trimestral" };

function fmtMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function monthsText(months: number[] | null | undefined): string {
  if (!months || !months.length) return "";
  return months.map((m) => MONTH_ABBR[m] || String(m)).join(", ");
}

// Render client-side SIMPLES — mesma lista de variáveis conhecidas do
// backend (KARATE_REMINDER_VARS), mas sem escapeHtml (aqui é texto puro
// pra <Text>, não HTML) e sempre com dados de EXEMPLO. Variável
// desconhecida é preservada literalmente (mesma regra do backend).
function renderPreview(template: string, vars: Record<string, string>): string {
  return String(template || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (full, name) => (
    Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : full
  ));
}

const EXAMPLE_RECIPIENT = "Associação Shotokan Mogi";
const EXAMPLE_VARS = {
  nome: EXAMPLE_RECIPIENT,
  competencia: "2026 · Mai",
  valor: "R$ 150,00",
  vencimento: "31/05/2026",
};
// PIX de exemplo — nunca gerado via API (a prévia não pode disparar
// nenhuma chamada real de pagamento); string só ilustrativa.
const EXAMPLE_PIX = "00020126580014BR.GOV.BCB.PIX0136federacao@getaura.com.br520400005303986540515…";

// ── Chip de variável — insere no campo com foco, na posição do cursor ──
function VarChip({ v, onPress }: { v: KarateReminderVar; onPress: (v: KarateReminderVar) => void }) {
  return (
    <TouchableOpacity style={st.varChip} onPress={() => onPress(v)} accessibilityRole="button" accessibilityLabel={`Inserir variável ${VAR_LABEL[v]}`}>
      <Text style={st.varChipText}>{VAR_LABEL[v]}</Text>
    </TouchableOpacity>
  );
}

// ── Switch decorativo (régua automática) — SEM onPress: ativar régua é
//    controle de Configurações → Régua de cobrança, não desta tela. ──
function LockedSwitch({ on }: { on: boolean }) {
  return (
    <View style={[st.switchTrack, on && st.switchTrackOn]} accessibilityRole="switch" accessibilityState={{ checked: on, disabled: true }} accessibilityLabel="Régua automática (somente leitura nesta tela)">
      <View style={[st.switchThumb, on && st.switchThumbOn]} />
    </View>
  );
}

export function AnnuityReguaPanel({ federationId }: { federationId: string }) {
  const { federationName } = useKarateFederation();
  const { width } = useWindowDimensions();
  const stacked = width < 900;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [config, setConfig] = useState<ReminderConfig | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [senderName, setSenderName] = useState<string | null>(null);
  const [plans, setPlans] = useState<AnnuityFeePlan[] | null>(null);

  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [offsets, setOffsets] = useState<number[]>(DEFAULT_OFFSETS);
  const [addingOffset, setAddingOffset] = useState(false);
  const [offsetTxt, setOffsetTxt] = useState("");
  const [saving, setSaving] = useState(false);

  // Cursor — pra inserir chip de variável na posição certa, no campo que
  // estiver com foco (assunto OU mensagem). Mantido "soft controlled":
  // lê a seleção via onSelectionChange, mas não força o TextInput a ficar
  // 100% controlado por `selection` (isso costuma travar digitação no web).
  const subjectRef = useRef<TextInput>(null);
  const bodyRef = useRef<TextInput>(null);
  const subjectSel = useRef({ start: subject.length, end: subject.length });
  const bodySel = useRef({ start: body.length, end: body.length });
  const [focusedField, setFocusedField] = useState<"subject" | "body">("body");

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [cfgRes, identity, feePlans] = await Promise.all([
        karateApi.getReminderConfig(federationId),
        karateSettingsApi.getIdentity(federationId).catch(() => null),
        karateApi.getFeePlans(federationId).catch(() => null),
      ]);
      const cfg = cfgRes.config;
      setConfig(cfg);
      setSubject((cfg.subject_template && cfg.subject_template.trim()) || DEFAULT_SUBJECT);
      setBody((cfg.body_template && cfg.body_template.trim()) || DEFAULT_BODY);
      setOffsets(cfg.offsets_days?.length ? [...cfg.offsets_days].sort((a, b) => a - b) : DEFAULT_OFFSETS);
      setSlug(identity?.slug ?? null);
      setSenderName(identity?.name ?? federationName ?? null);
      setPlans(feePlans);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [federationId, federationName]);
  useEffect(() => { load(); }, [load]);

  const insertVar = useCallback((v: KarateReminderVar) => {
    const token = `{{${v}}}`;
    if (focusedField === "subject") {
      const { start, end } = subjectSel.current;
      setSubject((prev) => {
        const next = prev.slice(0, start) + token + prev.slice(end);
        const pos = start + token.length;
        subjectSel.current = { start: pos, end: pos };
        // Restaura o cursor após o insert — setNativeProps é best-effort
        // (nem toda plataforma honra selection via setNativeProps; se não
        // pegar, o cursor só fica no fim, o que ainda é usável).
        requestAnimationFrame(() => subjectRef.current?.setNativeProps?.({ selection: { start: pos, end: pos } } as any));
        return next;
      });
    } else {
      const { start, end } = bodySel.current;
      setBody((prev) => {
        const next = prev.slice(0, start) + token + prev.slice(end);
        const pos = start + token.length;
        bodySel.current = { start: pos, end: pos };
        requestAnimationFrame(() => bodyRef.current?.setNativeProps?.({ selection: { start: pos, end: pos } } as any));
        return next;
      });
    }
  }, [focusedField]);

  const onSubjectSelChange = (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
    subjectSel.current = e.nativeEvent.selection;
  };
  const onBodySelChange = (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
    bodySel.current = e.nativeEvent.selection;
  };

  const removeOffset = (v: number) => setOffsets((prev) => prev.filter((x) => x !== v));
  const commitAddOffset = () => {
    const n = parseInt(offsetTxt.replace(/[^-0-9]/g, ""), 10);
    setAddingOffset(false);
    setOffsetTxt("");
    if (!n || isNaN(n)) return;
    setOffsets((prev) => (prev.includes(n) ? prev : [...prev, n].sort((a, b) => a - b)));
  };

  const handleSave = async () => {
    if (offsets.length === 0) { toast.error("A régua precisa de ao menos um envio configurado."); return; }
    setSaving(true);
    try {
      const res = await karateApi.updateReminderConfig(federationId, {
        // Preserva o que não é desta tela (enabled/channel pertencem ao
        // controle de Configurações → Régua de cobrança).
        enabled: config?.enabled ?? false,
        channel: config?.channel ?? "email",
        offsets_days: offsets,
        subject_template: subject.trim() === DEFAULT_SUBJECT ? "" : subject,
        body_template: body.trim() === DEFAULT_BODY ? "" : body,
      });
      setConfig(res.config);
      toast.success("Régua salva");
    } catch (e: any) {
      // 422 VALIDATION_ERROR (variável desconhecida) já vem com mensagem
      // pronta em português, apontando a variável inválida (ver
      // src/routes/karateReminders.js) — só repassamos.
      toast.error(e?.message ?? "Não foi possível salvar a régua.");
    } finally {
      setSaving(false);
    }
  };

  // ── Modalidades de pagamento (bloco automático do e-mail — dojô) ────
  const dojoPlans = useMemo(() => {
    if (!plans) return null;
    const out: { plan: string; amount: number; months: number[] | null }[] = [];
    (["anual", "semestral", "trimestral"] as const).forEach((p) => {
      const fee = plans.find((f) => f.fee_type === "dojo" && f.plan === p);
      if (fee) out.push({ plan: p, amount: fee.amount, months: fee.due_months });
    });
    return out;
  }, [plans]);

  const planosVarText = useMemo(() => {
    if (!dojoPlans || !dojoPlans.length) {
      // Fallback de exemplo (mesmos valores canônicos do backfill/mockup)
      // quando a federação ainda não configurou "Valores e planos".
      return "Anual — R$ 500,00 (Mai) · Semestral — R$ 280,00 (Mai, Nov) · Trimestral — R$ 150,00 (Fev, Mai, Ago, Nov)";
    }
    return dojoPlans.map((p) => `${PLAN_LABEL[p.plan]} — ${fmtMoney(p.amount)}${p.months?.length ? ` (${monthsText(p.months)})` : ""}`).join(" · ");
  }, [dojoPlans]);

  const previewVars = { ...EXAMPLE_VARS, planos: planosVarText, pix_copia_cola: EXAMPLE_PIX };
  const renderedSubject = renderPreview(subject, previewVars);
  const renderedBody = renderPreview(body, previewVars);
  const bodyParagraphs = renderedBody.split(/\n{2,}/).filter(Boolean);

  const senderEmail = slug ? `${slug}@getaura.com.br` : null;
  const senderLabel = senderName || federationName || "Federação";
  const initial = (senderLabel || "F").trim().charAt(0).toUpperCase() || "F";

  if (loading) {
    return (
      <View style={{ gap: SP[6] }}>
        <SectionHead title="Régua de e-mail" sub="Assunto, mensagem e envios automáticos da cobrança por e-mail." />
        <View style={{ flexDirection: stacked ? "column" : "row", gap: 18 }}>
          <Skeleton height={520} style={{ borderRadius: R.xl, flex: stacked ? undefined : 1.05 }} />
          <Skeleton height={420} style={{ borderRadius: R.xl, flex: stacked ? undefined : 0.95 }} />
        </View>
      </View>
    );
  }
  if (error) return <KarateErrorState onRetry={load} style={{ paddingVertical: 60 }} />;

  return (
    <View style={{ gap: SP[6] }}>
      <SectionHead
        title="Régua de e-mail"
        sub="Assunto, mensagem e envios automáticos da cobrança por e-mail — o mesmo texto usado no envio manual (linha e barra de seleção)."
      />

      <View style={{ flexDirection: stacked ? "column" : "row", gap: 18, alignItems: "flex-start" }}>
        {/* ── Coluna esquerda: editor ─────────────────────────────── */}
        <View style={{ flex: stacked ? undefined : 1.05, width: stacked ? "100%" : undefined, gap: 18 }}>
          <View style={st.panel}>
            <Text style={st.panelTitle}>Lembrete de pagamento</Text>
            <Text style={st.panelDesc}>Mensagem enviada automaticamente pela régua e usada no envio manual (&quot;Enviar cobrança por e-mail&quot;).</Text>

            {/* Remetente — travado, nunca editável */}
            <View style={st.frow}>
              <Text style={st.flabel}>Remetente</Text>
              <View style={st.locked}>
                <Icon name="lock" size={13} color={C.ink3} />
                <Text style={st.lockedText} numberOfLines={1}>
                  {senderEmail ? `${senderLabel} <${senderEmail}>` : `${senderLabel} — endereço em provisionamento`}
                </Text>
                <View style={st.verifiedBadge}>
                  <Icon name="checkmark-circle" size={11} color={P.ok} />
                  <Text style={st.verifiedText}>Resend verificado</Text>
                </View>
              </View>
            </View>

            {/* Assunto */}
            <View style={st.frow}>
              <Text style={st.flabel}>Assunto</Text>
              <TextInput
                ref={subjectRef}
                style={st.input}
                value={subject}
                onChangeText={setSubject}
                onSelectionChange={onSubjectSelChange}
                onFocus={() => setFocusedField("subject")}
                accessibilityLabel="Assunto do e-mail de cobrança"
              />
            </View>

            {/* Mensagem */}
            <View style={st.frow}>
              <Text style={st.flabel}>Mensagem</Text>
              <TextInput
                ref={bodyRef}
                style={[st.input, st.textarea]}
                value={body}
                onChangeText={setBody}
                onSelectionChange={onBodySelChange}
                onFocus={() => setFocusedField("body")}
                multiline
                textAlignVertical="top"
                accessibilityLabel="Mensagem do e-mail de cobrança"
              />
              <View style={st.vars}>
                {KARATE_REMINDER_VARS.map((v) => <VarChip key={v} v={v} onPress={insertVar} />)}
              </View>
              <Text style={st.varsHint}>Toque numa variável para inserir no campo com foco ({focusedField === "subject" ? "assunto" : "mensagem"}).</Text>
            </View>

            {/* Offsets */}
            <View style={st.frow}>
              <Text style={st.flabel}>Envios da régua <Text style={st.flabelSoft}>(dias em relação ao vencimento de cada cobrança)</Text></Text>
              <View style={st.offsets}>
                {offsets.map((o) => (
                  <TouchableOpacity key={o} style={st.offOn} onPress={() => removeOffset(o)} accessibilityRole="button" accessibilityLabel={`Remover envio ${o > 0 ? `+${o}` : o} dias — toque para remover`}>
                    <Text style={st.offOnText}>{o > 0 ? `+${o}` : o}</Text>
                    <Icon name="close" size={9} color={P.red} />
                  </TouchableOpacity>
                ))}
                {addingOffset ? (
                  <View style={st.offAddRow}>
                    <TextInput
                      style={st.offAddInput}
                      value={offsetTxt}
                      onChangeText={(t) => setOffsetTxt(t.replace(/[^-0-9]/g, ""))}
                      keyboardType="numbers-and-punctuation"
                      placeholder="±dias"
                      placeholderTextColor={C.ink4}
                      autoFocus
                      onSubmitEditing={commitAddOffset}
                      onBlur={commitAddOffset}
                      accessibilityLabel="Novo envio, em dias (negativo = antes do vencimento)"
                    />
                  </View>
                ) : (
                  <TouchableOpacity style={st.offAdd} onPress={() => setAddingOffset(true)} accessibilityRole="button" accessibilityLabel="Adicionar novo envio">
                    <Text style={st.offAddText}>+ adicionar</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Régua automática — travada (OFF na maioria; ativar é controle
                de Configurações → Régua de cobrança, não desta tela). */}
            <View style={st.switchrow}>
              <View style={{ flex: 1 }}>
                <Text style={st.switchTitle}>Régua automática</Text>
                <Text style={st.switchSub}>
                  {config?.enabled
                    ? "Ativada em Configurações → Régua de cobrança — os envios automáticos seguem os estágios configurados lá."
                    : "Desativada — os envios ficam disponíveis apenas manualmente até a ativação."}
                </Text>
              </View>
              <LockedSwitch on={!!config?.enabled} />
            </View>

            <View style={st.saveRow}>
              <TouchableOpacity style={[st.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving} accessibilityRole="button" accessibilityLabel="Salvar régua">
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={st.saveBtnText}>Salvar régua</Text>}
              </TouchableOpacity>
            </View>
          </View>

          {/* Recebimento automático — em preparação. Texto EXATO do mockup;
              nenhuma menção a provedor/parceria/nada comercial. */}
          <View style={[st.panel, st.panelSoon]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={st.panelTitle}>Recebimento automático</Text>
              <View style={st.soonBadge}><Text style={st.soonBadgeText}>em preparação</Text></View>
            </View>
            <Text style={[st.panelDesc, { marginBottom: 0, marginTop: 6 }]}>
              Conciliação automática de PIX: a cobrança é baixada sozinha quando o pagamento é identificado. Disponível em breve para esta federação.
            </Text>
          </View>
        </View>

        {/* ── Coluna direita: pré-visualização ao vivo ────────────── */}
        <View style={{ flex: stacked ? undefined : 0.95, width: stacked ? "100%" : undefined }}>
          <View style={st.mailframe}>
            <View style={st.mailmeta}>
              <Text style={st.mailmetaLine}><Text style={st.mailmetaBold}>Pré-visualização</Text> · dados de exemplo</Text>
              <Text style={st.mailmetaLine}>De: <Text style={st.mailmetaBold}>{senderLabel} {senderEmail ? `<${senderEmail}>` : ""}</Text> · Para: {EXAMPLE_RECIPIENT}</Text>
              <Text style={st.mailmetaLine}>Assunto: <Text style={st.mailmetaBold}>{renderedSubject || "(vazio)"}</Text></Text>
            </View>

            <View style={st.mailCard}>
              <View style={st.mailHead}>
                <View style={st.mailLogo}><Text style={st.mailLogoText}>{initial}</Text></View>
                <Text style={st.mailFedName}>{senderLabel}</Text>
                <View style={st.mailRule} />
              </View>
              <View style={st.mailBody}>
                {bodyParagraphs.length === 0 ? (
                  <Text style={st.mailP}>(mensagem vazia)</Text>
                ) : bodyParagraphs.map((p, i) => (
                  <Text key={i} style={st.mailP}>{p}</Text>
                ))}

                <View style={st.mailBox}>
                  <Text style={st.mailBoxK}>Modalidades de pagamento — dojô</Text>
                  {(dojoPlans && dojoPlans.length ? dojoPlans : [
                    { plan: "anual", amount: 500, months: [5] },
                    { plan: "semestral", amount: 280, months: [5, 11] },
                    { plan: "trimestral", amount: 150, months: [2, 5, 8, 11] },
                  ]).map((p) => (
                    <View key={p.plan} style={st.mailRow}>
                      <Text style={st.mailRowLabel}>{PLAN_LABEL[p.plan]}{p.months?.length ? ` · venc. ${monthsText(p.months)}` : ""}</Text>
                      <Text style={st.mailRowValue}>{fmtMoney(p.amount)}</Text>
                    </View>
                  ))}
                </View>

                <View style={st.mailBox}>
                  <Text style={st.mailBoxK}>PIX da federação — copia e cola</Text>
                  <Text style={st.copiacola}>{EXAMPLE_PIX}</Text>
                </View>

                <Text style={[st.mailP, { marginTop: 10 }]}>Após o pagamento, responda este e-mail com o comprovante.</Text>
                <View style={st.mailCta}><Text style={st.mailCtaText}>Falar com a federação</Text></View>
              </View>
              <Text style={st.mailFoot}>Enviado pela {senderLabel} via Aura · Você recebe este e-mail por ser filiado à federação.</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  panel: { backgroundColor: P.glass, borderWidth: 1, borderColor: C.line, borderRadius: R.xl, padding: 20 } as ViewStyle,
  panelSoon: { borderStyle: "dashed", opacity: 0.92 } as ViewStyle,
  panelTitle: { fontFamily: F.heading, fontSize: 17, fontWeight: "400", color: C.ink } as TextStyle,
  panelDesc: { fontFamily: F.body, fontSize: 12.5, color: C.ink3, marginTop: 4, marginBottom: 16, lineHeight: 18 } as TextStyle,

  soonBadge: { borderWidth: 1, borderColor: C.line, borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 2 } as ViewStyle,
  soonBadgeText: { fontFamily: F.body, fontSize: 11, color: C.ink3 } as TextStyle,

  frow: { marginBottom: 16 } as ViewStyle,
  flabel: { fontFamily: F.body, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6, color: C.ink3, marginBottom: 7 } as TextStyle,
  flabelSoft: { textTransform: "none", letterSpacing: 0, fontWeight: "400" } as TextStyle,

  locked: { flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: P.paperWarm, borderWidth: 1, borderColor: C.line, borderRadius: R.md, paddingVertical: 10, paddingHorizontal: 13 } as ViewStyle,
  lockedText: { flex: 1, fontFamily: F.body, fontSize: 13, fontWeight: "600", color: C.ink } as TextStyle,
  verifiedBadge: { flexDirection: "row", alignItems: "center", gap: 5 } as ViewStyle,
  verifiedText: { fontFamily: F.body, fontSize: 11, fontWeight: "700", color: P.ok } as TextStyle,

  input: { width: "100%", backgroundColor: "#fff", borderWidth: 1, borderColor: C.line, borderRadius: R.md, paddingVertical: 10, paddingHorizontal: 13, fontFamily: F.body, fontSize: 13.5, color: C.ink } as TextStyle,
  textarea: { minHeight: 150, lineHeight: 20 } as TextStyle,

  vars: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 } as ViewStyle,
  varChip: { borderWidth: 1, borderColor: C.line, borderStyle: "dashed", borderRadius: R.sm, paddingVertical: 3, paddingHorizontal: 9, backgroundColor: P.glass },
  varChipText: { fontFamily: F.mono, fontSize: 11.5, color: P.red } as TextStyle,
  varsHint: { fontFamily: F.body, fontSize: 10.5, color: C.ink4, marginTop: 6, fontStyle: "italic" } as TextStyle,

  offsets: { flexDirection: "row", flexWrap: "wrap", gap: 7, alignItems: "center" } as ViewStyle,
  offOn: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: P.redLine, backgroundColor: P.redWash, borderRadius: R.pill, paddingVertical: 5, paddingHorizontal: 12 } as ViewStyle,
  offOnText: { fontFamily: F.body, fontSize: 12, fontWeight: "700", color: P.red } as TextStyle,
  offAdd: { borderWidth: 1, borderColor: C.line, borderRadius: R.pill, paddingVertical: 5, paddingHorizontal: 13 } as ViewStyle,
  offAddText: { fontFamily: F.body, fontSize: 12, color: C.ink3 } as TextStyle,
  offAddRow: { flexDirection: "row", alignItems: "center" } as ViewStyle,
  offAddInput: { width: 66, borderWidth: 1, borderColor: P.red, borderRadius: R.pill, paddingVertical: 5, paddingHorizontal: 12, fontFamily: F.mono, fontSize: 12, color: C.ink, textAlign: "center" } as TextStyle,

  switchrow: { flexDirection: "row", alignItems: "center", gap: 14, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 16, marginTop: 4 } as ViewStyle,
  switchTitle: { fontFamily: F.body, fontSize: 13.5, fontWeight: "700", color: C.ink } as TextStyle,
  switchSub: { fontFamily: F.body, fontSize: 11.5, color: C.ink3, marginTop: 3, lineHeight: 16 } as TextStyle,
  switchTrack: { width: 42, height: 24, borderRadius: R.pill, backgroundColor: "#ddd6c6", justifyContent: "center", flexShrink: 0 } as ViewStyle,
  switchTrackOn: { backgroundColor: P.ok } as ViewStyle,
  switchThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: "#fff", marginLeft: 3, ...(Platform.OS === "web" ? ({ boxShadow: "0 1px 3px rgba(0,0,0,0.2)" } as any) : {}) } as ViewStyle,
  switchThumbOn: { marginLeft: 21 } as ViewStyle,

  saveRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 14 } as ViewStyle,
  saveBtn: { backgroundColor: P.red, borderRadius: R.md, paddingVertical: 10, paddingHorizontal: 20 } as ViewStyle,
  saveBtnText: { fontFamily: F.body, fontSize: 13, fontWeight: "700", color: "#fff" } as TextStyle,

  // ── Pré-visualização ──────────────────────────────────────────
  mailframe: { backgroundColor: P.paper2, borderWidth: 1, borderColor: C.line, borderRadius: R.xl, padding: 18 } as ViewStyle,
  mailmeta: { marginBottom: 12, gap: 3 } as ViewStyle,
  mailmetaLine: { fontFamily: F.body, fontSize: 11.5, color: C.ink3, lineHeight: 17 } as TextStyle,
  mailmetaBold: { fontWeight: "700", color: C.ink } as TextStyle,

  mailCard: { backgroundColor: "#fff", borderWidth: 1, borderColor: C.line, borderRadius: R.lg, overflow: "hidden", maxWidth: 430, alignSelf: "center", width: "100%" } as ViewStyle,
  mailHead: { paddingTop: 20, paddingHorizontal: 24, alignItems: "center" } as ViewStyle,
  mailLogo: { width: 44, height: 44, borderRadius: 22, backgroundColor: P.red, alignItems: "center", justifyContent: "center", marginBottom: 10 } as ViewStyle,
  mailLogoText: { fontFamily: F.heading, fontSize: 15, color: "#fff" } as TextStyle,
  mailFedName: { fontFamily: F.heading, fontSize: 18, fontWeight: "400", color: C.ink, textAlign: "center" } as TextStyle,
  mailRule: { width: 56, height: 2, backgroundColor: P.red, marginTop: 12, marginBottom: 6 } as ViewStyle,
  mailBody: { paddingHorizontal: 24, paddingTop: 6, paddingBottom: 22 } as ViewStyle,
  mailP: { fontFamily: F.body, fontSize: 13, color: "#4a443c", lineHeight: 20, marginBottom: 8 } as TextStyle,
  mailBox: { backgroundColor: "#f8f5ec", borderWidth: 1, borderColor: C.line, borderRadius: R.md, padding: 12, marginVertical: 8 } as ViewStyle,
  mailBoxK: { fontFamily: F.body, fontSize: 10.5, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6, color: C.ink3, marginBottom: 6 } as TextStyle,
  mailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 } as ViewStyle,
  mailRowLabel: { fontFamily: F.body, fontSize: 12, color: "#4a443c", flex: 1, paddingRight: 8 } as TextStyle,
  mailRowValue: { fontFamily: F.heading, fontSize: 12.5, fontWeight: "400", color: C.ink } as TextStyle,
  copiacola: { fontFamily: F.mono, fontSize: 10.5, color: C.ink, backgroundColor: "#fff", borderWidth: 1, borderColor: C.line, borderStyle: "dashed", borderRadius: R.sm, padding: 8, marginTop: 4 } as TextStyle,
  mailCta: { backgroundColor: P.red, borderRadius: R.md, paddingVertical: 11, alignItems: "center", marginTop: 14 } as ViewStyle,
  mailCtaText: { fontFamily: F.body, fontSize: 13, fontWeight: "700", color: "#fff" } as TextStyle,
  mailFoot: { textAlign: "center", fontFamily: F.body, fontSize: 10.5, color: C.ink4, paddingHorizontal: 24, paddingBottom: 18 } as TextStyle,
});

export default AnnuityReguaPanel;
