// create-new-auth.js
// Run from aura-app root: node create-new-auth.js
// Rewrites login.tsx and register.tsx from scratch — mobile-first

const fs = require('fs');
const p = require('path');

// ============================================================
// LOGIN — Mobile-first, single centered card
// ============================================================

const loginContent = `import { useState, useEffect } from "react";
import {
  View, Text, TextInput, Pressable, ActivityIndicator,
  StyleSheet, Alert, Platform, ScrollView, Image,
} from "react-native";
import { Link } from "expo-router";
import { useAuthStore } from "@/stores/auth";
import { ApiError } from "@/services/api";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";

const LOGO_SVG = "https://cdn.jsdelivr.net/gh/CaioAlexanderx/aura-app@main/assets/aura-icon.svg";

// Inject gradient animation
if (typeof document !== "undefined" && !document.getElementById("aura-auth-css")) {
  const st = document.createElement("style");
  st.id = "aura-auth-css";
  st.textContent = \`
    @keyframes authFadeIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes authGlow { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.7; } }
    .auth-card { animation: authFadeIn 0.6s ease-out; }
    .auth-input:focus { border-color: #7c3aed !important; box-shadow: 0 0 0 3px rgba(124,58,237,0.15); outline: none; }
    .auth-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(124,58,237,0.3); }
    .auth-btn:active { transform: scale(0.98); }
  \`;
  document.head.appendChild(st);
}

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const { login, loginDemo, isLoading } = useAuthStore();
  const isWeb = Platform.OS === "web";

  async function handleLogin() {
    if (!email || !password) { Alert.alert("Preencha e-mail e senha"); return; }
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err) {
      Alert.alert("Erro", err instanceof ApiError ? err.message : "Erro ao entrar.");
    }
  }

  const card = (
    <View style={s.card} {...(isWeb ? { className: "auth-card" } as any : {})}>
      {/* Logo */}
      <View style={s.logoRow}>
        <Image source={{ uri: LOGO_SVG }} style={s.logo} resizeMode="contain" />
        <Text style={s.brand}>Aura<Text style={{ color: "#7c3aed" }}>.</Text></Text>
      </View>

      {/* Header */}
      <Text style={s.title}>Entrar na sua conta</Text>
      <Text style={s.subtitle}>Gerencie seu neg\u00f3cio de qualquer lugar</Text>

      {/* E-mail */}
      <View style={s.field}>
        <Text style={s.label}>E-mail</Text>
        <View style={s.inputWrap}>
          <Icon name="message" size={16} color={Colors.ink3} />
          <TextInput
            style={[s.input, isWeb && { outlineWidth: 0 } as any]}
            {...(isWeb ? { className: "auth-input" } as any : {})}
            value={email} onChangeText={setEmail}
            placeholder="seu@email.com" placeholderTextColor={Colors.ink3}
            autoCapitalize="none" keyboardType="email-address"
            autoComplete="email"
          />
        </View>
      </View>

      {/* Senha */}
      <View style={s.field}>
        <Text style={s.label}>Senha</Text>
        <View style={s.inputWrap}>
          <Icon name="settings" size={16} color={Colors.ink3} />
          <TextInput
            style={[s.input, isWeb && { outlineWidth: 0 } as any]}
            {...(isWeb ? { className: "auth-input" } as any : {})}
            value={password} onChangeText={setPassword}
            placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" placeholderTextColor={Colors.ink3}
            secureTextEntry={!showPass}
            autoComplete="current-password"
          />
          <Pressable onPress={() => setShowPass(!showPass)} style={s.eyeBtn}>
            <Text style={s.eyeText}>{showPass ? "Ocultar" : "Ver"}</Text>
          </Pressable>
        </View>
      </View>

      {/* Esqueci senha */}
      <Pressable style={s.forgotRow}>
        <Text style={s.forgotText}>Esqueci minha senha</Text>
      </Pressable>

      {/* Bot\u00e3o Entrar */}
      <Pressable
        style={[s.btn, isLoading && { opacity: 0.7 }]}
        {...(isWeb ? { className: "auth-btn" } as any : {})}
        onPress={handleLogin} disabled={isLoading}
      >
        {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Entrar</Text>}
      </Pressable>

      {/* Divider */}
      <View style={s.dividerRow}>
        <View style={s.dividerLine} />
        <Text style={s.dividerText}>ou</Text>
        <View style={s.dividerLine} />
      </View>

      {/* Criar conta */}
      <View style={s.footerRow}>
        <Text style={s.footerText}>N\u00e3o tem conta? </Text>
        <Link href="/(auth)/register"><Text style={s.link}>Criar conta gr\u00e1tis</Text></Link>
      </View>

      {/* Demo */}
      <Pressable style={s.demoBtn} onPress={loginDemo} disabled={isLoading}>
        <Icon name="dashboard" size={14} color={Colors.violet3} />
        <Text style={s.demoBtnText}>Explorar modo demonstrativo</Text>
      </Pressable>

      {/* Footer */}
      <Text style={s.footer}>Aura. \u00b7 Tecnologia para Neg\u00f3cios</Text>
    </View>
  );

  if (isWeb) {
    return (
      <div style={{
        minHeight: "100vh", width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
        background: \`radial-gradient(ellipse at 30% 20%, rgba(124,58,237,0.15) 0%, transparent 50%),
                     radial-gradient(ellipse at 70% 80%, rgba(139,92,246,0.08) 0%, transparent 40%),
                     \${Colors.bg}\`,
        padding: 20, overflowY: "auto",
      } as any}>
        {card}
      </div>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.mobileContainer}>
      {card}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  mobileContainer: { flexGrow: 1, backgroundColor: Colors.bg, padding: 20, justifyContent: "center", alignItems: "center" },
  card: {
    width: "100%", maxWidth: 400,
    backgroundColor: Colors.bg3,
    borderRadius: 24, padding: 28,
    borderWidth: 1, borderColor: Colors.border2,
  },
  logoRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 24 },
  logo: { width: 40, height: 40 },
  brand: { fontSize: 26, fontWeight: "800", color: Colors.ink, letterSpacing: -0.5 },
  title: { fontSize: 22, color: Colors.ink, fontWeight: "700", textAlign: "center", marginBottom: 4 },
  subtitle: { fontSize: 13, color: Colors.ink3, textAlign: "center", marginBottom: 28 },
  field: { marginBottom: 16 },
  label: { fontSize: 12, color: Colors.ink3, marginBottom: 6, fontWeight: "600", letterSpacing: 0.3 },
  inputWrap: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.bg4, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 0,
  },
  input: { flex: 1, fontSize: 14, color: Colors.ink, paddingVertical: 13 },
  eyeBtn: { paddingVertical: 8, paddingHorizontal: 4 },
  eyeText: { fontSize: 11, color: Colors.violet3, fontWeight: "600" },
  forgotRow: { alignSelf: "flex-end", marginBottom: 20, marginTop: -4 },
  forgotText: { fontSize: 12, color: Colors.violet3, fontWeight: "500" },
  btn: {
    backgroundColor: Colors.violet, borderRadius: 12,
    paddingVertical: 15, alignItems: "center",
    marginBottom: 20,
  },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontSize: 11, color: Colors.ink3 },
  footerRow: { flexDirection: "row", justifyContent: "center", marginBottom: 16 },
  footerText: { fontSize: 13, color: Colors.ink3 },
  link: { fontSize: 13, color: Colors.violet3, fontWeight: "700" },
  demoBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderRadius: 12, paddingVertical: 13,
    borderWidth: 1, borderColor: Colors.border2,
    marginBottom: 20,
  },
  demoBtnText: { color: Colors.violet3, fontSize: 13, fontWeight: "600" },
  footer: { fontSize: 11, color: Colors.ink3, textAlign: "center", opacity: 0.5 },
});
`;

