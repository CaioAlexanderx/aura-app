import { useState, useEffect } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Platform, Image, Linking, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { IS_WIDE } from "@/constants/helpers";
import { useAuthStore } from "@/stores/auth";
import { PageHeader } from "@/components/PageHeader";
import { ReferralCard } from "@/components/ReferralCard";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { router } from "expo-router";
import { maskPhone } from "@/utils/masks";
import { companiesApi } from "@/services/api";
import { MembersSection } from "@/components/MembersSection";

const PLANS = [
  { key: "essencial", label: "Essencial", price: "R$ 89/mes", desc: "Para comecar" },
  { key: "negocio",   label: "Negocio",   price: "R$ 199/mes", desc: "Para crescer" },
  { key: "expansao",  label: "Expansao",  price: "R$ 299/mes", desc: "Para escalar" },
];

const AURA_WHATSAPP = "https://wa.me/5512991234567";
const AURA_EMAIL    = "mailto:suporte@getaura.com.br";

function normalizeRegimeLabel(raw: string | null | undefined): string {
  const v = (raw || "").toLowerCase().trim();
  if (v === "mei") return "MEI (Microempreendedor Individual)";
  if (v === "simples" || v === "simples_nacional") return "Simples Nacional";
  if (v === "lucro_presumido") return "Lucro Presumido";
  if (v === "lucro_real") return "Lucro Real";
  return "Simples Nacional";
}

// CNPJ formatado para exibicao
function formatCNPJ(raw: string): string {
  const n = (raw || "").replace(/\D/g, "");
  if (n.length === 14) return n.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return raw || "";
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={sec.wrap}>
      <Text style={sec.title}>{title}</Text>
      <View style={sec.card}>{children}</View>
    </View>
  );
}
const sec = StyleSheet.create({
  wrap: { marginBottom: 24 },
  title: { fontSize: 14, color: Colors.ink, fontWeight: "700", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  card: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border },
});

function Field({ label, value, onChange, placeholder, editable = true }: {
  label: string; value: string; onChange?: (v: string) => void;
  placeholder?: string; editable?: boolean;
}) {
  return (
    <View style={fd.wrap}>
      <Text style={fd.label}>{label}</Text>
      <TextInput
        style={[fd.input, !editable && fd.disabled]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={Colors.ink3}
        editable={editable}
      />
    </View>
  );
}

// Campo somente leitura — sem TextInput, visual claro de bloqueado
function ReadOnlyField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={fd.wrap}>
      <Text style={fd.label}>{label}</Text>
      <View style={ro.row}>
        <Text style={ro.value}>{value || "Nao informado"}</Text>
        <Icon name="lock" size={13} color={Colors.ink3} />
      </View>
      {hint && <Text style={ro.hint}>{hint}</Text>}
    </View>
  );
}

const ro = StyleSheet.create({
  row:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12 },
  value: { fontSize: 14, color: Colors.ink3, fontWeight: "500", fontVariant: ["tabular-nums"] as any },
  hint:  { fontSize: 10, color: Colors.ink3, marginTop: 5, lineHeight: 14 },
});

const fd = StyleSheet.create({
  wrap:     { marginBottom: 14 },
  label:    { fontSize: 11, color: Colors.ink3, fontWeight: "600", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.3 },
  input:    { backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.ink },
  disabled: { opacity: 0.5 },
});

