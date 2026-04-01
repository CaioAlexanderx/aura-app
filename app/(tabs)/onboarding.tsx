import { useState, useRef, useEffect } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Platform, Alert, Image, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/colors";
import { IS_WIDE } from "@/constants/helpers";
import { useAuthStore } from "@/stores/auth";
import { CNAE_PROFILES, detectProfileFromCnae } from "@/constants/obligations";
import { Icon } from "@/components/Icon";

const LOGO_SVG="https://cdn.jsdelivr.net/gh/CaioAlexanderx/aura-app@main/assets/aura-icon.svg";
const STEPS = ["Boas-vindas", "Sua empresa", "Tipo de negócio", "Funcionários", "Pronto!"];
const BIZ_TYPES = [
  { key: "barbearia_salao", label: "Barbearia / Salao", icon: "S" },
  { key: "odontologia", label: "Odontologia", icon: "D" },
  { key: "estetica", label: "Estetica / Bem-estar", icon: "E" },
  { key: "food_service", label: "Alimentacao / Restaurante", icon: "R" },
  { key: "varejo_roupas", label: "Varejo / Roupas", icon: "V" },
  { key: "pet_shop", label: "Pet Shop", icon: "P" },
  { key: "ti_saas", label: "TI / Software", icon: "T" },
  { key: "mei_comercio", label: "Comercio geral", icon: "C" },
  { key: "mei_servicos", label: "Servicos geral", icon: "G" },
];

function PBar({ step, total }: { step: number; total: number }) {
  return <View style={pg.c}><View style={pg.b}>{[...Array(total)].map((_, i) => <View key={i} style={[pg.s, i <= step && pg.sa]} />)}</View><Text style={pg.l}>Passo {step + 1} de {total}</Text></View>;
}
const pg = StyleSheet.create({ c: { marginBottom: 24, gap: 8 }, b: { flexDirection: "row", gap: 4 }, s: { flex: 1, height: 4, borderRadius: 2, backgroundColor: Colors.bg4 }, sa: { backgroundColor: Colors.violet }, l: { fontSize: 11, color: Colors.ink3, textAlign: "center" } });

function SC({ children }: { children: React.ReactNode }) {
  return <View style={scc.card}>{children}</View>;
}
const scc = StyleSheet.create({ card: { backgroundColor: Colors.bg3, borderRadius: 20, padding: IS_WIDE ? 40 : 24, borderWidth: 1, borderColor: Colors.border2, maxWidth: 560, width: "100%", alignSelf: "center" } });

// W-07
if (typeof document !== "undefined" && !document.getElementById("aura-confetti")) { const _c = document.createElement("style"); _c.id = "aura-confetti"; _c.textContent = "@keyframes confettiFall{0%{transform:translateY(0) rotate(0deg);opacity:1}100%{transform:translateY(100vh) rotate(720deg);opacity:0}} @keyframes auraSplashFadeIn{0%{opacity:0;transform:scale(0.85)}40%{opacity:1;transform:scale(1.02)}100%{opacity:1;transform:scale(1)}} @keyframes auraSplashPulse{0%,100%{opacity:0.6}50%{opacity:1}} @keyframes auraSplashDots{0%{content:''}33%{content:'.'}66%{content:'..'}100%{content:'...'}}"; document.head.appendChild(_c); }

function ConfettiEffect() {
  if (Platform.OS !== "web") return null;
  const colors = ["#7c3aed","#8b5cf6","#a78bfa","#c4b5fd","#34d399","#fbbf24"];
  const ps = Array.from({length:35},(_,i)=>({id:i,x:Math.random()*100,d:Math.random()*2,dur:2+Math.random()*2,c:colors[i%6],sz:4+Math.random()*6}));
  return (
    <View style={{position:"absolute",top:0,left:0,right:0,bottom:0,zIndex:50,overflow:"hidden"}} pointerEvents="none">
      {ps.map(pp=><div key={pp.id} style={{position:"absolute",left:pp.x+"%",top:"-5%",width:pp.sz,height:pp.sz,borderRadius:pp.sz>7?1:99,backgroundColor:pp.c,animation:"confettiFall "+pp.dur+"s "+pp.d+"s ease-out forwards"}} />)}
    </View>
  );
}

