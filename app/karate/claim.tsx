// ============================================================
// Claim da conta do dojô — Aura Karatê (F0 / Canal B)
//
// Rota PÚBLICA: /karate/claim?t=<token> (liberada no AuthGuard de
// app/_layout.tsx pelo marcador segments[1]==="claim"). O e-mail que a
// federação envia ao sensei aponta para
//   https://app.getaura.com.br/karate/claim?t={token}
//
// Fluxo: verify (valida o convite e mostra dojô + federação + e-mail
// mascarado) → form nome completo + senha (mín. 8) → complete → sucesso
// com botão "Ir para o login" (sem auto-login, por contrato do back #397).
//
// Erros com mensagens DISTINTAS: 404 inválido ≠ 409 já utilizado ≠ 410
// expirado. Padrão visual/estrutural: app/karate/[slug]/dojo/index.tsx.
// ============================================================
import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, SafeAreaView, ActivityIndicator, ScrollView,
  TextInput, TouchableOpacity, ViewStyle, TextStyle,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateFonts, KarateRadius } from "@/constants/karateTheme";
import { FpktLogo } from "@/components/karate/FpktLogo";
import { karateDojoClaimApi, ClaimVerifyResult, ClaimError } from "@/services/karateDojoClaimApi";

type Stage = "no-token" | "verifying" | "error" | "form" | "done";

function errorView(status: number | null): { icon: string; title: string; desc: string } {
  if (status === 410) {
    return {
      icon: "time-outline",
      title: "Convite expirado",
      desc: "Este convite passou do prazo de uso. Peça à federação um novo convite — ela consegue reenviar em instantes.",
    };
  }
  if (status === 409) {
    return {
      icon: "checkmark-circle-outline",
      title: "Convite já utilizado",
      desc: "A conta deste dojô já foi criada com este convite. Se foi você, entre com seu e-mail e senha. Se você não reconhece esse acesso, avise a federação.",
    };
  }
  return {
    icon: "link-outline",
    title: "Convite inválido",
    desc: "Não reconhecemos este link. Confira se o endereço foi copiado por inteiro do e-mail ou peça um novo convite à federação.",
  };
}

