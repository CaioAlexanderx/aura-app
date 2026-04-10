import { useState, useEffect } from "react";
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  TextInput, ActivityIndicator, Linking, Platform,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { inviteApi, authApi, type InviteDetails } from "@/services/api";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";

// ── Tela de aceite de convite ────────────────────────────────
// Rota: /invite/[token]
// Acessada via link compartilhado pelo titular da empresa
export default function InvitePage() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { user, token: authToken, setAuth } = useAuthStore();

  const [invite,    setInvite]    = useState<InviteDetails | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [accepted,  setAccepted]  = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  // Formulario de login inline
  const [showLogin,    setShowLogin]    = useState(false);
  const [loginEmail,   setLoginEmail]   = useState("");
  const [loginPass,    setLoginPass]    = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Busca os dados do convite assim que a pagina abre
  useEffect(() => {
    if (!token) { setPageError("Link invalido"); setLoading(false); return; }
    inviteApi.validate(token as string)
      .then(data => {
        setInvite(data);
        // Pre-preenche o email se o usuario nao estiver logado
        if (!authToken) setLoginEmail(data.email);
      })
      .catch(err => setPageError(err?.message || "Convite invalido ou expirado"))
      .finally(() => setLoading(false));
  }, [token]);

  // Aceita o convite
  async function handleAccept() {
    if (!token || !authToken) return;
    setAccepting(true);
    try {
      await inviteApi.accept(token as string);
      setAccepted(true);
      toast.success("Bem-vindo a equipe!");
      // Redireciona ao dashboard apos 2s
      setTimeout(() => router.replace("/(tabs)/"), 2200);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao aceitar convite");
    } finally { setAccepting(false); }
  }

  // Login inline para aceitar sem sair da pagina
  async function handleLogin() {
    if (!loginEmail || !loginPass) { toast.error("Preencha email e senha"); return; }
    setLoginLoading(true);
    try {
      const res = await authApi.login(loginEmail.trim().toLowerCase(), loginPass);
      setAuth(res.token, res.user, res.company, (res as any).refresh_token);
      toast.success("Login realizado!");
      setShowLogin(false);
    } catch (err: any) {
      toast.error(err?.message || "Email ou senha incorretos");
    } finally { setLoginLoading(false); }
  }

  const isLoggedIn   = !!user && !!authToken;
  const emailMatch   = isLoggedIn && invite && user.email === invite.email;
  const wrongEmail   = isLoggedIn && invite && user.email !== invite.email;

  // ── Loading ──────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[s.center, { flex: 1 }]}>
        <ActivityIndicator color={Colors.violet3} size="large" />
        <Text style={s.loadingText}>Verificando convite...</Text>
      </View>
    );
  }

  // ── Erro na validacao do token ───────────────────────────
  if (pageError) {
    return (
      <View style={[s.center, { flex: 1, padding: 32 }]}>
        <View style={s.errorIcon}>
          <Icon name="alert" size={28} color={Colors.red} />
        </View>
        <Text style={s.errorTitle}>Convite invalido</Text>
        <Text style={s.errorSub}>{pageError}</Text>
        <Pressable onPress={() => router.replace("/(auth)/login")} style={s.primaryBtn}>
          <Text style={s.primaryBtnText}>Ir para o app</Text>
        </Pressable>
      </View>
    );
  }

  // ── Aceito com sucesso ───────────────────────────────────
  if (accepted) {
    return (
      <View style={[s.center, { flex: 1, padding: 32 }]}>
        <View style={s.successIcon}>
          <Icon name="check" size={28} color={Colors.green} />
        </View>
        <Text style={s.successTitle}>Convite aceito!</Text>
        <Text style={s.successSub}>Redirecionando para o painel...</Text>
        <ActivityIndicator color={Colors.violet3} style={{ marginTop: 20 }} />
      </View>
    );
  }

  // ── Pagina principal ─────────────────────────────────────
  return (
    <ScrollView contentContainerStyle={s.page}>

      {/* Logo Aura */}
      <View style={s.logoWrap}>
        <Text style={s.logoText}>aura.</Text>
      </View>

      {/* Card de convite */}
      <View style={s.card}>
        <Text style={s.companyLabel}>Voce foi convidado para</Text>
        <Text style={s.companyName}>{invite?.company_name || ""}</Text>
        <Text style={s.roleLabel}>como <Text style={s.roleValue}>{invite?.role || "Colaborador"}</Text></Text>

        <View style={s.divider} />

        <View style={s.emailRow}>
          <Icon name="users" size={14} color={Colors.ink3} />
          <Text style={s.emailHint}>
            Conta com o email <Text style={s.emailValue}>{invite?.masked_email}</Text>
          </Text>
        </View>
      </View>

      {/* Estado: logado com email correto → aceitar */}
      {isLoggedIn && emailMatch && (
        <View style={s.section}>
          <View style={s.userInfo}>
            <View style={s.userAvatar}>
              <Text style={s.userAvatarText}>{(user.name || user.email)[0].toUpperCase()}</Text>
            </View>
            <View>
              <Text style={s.userName}>{user.name}</Text>
              <Text style={s.userEmail}>{user.email}</Text>
            </View>
          </View>
          <Pressable
            onPress={handleAccept}
            disabled={accepting}
            style={[s.primaryBtn, accepting && { opacity: 0.6 }]}
          >
            {accepting
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={s.primaryBtnText}>Aceitar convite e entrar</Text>
            }
          </Pressable>
        </View>
      )}

      {/* Estado: logado com email ERRADO */}
      {wrongEmail && (
        <View style={s.section}>
          <View style={s.warnBox}>
            <Icon name="alert" size={14} color={Colors.amber} />
            <Text style={s.warnText}>
              Voce esta logado como {user.email}, mas este convite e para {invite?.masked_email}.
              Saia e entre com o email correto.
            </Text>
          </View>
          <Pressable
            onPress={() => { useAuthStore.getState().logout?.(); }}
            style={[s.primaryBtn, { backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border }]}
          >
            <Text style={[s.primaryBtnText, { color: Colors.ink }]}>Sair e usar outro email</Text>
          </Pressable>
        </View>
      )}

      {/* Estado: nao logado */}
      {!isLoggedIn && !showLogin && (
        <View style={s.section}>
          <Text style={s.ctaLabel}>
            Para aceitar, entre com o email {invite?.masked_email} ou crie uma conta.
          </Text>

          {/* Login inline */}
          <Pressable onPress={() => setShowLogin(true)} style={s.primaryBtn}>
            <Text style={s.primaryBtnText}>Entrar no app</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push({ pathname: "/(auth)/register", params: { invite_token: token, invite_email: invite?.email || "" } } as any)}
            style={s.secondaryBtn}
          >
            <Text style={s.secondaryBtnText}>Criar conta</Text>
          </Pressable>
        </View>
      )}

      {/* Login inline */}
      {!isLoggedIn && showLogin && (
        <View style={s.section}>
          <Text style={s.formTitle}>Entrar com sua conta</Text>

          <Text style={s.fieldLabel}>E-mail</Text>
          <TextInput
            style={s.input}
            value={loginEmail}
            onChangeText={setLoginEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="seu@email.com"
            placeholderTextColor={Colors.ink3}
          />

          <Text style={[s.fieldLabel, { marginTop: 10 }]}>Senha</Text>
          <TextInput
            style={s.input}
            value={loginPass}
            onChangeText={setLoginPass}
            secureTextEntry
            placeholder="Sua senha"
            placeholderTextColor={Colors.ink3}
          />

          <Pressable
            onPress={handleLogin}
            disabled={loginLoading}
            style={[s.primaryBtn, { marginTop: 16 }, loginLoading && { opacity: 0.6 }]}
          >
            {loginLoading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={s.primaryBtnText}>Entrar</Text>
            }
          </Pressable>

          <Pressable onPress={() => setShowLogin(false)} style={s.secondaryBtn}>
            <Text style={s.secondaryBtnText}>Cancelar</Text>
          </Pressable>
        </View>
      )}

      {/* Rodape */}
      <Text style={s.footer}>Este link e valido por 7 dias e pode ser usado apenas uma vez.</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page:          { flexGrow: 1, alignItems: "center", padding: 24, paddingBottom: 48, backgroundColor: Colors.bg2 },
  center:        { alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText:   { fontSize: 13, color: Colors.ink3, marginTop: 8 },

  // Logo
  logoWrap:      { marginTop: 32, marginBottom: 28 },
  logoText:      { fontSize: 28, fontWeight: "800", color: Colors.violet3, letterSpacing: -1 },

  // Card convite
  card:          { width: "100%", maxWidth: 420, backgroundColor: Colors.bg3, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, padding: 24, alignItems: "center", marginBottom: 16 },
  companyLabel:  { fontSize: 13, color: Colors.ink3, marginBottom: 6 },
  companyName:   { fontSize: 22, fontWeight: "800", color: Colors.ink, textAlign: "center", letterSpacing: -0.5, marginBottom: 4 },
  roleLabel:     { fontSize: 13, color: Colors.ink3 },
  roleValue:     { color: Colors.violet3, fontWeight: "700" },
  divider:       { width: "100%", height: 1, backgroundColor: Colors.border, marginVertical: 16 },
  emailRow:      { flexDirection: "row", alignItems: "center", gap: 8 },
  emailHint:     { fontSize: 12, color: Colors.ink3 },
  emailValue:    { color: Colors.ink, fontWeight: "600" },

  // Section (area de acao)
  section:       { width: "100%", maxWidth: 420, gap: 10 },
  ctaLabel:      { fontSize: 13, color: Colors.ink3, textAlign: "center", lineHeight: 20, marginBottom: 4 },

  // User info
  userInfo:      { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.bg3, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border },
  userAvatar:    { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center" },
  userAvatarText:{ fontSize: 16, fontWeight: "700", color: Colors.violet3 },
  userName:      { fontSize: 14, fontWeight: "600", color: Colors.ink },
  userEmail:     { fontSize: 11, color: Colors.ink3 },

  // Warn
  warnBox:       { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: Colors.amberD, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.amber + "44" },
  warnText:      { fontSize: 12, color: Colors.amber, flex: 1, lineHeight: 18 },

  // Buttons
  primaryBtn:    { width: "100%", paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.violet, alignItems: "center" },
  primaryBtnText:{ fontSize: 15, color: "#fff", fontWeight: "700" },
  secondaryBtn:  { width: "100%", paddingVertical: 13, borderRadius: 12, backgroundColor: Colors.bg3, alignItems: "center", borderWidth: 1, borderColor: Colors.border },
  secondaryBtnText:{ fontSize: 14, color: Colors.ink3, fontWeight: "500" },

  // Form
  formTitle:     { fontSize: 15, fontWeight: "700", color: Colors.ink },
  fieldLabel:    { fontSize: 11, color: Colors.ink3, fontWeight: "600", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.3 },
  input:         { backgroundColor: Colors.bg3, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.ink },

  // Error / Success
  errorIcon:     { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.redD, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  errorTitle:    { fontSize: 20, fontWeight: "700", color: Colors.ink },
  errorSub:      { fontSize: 13, color: Colors.ink3, textAlign: "center", marginBottom: 20 },
  successIcon:   { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.greenD, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  successTitle:  { fontSize: 20, fontWeight: "700", color: Colors.green },
  successSub:    { fontSize: 13, color: Colors.ink3 },

  // Footer
  footer:        { marginTop: 32, fontSize: 11, color: Colors.ink3, textAlign: "center", paddingHorizontal: 24 },
});