function ProfileCompletion({ name, cnpj, email, phone, address, logo }: any) {
  const fields = [
    { l: "Nome", ok: !!name }, { l: "CNPJ", ok: !!cnpj }, { l: "E-mail", ok: !!email },
    { l: "Telefone", ok: !!phone }, { l: "Endereco", ok: !!address }, { l: "Logo", ok: !!logo },
  ];
  const done = fields.filter(f => f.ok).length;
  const pct  = Math.round((done / fields.length) * 100);
  const allDone = pct === 100;
  return (
    <View style={{ backgroundColor: allDone ? Colors.greenD : Colors.violetD, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: allDone ? Colors.green + "33" : Colors.border2, marginBottom: 24 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Icon name={allDone ? "check" : "star"} size={16} color={allDone ? Colors.green : Colors.violet3} />
          <Text style={{ fontSize: 14, color: Colors.ink, fontWeight: "700" }}>{allDone ? "Perfil completo!" : "Complete seu perfil"}</Text>
        </View>
        <Text style={{ fontSize: 13, color: allDone ? Colors.green : Colors.violet3, fontWeight: "700" }}>{pct}%</Text>
      </View>
      <View style={{ height: 6, backgroundColor: Colors.bg4, borderRadius: 3, overflow: "hidden" }}>
        <View style={{ height: 6, width: pct + "%", backgroundColor: allDone ? Colors.green : Colors.violet, borderRadius: 3 }} />
      </View>
      {!allDone && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
          {fields.filter(f => !f.ok).map(f => (
            <View key={f.l} style={{ backgroundColor: Colors.bg4, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}>
              <Text style={{ fontSize: 10, color: Colors.ink3, fontWeight: "500" }}>Falta: {f.l}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default function ConfiguracoesScreen() {
  const { user, company, companyLogo, setCompanyLogo, isDemo } = useAuthStore();

  // Dados editaveis — populados apenas da API
  const [companyName, setCompanyName] = useState(company?.name || "");
  const [cnpj,        setCnpj]        = useState("");     // somente leitura, vem da API
  const [email,       setEmail]       = useState(user?.email || "");
  const [phone,       setPhone]       = useState("");
  const [address,     setAddress]     = useState("");
  const [taxRegime,   setTaxRegime]   = useState("");     // somente leitura, vem da API
  const [businessType, setBusinessType] = useState("");   // somente leitura

  const [profileLoading, setProfileLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved,  setSaved]    = useState(false);

  // Carrega dados reais da API — unica fonte de verdade
  useEffect(() => {
    if (!company?.id || isDemo) { setProfileLoading(false); return; }
    companiesApi.getProfile(company.id)
      .then((p: any) => {
        if (p.trade_name || p.legal_name) setCompanyName(p.trade_name || p.legal_name);
        if (p.cnpj)         setCnpj(p.cnpj);
        if (p.email)        setEmail(p.email);
        if (p.phone)        setPhone(p.phone);
        if (p.address)      setAddress(p.address);
        if (p.tax_regime)   setTaxRegime(p.tax_regime);
        if (p.business_type) setBusinessType(p.business_type);
      })
      .catch(() => toast.error("Nao foi possivel carregar o perfil"))
      .finally(() => setProfileLoading(false));
  }, [company?.id]);

  function handleLogoUpload() {
    if (Platform.OS !== "web") return;
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

  async function handleSave() {
    if (!company?.id || isDemo) { toast.success("Alteracoes salvas localmente"); return; }
    setSaving(true);
    try {
      await companiesApi.updateProfile(company.id, {
        trade_name: companyName,
        email,
        phone,
        address,
        // cnpj e tax_regime NAO enviados — somente leitura
      });
      toast.success("Perfil salvo com sucesso");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar perfil");
    } finally { setSaving(false); }
  }

  const currentPlan = company?.plan || "essencial";
  const currentPlanData = PLANS.find(p => p.key === currentPlan) || PLANS[0];

  return (
    <ScrollView style={z.scr} contentContainerStyle={z.cnt}>
      <PageHeader title="Configuracoes" />

      <ProfileCompletion name={companyName} cnpj={cnpj} email={email} phone={phone} address={address} logo={companyLogo || ""} />

      {/* Logo */}
      <Section title="Logo da empresa">
        <View style={z.logoRow}>
          <Pressable onPress={handleLogoUpload} style={z.logoUpload}>
            {companyLogo
              ? <Image source={{ uri: companyLogo }} style={z.logoImg} resizeMode="contain" />
              : <View style={z.logoPlaceholder}><Icon name="user_plus" size={24} color={Colors.ink3} /><Text style={z.logoPlaceholderText}>Enviar logo</Text></View>
            }
          </Pressable>
          <View style={z.logoInfo}>
            <Text style={z.logoHint}>PNG, JPG ou WebP. Max 2MB.</Text>
            <Text style={z.logoHint}>Usada no dashboard, sidebar e holerite.</Text>
            {companyLogo && (
              <Pressable onPress={() => { setCompanyLogo(""); toast.info("Logo removida"); }} style={z.logoRemove}>
                <Text style={z.logoRemoveText}>Remover logo</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Section>

      {/* Dados da empresa */}
      <Section title="Dados da empresa">
        {profileLoading ? (
          <View style={{ alignItems: "center", paddingVertical: 24, gap: 8 }}>
            <ActivityIndicator color={Colors.violet3} />
            <Text style={{ fontSize: 12, color: Colors.ink3 }}>Carregando dados...</Text>
          </View>
        ) : (
          <>
            {/* CNPJ: somente leitura — registrado no cadastro */}
            <ReadOnlyField
              label="CNPJ"
              value={formatCNPJ(cnpj)}
              hint="Registrado durante o cadastro. Para alterar, entre em contato com o suporte."
            />

            <Field label="Nome da empresa"  value={companyName} onChange={setCompanyName} placeholder="Minha Empresa Ltda" />
            <Field label="E-mail"           value={email}       onChange={setEmail}       placeholder="contato@empresa.com" />
            <Field label="Telefone"         value={phone}       onChange={v => setPhone(maskPhone(v))} placeholder="(12) 99999-0000" />
            <Field label="Endereco"         value={address}     onChange={setAddress}     placeholder="Rua, numero, cidade - UF" />
          </>
        )}
      </Section>

      {/* Configuracao fiscal: somente leitura */}
      <Section title="Configuracao fiscal">
        <ReadOnlyField
          label="Regime tributario"
          value={normalizeRegimeLabel(taxRegime)}
          hint="Detectado via CNPJ no cadastro."
        />
        {businessType ? (
          <ReadOnlyField label="Tipo de negocio" value={businessType} />
        ) : null}
        <View style={z.fiscalNote}>
          <Icon name="alert" size={14} color={Colors.amber} />
          <Text style={z.fiscalNoteText}>
            Para alterar regime tributario ou tipo de negocio, entre em contato com o suporte da Aura.
          </Text>
        </View>
      </Section>

      {/* Plano */}
      <Section title="Meu plano">
        <View style={z.currentPlanCard}>
          <View style={z.currentPlanInfo}>
            <View style={z.currentPlanBadge}><Text style={z.currentPlanBadgeText}>Plano atual</Text></View>
            <Text style={z.currentPlanName}>{currentPlanData.label}</Text>
            <Text style={z.currentPlanPrice}>{currentPlanData.price}</Text>
            <Text style={z.currentPlanDesc}>{currentPlanData.desc}</Text>
          </View>
          <Pressable onPress={() => router.push("/(tabs)/planos")} style={z.plansBtn}>
            <Text style={z.plansBtnText}>Ver todos os planos e precos</Text>
          </Pressable>
        </View>
      </Section>

      {/* Equipe */}
      <View style={{ marginBottom: 24 }}>
        <Text style={sec.title}>Equipe</Text>
        <MembersSection />
      </View>

      {/* Conta */}
      <Section title="Conta">
        <ReadOnlyField label="Nome" value={user?.name || ""} />
        <ReadOnlyField label="E-mail de acesso" value={user?.email || ""} />
        <View style={z.accountNote}>
          <Icon name="alert" size={14} color={Colors.violet3} />
          <Text style={z.accountNoteText}>Para alterar nome ou e-mail de acesso, entre em contato com o suporte.</Text>
        </View>
      </Section>

      {/* Suporte */}
      <Section title="Precisa de ajuda?">
        <View style={z.ctaRow}>
          <Pressable onPress={() => Linking.openURL(AURA_WHATSAPP)} style={z.ctaBtn}>
            <Icon name="message" size={16} color={Colors.green} />
            <Text style={z.ctaBtnText}>Falar no WhatsApp</Text>
          </Pressable>
          <Pressable onPress={() => Linking.openURL(AURA_EMAIL)} style={[z.ctaBtn, { borderColor: Colors.border2, backgroundColor: Colors.violetD }]}>
            <Icon name="globe" size={16} color={Colors.violet3} />
            <Text style={[z.ctaBtnText, { color: Colors.violet3 }]}>Enviar e-mail</Text>
          </Pressable>
        </View>
      </Section>

      {/* Botao salvar (apenas campos editaveis) */}
      <View style={z.saveRow}>
        <Pressable onPress={handleSave} disabled={saving || profileLoading} style={[z.saveBtn, saved && z.saveBtnDone, (saving || profileLoading) && { opacity: 0.6 }]}>
          {saving
            ? <Text style={z.saveBtnText}>Salvando...</Text>
            : saved
              ? <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><Icon name="check" size={16} color="#fff" /><Text style={z.saveBtnText}>Salvo!</Text></View>
              : <Text style={z.saveBtnText}>Salvar alteracoes</Text>
          }
        </Pressable>
      </View>

      <ReferralCard />
      {isDemo && <View style={z.demo}><Text style={z.demoText}>Modo demonstrativo — alteracoes nao sao persistidas</Text></View>}
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
  saveBtn: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40 },
  saveBtnDone: { backgroundColor: Colors.green },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  demo: { alignSelf: "center", backgroundColor: Colors.violetD, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginTop: 20 },
  demoText: { fontSize: 11, color: Colors.violet3, fontWeight: "500" },
});
