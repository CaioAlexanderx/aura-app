import { useState, useEffect } from "react";
import {
  View, Text, ScrollView, StyleSheet, Pressable, TextInput,
  Platform, Image, Linking, ActivityIndicator, Dimensions,
} from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { router } from "expo-router";
import { maskPhone, maskCNPJ } from "@/utils/masks";
import { companiesApi, onboardingApi } from "@/services/api";
import { MembersSection } from "@/components/MembersSection";
import { ReferralCard } from "@/components/ReferralCard";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";

const IS_WIDE = (typeof window !== "undefined" ? window.innerWidth : Dimensions.get("window").width) > 600;

const AURA_WHATSAPP = "https://wa.me/5512991234567";
const AURA_EMAIL    = "contato@getaura.com.br";

const PLANS: Record<string, { label: string; price: string }> = {
  essencial:     { label: "Essencial",     price: "R$ 89/mes"       },
  negocio:       { label: "Negocio",       price: "R$ 199/mes"      },
  expansao:      { label: "Expansao",      price: "R$ 299/mes"      },
  personalizado: { label: "Personalizado", price: "Sob consulta"    },
};

function regimeLabel(raw: string): string {
  const v = (raw || "").toLowerCase();
  if (v === "mei") return "MEI";
  if (v === "simples" || v === "simples_nacional") return "Simples Nacional";
  if (v === "lucro_presumido") return "Lucro Presumido";
  if (v === "lucro_real") return "Lucro Real";
  return "Simples Nacional";
}

function fmtCNPJ(raw: string): string {
  const n = (raw || "").replace(/\D/g, "");
  if (n.length === 14) return n.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (n.length === 11) return n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return raw || "";
}

function validateEmail(v: string): string | null {
  if (!v.trim()) return "E-mail e obrigatorio";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())) return "Formato invalido (ex: nome@empresa.com)";
  return null;
}
function validatePhone(v: string): string | null {
  if (!v.trim()) return null;
  const nums = v.replace(/\D/g, "");
  if (nums.length < 10 || nums.length > 11) return "Telefone invalido (ex: (12) 99999-0000)";
  return null;
}

// BUGFIX #3: safe mailto handler for web
function openEmail() {
  const mailto = "mailto:" + AURA_EMAIL;
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.location.href = mailto;
  } else {
    Linking.openURL(mailto);
  }
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={s.sectionTitle}>{title}</Text>;
}
function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[s.card, style]}>{children}</View>;
}
function EditField({ label, value, onChange, placeholder, keyboardType, error, hint, autoCapitalize, multiline }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; keyboardType?: any; error?: string | null;
  hint?: string; autoCapitalize?: any; multiline?: boolean;
}) {
  return (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={[s.input, error ? s.inputError : null, multiline && s.textarea]}
        value={value} onChangeText={onChange} placeholder={placeholder}
        placeholderTextColor={Colors.ink3} keyboardType={keyboardType}
        autoCapitalize={autoCapitalize || "sentences"} multiline={multiline}
        numberOfLines={multiline ? 2 : 1}
      />
      {error && <Text style={s.fieldError}>{error}</Text>}
      {hint && !error && <Text style={s.fieldHint}>{hint}</Text>}
    </View>
  );
}
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>{value || "\u2014"}</Text>
    </View>
  );
}

