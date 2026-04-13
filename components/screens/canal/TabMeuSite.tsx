import { useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, Platform, Switch, Linking } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { BASE_URL } from "@/services/api";
import { Field, SectionTitle, StatusBadge, COLOR_PRESETS, cs } from "./shared";

type Props = { config: any; saveConfig: (data: any) => Promise<void>; isSaving: boolean; requestDomain: (data: any) => Promise<void>; isRequestingDomain: boolean };

export function TabMeuSite({ config, saveConfig, isSaving, requestDomain, isRequestingDomain }: Props) {
  const { company } = useAuthStore();
  const [siteName, setSiteName] = useState(config.site_name || company?.name || "");
  const [tagline, setTagline] = useState(config.tagline || "");
  const [description, setDescription] = useState(config.description || "");
  const [phone, setPhone] = useState(config.phone || "");
  const [whatsapp, setWhatsapp] = useState(config.whatsapp || "");
  const [instagram, setInstagram] = useState(config.instagram || "");
  const [address, setAddress] = useState(config.address || "");
  const [color, setColor] = useState(config.primary_color || "#7c3aed");
  const [published, setPublished] = useState(config.is_published ?? false);
  const [domainInput, setDomainInput] = useState("");
  const [domainPlan, setDomainPlan] = useState<"1year" | "2years">("1year");

  useEffect(() => {
    if (!config.exists) return;
    setSiteName(config.site_name || ""); setTagline(config.tagline || "");
    setDescription(config.description || ""); setPhone(config.phone || "");
    setWhatsapp(config.whatsapp || ""); setInstagram(config.instagram || "");
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

  async function handleSave() {
    await saveConfig({ site_name: siteName.trim() || null, tagline: tagline.trim() || null, description: description.trim() || null, phone: phone.trim() || null, whatsapp: whatsapp.trim() || null, instagram: instagram.trim() || null, address: address.trim() || null, primary_color: color, is_published: published });
  }

  async function handleRequestDomain() {
    const d = domainInput.trim().toLowerCase();
    if (!d || !d.includes(".")) { toast.error("Informe um dominio valido (ex: meunegocio.com.br)"); return; }
    await requestDomain({ domain: d, plan: domainPlan }); setDomainInput("");
  }

  const slug = config.slug || (siteName || "minha-loja").toLowerCase().replace(/\s+/g, "-").slice(0, 40);
  const storefrontUrl = config.storefront_url || `${BASE_URL}/storefront/${slug}/page`;
  const hasDomain = config.custom_domain && config.custom_domain_status !== "none";

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
        <Field label="WhatsApp" value={whatsapp} onChange={setWhatsapp} placeholder="(12) 99999-0000" />
        <Field label="Instagram" value={instagram} onChange={setInstagram} placeholder="@seunegocio" />
        <Field label="Telefone" value={phone} onChange={setPhone} placeholder="(12) 3333-0000" />
        <Field label="Endereco" value={address} onChange={setAddress} placeholder="Rua Principal, 100 - Jacarei/SP" />
        <Text style={cs.fieldLabel}>Cor principal</Text>
        <View style={cs.colorRow}>
          {COLOR_PRESETS.map(c => <Pressable key={c} onPress={() => setColor(c)} style={[cs.colorDot, { backgroundColor: c }, color === c && cs.colorDotActive]} />)}
          {Platform.OS === "web" && <Pressable onPress={openColorPicker} style={[cs.colorDot, { backgroundColor: color, borderWidth: 2, borderColor: Colors.border2 }]} />}
        </View>
        <Pressable onPress={handleSave} disabled={isSaving} style={[cs.saveBtn, isSaving && { opacity: 0.6 }]}><Text style={cs.saveBtnText}>{isSaving ? "Salvando..." : "Salvar configuracoes"}</Text></Pressable>
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
