// ============================================================
// AURA KARATÊ — Auto-atendimento do PRÓPRIO praticante (G1, item 7)
// URL: /karate/roster-self/:token
//
// Backend: karateRosterSelfServicePublic.js — GET .../search?q=,
// POST .../record, POST .../update. Token SEPARADO do portal do sensei
// (self_service_token, migration 225): nunca inativa/edita faixa, nunca
// lista o dojô inteiro. PÚBLICA — sem login. app/_layout.tsx reconhece
// segments[1]==="roster-self" como rota pública do karatê.
//
// (16/07/2026 — decisão do Caio: abrir a FICHA INTEIRA aqui, não só
// contato. Antes este fluxo só pedia telefone/e-mail — agora espelha os
// mesmos campos do portal do sensei (FullRecordPanel em
// app/karate/roster-update/[token].tsx / PORTAL_EDITABLE_FIELDS no
// backend). O gate de identidade (2º fator) é o que sustenta abrir mais
// campos: só quem sabe o nascimento OU a matrícula FPKT do praticante
// grava algo.
//
// (16/07/2026, complemento — o buraco: a ficha abria em branco, então o
// aluno digitava no escuro em vez de REVISAR o cadastro (intenção
// declarada da feature: "o dojô e o praticante revise tudo"). Agora, após
// confirmar identidade, POST .../record busca a ficha e PRÉ-PREENCHE o
// formulário. `originalFields` guarda o snapshot como veio do backend —
// no submit, cada campo é comparado (normalizado) contra esse snapshot e
// só o que MUDOU entra em `fields` no POST .../update. Campo intocado
// nunca é reenviado, então nunca corre risco de ser reescrito à toa por
// uma diferença de formatação (máscara vs. dígito cru, maiúsculo vs.
// minúsculo etc.) — normalizeForCompare() replica a normalização que o
// backend já faz em cada campo antes de comparar.
//
// Fluxo, mobile-first, sem jargão:
//   1. Digita o próprio nome → escolhe entre até 8 resultados.
//   2. Confirma identidade: data de nascimento OU nº de matrícula FPKT
//      (2º fator — evita que um estranho com o link mexa na ficha de
//      um colega).
//   3. Ficha carrega PRÉ-PREENCHIDA (POST .../record) — o aluno REVISA o
//      que já está cadastrado e corrige o que estiver errado. Nome, nº
//      FPKT e faixa aparecem como leitura (geridos pela federação).
//   4. Salva — só os campos que de fato mudaram vão no POST .../update.
//   5. Tela de sucesso.
//
// Sem <Modal> em nenhum ponto — cada passo é uma TELA (estágio
// sequencial dentro da mesma página), nunca uma sobreposição.
//
// ⚠️ Data pura, nunca `new Date("YYYY-MM-DD")` (desloca um dia no fuso
// BR — já mordeu 2x). DateInput (components/inputs/DateInput.tsx) já
// resolve isso com regex puro (parseBrDate/formatIsoToBr).
//
// ⚠️ Corrida: cada confirmação de identidade dispara um fetch de ficha.
// `requestSeqRef` guarda um contador incrementado a cada tentativa — a
// resposta só é aplicada ao estado se ainda for a tentativa mais recente,
// senão é descartada (evita que uma resposta antiga sobrescreva um novo
// carregamento em andamento).
// ============================================================
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TextInput, ActivityIndicator, Platform, Pressable, ScrollView,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Icon } from "@/components/Icon";
import { KarateColors as P, KarateRadius, KarateFonts, KarateShadows } from "@/constants/karateTheme";
import {
  karatePublicApi, SelfServiceSearchHit, SelfServiceFields, SelfServiceLocked, SelfServiceRecordResult,
} from "@/services/karatePublicApi";
import { DateInput, parseBrDate, formatIsoToBr } from "@/components/inputs/DateInput";
import { maskCpf, maskPhone } from "@/utils/masks";

const IS_WEB = Platform.OS === "web";

