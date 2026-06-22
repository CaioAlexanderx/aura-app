// ============================================================
// Ficha do Praticante — MODAL (cadastro + edição) · Aura Karatê (Shoji)
//
// Abre sobre a lista de Praticantes (sem troca de página → navegação fluida).
// Cadastro:  POST  /federation/:id/practitioners
// Edição:    PATCH /federation/:id/practitioners/:practitionerId  (Aura-backend#226)
//
// Princípios (decisões Caio):
//  - Dado AUSENTE é neutro/opcional ("Completar quando quiser"), NÃO é erro.
//    Só dado INVÁLIDO (ex.: CPF) é sinalizado.
//  - CEP em destaque + autofill (ViaCEP).
//  - Nº FPKT é gerado no backend (NNNNN-D) — aqui só exibimos.
//  - Faixa e passaporte NÃO entram nesta ficha (faixa = histórico imutável;
//    passaporte = fluxo de Dan, adiado).
// ============================================================
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Modal, View, Text, TextInput, ScrollView, Pressable, TouchableOpacity,
  ActivityIndicator, useWindowDimensions, StyleSheet, ViewStyle, TextStyle, FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ShojiPalette as P, KarateRadius as R, KarateFonts as F } from "@/constants/karateTheme";
import { karateApi, Dojo } from "@/services/karateApi";
import { request } from "@/services/api";

interface Props {
  federationId: string;
  visible: boolean;
  practitionerId?: string | null; // ausente = cadastro; presente = edição
  onClose: () => void;
  onSaved: () => void;
}

const EMPTY = {
  full_name: "", cpf: "", rg: "", birth_date: "", email: "", phone: "",
  dojo_id: "", dojo_name: "",
  zip_code: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "",
  is_arbiter: false, is_instructor: false, is_examiner: false,
};
type Form = typeof EMPTY;

// ── máscaras BR ──────────────────────────────────────────────
const onlyD = (v: string) => (v || "").replace(/\D/g, "");
function maskCPF(v: string) {
  return onlyD(v).slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}
