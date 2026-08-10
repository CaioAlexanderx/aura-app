// ============================================================
// DojoExamCertificatesManager — Aura Dojô · F9.1
//
// "Vamos deixar o certificado dentro de eventos, idêntico ao que temos
//  na federação. Dentro de eventos vamos fazer a emissão e impressão em
//  massa e também criar o design." (dono do produto, 04/08/2026)
//
// Este componente é o equivalente-dojô de
// components/karate/EventCertificatesManager.tsx (federação): monta o
// modelo (layout, selos, fonte, tamanho, texto padrão/custom) com
// PREVIEW ao vivo, emite em lote a partir de um exame de kyu CONCLUÍDO
// (elegível = aprovado) e lista/baixa/imprime os emitidos — reusando o
// MESMO motor de renderização (buildCertificateHtml.ts,
// CertificatePreview.tsx) SEM alterá-lo.
//
// ⚠️ ONDE ESTE ARQUIVO VAI MORAR: a tela de detalhe do exame de kyu do
// dojô ("Meus eventos" → exame) está sendo construída por outro agente
// em paralelo (ver components/karate/dojoEventos/MeusEventosTab.tsx,
// comentário "consumidor daquele fluxo é outra tela, ainda não
// construída"). Este componente é AUTOSSUFICIENTE e pronto para ser
// embutido lá assim que existir:
//
//   <DojoExamCertificatesManager
//     federationId={federationId}
//     exam={{ id: exam.id, title: exam.title, exam_date: exam.exam_date,
//             examiner_name: exam.examiner_name }}
//     dojoName={dojoName}
//   />
//
// (só exige que o exame esteja com status='completed' — resultado já
// lançado — para haver aprovados a certificar; a própria emissão do
// backend filtra por result='approved').
//
// ── DUAS DIFERENÇAS ESTRUTURAIS vs EventCertificatesManager ─
//   1) SIGNATORIES SÃO DO MODELO, NÃO DO EVENTO — o exame do dojô não
//      tem uma tabela de "instrutores do evento" (a federação usa
//      GET .../instructors). Aqui a assinatura é editada AQUI MESMO,
//      dentro do editor, e persiste no template (signatories). Se o
//      sensei não configurar nenhuma, o backend cai para o
//      examiner_name do exame — texto de apoio abaixo do editor deixa
//      isso explícito.
//   2) "SALVAR MODELO" é opcional e SEPARADO de "EMITIR" — o editor
//      sempre EMITE com o estado atual da tela (o que o sensei vê no
//      preview é exatamente o que sai), nunca com uma versão salva e
//      potencialmente desatualizada. "Salvar modelo" só persiste o
//      template (karate_dojo_certificate_templates) para reabrir pronto
//      da próxima vez — sem isso o sensei reconfiguraria o certificado
//      do zero a cada exame.
//
// ── NÃO OFICIAL, sem soar inferior ───────────────────────────
// Faixa de aviso no topo: deixa claro que este é o certificado do
// PRÓPRIO DOJÔ (documento que o sensei entrega na hora), distinto do
// certificado OFICIAL da federação (pedido em
// app/karate/(dojo)/certificados.tsx). Tom informativo, não de alerta
// (ícone "info", não "alert") — não é um erro, é uma categoria diferente
// de documento.
//
// ── IMPRESSÃO EM MASSA ───────────────────────────────────────
// components/karate/certificado/printCertificatesBatch.ts (novo, não
// altera os arquivos reusados) — UMA janela, UMA impressão, um
// certificado por página. Download individual continua sendo
// printCertificate (mesmo caminho já usado pela federação).
//
// ── QA 09/08/2026 (item 1): "Sensei Sensei X" no texto de apoio e no
// próprio certificado ─────────────────────────────────────────
// O examiner_name do exame já vem preenchido como "Sensei X" — é assim
// que o examinador se identifica ao preencher o campo em outra tela.
// Este componente prefixava "Sensei " de novo por cima (tanto no texto
// de apoio abaixo quanto em instructorsText, que alimenta o PREVIEW e
// é o mesmo padrão usado para montar o texto que vai pro documento
// emitido via buildCertificateHtml), duplicando SEMPRE. Corrigido na
// raiz: nenhum prefixo é inventado aqui — nome do examinador e de cada
// assinatura aparecem exatamente como foram digitados. Quem quiser o
// título no certificado escreve o próprio nome/cargo.
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Switch, Platform, ViewStyle, TextStyle } from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors as P, KarateRadius, KarateFonts } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { karateDojoCertApi, DojoCertTemplateRow } from "@/services/karateDojoCertApi";
import { CertificatePreview, printCertificate } from "@/components/karate/certificado/CertificatePreview";
import { printCertificatesBatch, BatchCertificateItem } from "@/components/karate/certificado/printCertificatesBatch";
import type { CertLayout, CertFont, CertSeal, CertSignatory, CertData, CertTemplate } from "@/components/karate/certificado/buildCertificateHtml";
import { CERT_FONTS } from "@/components/karate/certificado/buildCertificateHtml";

