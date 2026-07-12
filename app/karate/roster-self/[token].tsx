// ============================================================
// AURA KARATÊ — Auto-atendimento do PRÓPRIO praticante (G1, item 7)
// URL: /karate/roster-self/:token
//
// Backend: karateRosterSelfServicePublic.js — GET .../search?q=,
// POST .../update. Token SEPARADO do portal do sensei
// (self_service_token, migration 225): só aceita telefone/e-mail do
// PRÓPRIO praticante, nunca inativa/edita faixa, nunca lista o dojô
// inteiro. PÚBLICA — sem login. app/_layout.tsx reconhece
// segments[1]==="roster-self" como rota pública do karatê.
//
// Fluxo, mobile-first, sem jargão:
//   1. Digita o próprio nome → escolhe entre até 8 resultados.
//   2. Confirma identidade: data de nascimento OU nº de matrícula FPKT
//      (o backend aceita qualquer um dos dois — 2º fator, não é
//      autenticação forte, mas evita que um estranho mexa no contato
//      de um colega a partir do link compartilhado no grupo do dojô).
//   3. Preenche só telefone/e-mail. Confirma.
//   4. Tela de sucesso.
//
// Sem <Modal> em nenhum ponto — cada passo é uma TELA (estágio
// sequencial dentro da mesma página), nunca uma sobreposição.
// ============================================================
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TextInput, ActivityIndicator, Platform, Animated, Easing, Pressable, ScrollView,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Icon } from "@/components/Icon";
import { KarateColors as P, KarateRadius, KarateFonts, KarateShadows } from "@/constants/karateTheme";
import { karatePublicApi, SelfServiceSearchHit } from "@/services/karatePublicApi";

const IS_WEB = Platform.OS === "web";

type Step = "loading" | "invalid" | "search" | "identity" | "contact" | "success";

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
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
  const [birthDate, setBirthDate] = useState(""); // AAAA-MM-DD
  const [regNumber, setRegNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successName, setSuccessName] = useState("");

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
    setStep("contact");
  }

  const submitContact = useCallback(async () => {
    if (!selected) return;
    if (!phone.trim() && !email.trim()) {
      setFormError("Informe telefone e/ou e-mail.");
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      await karatePublicApi.selfServiceUpdate(tokenStr, {
        student_id: selected.id,
        birth_date: identityMode === "birth_date" ? birthDate.trim() : undefined,
        karate_registration_number: identityMode === "registration" ? regNumber.trim() : undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
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
  }, [selected, phone, email, identityMode, birthDate, regNumber, tokenStr]);

  if (!tokenStr || step === "invalid") {
    return (
      <View style={st.page}>
        <View style={st.center}>
          <View style={[st.glyph, { backgroundColor: P.dangerSoft }]}>
            <Icon name="alert-circle" size={26} color={P.danger} />
          </View>
          <Text style={st.title}>Link inválido ou expirado</Text>
          <Text style={st.text}>Peça um novo link ao seu sensei para atualizar seu contato.</Text>
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
          <Text style={st.title}>Contato atualizado!</Text>
          <Text style={st.text}>Valeu, {successName}. Seu telefone e/ou e-mail já chegaram ao seu dojô.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={st.page}>
      <ScrollView contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">
        <View style={st.header}>
          <Text style={st.eyebrow}>Aura Karatê</Text>
          <Text style={st.title}>Atualize seu contato</Text>
          <Text style={st.text}>Rapidinho: confirme quem você é e deixe telefone e/ou e-mail em dia.</Text>
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

        {step === "contact" && selected && (
          <View style={st.card}>
            <Text style={st.stepLabel}>3. Telefone e/ou e-mail</Text>
            <Text style={st.fieldLabel}>Telefone</Text>
            <View style={st.inputWrap}>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="(00) 00000-0000"
                placeholderTextColor={P.ink4}
                keyboardType="phone-pad"
                style={st.input}
                accessibilityLabel="Telefone"
                autoFocus
              />
            </View>
            <Text style={[st.fieldLabel, { marginTop: 12 }]}>E-mail</Text>
            <View style={st.inputWrap}>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="email@exemplo.com"
                placeholderTextColor={P.ink4}
                keyboardType="email-address"
                style={st.input}
                accessibilityLabel="E-mail"
              />
            </View>
            {!!formError && <Text style={st.errorText}>{formError}</Text>}
            <View style={st.actionsRow}>
              <Pressable onPress={() => setStep("identity")} disabled={submitting} accessibilityRole="button" accessibilityLabel="Voltar" style={st.secondaryBtn}>
                <Text style={st.secondaryBtnText}>Voltar</Text>
              </Pressable>
              <Pressable onPress={submitting ? undefined : submitContact} accessibilityRole="button" accessibilityLabel="Salvar" style={st.primaryBtn}>
                {submitting ? <ActivityIndicator color="#fdf8f2" size="small" /> : <Text style={st.primaryBtnText}>Salvar</Text>}
              </Pressable>
            </View>
          </View>
        )}

        <View style={st.footer}>
          <Text style={st.footerText}>Aura Karatê · atualização de contato</Text>
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
  stepLabel: { fontFamily: KarateFonts.heading, fontSize: 16, color: P.ink, marginBottom: 14 },
  fieldLabel: { fontSize: 11.5, fontWeight: "700", color: P.ink2, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 },

  inputWrap: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: P.border, borderRadius: KarateRadius.sm, backgroundColor: P.paperWarm, paddingHorizontal: 12 },
  input: { flex: 1, paddingVertical: 12, fontSize: 15, color: P.ink, ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}) },

  hint: { fontSize: 12, color: P.ink3, marginTop: 10, lineHeight: 17 },
  errorText: { fontSize: 12, color: P.danger, marginTop: 10 },

  resultRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, borderTopWidth: 1, borderTopColor: P.border, marginTop: 10 },
  resultName: { fontSize: 14, fontWeight: "600", color: P.ink },

  identityToggle: { flexDirection: "row", gap: 8, marginBottom: 12 },
  identityBtn: { flex: 1, borderWidth: 1, borderColor: P.border, borderRadius: KarateRadius.sm, paddingVertical: 10, alignItems: "center" },
  identityBtnActive: { backgroundColor: P.ink, borderColor: P.ink },
  identityBtnText: { fontSize: 12, fontWeight: "700", color: P.ink2 },
  identityBtnTextActive: { color: "#fdf8f2" },

  actionsRow: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 18 },
  secondaryBtn: { paddingVertical: 12, paddingHorizontal: 16 },
  secondaryBtnText: { fontSize: 13.5, fontWeight: "700", color: P.ink3 },
  primaryBtn: { backgroundColor: P.ink, borderRadius: KarateRadius.md, paddingVertical: 12, paddingHorizontal: 24, alignItems: "center", justifyContent: "center", minWidth: 110 },
  primaryBtnText: { fontSize: 14, fontWeight: "700", color: "#fdf8f2" },

  footer: { marginTop: 28, alignItems: "center" },
  footerText: { fontSize: 11, color: P.ink4 },
});
