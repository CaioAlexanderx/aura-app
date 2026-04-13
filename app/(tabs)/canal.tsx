import { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  TextInput, Platform, Switch, Linking, Dimensions,
} from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { useDigitalChannel } from "@/hooks/useDigitalChannel";
import { PageHeader } from "@/components/PageHeader";
import { TabBar } from "@/components/TabBar";
import { HoverRow } from "@/components/HoverRow";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { ListSkeleton } from "@/components/ListSkeleton";
import { BASE_URL } from "@/services/api";

const IS_WIDE = (typeof window !== "undefined" ? window.innerWidth : Dimensions.get("window").width) > 768;
const TABS = ["Meu Site", "Vitrine", "Entrega"];

const COLOR_PRESETS = [
  "#7c3aed", "#059669", "#dc2626", "#d97706",
  "#2563eb", "#db2777", "#0891b2", "#374151",
];

function Field({ label, value, onChange, placeholder, multiline }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; multiline?: boolean;
}) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={[s.input, multiline && s.textarea]}
        value={value} onChangeText={onChange}
        placeholder={placeholder} placeholderTextColor={Colors.ink3}
        multiline={multiline} numberOfLines={multiline ? 3 : 1}
      />
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={s.sectionTitle}>{title}</Text>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    active:      { label: "Ativo",         bg: Colors.greenD,  color: Colors.green },
    pending_dns: { label: "Aguardando DNS", bg: Colors.amberD, color: Colors.amber },
    none:        { label: "Sem dominio",    bg: Colors.bg4,    color: Colors.ink3 },
  };
  const st = map[status] || map.none;
  return (
    <View style={[s.badge, { backgroundColor: st.bg }]}>
      <Text style={[s.badgeText, { color: st.color }]}>{st.label}</Text>
    </View>
  );
}