export default function DojoClaimScreen() {
  const { t } = useLocalSearchParams<{ t?: string }>();
  const router = useRouter();

  const [stage, setStage] = useState<Stage>(t ? "verifying" : "no-token");
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [invite, setInvite] = useState<ClaimVerifyResult | null>(null);

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!t) { setStage("no-token"); return; }
    let alive = true;
    setStage("verifying");
    karateDojoClaimApi.verify(t)
      .then((res) => { if (alive) { setInvite(res); setStage("form"); } })
      .catch((e: unknown) => {
        if (!alive) return;
        setErrorStatus(e instanceof ClaimError ? e.status : null);
        setStage("error");
      });
    return () => { alive = false; };
  }, [t]);

  async function handleSubmit() {
    if (submitting || !t) return;
    const nome = name.trim();
    if (nome.length < 3) { setFormError("Informe seu nome completo."); return; }
    if (password.length < 8) { setFormError("A senha precisa ter pelo menos 8 caracteres."); return; }
    if (password !== confirm) { setFormError("As senhas não conferem."); return; }
    setFormError(null);
    setSubmitting(true);
    try {
      await karateDojoClaimApi.complete(t, nome, password);
      setStage("done");
    } catch (e: unknown) {
      if (e instanceof ClaimError && (e.status === 409 || e.status === 410)) {
        // Convite morreu entre o verify e o complete — cai na tela de erro certa.
        setErrorStatus(e.status);
        setStage("error");
      } else {
        setFormError("Não foi possível criar a conta agora. Tente novamente em instantes.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const goLogin = () => router.replace("/(auth)/login" as any);
  const err = errorView(errorStatus);

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <FpktLogo size={56} />
          <Text style={styles.title}>Aura Karatê</Text>
          <Text style={styles.subtitle}>Ativação da conta do dojô</Text>
        </View>

        {stage === "verifying" ? (
          <View style={styles.card}>
            <ActivityIndicator color={KarateColors.primary} />
            <Text style={styles.cardText}>Validando seu convite…</Text>
          </View>
        ) : stage === "no-token" ? (
          <View style={styles.card}>
            <Icon name="link-outline" size={28} color={KarateColors.ink3} />
            <Text style={styles.cardTitle}>Link inválido</Text>
            <Text style={styles.cardText}>
              Esta página abre por um convite que a federação envia por e-mail ao
              sensei. O link deste acesso está incompleto — peça um novo convite
              à federação.
            </Text>
          </View>
        ) : stage === "error" ? (
          <View style={styles.card}>
            <Icon name={err.icon} size={28} color={KarateColors.primary} />
            <Text style={styles.cardTitle}>{err.title}</Text>
            <Text style={styles.cardText}>{err.desc}</Text>
            {errorStatus === 409 ? (
              <TouchableOpacity style={styles.primaryBtn} onPress={goLogin} accessibilityRole="button" accessibilityLabel="Ir para o login">
                <Text style={styles.primaryBtnTxt}>Ir para o login</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : stage === "done" ? (
          <View style={styles.card}>
            <Icon name="checkmark-circle-outline" size={30} color={KarateColors.ok} />
            <Text style={styles.cardTitle}>Conta criada</Text>
            <Text style={styles.cardText}>
              A conta do dojô{invite ? ` ${invite.dojoName}` : ""} foi criada com
              sucesso. Entre com o e-mail do convite e a senha que você acabou de
              definir.
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={goLogin} accessibilityRole="button" accessibilityLabel="Ir para o login">
              <Text style={styles.primaryBtnTxt}>Ir para o login</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Assumir conta do dojô</Text>
            {invite ? (
              <View style={styles.inviteBox}>
                <Text style={styles.inviteDojo}>{invite.dojoName}</Text>
                <Text style={styles.inviteMeta}>{invite.federationName}</Text>
                <Text style={styles.inviteMeta}>Convite enviado para {invite.email}</Text>
              </View>
            ) : null}
            <Text style={styles.cardText}>
              Defina seu nome e uma senha para ativar o acesso do dojô ao Aura Karatê.
            </Text>

            <View style={styles.field}>
              <Text style={styles.label}>Nome completo</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Seu nome completo"
                placeholderTextColor={KarateColors.ink4}
                autoCapitalize="words"
                autoComplete="name"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Senha</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Mínimo de 8 caracteres"
                placeholderTextColor={KarateColors.ink4}
                secureTextEntry
                autoComplete="new-password"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Confirmar senha</Text>
              <TextInput
                style={styles.input}
                value={confirm}
                onChangeText={setConfirm}
                placeholder="Repita a senha"
                placeholderTextColor={KarateColors.ink4}
                secureTextEntry
                autoComplete="new-password"
                onSubmitEditing={handleSubmit}
              />
            </View>

            {formError ? <Text style={styles.formError}>{formError}</Text> : null}

            <TouchableOpacity
              style={[styles.primaryBtn, submitting && styles.primaryBtnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="Assumir conta do dojô"
            >
              {submitting
                ? <ActivityIndicator color={KarateColors.paperWarm} size="small" />
                : <Text style={styles.primaryBtnTxt}>Assumir conta do dojô</Text>}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content: { padding: 24, gap: 24, alignItems: "center" } as ViewStyle,
  header: { alignItems: "center", gap: 8, paddingVertical: 24 } as ViewStyle,
  title: { fontFamily: KarateFonts.heading, fontSize: 26, fontWeight: "400", color: KarateColors.ink } as TextStyle,
  subtitle: { fontSize: 13, color: KarateColors.ink3, textAlign: "center" } as TextStyle,
  card: {
    width: "100%", maxWidth: 420, backgroundColor: KarateColors.glass,
    borderRadius: 16, borderWidth: 1, borderColor: KarateColors.border,
    padding: 24, gap: 12, alignItems: "center",
  } as ViewStyle,
  cardTitle: { fontFamily: KarateFonts.heading, fontSize: 19, fontWeight: "400", color: KarateColors.ink, textAlign: "center" } as TextStyle,
  cardText: { fontSize: 14, color: KarateColors.ink2, textAlign: "center", lineHeight: 20 } as TextStyle,
  inviteBox: {
    width: "100%", backgroundColor: KarateColors.glass2, borderRadius: KarateRadius.md,
    borderWidth: 1, borderColor: KarateColors.border, padding: 14, gap: 3, alignItems: "center",
  } as ViewStyle,
  inviteDojo: { fontFamily: KarateFonts.heading, fontSize: 17, color: KarateColors.ink, textAlign: "center" } as TextStyle,
  inviteMeta: { fontSize: 13, color: KarateColors.ink3, textAlign: "center" } as TextStyle,
  field: { width: "100%", gap: 6 } as ViewStyle,
  label: { fontSize: 12, fontWeight: "700", color: KarateColors.ink2, textTransform: "uppercase", letterSpacing: 0.4 } as TextStyle,
  input: {
    width: "100%", borderWidth: 1, borderColor: KarateColors.border2, borderRadius: KarateRadius.md,
    backgroundColor: KarateColors.paperWarm, paddingVertical: 10, paddingHorizontal: 12,
    fontSize: 15, color: KarateColors.ink,
  } as TextStyle,
  formError: { fontSize: 13, color: KarateColors.danger, textAlign: "center" } as TextStyle,
  primaryBtn: {
    marginTop: 4, minHeight: 44, borderRadius: KarateRadius.md, backgroundColor: KarateColors.sumi,
    alignItems: "center", justifyContent: "center", paddingVertical: 12, paddingHorizontal: 20, alignSelf: "stretch",
  } as ViewStyle,
  primaryBtnDisabled: { opacity: 0.6 } as ViewStyle,
  primaryBtnTxt: { fontSize: 15, fontWeight: "700", color: KarateColors.paperWarm } as TextStyle,
});