// Splash loading screen
function SplashLoading() {
  const w = Platform.OS === "web";
  return (
    <View style={sp.container}>
      <View style={[sp.content, w && { animation: "auraSplashFadeIn 0.8s ease-out" } as any]}>
        <Image source={{ uri: LOGO_SVG }} style={sp.logo} resizeMode="contain" />
        <Text style={sp.brand}>Aura<Text style={{ color: "#7c3aed" }}>.</Text></Text>
        <View style={sp.spinnerWrap}>
          <ActivityIndicator size="large" color={Colors.violet3} />
        </View>
        <Text style={sp.message}>Carregando a melhor solução para sua empresa.</Text>
      </View>
    </View>
  );
}
const sp = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", minHeight: 500 },
  content: { alignItems: "center", gap: 20 },
  logo: { width: 72, height: 72 },
  brand: { fontSize: 32, fontWeight: "800", color: Colors.ink, letterSpacing: -0.5 },
  spinnerWrap: { marginVertical: 8 },
  message: { fontSize: 15, color: Colors.ink3, fontStyle: "italic", textAlign: "center", maxWidth: 320, lineHeight: 22 },
});

export default function OnboardingScreen() {
  const router = useRouter();
  const { user, company, completeOnboarding, setCompanyLogo } = useAuthStore();
  const [step, setStep] = useState(0);
  const [cnpj, setCnpj] = useState("");
  const [cnpjData, setCnpjData] = useState<any>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [bizType, setBizType] = useState("");
  const [hasEmp, setHasEmp] = useState(false);
  const [empCount, setEmpCount] = useState("0");
  const [logo, setLogo] = useState<string | null>(null);
  const [showSplash, setShowSplash] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  function fmtCnpj(v: string) {
    const n = v.replace(/\D/g, "").slice(0, 14);
    if (n.length <= 2) return n;
    if (n.length <= 5) return n.slice(0,2) + "." + n.slice(2);
    if (n.length <= 8) return n.slice(0,2) + "." + n.slice(2,5) + "." + n.slice(5);
    if (n.length <= 12) return n.slice(0,2) + "." + n.slice(2,5) + "." + n.slice(5,8) + "/" + n.slice(8);
    return n.slice(0,2) + "." + n.slice(2,5) + "." + n.slice(5,8) + "/" + n.slice(8,12) + "-" + n.slice(12);
  }

  function handleLogoUpload() {
    if (Platform.OS === "web") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/png,image/jpeg,image/webp";
      input.onchange = (e: any) => {
        const file = e.target?.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) { Alert.alert("Arquivo muito grande", "A logo deve ter no maximo 2MB."); return; }
        const reader = new FileReader();
        reader.onload = () => { const result = reader.result as string; setLogo(result); setCompanyLogo(result); };
        reader.readAsDataURL(file);
      };
      input.click();
    }
  }

  async function lookupCnpj() {
    const nums = cnpj.replace(/\D/g, "");
    if (nums.length !== 14) { Alert.alert("CNPJ deve ter 14 dígitos"); return; }
    setLookingUp(true);
    try {
      // Tenta via backend (com cache Redis)
      let data;
      try {
        const { cnpjApi } = require("@/services/api");
        data = await cnpjApi.lookup(nums);
      } catch {
        // Fallback: BrasilAPI direto
        const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${nums}`);
        if (!res.ok) throw new Error("CNPJ não encontrado");
        const rf = await res.json();
        data = {
          legal_name: rf.razao_social || rf.nome_fantasia || "",
          cnae_principal: { code: String(rf.cnae_fiscal || ""), description: rf.cnae_fiscal_descricao || "" },
          suggested_regime: rf.natureza_juridica === "2135" ? "MEI" : "Simples Nacional",
          address_state: rf.uf || "SP",
          address_city: rf.municipio || "",
          suggested_vertical: null,
        };
      }
      setCnpjData({
        razaoSocial: data.legal_name || data.razao_social || "Empresa",
        cnae: data.cnae_principal?.code ? data.cnae_principal.code + " - " + (data.cnae_principal.description || "") : "---",
        regime: data.suggested_regime || "MEI",
        uf: data.address_state || "SP",
        municipio: data.address_city || "",
      });
      // Detect biz type from CNAE (for UI selection, NOT for vertical activation)
      const prefix = String(data.cnae_principal?.code || "").replace(/[^0-9]/g, "").substring(0, 4);
      if (prefix && typeof detectProfileFromCnae === "function") {
        setBizType(detectProfileFromCnae(prefix, false));
      }
      setLookingUp(false);
      setStep(2);
    } catch (err: any) {
      setLookingUp(false);
      Alert.alert("Erro", err?.message || "Não foi possível consultar o CNPJ");
    }
  }

  async function finish() {
    setShowSplash(true);
    try {
      const companyId = company?.id;
      if (companyId && !company?.name?.includes("Demo")) {
        const { onboardingApi } = require("@/services/api");
        // Step 1: CNPJ (if provided)
        if (cnpj.replace(/\D/g, "").length === 14) {
          try { await onboardingApi.stepCnpj(companyId, cnpj.replace(/\D/g, "")); } catch {}
        }
        // Step 2: Regime
        const regimeMap: Record<string, string> = { "MEI": "mei", "Simples Nacional": "simples_nacional" };
        const regime = regimeMap[cnpjData?.regime] || "mei";
        try { await onboardingApi.stepRegime(companyId, regime); } catch {}
        // Step 3: Perfil (finaliza)
        try {
          await onboardingApi.stepPerfil(companyId, {
            trade_name: cnpjData?.razaoSocial || company?.name,
          });
        } catch {}
      }
    } catch (err) {
      console.warn("Onboarding API error (non-blocking):", err);
    }
    // Always complete locally even if API fails
    setTimeout(() => {
      completeOnboarding({ logo: logo || undefined, cnpj: cnpj || undefined, businessType: bizType });
      router.replace("/");
    }, 2500);
  }

  const inp = { backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.ink };

  // Show splash loading screen
  if (showSplash) {
    return (
      <View style={z.scr}>
        <SplashLoading />
      </View>
    );
  }

  return (
    <ScrollView style={z.scr} contentContainerStyle={z.cnt}>
      <PBar step={step} total={STEPS.length} />

      {step === 0 && (
        <SC>
          <Text style={z.emoji}>*</Text>
          <Text style={z.title}>Bem-vindo à Aura, {user?.name?.split(" ")[0] || "empreendedor"}!</Text>
          <Text style={z.sub}>Vamos configurar sua empresa em poucos minutos. Depois disso, a Aura cuida de organizar tudo pra voce.</Text>
          <View style={z.features}>
            {["Obrigações contábeis organizadas","Vendas e estoque integrados","Guias passo a passo para cada tarefa","Tudo em um so lugar"].map(f => (
              <View key={f} style={z.featureRow}><View style={z.featureDot} /><Text style={z.featureText}>{f}</Text></View>
            ))}
          </View>
          <Pressable onPress={() => setStep(1)} style={z.primaryBtn}><Text style={z.primaryBtnText}>Vamos começar</Text></Pressable>
        </SC>
      )}

      {step === 1 && (
        <SC>
          <Text style={z.stepTitle}>Sua empresa</Text>
          <Text style={z.stepSub}>Adicione a logo e o CNPJ da sua empresa.</Text>
          <View style={z.logoSection}>
            <Text style={z.fieldLabel}>Logo da empresa (opcional)</Text>
            <Pressable onPress={handleLogoUpload} style={z.logoUpload}>
              {logo ? (
                <Image source={{ uri: logo }} style={z.logoPreview} resizeMode="contain" />
              ) : (
                <View style={z.logoPlaceholder}>
                  <Icon name="user_plus" size={28} color={Colors.ink3} />
                  <Text style={z.logoPlaceholderText}>Clique para enviar</Text>
                  <Text style={z.logoPlaceholderHint}>PNG, JPG ou WebP - max 2MB</Text>
                </View>
              )}
            </Pressable>
            {logo && (
              <Pressable onPress={() => { setLogo(null); setCompanyLogo(""); }} style={z.logoRemove}>
                <Text style={z.logoRemoveText}>Remover logo</Text>
              </Pressable>
            )}
          </View>
          <View style={z.divider} />
          <View style={{ gap: 12 }}>
            <Text style={z.fieldLabel}>CNPJ</Text>
            <TextInput style={inp as any} value={cnpj} onChangeText={v => setCnpj(fmtCnpj(v))} placeholder="00.000.000/0000-00" placeholderTextColor={Colors.ink3} keyboardType="number-pad" maxLength={18} />
            <Pressable onPress={lookupCnpj} style={[z.primaryBtn, lookingUp && { opacity: 0.6 }]} disabled={lookingUp}>
              <Text style={z.primaryBtnText}>{lookingUp ? "Consultando..." : "Consultar CNPJ"}</Text>
            </Pressable>
            <View style={z.divider} />
            <Pressable onPress={() => { setCnpjData({ razaoSocial: company?.name || "Minha Empresa", cnae: "---", regime: "MEI", uf: "SP", municipio: "---" }); setStep(2); }} style={z.skipBtn}>
              <Text style={z.skipText}>Ainda não tenho CNPJ - configurar depois</Text>
            </Pressable>
          </View>
          <Pressable onPress={() => setStep(0)} style={z.backBtn}><Text style={z.backText}>Voltar</Text></Pressable>
        </SC>
      )}

      {step === 2 && (
        <SC>
          <Text style={z.stepTitle}>Tipo de negócio</Text>
          {cnpjData && cnpjData.cnae !== "---" && (
            <View style={z.detectedCard}><Text style={z.detectedLabel}>Detectado pelo CNPJ</Text><Text style={z.detectedValue}>{cnpjData.razaoSocial}</Text><Text style={z.detectedMeta}>CNAE: {cnpjData.cnae} / {cnpjData.regime} / {cnpjData.municipio}-{cnpjData.uf}</Text></View>
          )}
          <Text style={z.stepSub}>Selecione o tipo que melhor descreve seu negócio:</Text>
          <View style={z.typesGrid}>
            {BIZ_TYPES.map(t => (
              <Pressable key={t.key} onPress={() => setBizType(t.key)} style={[z.typeCard, bizType === t.key && z.typeCardActive]}>
                <View style={[z.typeIcon, bizType === t.key && z.typeIconActive]}><Text style={[z.typeIconText, bizType === t.key && { color: "#fff" }]}>{t.icon}</Text></View>
                <Text style={[z.typeLabel, bizType === t.key && z.typeLabelActive]}>{t.label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={z.navRow}>
            <Pressable onPress={() => setStep(1)} style={z.backBtn}><Text style={z.backText}>Voltar</Text></Pressable>
            <Pressable onPress={() => { if (!bizType) { Alert.alert("Selecione um tipo de negócio"); return; } setStep(3); }} style={z.primaryBtn}><Text style={z.primaryBtnText}>Continuar</Text></Pressable>
          </View>
        </SC>
      )}

      {step === 3 && (
        <SC>
          <Text style={z.stepTitle}>Você tem funcionários?</Text>
          <Text style={z.stepSub}>Isso define quais obrigações contábeis a Aura vai configurar pra você.</Text>
          <View style={z.toggleRow}>
            <Pressable onPress={() => setHasEmp(false)} style={[z.toggleCard, !hasEmp && z.toggleActive]}>
              <Text style={[z.toggleIcon, !hasEmp && { color: Colors.green }]}>-</Text>
              <Text style={[z.toggleTitle, !hasEmp && { color: Colors.ink }]}>Não tenho</Text>
              <Text style={z.toggleSub}>Trabalho sozinho ou com sócios</Text>
            </Pressable>
            <Pressable onPress={() => setHasEmp(true)} style={[z.toggleCard, hasEmp && z.toggleActive]}>
              <Text style={[z.toggleIcon, hasEmp && { color: Colors.violet3 }]}>+</Text>
              <Text style={[z.toggleTitle, hasEmp && { color: Colors.ink }]}>Sim, tenho</Text>
              <Text style={z.toggleSub}>Funcionários registrados</Text>
            </Pressable>
          </View>
          {hasEmp && <View style={{ marginTop: 16, gap: 6 }}><Text style={z.fieldLabel}>Quantos funcionários?</Text><TextInput style={inp as any} value={empCount} onChangeText={setEmpCount} keyboardType="number-pad" placeholder="1" placeholderTextColor={Colors.ink3} /></View>}
          {hasEmp && <View style={z.oblPreview}><Text style={z.oblPreviewTitle}>Com funcionarios, a Aura vai gerenciar:</Text><View style={z.oblList}><View style={z.oblItem}><View style={[z.oblDot,{backgroundColor:Colors.green}]} /><Text style={z.oblText}>FGTS mensal (Aura resolve)</Text></View><View style={z.oblItem}><View style={[z.oblDot,{backgroundColor:Colors.amber}]} /><Text style={z.oblText}>eSocial (Aura facilita, você resolve)</Text></View></View></View>}
          <View style={z.navRow}>
            <Pressable onPress={() => setStep(2)} style={z.backBtn}><Text style={z.backText}>Voltar</Text></Pressable>
            <Pressable onPress={() => setStep(4)} style={z.primaryBtn}><Text style={z.primaryBtnText}>Continuar</Text></Pressable>
          </View>
        </SC>
      )}

      {step === 4 && (
        <SC>
          <ConfettiEffect />
          {logo ? <Image source={{ uri: logo }} style={z.doneLogo} resizeMode="contain" /> : <View style={z.doneCircle}><Text style={z.doneCheck}>OK</Text></View>}
          <Text style={z.title}>Tudo pronto!</Text>
          <Text style={z.sub}>Sua empresa está configurada. A Aura ja organizou suas obrigações contábeis e está pronta pra você usar.</Text>
          <View style={z.summaryCard}>
            <Text style={z.summaryTitle}>Resumo</Text>
            <View style={z.summaryRow}><Text style={z.summaryLabel}>Empresa</Text><Text style={z.summaryValue}>{cnpjData?.razaoSocial || company?.name || "---"}</Text></View>
            {cnpj ? <View style={z.summaryRow}><Text style={z.summaryLabel}>CNPJ</Text><Text style={z.summaryValue}>{cnpj}</Text></View> : null}
            <View style={z.summaryRow}><Text style={z.summaryLabel}>Regime</Text><Text style={z.summaryValue}>{cnpjData?.regime || "MEI"}</Text></View>
            <View style={z.summaryRow}><Text style={z.summaryLabel}>Tipo</Text><Text style={z.summaryValue}>{CNAE_PROFILES[bizType]?.label || bizType}</Text></View>
            <View style={z.summaryRow}><Text style={z.summaryLabel}>Funcionarios</Text><Text style={z.summaryValue}>{hasEmp ? empCount : "Nenhum"}</Text></View>
            <View style={z.summaryRow}><Text style={z.summaryLabel}>Logo</Text><Text style={z.summaryValue}>{logo ? "Enviada" : "Não enviada"}</Text></View>
          </View>
          <View style={z.oblPreview}><Text style={z.oblPreviewTitle}>Obrigações configuradas:</Text><View style={z.oblList}>
            {(CNAE_PROFILES[hasEmp ? bizType.replace(/_salao$/,"_salao_func").replace(/mei_(comercio|servicos)$/,"mei_com_funcionario") : bizType]?.obligations || CNAE_PROFILES[bizType]?.obligations || []).slice(0, 6).map(o => (
              <View key={o} style={z.oblItem}><View style={[z.oblDot,{backgroundColor:Colors.violet3}]} /><Text style={z.oblText}>{o.replace(/_/g, " ").replace(/^\w/,c=>c.toUpperCase())}</Text></View>
            ))}
          </View></View>
          <Pressable onPress={finish} style={[z.primaryBtn, { backgroundColor: Colors.green }]}><Text style={z.primaryBtnText}>Ir para o painel</Text></Pressable>
        </SC>
      )}
    </ScrollView>
  );
}

const z = StyleSheet.create({
  scr: { flex: 1 },
  cnt: { padding: IS_WIDE ? 40 : 20, paddingBottom: 48, justifyContent: "center", minHeight: "100%" as any },
  emoji: { fontSize: 40, textAlign: "center", marginBottom: 16, color: Colors.violet3 },
  title: { fontSize: 24, color: Colors.ink, fontWeight: "800", textAlign: "center", marginBottom: 8 },
  sub: { fontSize: 14, color: Colors.ink3, textAlign: "center", lineHeight: 22, marginBottom: 24 },
  stepTitle: { fontSize: 20, color: Colors.ink, fontWeight: "700", marginBottom: 6 },
  stepSub: { fontSize: 13, color: Colors.ink3, lineHeight: 20, marginBottom: 16 },
  fieldLabel: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
  features: { gap: 10, marginBottom: 28 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  featureDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.violet },
  featureText: { fontSize: 14, color: Colors.ink, fontWeight: "500" },
  primaryBtn: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  skipBtn: { alignItems: "center", paddingVertical: 8 },
  skipText: { fontSize: 12, color: Colors.violet3, fontWeight: "500" },
  backBtn: { paddingVertical: 10 },
  backText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  navRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 16 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 16 },
  logoSection: { gap: 10, marginBottom: 8 },
  logoUpload: { borderWidth: 2, borderColor: Colors.border, borderStyle: "dashed" as any, borderRadius: 16, overflow: "hidden", alignItems: "center", justifyContent: "center", minHeight: 140 },
  logoPreview: { width: "100%", height: 140 },
  logoPlaceholder: { alignItems: "center", gap: 8, padding: 24 },
  logoPlaceholderText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  logoPlaceholderHint: { fontSize: 11, color: Colors.ink3 },
  logoRemove: { alignSelf: "center", paddingVertical: 4 },
  logoRemoveText: { fontSize: 12, color: Colors.red, fontWeight: "500" },
  detectedCard: { backgroundColor: Colors.greenD, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: Colors.green + "33" },
  detectedLabel: { fontSize: 10, color: Colors.green, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  detectedValue: { fontSize: 15, color: Colors.ink, fontWeight: "700", marginBottom: 2 },
  detectedMeta: { fontSize: 11, color: Colors.ink3 },
  typesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  typeCard: { width: IS_WIDE ? "31%" : "47%", backgroundColor: Colors.bg4, borderRadius: 12, padding: 14, borderWidth: 1.5, borderColor: Colors.border, alignItems: "center", gap: 8 },
  typeCardActive: { borderColor: Colors.violet, backgroundColor: Colors.violetD },
  typeIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.bg3, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border },
  typeIconActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  typeIconText: { fontSize: 16, fontWeight: "700", color: Colors.ink3 },
  typeLabel: { fontSize: 12, color: Colors.ink3, fontWeight: "500", textAlign: "center" },
  typeLabelActive: { color: Colors.violet3, fontWeight: "600" },
  toggleRow: { flexDirection: "row", gap: 12, marginTop: 16 },
  toggleCard: { flex: 1, backgroundColor: Colors.bg4, borderRadius: 14, padding: 20, borderWidth: 1.5, borderColor: Colors.border, alignItems: "center", gap: 6 },
  toggleActive: { borderColor: Colors.violet, backgroundColor: Colors.violetD },
  toggleIcon: { fontSize: 28, fontWeight: "800", color: Colors.ink3 },
  toggleTitle: { fontSize: 14, color: Colors.ink3, fontWeight: "600" },
  toggleSub: { fontSize: 11, color: Colors.ink3, textAlign: "center" },
  oblPreview: { backgroundColor: Colors.bg4, borderRadius: 12, padding: 14, marginTop: 16, borderWidth: 1, borderColor: Colors.border },
  oblPreviewTitle: { fontSize: 12, color: Colors.ink3, fontWeight: "600", marginBottom: 10 },
  oblList: { gap: 6 },
  oblItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  oblDot: { width: 6, height: 6, borderRadius: 3 },
  oblText: { fontSize: 12, color: Colors.ink, fontWeight: "500" },
  doneCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.greenD, alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 16, borderWidth: 2, borderColor: Colors.green },
  doneCheck: { fontSize: 20, color: Colors.green, fontWeight: "800" },
  doneLogo: { width: 120, height: 60, alignSelf: "center", marginBottom: 16 },
  summaryCard: { backgroundColor: Colors.bg4, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  summaryTitle: { fontSize: 13, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  summaryLabel: { fontSize: 13, color: Colors.ink3 },
  summaryValue: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
});