const LAYOUTS: { key: CertLayout; label: string }[] = [
  { key: "A", label: "Clássico" }, { key: "B", label: "Kraft" }, { key: "C", label: "Sumi-ê" },
  { key: "D", label: "Lateral" }, { key: "E", label: "Dupla borda" },
];
const FONT_KEYS: CertFont[] = ["classica", "imponente", "elegante", "sofisticada", "tradicional"];
type SizeMode = "auto" | "P" | "M" | "G";
const SIZES: { key: SizeMode; label: string }[] = [
  { key: "auto", label: "Auto" }, { key: "P", label: "Pequeno" }, { key: "M", label: "Médio" }, { key: "G", label: "Grande" },
];
const SIZE_SCALE: Record<Exclude<SizeMode, "auto">, number> = { P: 0.9, M: 1, G: 1.15 };
const VERIFY_BASE = "https://app.getaura.com.br/karate/verify/dojo-cert";

const CERT_TAGS: { tag: string; label: string }[] = [
  { tag: "nome", label: "Nome" },
  { tag: "curso", label: "Exame" },
  { tag: "ministrantes", label: "Assinaturas" },
  { tag: "datas", label: "Data do exame" },
  { tag: "local", label: "Local" },
  { tag: "data_emissao", label: "Data de emissão" },
];
const DEFAULT_BODY_TEMPLATE =
  "Certificamos que {nome} foi aprovado(a) no {curso}, realizado {datas}.";

function pickImage(): Promise<{ base64: string; ct: string } | null> {
  return new Promise((resolve) => {
    if (Platform.OS !== "web") return resolve(null);
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/webp,image/jpeg";
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      if (f.size > 5 * 1024 * 1024) { alert("Imagem muito grande (máx 5 MB)"); return resolve(null); }
      const r = new FileReader();
      r.onload = () => resolve({ base64: String(r.result).split(",")[1], ct: f.type || "image/png" });
      r.readAsDataURL(f);
    };
    input.click();
  });
}
function fmtBR(d?: string | null): string {
  if (!d) return "";
  const x = new Date(d);
  if (isNaN(x.getTime())) return "";
  return `${String(x.getUTCDate()).padStart(2, "0")}/${String(x.getUTCMonth() + 1).padStart(2, "0")}/${x.getUTCFullYear()}`;
}

export interface DojoExamRef {
  id: string;
  title?: string | null;
  exam_date?: string | null;
  examiner_name?: string | null;
  status?: string;
}

