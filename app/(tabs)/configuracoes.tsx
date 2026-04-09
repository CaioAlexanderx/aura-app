import { useState, useEffect } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Platform, Image, Linking } from "react-native";
import { Colors } from "@/constants/colors";
import { IS_WIDE } from "@/constants/helpers";
import { useAuthStore } from "@/stores/auth";
import { PageHeader } from "@/components/PageHeader";
import { HoverCard } from "@/components/HoverCard";
import { ReferralCard } from "@/components/ReferralCard";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { CNAE_PROFILES } from "@/constants/obligations";
import { router } from "expo-router";
import { maskCNPJ, maskPhone } from "@/utils/masks";
import { companiesApi } from "@/services/api";

const PLANS = [
  { key: "essencial", label: "Essencial", price: "R$ 89/mes", desc: "Para comecar" },
  { key: "negocio", label: "Negocio", price: "R$ 199/mes", desc: "Para crescer" },
  { key: "expansao", label: "Expansao", price: "R$ 299/mes", desc: "Para escalar" },
];

const CONFIG_KEY = "aura_config";
const AURA_WHATSAPP = "https://wa.me/5512991234567";
const AURA_EMAIL = "mailto:suporte@getaura.com.br";

function loadConfig(): Record<string, string> {
  try { const s = typeof localStorage !== "undefined" ? localStorage.getItem(CONFIG_KEY) : null; return s ? JSON.parse(s) : {}; } catch { return {}; }
}
function saveConfig(data: Record<string, string>) {
  try { if (typeof localStorage !== "undefined") localStorage.setItem(CONFIG_KEY, JSON.stringify(data)); } catch {}
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={sec.wrap}><Text style={sec.title}>{title}</Text><View style={sec.card}>{children}</View></View>;
}
const sec = StyleSheet.create({
  wrap: { marginBottom: 24 },
  title: { fontSize: 14, color: Colors.ink, fontWeight: "700", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  card: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border },
});

function Field({ label, value, onChange, placeholder, editable = true }: {
  label: string; value: string; onChange?: (v: string) => void; placeholder?: string; editable?: boolean;
}) {
  return (
    <View style={fd.wrap}>
      <Text style={fd.label}>{label}</Text>
      <TextInput style={[fd.input, !editable && fd.disabled] as any} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={Colors.ink3} editable={editable} />
    </View>
  );
}
const fd = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { fontSize: 11, color: Colors.ink3, fontWeight: "600", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.3 },
  input: { backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.ink },
  disabled: { opacity: 0.5 },
});