function TabMeuSite({ config, saveConfig, isSaving, requestDomain, isRequestingDomain }: any) {
  const { company } = useAuthStore();

  const [siteName,    setSiteName]    = useState(config.site_name || company?.name || "");
  const [tagline,     setTagline]     = useState(config.tagline    || "");
  const [description, setDescription] = useState(config.description || "");
  const [phone,       setPhone]       = useState(config.phone     || "");
  const [whatsapp,    setWhatsapp]    = useState(config.whatsapp   || "");
  const [instagram,   setInstagram]   = useState(config.instagram  || "");
  const [address,     setAddress]     = useState(config.address    || "");
  const [color,       setColor]       = useState(config.primary_color || "#7c3aed");
  const [published,   setPublished]   = useState(config.is_published ?? false);
  const [domainInput, setDomainInput] = useState("");
  const [domainPlan,  setDomainPlan]  = useState<"1year" | "2years">("1year");

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
    await saveConfig({
      site_name: siteName.trim() || null, tagline: tagline.trim() || null,
      description: description.trim() || null, phone: phone.trim() || null,
      whatsapp: whatsapp.trim() || null, instagram: instagram.trim() || null,
      address: address.trim() || null, primary_color: color, is_published: published,
    });
  }

  async function handleRequestDomain() {
    const d = domainInput.trim().toLowerCase();
    if (!d || !d.includes(".")) { toast.error("Informe um dominio valido (ex: meunegocio.com.br)"); return; }
    await requestDomain({ domain: d, plan: domainPlan }); setDomainInput("");
  }

  // URL funcional apontando pro backend HTML renderer
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
              <Text style={[s.publishedLabel, { color: published ? Colors.green : Colors.ink3 }]}>
                {published ? "Publicado" : "Rascunho"}
              </Text>
            </View>
          </View>
          <Text style={s.previewTagline}>{tagline || description || "Bem-vindo ao nosso site"}</Text>
        </View>
        <View style={s.urlRow}>
          <Icon name="globe" size={12} color={Colors.violet3} />
          <Text style={s.urlText} numberOfLines={1}>{storefrontUrl}</Text>
          <Pressable onPress={() => {
            if (Platform.OS === "web" && typeof navigator !== "undefined") navigator.clipboard?.writeText(storefrontUrl);
            toast.info("Link copiado!");
          }} style={s.urlCopy}><Text style={s.urlCopyText}>Copiar</Text></Pressable>
          {Platform.OS === "web" && (
            <Pressable onPress={() => Linking.openURL(storefrontUrl)} style={[s.urlCopy, { backgroundColor: Colors.violetD }]}>
              <Text style={s.urlCopyText}>Abrir</Text>
            </Pressable>
          )}
        </View>
      </View>

      <SectionTitle title="Informacoes do negocio" />
      <View style={s.card}>
        <View style={s.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.switchLabel}>Site publicado</Text>
            <Text style={s.switchHint}>{published ? "Visivel para clientes" : "Site oculto"}</Text>
          </View>
          <Switch value={published} onValueChange={setPublished} trackColor={{ true: Colors.green, false: Colors.bg4 }} thumbColor={"#fff"} />
        </View>
        <View style={s.divider} />
        <Field label="Nome do negocio" value={siteName} onChange={setSiteName} placeholder="Ex: Barbearia do Caio" />
        <Field label="Slogan (opcional)" value={tagline} onChange={setTagline} placeholder="Qualidade que fala por si" />
        <Field label="Descricao" value={description} onChange={setDescription} placeholder="Conte sobre seu negocio..." multiline />
        <Field label="WhatsApp" value={whatsapp} onChange={setWhatsapp} placeholder="(12) 99999-0000" />
        <Field label="Instagram" value={instagram} onChange={setInstagram} placeholder="@seunegocio" />
        <Field label="Telefone" value={phone} onChange={setPhone} placeholder="(12) 3333-0000" />
        <Field label="Endereco" value={address} onChange={setAddress} placeholder="Rua Principal, 100 - Jacarei/SP" />

        <Text style={s.fieldLabel}>Cor principal</Text>
        <View style={s.colorRow}>
          {COLOR_PRESETS.map(c => (
            <Pressable key={c} onPress={() => setColor(c)} style={[s.colorDot, { backgroundColor: c }, color === c && s.colorDotActive]} />
          ))}
          {Platform.OS === "web" && (
            <Pressable onPress={openColorPicker} style={[s.colorDot, { backgroundColor: color, borderWidth: 2, borderColor: Colors.border2 }]} />
          )}
        </View>

        <Pressable onPress={handleSave} disabled={isSaving} style={[s.saveBtn, isSaving && { opacity: 0.6 }]}>
          <Text style={s.saveBtnText}>{isSaving ? "Salvando..." : "Salvar configuracoes"}</Text>
        </Pressable>
      </View>

      <SectionTitle title="Dominio personalizado" />
      <View style={s.card}>
        {hasDomain ? (
          <View>
            <View style={s.domainRow}>
              <Icon name="globe" size={16} color={Colors.violet3} />
              <Text style={s.domainName}>{config.custom_domain}</Text>
              <StatusBadge status={config.custom_domain_status} />
            </View>
            {config.custom_domain_status === "pending_dns" && (
              <View style={s.infoCard}><Icon name="alert" size={13} color={Colors.amber} /><Text style={s.infoText}>A equipe Aura vai configurar seu dominio em ate 48h uteis.</Text></View>
            )}
          </View>
        ) : (
          <View>
            <Text style={s.domainDesc}>Registre um dominio .com.br exclusivo. Configurado pela equipe Aura.</Text>
            <Text style={s.fieldLabel}>Duracao</Text>
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
            <Text style={[s.fieldLabel, { marginTop: 12 }]}>Dominio desejado</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput style={[s.input, { flex: 1 }]} value={domainInput} onChangeText={setDomainInput}
                placeholder="meunegocio.com.br" placeholderTextColor={Colors.ink3} autoCapitalize="none" autoCorrect={false} />
              <Pressable onPress={handleRequestDomain} disabled={isRequestingDomain} style={[s.domainBtn, isRequestingDomain && { opacity: 0.6 }]}>
                <Text style={s.domainBtnText}>{isRequestingDomain ? "..." : "Solicitar"}</Text>
              </Pressable>
            </View>
            <View style={s.infoCard}><Icon name="alert" size={13} color={Colors.violet3} /><Text style={s.infoText}>Apos solicitar, a equipe Aura confirma e configura em ate 48h uteis.</Text></View>
          </View>
        )}
      </View>
    </View>
  );
}

