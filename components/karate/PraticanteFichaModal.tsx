// ============================================================
// Ficha do Praticante — MODAL (cadastro + edição) · Aura Karatê (Shoji)
//
// Abre sobre a lista de Praticantes (sem troca de página → navegação fluida).
// Cadastro:  POST  /federation/:id/practitioners
// Edição:    PATCH /federation/:id/practitioners/:practitionerId  (Aura-backend#226)
//
// Princípios (decisões Caio):
//  - Dado AUSENTE é neutro/opcional ("Completar quando quiser"), NÃO é erro.
//    Só dado INVÁLIDO (ex.: CPF, data impossível) é sinalizado.
//  - CEP em destaque + autofill (ViaCEP).
//  - Nº FPKT é gerado no backend (NNNNN-D) — aqui só exibimos.
//  - Faixa e passaporte NÃO entram nesta ficha (faixa = histórico imutável;
//    passaporte = fluxo de Dan, adiado). Graduação entra pela aba Trajetória.
//  - Status (ativo/inativo) é editável só no modo edição (cadastro nasce ativo).
//  - Data validada de verdade: a conversão no envio usa parseBrDate (round-trip
//    de Date → rejeita 31/02). A máscara de digitação continua dd/mm/aaaa.
//  - Feedback de sucesso leve: toast Shoji inline ("Praticante salvo") — o app
//    não tem sistema de toast/snackbar global, então fazemos um mínimo aqui.
//  - "Repetir dados do último cadastro" (P2): opt-in, só no cadastro novo.
//    Pré-preenche o que TENDE a se repetir num mesmo dojô (dojô + endereço),
//    nunca os campos únicos (nome, CPF, RG, nascimento, telefone, e-mail).
//  - Edição: o dojô atual vem pré-selecionado (lê p.dojo_name do detalhe) —
//    sem isso o campo obrigatório mostrava "Selecionar dojô…" e forçava
//    reseleção (fix F1.2 23/06).
// ============================================================
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Modal, View, Text, TextInput, ScrollView, Pressable, TouchableOpacity,
  ActivityIndicator, useWindowDimensions, StyleSheet, ViewStyle, TextStyle, FlatList,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ShojiPalette as P, KarateRadius as R, KarateFonts as F } from "@/constants/karateTheme";
import { karateApi, Dojo } from "@/services/karateApi";
import { request } from "@/services/api";
import { parseBrDate } from "@/components/inputs/DateInput";

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
  is_active: true,
};
type Form = typeof EMPTY;

// Lembra o último dojô selecionado na sessão (cadastro em massa do mesmo dojô).
// Module-level simples — sem libs, vive enquanto o app está aberto.
let lastDojo: { id: string; name: string } | null = null;