export default function ConfiguracoesScreen() {
  const { user, company, companyLogo, setCompanyLogo, isDemo } = useAuthStore();

  const [companyName, setCompanyName] = useState(company?.name || "");
  const [address,     setAddress]     = useState("");
  const [email,       setEmail]       = useState(user?.email || "");
  const [phone,       setPhone]       = useState("");
  const [cnpj,        setCnpj]        = useState("");
  const [taxRegime,   setTaxRegime]   = useState("");
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [savedOk,     setSavedOk]     = useState(false);

  const [cnpjInput,   setCnpjInput]   = useState("");
  const [cnpjSaving,  setCnpjSaving]  = useState(false);
  const cnpjInputNums = cnpjInput.replace(/\D/g, "");
  const cnpjInputValid = cnpjInputNums.length === 14;

  const emailError = email ? validateEmail(email) : null;
  const phoneError = phone ? validatePhone(phone) : null;
  const hasErrors  = !!(emailError || phoneError);

  const profileFields = [
    { label: "Nome",     ok: !!companyName },
    { label: "CNPJ",     ok: !!cnpj },
    { label: "E-mail",   ok: !!email && !emailError },
    { label: "Telefone", ok: !!phone && !phoneError },
    { label: "Endereco", ok: !!address },
    { label: "Logo",     ok: !!companyLogo },
  ];
  const completeDone = profileFields.filter(f => f.ok).length;
  const completePct  = Math.round((completeDone / profileFields.length) * 100);
  const missing      = profileFields.filter(f => !f.ok).map(f => f.label);

  useEffect(() => {
    if (!company?.id || isDemo) { setLoading(false); return; }
    companiesApi.getProfile(company.id)
      .then((p: any) => {
        if (p.trade_name || p.legal_name) setCompanyName(p.trade_name || p.legal_name);
        if (p.cnpj)       setCnpj(p.cnpj);
        if (p.email)      setEmail(p.email);
        if (p.phone)      setPhone(p.phone);
        if (p.address)    setAddress(p.address);
        if (p.tax_regime) setTaxRegime(p.tax_regime);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [company?.id]);

  function handleLogoUpload() {
    if (Platform.OS !== "web") return;
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/png,image/jpeg,image/webp";
    input.onchange = (e: any) => {
      const file = e.target?.files?.[0]; if (!file) return;
      if (file.size > 2 * 1024 * 1024) { toast.error("Max 2MB"); return; }
      const reader = new FileReader();
      reader.onload = () => { setCompanyLogo(reader.result as string); toast.success("Logo atualizada"); };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  async function handleSave() {
    if (hasErrors || !company?.id || isDemo) return;
    setSaving(true);
    try {
      await companiesApi.updateProfile(company.id, {
        trade_name: companyName.trim() || undefined,
        email:      email.trim()       || undefined,
        phone:      phone.trim()       || undefined,
        address:    address.trim()     || undefined,
      });
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2500);
      toast.success("Perfil atualizado");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar");
    } finally { setSaving(false); }
  }

  async function handleSaveCnpj() {
    if (!cnpjInputValid || !company?.id || isDemo) return;
    setCnpjSaving(true);
    try {
      await onboardingApi.stepCnpj(company.id, cnpjInputNums);
      setCnpj(cnpjInputNums);
      setCnpjInput("");
      toast.success("CNPJ salvo com sucesso!");
    } catch (err: any) {
      toast.error(err?.message || "CNPJ invalido ou nao encontrado na Receita Federal");
    } finally { setCnpjSaving(false); }
  }

  const plan    = company?.plan || "essencial";
  const planDat = PLANS[plan] || PLANS.essencial;

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>

      {/* HERO */}
      <View style={s.hero}>
        <Pressable onPress={handleLogoUpload} style={s.avatar}>
          {companyLogo
            ? <Image source={{ uri: companyLogo }} style={s.avatarImg} resizeMode="cover" />
            : <Text style={s.avatarInitial}>{(companyName || "E").charAt(0).toUpperCase()}</Text>}
          {Platform.OS === "web" && (
            <View style={s.avatarOverlay}><Icon name="upload" size={14} color="#fff" /></View>
          )}
        </Pressable>

        <View style={s.heroInfo}>
          <Text style={s.heroName} numberOfLines={1}>{companyName || "Minha Empresa"}</Text>
          {cnpj
            ? <Text style={s.heroSub}>{fmtCNPJ(cnpj)}{taxRegime ? " \u00b7 " + regimeLabel(taxRegime) : ""}</Text>
            : <Text style={[s.heroSub, { color: Colors.amber }]}>CNPJ nao informado</Text>}
          <View style={s.progressRow}>
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { width: completePct + "%" as any }]} />
            </View>
            <Text style={s.progressLabel}>{completePct}%</Text>
          </View>
          {missing.length > 0 && <Text style={s.progressMissing}>Faltam: {missing.join(", ")}</Text>}
        </View>

        {companyLogo && (
          <Pressable onPress={() => { setCompanyLogo(""); toast.info("Logo removida"); }} style={s.heroAction}>
            <Icon name="x" size={14} color={Colors.red} />
          </Pressable>
        )}
      </View>

      {loading && (
        <View style={s.loadingBox}>
          <ActivityIndicator color={Colors.violet3} />
          <Text style={s.loadingText}>Carregando perfil...</Text>
        </View>
      )}

      {!loading && (
        <>
          {/* IDENTIDADE */}
          <SectionTitle title="Identidade" />
          <Card>
            <EditField label="Nome da empresa" value={companyName} onChange={setCompanyName} placeholder="Ex: Barbearia do Caio" />
            <View style={s.fieldDivider} />
            <EditField label="Endereco" value={address} onChange={setAddress} placeholder="Rua, numero, cidade \u2014 UF" multiline />
          </Card>

          {/* CONTATO */}
          <SectionTitle title="Contato" />
          <Card>
            <EditField
              label="E-mail da empresa" value={email} onChange={setEmail}
              placeholder="contato@empresa.com" keyboardType="email-address" autoCapitalize="none"
              error={email ? emailError : null}
              hint={!emailError ? "Usado para comunicacoes e notas fiscais" : undefined}
            />
            <View style={s.fieldDivider} />
            <EditField
              label="Telefone" value={phone} onChange={(v) => setPhone(maskPhone(v))}
              placeholder="(12) 99999-0000" keyboardType="phone-pad"
              error={phone ? phoneError : null}
              hint={!phoneError ? "Aparece na vitrine e no canal digital" : undefined}
            />
            {!hasErrors && (
              <View style={s.contactNote}>
                <Icon name="info" size={13} color={Colors.ink3} />
                <Text style={s.contactNoteText}>Alteracoes entram em vigor apos salvar.</Text>
              </View>
            )}
          </Card>

          {/* DADOS REGISTRAIS */}
          <SectionTitle title="Dados registrais" />
          <Card style={cnpj ? s.registraisCard : undefined}>

            {cnpj ? (
              <>
                <View style={s.registraisRow}>
                  <View style={s.registraisItem}>
                    <Text style={s.registraisItemLabel}>CNPJ</Text>
                    <Text style={s.registraisItemValue}>{fmtCNPJ(cnpj)}</Text>
                  </View>
                  <View style={s.registraisDivider} />
                  <View style={s.registraisItem}>
                    <Text style={s.registraisItemLabel}>Regime</Text>
                    <Text style={s.registraisItemValue}>{regimeLabel(taxRegime)}</Text>
                  </View>
                  <Icon name="lock" size={14} color={Colors.ink3} />
                </View>
                <View style={s.registraisNote}>
                  <Text style={s.registraisNoteText}>
                    Para alterar CNPJ ou regime, entre em contato com o suporte da Aura.
                  </Text>
                </View>
              </>
            ) : (
              <View style={s.cnpjEditWrap}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
                  <Icon name="alert" size={14} color={Colors.amber} />
                  <Text style={{ fontSize: 12, color: Colors.amber, fontWeight: "600" }}>CNPJ nao informado</Text>
                </View>
                <Text style={s.fieldLabel}>Informe seu CNPJ</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TextInput
                    style={[s.input, { flex: 1 }, cnpjInput && !cnpjInputValid && s.inputError]}
                    value={cnpjInput}
                    onChangeText={v => setCnpjInput(maskCNPJ(v))}
                    placeholder="00.000.000/0001-00"
                    placeholderTextColor={Colors.ink3}
                    keyboardType="number-pad"
                    maxLength={18}
                  />
                  <Pressable
                    onPress={handleSaveCnpj}
                    disabled={!cnpjInputValid || cnpjSaving}
                    style={[s.cnpjSaveBtn, (!cnpjInputValid || cnpjSaving) && { opacity: 0.5 }]}
                  >
                    {cnpjSaving
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={s.cnpjSaveBtnText}>Salvar</Text>}
                  </Pressable>
                </View>
                {cnpjInput && !cnpjInputValid && (
                  <Text style={s.fieldError}>CNPJ deve ter 14 digitos</Text>
                )}
                <Text style={[s.fieldHint, { marginTop: 8 }]}>
                  O CNPJ e validado na Receita Federal. Contas novas ja exigem CNPJ no cadastro.
                </Text>
              </View>
            )}
          </Card>

          {/* PLANO ATUAL */}
          <SectionTitle title="Plano atual" />
          <Card>
            <View style={s.planRow}>
              <View style={s.planBadge}><Text style={s.planBadgeText}>{planDat.label}</Text></View>
              <Text style={s.planPrice}>{planDat.price}</Text>
              <Pressable onPress={() => router.push("/(tabs)/planos")} style={s.planBtn}>
                <Text style={s.planBtnText}>Ver planos</Text>
                <Icon name="chevron_right" size={14} color={Colors.violet3} />
              </Pressable>
            </View>
          </Card>

          {/* EQUIPE */}
          <SectionTitle title="Equipe" />
          <MembersSection />

          {/* MINHA CONTA */}
          <SectionTitle title="Minha conta" />
          <Card>
            <InfoRow label="Nome" value={user?.name || ""} />
            <View style={s.fieldDivider} />
            <InfoRow label="E-mail de acesso" value={user?.email || ""} />
            <View style={s.accountNote}>
              <Icon name="info" size={13} color={Colors.ink3} />
              <Text style={s.accountNoteText}>Para alterar nome ou e-mail de acesso, entre em contato com o suporte.</Text>
            </View>
          </Card>

          {/* SUPORTE — BUGFIX #3: window.location.href for mailto */}
          <SectionTitle title="Suporte" />
          <View style={s.supportRow}>
            <Pressable
              onPress={() => Linking.openURL(AURA_WHATSAPP)}
              style={s.supportBtn}
            >
              <Icon name="message" size={16} color={Colors.green} />
              <Text style={[s.supportBtnText, { color: Colors.green }]}>WhatsApp</Text>
            </Pressable>
            <Pressable
              onPress={openEmail}
              style={[s.supportBtn, s.supportBtnSecondary]}
            >
              <Icon name="mail" size={16} color={Colors.violet3} />
              <Text style={[s.supportBtnText, { color: Colors.violet3 }]}>E-mail</Text>
            </Pressable>
          </View>

          {/* SALVAR */}
          <View style={s.saveWrap}>
            {hasErrors && (
              <View style={s.errorBanner}>
                <Icon name="alert" size={14} color={Colors.red} />
                <Text style={s.errorBannerText}>Corrija os campos marcados antes de salvar.</Text>
              </View>
            )}
            <Pressable
              onPress={handleSave}
              disabled={hasErrors || saving}
              style={[s.saveBtn, savedOk && s.saveBtnOk, hasErrors && s.saveBtnDisabled]}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : savedOk ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Icon name="check" size={16} color="#fff" />
                  <Text style={s.saveBtnText}>Salvo com sucesso!</Text>
                </View>
              ) : (
                <Text style={s.saveBtnText}>{hasErrors ? "Corrija os erros acima" : "Salvar alteracoes"}</Text>
              )}
            </Pressable>
          </View>

          {/* INDICACAO */}
          <View style={{ marginTop: 20 }}>
            <ReferralCard />
          </View>

          {isDemo && (
            <View style={s.demoBanner}>
              <Text style={s.demoBannerText}>Modo demonstrativo - alteracoes nao sao persistidas</Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen:   { flex: 1 },
  content:  { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 680, alignSelf: "center", width: "100%" },
  hero:     { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: Colors.bg3, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 4 },
  avatar:   { width: 60, height: 60, borderRadius: 14, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2, overflow: "hidden", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  avatarImg:      { width: 60, height: 60 },
  avatarInitial:  { fontSize: 24, fontWeight: "700", color: Colors.violet3 },
  avatarOverlay:  { position: "absolute", bottom: 0, left: 0, right: 0, height: 20, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
  heroInfo:       { flex: 1, minWidth: 0 },
  heroName:       { fontSize: 16, fontWeight: "700", color: Colors.ink, marginBottom: 2 },
  heroSub:        { fontSize: 12, color: Colors.ink3, marginBottom: 8 },
  progressRow:    { flexDirection: "row", alignItems: "center", gap: 8 },
  progressTrack:  { flex: 1, height: 5, backgroundColor: Colors.bg4, borderRadius: 3, overflow: "hidden" },
  progressFill:   { height: 5, backgroundColor: Colors.violet, borderRadius: 3 },
  progressLabel:  { fontSize: 11, color: Colors.violet3, fontWeight: "600", minWidth: 28 },
  progressMissing:{ fontSize: 10, color: Colors.ink3, marginTop: 4 },
  heroAction:     { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.redD, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  loadingBox:     { alignItems: "center", paddingVertical: 40, gap: 10 },
  loadingText:    { fontSize: 12, color: Colors.ink3 },
  sectionTitle:   { fontSize: 11, fontWeight: "700", color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 24, marginBottom: 8 },
  card:           { backgroundColor: Colors.bg3, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, marginBottom: 4 },
  fieldWrap:      { marginBottom: 14 },
  fieldLabel:     { fontSize: 11, color: Colors.ink3, fontWeight: "600", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.3 },
  input:          { backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: Colors.ink },
  inputError:     { borderColor: Colors.red },
  textarea:       { minHeight: 60, textAlignVertical: "top" },
  fieldError:     { fontSize: 11, color: Colors.red, marginTop: 5 },
  fieldHint:      { fontSize: 11, color: Colors.ink3, marginTop: 5 },
  fieldDivider:   { height: 1, backgroundColor: Colors.border, marginBottom: 14 },
  contactNote:    { flexDirection: "row", gap: 8, alignItems: "flex-start", marginBottom: 8, marginTop: 2, paddingHorizontal: 2 },
  contactNoteText:{ fontSize: 11, color: Colors.ink3, flex: 1 },
  registraisCard: { paddingTop: 0, paddingBottom: 0 },
  registraisRow:  { flexDirection: "row", alignItems: "center", paddingVertical: 16, gap: 12 },
  registraisItem: { flex: 1 },
  registraisItemLabel: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  registraisItemValue: { fontSize: 14, color: Colors.ink3, fontWeight: "600" },
  registraisDivider:   { width: 1, height: 36, backgroundColor: Colors.border },
  registraisNote:      { borderTopWidth: 1, borderTopColor: Colors.border, paddingVertical: 10 },
  registraisNoteText:  { fontSize: 11, color: Colors.ink3 },
  cnpjEditWrap:   { paddingBottom: 8 },
  cnpjSaveBtn:    { backgroundColor: Colors.violet, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  cnpjSaveBtnText:{ fontSize: 13, color: "#fff", fontWeight: "700" },
  planRow:        { flexDirection: "row", alignItems: "center", gap: 10, paddingBottom: 8, flexWrap: "wrap" },
  planBadge:      { backgroundColor: Colors.violetD, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: Colors.border2 },
  planBadgeText:  { fontSize: 13, color: Colors.violet3, fontWeight: "700" },
  planPrice:      { fontSize: 14, color: Colors.ink, fontWeight: "600", flex: 1 },
  planBtn:        { flexDirection: "row", alignItems: "center", gap: 4 },
  planBtnText:    { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  infoRow:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 11 },
  infoLabel:      { fontSize: 13, color: Colors.ink3 },
  infoValue:      { fontSize: 13, color: Colors.ink, fontWeight: "500", textAlign: "right", flex: 1, marginLeft: 16 },
  accountNote:    { flexDirection: "row", gap: 8, alignItems: "flex-start", marginTop: 4, marginBottom: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  accountNoteText:{ fontSize: 11, color: Colors.ink3, flex: 1 },
  supportRow:     { flexDirection: "row", gap: 10, marginBottom: 4, flexWrap: "wrap" },
  supportBtn:     { flex: 1, minWidth: 120, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.greenD, borderRadius: 12, paddingVertical: 13, borderWidth: 1, borderColor: Colors.green + "33" },
  supportBtnSecondary: { backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  supportBtnText: { fontSize: 13, fontWeight: "600" },
  saveWrap:       { marginTop: 20, gap: 10 },
  errorBanner:    { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.redD, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.red + "33" },
  errorBannerText:{ fontSize: 12, color: Colors.red, flex: 1 },
  saveBtn:        { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  saveBtnOk:      { backgroundColor: Colors.green },
  saveBtnDisabled:{ backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border },
  saveBtnText:    { color: "#fff", fontSize: 15, fontWeight: "700" },
  demoBanner:     { alignSelf: "center", backgroundColor: Colors.violetD, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginTop: 20 },
  demoBannerText: { fontSize: 11, color: Colors.violet3, fontWeight: "500" },
});
