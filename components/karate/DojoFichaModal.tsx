// ============================================================
// Ficha do Dojô — MODAL (cadastro + edição) · Aura Karatê (Shoji)
//
// Abre sobre a lista de Dojôs (sem troca de página → navegação fluida).
// Cadastro:  karateApi.createDojo
// Edição:    karateApi.updateDojo  (backend já tem create + PATCH)
//
// Princípios (decisões Caio):
//  - Dado AUSENTE é neutro/opcional ("Completar quando quiser"), NÃO é erro.
//    Só dado INVÁLIDO (CNPJ/CPF/data impossível) é sinalizado.
//  - CEP em destaque → preenche o endereço ESTRUTURADO (campos separados,
//    igual à ficha do praticante) via ViaCEP: logradouro, bairro, cidade, UF.
//  - FPKT-ID é gerado no backend — aqui só exibimos.
//  - Modelo de filiação (obrigatório): Anual/Semestral/Trimestral, com os
//    valores vigentes FPKT como referência.
//  - Data validada de verdade: a conversão no envio usa parseBrDate (round-trip
//    de Date → rejeita 31/02). A máscara de digitação continua dd/mm/aaaa.
//  - Feedback de sucesso leve: toast Shoji inline ("Dojô salvo") — o app não
//    tem sistema de toast/snackbar global, então fazemos um mínimo aqui.
//    "Duplicar último" não se aplica ao dojô (decisão Caio).
//
// D3.5.2 (copy coerente): os obrigatórios são Nome e Modelo de filiação. O
//   subtítulo reflete isso e o nudge "Completar quando quiser" lista APENAS
//   campos realmente opcionais — nunca os obrigatórios — para não contradizer
//   a mensagem.
//
// Endereço estruturado (Fix 5): o dojô agora usa os MESMOS campos do praticante
// (street/number/complement/neighborhood/city/state/zip = colunas address_* do
// companies, as mesmas da NF-e). O backend ainda aceita `address` texto legado;
// na edição, se o registro só tiver `address` (sem campos), exibimos o texto
// num campo "Endereço (registro antigo)" read-friendly para não perder o dado.
// ============================================================
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Modal, View, Text, TextInput, ScrollView, Pressable, TouchableOpacity,
  ActivityIndicator, useWindowDimensions, StyleSheet, ViewStyle, TextStyle, Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ShojiPalette as P, KarateRadius as R, KarateFonts as F } from "@/constants/karateTheme";
import { karateApi, AffiliationModel, DojoInput } from "@/services/karateApi";
import { parseBrDate } from "@/components/inputs/DateInput";

interface Props {
  federationId: string;
  visible: boolean;
  dojoId?: string | null; // ausente = cadastro; presente = edição
  onClose: () => void;
  onSaved: () => void;
}

const MODELS: { key: AffiliationModel; label: string; detail: string }[] = [
  { key: "annual", label: "Anual", detail: "R$ 500 · vence em Maio" },
  { key: "biannual", label: "Semestral", detail: "R$ 280 · Maio e Novembro" },
  { key: "quarterly", label: "Trimestral", detail: "R$ 150 · Fev / Mai / Ago / Nov" },
];

const EMPTY = {
  name: "", affiliation_model: "" as AffiliationModel | "", region: "", cnpj: "",
  sensei_cpf: "", affiliation_since: "", dojo_founded_year: "",
  phone: "", email: "",
  // endereço estruturado (igual ao praticante)
  zip_code: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "",
  // só leitura: texto legado de registros antigos que ainda não migraram p/ campos
  legacy_address: "",
};
type Form = typeof EMPTY;

// ── máscaras / validações BR ─────────────────────────────────
const onlyD = (v: string) => (v || "").replace(/\D/g, "");
function maskCPF(v: string) {
  return onlyD(v).slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}
