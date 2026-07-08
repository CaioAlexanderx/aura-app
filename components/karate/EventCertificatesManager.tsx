// EventCertificatesManager — monta o modelo do certificado (layout, selos PNG,
// texto padrão/custom) com PREVIEW ao vivo, emite em lote e lista/baixa emitidos.
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Switch, Platform } from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors as P, KarateRadius, KarateFonts } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { certApi, IssuedCertificate } from "@/services/karateCertApi";
import { request } from "@/services/api";
import { CertificatePreview, printCertificate } from "@/components/karate/certificado/CertificatePreview";
import type { CertLayout, CertSeal, CertData, CertTemplate } from "@/components/karate/certificado/buildCertificateHtml";
import { FPKT_LOGO_DATA_URI } from "@/components/karate/carteirinha/fpktLogoDataUri";

const LAYOUTS: { key: CertLayout; label: string }[] = [
  { key: "A", label: "Clássico" }, { key: "B", label: "Kraft" }, { key: "C", label: "Sumi-ê" },
  { key: "D", label: "Lateral" }, { key: "E", label: "Dupla borda" },
];
const VERIFY_BASE = "https://app.getaura.com.br/karate/verify/cert";

function pickPng(): Promise<{ base64: string; ct: string } | null> {
  return new Promise((resolve) => {
    if (Platform.OS !== "web") return resolve(null);
    const input = document.createElement("input"); input.type = "file"; input.accept = "image/png,image/webp,image/jpeg";
    input.onchange = () => {
      const f = input.files?.[0]; if (!f) return resolve(null);
      if (f.size > 5 * 1024 * 1024) { alert("Imagem muito grande (máx 5 MB)"); return resolve(null); }
      const r = new FileReader();
      r.onload = () => resolve({ base64: String(r.result).split(",")[1], ct: f.type || "image/png" });
      r.readAsDataURL(f);
    };
    input.click();
  });
}
function fmtBR(d?: string | null): string {
  if (!d) return ""; const x = new Date(d);
  if (isNaN(x.getTime())) return "";
  return `${String(x.getUTCDate()).padStart(2,"0")}/${String(x.getUTCMonth()+1).padStart(2,"0")}/${x.getUTCFullYear()}`;
}

