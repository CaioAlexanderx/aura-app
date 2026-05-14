import { useEffect } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Linking, Platform, ActivityIndicator, Dimensions } from "react-native";
import { Colors } from "@/constants/colors";
import { router } from "expo-router";
import { useAuthStore } from "@/stores/auth";
import { useQuery } from "@tanstack/react-query";
import { authApi, request } from "@/services/api";
import { maskPhone } from "@/utils/masks";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { MembersSection } from "@/components/MembersSection";
import { ReferralCard } from "@/components/ReferralCard";
import { ThemeSwitchCard } from "@/components/ThemeSwitchCard";
import { ProfileHero } from "@/components/screens/configuracoes/ProfileHero";
import { CnpjSection } from "@/components/screens/configuracoes/CnpjSection";
import { PdvSettingsCard } from "@/components/screens/configuracoes/PdvSettingsCard";
import { useConfigProfile } from "@/components/screens/configuracoes/useConfigProfile";
import { SectionTitle, Card, EditField, InfoRow, PLANS, AURA_WHATSAPP, AURA_EMAIL, sh } from "@/components/screens/configuracoes/shared";

const IS_WIDE = (typeof window !== "undefined" ? window.innerWidth : Dimensions.get("window").width) > 600;

function openEmail() {
  const mailto = "mailto:" + AURA_EMAIL;
  if (Platform.OS === "web" && typeof window !== "undefined") window.location.href = mailto;
  else Linking.openURL(mailto);
}

function EquipeGate() {
  return (
    <View style={g.wrap}>
      <View style={g.row}>
        <Icon name="users" size={16} color={Colors.ink3} />
        <Text style={g.label}>Convide sua equipe e defina permissoes de acesso.</Text>
      </View>
      <Pressable onPress={() => router.push("/(tabs)/planos")} style={g.badge}>
        <Icon name="lock" size={11} color={Colors.ink3} />
        <Text style={g.badgeText}>A partir do plano Negocio</Text>
      </Pressable>
    </View>
  );
}