// ============================================================
// REGISTER — Mobile-first, expanded fields
// ============================================================

const registerContent = `import { useState } from "react";
import {
  View, Text, TextInput, Pressable, ActivityIndicator,
  StyleSheet, Alert, Platform, ScrollView, Image,
} from "react-native";
import { Link } from "expo-router";
import { useAuthStore } from "@/stores/auth";
import { ApiError } from "@/services/api";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";

const LOGO_SVG = "https://cdn.jsdelivr.net/gh/CaioAlexanderx/aura-app@main/assets/aura-icon.svg";

// Inject CSS
if (typeof document !== "undefined" && !document.getElementById("aura-auth-css")) {
  const st = document.createElement("style");
  st.id = "aura-auth-css";
  st.textContent = \`
    @keyframes authFadeIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
    .auth-card { animation: authFadeIn 0.6s ease-out; }
    .auth-input:focus { border-color: #7c3aed !important; box-shadow: 0 0 0 3px rgba(124,58,237,0.15); outline: none; }
    .auth-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(124,58,237,0.3); }
    .auth-btn:active { transform: scale(0.98); }
  \`;
  document.head.appendChild(st);
}

function maskCNPJ(v: string): string {
  const n = v.replace(/\\D/g, "").slice(0, 14);
  if (n.length <= 2) return n;
  if (n.length <= 5) return n.slice(0,2) + "." + n.slice(2);
  if (n.length <= 8) return n.slice(0,2) + "." + n.slice(2,5) + "." + n.slice(5);
  if (n.length <= 12) return n.slice(0,2) + "." + n.slice(2,5) + "." + n.slice(5,8) + "/" + n.slice(8);
  return n.slice(0,2) + "." + n.slice(2,5) + "." + n.slice(5,8) + "/" + n.slice(8,12) + "-" + n.slice(12);
}

function maskPhone(v: string): string {
  const n = v.replace(/\\D/g, "").slice(0, 11);
  if (n.length <= 2) return "(" + n;
  if (n.length <= 7) return "(" + n.slice(0,2) + ") " + n.slice(2);
  return "(" + n.slice(0,2) + ") " + n.slice(2,7) + "-" + n.slice(7);
}

export default function RegisterScreen() {
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [telefone, setTelefone] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [codigo, setCodigo] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cnpjFound, setCnpjFound] = useState<string | null>(null);
  const [cnpjError, setCnpjError] = useState<string | null>(null);
  const { register, loginDemo, isLoading } = useAuthStore();
  const isWeb = Platform.OS === "web";

  // CNPJ auto-fill via BrasilAPI
  async function lookupCNPJ(formatted: string) {
    const nums = formatted.replace(/\\D/g, "");
    if (nums.length !== 14) return;
    setCnpjLoading(true);
    setCnpjFound(null);
    setCnpjError(null);
    try {
      const res = await fetch(\`https://brasilapi.com.br/api/cnpj/v1/\${nums}\`);
      if (!res.ok) throw new Error("not found");
      const data = await res.json();
      setEmpresa(data.razao_social || data.nome_fantasia || "");
      setCnpjFound(data.razao_social || data.nome_fantasia);
    } catch {
      setCnpjError("CNPJ n\u00e3o encontrado \u2014 verifique os d\u00edgitos");
    } finally {
      setCnpjLoading(false);
    }
  }

  function handleCnpjChange(v: string) {
    const masked = maskCNPJ(v);
    setCnpj(masked);
    setCnpjFound(null);
    setCnpjError(null);
    // Auto-lookup when complete
    if (masked.replace(/\\D/g, "").length === 14) {
      lookupCNPJ(masked);
    }
  }

  // Password strength
  const passLength = senha.length >= 8;
  const passUpper = /[A-Z]/.test(senha);
  const passNumber = /[0-9]/.test(senha);
  const passMatch = senha === confirmarSenha && confirmarSenha.length > 0;
  const passValid = passLength && passUpper && passNumber;

  async function handleRegister() {
    if (!nome || !email || !senha || !empresa || !telefone) {
      Alert.alert("Campos obrigat\u00f3rios", "Preencha todos os campos marcados com *");
      return;
    }
    if (!passValid) {
      Alert.alert("Senha fraca", "A senha deve ter no m\u00ednimo 8 caracteres, 1 mai\u00fascula e 1 n\u00famero.");
      return;
    }
    if (!passMatch) {
      Alert.alert("Senhas diferentes", "A confirma\u00e7\u00e3o de senha n\u00e3o confere.");
      return;
    }
    try {
      await register(nome.trim(), email.trim().toLowerCase(), senha, empresa.trim());
    } catch (err) {
      Alert.alert("Erro", err instanceof ApiError ? err.message : "Erro ao criar conta.");
    }
  }

  function Req({ ok, text }: { ok: boolean; text: string }) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ok ? Colors.green : Colors.ink3 + "44" }} />
        <Text style={{ fontSize: 10, color: ok ? Colors.green : Colors.ink3, fontWeight: "500" }}>{text}</Text>
      </View>
    );
  }

  const card = (
    <View style={s.card} {...(isWeb ? { className: "auth-card" } as any : {})}>
      {/* Logo */}
      <View style={s.logoRow}>
        <Image source={{ uri: LOGO_SVG }} style={s.logo} resizeMode="contain" />
        <Text style={s.brand}>Aura<Text style={{ color: "#7c3aed" }}>.</Text></Text>
      </View>

      <Text style={s.title}>Criar sua conta</Text>
      <Text style={s.subtitle}>Comece a organizar seu neg\u00f3cio em minutos</Text>

      {/* Nome * */}
      <View style={s.field}>
        <Text style={s.label}>Nome completo *</Text>
        <View style={s.inputWrap}>
          <Icon name="user_plus" size={16} color={Colors.ink3} />
          <TextInput style={[s.input, isWeb && { outlineWidth: 0 } as any]}
            {...(isWeb ? { className: "auth-input" } as any : {})}
            value={nome} onChangeText={setNome}
            placeholder="Maria da Silva" placeholderTextColor={Colors.ink3}
            autoComplete="name" />
        </View>
      </View>

      {/* CNPJ */}
      <View style={s.field}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <Text style={s.label}>CNPJ</Text>
          <Pressable onPress={() => { setCnpj(""); setCnpjFound(null); setCnpjError(null); }}>
            <Text style={{ fontSize: 10, color: Colors.violet3, fontWeight: "500" }}>N\u00e3o tenho CNPJ</Text>
          </Pressable>
        </View>
        <View style={s.inputWrap}>
          <Icon name="file_text" size={16} color={Colors.ink3} />
          <TextInput style={[s.input, isWeb && { outlineWidth: 0 } as any]}
            {...(isWeb ? { className: "auth-input" } as any : {})}
            value={cnpj} onChangeText={handleCnpjChange}
            placeholder="00.000.000/0000-00" placeholderTextColor={Colors.ink3}
            keyboardType="number-pad" maxLength={18} />
          {cnpjLoading && <ActivityIndicator size="small" color={Colors.violet3} />}
        </View>
        {cnpjFound && (
          <View style={s.cnpjOk}>
            <Icon name="check" size={12} color={Colors.green} />
            <Text style={s.cnpjOkText}>{cnpjFound}</Text>
          </View>
        )}
        {cnpjError && <Text style={s.cnpjErr}>{cnpjError}</Text>}
      </View>

      {/* Telefone * */}
      <View style={s.field}>
        <Text style={s.label}>Telefone / WhatsApp *</Text>
        <View style={s.inputWrap}>
          <Icon name="message" size={16} color={Colors.ink3} />
          <TextInput style={[s.input, isWeb && { outlineWidth: 0 } as any]}
            {...(isWeb ? { className: "auth-input" } as any : {})}
            value={telefone} onChangeText={v => setTelefone(maskPhone(v))}
            placeholder="(12) 99999-0000" placeholderTextColor={Colors.ink3}
            keyboardType="phone-pad" maxLength={15}
            autoComplete="tel" />
        </View>
      </View>

      {/* Nome da empresa * */}
      <View style={s.field}>
        <Text style={s.label}>Nome da empresa *</Text>
        <View style={s.inputWrap}>
          <Icon name="bag" size={16} color={Colors.ink3} />
          <TextInput style={[s.input, isWeb && { outlineWidth: 0 } as any]}
            {...(isWeb ? { className: "auth-input" } as any : {})}
            value={empresa} onChangeText={setEmpresa}
            placeholder="Minha Empresa Ltda" placeholderTextColor={Colors.ink3}
            autoComplete="organization" />
        </View>
        {cnpjFound && <Text style={{ fontSize: 10, color: Colors.green, marginTop: 4, fontStyle: "italic" }}>Preenchido automaticamente pelo CNPJ</Text>}
      </View>

      {/* E-mail * */}
      <View style={s.field}>
        <Text style={s.label}>E-mail *</Text>
        <View style={s.inputWrap}>
          <Icon name="message" size={16} color={Colors.ink3} />
          <TextInput style={[s.input, isWeb && { outlineWidth: 0 } as any]}
            {...(isWeb ? { className: "auth-input" } as any : {})}
            value={email} onChangeText={setEmail}
            placeholder="maria@empresa.com" placeholderTextColor={Colors.ink3}
            autoCapitalize="none" keyboardType="email-address"
            autoComplete="email" />
        </View>
      </View>

      {/* Senha * */}
      <View style={s.field}>
        <Text style={s.label}>Senha *</Text>
        <View style={s.inputWrap}>
          <Icon name="settings" size={16} color={Colors.ink3} />
          <TextInput style={[s.input, isWeb && { outlineWidth: 0 } as any]}
            {...(isWeb ? { className: "auth-input" } as any : {})}
            value={senha} onChangeText={setSenha}
            placeholder="M\u00ednimo 8 caracteres" placeholderTextColor={Colors.ink3}
            secureTextEntry={!showPass}
            autoComplete="new-password" />
          <Pressable onPress={() => setShowPass(!showPass)} style={s.eyeBtn}>
            <Text style={s.eyeText}>{showPass ? "Ocultar" : "Ver"}</Text>
          </Pressable>
        </View>
        {senha.length > 0 && (
          <View style={s.passReqs}>
            <Req ok={passLength} text="8+ caracteres" />
            <Req ok={passUpper} text="1 letra mai\u00fascula" />
            <Req ok={passNumber} text="1 n\u00famero" />
          </View>
        )}
      </View>

      {/* Confirmar senha * */}
      <View style={s.field}>
        <Text style={s.label}>Confirmar senha *</Text>
        <View style={s.inputWrap}>
          <Icon name="check" size={16} color={confirmarSenha.length > 0 ? (passMatch ? Colors.green : Colors.red) : Colors.ink3} />
          <TextInput style={[s.input, isWeb && { outlineWidth: 0 } as any]}
            {...(isWeb ? { className: "auth-input" } as any : {})}
            value={confirmarSenha} onChangeText={setConfirmarSenha}
            placeholder="Repita a senha" placeholderTextColor={Colors.ink3}
            secureTextEntry={!showPass}
            autoComplete="new-password" />
        </View>
        {confirmarSenha.length > 0 && !passMatch && (
          <Text style={{ fontSize: 10, color: Colors.red, marginTop: 4 }}>As senhas n\u00e3o conferem</Text>
        )}
      </View>

      {/* C\u00f3digo de acesso */}
      <View style={s.field}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <Text style={s.label}>C\u00f3digo de acesso</Text>
          <Text style={{ fontSize: 10, color: Colors.ink3 }}>Trial, pagamento ou indica\u00e7\u00e3o</Text>
        </View>
        <View style={s.inputWrap}>
          <Icon name="star" size={16} color={Colors.ink3} />
          <TextInput style={[s.input, isWeb && { outlineWidth: 0 } as any]}
            {...(isWeb ? { className: "auth-input" } as any : {})}
            value={codigo} onChangeText={v => setCodigo(v.toUpperCase())}
            placeholder="TRIAL-XXXX ou REF-NOME" placeholderTextColor={Colors.ink3}
            autoCapitalize="characters" maxLength={20} />
        </View>
        <Text style={{ fontSize: 10, color: Colors.ink3, marginTop: 4, fontStyle: "italic" }}>
          Recebeu um c\u00f3digo de indica\u00e7\u00e3o ou trial? Insira aqui.
        </Text>
      </View>

      {/* Bot\u00e3o Criar */}
      <Pressable
        style={[s.btn, isLoading && { opacity: 0.7 }]}
        {...(isWeb ? { className: "auth-btn" } as any : {})}
        onPress={handleRegister} disabled={isLoading}
      >
        {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Criar conta</Text>}
      </Pressable>

      {/* Footer */}
      <View style={s.footerRow}>
        <Text style={s.footerText}>J\u00e1 tem conta? </Text>
        <Link href="/(auth)/login"><Text style={s.link}>Entrar</Text></Link>
      </View>

      <View style={s.dividerRow}>
        <View style={s.dividerLine} />
        <Text style={s.dividerText}>ou</Text>
        <View style={s.dividerLine} />
      </View>

      <Pressable style={s.demoBtn} onPress={loginDemo} disabled={isLoading}>
        <Icon name="dashboard" size={14} color={Colors.violet3} />
        <Text style={s.demoBtnText}>Explorar modo demonstrativo</Text>
      </Pressable>

      <Text style={s.footer}>Aura. \u00b7 Tecnologia para Neg\u00f3cios</Text>
    </View>
  );

  if (isWeb) {
    return (
      <div style={{
        minHeight: "100vh", width: "100%", display: "flex", alignItems: "center", justifyContent: "flex-start",
        background: \`radial-gradient(ellipse at 30% 20%, rgba(124,58,237,0.15) 0%, transparent 50%),
                     radial-gradient(ellipse at 70% 80%, rgba(139,92,246,0.08) 0%, transparent 40%),
                     \${Colors.bg}\`,
        padding: "40px 20px", overflowY: "auto",
      } as any}>
        {card}
      </div>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.mobileContainer}>
      {card}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  mobileContainer: { flexGrow: 1, backgroundColor: Colors.bg, padding: 20, paddingTop: 40, paddingBottom: 40, alignItems: "center" },
  card: {
    width: "100%", maxWidth: 420,
    backgroundColor: Colors.bg3,
    borderRadius: 24, padding: 28,
    borderWidth: 1, borderColor: Colors.border2,
  },
  logoRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 20 },
  logo: { width: 36, height: 36 },
  brand: { fontSize: 24, fontWeight: "800", color: Colors.ink, letterSpacing: -0.5 },
  title: { fontSize: 20, color: Colors.ink, fontWeight: "700", textAlign: "center", marginBottom: 4 },
  subtitle: { fontSize: 12, color: Colors.ink3, textAlign: "center", marginBottom: 24 },
  field: { marginBottom: 14 },
  label: { fontSize: 11, color: Colors.ink3, marginBottom: 0, fontWeight: "600", letterSpacing: 0.3 },
  inputWrap: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.bg4, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 0,
  },
  input: { flex: 1, fontSize: 14, color: Colors.ink, paddingVertical: 12 },
  eyeBtn: { paddingVertical: 8, paddingHorizontal: 4 },
  eyeText: { fontSize: 11, color: Colors.violet3, fontWeight: "600" },
  passReqs: { flexDirection: "row", gap: 12, marginTop: 6, flexWrap: "wrap" },
  cnpjOk: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, backgroundColor: Colors.greenD, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  cnpjOkText: { fontSize: 11, color: Colors.green, fontWeight: "600" },
  cnpjErr: { fontSize: 10, color: Colors.red, marginTop: 4 },
  btn: {
    backgroundColor: Colors.violet, borderRadius: 12,
    paddingVertical: 15, alignItems: "center",
    marginBottom: 16, marginTop: 4,
  },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontSize: 11, color: Colors.ink3 },
  footerRow: { flexDirection: "row", justifyContent: "center", marginBottom: 16 },
  footerText: { fontSize: 13, color: Colors.ink3 },
  link: { fontSize: 13, color: Colors.violet3, fontWeight: "700" },
  demoBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderRadius: 12, paddingVertical: 13,
    borderWidth: 1, borderColor: Colors.border2,
    marginBottom: 16,
  },
  demoBtnText: { color: Colors.violet3, fontSize: 13, fontWeight: "600" },
  footer: { fontSize: 11, color: Colors.ink3, textAlign: "center", opacity: 0.5 },
});
`;

// ============================================================
// WRITE FILES
// ============================================================

const loginPath = p.join('app', '(auth)', 'login.tsx');
const registerPath = p.join('app', '(auth)', 'register.tsx');

fs.writeFileSync(loginPath, loginContent, 'utf-8');
console.log('OK: ' + loginPath + ' rewritten (' + loginContent.length + ' chars)');

fs.writeFileSync(registerPath, registerContent, 'utf-8');
console.log('OK: ' + registerPath + ' rewritten (' + registerContent.length + ' chars)');

console.log('\nBoth auth screens rewritten from scratch!');
console.log('Run:');
console.log('  git add -A && git commit -m "feat: FE-LOGIN-01 + FE-REGISTER-01 - new auth screens mobile-first" && git push');