type Step = "loading" | "invalid" | "search" | "identity" | "loadingRecord" | "fields" | "success";

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// Mesma máscara de CEP do portal do sensei (maskCEPLocal em
// app/karate/roster-update/[token].tsx) — 00000-000.
function maskCep(v: string): string {
  const d = (v || "").replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? d.replace(/(\d{5})(\d+)/, "$1-$2") : d;
}

type FieldKey = keyof SelfServiceFields;

const TEXT_FIELDS: FieldKey[] = ["street", "number", "complement", "neighborhood", "city"];

interface FormState {
  phone: string;
  email: string;
  cpf: string;
  rg: string;
  birth_date: string; // dd/mm/aaaa (máscara do DateInput)
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
}

const EMPTY_FORM: FormState = {
  phone: "", email: "", cpf: "", rg: "", birth_date: "",
  street: "", number: "", complement: "", neighborhood: "", city: "", state: "", zip_code: "",
};

// Ficha vinda de POST .../record (string | null por campo) → FormState de
// tela (string, máscara de exibição). Campo ausente no banco vira "" —
// nunca reaparece "null" na tela.
function recordToFormState(fields: SelfServiceRecordResult["fields"]): FormState {
  return {
    phone: fields.phone ? maskPhone(fields.phone) : "",
    email: fields.email || "",
    cpf: fields.cpf ? maskCpf(fields.cpf) : "",
    rg: fields.rg || "",
    birth_date: fields.birth_date ? formatIsoToBr(fields.birth_date) : "",
    street: fields.street || "",
    number: fields.number || "",
    complement: fields.complement || "",
    neighborhood: fields.neighborhood || "",
    city: fields.city || "",
    state: fields.state || "",
    zip_code: fields.zip_code ? maskCep(fields.zip_code) : "",
  };
}

// Normaliza um valor de campo pra COMPARAÇÃO (não pro payload) — replica a
// mesma normalização que o backend aplica em normalizeFieldValue()
// (karateRosterSelfServicePublic.js), pra que diferença de MÁSCARA (ex.:
// "(11) 99999-0000" vs "11999990000") nunca seja interpretada como
// mudança real. Retorna null quando o campo está vazio (mesma semântica
// do backend: string vazia = campo limpo = null).
function normalizeForCompare(key: FieldKey, raw: string): string | null {
  const s = (raw || "").trim();
  if (!s) return null;
  switch (key) {
    case "phone":
    case "cpf":
    case "zip_code":
      return s.replace(/\D/g, "");
    case "email":
      return s.toLowerCase();
    case "rg":
      return s.replace(/[.\-\s/]/g, "").toUpperCase();
    case "state":
      return s.toUpperCase();
    default:
      return s;
  }
}

