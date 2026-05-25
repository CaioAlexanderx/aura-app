import { useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, Platform, Switch, Linking, Image } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { BASE_URL } from "@/services/api";
import { Field, SectionTitle, StatusBadge, useChannelStyles, IS_WIDE } from "./shared";
import { maskPhone, maskCpfCnpj, maskDateBr, brDateToIso } from "@/utils/masks";
import { MpGatewayCard } from "./MpGatewayCard";
import { useAccent } from "@/contexts/AccentTheme";

type Props = {
  config: any;
  saveConfig: (data: any) => Promise<void>;
  isSaving: boolean;
  requestDomain: (data: any) => Promise<void>;
  isRequestingDomain: boolean;
  uploadImage: (data: { type: "logo" | "banner"; content: string; content_type: string }) => Promise<any>;
  isUploadingImage: boolean;
  setupPix: (data: any) => Promise<any>;
  isSettingUpPix: boolean;
};

export function TabMeuSite({ config, saveConfig, isSaving, requestDomain, isRequestingDomain, uploadImage, isUploadingImage, setupPix, isSettingUpPix }: Props) {
  const cs = useChannelStyles();
  const accent = useAccent();
  const { company } = useAuthStore();
  const [siteName, setSiteName] = useState(config.site_name || company?.name || "");
  const [tagline, setTagline] = useState(config.tagline || "");
  const [description, setDescription] = useState(config.description || "");
  const [phone, setPhone] = useState(maskPhone(config.phone || ""));
  const [whatsapp, setWhatsapp] = useState(maskPhone(config.whatsapp || ""));
  const [instagram, setInstagram] = useState(config.instagram || "");
  const [address, setAddress] = useState(config.address || "");
  // primary_color continua no payload mas a UI de edicao mora em Tab Design (Rec #1)
  const [color, setColor] = useState(config.primary_color || "#7c3aed");
  const [published, setPublished] = useState(config.is_published ?? false);
  const [domainInput, setDomainInput] = useState("");
  const [domainPlan, setDomainPlan] = useState<"1year" | "2years">("1year");
  const [uploadingType, setUploadingType] = useState<"logo" | "banner" | null>(null);

  // Pix setup form
  const [showPixForm, setShowPixForm] = useState(false);
  const [pixName, setPixName] = useState("");
  const [pixCpfCnpj, setPixCpfCnpj] = useState("");
  const [pixEmail, setPixEmail] = useState("");
  const [pixPhone, setPixPhone] = useState("");
  const [pixBirthDate, setPixBirthDate] = useState("");
  const [pixCompanyType, setPixCompanyType] = useState<"MEI" | "LTDA" | "INDIVIDUAL">("MEI");

  // Pix manual (chave proxima do lojista — substitui o fluxo Asaas)
  const [pixKey, setPixKey] = useState(config.pix_key || "");
  const [pixKeyType, setPixKeyType] = useState<"CPF" | "CNPJ" | "EMAIL" | "PHONE" | "RANDOM">((config.pix_key_type as any) || "CPF");
  const [pixHolderName, setPixHolderName] = useState(config.pix_holder_name || "");
  const [pixHolderCity, setPixHolderCity] = useState(config.pix_holder_city || "");
  const [payOnDelivery, setPayOnDelivery] = useState(config.pay_on_delivery_enabled === true);
  const [cardEnabled, setCardEnabled] = useState(config.card_enabled !== false);

  useEffect(() => {
    if (!config.exists) return;
    setSiteName(config.site_name || ""); setTagline(config.tagline || "");
    setDescription(config.description || ""); setPhone(maskPhone(config.phone || ""));
    setWhatsapp(maskPhone(config.whatsapp || "")); setInstagram(config.instagram || "");
    setAddress(config.address || ""); setColor(config.primary_color || "#7c3aed");
    setPublished(config.is_published ?? false);
    setPixKey(config.pix_key || "");
    setPixKeyType((config.pix_key_type as any) || "CPF");
    setPixHolderName(config.pix_holder_name || "");
    setPixHolderCity(config.pix_holder_city || "");
    setPayOnDelivery(config.pay_on_delivery_enabled === true);
    setCardEnabled(config.card_enabled !== false);
  }, [config.exists]);

  function pickImage(type: "logo" | "banner") {
    if (Platform.OS !== "web") return;
    try {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/jpeg,image/png,image/webp";
      input.style.cssText = "position:fixed;top:-100px;left:-100px;opacity:0";
      document.body.appendChild(input);
      input.addEventListener("change", async () => {
        const file = input.files?.[0];
        if (!file) return;
        try { document.body.removeChild(input); } catch {}
        if (file.size > 5 * 1024 * 1024) { toast.error("Imagem muito grande (max 5MB)"); return; }
        const reader = new FileReader();
        reader.onload = async (e) => {
          const dataUrl = e.target?.result as string;
          const base64 = dataUrl.split(",")[1];
          if (!base64) return;
          setUploadingType(type);
          try {
            await uploadImage({ type, content: base64, content_type: file.type });
          } finally {
            setUploadingType(null);
          }
        };
        reader.readAsDataURL(file);
      });
      input.click();
    } catch {}
  }

  async function handleSave() {
    await saveConfig({
      site_name: siteName.trim() || null,
      tagline: tagline.trim() || null,
      description: description.trim() || null,
      phone: phone.trim() || null,
      whatsapp: whatsapp.trim() || null,
      instagram: instagram.trim() || null,
      address: address.trim() || null,
      primary_color: color,
      is_published: published,
      pix_key: pixKey.trim() || null,
      pix_key_type: pixKey.trim() ? pixKeyType : null,
      pix_holder_name: pixHolderName.trim() || null,
      pix_holder_city: pixHolderCity.trim() || null,
      pay_on_delivery_enabled: payOnDelivery,
      card_enabled: cardEnabled,
    });
  }

  async function handleRequestDomain() {
    const d = domainInput.trim().toLowerCase();
    if (!d || !d.includes(".")) { toast.error("Informe um dominio valido (ex: meunegocio.com.br)"); return; }
    await requestDomain({ domain: d, plan: domainPlan }); setDomainInput("");
  }

  async function handleSetupPix() {
    if (!pixName.trim()) { toast.error("Informe o nome ou razao social"); return; }
    if (!pixEmail.trim()) { toast.error("Informe o e-mail"); return; }
    if (!pixCpfCnpj.trim()) { toast.error("Informe o CPF ou CNPJ"); return; }
    if (!pixPhone.trim()) { toast.error("Informe o celular"); return; }

    // Asaas exige data de nascimento para CPF (INDIVIDUAL) e MEI
    const requiresDob = pixCompanyType === "INDIVIDUAL" || pixCompanyType === "MEI";
    let isoBirthDate: string | null = null;
    if (requiresDob) {
      if (!pixBirthDate.trim()) {
        toast.error("Informe a data de nascimento");
        return;
      }
      isoBirthDate = brDateToIso(pixBirthDate);
      if (!isoBirthDate) {
        toast.error("Data de nascimento inválida (use DD/MM/AAAA)");
        return;
      }
    }

    await setupPix({
      name: pixName.trim(),
      email: pixEmail.trim(),
      cpf_cnpj: pixCpfCnpj.trim(),
      mobile_phone: pixPhone.trim(),
      company_type: pixCompanyType,
      birth_date: isoBirthDate || undefined,
    });
    setShowPixForm(false);
  }

  const slug = config.slug || (siteName || "minha-loja").toLowerCase().replace(/\s+/g, "-").slice(0, 40);
  const storefrontUrl = config.storefront_url || `${BASE_URL}/storefront/${slug}/page`;
  const hasDomain = config.custom_domain && config.custom_domain_status !== "none";
  const asaasConfigured = !!(company as any)?.asaas_subconta_id;
  const dobRequired = pixCompanyType === "INDIVIDUAL" || pixCompanyType === "MEI";

  // Fase 3 — Rec #9: mini-mockup le banner[0] enabled+image se houver.
  const banners: any[] = Array.isArray(config.banners) ? config.banners : [];
  const heroBanner = banners.find((b) => b && b.enabled !== false && b.image_url) || banners.find((b) => b && b.enabled !== false) || null;
  const heroImage: string | null = heroBanner?.image_url || null;
  const heroHeadline: string = (heroBanner?.headline || tagline || description || "Bem-vindo ao nosso site").toString();
  const mockHeight = IS_WIDE ? 180 : 140;

  const PIX_KEY_TYPES: { value: "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "RANDOM"; label: string }[] = [
    { value: "CPF", label: "CPF" },
    { value: "CNPJ", label: "CNPJ" },
    { value: "EMAIL", label: "E-mail" },
    { value: "PHONE", label: "Celular" },
    { value: "RANDOM", label: "Aleatoria" },
  ];

  const PIX_TYPES: { value: "MEI" | "LTDA" | "INDIVIDUAL"; label: string }[] = [
    { value: "MEI", label: "MEI" },
    { value: "LTDA", label: "Empresa (LTDA/SA)" },
    { value: "INDIVIDUAL", label: "Pessoa Fisica" },
  ];

  function copyStorefrontUrl() {
    if (Platform.OS === "web" && typeof navigator !== "undefined") {
      try { navigator.clipboard?.writeText(storefrontUrl); } catch {}
    }
    toast.info("Link copiado!");
  }

  return (
    <View>
      {/* Fase 3 — Rec #9: mini-mockup sticky (sticky soh no web; em RN nativo cai como bloco normal) */}
      <View
        style={[
          s.mockupWrap,
          Platform.OS === "web" ? ({ position: "sticky" as any, top: 0, zIndex: 10 } as any) : null,
        ]}
      >
        <View style={s.mockupFrame}>
          {/* Mini-topbar */}
          <View style={s.mockupTopbar}>
            <View style={s.mockupLogoSlot}>
              {config.logo_url ? (
                <Image source={{ uri: config.logo_url }} style={s.mockupLogoImg} resizeMode="cover" />
              ) : (
                <View style={[s.mockupLogoFallback, { backgroundColor: color }]}>
                  <Text style={s.mockupLogoInitial}>{(siteName || "A").charAt(0).toUpperCase()}</Text>
                </View>
              )}
            </View>
            <Text style={s.mockupBrand} numberOfLines={1}>{siteName || "Meu Negocio"}</Text>
            <View style={[s.mockupStatus, { backgroundColor: published ? Colors.greenD : Colors.bg4 }]}>
              <View style={[s.mockupStatusDot, { backgroundColor: published ? Colors.green : Colors.ink3 }]} />
              <Text style={[s.mockupStatusText, { color: published ? Colors.green : Colors.ink3 }]}>
                {published ? "Publicada" : "Rascunho"}
              </Text>
            </View>
          </View>

          {/* Mini-hero/banner — usa imagem do banner ou gradiente da cor primaria */}
          <View style={[s.mockupHero, { height: mockHeight, backgroundColor: color }]}>
            {heroImage ? (
              <Image source={{ uri: heroImage }} style={s.mockupHeroImg} resizeMode="cover" />
            ) : null}
            {/* Overlay com darken sutil pra dar leitura do texto */}
            <View style={s.mockupHeroOverlay} pointerEvents="none" />
            <View style={s.mockupHeroContent} pointerEvents="none">
              <Text style={s.mockupHeroHeadline} numberOfLines={2}>{heroHeadline}</Text>
              <View style={s.mockupHeroCta}>
                <View style={s.mockupHeroCtaInner} />
              </View>
            </View>
          </View>
        </View>

        {/* Acoes abaixo do mockup */}
        <View style={s.mockupActions}>
          <Pressable onPress={copyStorefrontUrl} style={s.mockupBtnGhost}>
            <Icon name="copy" size={13} color={accent.primaryStrong} />
            <Text style={s.mockupBtnGhostText}>Copiar link</Text>
          </Pressable>
          {Platform.OS === "web" && (
            <Pressable onPress={() => Linking.openURL(storefrontUrl)} style={s.mockupBtnPrimary}>
              <Icon name="globe" size={13} color="#fff" />
              <Text style={s.mockupBtnPrimaryText}>Ver loja</Text>
            </Pressable>
          )}
        </View>
        <View style={s.mockupUrlRow}>
          <Icon name="globe" size={11} color={Colors.ink3} />
          <Text style={s.mockupUrlText} numberOfLines={1}>{storefrontUrl}</Text>
        </View>
      </View>

      <SectionTitle title="Informacoes do negocio" />
      <View style={cs.card}>
        <View style={cs.switchRow}>
          <View style={{ flex: 1 }}><Text style={cs.switchLabel}>Site publicado</Text><Text style={cs.switchHint}>{published ? "Visivel para clientes" : "Site oculto"}</Text></View>
          <Switch value={published} onValueChange={setPublished} trackColor={{ true: Colors.green, false: Colors.bg4 }} thumbColor="#fff" />
        </View>
        <View style={cs.divider} />
        <Field label="Nome do negocio" value={siteName} onChange={setSiteName} placeholder="Ex: Barbearia do Caio" />
        <Field label="Slogan (opcional)" value={tagline} onChange={setTagline} placeholder="Qualidade que fala por si" />
        <Field label="Descricao" value={description} onChange={setDescription} placeholder="Conte sobre seu negocio..." multiline />
        <Field label="WhatsApp" value={whatsapp} onChange={(v) => setWhatsapp(maskPhone(v))} placeholder="(12) 99999-0000" />
        <Field label="Instagram" value={instagram} onChange={setInstagram} placeholder="@seunegocio" />
        <Field label="Telefone" value={phone} onChange={(v) => setPhone(maskPhone(v))} placeholder="(12) 3333-0000" />
        <Field label="Endereco" value={address} onChange={setAddress} placeholder="Rua Principal, 100 - Jacarei/SP" />
        <Pressable onPress={handleSave} disabled={isSaving} style={[cs.saveBtn, isSaving && { opacity: 0.6 }]}><Text style={cs.saveBtnText}>{isSaving ? "Salvando..." : "Salvar configuracoes"}</Text></Pressable>
      </View>

      {/* Logo (cor principal e capa/banner foram movidas pra Tab Design — Rec #1) */}
      <SectionTitle title="Logo" />
      <View style={cs.card}>
        <Text style={cs.hint}>Imagem que aparece no cabecalho da loja. Cor principal e banners ficam em Design.</Text>

        <Text style={cs.fieldLabel}>Logo</Text>
        <View style={s.imgRow}>
          <View style={s.logoPreview}>
            {config.logo_url ? (
              <Image source={{ uri: config.logo_url }} style={{ width: "100%", height: "100%", borderRadius: 12 }} resizeMode="cover" />
            ) : (
              <View style={[s.logoPlaceholder, { backgroundColor: color }]}>
                <Text style={s.logoInitial}>{(siteName || "A").charAt(0).toUpperCase()}</Text>
              </View>
            )}
          </View>
          <View style={{ flex: 1, gap: 8 }}>
            <Text style={s.imgHint}>Quadrado, min. 200x200px{"\n"}PNG ou JPG, max. 5MB</Text>
            {Platform.OS === "web" && (
              <Pressable
                onPress={() => pickImage("logo")}
                disabled={isUploadingImage}
                style={[s.imgBtn, isUploadingImage && uploadingType === "logo" && { opacity: 0.6 }]}
              >
                <Icon name="upload" size={13} color={accent.primaryStrong} />
                <Text style={s.imgBtnText}>{uploadingType === "logo" ? "Enviando..." : config.logo_url ? "Trocar logo" : "Enviar logo"}</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>

      {/* Pagamentos — chave Pix manual + entrega */}
      <SectionTitle title="Pagamentos" />
      <View style={cs.card}>
        <Text style={cs.hint}>Como voce quer receber dos clientes? Pode marcar mais de uma opcao.</Text>

        {/* Migration 121: toggle independente das credenciais MP.
            Default true. Quando false, has_card vira false mesmo com credenciais. */}
        <View style={cs.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={cs.switchLabel}>Aceitar cartão de crédito</Text>
            <Text style={cs.switchHint}>{cardEnabled ? "Cliente vê opção de cartão no checkout (requer Mercado Pago configurado abaixo)" : "Cartão desativado — cliente só vê Pix e/ou pagamento na entrega"}</Text>
          </View>
          <Switch value={cardEnabled} onValueChange={setCardEnabled} trackColor={{ true: Colors.green, false: Colors.bg4 }} thumbColor="#fff" />
        </View>
        <View style={cs.divider} />

        {/* Toggle: pagamento na entrega */}
        <View style={cs.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={cs.switchLabel}>Aceitar pagamento na entrega</Text>
            <Text style={cs.switchHint}>Cliente paga em dinheiro/cartao no momento da entrega ou retirada</Text>
          </View>
          <Switch value={payOnDelivery} onValueChange={setPayOnDelivery} trackColor={{ true: Colors.green, false: Colors.bg4 }} thumbColor="#fff" />
        </View>
        <View style={cs.divider} />

        {/* Form chave Pix manual */}
        <Text style={[cs.fieldLabel, { marginBottom: 4 }]}>Chave Pix (recebimento online)</Text>
        <Text style={[cs.hint, { marginTop: 0, marginBottom: 12 }]}>
          Cliente paga via Pix copia-e-cola, anexa o comprovante e voce aprova manualmente em Pedidos.
        </Text>

        <Text style={cs.fieldLabel}>Tipo da chave</Text>
        <View style={s.typeRow}>
          {PIX_KEY_TYPES.map(t => (
            <Pressable
              key={t.value}
              onPress={() => { setPixKeyType(t.value); setPixKey(""); }}
              style={[s.typeBtn, pixKeyType === t.value && s.typeBtnActive]}
            >
              <Text style={[s.typeBtnText, pixKeyType === t.value && s.typeBtnTextActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={cs.fieldLabel}>Chave</Text>
        <TextInput
          style={cs.input}
          value={pixKey}
          onChangeText={(v) => {
            if (pixKeyType === "CPF" || pixKeyType === "CNPJ") setPixKey(maskCpfCnpj(v));
            else if (pixKeyType === "PHONE") setPixKey(maskPhone(v));
            else setPixKey(v);
          }}
          placeholder={
            pixKeyType === "CPF" ? "000.000.000-00" :
            pixKeyType === "CNPJ" ? "00.000.000/0000-00" :
            pixKeyType === "EMAIL" ? "voce@exemplo.com" :
            pixKeyType === "PHONE" ? "(11) 99999-0000" :
            "00000000-0000-0000-0000-000000000000"
          }
          placeholderTextColor={Colors.ink3}
          keyboardType={pixKeyType === "EMAIL" ? "email-address" : pixKeyType === "RANDOM" ? "default" : "numeric"}
          autoCapitalize={pixKeyType === "EMAIL" ? "none" : "sentences"}
        />

        <Field label="Nome do recebedor" value={pixHolderName} onChange={setPixHolderName} placeholder="Nome que aparece pro cliente no app do banco" />
        <Field label="Cidade do recebedor" value={pixHolderCity} onChange={setPixHolderCity} placeholder="Sao Paulo" />

        {asaasConfigured && (
          <View style={cs.infoCard}>
            <Icon name="alert" size={13} color={accent.primaryStrong} />
            <Text style={cs.infoText}>
              Conta Asaas legada ativa. A chave Pix manual cadastrada acima passa a prevalecer no checkout.
            </Text>
          </View>
        )}

        <Pressable onPress={handleSave} disabled={isSaving} style={[cs.saveBtn, isSaving && { opacity: 0.6 }, { marginTop: 12 }]}>
          <Text style={cs.saveBtnText}>{isSaving ? "Salvando..." : "Salvar pagamentos"}</Text>
        </Pressable>
      </View>

      {/* MP Fase 0 (20/05/2026): cartao de credito via Mercado Pago.
          Card autonomo — gerencia proprio estado via usePaymentGateways hook. */}
      <MpGatewayCard />

      <SectionTitle title="Dominio personalizado" />
      <View style={cs.card}>
        {hasDomain ? (
          <View>
            <View style={s.domainRow}><Icon name="globe" size={16} color={accent.primaryStrong} /><Text style={s.domainName}>{config.custom_domain}</Text><StatusBadge status={config.custom_domain_status} /></View>
            {config.custom_domain_status === "pending_dns" && <View style={cs.infoCard}><Icon name="alert" size={13} color={Colors.amber} /><Text style={cs.infoText}>A equipe Aura vai configurar seu dominio em ate 48h uteis.</Text></View>}
          </View>
        ) : (
          <View>
            <Text style={s.domainDesc}>Registre um dominio .com.br exclusivo. Configurado pela equipe Aura.</Text>
            <Text style={cs.fieldLabel}>Duracao</Text>
            <View style={s.planRow}>
              <Pressable onPress={() => setDomainPlan("1year")} style={[s.planBtn, domainPlan === "1year" && s.planBtnActive]}>
                <Text style={[s.planBtnLabel, domainPlan === "1year" && s.planBtnLabelActive]}>1 ano</Text>
                <Text style={[s.planBtnPrice, domainPlan === "1year" && s.planBtnLabelActive]}>R$ 80</Text>
              </Pressable>
              <Pressable onPress={() => setDomainPlan("2years")} style={[s.planBtn, domainPlan === "2years" && s.planBtnActive]}>
                <Text style={[s.planBtnLabel, domainPlan === "2years" && s.planBtnLabelActive]}>2 anos</Text>
                <Text style={[s.planBtnPrice, domainPlan === "2years" && s.planBtnLabelActive]}>R$ 152 <Text style={{ fontSize: 10, color: Colors.green }}>(-5%)</Text></Text>
              </Pressable>
            </View>
            <Text style={[cs.fieldLabel, { marginTop: 12 }]}>Dominio desejado</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput style={[cs.input, { flex: 1 }]} value={domainInput} onChangeText={setDomainInput} placeholder="meunegocio.com.br" placeholderTextColor={Colors.ink3} autoCapitalize="none" autoCorrect={false} />
              <Pressable onPress={handleRequestDomain} disabled={isRequestingDomain} style={[s.domainBtn, isRequestingDomain && { opacity: 0.6 }]}><Text style={s.domainBtnText}>{isRequestingDomain ? "..." : "Solicitar"}</Text></Pressable>
            </View>
            <View style={cs.infoCard}><Icon name="alert" size={13} color={accent.primaryStrong} /><Text style={cs.infoText}>Apos solicitar, a equipe Aura confirma e configura em ate 48h uteis.</Text></View>
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  // Fase 3 — Rec #9: mini-mockup (substitui o preview plano)
  mockupWrap: {
    backgroundColor: Colors.bg3,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border2,
    padding: 10,
    marginBottom: 16,
    gap: 8,
  },
  mockupFrame: {
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "#fff",
  },
  mockupTopbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  mockupLogoSlot: {
    width: 26,
    height: 26,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: Colors.bg4,
    flexShrink: 0,
  },
  mockupLogoImg: { width: "100%", height: "100%" },
  mockupLogoFallback: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  mockupLogoInitial: { fontSize: 14, fontWeight: "800", color: "#fff" },
  mockupBrand: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: Colors.ink,
  },
  mockupStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexShrink: 0,
  },
  mockupStatusDot: { width: 5, height: 5, borderRadius: 3 },
  mockupStatusText: { fontSize: 10, fontWeight: "700" },
  mockupHero: {
    width: "100%",
    overflow: "hidden",
    position: "relative",
    alignItems: "flex-start",
    justifyContent: "flex-end",
  },
  mockupHeroImg: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    width: "100%",
    height: "100%",
  },
  mockupHeroOverlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  mockupHeroContent: {
    padding: 14,
    gap: 8,
    width: "70%",
  },
  mockupHeroHeadline: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 17,
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  mockupHeroCta: {
    width: 80,
    height: 18,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  mockupHeroCtaInner: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.ink,
    opacity: 0.5,
  },
  mockupActions: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 2,
  },
  mockupBtnGhost: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: Colors.bg4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  mockupBtnGhostText: { fontSize: 11, color: Colors.violet3, fontWeight: "600" },
  mockupBtnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: Colors.violet,
  },
  mockupBtnPrimaryText: { fontSize: 11, color: "#fff", fontWeight: "700" },
  mockupUrlRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 2,
  },
  mockupUrlText: { flex: 1, fontSize: 10, color: Colors.ink3, fontWeight: "500" },

  // Identidade visual
  imgRow: { flexDirection: "row", alignItems: "flex-start", gap: 16, marginBottom: 4 },
  logoPreview: { width: 80, height: 80, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, overflow: "hidden", flexShrink: 0 },
  logoPlaceholder: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  logoInitial: { fontSize: 28, fontWeight: "800", color: "#fff" },
  imgHint: { fontSize: 11, color: Colors.ink3, lineHeight: 16 },
  imgBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.bg4, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: Colors.border, alignSelf: "flex-start" },
  imgBtnText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  bannerPreview: { width: "100%", height: 100, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, overflow: "hidden" },
  bannerPlaceholder: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center", gap: 6 },
  bannerPlaceholderText: { fontSize: 12, fontWeight: "600" },
  // Pagamentos
  pixRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  pixIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  pixTitle: { fontSize: 13, fontWeight: "700", color: Colors.ink, marginBottom: 3 },
  pixDesc: { fontSize: 11, color: Colors.ink3, lineHeight: 16 },
  pixBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, flexShrink: 0 },
  pixBadgeText: { fontSize: 10, fontWeight: "700" },
  activatePixBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 14, marginTop: 4 },
  activatePixBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  pixForm: { backgroundColor: Colors.bg4, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: Colors.border2 },
  pixFormTitle: { fontSize: 13, fontWeight: "700", color: Colors.ink, marginBottom: 4 },
  pixFormHint: { fontSize: 11, color: Colors.ink3, lineHeight: 16, marginBottom: 12 },
  typeRow: { flexDirection: "row", gap: 8, marginBottom: 12, flexWrap: "wrap" },
  typeBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.bg3 },
  typeBtnActive: { borderColor: Colors.violet, backgroundColor: Colors.violetD },
  typeBtnText: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
  typeBtnTextActive: { color: Colors.violet3 },
  pixCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
  pixCancelBtnText: { fontSize: 13, color: Colors.ink3, fontWeight: "600" },
  pixConfirmBtn: { flex: 2, paddingVertical: 12, borderRadius: 10, backgroundColor: Colors.violet, alignItems: "center" },
  pixConfirmBtnText: { fontSize: 13, color: "#fff", fontWeight: "700" },
  // Dominio
  domainDesc: { fontSize: 12, color: Colors.ink3, lineHeight: 18, marginBottom: 16 },
  domainRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  domainName: { flex: 1, fontSize: 14, color: Colors.ink, fontWeight: "600" },
  domainBtn: { backgroundColor: Colors.violet, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 11, flexShrink: 0 },
  domainBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  planRow: { flexDirection: "row", gap: 10, marginTop: 6 },
  planBtn: { flex: 1, backgroundColor: Colors.bg4, borderRadius: 12, padding: 14, borderWidth: 2, borderColor: Colors.border, alignItems: "center", gap: 4 },
  planBtnActive: { borderColor: Colors.violet, backgroundColor: Colors.violetD },
  planBtnLabel: { fontSize: 13, color: Colors.ink3, fontWeight: "600" },
  planBtnPrice: { fontSize: 18, color: Colors.ink3, fontWeight: "800" },
  planBtnLabelActive: { color: Colors.violet3 },
});
