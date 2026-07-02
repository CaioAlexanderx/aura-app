// ============================================================
// Ficha do Praticante — MODAL (cadastro + edição) · Aura Karatê (Shoji)
//
// Shell: mantém estado do form, validações e submit.
// O JSX da ficha foi decomposto em seções em components/karate/praticante-ficha/.
//
// Cadastro:  POST  /federation/:id/practitioners
// Edição:    PATCH /federation/:id/practitioners/:practitionerId  (Aura-backend#226)
//
// Upload de foto (feat/karate-foto-upload-real):
//   POST /federation/:id/practitioners/:practitionerId/photo
//   → ocorre APÓS o create/patch; falha no upload não reverte o cadastro.
//
// Princípios (decisões Caio): ver praticante-ficha/helpers.ts + seções.
// ============================================================
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Modal, View, Text, ScrollView, TouchableOpacity, Pressable,
  ActivityIndicator, useWindowDimensions, TextInput, Animated, StyleSheet,
} from "react-native";
import { Icon } from "@/components/Icon";
import { ShojiPalette as P } from "@/constants/karateTheme";
import { karateApi } from "@/services/karateApi";
import { request } from "@/services/api";
import { parseBrDate } from "@/components/inputs/DateInput";
import { maskCpf, maskPhone as maskPhoneUtil } from "@/utils/masks";
import { pickFileWeb } from "@/services/studioUploadApi";

import {
  EMPTY, Form, SharedSnapshot,
  onlyD, maskCEP, ageFromBrDate, ageFromISO, fromISO, cpfValido,
} from "./praticante-ficha/helpers";
import { styles } from "./praticante-ficha/shared-styles";
import { DadosBasicosSection } from "./praticante-ficha/DadosBasicosSection";
import { FotoSection, fileToBase64 } from "./praticante-ficha/FotoSection";
import { EnderecoSection } from "./praticante-ficha/EnderecoSection";
import { ResponsavelSection } from "./praticante-ficha/ResponsavelSection";
import { PapeisSection } from "./praticante-ficha/PapeisSection";

interface Props {
  federationId: string;
  visible: boolean;
  practitionerId?: string | null; // ausente = cadastro; presente = edição
  onClose: () => void;
  onSaved: () => void;
}

// Lembra o último dojô selecionado na sessão (cadastro em massa do mesmo dojô).
// Module-level simples — sem libs, vive enquanto o app está aberto.
let lastDojo: { id: string; name: string } | null = null;