function maskCEP(v: string) {
  const d = onlyD(v).slice(0, 8);
  return d.length > 5 ? d.replace(/(\d{5})(\d+)/, "$1-$2") : d;
}
function maskPhone(v: string) {
  const d = onlyD(v).slice(0, 11);
  if (d.length > 10) return d.replace(/(\d{2})(\d{5})(\d+)/, "($1) $2-$3");
  if (d.length > 6) return d.replace(/(\d{2})(\d{4})(\d+)/, "($1) $2-$3");
  if (d.length > 2) return d.replace(/(\d{2})(\d+)/, "($1) $2");
  return d;
}
function maskDate(v: string) {
  const d = onlyD(v).slice(0, 8);
  if (d.length > 4) return d.replace(/(\d{2})(\d{2})(\d+)/, "$1/$2/$3");
  if (d.length > 2) return d.replace(/(\d{2})(\d+)/, "$1/$2");
  return d;
}
function cpfValido(c: string) {
  c = onlyD(c);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  let s = 0; for (let i = 0; i < 9; i++) s += +c[i] * (10 - i);
  let d = 11 - (s % 11); if (d >= 10) d = 0; if (d !== +c[9]) return false;
  s = 0; for (let i = 0; i < 10; i++) s += +c[i] * (11 - i);
  d = 11 - (s % 11); if (d >= 10) d = 0; return d === +c[10];
}
function ageFromDisplay(v: string): number | null {
  const m = (v || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(+m[3], +m[2] - 1, +m[1]);
  if (isNaN(d.getTime())) return null;
  const t = new Date(); let a = t.getFullYear() - d.getFullYear();
  const mm = t.getMonth() - d.getMonth();
  if (mm < 0 || (mm === 0 && t.getDate() < d.getDate())) a--;
  return a;
}
// dd/mm/aaaa → YYYY-MM-DD (ou null)
function toISO(v: string): string | null {
  const m = (v || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}
// API (YYYY-MM-DD ou ISO) → dd/mm/aaaa
function fromISO(v: string | null | undefined): string {
  if (!v) return "";
  const m = String(v).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

export function PraticanteFichaModal({ federationId, visible, practitionerId, onClose, onSaved }: Props) {
  const { width } = useWindowDimensions();
  const cardW = Math.min(720, width - 24);
  const isEdit = !!practitionerId;

  const [form, setForm] = useState<Form>(EMPTY);
  const [fpkt, setFpkt] = useState<string | null>(null);
  const [beltName, setBeltName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cepStatus, setCepStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((p) => ({ ...p, [k]: v }));

  // carrega ficha em edição
  useEffect(() => {
    if (!visible) return;
    setErrorMsg(null); setCepStatus(null);
    if (!practitionerId) { setForm(EMPTY); setFpkt(null); setBeltName(null); return; }
    setLoading(true);
    karateApi.getPractitioner(federationId, practitionerId)
      .then((p: any) => {
        setForm({
          full_name: p.full_name || "", cpf: p.cpf ? maskCPF(p.cpf) : "", rg: p.rg || "",
          birth_date: fromISO(p.birth_date), email: p.email || "", phone: p.phone ? maskPhone(p.phone) : "",
          dojo_id: p.dojo_id || "", dojo_name: "",
          zip_code: p.zip_code ? maskCEP(p.zip_code) : "", street: p.street || "", number: p.number || "",
          complement: p.complement || "", neighborhood: p.neighborhood || "", city: p.city || "", state: p.state || "",
          is_arbiter: !!p.is_arbiter, is_instructor: !!p.is_instructor, is_examiner: !!p.is_examiner,
        });
        setFpkt(p.karate_registration_number || null);
        setBeltName(p.current_belt?.belt_name || null);
      })
      .catch(() => setErrorMsg("Não foi possível carregar a ficha."))
      .finally(() => setLoading(false));
  }, [visible, practitionerId, federationId]);

  // CEP autofill (ViaCEP) quando completa 8 dígitos
  const onCep = useCallback(async (raw: string) => {
    set("zip_code", maskCEP(raw));
    const d = onlyD(raw);
    if (d.length !== 8) { setCepStatus(null); return; }
    setCepStatus({ msg: "Buscando endereço…", ok: true });
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
      const j = await r.json();
      if (j?.erro) { setCepStatus({ msg: "CEP não encontrado — preencha manualmente.", ok: false }); return; }
      setForm((p) => ({
        ...p,
        street: j.logradouro || p.street, neighborhood: j.bairro || p.neighborhood,
        city: j.localidade || p.city, state: j.uf || p.state,
      }));
      setCepStatus({ msg: "Endereço preenchido — confira o número.", ok: true });
    } catch { setCepStatus({ msg: "Falha ao buscar o CEP — preencha manualmente.", ok: false }); }
  }, []);

  const age = ageFromDisplay(form.birth_date);
  const cpfBad = form.cpf.length > 0 && !cpfValido(form.cpf);

  // campos vazios (neutro, opcional)
  const empties = useMemo(() => {
    const e: string[] = [];
    if (!form.full_name.trim()) e.push("Nome");
    if (!form.dojo_id) e.push("Dojô");
    if (!form.birth_date) e.push("Nascimento");
    if (!form.cpf) e.push("CPF");
    if (!form.phone) e.push("Telefone");
    return e;
  }, [form]);

  async function handleSave() {
    if (!form.full_name.trim()) { setErrorMsg("Informe o nome completo."); return; }
    if (!form.dojo_id) { setErrorMsg("Selecione o dojô."); return; }
    if (cpfBad) { setErrorMsg("O CPF informado é inválido. Corrija ou deixe em branco."); return; }
    setErrorMsg(null); setSaving(true);
    const body: any = {
      full_name: form.full_name.trim(),
      cpf: onlyD(form.cpf) || null,
      rg: form.rg || null,
      birth_date: toISO(form.birth_date),
      email: form.email || null,
      phone: onlyD(form.phone) || null,
      dojo_id: form.dojo_id,
      is_arbiter: form.is_arbiter, is_instructor: form.is_instructor, is_examiner: form.is_examiner,
      street: form.street || null, number: form.number || null, complement: form.complement || null,
      neighborhood: form.neighborhood || null, city: form.city || null,
      state: form.state ? form.state.toUpperCase().slice(0, 2) : null,
      zip_code: onlyD(form.zip_code) || null,
    };
    try {
      if (isEdit) await request(`/federation/${federationId}/practitioners/${practitionerId}`, { method: "PATCH", body });
      else await request(`/federation/${federationId}/practitioners`, { method: "POST", body });
      setSaving(false); onSaved(); onClose();
    } catch (e: any) {
      setSaving(false); setErrorMsg(e?.message || "Erro ao salvar. Tente novamente.");
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.card, { width: cardW }]}>
          {/* header */}
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>空  FPKT · {isEdit ? "Editar ficha" : "Nova ficha"}</Text>
              <Text style={styles.title}>{isEdit ? (form.full_name || "Praticante") : "Novo praticante"}<Text style={{ color: P.red }}>.</Text></Text>
              {isEdit && fpkt ? (
                <Text style={styles.subMono}>{fpkt}{beltName ? `  ·  ${beltName}` : ""}</Text>
              ) : (
                <Text style={styles.sub}>Preencha o que tiver — campos vazios não bloqueiam nada.</Text>
              )}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.close}>
              <Ionicons name="close" size={20} color={P.ink2} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator style={{ paddingVertical: 48 }} color={P.red} />
          ) : (
            <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ padding: 20, paddingTop: 6 }} keyboardShouldPersistTaps="handled">
              {/* completar (neutro) */}
              {empties.length > 0 && (
                <View style={styles.completar}>
                  <Ionicons name="create-outline" size={14} color={P.ink3} />
                  <Text style={styles.completarTtl}>Completar quando quiser:</Text>
                  <Text style={styles.completarList}>{empties.join("  ·  ")}</Text>
                </View>
              )}

              {/* IDENTIDADE */}
              <SectionTitle>Identidade</SectionTitle>
              <Field label="Nome completo" req value={form.full_name} onChangeText={(v) => set("full_name", v)} placeholder="Ex.: Maria Tanaka de Souza" />
              <DojoSelect federationId={federationId} valueId={form.dojo_id} valueName={form.dojo_name}
                onSelect={(d) => setForm((p) => ({ ...p, dojo_id: d.id, dojo_name: d.name }))} />
              <Row2>
                <Field flex label="Nascimento" hint="dd/mm/aaaa" mono value={form.birth_date}
                  onChangeText={(v) => set("birth_date", maskDate(v))} keyboardType="numeric" placeholder="dd/mm/aaaa"
                  note={age != null ? `${age} anos${age < 18 ? " · menor de idade" : ""}` : undefined} />
                <Field flex label="CPF" mono value={form.cpf} onChangeText={(v) => set("cpf", maskCPF(v))}
                  keyboardType="numeric" placeholder="000.000.000-00" bad={cpfBad}
                  note={cpfBad ? "Dígitos não conferem" : form.cpf ? "CPF válido" : undefined} noteOk={!cpfBad && !!form.cpf} />
              </Row2>
              <Field label="RG" mono value={form.rg} onChangeText={(v) => set("rg", v)} placeholder="00.000.000-0" />
              {age != null && age < 18 && (
                <View style={styles.lgpd}>
                  <Ionicons name="shield-checkmark-outline" size={14} color={P.ink2} />
                  <Text style={styles.lgpdTxt}>Menor de idade — responsável legal exigido (LGPD Art. 14). O cadastro do responsável entra no próximo passo.</Text>
                </View>
              )}

              {/* CONTATO & ENDEREÇO — CEP em destaque */}
              <SectionTitle>Contato &amp; endereço</SectionTitle>
              <Row2>
                <Field flex label="Telefone" mono value={form.phone} onChangeText={(v) => set("phone", maskPhone(v))} keyboardType="numeric" placeholder="(00) 00000-0000" />
                <Field flex label="E-mail" value={form.email} onChangeText={(v) => set("email", v)} keyboardType="email-address" autoCapitalize="none" placeholder="nome@exemplo.com" />
              </Row2>

              {/* CEP destacado */}
              <View style={styles.cepBox}>
                <Text style={styles.cepLabel}>CEP <Text style={styles.cepHint}>· preenche o endereço automaticamente</Text></Text>
                <View style={styles.cepRow}>
                  <TextInput style={[styles.input, styles.mono, { flex: 1, fontSize: 16 }]} value={form.zip_code}
                    onChangeText={onCep} keyboardType="numeric" placeholder="00000-000" placeholderTextColor={P.ink4} maxLength={9} />
                  {cepStatus?.msg === "Buscando endereço…" ? <ActivityIndicator color={P.red} style={{ width: 36 }} /> : <Ionicons name="search" size={18} color={P.ink3} style={{ width: 36, textAlign: "center" }} />}
                </View>
                {cepStatus ? <Text style={[styles.note, cepStatus.ok ? styles.noteOk : styles.noteBad]}>{cepStatus.msg}</Text> : null}
              </View>

              <Row2>
                <Field flex2 label="Logradouro" value={form.street} onChangeText={(v) => set("street", v)} placeholder="Rua, avenida…" />
                <Field flex label="Número" mono value={form.number} onChangeText={(v) => set("number", v)} placeholder="000" keyboardType="numeric" />
              </Row2>
              <Row2>
                <Field flex label="Complemento" value={form.complement} onChangeText={(v) => set("complement", v)} placeholder="Apto, bloco…" />
                <Field flex label="Bairro" value={form.neighborhood} onChangeText={(v) => set("neighborhood", v)} />
              </Row2>
              <Row2>
                <Field flex2 label="Cidade" value={form.city} onChangeText={(v) => set("city", v)} />
                <Field flex label="UF" mono value={form.state} onChangeText={(v) => set("state", v.toUpperCase().slice(0, 2))} maxLength={2} placeholder="SP" />
              </Row2>

              {/* FUNÇÕES */}
              <SectionTitle>Funções na federação</SectionTitle>
              <Toggle label="Árbitro" hint="Atua em competições" on={form.is_arbiter} onPress={() => set("is_arbiter", !form.is_arbiter)} />
              <Toggle label="Instrutor" hint="Ministra aulas no dojô" on={form.is_instructor} onPress={() => set("is_instructor", !form.is_instructor)} />
              <Toggle label="Examinador" hint="Banca de graduação" on={form.is_examiner} onPress={() => set("is_examiner", !form.is_examiner)} />

              {errorMsg ? (
                <View style={styles.errBox}><Ionicons name="alert-circle" size={15} color={P.red} /><Text style={styles.errTxt}>{errorMsg}</Text></View>
              ) : null}
            </ScrollView>
          )}

          {/* footer */}
          <View style={styles.footer}>
            <TouchableOpacity onPress={onClose} style={styles.btnGhost}><Text style={styles.btnGhostTxt}>Cancelar</Text></TouchableOpacity>
            <TouchableOpacity onPress={handleSave} disabled={saving || loading} style={[styles.btnPrimary, (saving || loading) && { opacity: 0.6 }]}>
              {saving ? <ActivityIndicator color="#fdf8f2" size="small" /> : <Text style={styles.btnPrimaryTxt}>{isEdit ? "Salvar alterações" : "Salvar ficha"}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── subcomponentes ───────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.sectionH}>
      <Text style={styles.sectionTtl}>{children}</Text>
      <View style={styles.sectionRule} />
    </View>
  );
}
function Row2({ children }: { children: React.ReactNode }) {
  return <View style={styles.row2}>{children}</View>;
}
function Field(props: {
  label: string; value: string; onChangeText: (v: string) => void; placeholder?: string;
  hint?: string; req?: boolean; mono?: boolean; flex?: boolean; flex2?: boolean; bad?: boolean;
  note?: string; noteOk?: boolean; keyboardType?: any; autoCapitalize?: any; maxLength?: number;
}) {
  return (
    <View style={[styles.field, props.flex && { flex: 1 }, props.flex2 && { flex: 2 }]}>
      <Text style={styles.label}>{props.label}{props.req ? <Text style={{ color: P.red }}> *</Text> : null}{props.hint ? <Text style={styles.labelHint}>  · {props.hint}</Text> : null}</Text>
      <TextInput
        style={[styles.input, props.mono && styles.mono, props.bad && styles.inputBad]}
        value={props.value} onChangeText={props.onChangeText} placeholder={props.placeholder}
        placeholderTextColor={P.ink4} keyboardType={props.keyboardType} autoCapitalize={props.autoCapitalize} maxLength={props.maxLength}
      />
      {props.note ? <Text style={[styles.note, props.noteOk ? styles.noteOk : props.bad ? styles.noteBad : null]}>{props.note}</Text> : null}
    </View>
  );
}
function Toggle({ label, hint, on, onPress }: { label: string; hint: string; on: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.toggle, on && styles.toggleOn]} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.sw, on && styles.swOn]}><View style={[styles.knob, on && styles.knobOn]} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleHint}>{hint}</Text>
      </View>
    </TouchableOpacity>
  );
}