function TabVitrine({ config, products, saveConfig, isSaving }: any) {
  const featuredInit: Set<string> = new Set(config.featured_product_ids || []);
  const [featured, setFeatured] = useState<Set<string>>(featuredInit);
  const [showPrices, setShowPrices] = useState(config.show_prices ?? true);
  const [showStock, setShowStock] = useState(config.show_stock ?? false);
  const [catFilter, setCatFilter] = useState("Todos");
  const [changed, setChanged] = useState(false);

  useEffect(() => {
    setFeatured(new Set(config.featured_product_ids || []));
    setShowPrices(config.show_prices ?? true);
    setShowStock(config.show_stock ?? false);
    setChanged(false);
  }, [config.featured_product_ids?.join(",")]);

  function toggleProduct(id: string) {
    setFeatured(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
    setChanged(true);
  }

  async function handleSave() {
    await saveConfig({ featured_product_ids: Array.from(featured), show_prices: showPrices, show_stock: showStock });
    setChanged(false);
  }

  const cats = ["Todos", ...Array.from(new Set((products as any[]).map((p: any) => p.category).filter(Boolean)))];
  const filtered = catFilter === "Todos" ? products : (products as any[]).filter((p: any) => p.category === catFilter);

  return (
    <View>
      <View style={s.kpiRow}>
        <View style={s.kpi}><Text style={s.kpiLabel}>TOTAL</Text><Text style={s.kpiValue}>{(products as any[]).length}</Text></View>
        <View style={s.kpi}><Text style={s.kpiLabel}>NA VITRINE</Text><Text style={[s.kpiValue, { color: Colors.green }]}>{featured.size}</Text></View>
        <View style={s.kpi}><Text style={s.kpiLabel}>OCULTOS</Text><Text style={[s.kpiValue, { color: Colors.ink3 }]}>{(products as any[]).length - featured.size}</Text></View>
      </View>

      <View style={s.card}>
        <View style={s.switchRow}>
          <Text style={s.switchLabel}>Mostrar precos</Text>
          <Switch value={showPrices} onValueChange={(v) => { setShowPrices(v); setChanged(true); }} trackColor={{ true: Colors.green, false: Colors.bg4 }} thumbColor="#fff" />
        </View>
        <View style={[s.switchRow, { borderBottomWidth: 0 }]}>
          <Text style={s.switchLabel}>Mostrar estoque</Text>
          <Switch value={showStock} onValueChange={(v) => { setShowStock(v); setChanged(true); }} trackColor={{ true: Colors.green, false: Colors.bg4 }} thumbColor="#fff" />
        </View>
      </View>

      <Text style={s.hint}>Selecione os produtos que aparecem na vitrine.</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 12 }} contentContainerStyle={{ flexDirection: "row", gap: 6 }}>
        {cats.map(c => (
          <Pressable key={c} onPress={() => setCatFilter(c)} style={[s.filterChip, catFilter === c && s.filterChipActive]}>
            <Text style={[s.filterText, catFilter === c && s.filterTextActive]}>{c}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {(products as any[]).length === 0 ? (
        <View style={s.emptyBox}>
          <Icon name="package" size={28} color={Colors.ink3} />
          <Text style={s.emptyText}>Nenhum produto cadastrado</Text>
          <Text style={s.emptyHint}>Cadastre produtos no Estoque para exibi-los na vitrine.</Text>
        </View>
      ) : (
        <View style={s.card}>
          {(filtered as any[]).map((prod: any) => {
            const isFeatured = featured.has(prod.id || prod.product_id);
            const id = prod.id || prod.product_id;
            return (
              <HoverRow key={id} style={s.prodRow}>
                <View style={s.prodLeft}>
                  {prod.image_url ? (
                    <View style={{ width: 40, height: 40, borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg4 }}>
                      {Platform.OS === "web" ? (
                        <img src={prod.image_url} alt={prod.name} style={{ width: "100%", height: "100%", objectFit: "cover" } as any} />
                      ) : (
                        <View style={{ width: 40, height: 40, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center" }}>
                          <Icon name="package" size={18} color={Colors.violet3} />
                        </View>
                      )}
                    </View>
                  ) : prod.color ? (
                    <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: prod.color, borderWidth: 1, borderColor: Colors.border }} />
                  ) : (
                    <View style={[s.prodIcon, { backgroundColor: isFeatured ? Colors.violetD : Colors.bg4 }]}>
                      <Icon name="package" size={18} color={isFeatured ? Colors.violet3 : Colors.ink3} />
                    </View>
                  )}
                  <View style={s.prodInfo}>
                    <Text style={s.prodName}>{prod.name}</Text>
                    <Text style={s.prodMeta}>
                      {showPrices ? `R$ ${(parseFloat(prod.price) || 0).toFixed(2)}` : ""}
                      {prod.category ? ` \u00b7 ${prod.category}` : ""}
                    </Text>
                  </View>
                </View>
                <View style={s.prodRight}>
                  <View style={[s.featBadge, { backgroundColor: isFeatured ? Colors.greenD : Colors.bg4 }]}>
                    <Text style={[s.featBadgeText, { color: isFeatured ? Colors.green : Colors.ink3 }]}>{isFeatured ? "Visivel" : "Oculto"}</Text>
                  </View>
                  <Switch value={isFeatured} onValueChange={() => toggleProduct(id)} trackColor={{ true: Colors.green, false: Colors.bg4 }} thumbColor="#fff" />
                </View>
              </HoverRow>
            );
          })}
        </View>
      )}
      {changed && (
        <Pressable onPress={handleSave} disabled={isSaving} style={[s.saveBtn, isSaving && { opacity: 0.6 }]}>
          <Text style={s.saveBtnText}>{isSaving ? "Salvando..." : "Salvar vitrine"}</Text>
        </Pressable>
      )}
    </View>
  );
}

function TabEntrega({ config, saveConfig, isSaving }: any) {
  const [pickup, setPickup] = useState(config.pickup_enabled ?? true);
  const [delivery, setDelivery] = useState(config.delivery_enabled ?? false);
  const [fee, setFee] = useState(String(config.delivery_fee || "0"));
  const [changed, setChanged] = useState(false);

  useEffect(() => {
    setPickup(config.pickup_enabled ?? true); setDelivery(config.delivery_enabled ?? false);
    setFee(String(config.delivery_fee || "0")); setChanged(false);
  }, [config.pickup_enabled, config.delivery_enabled, config.delivery_fee]);

  async function handleSave() {
    await saveConfig({ pickup_enabled: pickup, delivery_enabled: delivery, delivery_fee: parseFloat(fee.replace(",", ".")) || 0 });
    setChanged(false);
  }

  return (
    <View>
      <Text style={s.hint}>Configure como o cliente recebe seu pedido.</Text>
      <View style={s.card}>
        <View style={s.switchRow}>
          <View style={{ flex: 1 }}><Text style={s.switchLabel}>Retirada no local</Text><Text style={s.switchHint}>Cliente busca no estabelecimento</Text></View>
          <Switch value={pickup} onValueChange={(v) => { setPickup(v); setChanged(true); }} trackColor={{ true: Colors.green, false: Colors.bg4 }} thumbColor="#fff" />
        </View>
        <View style={s.switchRow}>
          <View style={{ flex: 1 }}><Text style={s.switchLabel}>Entrega a domicilio</Text><Text style={s.switchHint}>Disponibilize entrega</Text></View>
          <Switch value={delivery} onValueChange={(v) => { setDelivery(v); setChanged(true); }} trackColor={{ true: Colors.green, false: Colors.bg4 }} thumbColor="#fff" />
        </View>
        {delivery && (
          <View style={[s.field, { marginTop: 8 }]}><Text style={s.fieldLabel}>Taxa de entrega (R$)</Text>
            <TextInput style={s.input} value={fee} onChangeText={(v) => { setFee(v); setChanged(true); }} placeholder="0,00" placeholderTextColor={Colors.ink3} keyboardType="decimal-pad" />
          </View>
        )}
      </View>
      <View style={s.infoCard}><Icon name="alert" size={13} color={Colors.violet3} /><Text style={s.infoText}>Integracoes avancadas (Uber Flash, Correios) sao configuradas pela equipe Aura.</Text></View>
      {changed && (
        <Pressable onPress={handleSave} disabled={isSaving} style={[s.saveBtn, isSaving && { opacity: 0.6 }, { marginTop: 16 }]}>
          <Text style={s.saveBtnText}>{isSaving ? "Salvando..." : "Salvar entrega"}</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function CanalDigitalScreen() {
  const [tab, setTab] = useState(0);
  const { company } = useAuthStore();
  const { config, products, isLoading, saveConfig, isSaving, requestDomain, isRequestingDomain } = useDigitalChannel();
  const plan = company?.plan || "essencial";
  const hasAccess = ({ essencial: 0, negocio: 1, expansao: 2 }[plan] ?? 0) >= 1;

  if (!hasAccess) {
    return (
      <ScrollView style={g.screen} contentContainerStyle={g.content}>
        <PageHeader title="Canal Digital" />
        <View style={s.lockBox}>
          <Icon name="globe" size={36} color={Colors.ink3} />
          <Text style={s.lockTitle}>Canal Digital</Text>
          <Text style={s.lockDesc}>Crie sua loja online em minutos. Vitrine de produtos, dominio personalizado e mais.</Text>
          <View style={s.lockBadge}><Text style={s.lockBadgeText}>Disponivel no plano Negocio</Text></View>
          <Pressable style={s.upgradeBtn}><Text style={s.upgradeBtnText}>Ver planos</Text></Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={g.screen} contentContainerStyle={g.content}>
      <PageHeader title="Canal Digital" />
      <View style={s.hero}>
        <View style={s.heroIcon}><Icon name="globe" size={22} color={Colors.violet3} /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.heroTitle}>Sua loja online em minutos</Text>
          <Text style={s.heroDesc}>Configure sua vitrine, personalize e compartilhe o link.</Text>
        </View>
        {config.is_published && (
          <Pressable onPress={() => {
            const slug = config.slug || "minha-loja";
            Linking.openURL(`${BASE_URL}/storefront/${slug}/page`);
          }} style={s.viewSiteBtn}>
            <Icon name="globe" size={13} color={Colors.violet3} />
            <Text style={s.viewSiteBtnText}>Ver site</Text>
          </Pressable>
        )}
      </View>
      <TabBar tabs={TABS} active={tab} onSelect={setTab} />
      {isLoading ? <ListSkeleton rows={4} /> : (
        <>
          {tab === 0 && <TabMeuSite config={config} saveConfig={saveConfig} isSaving={isSaving} requestDomain={requestDomain} isRequestingDomain={isRequestingDomain} />}
          {tab === 1 && <TabVitrine config={config} products={products} saveConfig={saveConfig} isSaving={isSaving} />}
          {tab === 2 && <TabEntrega config={config} saveConfig={saveConfig} isSaving={isSaving} />}
        </>
      )}
    </ScrollView>
  );
}

const g = StyleSheet.create({
  screen:  { flex: 1 },
  content: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 960, alignSelf: "center", width: "100%" },
});

const s = StyleSheet.create({
  hero: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.violetD, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.border2 },
  heroIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.bg3, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border, flexShrink: 0 },
  heroTitle: { fontSize: 14, color: Colors.ink, fontWeight: "700" },
  heroDesc:  { fontSize: 11, color: Colors.ink3, marginTop: 2, lineHeight: 16 },
  viewSiteBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.bg3, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: Colors.border2, flexShrink: 0 },
  viewSiteBtnText: { fontSize: 11, color: Colors.violet3, fontWeight: "600" },
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
  sectionTitle: { fontSize: 13, color: Colors.ink, fontWeight: "700", marginTop: 20, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  card: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border, marginBottom: 12 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 12 },
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 11, color: Colors.ink3, fontWeight: "600", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.3 },
  input: { backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, color: Colors.ink },
  textarea: { minHeight: 80, textAlignVertical: "top" },
  colorRow: { flexDirection: "row", gap: 10, marginTop: 6, marginBottom: 16, flexWrap: "wrap" },
  colorDot: { width: 30, height: 30, borderRadius: 15 },
  colorDotActive: { borderWidth: 3, borderColor: "#fff", transform: [{ scale: 1.15 }] },
  switchRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  switchLabel: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  switchHint: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  saveBtn: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  saveBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  domainDesc: { fontSize: 12, color: Colors.ink3, lineHeight: 18, marginBottom: 16 },
  domainRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  domainName: { flex: 1, fontSize: 14, color: Colors.ink, fontWeight: "600" },
  domainBtn: { backgroundColor: Colors.violet, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 11, flexShrink: 0 },
  domainBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: "700" },
  planRow: { flexDirection: "row", gap: 10, marginTop: 6 },
  planBtn: { flex: 1, backgroundColor: Colors.bg4, borderRadius: 12, padding: 14, borderWidth: 2, borderColor: Colors.border, alignItems: "center", gap: 4 },
  planBtnActive: { borderColor: Colors.violet, backgroundColor: Colors.violetD },
  planBtnLabel: { fontSize: 13, color: Colors.ink3, fontWeight: "600" },
  planBtnPrice: { fontSize: 18, color: Colors.ink3, fontWeight: "800" },
  planBtnLabelActive: { color: Colors.violet3 },
  infoCard: { flexDirection: "row", gap: 8, backgroundColor: Colors.bg4, borderRadius: 12, padding: 14, marginTop: 12, borderWidth: 1, borderColor: Colors.border },
  infoText: { fontSize: 11, color: Colors.ink3, flex: 1, lineHeight: 16 },
  hint: { fontSize: 12, color: Colors.ink3, lineHeight: 18, marginBottom: 12 },
  kpiRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  kpi: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
  kpiLabel: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 },
  kpiValue: { fontSize: 22, fontWeight: "800", color: Colors.ink },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  filterChipActive: { backgroundColor: Colors.violetD, borderColor: Colors.violet },
  filterText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  filterTextActive: { color: Colors.violet3, fontWeight: "600" },
  prodRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  prodLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  prodIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  prodInfo: { flex: 1 },
  prodName: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  prodMeta: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  prodRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  featBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  featBadgeText: { fontSize: 9, fontWeight: "600" },
  emptyBox: { alignItems: "center", paddingVertical: 40, gap: 8, backgroundColor: Colors.bg3, borderRadius: 16, borderWidth: 1, borderColor: Colors.border },
  emptyText: { fontSize: 14, color: Colors.ink3, fontWeight: "600" },
  emptyHint: { fontSize: 12, color: Colors.ink3, textAlign: "center", maxWidth: 280 },
  lockBox: { alignItems: "center", paddingVertical: 48, gap: 12, backgroundColor: Colors.bg3, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, padding: 32 },
  lockTitle: { fontSize: 22, color: Colors.ink, fontWeight: "800" },
  lockDesc: { fontSize: 13, color: Colors.ink3, textAlign: "center", lineHeight: 20, maxWidth: 320 },
  lockBadge: { backgroundColor: Colors.violetD, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, borderWidth: 1, borderColor: Colors.border2 },
  lockBadgeText: { fontSize: 12, color: Colors.violet3, fontWeight: "700" },
  upgradeBtn: { backgroundColor: Colors.violet, borderRadius: 12, paddingHorizontal: 32, paddingVertical: 14 },
  upgradeBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