// Lembra os campos COMPARTILHÁVEIS do último praticante criado nesta sessão
// (dojô + endereço, que tendem a se repetir num mesmo dojô). NUNCA guarda
// campos únicos: nome, CPF, RG, nascimento, telefone, e-mail.
let lastShared: SharedSnapshot | null = null;

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
  // P6: estado de carregamento do upload de foto
  const [photoLoading, setPhotoLoading] = useState(false);
  // P6: File escolhido pelo usuário (web); null = nenhuma foto nova nesta sessão de edição
  const pendingPhotoFile = useRef<File | null>(null);

  // ref mutável para lastDojo — passado para DojoSelectSection
  const lastDojoRef = useRef<{ id: string; name: string } | null>(lastDojo);
  // sincroniza com a variável module-level ao mutar
  const syncLastDojo = useCallback((d: { id: string; name: string } | null) => {
    lastDojo = d;
    lastDojoRef.current = d;
  }, []);

  // refs p/ Enter avançar os campos de texto
  const nameRef = useRef<TextInput>(null);
  const birthRef = useRef<TextInput>(null);
  const cpfRef = useRef<TextInput>(null);
  const rgRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  // P7: refs para campos do responsável
  const guardianNameRef = useRef<TextInput>(null);
  const guardianCpfRef = useRef<TextInput>(null);
  const guardianPhoneRef = useRef<TextInput>(null);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((p) => ({ ...p, [k]: v }));

  // carrega ficha em edição
  useEffect(() => {
    if (!visible) return;
    setErrorMsg(null); setCepStatus(null); setToast(null);
    pendingPhotoFile.current = null; // limpa foto pendente ao abrir
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
        // F1.2: pré-seleciona o dojô atual
        const dojoName = p.dojo_name || "";
        if (p.dojo_id && dojoName) syncLastDojo({ id: p.dojo_id, name: dojoName });
        setForm({
          full_name: p.full_name || "", cpf: p.cpf ? maskCpf(p.cpf) : "", rg: p.rg || "",
          birth_date: fromISO(p.birth_date), email: p.email || "", phone: p.phone ? maskPhoneUtil(p.phone) : "",
          dojo_id: p.dojo_id || "", dojo_name: dojoName,
          zip_code: p.zip_code ? maskCEP(p.zip_code) : "", street: p.street || "", number: p.number || "",
          complement: p.complement || "", neighborhood: p.neighborhood || "", city: p.city || "", state: p.state || "",
          is_arbiter: !!p.is_arbiter, is_instructor: !!p.is_instructor, is_examiner: !!p.is_examiner,
          is_active: p.is_active !== false,
          // P6: usa karate_photo_url (campo permanente do R2) se disponível
          photo_url: p.karate_photo_url || p.photo_url || "",
          // P7
          guardian_name: p.guardian_name || "",
          guardian_cpf: p.guardian_cpf ? maskCpf(p.guardian_cpf) : "",
          guardian_phone: p.guardian_phone ? maskPhoneUtil(p.guardian_phone) : "",
          guardian_relationship: (p.guardian_relationship as any) || "",
          // F9
          sex: (p.sex as any) || "",
          affiliation_since: fromISO(p.affiliation_since),
        });
        setFpkt(p.karate_registration_number || null);
        setBeltName(p.current_belt?.belt_name || null);
      })
      .catch(() => setErrorMsg("Não foi possível carregar a ficha."))
      .finally(() => setLoading(false));
  }, [visible, practitionerId, federationId, syncLastDojo]);

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
    if (s.dojo_id) syncLastDojo({ id: s.dojo_id, name: s.dojo_name });
    setCepStatus(null);
    showToast("Dados do último cadastro aplicados");
  }, [showToast, syncLastDojo]);

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

  // data: ISO validado (parseBrDate rejeita 31/02)
  const birthIso = parseBrDate(form.birth_date);
  const dateComplete = form.birth_date.length === 10;
  const dateBad = dateComplete && birthIso === null;
  const age = ageFromISO(birthIso);
  const cpfBad = form.cpf.length > 0 && !cpfValido(form.cpf);

  // P7: calcula a idade a partir da string dd/mm/aaaa do form (parse LOCAL)
  const ageFromForm = ageFromBrDate(form.birth_date);
  const isMinor = ageFromForm !== null && ageFromForm < 18;

  const guardianCpfBad = form.guardian_cpf.length > 0 && !cpfValido(form.guardian_cpf);

  // P6: handler de foto — abre picker, gera preview local, guarda File no ref
  const handlePickPhoto = useCallback(async () => {
    setPhotoLoading(true);
    try {
      const file = await pickFileWeb("image/*");
      if (!file) return;
      // Guarda o File para upload no handleSave
      pendingPhotoFile.current = file;
      // Preview imediato via blob URL — substituído pela URL permanente após upload
      const blobUrl = URL.createObjectURL(file);
      set("photo_url", blobUrl);
    } catch {
      // erro silencioso — usuário cancelou ou falha de leitura
    } finally {
      setPhotoLoading(false);
    }
  }, []);

  // campos vazios (neutro, opcional). D3.5.2: NÃO listamos os obrigatórios.
  const empties = useMemo(() => {
    const e: string[] = [];
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
    // P7: menor de idade sem responsável nomeado → bloqueia
    if (isMinor && !form.guardian_name.trim()) {
      setErrorMsg("Para menores de 18 anos, o nome do responsável é obrigatório (LGPD Art. 14).");
      return;
    }
    if (guardianCpfBad) { setErrorMsg("O CPF do responsável é inválido. Corrija ou deixe em branco."); return; }
    setErrorMsg(null); setSaving(true);

    // P6: nunca envia blob URL no body do praticante.
    // A foto é vinculada exclusivamente via o endpoint dedicado /photo (após o save).
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
      // P7
      guardian_name: form.guardian_name.trim() || null,
      guardian_cpf: onlyD(form.guardian_cpf) || null,
      guardian_phone: onlyD(form.guardian_phone) || null,
      guardian_relationship: form.guardian_relationship || null,
      // F9: sexo + filiado desde (mesmo padrão do birth_date: string dd/mm/aaaa → ISO no submit)
      sex: form.sex || null,
      affiliation_since: parseBrDate(form.affiliation_since),
      // P6: photo_url deliberadamente AUSENTE do body (blob inútil; URL permanente vem do /photo)
    };

    let savedId: string | null = practitionerId ?? null;

    try {
      if (isEdit) {
        await request(`/federation/${federationId}/practitioners/${practitionerId}`, { method: "PATCH", body });
      } else {
        // create retorna o praticante com o id atribuído pelo backend
        const created: any = await request(`/federation/${federationId}/practitioners`, { method: "POST", body });
        savedId = created?.id ?? null;
      }
    } catch (e: any) {
      setSaving(false);
      setErrorMsg(e?.message || "Erro ao salvar. Tente novamente.");
      return;
    }

    // guarda os campos compartilháveis p/ "repetir dados do último" (só cadastro novo)
    if (!isEdit) {
      lastShared = {
        dojo_id: form.dojo_id, dojo_name: form.dojo_name || (lastDojo?.id === form.dojo_id ? lastDojo.name : ""),
        zip_code: form.zip_code, street: form.street, number: form.number, complement: form.complement,
        neighborhood: form.neighborhood, city: form.city, state: form.state,
      };
    }

    // ── P6: Upload da foto (se o usuário escolheu uma nova) ──────────────
    // Ocorre APÓS o create/patch para garantir que o practitionerId exista.
    // Falha no upload não reverte o cadastro — aviso discreto ao usuário.
    const fileToUpload = pendingPhotoFile.current;
    if (fileToUpload && savedId) {
      try {
        const { content, content_type } = await fileToBase64(fileToUpload);
        const result = await karateApi.uploadPractitionerPhoto(federationId, savedId, { content, content_type });
        // Atualiza o preview com a URL permanente do R2
        set("photo_url", result.photo_url);
        pendingPhotoFile.current = null;
      } catch {
        // Cadastro salvo com sucesso; apenas a foto falhou → aviso sem reverter
        setSaving(false);
        showToast(isEdit ? "Alterações salvas" : "Praticante salvo");
        setErrorMsg("Praticante salvo, mas a foto não pôde ser enviada. Tente trocar a foto novamente.");
        onSaved();
        setTimeout(() => onClose(), 480);
        return;
      }
    } else if (fileToUpload && !savedId) {
      // Praticante criado mas o backend não retornou id — pula o upload
      setSaving(false);
      showToast("Praticante salvo");
      setErrorMsg("Praticante salvo, mas a foto não pôde ser enviada (id não retornado pelo servidor).");
      onSaved();
      setTimeout(() => onClose(), 480);
      return;
    }

    // ── Fluxo normal: tudo ok ────────────────────────────────────────────
    setSaving(false);
    showToast(isEdit ? "Alterações salvas" : "Praticante salvo");
    onSaved();
    // dá um instante p/ o toast aparecer antes de fechar
    setTimeout(() => onClose(), 480);
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
              <Text style={styles.title}>
                {isEdit ? (form.full_name || "Praticante") : "Novo praticante"}
                <Text style={{ color: P.red }}>.</Text>
              </Text>
              {isEdit && fpkt ? (
                <Text style={styles.subMono}>{fpkt}{beltName ? `  ·  ${beltName}` : ""}</Text>
              ) : (
                <Text style={styles.sub}>Só o nome é obrigatório — o resto você completa quando quiser.</Text>
              )}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.close}>
              <Icon name="x" size={20} color={P.ink2} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator style={{ paddingVertical: 48 }} color={P.red} />
          ) : (
            <ScrollView
              style={{ maxHeight: 520 }}
              contentContainerStyle={{ padding: 20, paddingTop: 6 }}
              keyboardShouldPersistTaps="handled"
            >
              {/* repetir dados do último cadastro (opt-in, discreto, só cadastro novo) */}
              {!isEdit && canRepeat && (
                <TouchableOpacity style={styles.repeat} onPress={repeatLast} activeOpacity={0.7} accessibilityLabel="Repetir dados do último cadastro">
                  <Icon name="copy" size={14} color={P.ink2} />
                  <Text style={styles.repeatTxt}>Repetir dados do último cadastro</Text>
                  <Text style={styles.repeatHint}>dojô e endereço</Text>
                </TouchableOpacity>
              )}

              {/* completar (neutro) */}
              {empties.length > 0 && (
                <View style={styles.completar}>
                  <Icon name="edit" size={14} color={P.ink3} />
                  <Text style={styles.completarTtl}>Completar quando quiser:</Text>
                  <Text style={styles.completarList}>{empties.join("  ·  ")}</Text>
                </View>
              )}

              {/* ── Seção: Identidade (foto via photoSlot preserva ordem original: P6 antes do Nome) ── */}
              <DadosBasicosSection
                federationId={federationId}
                form={form}
                setField={set}
                lastDojoRef={lastDojoRef}
                dateBad={dateBad}
                age={age}
                cpfBad={cpfBad}
                nameRef={nameRef}
                birthRef={birthRef}
                cpfRef={cpfRef}
                rgRef={rgRef}
                onRgSubmit={() => phoneRef.current?.focus()}
                photoSlot={
                  <FotoSection
                    photoUrl={form.photo_url}
                    photoLoading={photoLoading}
                    onPickPhoto={handlePickPhoto}
                    onRemovePhoto={() => {
                      set("photo_url", "");
                      pendingPhotoFile.current = null;
                    }}
                  />
                }
              />

              {/* ── Seção: Contato & endereço ── */}
              <EnderecoSection
                form={form}
                setField={set}
                cepStatus={cepStatus}
                onCep={onCep}
                phoneRef={phoneRef}
                emailRef={emailRef}
                onEmailSubmit={handleSave}
              />

              {/* ── P7: Seção Responsável ── */}
              <ResponsavelSection
                form={form}
                setField={set}
                isMinor={isMinor}
                guardianCpfBad={guardianCpfBad}
                guardianNameRef={guardianNameRef}
                guardianCpfRef={guardianCpfRef}
                guardianPhoneRef={guardianPhoneRef}
              />

              {/* ── Seção: Funções + Status ── */}
              <PapeisSection form={form} setField={set} isEdit={isEdit} />

              {errorMsg ? (
                <View style={styles.errBox}>
                  <Icon name="alert_circle" size={15} color={P.red} />
                  <Text style={styles.errTxt}>{errorMsg}</Text>
                </View>
              ) : null}
            </ScrollView>
          )}

          {/* footer */}
          <View style={styles.footer}>
            <TouchableOpacity onPress={onClose} style={styles.btnGhost}>
              <Text style={styles.btnGhostTxt}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving || loading}
              style={[styles.btnPrimary, (saving || loading) && { opacity: 0.6 }]}
            >
              {saving
                ? <ActivityIndicator color="#fdf8f2" size="small" />
                : <Text style={styles.btnPrimaryTxt}>{isEdit ? "Salvar alterações" : "Salvar ficha"}</Text>
              }
            </TouchableOpacity>
          </View>

          {/* toast de sucesso (inline) */}
          {toast ? (
            <Animated.View pointerEvents="none" style={[styles.toast, {
              opacity: toastAnim,
              transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
            }]}>
              <Icon name="check" size={16} color="#bfe3c4" />
              <Text style={styles.toastTxt}>{toast}</Text>
            </Animated.View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

export default PraticanteFichaModal;