export default function RosterSelfServiceScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const tokenStr = Array.isArray(token) ? token[0] : token || "";

  const [step, setStep] = useState<Step>("search");
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounced(query, 350);
  const [results, setResults] = useState<SelfServiceSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [selected, setSelected] = useState<SelfServiceSearchHit | null>(null);
  const [identityMode, setIdentityMode] = useState<"birth_date" | "registration">("birth_date");
  const [birthDate, setBirthDate] = useState(""); // AAAA-MM-DD (prova de identidade)
  const [regNumber, setRegNumber] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  // Snapshot da ficha como veio do backend (POST .../record) — fonte de
  // verdade pro diff no submit. null até a leitura terminar.
  const [originalFields, setOriginalFields] = useState<SelfServiceRecordResult["fields"] | null>(null);
  const [locked, setLocked] = useState<SelfServiceLocked | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successName, setSuccessName] = useState("");

  // Contador de tentativas de leitura da ficha — protege contra corrida
  // (usuário volta e confirma de novo antes da 1ª resposta chegar).
  const requestSeqRef = useRef(0);

  useEffect(() => {
    if (!tokenStr) return;
    const q = debouncedQuery.trim();
    if (q.length < 2) { setResults([]); setSearchError(null); return; }
    setSearching(true);
    setSearchError(null);
    karatePublicApi.selfServiceSearch(tokenStr, q)
      .then((res) => setResults(res.data || []))
      .catch((e: any) => {
        if (e?.status === 410) { setStep("invalid"); return; }
        setSearchError("Não foi possível buscar agora. Tente de novo em instantes.");
      })
      .finally(() => setSearching(false));
  }, [debouncedQuery, tokenStr]);

  function pickPractitioner(hit: SelfServiceSearchHit) {
    setSelected(hit);
    setStep("identity");
  }

  // Busca a ficha (POST .../record) usando a MESMA identidade que o aluno
  // acabou de confirmar, e pré-preenche o formulário com o que já está
  // cadastrado — o ponto inteiro da feature é REVISAR, não digitar no
  // escuro.
  const fetchRecord = useCallback(async () => {
    if (!selected) return;
    setFormError(null);
    setStep("loadingRecord");
    const myReq = ++requestSeqRef.current;
    try {
      const res = await karatePublicApi.selfServiceRecord(tokenStr, {
        student_id: selected.id,
        identity: {
          birth_date: identityMode === "birth_date" ? birthDate.trim() : undefined,
          karate_registration_number: identityMode === "registration" ? regNumber.trim() : undefined,
        },
      });
      if (myReq !== requestSeqRef.current) return; // resposta obsoleta — descartada
      setLocked(res.locked);
      setOriginalFields(res.fields);
      setForm(recordToFormState(res.fields));
      setStep("fields");
    } catch (e: any) {
      if (myReq !== requestSeqRef.current) return; // resposta obsoleta — descartada
      if (e?.code === "IDENTITY_MISMATCH") {
        setFormError("Não conseguimos confirmar sua identidade com esses dados. Confira e tente de novo.");
        setStep("identity");
      } else if (e?.status === 410) {
        setStep("invalid");
      } else {
        setFormError(e?.message || "Não foi possível carregar sua ficha agora. Tente de novo.");
        setStep("identity");
      }
    }
  }, [selected, tokenStr, identityMode, birthDate, regNumber]);

  function confirmIdentity() {
    setFormError(null);
    if (identityMode === "birth_date" && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate.trim())) {
      setFormError("Informe a data de nascimento no formato AAAA-MM-DD.");
      return;
    }
    if (identityMode === "registration" && !regNumber.trim()) {
      setFormError("Informe o número de matrícula FPKT.");
      return;
    }
    fetchRecord();
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const submitFields = useCallback(async () => {
    if (!selected) return;
    setFormError(null);

    // Valida a data (se preenchida) antes de qualquer diff — precisa estar
    // completa/válida mesmo que não tenha mudado.
    let birthDateIso: string | null = null;
    if (form.birth_date.trim()) {
      const iso = parseBrDate(form.birth_date.trim());
      if (!iso) {
        setFormError("Data de nascimento inválida. Use o formato dd/mm/aaaa.");
        return;
      }
      birthDateIso = iso;
    }

    // Diff: só entra em `fields` o que MUDOU em relação ao snapshot
    // carregado (originalFields) — nunca o formulário inteiro, pra um
    // campo intocado não correr risco de ser reescrito à toa.
    const fields: SelfServiceFields = {};
    for (const key of TEXT_FIELDS.concat(["phone", "email", "cpf", "rg", "state", "zip_code"] as FieldKey[])) {
      const currentNorm = normalizeForCompare(key, form[key] || "");
      const originalNorm = normalizeForCompare(key, (originalFields?.[key] as string) || "");
      if (currentNorm !== originalNorm) {
        (fields as any)[key] = form[key].trim();
      }
    }
    const originalBirthIso = originalFields?.birth_date || null;
    if (birthDateIso !== originalBirthIso) {
      fields.birth_date = birthDateIso === null ? "" : birthDateIso;
    }

    if (!Object.keys(fields).length) {
      setFormError("Nada mudou desde que sua ficha foi carregada — não há o que salvar.");
      return;
    }

    setSubmitting(true);
    try {
      await karatePublicApi.selfServiceUpdate(tokenStr, {
        student_id: selected.id,
        identity: {
          birth_date: identityMode === "birth_date" ? birthDate.trim() : undefined,
          karate_registration_number: identityMode === "registration" ? regNumber.trim() : undefined,
        },
        fields,
      });
      setSuccessName(selected.name);
      setStep("success");
    } catch (e: any) {
      if (e?.code === "IDENTITY_MISMATCH") {
        setFormError("Não conseguimos confirmar sua identidade com esses dados. Confira e tente de novo.");
        setStep("identity");
      } else if (e?.status === 410) {
        setStep("invalid");
      } else {
        setFormError(e?.message || "Não foi possível salvar. Tente de novo.");
      }
    } finally {
      setSubmitting(false);
    }
  }, [selected, form, identityMode, birthDate, regNumber, tokenStr, originalFields]);

  if (!tokenStr || step === "invalid") {
    return (
      <View style={st.page}>
        <View style={st.center}>
          <View style={[st.glyph, { backgroundColor: P.dangerSoft }]}>
            <Icon name="alert-circle" size={26} color={P.danger} />
          </View>
          <Text style={st.title}>Link inválido ou expirado</Text>
          <Text style={st.text}>Peça um novo link ao seu sensei para atualizar sua ficha.</Text>
        </View>
      </View>
    );
  }

  if (step === "success") {
    return (
      <View style={st.page}>
        <View style={st.center}>
          <View style={[st.glyph, { backgroundColor: P.okSoft }]}>
            <Icon name="checkmark-circle" size={26} color={P.ok} />
          </View>
          <Text style={st.title}>Ficha atualizada!</Text>
          <Text style={st.text}>Valeu, {successName}. Seus dados já chegaram ao seu dojô.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={st.page}>
      <ScrollView contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">
        <View style={st.header}>
          <Text style={st.eyebrow}>Aura Karatê</Text>
          <Text style={st.title}>Atualize sua ficha</Text>
          <Text style={st.text}>Rapidinho: confirme quem você é, revise seus dados e corrija o que estiver errado.</Text>
        </View>

        {step === "search" && (
          <View style={st.card}>
            <Text style={st.stepLabel}>1. Qual é o seu nome?</Text>
            <View style={st.inputWrap}>
              <Icon name="search" size={16} color={P.ink3} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Digite pelo menos 2 letras do seu nome"
                placeholderTextColor={P.ink4}
                style={st.input}
                accessibilityLabel="Seu nome"
                autoFocus
              />
            </View>
            {searching && <ActivityIndicator size="small" color={P.ink3} style={{ marginTop: 10 }} />}
            {!!searchError && <Text style={st.errorText}>{searchError}</Text>}
            {!searching && query.trim().length >= 2 && results.length === 0 && !searchError && (
              <Text style={st.hint}>Não encontramos ninguém com esse nome. Confira a grafia ou fale com seu sensei.</Text>
            )}
            {results.map((hit) => (
              <Pressable key={hit.id} onPress={() => pickPractitioner(hit)} accessibilityRole="button" accessibilityLabel={`Sou ${hit.name}`} style={st.resultRow}>
                <Text style={st.resultName}>{hit.name}</Text>
                <Icon name="chevron-forward" size={16} color={P.ink3} />
              </Pressable>
            ))}
          </View>
        )}

        {step === "identity" && selected && (
          <View style={st.card}>
            <Text style={st.stepLabel}>2. Confirme que é você, {selected.name.split(" ")[0]}</Text>
            <View style={st.identityToggle}>
              <Pressable
                onPress={() => setIdentityMode("birth_date")}
                style={[st.identityBtn, identityMode === "birth_date" && st.identityBtnActive]}
                accessibilityRole="button"
                accessibilityLabel="Confirmar com data de nascimento"
              >
                <Text style={[st.identityBtnText, identityMode === "birth_date" && st.identityBtnTextActive]}>Data de nascimento</Text>
              </Pressable>
              <Pressable
                onPress={() => setIdentityMode("registration")}
                style={[st.identityBtn, identityMode === "registration" && st.identityBtnActive]}
                accessibilityRole="button"
                accessibilityLabel="Confirmar com número de matrícula"
              >
                <Text style={[st.identityBtnText, identityMode === "registration" && st.identityBtnTextActive]}>Nº de matrícula FPKT</Text>
              </Pressable>
            </View>
            {identityMode === "birth_date" ? (
              <View style={st.inputWrap}>
                <TextInput
                  value={birthDate}
                  onChangeText={setBirthDate}
                  placeholder="AAAA-MM-DD (ex: 2010-05-20)"
                  placeholderTextColor={P.ink4}
                  style={st.input}
                  accessibilityLabel="Data de nascimento"
                  autoFocus
                />
              </View>
            ) : (
              <View style={st.inputWrap}>
                <TextInput
                  value={regNumber}
                  onChangeText={setRegNumber}
                  placeholder="Número de matrícula FPKT"
                  placeholderTextColor={P.ink4}
                  style={st.input}
                  accessibilityLabel="Número de matrícula FPKT"
                  autoFocus
                />
              </View>
            )}
            <Text style={st.hint}>
              Sua data de nascimento está errada no cadastro? Confirme aqui pela matrícula FPKT e corrija ela no próximo passo.
            </Text>
            {!!formError && <Text style={st.errorText}>{formError}</Text>}
            <View style={st.actionsRow}>
              <Pressable onPress={() => { setSelected(null); setStep("search"); }} accessibilityRole="button" accessibilityLabel="Voltar" style={st.secondaryBtn}>
                <Text style={st.secondaryBtnText}>Voltar</Text>
              </Pressable>
              <Pressable onPress={confirmIdentity} accessibilityRole="button" accessibilityLabel="Continuar" style={st.primaryBtn}>
                <Text style={st.primaryBtnText}>Continuar</Text>
              </Pressable>
            </View>
          </View>
        )}

        {step === "loadingRecord" && (
          <View style={st.card}>
            <View style={{ alignItems: "center", paddingVertical: 8 }}>
              <ActivityIndicator size="small" color={P.ink3} />
              <Text style={[st.hint, { marginTop: 10, textAlign: "center" }]}>Carregando sua ficha...</Text>
            </View>
          </View>
        )}

        {step === "fields" && selected && (
          <View style={st.card}>
            <Text style={st.stepLabel}>3. Sua ficha</Text>
            <Text style={st.hint}>Revise o que já está cadastrado e corrija o que estiver errado. Só o que você mudar é salvo.</Text>

            <View style={st.readonlyRow}>
              <Icon name="lock-closed" size={13} color={P.ink3} />
              <Text style={st.readonlyRowText}>
                Nome: {locked?.name || selected.name}
                {"\n"}Matrícula FPKT: {locked?.karate_registration_number || "não informada"}
                {"\n"}Faixa: {locked?.belt_name || "não informada"}
                {"\n"}Esses dados são geridos pela federação — não dá pra editar por aqui.
              </Text>
            </View>

            <Text style={st.sectionLabel}>Contato</Text>
            <Text style={st.fieldLabel}>Telefone</Text>
            <View style={st.inputWrap}>
              <TextInput
                value={form.phone}
                onChangeText={(t) => setField("phone", maskPhone(t))}
                placeholder="(00) 00000-0000"
                placeholderTextColor={P.ink4}
                keyboardType="phone-pad"
                style={st.input}
                accessibilityLabel="Telefone"
              />
            </View>
            <Text style={[st.fieldLabel, { marginTop: 12 }]}>E-mail</Text>
            <View style={st.inputWrap}>
              <TextInput
                value={form.email}
                onChangeText={(t) => setField("email", t)}
                placeholder="email@exemplo.com"
                placeholderTextColor={P.ink4}
                keyboardType="email-address"
                autoCapitalize="none"
                style={st.input}
                accessibilityLabel="E-mail"
              />
            </View>

            <Text style={st.sectionLabel}>Documentos</Text>
            <Text style={st.fieldLabel}>Data de nascimento (só se estiver errada)</Text>
            <DateInput
              value={form.birth_date}
              onChangeText={(t) => setField("birth_date", t)}
              placeholder="dd/mm/aaaa"
              style={st.dateInput}
            />
            <Text style={[st.fieldLabel, { marginTop: 12 }]}>CPF</Text>
            <View style={st.inputWrap}>
              <TextInput
                value={form.cpf}
                onChangeText={(t) => setField("cpf", maskCpf(t))}
                placeholder="000.000.000-00"
                placeholderTextColor={P.ink4}
                keyboardType="numeric"
                style={st.input}
                accessibilityLabel="CPF"
              />
            </View>
            <Text style={[st.fieldLabel, { marginTop: 12 }]}>RG</Text>
            <View style={st.inputWrap}>
              <TextInput
                value={form.rg}
                onChangeText={(t) => setField("rg", t)}
                placeholder="Seu RG"
                placeholderTextColor={P.ink4}
                style={st.input}
                accessibilityLabel="RG"
              />
            </View>

            <Text style={st.sectionLabel}>Endereço</Text>
            <Text style={st.fieldLabel}>CEP</Text>
            <View style={st.inputWrap}>
              <TextInput
                value={form.zip_code}
                onChangeText={(t) => setField("zip_code", maskCep(t))}
                placeholder="00000-000"
                placeholderTextColor={P.ink4}
                keyboardType="numeric"
                style={st.input}
                accessibilityLabel="CEP"
              />
            </View>
            <Text style={[st.fieldLabel, { marginTop: 12 }]}>Rua</Text>
            <View style={st.inputWrap}>
              <TextInput value={form.street} onChangeText={(t) => setField("street", t)} placeholder="Rua" placeholderTextColor={P.ink4} style={st.input} accessibilityLabel="Rua" />
            </View>
            <View style={st.addressRow}>
              <View style={[st.inputWrap, st.addressRowItem]}>
                <TextInput value={form.number} onChangeText={(t) => setField("number", t)} placeholder="Número" placeholderTextColor={P.ink4} keyboardType="numeric" style={st.input} accessibilityLabel="Número" />
              </View>
              <View style={[st.inputWrap, st.addressRowItem]}>
                <TextInput value={form.complement} onChangeText={(t) => setField("complement", t)} placeholder="Complemento" placeholderTextColor={P.ink4} style={st.input} accessibilityLabel="Complemento" />
              </View>
            </View>
            <Text style={[st.fieldLabel, { marginTop: 12 }]}>Bairro</Text>
            <View style={st.inputWrap}>
              <TextInput value={form.neighborhood} onChangeText={(t) => setField("neighborhood", t)} placeholder="Bairro" placeholderTextColor={P.ink4} style={st.input} accessibilityLabel="Bairro" />
            </View>
            <View style={st.addressRow}>
              <View style={[st.inputWrap, st.addressRowItem, { flex: 2 }]}>
                <TextInput value={form.city} onChangeText={(t) => setField("city", t)} placeholder="Cidade" placeholderTextColor={P.ink4} style={st.input} accessibilityLabel="Cidade" />
              </View>
              <View style={[st.inputWrap, st.addressRowItem, { flex: 1 }]}>
                <TextInput value={form.state} onChangeText={(t) => setField("state", t.toUpperCase().slice(0, 2))} placeholder="UF" placeholderTextColor={P.ink4} autoCapitalize="characters" maxLength={2} style={st.input} accessibilityLabel="UF" />
              </View>
            </View>

            {!!formError && <Text style={st.errorText}>{formError}</Text>}
            <View style={st.actionsRow}>
              <Pressable onPress={() => setStep("identity")} disabled={submitting} accessibilityRole="button" accessibilityLabel="Voltar" style={st.secondaryBtn}>
                <Text style={st.secondaryBtnText}>Voltar</Text>
              </Pressable>
              <Pressable onPress={submitting ? undefined : submitFields} accessibilityRole="button" accessibilityLabel="Salvar" style={st.primaryBtn}>
                {submitting ? <ActivityIndicator color="#fdf8f2" size="small" /> : <Text style={st.primaryBtnText}>Salvar</Text>}
              </Pressable>
            </View>
          </View>
        )}

        <View style={st.footer}>
          <Text style={st.footerText}>Aura Karatê · atualização cadastral</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  page: { flex: 1, backgroundColor: P.bg },
  content: { padding: 20, paddingTop: 40, paddingBottom: 56, maxWidth: 460, alignSelf: "center", width: "100%" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 24, maxWidth: 400, alignSelf: "center" },
  glyph: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },

  header: { alignItems: "center", marginBottom: 22 },
  eyebrow: { fontSize: 11, color: P.primary, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
  title: { fontFamily: KarateFonts.heading, fontSize: 22, color: P.ink, marginTop: 8, textAlign: "center" },
  text: { fontSize: 13, color: P.ink3, marginTop: 8, textAlign: "center", lineHeight: 19 },

  card: { backgroundColor: P.glass, borderRadius: KarateRadius.lg, borderWidth: 1, borderColor: P.border, padding: 18, ...KarateShadows.sm },
  stepLabel: { fontFamily: KarateFonts.heading, fontSize: 16, color: P.ink, marginBottom: 6 },
  sectionLabel: { fontSize: 11.5, fontWeight: "700", color: P.primary, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 18, marginBottom: 8 },
  fieldLabel: { fontSize: 11.5, fontWeight: "700", color: P.ink2, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 },

  inputWrap: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: P.border, borderRadius: KarateRadius.sm, backgroundColor: P.paperWarm, paddingHorizontal: 12 },
  input: { flex: 1, paddingVertical: 12, fontSize: 15, color: P.ink, ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}) },
  dateInput: { borderWidth: 1, borderColor: P.border, borderRadius: KarateRadius.sm, backgroundColor: P.paperWarm, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, color: P.ink },

  addressRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  addressRowItem: { flex: 1 },

  hint: { fontSize: 12, color: P.ink3, marginTop: 10, lineHeight: 17 },
  errorText: { fontSize: 12, color: P.danger, marginTop: 10 },

  resultRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, borderTopWidth: 1, borderTopColor: P.border, marginTop: 10 },
  resultName: { fontSize: 14, fontWeight: "600", color: P.ink },

  identityToggle: { flexDirection: "row", gap: 8, marginBottom: 12, marginTop: 12 },
  identityBtn: { flex: 1, borderWidth: 1, borderColor: P.border, borderRadius: KarateRadius.sm, paddingVertical: 10, alignItems: "center" },
  identityBtnActive: { backgroundColor: P.ink, borderColor: P.ink },
  identityBtnText: { fontSize: 12, fontWeight: "700", color: P.ink2 },
  identityBtnTextActive: { color: "#fdf8f2" },

  readonlyRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, backgroundColor: P.paperWarm, borderRadius: KarateRadius.sm, paddingVertical: 8, paddingHorizontal: 10, marginTop: 12 },
  readonlyRowText: { fontSize: 11.5, color: P.ink3, flex: 1, lineHeight: 17 },

  actionsRow: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 18 },
  secondaryBtn: { paddingVertical: 12, paddingHorizontal: 16 },
  secondaryBtnText: { fontSize: 13.5, fontWeight: "700", color: P.ink3 },
  primaryBtn: { backgroundColor: P.ink, borderRadius: KarateRadius.md, paddingVertical: 12, paddingHorizontal: 24, alignItems: "center", justifyContent: "center", minWidth: 110 },
  primaryBtnText: { fontSize: 14, fontWeight: "700", color: "#fdf8f2" },

  footer: { marginTop: 28, alignItems: "center" },
  footerText: { fontSize: 11, color: P.ink4 },
});
