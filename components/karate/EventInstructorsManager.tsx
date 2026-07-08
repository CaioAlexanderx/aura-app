// EventInstructorsManager — ministrantes/assinantes do evento (nome + cargo +
// assinatura PNG). As assinaturas fluem para o certificado automaticamente.
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Image, Platform } from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors as P, KarateRadius, KarateFonts } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { instructorApi, EventInstructor, certApi } from "@/services/karateCertApi";

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

type Form = { id: string | null; name: string; role: string; signature_url: string | null };
const EMPTY: Form = { id: null, name: "", role: "", signature_url: null };

export function EventInstructorsManager({ federationId, eventId }: { federationId: string; eventId: string }) {
  const [rows, setRows] = useState<EventInstructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await instructorApi.list(federationId, eventId); setRows(Array.isArray(r) ? r : []); }
    catch (e: any) { setErr(e?.message ?? "Erro ao carregar ministrantes"); }
    finally { setLoading(false); }
  }, [federationId, eventId]);
  useEffect(() => { load(); }, [load]);

  const openNew = () => { setErr(null); setForm({ ...EMPTY }); };
  const openEdit = (i: EventInstructor) => { setErr(null); setForm({ id: i.id, name: i.name, role: i.role || "", signature_url: i.signature_url || null }); };

  const uploadSig = async () => {
    const p = await pickPng(); if (!p || !form) return;
    setBusy(true); setErr(null);
    try { const { url } = await certApi.uploadSeal(federationId, p.base64, p.ct); setForm({ ...form, signature_url: url }); }
    catch (e: any) { setErr(e?.message ?? "Erro ao subir assinatura"); }
    finally { setBusy(false); }
  };

  const save = async () => {
    if (!form) return;
    if (!form.name.trim()) { setErr("Informe o nome do ministrante."); return; }
    setBusy(true); setErr(null);
    const body = { name: form.name.trim(), role: form.role.trim() || null, signature_url: form.signature_url };
    try {
      if (form.id) await instructorApi.update(federationId, eventId, form.id, body);
      else await instructorApi.create(federationId, eventId, { ...body, sort_order: rows.length });
      setForm(null); await load();
    } catch (e: any) { setErr(e?.message ?? "Não foi possível salvar."); }
    finally { setBusy(false); }
  };
  const remove = async (i: EventInstructor) => {
    try { await instructorApi.remove(federationId, eventId, i.id); await load(); }
    catch (e: any) { setErr(e?.message ?? "Erro ao remover."); }
  };

  return (
    <View style={s.card}>
      <View style={s.head}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Ministrantes e assinaturas</Text>
          <Text style={s.sub}>Quem ministrou/assina o certificado. Nome, cargo e imagem da assinatura (PNG). Aparecem no certificado na ordem cadastrada.</Text>
        </View>
        {!form ? <KarateButton label="Adicionar" variant="ghost" size="sm" onPress={openNew} /> : null}
      </View>

      {err ? <View style={s.errBanner}><Icon name="alert_circle" size={14} color={P.red} /><Text style={s.errTxt}>{err}</Text></View> : null}

      {loading ? (
        <View style={{ paddingVertical: 18, alignItems: "center" }}><ActivityIndicator color={P.primary} /></View>
      ) : (
        <>
          {rows.length === 0 && !form ? <Text style={s.empty}>Nenhum ministrante ainda.</Text> : null}
          {rows.map((i) => (
            <View key={i.id} style={s.row}>
              {i.signature_url ? <Image source={{ uri: i.signature_url }} style={s.sig} resizeMode="contain" /> : <View style={[s.sig, s.sigPh]}><Text style={s.sigPhTxt}>sem{"\n"}assin.</Text></View>}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.name}>{i.name}</Text>
                {i.role ? <Text style={s.role}>{i.role}</Text> : null}
              </View>
              <TouchableOpacity onPress={() => openEdit(i)} style={s.iconBtn} hitSlop={8}><Icon name="edit" size={16} color={P.ink3} /></TouchableOpacity>
              <TouchableOpacity onPress={() => remove(i)} style={s.iconBtn} hitSlop={8}><Icon name="trash" size={16} color={P.red} /></TouchableOpacity>
            </View>
          ))}

          {form ? (
            <View style={s.form}>
              <Text style={s.lbl}>Nome</Text>
              <TextInput style={s.input} value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="Ex.: Kazuo Nagamine" placeholderTextColor={P.ink4} />
              <Text style={s.lbl}>Cargo (opcional)</Text>
              <TextInput style={s.input} value={form.role} onChangeText={(v) => setForm({ ...form, role: v })} placeholder="Ex.: Presidente FPKT / Ministrante" placeholderTextColor={P.ink4} />
              <Text style={s.lbl}>Assinatura (PNG, opcional)</Text>
              <View style={s.sigUpload}>
                {form.signature_url ? <Image source={{ uri: form.signature_url }} style={s.sigBig} resizeMode="contain" /> : <View style={[s.sigBig, s.sigPh]}><Text style={s.sigPhTxt}>sem imagem</Text></View>}
                <KarateButton label={form.signature_url ? "Trocar" : "Subir imagem"} variant="ghost" size="sm" onPress={uploadSig} loading={busy} />
                {form.signature_url ? <TouchableOpacity onPress={() => setForm({ ...form, signature_url: null })} hitSlop={8}><Icon name="close" size={16} color={P.red} /></TouchableOpacity> : null}
              </View>
              <View style={s.formActions}>
                <KarateButton label="Cancelar" variant="ghost" size="md" onPress={() => setForm(null)} style={{ flex: 1 }} disabled={busy} />
                <KarateButton label={busy ? "Salvando…" : "Salvar"} variant="primary" size="md" loading={busy} onPress={save} style={{ flex: 1 }} />
              </View>
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderColor: P.border, borderRadius: KarateRadius.lg, backgroundColor: P.glass, padding: 16, marginTop: 12 },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  title: { fontFamily: KarateFonts.heading, fontSize: 16, color: P.ink },
  sub: { fontSize: 12, color: P.ink3, marginTop: 3, lineHeight: 16 },
  empty: { fontSize: 13, color: P.ink3, marginTop: 12 },
  errBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: P.dangerSoft, borderRadius: 8, padding: 10, marginTop: 10 },
  errTxt: { color: P.red, fontSize: 12.5, flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: P.border, marginTop: 10 },
  sig: { width: 54, height: 26, borderRadius: 4 },
  sigPh: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: P.border, backgroundColor: P.bg },
  sigPhTxt: { fontSize: 8, color: P.ink4, textAlign: "center" },
  name: { fontSize: 14, fontWeight: "700", color: P.ink },
  role: { fontSize: 11.5, color: P.ink3, marginTop: 1 },
  iconBtn: { padding: 6, borderRadius: 8 },
  form: { marginTop: 14, borderTopWidth: 1, borderTopColor: P.border, paddingTop: 14, gap: 6 },
  lbl: { fontSize: 11.5, color: P.ink3, marginTop: 6, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: P.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: P.ink, backgroundColor: P.bg },
  sigUpload: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 },
  sigBig: { width: 100, height: 44, borderRadius: 6 },
  formActions: { flexDirection: "row", gap: 10, marginTop: 10 },
});

export default EventInstructorsManager;