// Lembra os campos COMPARTILHÁVEIS do último praticante criado nesta sessão
// (dojô + endereço, que tendem a se repetir num mesmo dojô). NUNCA guarda
// campos únicos: nome, CPF, RG, nascimento, telefone, e-mail. Module-level
// simples, mesma filosofia do lastDojo — opt-in via botão, nunca automático.
type SharedSnapshot = {
  dojo_id: string; dojo_name: string;
  zip_code: string; street: string; number: string; complement: string;
  neighborhood: string; city: string; state: string;
};
let lastShared: SharedSnapshot | null = null;

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
// idade a partir do ISO validado (YYYY-MM-DD)
function ageFromISO(iso: string | null): number | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  if (isNaN(d.getTime())) return null;
  const t = new Date(); let a = t.getFullYear() - d.getFullYear();
  const mm = t.getMonth() - d.getMonth();
  if (mm < 0 || (mm === 0 && t.getDate() < d.getDate())) a--;
  return a;
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
  // toast de sucesso (inline, sem sistema global)
  const [toast, setToast] = useState<string | null>(null);
  // "repetir dados do último cadastro" só faz sentido se já houve um nesta sessão
  const [canRepeat, setCanRepeat] = useState(false);

  // refs p/ Enter avançar os campos de texto
  const nameRef = useRef<TextInput>(null);
  const birthRef = useRef<TextInput>(null);
  const cpfRef = useRef<TextInput>(null);
  const rgRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((p) => ({ ...p, [k]: v }));

  // carrega ficha em edição
  useEffect(() => {
    if (!visible) return;
    setErrorMsg(null); setCepStatus(null); setToast(null);
    if (!practitionerId) {
      // cadastro novo: pré-seleciona o último dojô da sessão (se houver)
      setForm(lastDojo ? { ...EMPTY, dojo_id: lastDojo.id, dojo_name: lastDojo.name } : EMPTY);
      setFpkt(null); setBeltName(null);
      setCanRepeat(!!lastShared);
      return;
    }
    setCanRepeat(false);
    setLoading(true);
    karateApi.getPractitioner(federationId, practitionerId)
      .then((p: any) => {
        // F1.2: pré-seleciona o dojô atual. O detalhe retorna dojo_id + dojo_name;
        // sem dojo_name o DojoSelect mostrava "Selecionar dojô…" (campo obrigatório
        // aparentava vazio e forçava reseleção). Mantém o id no lastDojo p/ que o
        // selector exiba o rótulo mesmo se o backend só devolver o id.
        const dojoName = p.dojo_name || "";
        if (p.dojo_id && dojoName) lastDojo = { id: p.dojo_id, name: dojoName };
        setForm({
          full_name: p.full_name || "", cpf: p.cpf ? maskCPF(p.cpf) : "", rg: p.rg || "",
          birth_date: fromISO(p.birth_date), email: p.email || "", phone: p.phone ? maskPhone(p.phone) : "",
          dojo_id: p.dojo_id || "", dojo_name: dojoName,
          zip_code: p.zip_code ? maskCEP(p.zip_code) : "", street: p.street || "", number: p.number || "",
          complement: p.complement || "", neighborhood: p.neighborhood || "", city: p.city || "", state: p.state || "",
          is_arbiter: !!p.is_arbiter, is_instructor: !!p.is_instructor, is_examiner: !!p.is_examiner,
          is_active: p.is_active !== false, // default ativo
        });
        setFpkt(p.karate_registration_number || null);
        setBeltName(p.current_belt?.belt_name || null);
      })
      .catch(() => setErrorMsg("Não foi possível carregar a ficha."))
      .finally(() => setLoading(false));
  }, [visible, practitionerId, federationId]);

  // autofocus no Nome ao abrir (cadastro novo, após render)
  useEffect(() => {
    if (visible && !practitionerId && !loading) {
      const t = setTimeout(() => nameRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [visible, practitionerId, loading]);

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

  // "Repetir dados do último cadastro" — opt-in, só campos compartilháveis
  const repeatLast = useCallback(() => {
    if (!lastShared) return;
    const s = lastShared;
    setForm((p) => ({
      ...p,
      dojo_id: s.dojo_id, dojo_name: s.dojo_name,
      zip_code: s.zip_code, street: s.street, number: s.number, complement: s.complement,
      neighborhood: s.neighborhood, city: s.city, state: s.state,
    }));
    if (s.dojo_id) lastDojo = { id: s.dojo_id, name: s.dojo_name };
    setCepStatus(null);
    showToast("Dados do último cadastro aplicados");
  }, [showToast]);

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

  // data: ISO validado (parseBrDate rejeita 31/02). Completo mas inválido = sinaliza.
  const birthIso = parseBrDate(form.birth_date);
  const dateComplete = form.birth_date.length === 10;
  const dateBad = dateComplete && birthIso === null;
  const age = ageFromISO(birthIso);
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
    if (dateBad) { setErrorMsg("A data de nascimento é inválida. Corrija ou deixe em branco."); return; }
    if (cpfBad) { setErrorMsg("O CPF informado é inválido. Corrija ou deixe em branco."); return; }
    setErrorMsg(null); setSaving(true);
    const body: any = {
      full_name: form.full_name.trim(),
      cpf: onlyD(form.cpf) || null,
      rg: form.rg || null,
      birth_date: birthIso,
      email: form.email || null,
      phone: onlyD(form.phone) || null,
      dojo_id: form.dojo_id,
      is_arbiter: form.is_arbiter, is_instructor: form.is_instructor, is_examiner: form.is_examiner,
      is_active: form.is_active,
      street: form.street || null, number: form.number || null, complement: form.complement || null,
      neighborhood: form.neighborhood || null, city: form.city || null,
      state: form.state ? form.state.toUpperCase().slice(0, 2) : null,
      zip_code: onlyD(form.zip_code) || null,
    };
    try {
      if (isEdit) await request(`/federation/${federationId}/practitioners/${practitionerId}`, { method: "PATCH", body });
      else await request(`/federation/${federationId}/practitioners`, { method: "POST", body });
      // guarda os campos compartilháveis p/ "repetir dados do último" (só cadastro novo)
      if (!isEdit) {
        lastShared = {
          dojo_id: form.dojo_id, dojo_name: form.dojo_name || (lastDojo?.id === form.dojo_id ? lastDojo.name : ""),
          zip_code: form.zip_code, street: form.street, number: form.number, complement: form.complement,
          neighborhood: form.neighborhood, city: form.city, state: form.state,
        };
      }
      setSaving(false);
      showToast(isEdit ? "Alterações salvas" : "Praticante salvo");
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
              {/* repetir dados do último cadastro (opt-in, discreto, só cadastro novo) */}
              {!isEdit && canRepeat && (
                <TouchableOpacity style={styles.repeat} onPress={repeatLast} activeOpacity={0.7} accessibilityLabel="Repetir dados do último cadastro">
                  <Ionicons name="copy-outline" size={14} color={P.ink2} />
                  <Text style={styles.repeatTxt}>Repetir dados do último cadastro</Text>
                  <Text style={styles.repeatHint}>dojô e endereço</Text>
                </TouchableOpacity>
              )}

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
              <Field label="Nome completo" req value={form.full_name} onChangeText={(v) => set("full_name", v)} placeholder="Ex.: Maria Tanaka de Souza"
                inputRef={nameRef} returnKeyType="next" onSubmitEditing={() => birthRef.current?.focus()} />
              <DojoSelect federationId={federationId} valueId={form.dojo_id} valueName={form.dojo_name}
                onSelect={(d) => { lastDojo = { id: d.id, name: d.name }; setForm((p) => ({ ...p, dojo_id: d.id, dojo_name: d.name })); }} />
              <Row2>
                <Field flex label="Nascimento" hint="dd/mm/aaaa" mono value={form.birth_date}
                  onChangeText={(v) => set("birth_date", maskDate(v))} keyboardType="numeric" placeholder="dd/mm/aaaa"
                  inputRef={birthRef} returnKeyType="next" onSubmitEditing={() => cpfRef.current?.focus()}
                  bad={dateBad}
                  note={dateBad ? "Data inválida" : (age != null ? `${age} anos${age < 18 ? " · menor de idade" : ""}` : undefined)} />
                <Field flex label="CPF" mono value={form.cpf} onChangeText={(v) => set("cpf", maskCPF(v))}
                  keyboardType="numeric" placeholder="000.000.000-00" bad={cpfBad}
                  inputRef={cpfRef} returnKeyType="next" onSubmitEditing={() => rgRef.current?.focus()}
                  note={cpfBad ? "Dígitos não conferem" : form.cpf ? "CPF válido" : undefined} noteOk={!cpfBad && !!form.cpf} />
              </Row2>
              <Field label="RG" mono value={form.rg} onChangeText={(v) => set("rg", v)} placeholder="00.000.000-0"
                inputRef={rgRef} returnKeyType="next" onSubmitEditing={() => phoneRef.current?.focus()} />
              {age != null && age < 18 && (
                <View style={styles.lgpd}>
                  <Ionicons name="shield-checkmark-outline" size={14} color={P.ink2} />
                  <Text style={styles.lgpdTxt}>Menor de idade — responsável legal exigido (LGPD Art. 14). O cadastro do responsável entra no próximo passo.</Text>
                </View>
              )}

              {/* CONTATO & ENDEREÇO — CEP em destaque */}
              <SectionTitle>Contato &amp; endereço</SectionTitle>
              <Row2>
                <Field flex label="Telefone" mono value={form.phone} onChangeText={(v) => set("phone", maskPhone(v))} keyboardType="numeric" placeholder="(00) 00000-0000"
                  inputRef={phoneRef} returnKeyType="next" onSubmitEditing={() => emailRef.current?.focus()} />
                <Field flex label="E-mail" value={form.email} onChangeText={(v) => set("email", v)} keyboardType="email-address" autoCapitalize="none" placeholder="nome@exemplo.com"
                  inputRef={emailRef} returnKeyType="done" onSubmitEditing={handleSave} />
              </Row2>

              {/* CEP destacado */}
              <View style={styles.cepBox}>
                <Text style={styles.cepLabel}>CEP <Text style={styles.cepHint}>· preenche o endereço automaticamente</Text></Text>
                <View style={styles.cepRow}>
                  <TextInput style={[styles.input, styles.mono, { flex: 1, fontSize: 16 }]} value={form.zip_code}
                    onChangeText={onCep} keyboardType="numeric" placeholder="00000-000" placeholderTextColor={P.ink4} maxLength={9}
                    accessibilityLabel="CEP" returnKeyType="next" />
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

              {/* STATUS — só na edição (no cadastro o praticante já nasce ativo) */}
              {isEdit && (
                <>
                  <SectionTitle>Status</SectionTitle>
                  <Toggle
                    label={form.is_active ? "Ativo" : "Inativo"}
                    hint={form.is_active ? "Aparece como ativo na federação" : "Mantido no histórico, fora da contagem de ativos"}
                    on={form.is_active}
                    onPress={() => set("is_active", !form.is_active)}
                  />
                </>
              )}

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
  inputRef?: React.RefObject<TextInput>; returnKeyType?: any; onSubmitEditing?: () => void;
}) {
  return (
    <View style={[styles.field, props.flex && { flex: 1 }, props.flex2 && { flex: 2 }]}>
      <Text style={styles.label}>{props.label}{props.req ? <Text style={{ color: P.red }}> *</Text> : null}{props.hint ? <Text style={styles.labelHint}>  · {props.hint}</Text> : null}</Text>
      <TextInput
        ref={props.inputRef}
        style={[styles.input, props.mono && styles.mono, props.bad && styles.inputBad]}
        value={props.value} onChangeText={props.onChangeText} placeholder={props.placeholder}
        placeholderTextColor={P.ink4} keyboardType={props.keyboardType} autoCapitalize={props.autoCapitalize} maxLength={props.maxLength}
        accessibilityLabel={props.label}
        returnKeyType={props.returnKeyType} onSubmitEditing={props.onSubmitEditing} blurOnSubmit={props.returnKeyType === "done"}
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
  const [label, setLabel] = useState(valueName || (valueId && lastDojo?.id === valueId ? lastDojo.name : ""));

  useEffect(() => {
    if (valueName) { setLabel(valueName); return; }
    if (valueId && lastDojo?.id === valueId) setLabel(lastDojo.name);
  }, [valueName, valueId]);

  const fetchDojos = useCallback(async (term: string) => {
    setLoading(true);
    try { const res = await karateApi.listDojos(federationId, { q: term || undefined, pageSize: 50 }); return res.data; }
    catch { return [] as Dojo[]; } finally { setLoading(false); }
  }, [federationId]);

  // ao abrir, carrega a lista (e se só houver 1 dojô e nada selecionado, pré-seleciona)
  useEffect(() => {
    if (!open) return;
    let alive = true;
    fetchDojos("").then((data) => {
      if (!alive) return;
      setList(data);
      if (!valueId && data.length === 1) {
        const only = data[0];
        lastDojo = { id: only.id, name: only.name };
        setLabel(only.name);
        onSelect(only);
        setOpen(false);
      }
    });
    return () => { alive = false; };
  }, [open, fetchDojos]); // eslint-disable-line react-hooks/exhaustive-deps

  // pré-seleciona único dojô já na montagem (sem precisar abrir o dropdown)
  useEffect(() => {
    if (valueId) return;
    let alive = true;
    fetchDojos("").then((data) => {
      if (!alive) return;
      if (!valueId && data.length === 1) {
        const only = data[0];
        lastDojo = { id: only.id, name: only.name };
        setLabel(only.name);
        onSelect(only);
      }
    });
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // F1.2: no modo edição o dojo_id já vem do detalhe mas o nome pode não ter
  // chegado no primeiro render (corrida com o carregamento do dojo_name).
  // Se temos id mas ainda não temos rótulo, busca a lista uma vez e resolve.
  useEffect(() => {
    if (!valueId || label) return;
    let alive = true;
    fetchDojos("").then((data) => {
      if (!alive) return;
      const hit = data.find((d) => d.id === valueId);
      if (hit) { lastDojo = { id: hit.id, name: hit.name }; setLabel(hit.name); }
    });
    return () => { alive = false; };
  }, [valueId, label, fetchDojos]);

  const onSearch = useCallback((t: string) => {
    setQ(t);
    fetchDojos(t).then(setList);
  }, [fetchDojos]);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>Dojô <Text style={{ color: P.red }}>*</Text></Text>
      <TouchableOpacity style={styles.input} onPress={() => setOpen((o) => !o)} activeOpacity={0.7} accessibilityLabel="Dojô">
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontFamily: F.body, fontSize: 14, color: label ? P.ink : P.ink4 }} numberOfLines={1}>{label || "Selecionar dojô…"}</Text>
          <Ionicons name={open ? "chevron-up" : "chevron-down"} size={14} color={P.ink3} />
        </View>
      </TouchableOpacity>
      {open && (
        <View style={styles.dropdown}>
          <TextInput style={styles.dropdownSearch} placeholder="Buscar por nome ou FPKT-NNN" placeholderTextColor={P.ink4}
            value={q} onChangeText={onSearch} autoFocus accessibilityLabel="Buscar dojô" />
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

  repeat: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", backgroundColor: P.glassHi, borderWidth: 1, borderColor: P.line2, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 13, marginBottom: 10 } as ViewStyle,
  repeatTxt: { fontFamily: F.body, fontSize: 12.5, fontWeight: "600", color: P.ink } as TextStyle,
  repeatHint: { fontFamily: F.body, fontSize: 11, color: P.ink3 } as TextStyle,

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

  // toast de sucesso (inline, ancorado no rodapé do card)
  toast: { position: "absolute", left: 16, right: 16, bottom: 74, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: P.ink, borderRadius: R.md, paddingVertical: 11, paddingHorizontal: 14 } as ViewStyle,
  toastTxt: { fontFamily: F.body, fontSize: 13, fontWeight: "600", color: "#fdf8f2", flex: 1 } as TextStyle,
});

export default PraticanteFichaModal;
