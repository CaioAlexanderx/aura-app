import { useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, Platform, Switch, Linking, Image } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { BASE_URL } from "@/services/api";
import { Field, SectionTitle, StatusBadge, COLOR_PRESETS, cs } from "./shared";
import { maskPhone, maskCpfCnpj, maskDateBr, brDateToIso } from "@/utils/masks";

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
  const { company } = useAuthStore();
  const [siteName, setSiteName] = useState(config.site_name || company?.name || "");
  const [tagline, setTagline] = useState(config.tagline || "");
  const [description, setDescription] = useState(config.description || "");
  const [phone, setPhone] = useState(maskPhone(config.phone || ""));
  const [whatsapp, setWhatsapp] = useState(maskPhone(config.whatsapp || ""));
  const [instagram, setInstagram] = useState(config.instagram || "");
  const [address, setAddress] = useState(config.address || "");
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

  useEffect(() => {
    if (!config.exists) return;
    setSiteName(config.site_name || ""); setTagline(config.tagline || "");
    setDescription(config.description || ""); setPhone(maskPhone(config.phone || ""));
    setWhatsapp(maskPhone(config.whatsapp || "")); setInstagram(config.instagram || "");
    setAddress(config.address || ""); setColor(config.primary_color || "#7c3aed");
    setPublished(config.is_published ?? false);
  }, [config.exists]);

  function openColorPicker() {
    if (Platform.OS !== "web") return;
    try {
      const input = document.createElement("input"); input.type = "color"; input.value = color;
      input.style.cssText = "position:fixed;top:-100px;left:-100px;opacity:0";
      document.body.appendChild(input);
      input.addEventListener("change", (e: any) => { setColor(e.target.value); try { document.body.removeChild(input); } catch {} });
      input.addEventListener("blur", () => { try { document.body.removeChild(input); } catch {} });
      input.click();
    } catch {}
  }

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
    await saveConfig({ site_name: siteName.trim() || null, tagline: tagline.trim() || null, description: description.trim() || null, phone: phone.trim() || null, whatsapp: whatsapp.trim() || null, instagram: instagram.trim() || null, address: address.trim() || null, primary_color: color, is_published: published });
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

  const PIX_TYPES: { value: "MEI" | "LTDA" | "INDIVIDUAL"; label: string }[] = [
    { value: "MEI", label: "MEI" },
    { value: "LTDA", label: "Empresa (LTDA/SA)" },
    { value: "INDIVIDUAL", label: "Pessoa Fisica" },
  ];

  return (
    <View>
      <View style={[s.previewCard, { borderTopWidth: 4, borderTopColor: color }]}>
        <View style={s.previewHeader}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Text style={[s.previewBrand, { color }]}>{siteName || "Meu Negocio"}</Text>
            <View style={[s.publishedBadge, { backgroundColor: published ? Colors.greenD : Colors.bg4 }]}>
              <View style={[s.publishedDot, { backgroundColor: published ? Colors.green : Colors.ink3 }]} />
              <Text style={[s.publishedLabel, { color: published ? Colors.green : Colors.ink3 }]}>{published ? "Publicado" : "Rascunho"}</Text>
            </View>
          </View>
          <Text style={s.previewTagline}>{tagline || description || "Bem-vindo ao nosso site"}</Text>
        </View>
        <View style={s.urlRow}>
          <Icon name="globe" size={12} color={Colors.violet3} />
          <Text style={s.urlText} numberOfLines={1}>{storefrontUrl}</Text>
          <Pressable onPress={() => { if (Platform.OS === "web" && typeof navigator !== "undefined") navigator.clipboard?.writeText(storefrontUrl); toast.info("Link copiado!"); }} style={s.urlCopy}><Text style={s.urlCopyText}>Copiar</Text></Pressable>
          {Platform.OS === "web" && <Pressable onPress={() => Linking.openURL(storefrontUrl)} style={[s.urlCopy, { backgroundColor: Colors.violetD }]}><Text style={s.urlCopyText}>Abrir</Text></Pressable>}
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
        <Text style={cs.fieldLabel}>Cor principal</Text>
        <View style={cs.colorRow}>
          {COLOR_PRESETS.map(c => <Pressable key={c} onPress={() => setColor(c)} style={[cs.colorDot, { backgroundColor: c }, color === c && cs.colorDotActive]} />)}
          {Platform.OS === "web" && <Pressable onPress={openColorPicker} style={[cs.colorDot, { backgroundColor: color, borderWidth: 2, borderColor: Colors.border2 }]} />}
        </View>
        <Pressable onPress={handleSave} disabled={isSaving} style={[cs.saveBtn, isSaving && { opacity: 0.6 }]}><Text style={cs.saveBtnText}>{isSaving ? "Salvando..." : "Salvar configuracoes"}</Text></Pressable>
      </View>

      {/* Identidade Visual */}
      <SectionTitle title="Identidade visual" />
      <View style={cs.card}>
        <Text style={cs.hint}>Personalize o visual da sua loja com logo e imagem de capa.</Text>

        {/* Logo */}
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
                <Icon name="upload" size={13} color={Colors.violet3} />
                <Text style={s.imgBtnText}>{uploadingType === "logo" ? "Enviando..." : config.logo_url ? "Trocar logo" : "Enviar logo"}</Text>
              </Pressable>
            )}
          </View>
        </View>

        <View style={cs.divider} />

        {/* Banner / Capa */}
        <Text style={cs.fieldLabel}>Capa / Banner</Text>
        <View style={s.bannerPreview}>
          {config.cover_url ? (
            <Image source={{ uri: config.cover_url }} style={{ width: "100%", height: "100%", borderRadius: 10 }} resizeMode="cover" />
          ) : (
            <View style={[s.bannerPlaceholder, { backgroundColor: color + "22" }]}>
              <Icon name="image" size={22} color={color} />
              <Text style={[s.bannerPlaceholderText, { color }]}>Sem capa</Text>
            </View>
          )}
        </View>
        {Platform.OS === "web" && (
          <Pressable
            onPress={() => pickImage("banner")}
            disabled={isUploadingImage}
            style={[s.imgBtn, { marginTop: 8 }, isUploadingImage && uploadingType === "banner" && { opacity: 0.6 }]}
          >
            <Icon name="upload" size={13} color={Colors.violet3} />
            <Text style={s.imgBtnText}>{uploadingType === "banner" ? "Enviando..." : config.cover_url ? "Trocar capa" : "Enviar capa"}</Text>
          </Pressable>
        )}
        <Text style={[cs.hint, { marginTop: 8, marginBottom: 0 }]}>Horizontal, min. 1200x400px. PNG ou JPG, max. 5MB</Text>
      </View>

      {/* Pagamentos / Pix */}
      <SectionTitle title="Pagamentos" />
      <View style={cs.card}>
        <View style={s.pixRow}>
          <View style={[s.pixIcon, { backgroundColor: asaasConfigured ? Colors.greenD : Colors.amberD }]}>
            <Text style={{ fontSize: 18 }}>💸</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.pixTitle}>Pix {asaasConfigured ? "ativo" : "nao configurado"}</Text>
            <Text style={s.pixDesc}>
              {asaasConfigured
                ? "Pagamentos Pix habilitados. Clientes pagam diretamente para sua conta."
                : "Ative o Pix para receber pagamentos reais dos seus clientes."}
            </Text>
          </View>
          <View style={[s.pixBadge, { backgroundColor: asaasConfigured ? Colors.greenD : Colors.amberD }]}>
            <Text style={[s.pixBadgeText, { color: asaasConfigured ? Colors.green : Colors.amber }]}>
              {asaasConfigured ? "Ativo" : "Inativo"}
            </Text>
          </View>
        </View>

        {!asaasConfigured && (
          <>
            <View style={cs.divider} />
            {!showPixForm ? (
              <Pressable onPress={() => setShowPixForm(true)} style={s.activatePixBtn}>
                <Text style={{ fontSize: 16 }}>⚡</Text>
                <Text style={s.activatePixBtnText}>Ativar Pix agora</Text>
              </Pressable>
            ) : (
              <View style={s.pixForm}>
                <Text style={s.pixFormTitle}>Dados para ativar o Pix</Text>
                <Text style={s.pixFormHint}>Usamos esses dados para criar sua conta de recebimentos. Leva menos de 1 minuto.</Text>

                <Text style={cs.fieldLabel}>Tipo</Text>
                <View style={s.typeRow}>
                  {PIX_TYPES.map(t => (
                    <Pressable
                      key={t.value}
                      onPress={() => setPixCompanyType(t.value)}
                      style={[s.typeBtn, pixCompanyType === t.value && s.typeBtnActive]}
                    >
                      <Text style={[s.typeBtnText, pixCompanyType === t.value && s.typeBtnTextActive]}>{t.label}</Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={cs.fieldLabel}>{pixCompanyType === "INDIVIDUAL" ? "Nome completo" : "Nome / Razao social"}</Text>
                <TextInput
                  style={cs.input}
                  value={pixName}
                  onChangeText={setPixName}
                  placeholder={pixCompanyType === "INDIVIDUAL" ? "Joao da Silva" : "Empresa Exemplo Ltda"}
                  placeholderTextColor={Colors.ink3}
                />

                <Text style={cs.fieldLabel}>{pixCompanyType === "INDIVIDUAL" ? "CPF" : "CNPJ"}</Text>
                <TextInput
                  style={cs.input}
                  value={pixCpfCnpj}
                  onChangeText={(v) => setPixCpfCnpj(maskCpfCnpj(v))}
                  placeholder={pixCompanyType === "INDIVIDUAL" ? "000.000.000-00" : "00.000.000/0000-00"}
                  placeholderTextColor={Colors.ink3}
                  keyboardType="numeric"
                />

                <Text style={cs.fieldLabel}>E-mail</Text>
                <TextInput
                  style={cs.input}
                  value={pixEmail}
                  onChangeText={setPixEmail}
                  placeholder="contato@empresa.com.br"
                  placeholderTextColor={Colors.ink3}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <Text style={cs.fieldLabel}>Celular</Text>
                <TextInput
                  style={cs.input}
                  value={pixPhone}
                  onChangeText={(v) => setPixPhone(maskPhone(v))}
                  placeholder="(11) 99999-0000"
                  placeholderTextColor={Colors.ink3}
                  keyboardType="phone-pad"
                />

                {dobRequired && (
                  <>
                    <Text style={cs.fieldLabel}>Data de nascimento</Text>
                    <TextInput
                      style={cs.input}
                      value={pixBirthDate}
                      onChangeText={(v) => setPixBirthDate(maskDateBr(v))}
                      placeholder="DD/MM/AAAA"
                      placeholderTextColor={Colors.ink3}
                      keyboardType="numeric"
                      maxLength={10}
                    />
                    <Text style={[cs.hint, { marginTop: -4, marginBottom: 12, fontSize: 11 }]}>
                      O Asaas exige data de nascimento para contas {pixCompanyType === "INDIVIDUAL" ? "PF" : "MEI"}.
                    </Text>
                  </>
                )}

                <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                  <Pressable
                    onPress={() => setShowPixForm(false)}
                    style={s.pixCancelBtn}
                  >
                    <Text style={s.pixCancelBtnText}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleSetupPix}
                    disabled={isSettingUpPix}
                    style={[s.pixConfirmBtn, isSettingUpPix && { opacity: 0.6 }]}
                  >
                    <Text style={s.pixConfirmBtnText}>{isSettingUpPix ? "Ativando..." : "Ativar Pix"}</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </>
        )}
      </View>

      <SectionTitle title="Dominio personalizado" />
      <View style={cs.card}>
        {hasDomain ? (
          <View>
            <View style={s.domainRow}><Icon name="globe" size={16} color={Colors.violet3} /><Text style={s.domainName}>{config.custom_domain}</Text><StatusBadge status={config.custom_domain_status} /></View>
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
            <View style={cs.infoCard}><Icon name="alert" size={13} color={Colors.violet3} /><Text style={cs.infoText}>Apos solicitar, a equipe Aura confirma e configura em ate 48h uteis.</Text></View>
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  previewCard: { backgroundColor: Colors.bg3, borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: Colors.border2, marginBottom: 16 },
  previewHeader: { padding: 20 },
  previewBrand: { fontSize: 20, fontWeight: "800" },
  previewTagline: { fontSize: 13, color: Colors.ink3, marginTop: 4, lineHeight: 18 },
  publishedBadge: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  publishedDot: { width: 6, height: 6, borderRadius: 3 },
  publishedLabel: { fontSize: 10, fontWeight: "700" },
  urlRow: { flexDirection: "row", alignItems: "center", gap: 6, borderTopWidth: 1, borderTopColor: Colors.border, paddingHorizontal: 16, paddingVertical: 10 },
  urlText: { flex: 1, fontSize: 11, color: Colors.violet3, fontWeight: "500" },
  urlCopy: { backgroundColor: Colors.bg4, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: Colors.border },
  urlCopyText: { fontSize: 10, color: Colors.violet3, fontWeight: "600" },
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