export function EventCertificatesManager({ federationId, event, federationName }: {
  federationId: string;
  event: { id: string; name?: string | null; exam_type?: string | null; event_date?: string | null; location?: string | null; hours?: number | null };
  federationName?: string;
}) {
  const [layout, setLayout] = useState<CertLayout>("A");
  const [title, setTitle] = useState("CERTIFICADO");
  const [customText, setCustomText] = useState(false);
  const [bodyText, setBodyText] = useState("");
  const [seals, setSeals] = useState<CertSeal[]>([{ label: "FPKT", image_url: FPKT_LOGO_DATA_URI }]);
  const [issued, setIssued] = useState<IssuedCertificate[]>([]);
  const [signatories, setSignatories] = useState<{ name: string; role?: string | null }[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [iss, instr] = await Promise.all([
        certApi.listIssued(federationId, event.id).catch(() => []),
        request(`/federation/${federationId}/belt-exams/${event.id}/instructors`).catch(() => []) as Promise<any[]>,
      ]);
      setIssued(Array.isArray(iss) ? iss : []);
      setSignatories(Array.isArray(instr) ? instr.map((i: any) => ({ name: i.name, role: i.role || null })) : []);
    } catch (e: any) { setErr(e?.message ?? "Erro ao carregar"); }
  }, [federationId, event.id]);
  useEffect(() => { load(); }, [load]);

  const template: CertTemplate = {
    layout, title, body_mode: customText ? "custom" : "default", body_text: customText ? bodyText : null, seals,
  };
  const instructorsText = signatories.length
    ? (signatories.length === 1 ? `Sensei ${signatories[0].name}`
      : signatories.slice(0,-1).map(s=>`Sensei ${s.name}`).join(", ") + ` e Sensei ${signatories[signatories.length-1].name}`)
    : "";
  const previewData: CertData = {
    participant_name: "NOME DO PARTICIPANTE",
    course_name: event.name || "Nome do curso",
    hours: event.hours ?? null,
    instructors_text: instructorsText,
    dates_text: fmtBR(event.event_date),
    location: event.location || "São Paulo",
    issued_date_text: fmtBR(new Date().toISOString()),
    federation_name: federationName || "Federação Paulista de Karatê-Dô Tradicional",
    signatories,
    verify_url: `${VERIFY_BASE}/exemplo`,
  };

  const addSeal = async () => {
    const p = await pickPng(); if (!p) return;
    setBusy(true); setErr(null);
    try {
      const { url } = await certApi.uploadSeal(federationId, p.base64, p.ct);
      setSeals((s) => [...s, { label: "Selo", image_url: url }]);
    } catch (e: any) { setErr(e?.message ?? "Erro ao subir selo"); }
    finally { setBusy(false); }
  };
  const removeSeal = (idx: number) => setSeals((s) => s.filter((_, i) => i !== idx));

  const emit = async () => {
    setBusy(true); setErr(null); setMsg(null);
    try {
      const r = await certApi.emit(federationId, event.id, { template: { layout, title, body_mode: customText ? "custom" : "default", body_text: customText ? bodyText : null, seals } });
      setMsg(`Emitidos ${r.issued} certificado(s)${r.skipped ? `, ${r.skipped} já existiam` : ""} (elegíveis: ${r.eligible}).`);
      await load();
    } catch (e: any) { setErr(e?.message ?? "Erro ao emitir"); }
    finally { setBusy(false); }
  };

  const download = (c: IssuedCertificate) => {
    const d = { ...c.data_snapshot, verify_url: `${VERIFY_BASE}/${c.verify_token}` } as CertData;
    printCertificate(d, c.template_snapshot as CertTemplate);
  };

  return (
    <View style={s.card}>
      <Text style={s.title}>Certificados</Text>
      <Text style={s.sub}>Monte o modelo (layout, selos e texto), veja o preview e emita em lote (curso → presentes, exame → aprovados).</Text>

      {/* Layout */}
      <Text style={s.lbl}>Layout</Text>
      <View style={s.chips}>
        {LAYOUTS.map((l) => (
          <TouchableOpacity key={l.key} onPress={() => setLayout(l.key)} style={[s.chip, layout === l.key && s.chipOn]}>
            <Text style={[s.chipTxt, layout === l.key && s.chipTxtOn]}>{l.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Selos */}
      <Text style={s.lbl}>Selos (PNG)</Text>
      <View style={s.sealRow}>
        {seals.map((sl, i) => (
          <View key={i} style={s.sealItem}>
            <Text style={s.sealTxt}>{sl.label || "Selo"}</Text>
            {i > 0 ? <TouchableOpacity onPress={() => removeSeal(i)} hitSlop={6}><Icon name="close" size={13} color={P.red} /></TouchableOpacity> : null}
          </View>
        ))}
        <TouchableOpacity onPress={addSeal} style={s.sealAdd}><Icon name="plus" size={13} color={P.primary} /><Text style={s.sealAddTxt}>Selo</Text></TouchableOpacity>
      </View>

      {/* Texto */}
      <View style={s.toggleRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.lbl}>Texto personalizado</Text>
          <Text style={s.hint}>Desligado usa o texto padrão do modelo. Ligado, edite com tags: {"{nome} {curso} {carga_horaria} {ministrantes} {datas} {local} {data_emissao}"}</Text>
        </View>
        <Switch value={customText} onValueChange={setCustomText} trackColor={{ false: P.border, true: P.primary }} thumbColor={P.bg} />
      </View>
      {customText ? (
        <TextInput style={[s.input, { minHeight: 80, textAlignVertical: "top" }]} value={bodyText} onChangeText={setBodyText} multiline
          placeholder="Certificamos que {nome} concluiu {curso}..." placeholderTextColor={P.ink4} />
      ) : null}

      {/* Preview */}
      <Text style={s.lbl}>Pré-visualização</Text>
      <CertificatePreview data={previewData} template={template} width={560} watermarkUrl={FPKT_LOGO_DATA_URI} />

      {err ? <Text style={s.err}>{err}</Text> : null}
      {msg ? <Text style={s.ok}>{msg}</Text> : null}

      <View style={s.actions}>
        <KarateButton label={busy ? "Emitindo…" : "Emitir certificados"} variant="primary" size="md" loading={busy} onPress={emit} style={{ flex: 1 }} />
      </View>

      {/* Emitidos */}
      {issued.length > 0 ? (
        <>
          <Text style={[s.lbl, { marginTop: 14 }]}>Emitidos ({issued.length})</Text>
          {issued.map((c) => (
            <View key={c.id} style={s.issuedRow}>
              <Text style={s.issuedName} numberOfLines={1}>{c.data_snapshot?.participant_name || "—"}</Text>
              <TouchableOpacity onPress={() => download(c)} style={s.iconBtn}><Icon name="download" size={15} color={P.primary} /></TouchableOpacity>
              {Platform.OS === "web" ? (
                <TouchableOpacity onPress={() => window.open(`${VERIFY_BASE}/${c.verify_token}`, "_blank")} style={s.iconBtn}><Icon name="qr-code" size={15} color={P.ink3} /></TouchableOpacity>
              ) : null}
            </View>
          ))}
        </>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderColor: P.border, borderRadius: KarateRadius.lg, backgroundColor: P.glass, padding: 16, marginTop: 12 },
  title: { fontFamily: KarateFonts.heading, fontSize: 16, color: P.ink },
  sub: { fontSize: 12, color: P.ink3, marginTop: 3, lineHeight: 16 },
  lbl: { fontSize: 11.5, color: P.ink3, marginTop: 14, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.3 },
  hint: { fontSize: 10.5, color: P.ink4, lineHeight: 14, marginBottom: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: P.border, backgroundColor: P.bg },
  chipOn: { backgroundColor: P.primarySoft, borderColor: P.primaryLine },
  chipTxt: { fontSize: 12.5, color: P.ink2 }, chipTxtOn: { color: P.primary, fontWeight: "700" },
  sealRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  sealItem: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: P.border, backgroundColor: P.bg },
  sealTxt: { fontSize: 12, color: P.ink2 },
  sealAdd: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: P.primaryLine, backgroundColor: P.primarySoft },
  sealAddTxt: { fontSize: 12, color: P.primary, fontWeight: "600" },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 6 },
  input: { borderWidth: 1, borderColor: P.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13.5, color: P.ink, backgroundColor: P.bg, marginTop: 6 },
  err: { color: P.red, fontSize: 12.5, marginTop: 10 },
  ok: { color: P.ok, fontSize: 12.5, marginTop: 10 },
  actions: { flexDirection: "row", gap: 10, marginTop: 14 },
  issuedRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 9, borderTopWidth: 1, borderTopColor: P.border },
  issuedName: { flex: 1, minWidth: 0, fontSize: 13, color: P.ink },
  iconBtn: { padding: 6, borderRadius: 8 },
});

export default EventCertificatesManager;