// dojô — selector compacto com busca
function DojoSelect({ federationId, valueId, valueName, onSelect }: {
  federationId: string; valueId: string; valueName: string; onSelect: (d: Dojo) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [list, setList] = useState<Dojo[]>([]);
  const [loading, setLoading] = useState(false);
  const [label, setLabel] = useState(valueName || "");

  useEffect(() => { setLabel(valueName || ""); }, [valueName]);
  const fetchDojos = useCallback(async (term: string) => {
    setLoading(true);
    try { const res = await karateApi.listDojos(federationId, { q: term || undefined, pageSize: 50 }); setList(res.data); }
    catch { setList([]); } finally { setLoading(false); }
  }, [federationId]);
  useEffect(() => { if (open) fetchDojos(""); }, [open, fetchDojos]);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>Dojô <Text style={{ color: P.red }}>*</Text></Text>
      <TouchableOpacity style={styles.input} onPress={() => setOpen((o) => !o)} activeOpacity={0.7}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontFamily: F.body, fontSize: 14, color: label ? P.ink : P.ink4 }} numberOfLines={1}>{label || "Selecionar dojô…"}</Text>
          <Ionicons name={open ? "chevron-up" : "chevron-down"} size={14} color={P.ink3} />
        </View>
      </TouchableOpacity>
      {open && (
        <View style={styles.dropdown}>
          <TextInput style={styles.dropdownSearch} placeholder="Buscar por nome ou FPKT-NNN" placeholderTextColor={P.ink4}
            value={q} onChangeText={(t) => { setQ(t); fetchDojos(t); }} autoFocus />
          {loading ? <ActivityIndicator style={{ margin: 12 }} color={P.red} /> : list.length === 0 ? (
            <Text style={styles.dropdownEmpty}>Nenhum dojô encontrado</Text>
          ) : (
            <FlatList data={list} keyExtractor={(i) => i.id} style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.dropdownItem} onPress={() => { setLabel(item.name); setOpen(false); setQ(""); onSelect(item); }} activeOpacity={0.6}>
                  <Text style={styles.dropdownName}>{item.name}</Text>
                  {item.fpkt_affiliation_id ? <Text style={styles.dropdownMeta}>{item.fpkt_affiliation_id}</Text> : null}
                </TouchableOpacity>
              )} />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(43,38,32,0.45)", alignItems: "center", justifyContent: "center", padding: 12 } as ViewStyle,
  card: { backgroundColor: P.paper, borderRadius: R.xl, overflow: "hidden", maxHeight: "92%", borderWidth: 1, borderColor: P.line2 } as ViewStyle,
  head: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: P.line, backgroundColor: P.glassHi } as ViewStyle,
  eyebrow: { fontFamily: F.body, fontSize: 10.5, fontWeight: "700", letterSpacing: 1.4, color: P.ink3, textTransform: "uppercase" } as TextStyle,
  title: { fontFamily: F.heading, fontSize: 24, color: P.ink, marginTop: 2 } as TextStyle,
  sub: { fontFamily: F.body, fontSize: 12.5, color: P.ink2, marginTop: 3 } as TextStyle,
  subMono: { fontFamily: F.mono, fontSize: 12, color: P.red, marginTop: 4 } as TextStyle,
  close: { padding: 4, borderRadius: 999 } as ViewStyle,

  completar: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 7, backgroundColor: P.paper3, borderWidth: 1, borderColor: P.line, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 12, marginBottom: 6 } as ViewStyle,
  completarTtl: { fontFamily: F.body, fontSize: 12, fontWeight: "700", color: P.ink2 } as TextStyle,
  completarList: { fontFamily: F.body, fontSize: 12, color: P.ink3, flex: 1 } as TextStyle,

  sectionH: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16, marginBottom: 6 } as ViewStyle,
  sectionTtl: { fontFamily: F.heading, fontSize: 16, color: P.ink } as TextStyle,
  sectionRule: { height: 1, flex: 1, backgroundColor: P.redLine, opacity: 0.4 } as ViewStyle,

  row2: { flexDirection: "row", gap: 12 } as ViewStyle,
  field: { marginBottom: 11 } as ViewStyle,
  label: { fontFamily: F.body, fontSize: 11, fontWeight: "700", letterSpacing: 0.3, color: P.ink2, marginBottom: 5 } as TextStyle,
  labelHint: { fontWeight: "500", color: P.ink4 } as TextStyle,
  input: { fontFamily: F.body, fontSize: 14, color: P.ink, backgroundColor: P.glassHi, borderWidth: 1, borderColor: P.line2, borderRadius: R.md, paddingHorizontal: 12, paddingVertical: 11 } as TextStyle,
  mono: { fontFamily: F.mono, letterSpacing: 0.5 } as TextStyle,
  inputBad: { borderColor: P.red } as ViewStyle,
  note: { fontFamily: F.body, fontSize: 11, color: P.ink3, marginTop: 4 } as TextStyle,
  noteOk: { color: P.ok } as TextStyle,
  noteBad: { color: P.red } as TextStyle,

  cepBox: { backgroundColor: P.glass, borderWidth: 1, borderColor: P.redLine, borderRadius: R.lg, padding: 14, marginBottom: 12 } as ViewStyle,
  cepLabel: { fontFamily: F.body, fontSize: 12, fontWeight: "700", color: P.ink, marginBottom: 7 } as TextStyle,
  cepHint: { fontWeight: "500", color: P.ink3 } as TextStyle,
  cepRow: { flexDirection: "row", alignItems: "center", gap: 6 } as ViewStyle,

  lgpd: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: P.paper3, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 4 } as ViewStyle,
  lgpdTxt: { fontFamily: F.body, fontSize: 11.5, color: P.ink2, flex: 1 } as TextStyle,

  toggle: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: P.glassHi, borderWidth: 1, borderColor: P.line2, borderRadius: 14, paddingVertical: 11, paddingHorizontal: 14, marginBottom: 9 } as ViewStyle,
  toggleOn: { borderColor: P.redLine } as ViewStyle,
  sw: { width: 38, height: 22, borderRadius: 999, backgroundColor: P.paper3, borderWidth: 1, borderColor: P.line2, justifyContent: "center", padding: 2 } as ViewStyle,
  swOn: { backgroundColor: P.red, borderColor: P.red } as ViewStyle,
  knob: { width: 16, height: 16, borderRadius: 999, backgroundColor: "#fff" } as ViewStyle,
  knobOn: { alignSelf: "flex-end" } as ViewStyle,
  toggleLabel: { fontFamily: F.body, fontSize: 13.5, fontWeight: "600", color: P.ink } as TextStyle,
  toggleHint: { fontFamily: F.body, fontSize: 11, color: P.ink3 } as TextStyle,

  dropdown: { marginTop: 5, borderWidth: 1, borderColor: P.line2, borderRadius: R.md, backgroundColor: P.glassHi, overflow: "hidden" } as ViewStyle,
  dropdownSearch: { fontFamily: F.body, fontSize: 13.5, color: P.ink, borderBottomWidth: 1, borderBottomColor: P.line, paddingHorizontal: 12, paddingVertical: 10 } as TextStyle,
  dropdownEmpty: { fontFamily: F.body, textAlign: "center", color: P.ink3, paddingVertical: 14, fontSize: 13 } as TextStyle,
  dropdownItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: P.line } as ViewStyle,
  dropdownName: { fontFamily: F.body, fontSize: 13.5, fontWeight: "600", color: P.ink } as TextStyle,
  dropdownMeta: { fontFamily: F.mono, fontSize: 10.5, color: P.ink3, marginTop: 1 } as TextStyle,

  errBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(184,70,58,0.08)", borderWidth: 1, borderColor: P.redLine, borderRadius: 12, padding: 11, marginTop: 12 } as ViewStyle,
  errTxt: { fontFamily: F.body, fontSize: 12.5, color: P.red2, flex: 1 } as TextStyle,

  footer: { flexDirection: "row", justifyContent: "flex-end", gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: P.line, backgroundColor: P.glassHi } as ViewStyle,
  btnGhost: { paddingVertical: 11, paddingHorizontal: 18, borderRadius: R.md, borderWidth: 1, borderColor: P.line2 } as ViewStyle,
  btnGhostTxt: { fontFamily: F.body, fontSize: 13.5, fontWeight: "600", color: P.ink } as TextStyle,
  btnPrimary: { paddingVertical: 11, paddingHorizontal: 22, borderRadius: R.md, backgroundColor: P.ink, minWidth: 140, alignItems: "center" } as ViewStyle,
  btnPrimaryTxt: { fontFamily: F.body, fontSize: 13.5, fontWeight: "600", color: "#fdf8f2" } as TextStyle,
});

export default PraticanteFichaModal;