function ProfileCompletion({ name, cnpj, email, phone, address, logo }: any) {
  const fields = [{l:"Nome",ok:!!name},{l:"CNPJ",ok:!!cnpj},{l:"E-mail",ok:!!email},{l:"Telefone",ok:!!phone},{l:"Endereco",ok:!!address},{l:"Logo",ok:!!logo}];
  const done = fields.filter(f => f.ok).length;
  const pct = Math.round((done/fields.length)*100);
  const allDone = pct===100;
  return (
    <View style={{backgroundColor:allDone?Colors.greenD:Colors.violetD,borderRadius:16,padding:20,borderWidth:1,borderColor:allDone?Colors.green+"33":Colors.border2,marginBottom:24}}>
      <View style={{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <View style={{flexDirection:"row",alignItems:"center",gap:8}}><Icon name={allDone?"check":"star"} size={16} color={allDone?Colors.green:Colors.violet3} /><Text style={{fontSize:14,color:Colors.ink,fontWeight:"700"}}>{allDone?"Perfil completo!":"Complete seu perfil"}</Text></View>
        <Text style={{fontSize:13,color:allDone?Colors.green:Colors.violet3,fontWeight:"700"}}>{pct}%</Text>
      </View>
      <View style={{height:6,backgroundColor:Colors.bg4,borderRadius:3,overflow:"hidden"}}><View style={{height:6,width:pct+"%",backgroundColor:allDone?Colors.green:Colors.violet,borderRadius:3}} /></View>
      {!allDone && <View style={{flexDirection:"row",flexWrap:"wrap",gap:6,marginTop:12}}>{fields.filter(f => !f.ok).map(f => <View key={f.l} style={{backgroundColor:Colors.bg4,borderRadius:6,paddingHorizontal:8,paddingVertical:4}}><Text style={{fontSize:10,color:Colors.ink3,fontWeight:"500"}}>Falta: {f.l}</Text></View>)}</View>}
    </View>
  );
}

export default function ConfiguracoesScreen() {
  const { user, company, companyLogo, setCompanyLogo, isDemo } = useAuthStore();

  const cached = loadConfig();
  const [companyName, setCompanyName] = useState(cached.companyName || company?.name || "");
  const [cnpj, setCnpj] = useState(cached.cnpj || (company as any)?.cnpj || "");
  const [email, setEmail] = useState(cached.email || user?.email || "");
  const [phone, setPhone] = useState(cached.phone || "");
  const [address, setAddress] = useState(cached.address || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // INT-COMPANY-02: Hydrate from backend on mount
  useEffect(() => {
    if (!company?.id || isDemo) return;
    companiesApi.getProfile(company.id).then((p: any) => {
      if (p.trade_name) setCompanyName(p.trade_name);
      if (p.cnpj) setCnpj(p.cnpj);
      if (p.email) setEmail(p.email);
      if (p.phone) setPhone(p.phone);
      if (p.address) setAddress(p.address);
    }).catch(() => {});
  }, [company?.id]);

  useEffect(() => {
    saveConfig({ companyName, cnpj, email, phone, address });
  }, [companyName, cnpj, email, phone, address]);

  function handleLogoUpload() {
    if (Platform.OS === "web") {
      const input = document.createElement("input");
      input.type = "file"; input.accept = "image/png,image/jpeg,image/webp";
      input.onchange = (e: any) => {
        const file = e.target?.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) { toast.error("Arquivo muito grande - max 2MB"); return; }
        const reader = new FileReader();
        reader.onload = () => { setCompanyLogo(reader.result as string); toast.success("Logo atualizada"); };
        reader.readAsDataURL(file);
      };
      input.click();
    }
  }

  // INT-COMPANY-01: Save to backend + localStorage
  async function handleSave() {
    saveConfig({ companyName, cnpj, email, phone, address });

    if (company?.id && !isDemo) {
      setSaving(true);
      try {
        await companiesApi.updateProfile(company.id, {
          trade_name: companyName,
          cnpj, email, phone, address,
        });
        toast.success("Perfil salvo no servidor");
      } catch (err: any) {
        toast.error(err.message || "Erro ao salvar — salvo localmente");
      } finally {
        setSaving(false);
      }
    } else {
      toast.success("Alteracoes salvas localmente");
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const currentPlan = company?.plan || "essencial";
  const currentPlanData = PLANS.find(p => p.key === currentPlan) || PLANS[0];

  return (
    <ScrollView style={z.scr} contentContainerStyle={z.cnt}>
      <PageHeader title="Configuracoes" />
      <ProfileCompletion name={companyName} cnpj={cnpj} email={email} phone={phone} address={address} logo={companyLogo||""} />

      <Section title="Logo da empresa">
        <View style={z.logoRow}>
          <Pressable onPress={handleLogoUpload} style={z.logoUpload}>
            {companyLogo ? <Image source={{ uri: companyLogo }} style={z.logoImg} resizeMode="contain" /> : <View style={z.logoPlaceholder}><Icon name="user_plus" size={24} color={Colors.ink3} /><Text style={z.logoPlaceholderText}>Enviar logo</Text></View>}
          </Pressable>
          <View style={z.logoInfo}>
            <Text style={z.logoHint}>PNG, JPG ou WebP. Max 2MB.</Text>
            <Text style={z.logoHint}>Usada no dashboard, sidebar e holerite.</Text>
            {companyLogo && <Pressable onPress={() => { setCompanyLogo(""); toast.info("Logo removida"); }} style={z.logoRemove}><Text style={z.logoRemoveText}>Remover logo</Text></Pressable>}
          </View>
        </View>
      </Section>

      <Section title="Dados da empresa">
        <Field label="Nome da empresa" value={companyName} onChange={setCompanyName} placeholder="Minha Empresa Ltda" />
        <Field label="CNPJ" value={cnpj} onChange={v => setCnpj(maskCNPJ(v))} placeholder="00.000.000/0000-00" />
        <Field label="E-mail" value={email} onChange={setEmail} placeholder="contato@empresa.com" />
        <Field label="Telefone" value={phone} onChange={v => setPhone(maskPhone(v))} placeholder="(12) 99999-0000" />
        <Field label="Endereco" value={address} onChange={setAddress} placeholder="Rua, numero, cidade - UF" />
      </Section>

      <Section title="Configuracao fiscal">
        <Field label="Regime tributario" value={(company as any)?.regime || "Simples Nacional"} editable={false} />
        <Field label="Tipo de negocio" value={CNAE_PROFILES[(company as any)?.businessType]?.label || "Configurar no onboarding"} editable={false} />
        <View style={z.fiscalNote}><Icon name="alert" size={14} color={Colors.amber} /><Text style={z.fiscalNoteText}>Regime e tipo de negocio sao detectados automaticamente via CNPJ. Para alterar, entre em contato com o suporte.</Text></View>
      </Section>

      <Section title="Meu plano">
        <View style={z.currentPlanCard}>
          <View style={z.currentPlanInfo}>
            <View style={z.currentPlanBadge}><Text style={z.currentPlanBadgeText}>Plano atual</Text></View>
            <Text style={z.currentPlanName}>{currentPlanData.label}</Text>
            <Text style={z.currentPlanPrice}>{currentPlanData.price}</Text>
            <Text style={z.currentPlanDesc}>{currentPlanData.desc}</Text>
          </View>
          <Pressable onPress={() => router.push("/(tabs)/planos")} style={z.plansBtn}><Text style={z.plansBtnText}>Ver todos os planos e precos</Text></Pressable>
        </View>
      </Section>

      <Section title="Conta">
        <Field label="Nome" value={user?.name || ""} editable={false} />
        <Field label="E-mail de acesso" value={user?.email || ""} editable={false} />
        <View style={z.accountNote}><Icon name="alert" size={14} color={Colors.violet3} /><Text style={z.accountNoteText}>Para alterar nome ou e-mail de acesso, entre em contato com o suporte.</Text></View>
      </Section>

      {/* FE-CTA-01: Support CTAs */}
      <Section title="Precisa de ajuda?">
        <View style={z.ctaRow}>
          <Pressable onPress={() => Linking.openURL(AURA_WHATSAPP)} style={z.ctaBtn}><Icon name="message" size={16} color={Colors.green} /><Text style={z.ctaBtnText}>Falar no WhatsApp</Text></Pressable>
          <Pressable onPress={() => Linking.openURL(AURA_EMAIL)} style={[z.ctaBtn, { borderColor: Colors.border2 }]}><Icon name="globe" size={16} color={Colors.violet3} /><Text style={[z.ctaBtnText, { color: Colors.violet3 }]}>Enviar e-mail</Text></Pressable>
        </View>
      </Section>

      <View style={z.saveRow}>
        <Pressable onPress={handleSave} disabled={saving} style={[z.saveBtn, saved && z.saveBtnDone, saving && { opacity: 0.6 }]}>
          {saving ? <Text style={z.saveBtnText}>Salvando...</Text> : saved ? <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><Icon name="check" size={16} color="#fff" /><Text style={z.saveBtnText}>Salvo!</Text></View> : <Text style={z.saveBtnText}>Salvar alteracoes</Text>}
        </Pressable>
      </View>

      <ReferralCard />
      {isDemo && <View style={z.demo}><Text style={z.demoText}>Modo demonstrativo - alteracoes nao sao persistidas</Text></View>}
    </ScrollView>
  );
}

const z = StyleSheet.create({
  scr: { flex: 1 },
  cnt: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 720, alignSelf: "center", width: "100%" },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 20 },
  logoUpload: { width: 100, height: 100, borderRadius: 16, borderWidth: 2, borderColor: Colors.border, borderStyle: "dashed" as any, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg4 },
  logoImg: { width: 100, height: 100 },
  logoPlaceholder: { alignItems: "center", gap: 6 },
  logoPlaceholderText: { fontSize: 10, color: Colors.ink3, fontWeight: "500" },
  logoInfo: { flex: 1, gap: 4 },
  logoHint: { fontSize: 11, color: Colors.ink3 },
  logoRemove: { marginTop: 4 },
  logoRemoveText: { fontSize: 11, color: Colors.red, fontWeight: "500" },
  fiscalNote: { flexDirection: "row", gap: 8, backgroundColor: Colors.amberD, borderRadius: 10, padding: 12, marginTop: 4 },
  fiscalNoteText: { fontSize: 11, color: Colors.amber, flex: 1, lineHeight: 16 },
  currentPlanCard: { gap: 16 },
  currentPlanInfo: { gap: 4 },
  currentPlanBadge: { backgroundColor: Colors.violet, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start", marginBottom: 4 },
  currentPlanBadgeText: { fontSize: 9, color: "#fff", fontWeight: "700" },
  currentPlanName: { fontSize: 20, fontWeight: "800", color: Colors.ink },
  currentPlanPrice: { fontSize: 14, color: Colors.violet3, fontWeight: "600" },
  currentPlanDesc: { fontSize: 12, color: Colors.ink3 },
  plansBtn: { backgroundColor: Colors.violetD, borderRadius: 12, paddingVertical: 13, alignItems: "center", borderWidth: 1, borderColor: Colors.border2 },
  plansBtnText: { fontSize: 13, color: Colors.violet3, fontWeight: "700" },
  accountNote: { flexDirection: "row", gap: 8, backgroundColor: Colors.violetD, borderRadius: 10, padding: 12, marginTop: 4, borderWidth: 1, borderColor: Colors.border2 },
  accountNoteText: { fontSize: 11, color: Colors.violet3, flex: 1, lineHeight: 16 },
  ctaRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  ctaBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.greenD, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 18, borderWidth: 1, borderColor: Colors.green + "33" },
  ctaBtnText: { fontSize: 13, color: Colors.green, fontWeight: "600" },
  saveRow: { alignItems: "center", marginTop: 8 },
  saveBtn: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40, alignItems: "center" },
  saveBtnDone: { backgroundColor: Colors.green },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  demo: { alignSelf: "center", backgroundColor: Colors.violetD, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginTop: 20 },
  demoText: { fontSize: 11, color: Colors.violet3, fontWeight: "500" },
});