const g = StyleSheet.create({
  wrap:      { backgroundColor: Colors.bg3, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 4, gap: 10 },
  row:       { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  label:     { fontSize: 13, color: Colors.ink3, flex: 1, lineHeight: 18 },
  badge:     { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: Colors.bg4, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: Colors.border },
  badgeText: { fontSize: 11, color: Colors.ink3, fontWeight: "600" },
});

// MULTICNPJ Onda 2.6: gate explicativo das secoes per-company quando user
// esta em modo consolidado. Algumas configs sao especificas de uma empresa
// (identidade, dados registrais, vendas, equipe) e nao fazem sentido agregadas.
// Outras (perfil do dono, plano, empresas, aparencia, suporte) seguem visiveis.
function PerCompanyGate({ availableCompanies, switchToCompany }: {
  availableCompanies: any[];
  switchToCompany: (id: string) => void;
}) {
  return (
    <View style={pcg.wrap}>
      <View style={pcg.row}>
        <Icon name="bag" size={16} color="#a78bfa" />
        <View style={{ flex: 1 }}>
          <Text style={pcg.title}>Configuracoes por empresa</Text>
          <Text style={pcg.desc}>
            Identidade, dados registrais, equipe e politicas de venda sao especificas de cada CNPJ.
            Selecione uma empresa para configura-la.
          </Text>
        </View>
      </View>
      <View style={pcg.list}>
        {availableCompanies.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => switchToCompany(c.id)}
            style={pcg.item}
          >
            <View style={pcg.itemIcon}>
              <Text style={pcg.itemIconText}>{(c.trade_name || c.legal_name || "E").charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={pcg.itemTitle} numberOfLines={1}>
                {c.trade_name || c.legal_name || "Empresa"}
              </Text>
              <Text style={pcg.itemDesc} numberOfLines={1}>
                {c.is_primary ? "Empresa principal" : "Empresa secundaria"}
              </Text>
            </View>
            <Icon name="chevron_right" size={16} color={Colors.ink3} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const pcg = StyleSheet.create({
  wrap: {
    backgroundColor: "rgba(124,58,237,0.08)",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.28)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    gap: 14,
  },
  row: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  title: { fontSize: 13, fontWeight: "700", color: "#c4b5fd", letterSpacing: 0.2, marginBottom: 4 },
  desc: { fontSize: 11.5, color: Colors.ink3, lineHeight: 16 },
  list: { gap: 6 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.bg3,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  itemIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.violetD,
    borderWidth: 1, borderColor: Colors.border2,
    alignItems: "center", justifyContent: "center",
  },
  itemIconText: { fontSize: 14, fontWeight: "700", color: Colors.violet3 },
  itemTitle: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  itemDesc: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
});

export default function ConfiguracoesScreen() {
  // MULTICNPJ Onda 2.6: detecta consolidatedView e divide a tela em
  // secoes globais (sempre visiveis) vs per-company (com gate em consolidated).
  const { user, company, isDemo, token, availableCompanies, consolidatedView, switchCompany } = useAuthStore();
  const profile = useConfigProfile();

  // ============================================================
  // 12/05/2026 — FIX EquipeGate stale plan (caso Maria/Encanto):
  // Plano no JWT pode estar desatualizado se o staff mudou via Gestao
  // Aura enquanto o cliente ainda esta logado. Refetch /auth/me no mount
  // pra atualizar o store. Cliente ve mudancas sem precisar logout/login.
  //
  // 13/05/2026: refetch agora tambem sincroniza extra_seats_granted (campo
  // novo exposto pelo auth.js shapeCompany). Sem isso, fallback do gate
  // seguia com 0 mesmo apos o staff aplicar +1 acesso via Gestao Aura.
  // ============================================================
  useEffect(() => {
    if (!token || !company?.id) return;
    authApi.me(token)
      .then((fresh) => {
        if (fresh?.company?.plan && fresh.company.plan !== company.plan) {
          useAuthStore.getState().updateCompany({ plan: fresh.company.plan });
        }
        if (fresh?.company?.module_overrides) {
          useAuthStore.getState().updateCompany({ module_overrides: fresh.company.module_overrides });
        }
        if (fresh?.company?.vertical_active !== undefined) {
          useAuthStore.getState().updateCompany({ vertical_active: fresh.company.vertical_active });
        }
        // FIX 13/05/2026: sincroniza extra_seats_granted pro fallback do gate.
        if ((fresh?.company as any)?.extra_seats_granted !== undefined) {
          useAuthStore.getState().updateCompany({
            extra_seats_granted: (fresh.company as any).extra_seats_granted,
          } as any);
        }
      })
      .catch(() => { /* silencioso — se /me falhar, segue com cache */ });
  }, [token, company?.id]);

  // ============================================================
  // 12/05/2026 — Gate baseado em CAPACIDADE de equipe, nao em plano hardcoded.
  // /members/billing retorna seats_included que considera plano + extra_seats_granted.
  // Cobre plano Negocio+ (sempre tem 3+) E plano Essencial com seats extras pagos
  // manualmente via Gestao Aura (PR Aura-backend#65). Gate solta quando
  // seats_included > 1 (cabe pelo menos titular + 1 funcionario).
  //
  // 13/05/2026 — Fallback secundario (caso Maria/Encanto): quando /members/billing
  // falha ou cache stale, ainda libera Equipe se company.extra_seats_granted > 0
  // (pago manualmente via Gestao Aura). Sem isso, Essencial+extra_seat caia no
  // fallback `plan !== "essencial"` (false) e mostrava gate apesar do pagamento.
  // Backend auth.js (mesmo dia) expoe extra_seats_granted no /auth/me.
  // ============================================================
  const { data: billingData } = useQuery({
    queryKey: ["members-billing", company?.id],
    queryFn: () => request<any>("/companies/" + company!.id + "/members/billing"),
    enabled: !!token && !!company?.id && !consolidatedView,
    staleTime: 30_000,
  });
  const seatsIncluded = billingData?.seats_included ?? null;
  // Enquanto billing carrega, fallback no plan store-side pra evitar flicker do gate.
  // Quando carregar, seats_included > 1 = libera. Cobre essencial+extra_seats.
  const plan    = company?.plan || "essencial";
  const planDat = PLANS[plan] || PLANS.essencial;
  // 13/05/2026: fallback secundario via company.extra_seats_granted (caso Maria).
  const extraSeatsGranted = (((company as any)?.extra_seats_granted ?? 0) as number) > 0;
  const hasTeamCapacity = seatsIncluded !== null
    ? seatsIncluded > 1
    : (plan !== "essencial" || extraSeatsGranted);
  const totalCompanies = availableCompanies?.length || 1;

  function handleSwitchToCompany(companyId: string) {
    // Switch + redireciona pra propria tela de Config (deep link mantido).
    if (typeof window !== "undefined") {
      try { window.localStorage.setItem("aura_post_switch_redirect", "/configuracoes"); } catch {}
    }
    switchCompany(companyId);
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>

      {/* Em consolidated, ProfileHero seria do "company atual" que nao existe.
          Ocultar e usar um header simples no topo. */}
      {!consolidatedView && (
        <ProfileHero
          companyName={profile.companyName}
          cnpj={profile.cnpj}
          taxRegime={profile.taxRegime}
          profileFields={profile.profileFields}
          onLogoSaved={profile.saveLogoUrl}
          onLogoRemoved={profile.removeLogoUrl}
        />
      )}

      {consolidatedView && (
        <View style={s.consolidatedHero}>
          <Icon name="bag" size={20} color="#a78bfa" />
          <View style={{ flex: 1 }}>
            <Text style={s.consolidatedHeroTitle}>Configuracoes — Visao consolidada</Text>
            <Text style={s.consolidatedHeroDesc}>
              {totalCompanies} empresa{totalCompanies !== 1 ? "s" : ""} ativa{totalCompanies !== 1 ? "s" : ""}.
              Configuracoes globais ficam aqui; especificas exigem entrar em uma empresa.
            </Text>
          </View>
        </View>
      )}

      {profile.loading && !consolidatedView && (
        <View style={s.loadingBox}>
          <ActivityIndicator color={Colors.violet3} />
          <Text style={s.loadingText}>Carregando perfil...</Text>
        </View>
      )}

      {(!profile.loading || consolidatedView) && (
        <>
          {/* ============================================
              SECOES PER-COMPANY (sub-gated em consolidated)
              ============================================ */}
          {!consolidatedView && (
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
            </>
          )}

          {/* Gate "Configuracoes por empresa" so em consolidated.
              Aparece no lugar das secoes per-company acima. */}
          {consolidatedView && availableCompanies && availableCompanies.length > 0 && (
            <>
              <SectionTitle title="Configuracoes especificas" />
              <PerCompanyGate
                availableCompanies={availableCompanies}
                switchToCompany={handleSwitchToCompany}
              />
            </>
          )}

          {/* ============================================
              SECOES GLOBAIS (sempre visiveis)
              ============================================ */}

          {/* PLANO ATUAL — global (plano e do dono, nao da empresa em Multi-CNPJ) */}
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

          {/* MINHAS EMPRESAS — sempre visivel */}
          <SectionTitle title="Empresas" />
          <Pressable onPress={() => router.push("/empresas")} style={s.linkCard}>
            <View style={s.linkCardIcon}>
              <Icon name="bag" size={18} color={Colors.violet3} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.linkCardTitle}>Minhas empresas</Text>
              <Text style={s.linkCardDesc}>
                {totalCompanies > 1
                  ? `${totalCompanies} CNPJs cadastrados — gerenciar, trocar ou adicionar`
                  : "Adicione mais um CNPJ ou gerencie o atual"}
              </Text>
            </View>
            {totalCompanies > 1 && (
              <View style={s.countBadge}>
                <Text style={s.countBadgeText}>{totalCompanies}</Text>
              </View>
            )}
            <Icon name="chevron_right" size={16} color={Colors.ink3} />
          </Pressable>

          {/* VENDAS — per-company (PDV settings sao por empresa) */}
          {!consolidatedView && (
            <>
              <SectionTitle title="Vendas" />
              <PdvSettingsCard />
              <Pressable onPress={() => router.push("/(tabs)/cupons")} style={s.linkCard}>
                <View style={s.linkCardIcon}>
                  <Icon name="star" size={18} color={Colors.violet3} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.linkCardTitle}>Cupons de desconto</Text>
                  <Text style={s.linkCardDesc}>Crie e gerencie cupons para oferecer descontos no caixa</Text>
                </View>
                <Icon name="chevron_right" size={16} color={Colors.ink3} />
              </Pressable>
            </>
          )}

          {/* EQUIPE — per-company (members/permissoes sao por empresa)
              12/05/2026: gate por CAPACIDADE (seats_included > 1) em vez de plano hardcoded.
              13/05/2026: fallback secundario via company.extra_seats_granted > 0 (caso Maria). */}
          {!consolidatedView && (
            <>
              <SectionTitle title="Equipe" />
              {hasTeamCapacity ? <MembersSection /> : <EquipeGate />}
            </>
          )}

          {/* MINHA CONTA — global (perfil do user, nao da empresa) */}
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

          {/* APARENCIA — global (preferencia do user) */}
          <SectionTitle title="Aparencia" />
          <ThemeSwitchCard />

          {/* SUPORTE — global */}
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

          {/* SALVAR — so per-company */}
          {!consolidatedView && (
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
          )}

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
  linkCard:       { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: Colors.bg3, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 4 },
  linkCardIcon:   { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2, alignItems: "center", justifyContent: "center" },
  linkCardTitle:  { fontSize: 14, color: Colors.ink, fontWeight: "600" },
  linkCardDesc:   { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  countBadge:     { backgroundColor: Colors.violet, borderRadius: 999, minWidth: 22, height: 22, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  countBadgeText: { fontSize: 11, color: "#fff", fontWeight: "700" },
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
  // MULTICNPJ Onda 2.6
  consolidatedHero: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    backgroundColor: "rgba(124,58,237,0.10)",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.28)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  consolidatedHeroTitle: { fontSize: 14, fontWeight: "700", color: "#c4b5fd", letterSpacing: 0.2, marginBottom: 4 },
  consolidatedHeroDesc: { fontSize: 11.5, color: Colors.ink3, lineHeight: 16 },
});
