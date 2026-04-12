import { View, Text, ScrollView, StyleSheet, Pressable, Linking, Platform, ActivityIndicator, Dimensions } from "react-native";
import { Colors } from "@/constants/colors";
import { router } from "expo-router";
import { useAuthStore } from "@/stores/auth";
import { maskPhone } from "@/utils/masks";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { MembersSection } from "@/components/MembersSection";
import { ReferralCard } from "@/components/ReferralCard";
import { ProfileHero } from "@/components/screens/configuracoes/ProfileHero";
import { CnpjSection } from "@/components/screens/configuracoes/CnpjSection";
import { useConfigProfile } from "@/components/screens/configuracoes/useConfigProfile";
import { SectionTitle, Card, EditField, InfoRow, PLANS, AURA_WHATSAPP, AURA_EMAIL, sh } from "@/components/screens/configuracoes/shared";

const IS_WIDE = (typeof window !== "undefined" ? window.innerWidth : Dimensions.get("window").width) > 600;

function openEmail() {
  const mailto = "mailto:" + AURA_EMAIL;
  if (Platform.OS === "web" && typeof window !== "undefined") window.location.href = mailto;
  else Linking.openURL(mailto);
}

export default function ConfiguracoesScreen() {
  const { user, company, isDemo } = useAuthStore();
  const profile = useConfigProfile();
  const plan    = company?.plan || "essencial";
  const planDat = PLANS[plan] || PLANS.essencial;

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>

      <ProfileHero
        companyName={profile.companyName}
        cnpj={profile.cnpj}
        taxRegime={profile.taxRegime}
        profileFields={profile.profileFields}
      />

      {profile.loading && (
        <View style={s.loadingBox}>
          <ActivityIndicator color={Colors.violet3} />
          <Text style={s.loadingText}>Carregando perfil...</Text>
        </View>
      )}

      {!profile.loading && (
        <>
          {/* IDENTIDADE */}
          <SectionTitle title="Identidade" />
          <Card>
            <EditField label="Nome da empresa" value={profile.companyName} onChange={profile.setCompanyName} placeholder="Ex: Barbearia do Caio" />
            <View style={sh.fieldDivider} />
            <EditField label="Endereco" value={profile.address} onChange={profile.setAddress} placeholder="Rua, numero, cidade - UF" multiline />
          </Card>

          {/* CONTATO */}
          <SectionTitle title="Contato" />
          <Card>
            <EditField label="E-mail da empresa" value={profile.email} onChange={profile.setEmail}
              placeholder="contato@empresa.com" keyboardType="email-address" autoCapitalize="none"
              error={profile.email ? profile.emailError : null}
              hint={!profile.emailError ? "Usado para comunicacoes e notas fiscais" : undefined}
            />
            <View style={sh.fieldDivider} />
            <EditField label="Telefone" value={profile.phone} onChange={(v) => profile.setPhone(maskPhone(v))}
              placeholder="(12) 99999-0000" keyboardType="phone-pad"
              error={profile.phone ? profile.phoneError : null}
              hint={!profile.phoneError ? "Aparece na vitrine e no canal digital" : undefined}
            />
            {!profile.hasErrors && (
              <View style={s.contactNote}>
                <Icon name="info" size={13} color={Colors.ink3} />
                <Text style={s.contactNoteText}>Alteracoes entram em vigor apos salvar.</Text>
              </View>
            )}
          </Card>

          {/* DADOS REGISTRAIS */}
          <SectionTitle title="Dados registrais" />
          <CnpjSection cnpj={profile.cnpj} taxRegime={profile.taxRegime} onCnpjSaved={profile.onCnpjSaved} />

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
            <View style={sh.fieldDivider} />
            <InfoRow label="E-mail de acesso" value={user?.email || ""} />
            <View style={s.accountNote}>
              <Icon name="info" size={13} color={Colors.ink3} />
              <Text style={s.accountNoteText}>Para alterar nome ou e-mail, entre em contato com o suporte.</Text>
            </View>
          </Card>

          {/* SUPORTE */}
          <SectionTitle title="Suporte" />
          <View style={s.supportRow}>
            <Pressable onPress={() => Linking.openURL(AURA_WHATSAPP)} style={s.supportBtn}>
              <Icon name="message" size={16} color={Colors.green} />
              <Text style={[s.supportBtnText, { color: Colors.green }]}>WhatsApp</Text>
            </Pressable>
            <Pressable onPress={openEmail} style={[s.supportBtn, s.supportBtnSecondary]}>
              <Icon name="mail" size={16} color={Colors.violet3} />
              <Text style={[s.supportBtnText, { color: Colors.violet3 }]}>E-mail</Text>
            </Pressable>
          </View>

          {/* SALVAR */}
          <View style={s.saveWrap}>
            {profile.hasErrors && (
              <View style={s.errorBanner}>
                <Icon name="alert" size={14} color={Colors.red} />
                <Text style={s.errorBannerText}>Corrija os campos marcados antes de salvar.</Text>
              </View>
            )}
            <Pressable onPress={() => { profile.handleSave().then(() => { if (!profile.hasErrors) toast.success("Perfil atualizado"); }); }}
              disabled={profile.hasErrors || profile.saving}
              style={[s.saveBtn, profile.savedOk && s.saveBtnOk, profile.hasErrors && s.saveBtnDisabled]}>
              {profile.saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : profile.savedOk ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Icon name="check" size={16} color="#fff" />
                  <Text style={s.saveBtnText}>Salvo com sucesso!</Text>
                </View>
              ) : (
                <Text style={s.saveBtnText}>{profile.hasErrors ? "Corrija os erros acima" : "Salvar alteracoes"}</Text>
              )}
            </Pressable>
          </View>

          <View style={{ marginTop: 20 }}><ReferralCard /></View>

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
  loadingBox:     { alignItems: "center", paddingVertical: 40, gap: 10 },
  loadingText:    { fontSize: 12, color: Colors.ink3 },
  contactNote:    { flexDirection: "row", gap: 8, alignItems: "flex-start", marginBottom: 8, marginTop: 2, paddingHorizontal: 2 },
  contactNoteText:{ fontSize: 11, color: Colors.ink3, flex: 1 },
  planRow:        { flexDirection: "row", alignItems: "center", gap: 10, paddingBottom: 8, flexWrap: "wrap" },
  planBadge:      { backgroundColor: Colors.violetD, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: Colors.border2 },
  planBadgeText:  { fontSize: 13, color: Colors.violet3, fontWeight: "700" },
  planPrice:      { fontSize: 14, color: Colors.ink, fontWeight: "600", flex: 1 },
  planBtn:        { flexDirection: "row", alignItems: "center", gap: 4 },
  planBtnText:    { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
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