export function DojoExamCertificatesManager({ federationId, exam, dojoName }: {
  federationId: string;
  exam: DojoExamRef;
  dojoName?: string | null;
}) {
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(true);

  const [layout, setLayout] = useState<CertLayout>("A");
  const [title, setTitle] = useState("CERTIFICADO");
  const [customText, setCustomText] = useState(false);
  const [bodyText, setBodyText] = useState("");
  const [seals, setSeals] = useState<CertSeal[]>([]);
  const [font, setFont] = useState<CertFont>("classica");
  const [sizeMode, setSizeMode] = useState<SizeMode>("M");
  const [signatories, setSignatories] = useState<CertSignatory[]>([]);
  const [location, setLocation] = useState("");

  const [issued, setIssued] = useState<{ id: string; verify_token: string; data_snapshot: any; template_snapshot: any }[]>([]);
  const [busy, setBusy] = useState(false);
  const [savingTpl, setSavingTpl] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const applyTemplate = (t: DojoCertTemplateRow) => {
    setTemplateId(t.id);
    setLayout(t.layout);
    setTitle(t.title);
    setCustomText(t.body_mode === "custom");
    setBodyText(t.body_text || (t.body_mode === "custom" ? DEFAULT_BODY_TEMPLATE : ""));
    setSeals(t.seals || []);
    setSignatories(t.signatories || []);
    setFont(t.font);
    if (t.auto_fit) setSizeMode("auto");
    else if (t.text_scale === 0.9) setSizeMode("P");
    else if (t.text_scale === 1.15) setSizeMode("G");
    else setSizeMode("M");
  };

  const load = useCallback(async () => {
    setLoadingTemplate(true);
    try {
      const [tpls, iss] = await Promise.all([
        karateDojoCertApi.listTemplates(federationId).catch(() => []),
        karateDojoCertApi.listIssuedByExam(federationId, exam.id).catch(() => []),
      ]);
      const preferred = tpls.find((t) => t.is_default) || tpls[0];
      if (preferred) applyTemplate(preferred);
      setIssued(iss);
    } catch (e: any) {
      setErr(e?.message ?? "Erro ao carregar");
    } finally {
      setLoadingTemplate(false);
    }
  }, [federationId, exam.id]);
  useEffect(() => { load(); }, [load]);

  const sizeFields = sizeMode === "auto"
    ? { auto_fit: true as const }
    : { text_scale: SIZE_SCALE[sizeMode] };
  const template: CertTemplate = {
    layout, title, body_mode: customText ? "custom" : "default", body_text: customText ? bodyText : null, seals, font, ...sizeFields,
  };

  // QA 09/08/2026 (item 1): nomes exibidos EXATAMENTE como digitados —
  // nunca inventamos um prefixo de tratamento aqui. O examinador já é
  // cadastrado como "Sensei Fulano" (é assim que ele mesmo se identifica
  // ao preencher o exame), então prefixar de novo duplicava ("Sensei
  // Sensei Fulano"). Isso alimenta tanto o PREVIEW quanto — via
  // instructors_text — o mesmo tipo de campo que acaba indo pro documento
  // renderizado por buildCertificateHtml. Quem quiser o título no
  // certificado escreve o próprio nome/cargo (signatories já tem um campo
  // "role" separado pra isso).
  const instructorsText = signatories.length
    ? (signatories.length === 1 ? signatories[0].name
      : signatories.slice(0, -1).map((s) => s.name).join(", ") + ` e ${signatories[signatories.length - 1].name}`)
    : (exam.examiner_name || "");

  const previewData: CertData = {
    participant_name: "NOME DO ALUNO",
    course_name: exam.title ? `Exame de Graduação de Faixa — ${exam.title}` : "Exame de Graduação de Faixa (kyu)",
    instructors_text: instructorsText,
    dates_text: fmtBR(exam.exam_date),
    location: location || "",
    issued_date_text: fmtBR(new Date().toISOString()),
    federation_name: dojoName || "Dojô",
    signatories,
    verify_url: `${VERIFY_BASE}/exemplo`,
  };

  // ── Selos e assinaturas (upload) ────────────────────────────
  const addSeal = async () => {
    const p = await pickImage(); if (!p) return;
    setBusy(true); setErr(null);
    try {
      const { url } = await karateDojoCertApi.uploadAsset(federationId, p.base64, p.ct, "seal");
      setSeals((s) => [...s, { label: "Selo", image_url: url }]);
    } catch (e: any) { setErr(e?.message ?? "Erro ao subir selo"); }
    finally { setBusy(false); }
  };
  const removeSeal = (idx: number) => setSeals((s) => s.filter((_, i) => i !== idx));

  const addSignatory = () => setSignatories((s) => [...s, { name: "", role: "Sensei / Examinador", signature_url: null }]);
  const removeSignatory = (idx: number) => setSignatories((s) => s.filter((_, i) => i !== idx));
  const updateSignatory = (idx: number, patch: Partial<CertSignatory>) =>
    setSignatories((s) => s.map((sig, i) => (i === idx ? { ...sig, ...patch } : sig)));
  const uploadSignatureImage = async (idx: number) => {
    const p = await pickImage(); if (!p) return;
    setBusy(true); setErr(null);
    try {
      const { url } = await karateDojoCertApi.uploadAsset(federationId, p.base64, p.ct, "signature");
      updateSignatory(idx, { signature_url: url });
    } catch (e: any) { setErr(e?.message ?? "Erro ao subir assinatura"); }
    finally { setBusy(false); }
  };

  const insertTag = (tag: string) =>
    setBodyText((t) => (t && !/\s$/.test(t) ? t + " " : t) + `{${tag}}`);
  const toggleCustom = (on: boolean) => {
    setCustomText(on);
    if (on && !bodyText.trim()) setBodyText(DEFAULT_BODY_TEMPLATE);
  };

  // ── Salvar modelo (opcional — persiste para reabrir pronto) ──
  const saveTemplate = async () => {
    setSavingTpl(true); setErr(null); setMsg(null);
    try {
      const body = {
        name: "Certificado do dojô",
        layout, title, body_mode: customText ? ("custom" as const) : ("default" as const),
        body_text: customText ? bodyText : null,
        seals, signatories, font, is_default: true,
        ...sizeFields,
      };
      const saved = templateId
        ? await karateDojoCertApi.updateTemplate(federationId, templateId, body)
        : await karateDojoCertApi.createTemplate(federationId, body);
      setTemplateId(saved.id);
      setMsg("Modelo salvo — pronto para reusar em outros exames.");
    } catch (e: any) { setErr(e?.message ?? "Erro ao salvar o modelo"); }
    finally { setSavingTpl(false); }
  };

  // ── Emissão em massa (sempre com o estado ATUAL da tela — nunca um
  //     modelo salvo potencialmente desatualizado) ──────────────
  const emit = async () => {
    setBusy(true); setErr(null); setMsg(null);
    try {
      const r = await karateDojoCertApi.emit(federationId, exam.id, {
        template: {
          layout, title, body_mode: customText ? "custom" : "default", body_text: customText ? bodyText : null,
          seals, signatories, font, ...sizeFields,
        },
        location: location || undefined,
      });
      if (r.eligible === 0) {
        setMsg("Nenhum aprovado neste exame ainda — lance o resultado antes de emitir.");
      } else {
        setMsg(`Emitidos ${r.issued} certificado(s)${r.skipped ? `, ${r.skipped} já existiam` : ""} (aprovados: ${r.eligible}).`);
      }
      const iss = await karateDojoCertApi.listIssuedByExam(federationId, exam.id);
      setIssued(iss);
    } catch (e: any) { setErr(e?.message ?? "Erro ao emitir"); }
    finally { setBusy(false); }
  };

  const download = (c: { data_snapshot: any; template_snapshot: any; verify_token: string }) => {
    const d = { ...c.data_snapshot, verify_url: `${VERIFY_BASE}/${c.verify_token}` } as CertData;
    printCertificate(d, c.template_snapshot as CertTemplate);
  };

  const printAll = () => {
    if (!issued.length) return;
    const items: BatchCertificateItem[] = issued.map((c) => ({
      data: { ...c.data_snapshot, verify_url: `${VERIFY_BASE}/${c.verify_token}` } as CertData,
      template: c.template_snapshot as CertTemplate,
    }));
    printCertificatesBatch(items);
  };

  return (
    <View style={s.card}>
      {/* Faixa "não oficial" — informativa, não de alerta */}
      <View style={s.notice}>
        <Icon name="info" size={15} color={P.ink3} />
        <Text style={s.noticeTxt}>
          Este é o certificado do <Text style={{ fontWeight: "800" }}>PRÓPRIO DOJÔ</Text> — não substitui o certificado OFICIAL da federação.
          O pedido oficial (FPKT) continua na aba <Text style={{ fontWeight: "700" }}>Certificados</Text>, na área do dojô.
        </Text>
      </View>

      <Text style={s.title}>Certificado do dojô</Text>
      <Text style={s.sub}>
        Monte o modelo (layout, selos, assinatura e texto), veja o preview e emita em lote para os APROVADOS deste exame
        {exam.title ? ` (${exam.title})` : ""}.
      </Text>

      {loadingTemplate ? (
        <ActivityIndicator style={{ marginTop: 16 }} color={P.primary} />
      ) : (
        <>
          {/* Layout */}
          <Text style={s.lbl}>Layout</Text>
          <View style={s.chips}>
            {LAYOUTS.map((l) => (
              <TouchableOpacity key={l.key} onPress={() => setLayout(l.key)} style={[s.chip, layout === l.key && s.chipOn]}>
                <Text style={[s.chipTxt, layout === l.key && s.chipTxtOn]}>{l.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Fonte */}
          <Text style={s.lbl}>Fonte</Text>
          <View style={s.chips}>
            {FONT_KEYS.map((k) => (
              <TouchableOpacity key={k} onPress={() => setFont(k)} style={[s.chip, font === k && s.chipOn]}>
                <Text style={[s.chipTxt, font === k && s.chipTxtOn]}>{CERT_FONTS[k].label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Tamanho do texto */}
          <Text style={s.lbl}>Tamanho do texto</Text>
          <View style={s.chips}>
            {SIZES.map((z) => (
              <TouchableOpacity key={z.key} onPress={() => setSizeMode(z.key)} style={[s.chip, sizeMode === z.key && s.chipOn]}>
                <Text style={[s.chipTxt, sizeMode === z.key && s.chipTxtOn]}>{z.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Título e local */}
          <Text style={s.lbl}>Título do certificado</Text>
          <TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="CERTIFICADO" placeholderTextColor={P.ink4} />
          <Text style={s.lbl}>Local (opcional)</Text>
          <TextInput style={s.input} value={location} onChangeText={setLocation} placeholder="Ex.: São Paulo" placeholderTextColor={P.ink4} />

          {/* Selos */}
          <Text style={s.lbl}>Selos (PNG)</Text>
          <View style={s.sealRow}>
            {seals.map((sl, i) => (
              <View key={i} style={s.sealItem}>
                <Text style={s.sealTxt}>{sl.label || "Selo"}</Text>
                <TouchableOpacity onPress={() => removeSeal(i)} hitSlop={6}><Icon name="x" size={13} color={P.danger} /></TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity onPress={addSeal} style={s.sealAdd}><Icon name="plus" size={13} color={P.primary} /><Text style={s.sealAddTxt}>Selo</Text></TouchableOpacity>
          </View>

          {/* Assinaturas — do MODELO (diferente da federação: aqui não há
              tabela de instrutores do evento; a assinatura mora no editor) */}
          <Text style={s.lbl}>Assinatura(s) do modelo</Text>
          <Text style={s.hint}>
            Se você não adicionar nenhuma assinatura, o certificado usa automaticamente o examinador do exame
            {exam.examiner_name ? ` (${exam.examiner_name})` : ""}.
          </Text>
          {signatories.map((sig, i) => (
            <View key={i} style={s.sigRow}>
              <TextInput
                style={[s.input, { flex: 1, marginTop: 0 }]}
                value={sig.name}
                onChangeText={(v) => updateSignatory(i, { name: v })}
                placeholder="Nome do assinante"
                placeholderTextColor={P.ink4}
              />
              <TextInput
                style={[s.input, { flex: 1, marginTop: 0 }]}
                value={sig.role || ""}
                onChangeText={(v) => updateSignatory(i, { role: v })}
                placeholder="Cargo (ex.: Sensei / Examinador)"
                placeholderTextColor={P.ink4}
              />
              <TouchableOpacity onPress={() => uploadSignatureImage(i)} style={s.sigImgBtn}>
                <Icon name="upload" size={13} color={P.primary} />
                <Text style={s.sigImgTxt}>{sig.signature_url ? "Trocar imagem" : "Imagem"}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => removeSignatory(i)} hitSlop={6}><Icon name="x" size={15} color={P.danger} /></TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity onPress={addSignatory} style={s.sealAdd}>
            <Icon name="plus" size={13} color={P.primary} /><Text style={s.sealAddTxt}>Assinatura</Text>
          </TouchableOpacity>

          {/* Texto */}
          <View style={s.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.lbl}>Texto personalizado</Text>
              <Text style={s.hint}>Desligado usa o texto padrão. Ligado, você escreve o texto e insere etiquetas.</Text>
            </View>
            <Switch value={customText} onValueChange={toggleCustom} trackColor={{ false: P.border, true: P.primary }} thumbColor={P.bg} />
          </View>
          {customText ? (
            <>
              <Text style={[s.hint, { marginTop: 8 }]}>Toque para inserir uma etiqueta:</Text>
              <View style={s.tagRow}>
                {CERT_TAGS.map((t) => (
                  <TouchableOpacity key={t.tag} onPress={() => insertTag(t.tag)} style={s.tagChip}>
                    <Text style={s.tagChipTxt}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity onPress={() => setBodyText(DEFAULT_BODY_TEMPLATE)} style={s.tplChip}>
                  <Text style={s.tplChipTxt}>↺ Modelo padrão</Text>
                </TouchableOpacity>
              </View>
              <TextInput style={[s.input, { minHeight: 90, textAlignVertical: "top" }]} value={bodyText} onChangeText={setBodyText} multiline
                placeholder="Ex.: Certificamos que {nome} foi aprovado(a) no {curso}…" placeholderTextColor={P.ink4} />
            </>
          ) : null}

          {/* Preview */}
          <Text style={s.lbl}>Pré-visualização</Text>
          <CertificatePreview data={previewData} template={template} width={560} />

          {err ? <Text style={s.err}>{err}</Text> : null}
          {msg ? <Text style={s.ok}>{msg}</Text> : null}

          <View style={s.actions}>
            <KarateButton label={savingTpl ? "Salvando…" : "Salvar modelo"} variant="secondary" size="md" loading={savingTpl} onPress={saveTemplate} />
            <KarateButton label={busy ? "Emitindo…" : "Emitir certificados"} variant="sumi" size="md" loading={busy} onPress={emit} style={{ flex: 1 }} />
          </View>

          {/* Emitidos */}
          {issued.length > 0 ? (
            <>
              <View style={s.issuedHead}>
                <Text style={s.lbl}>Emitidos ({issued.length})</Text>
                {Platform.OS === "web" ? (
                  <TouchableOpacity onPress={printAll} style={s.printAllBtn} accessibilityRole="button" accessibilityLabel="Imprimir todos os certificados">
                    <Icon name="download" size={13} color={P.primary} />
                    <Text style={s.printAllTxt}>Imprimir todos</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              {issued.map((c) => (
                <View key={c.id} style={s.issuedRow}>
                  <Text style={s.issuedName} numberOfLines={1}>{c.data_snapshot?.participant_name || "—"}</Text>
                  <TouchableOpacity onPress={() => download(c)} style={s.iconBtn}><Icon name="download" size={15} color={P.primary} /></TouchableOpacity>
                  {Platform.OS === "web" ? (
                    <TouchableOpacity onPress={() => window.open(`${VERIFY_BASE}/${c.verify_token}`, "_blank")} style={s.iconBtn}><Icon name="qr_code" size={15} color={P.ink3} /></TouchableOpacity>
                  ) : null}
                </View>
              ))}
            </>
          ) : null}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderColor: P.border, borderRadius: KarateRadius.lg, backgroundColor: P.glass, padding: 16, marginTop: 12 } as ViewStyle,
  notice: { flexDirection: "row", gap: 8, backgroundColor: P.bg2, borderRadius: 10, padding: 10, marginBottom: 12, alignItems: "flex-start" } as ViewStyle,
  noticeTxt: { flex: 1, fontSize: 11.5, color: P.ink3, lineHeight: 16 } as TextStyle,
  title: { fontFamily: KarateFonts.heading, fontSize: 16, color: P.ink } as TextStyle,
  sub: { fontSize: 12, color: P.ink3, marginTop: 3, lineHeight: 16 } as TextStyle,
  lbl: { fontSize: 11.5, color: P.ink3, marginTop: 14, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.3 } as TextStyle,
  hint: { fontSize: 10.5, color: P.ink4, lineHeight: 14, marginBottom: 4 } as TextStyle,
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 } as ViewStyle,
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: P.border, backgroundColor: P.bg } as ViewStyle,
  chipOn: { backgroundColor: P.primarySoft, borderColor: P.primaryLine } as ViewStyle,
  chipTxt: { fontSize: 12.5, color: P.ink2 } as TextStyle,
  chipTxtOn: { color: P.primary, fontWeight: "700" } as TextStyle,
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4, marginBottom: 2 } as ViewStyle,
  tagChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: P.border, backgroundColor: P.bg } as ViewStyle,
  tagChipTxt: { fontSize: 11.5, color: P.ink2 } as TextStyle,
  tplChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: P.primaryLine, backgroundColor: P.primarySoft } as ViewStyle,
  tplChipTxt: { fontSize: 11.5, color: P.primary, fontWeight: "600" } as TextStyle,
  sealRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" } as ViewStyle,
  sealItem: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: P.border, backgroundColor: P.bg } as ViewStyle,
  sealTxt: { fontSize: 12, color: P.ink2 } as TextStyle,
  sealAdd: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: P.primaryLine, backgroundColor: P.primarySoft, marginTop: 8 } as ViewStyle,
  sealAddTxt: { fontSize: 12, color: P.primary, fontWeight: "600" } as TextStyle,
  sigRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" } as ViewStyle,
  sigImgBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: P.border, backgroundColor: P.bg } as ViewStyle,
  sigImgTxt: { fontSize: 11.5, color: P.primary, fontWeight: "600" } as TextStyle,
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 6 } as ViewStyle,
  input: { borderWidth: 1, borderColor: P.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13.5, color: P.ink, backgroundColor: P.bg, marginTop: 6 } as any,
  err: { color: P.danger, fontSize: 12.5, marginTop: 10 } as TextStyle,
  ok: { color: P.ok, fontSize: 12.5, marginTop: 10 } as TextStyle,
  actions: { flexDirection: "row", gap: 10, marginTop: 14 } as ViewStyle,
  issuedHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14 } as ViewStyle,
  printAllBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: P.primaryLine, backgroundColor: P.primarySoft } as ViewStyle,
  printAllTxt: { fontSize: 12, color: P.primary, fontWeight: "700" } as TextStyle,
  issuedRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 9, borderTopWidth: 1, borderTopColor: P.border } as ViewStyle,
  issuedName: { flex: 1, minWidth: 0, fontSize: 13, color: P.ink } as TextStyle,
  iconBtn: { padding: 6, borderRadius: 8 } as ViewStyle,
});

export default DojoExamCertificatesManager;