function maskCNPJ(v: string) {
  return onlyD(v).slice(0, 14)
    .replace(/(\d{2})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2").replace(/(\d{4})(\d{1,2})$/, "$1-$2");
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
function cpfValido(c: string) {
  c = onlyD(c);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  let s = 0; for (let i = 0; i < 9; i++) s += +c[i] * (10 - i);
  let d = 11 - (s % 11); if (d >= 10) d = 0; if (d !== +c[9]) return false;
  s = 0; for (let i = 0; i < 10; i++) s += +c[i] * (11 - i);
  d = 11 - (s % 11); if (d >= 10) d = 0; return d === +c[10];
}
function cnpjValido(v: string) {
  const c = onlyD(v);
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const calc = (len: number) => {
    let sum = 0, pos = len - 7;
    for (let i = len; i >= 1; i--) { sum += +c[len - i] * pos--; if (pos < 2) pos = 9; }
    const r = sum % 11; return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === +c[12] && calc(13) === +c[13];
}
function fromISO(v: string | null | undefined): string {
  if (!v) return "";
  const m = String(v).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}
function maskDate(v: string) {
  const d = onlyD(v).slice(0, 8);
  if (d.length > 4) return d.replace(/(\d{2})(\d{2})(\d+)/, "$1/$2/$3");
  if (d.length > 2) return d.replace(/(\d{2})(\d+)/, "$1/$2");
  return d;
}

export function DojoFichaModal({ federationId, visible, dojoId, onClose, onSaved }: Props) {
  const { width } = useWindowDimensions();
  const cardW = Math.min(720, width - 24);
  const isEdit = !!dojoId;

  const [form, setForm] = useState<Form>(EMPTY);
  const [fpkt, setFpkt] = useState<string | null>(null);
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cepStatus, setCepStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // toast de sucesso (inline, sem sistema global)
  const [toast, setToast] = useState<string | null>(null);

  // refs p/ Enter avançar os campos de texto
  const nameRef = useRef<TextInput>(null);
  const regionRef = useRef<TextInput>(null);
  const cnpjRef = useRef<TextInput>(null);
  const senseiRef = useRef<TextInput>(null);
  const sinceRef = useRef<TextInput>(null);
  const foundedRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!visible) return;
    setErrorMsg(null); setCepStatus(null); setToast(null);
    if (!dojoId) { setForm(EMPTY); setFpkt(null); setStatusLabel(null); return; }
    setLoading(true);
    karateApi.getDojo(federationId, dojoId)
      .then((d: any) => {
        // Se o registro tem campos estruturados, usa-os; senão guarda o texto
        // legado p/ não perder o dado (campo read-friendly).
        const hasStructured = !!(d.address_street || d.address_city || d.address_zip ||
          d.address_neighborhood || d.address_number || d.address_state);
        setForm({
          name: d.name || "", affiliation_model: d.affiliation_model || "", region: d.region || "",
          cnpj: d.cnpj ? maskCNPJ(d.cnpj) : "", sensei_cpf: d.sensei_cpf ? maskCPF(d.sensei_cpf) : "",
          affiliation_since: fromISO(d.affiliation_since), dojo_founded_year: d.dojo_founded_year ? String(d.dojo_founded_year) : "",
          phone: d.phone ? maskPhone(d.phone) : "", email: d.email || "",
          zip_code: d.address_zip ? maskCEP(d.address_zip) : "",
          street: d.address_street || "", number: d.address_number || "",
          complement: d.address_complement || "", neighborhood: d.address_neighborhood || "",
          city: d.address_city || "", state: d.address_state || "",
          legacy_address: hasStructured ? "" : (d.address || ""),
        });
        setFpkt(d.fpkt_affiliation_id || null);
        setStatusLabel(d.status || null);
      })
      .catch(() => setErrorMsg("Não foi possível carregar o dojô."))
      .finally(() => setLoading(false));
  }, [visible, dojoId, federationId]);

  // autofocus no Nome ao abrir (cadastro novo, após render)
  useEffect(() => {
    if (visible && !dojoId && !loading) {
      const t = setTimeout(() => nameRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [visible, dojoId, loading]);

  // animação do toast (slide + fade)
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    toastAnim.setValue(0);
    Animated.timing(toastAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastAnim, { toValue: 0, duration: 200, useNativeDriver: true })
        .start(() => setToast(null));
    }, 2400);
  }, [toastAnim]);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  // CEP autofill (ViaCEP) — preenche os campos ESTRUTURADOS, igual ao praticante.
  const onCep = useCallback(async (raw: string) => {
    set("zip_code", maskCEP(raw));
    const d = onlyD(raw);
    if (d.length !== 8) { setCepStatus(null); return; }
    setCepStatus({ msg: "Buscando endereço…", ok: true });
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
      const j = await r.json();
      if (j?.erro) { setCepStatus({ msg: "CEP não encontrado — preencha o endereço manualmente.", ok: false }); return; }
      setForm((p) => ({
        ...p,
        street: j.logradouro || p.street, neighborhood: j.bairro || p.neighborhood,
        city: j.localidade || p.city, state: j.uf || p.state,
        legacy_address: "", // CEP preenchido → substitui qualquer texto legado
      }));
      setCepStatus({ msg: "Endereço preenchido — confira o número.", ok: true });
    } catch { setCepStatus({ msg: "Falha ao buscar o CEP — preencha manualmente.", ok: false }); }
  }, []);

  const cnpjBad = form.cnpj.length > 0 && !cnpjValido(form.cnpj);
  const senseiBad = form.sensei_cpf.length > 0 && !cpfValido(form.sensei_cpf);
  // data "Filiado desde": ISO validado (parseBrDate rejeita 31/02). Completo mas inválido = sinaliza.
  const sinceIso = parseBrDate(form.affiliation_since);
  const sinceBad = form.affiliation_since.length === 10 && sinceIso === null;

  // D3.5.2: NÃO listamos os obrigatórios (Nome, Modelo de filiação) aqui — o
  // "Completar quando quiser" é só para opcionais, sem contradizer o subtítulo.
  const empties = useMemo(() => {
    const e: string[] = [];
    if (!form.region) e.push("Região");
    if (!form.sensei_cpf) e.push("Sensei (CPF)");
    if (!form.phone) e.push("Telefone");
    return e;
  }, [form]);

  async function handleSave() {
    if (!form.name.trim()) { setErrorMsg("Informe o nome do dojô."); return; }
    if (!form.affiliation_model) { setErrorMsg("Escolha o modelo de filiação."); return; }
    if (cnpjBad) { setErrorMsg("O CNPJ informado é inválido. Corrija ou deixe em branco."); return; }
    if (senseiBad) { setErrorMsg("O CPF do sensei é inválido. Corrija ou deixe em branco."); return; }
    if (sinceBad) { setErrorMsg("A data \"Filiado desde\" é inválida. Corrija ou deixe em branco."); return; }
    setErrorMsg(null); setSaving(true);
    // Endereço: envia campos estruturados (address_*). Mantém compat com o texto
    // legado — se o registro só tinha `address` e o usuário não tocou nos campos,
    // reenviamos o texto p/ não apagá-lo silenciosamente.
    const hasStructured = !!(form.street || form.number || form.complement ||
      form.neighborhood || form.city || form.state || form.zip_code);
    const body: DojoInput = {
      name: form.name.trim(),
      affiliation_model: form.affiliation_model as AffiliationModel,
      cnpj: onlyD(form.cnpj) || null,
      sensei_cpf: onlyD(form.sensei_cpf) || null,
      region: form.region || undefined,
      affiliation_since: sinceIso || undefined,
      dojo_founded_year: form.dojo_founded_year ? parseInt(form.dojo_founded_year, 10) : null,
      phone: onlyD(form.phone) || null,
      email: form.email || null,
      // endereço estruturado
      address_street: form.street || null,
      address_number: form.number || null,
      address_complement: form.complement || null,
      address_neighborhood: form.neighborhood || null,
      address_city: form.city || null,
      address_state: form.state ? form.state.toUpperCase().slice(0, 2) : null,
      address_zip: onlyD(form.zip_code) || null,
      // texto legado: só preserva se NÃO houver estruturado preenchido
      address: hasStructured ? null : (form.legacy_address || null),
    };
    try {
      if (isEdit) await karateApi.updateDojo(federationId, dojoId!, body);
      else await karateApi.createDojo(federationId, body);
      setSaving(false);
      showToast(isEdit ? "Alterações salvas" : "Dojô salvo");
      onSaved();
      // dá um instante p/ o toast aparecer antes de fechar
      setTimeout(() => onClose(), 480);
    } catch (e: any) {
      setSaving(false); setErrorMsg(e?.message || "Erro ao salvar. Tente novamente.");
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.card, { width: cardW }]}>
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>空  FPKT · {isEdit ? "Editar dojô" : "Novo dojô"}</Text>
              <Text style={styles.title}>{isEdit ? (form.name || "Dojô") : "Novo dojô"}<Text style={{ color: P.red }}>.</Text></Text>
              {isEdit && fpkt ? (
                <Text style={styles.subMono}>{fpkt}{statusLabel ? `  ·  ${statusLabel}` : ""}</Text>
              ) : (
                <Text style={styles.sub}>Só o nome e o modelo de filiação são obrigatórios — o resto você completa quando quiser. O código FPKT é gerado automaticamente ao salvar.</Text>
              )}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.close}><Ionicons name="close" size={20} color={P.ink2} /></TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator style={{ paddingVertical: 48 }} color={P.red} />
          ) : (
            <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ padding: 20, paddingTop: 6 }} keyboardShouldPersistTaps="handled">
              {empties.length > 0 && (
                <View style={styles.completar}>
                  <Ionicons name="create-outline" size={14} color={P.ink3} />
                  <Text style={styles.completarTtl}>Completar quando quiser:</Text>
                  <Text style={styles.completarList}>{empties.join("  ·  ")}</Text>
                </View>
              )}

              <SectionTitle>Identidade</SectionTitle>
              <Field label="Nome do dojô" req value={form.name} onChangeText={(v) => set("name", v)} placeholder="Ex.: Associação Shobu-Kan Karatê-Dô"
                inputRef={nameRef} returnKeyType="next" onSubmitEditing={() => regionRef.current?.focus()} />

              {/* Modelo de filiação (obrigatório) */}
              <Text style={styles.label}>Modelo de filiação <Text style={{ color: P.red }}>*</Text></Text>
              <View style={styles.models}>
                {MODELS.map((m) => {
                  const on = form.affiliation_model === m.key;
                  return (
                    <TouchableOpacity key={m.key} style={[styles.model, on && styles.modelOn]} onPress={() => set("affiliation_model", m.key)} activeOpacity={0.8} accessibilityLabel={`Modelo ${m.label}`}>
                      <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.radioDot} /> : null}</View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.modelLabel, on && { color: P.ink }]}>{m.label}</Text>
                        <Text style={styles.modelDetail}>{m.detail}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Row2>
                <Field flex label="Região" value={form.region} onChangeText={(v) => set("region", v)} placeholder="Ex.: Vale do Paraíba"
                  inputRef={regionRef} returnKeyType="next" onSubmitEditing={() => cnpjRef.current?.focus()} />
                <Field flex label="CNPJ" hint="opcional" mono value={form.cnpj} onChangeText={(v) => set("cnpj", maskCNPJ(v))} keyboardType="numeric" placeholder="00.000.000/0000-00" bad={cnpjBad}
                  inputRef={cnpjRef} returnKeyType="next" onSubmitEditing={() => senseiRef.current?.focus()}
                  note={cnpjBad ? "CNPJ inválido" : undefined} />
              </Row2>

              <SectionTitle>Sensei &amp; fundação</SectionTitle>
              <Row2>
                <Field flex label="CPF do sensei responsável" mono value={form.sensei_cpf} onChangeText={(v) => set("sensei_cpf", maskCPF(v))} keyboardType="numeric" placeholder="000.000.000-00" bad={senseiBad}
                  inputRef={senseiRef} returnKeyType="next" onSubmitEditing={() => sinceRef.current?.focus()}
                  note={senseiBad ? "CPF inválido" : (form.sensei_cpf && !senseiBad ? "CPF válido" : undefined)} noteOk={!!form.sensei_cpf && !senseiBad} />
              </Row2>
              <Row2>
                <Field flex label="Filiado desde" hint="dd/mm/aaaa" mono value={form.affiliation_since} onChangeText={(v) => set("affiliation_since", maskDate(v))} keyboardType="numeric" placeholder="dd/mm/aaaa"
                  inputRef={sinceRef} returnKeyType="next" onSubmitEditing={() => foundedRef.current?.focus()}
                  bad={sinceBad} note={sinceBad ? "Data inválida" : undefined} />
                <Field flex label="Ano de fundação" mono value={form.dojo_founded_year} onChangeText={(v) => set("dojo_founded_year", onlyD(v).slice(0, 4))} keyboardType="numeric" placeholder="1996" maxLength={4}
                  inputRef={foundedRef} returnKeyType="next" onSubmitEditing={() => phoneRef.current?.focus()} />
              </Row2>

              <SectionTitle>Contato &amp; endereço</SectionTitle>
              <Row2>
                <Field flex label="Telefone" mono value={form.phone} onChangeText={(v) => set("phone", maskPhone(v))} keyboardType="numeric" placeholder="(00) 00000-0000"
                  inputRef={phoneRef} returnKeyType="next" onSubmitEditing={() => emailRef.current?.focus()} />
                <Field flex label="E-mail" value={form.email} onChangeText={(v) => set("email", v)} keyboardType="email-address" autoCapitalize="none" placeholder="dojo@exemplo.com"
                  inputRef={emailRef} returnKeyType="done" onSubmitEditing={handleSave} />
              </Row2>

              {/* CEP destacado — preenche os campos estruturados (igual praticante) */}
              <View style={styles.cepBox}>
                <Text style={styles.cepLabel}>CEP <Text style={styles.cepHint}>· preenche o endereço automaticamente</Text></Text>
                <View style={styles.cepRow}>
                  <TextInput style={[styles.input, styles.mono, { flex: 1, fontSize: 16 }]} value={form.zip_code} onChangeText={onCep} keyboardType="numeric" placeholder="00000-000" placeholderTextColor={P.ink4} maxLength={9} accessibilityLabel="CEP" />
                  {cepStatus?.msg === "Buscando endereço…" ? <ActivityIndicator color={P.red} style={{ width: 36 }} /> : <Ionicons name="search" size={18} color={P.ink3} style={{ width: 36, textAlign: "center" }} />}
                </View>
                {cepStatus ? <Text style={[styles.note, cepStatus.ok ? styles.noteOk : styles.noteBad]}>{cepStatus.msg}</Text> : null}
              </View>

              <Row2>
                <Field flex2 label="Logradouro" value={form.street} onChangeText={(v) => set("street", v)} placeholder="Rua, avenida…" />
                <Field flex label="Número" mono value={form.number} onChangeText={(v) => set("number", v)} placeholder="000" keyboardType="numeric" />
              </Row2>
              <Row2>
                <Field flex label="Complemento" value={form.complement} onChangeText={(v) => set("complement", v)} placeholder="Sala, bloco…" />
                <Field flex label="Bairro" value={form.neighborhood} onChangeText={(v) => set("neighborhood", v)} />
              </Row2>
              <Row2>
                <Field flex2 label="Cidade" value={form.city} onChangeText={(v) => set("city", v)} />
                <Field flex label="UF" mono value={form.state} onChangeText={(v) => set("state", v.toUpperCase().slice(0, 2))} maxLength={2} placeholder="SP" />
              </Row2>

              {/* Texto legado: só aparece em registros antigos que ainda não têm campos.
                  Editável, mas ao preencher o CEP/campos ele é substituído. */}
              {form.legacy_address ? (
                <View style={styles.field}>
                  <Text style={styles.label}>Endereço (registro antigo)<Text style={styles.labelHint}>  · preencha os campos acima para estruturar</Text></Text>
                  <TextInput style={[styles.input, { minHeight: 52, textAlignVertical: "top" }]} value={form.legacy_address} onChangeText={(v) => set("legacy_address", v)}
                    placeholder="Endereço em texto livre" placeholderTextColor={P.ink4} multiline accessibilityLabel="Endereço (registro antigo)" />
                </View>
              ) : null}

              {errorMsg ? (
                <View style={styles.errBox}><Ionicons name="alert-circle" size={15} color={P.red} /><Text style={styles.errTxt}>{errorMsg}</Text></View>
              ) : null}
            </ScrollView>
          )}

          <View style={styles.footer}>
            <TouchableOpacity onPress={onClose} style={styles.btnGhost}><Text style={styles.btnGhostTxt}>Cancelar</Text></TouchableOpacity>
            <TouchableOpacity onPress={handleSave} disabled={saving || loading} style={[styles.btnPrimary, (saving || loading) && { opacity: 0.6 }]}>
              {saving ? <ActivityIndicator color="#fdf8f2" size="small" /> : <Text style={styles.btnPrimaryTxt}>{isEdit ? "Salvar alterações" : "Salvar dojô"}</Text>}
            </TouchableOpacity>
          </View>

          {/* toast de sucesso (inline) */}
          {toast ? (
            <Animated.View pointerEvents="none" style={[styles.toast, {
              opacity: toastAnim,
              transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
            }]}>
              <Ionicons name="checkmark-circle" size={16} color="#bfe3c4" />
              <Text style={styles.toastTxt}>{toast}</Text>
            </Animated.View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <View style={styles.sectionH}><Text style={styles.sectionTtl}>{children}</Text><View style={styles.sectionRule} /></View>;
}
function Row2({ children }: { children: React.ReactNode }) { return <View style={styles.row2}>{children}</View>; }
function Field(props: {
  label: string; value: string; onChangeText: (v: string) => void; placeholder?: string;
  hint?: string; req?: boolean; mono?: boolean; flex?: boolean; flex2?: boolean; bad?: boolean;
  note?: string; noteOk?: boolean; keyboardType?: any; autoCapitalize?: any; maxLength?: number;
  inputRef?: React.RefObject<TextInput>; returnKeyType?: any; onSubmitEditing?: () => void;
}) {
  return (
    <View style={[styles.field, props.flex && { flex: 1 }, props.flex2 && { flex: 2 }]}>
      <Text style={styles.label}>{props.label}{props.req ? <Text style={{ color: P.red }}> *</Text> : null}{props.hint ? <Text style={styles.labelHint}>  · {props.hint}</Text> : null}</Text>
      <TextInput
        ref={props.inputRef}
        style={[styles.input, props.mono && styles.mono, props.bad && styles.inputBad]} value={props.value} onChangeText={props.onChangeText}
        placeholder={props.placeholder} placeholderTextColor={P.ink4} keyboardType={props.keyboardType} autoCapitalize={props.autoCapitalize} maxLength={props.maxLength}
        accessibilityLabel={props.label}
        returnKeyType={props.returnKeyType} onSubmitEditing={props.onSubmitEditing} blurOnSubmit={props.returnKeyType === "done"} />
      {props.note ? <Text style={[styles.note, props.noteOk ? styles.noteOk : props.bad ? styles.noteBad : null]}>{props.note}</Text> : null}
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

  models: { gap: 8, marginBottom: 11 } as ViewStyle,
  model: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: P.glassHi, borderWidth: 1, borderColor: P.line2, borderRadius: 14, paddingVertical: 11, paddingHorizontal: 14 } as ViewStyle,
  modelOn: { borderColor: P.red, backgroundColor: P.redWash } as ViewStyle,
  radio: { width: 18, height: 18, borderRadius: 999, borderWidth: 1.5, borderColor: P.line2, alignItems: "center", justifyContent: "center" } as ViewStyle,
  radioOn: { borderColor: P.red } as ViewStyle,
  radioDot: { width: 9, height: 9, borderRadius: 999, backgroundColor: P.red } as ViewStyle,
  modelLabel: { fontFamily: F.body, fontSize: 13.5, fontWeight: "600", color: P.ink2 } as TextStyle,
  modelDetail: { fontFamily: F.body, fontSize: 11, color: P.ink3, marginTop: 1 } as TextStyle,

  cepBox: { backgroundColor: P.glass, borderWidth: 1, borderColor: P.redLine, borderRadius: R.lg, padding: 14, marginBottom: 12 } as ViewStyle,
  cepLabel: { fontFamily: F.body, fontSize: 12, fontWeight: "700", color: P.ink, marginBottom: 7 } as TextStyle,
  cepHint: { fontWeight: "500", color: P.ink3 } as TextStyle,
  cepRow: { flexDirection: "row", alignItems: "center", gap: 6 } as ViewStyle,

  errBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(184,70,58,0.08)", borderWidth: 1, borderColor: P.redLine, borderRadius: 12, padding: 11, marginTop: 12 } as ViewStyle,
  errTxt: { fontFamily: F.body, fontSize: 12.5, color: P.red2, flex: 1 } as TextStyle,

  footer: { flexDirection: "row", justifyContent: "flex-end", gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: P.line, backgroundColor: P.glassHi } as ViewStyle,
  btnGhost: { paddingVertical: 11, paddingHorizontal: 18, borderRadius: R.md, borderWidth: 1, borderColor: P.line2 } as ViewStyle,
  btnGhostTxt: { fontFamily: F.body, fontSize: 13.5, fontWeight: "600", color: P.ink } as TextStyle,
  btnPrimary: { paddingVertical: 11, paddingHorizontal: 22, borderRadius: R.md, backgroundColor: P.ink, minWidth: 150, alignItems: "center" } as ViewStyle,
  btnPrimaryTxt: { fontFamily: F.body, fontSize: 13.5, fontWeight: "600", color: "#fdf8f2" } as TextStyle,

  // toast de sucesso (inline, ancorado no rodapé do card)
  toast: { position: "absolute", left: 16, right: 16, bottom: 74, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: P.ink, borderRadius: R.md, paddingVertical: 11, paddingHorizontal: 14 } as ViewStyle,
  toastTxt: { fontFamily: F.body, fontSize: 13, fontWeight: "600", color: "#fdf8f2", flex: 1 } as TextStyle,
});

export default DojoFichaModal;
