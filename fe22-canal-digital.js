// fe22-canal-digital.js
// Run from aura-app root: node fe22-canal-digital.js
// FE-22: Canal Digital complete - mini-site, vitrine, freight, customization

const fs = require('fs');
const p = require('path');
let total = 0;

// ═══════════════════════════════════════════════════
// 1. Create canal.tsx
// ═══════════════════════════════════════════════════
console.log('\n=== FE-22: Creating canal.tsx ===');

const canalFile = p.join('app', '(tabs)', 'canal.tsx');
const canalContent = `import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Platform, Image, Switch } from "react-native";
import { Colors } from "@/constants/colors";
import { IS_WIDE } from "@/constants/helpers";
import { useAuthStore } from "@/stores/auth";
import { PageHeader } from "@/components/PageHeader";
import { TabBar } from "@/components/TabBar";
import { HoverCard } from "@/components/HoverCard";
import { HoverRow } from "@/components/HoverRow";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { DemoBanner } from "@/components/DemoBanner";

const TABS = ["Meu site", "Vitrine", "Frete", "Analytics"];

// ── Mock data ────────────────────────────────────
const MOCK_PRODUCTS = [
  { id: "1", name: "Corte masculino", price: 45.00, img: null, published: true, category: "Servi\\u00e7os" },
  { id: "2", name: "Barba completa", price: 35.00, img: null, published: true, category: "Servi\\u00e7os" },
  { id: "3", name: "Pomada modeladora", price: 49.90, img: null, published: false, category: "Produtos" },
  { id: "4", name: "Shampoo premium", price: 38.00, img: null, published: true, category: "Produtos" },
  { id: "5", name: "Kit barba completo", price: 129.90, img: null, published: false, category: "Kits" },
  { id: "6", name: "Corte + barba combo", price: 70.00, img: null, published: true, category: "Combos" },
];

const MOCK_ANALYTICS = {
  visits: 234, orders: 18, conversion: 7.7, revenue: 1420.00,
  topProducts: [
    { name: "Corte masculino", views: 89, orders: 8 },
    { name: "Corte + barba combo", views: 67, orders: 5 },
    { name: "Shampoo premium", views: 45, orders: 3 },
  ],
  visitsByDay: [28, 32, 41, 35, 38, 30, 30],
};

const FREIGHT_OPTIONS = [
  { id: "uber", name: "Uber Flash", desc: "Entrega r\\u00e1pida via Uber Direct", icon: "cart", enabled: true, estimate: "30-60 min", cost: "A partir de R$ 12" },
  { id: "correios", name: "Correios", desc: "PAC e SEDEX para todo Brasil", icon: "package", enabled: false, estimate: "3-8 dias \\u00fateis", cost: "Calculado por CEP" },
  { id: "transp", name: "Transportadora", desc: "Parceiro log\\u00edstico local", icon: "trending_up", enabled: false, estimate: "1-3 dias \\u00fateis", cost: "Sob consulta" },
  { id: "retira", name: "Retirada no local", desc: "Cliente busca no estabelecimento", icon: "users", enabled: true, estimate: "Imediato", cost: "Gr\\u00e1tis" },
];

// ── Tab: Meu Site ────────────────────────────────
function TabMeuSite() {
  const { company, companyLogo } = useAuthStore();
  const [siteName, setSiteName] = useState(company?.name || "Minha Empresa");
  const [siteDesc, setSiteDesc] = useState("Qualidade e atendimento que voc\\u00ea merece. Confira nossos produtos e servi\\u00e7os.");
  const [siteColor, setSiteColor] = useState("#7c3aed");
  const [sitePublished, setSitePublished] = useState(true);
  const [whatsapp, setWhatsapp] = useState("(12) 99999-0000");
  const [instagram, setInstagram] = useState("@meunegogio");
  const [address, setAddress] = useState("Rua Principal, 100 - Jacare\\u00ed/SP");

  const colors = ["#7c3aed", "#059669", "#dc2626", "#d97706", "#2563eb", "#db2777", "#0891b2"];
  const siteUrl = "getaura.com.br/loja/" + (company?.name || "minha-empresa").toLowerCase().replace(/\\s+/g, "-");

  return (
    <View>
      {/* Preview card */}
      <HoverCard style={z.previewCard}>
        <View style={[z.previewHeader, { backgroundColor: siteColor + "15" }]}>
          <View style={z.previewTopBar}>
            {companyLogo ? (
              <Image source={{ uri: companyLogo }} style={z.previewLogo} resizeMode="contain" />
            ) : (
              <Text style={[z.previewBrand, { color: siteColor }]}>{siteName}</Text>
            )}
            <View style={z.previewNav}>
              <Text style={z.previewNavItem}>In\\u00edcio</Text>
              <Text style={z.previewNavItem}>Produtos</Text>
              <Text style={z.previewNavItem}>Contato</Text>
            </View>
          </View>
          <Text style={z.previewTitle}>{siteName}</Text>
          <Text style={z.previewDesc}>{siteDesc}</Text>
          <View style={[z.previewBtn, { backgroundColor: siteColor }]}>
            <Text style={z.previewBtnText}>Ver produtos</Text>
          </View>
        </View>
        <View style={z.previewFooter}>
          <Text style={z.previewFooterText}>Loja powered by Aura.</Text>
        </View>
      </HoverCard>

      <View style={z.urlRow}>
        <Icon name="bar_chart" size={14} color={Colors.violet3} />
        <Text style={z.urlText}>{siteUrl}</Text>
        <Pressable onPress={() => toast.info("Link copiado!")} style={z.urlCopy}><Text style={z.urlCopyText}>Copiar</Text></Pressable>
      </View>

      {/* Settings */}
      <View style={z.section}>
        <Text style={z.sectionTitle}>Configura\\u00e7\\u00f5es do site</Text>
        <View style={z.card}>
          <View style={z.publishRow}>
            <View style={{ flex: 1 }}>
              <Text style={z.fieldLabel}>Site publicado</Text>
              <Text style={z.fieldHint}>{sitePublished ? "Seu site est\\u00e1 vis\\u00edvel para clientes" : "Site desativado"}</Text>
            </View>
            <Switch value={sitePublished} onValueChange={setSitePublished} trackColor={{ true: Colors.green, false: Colors.bg4 }} />
          </View>
          <Field label="Nome do neg\\u00f3cio" value={siteName} onChange={setSiteName} />
          <Field label="Descri\\u00e7\\u00e3o" value={siteDesc} onChange={setSiteDesc} multiline />
          <Field label="WhatsApp" value={whatsapp} onChange={setWhatsapp} placeholder="(12) 99999-0000" />
          <Field label="Instagram" value={instagram} onChange={setInstagram} placeholder="@seunegogio" />
          <Field label="Endere\\u00e7o" value={address} onChange={setAddress} />

          <Text style={[z.fieldLabel, { marginTop: 12 }]}>Cor principal</Text>
          <View style={z.colorRow}>
            {colors.map(c => (
              <Pressable key={c} onPress={() => setSiteColor(c)} style={[z.colorDot, { backgroundColor: c }, siteColor === c && z.colorDotActive]} />
            ))}
          </View>

          <Pressable onPress={() => toast.success("Configura\\u00e7\\u00f5es salvas")} style={z.saveBtn}>
            <Text style={z.saveBtnText}>Salvar configura\\u00e7\\u00f5es</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ── Tab: Vitrine ─────────────────────────────────
function TabVitrine() {
  const [products, setProducts] = useState(MOCK_PRODUCTS);
  const [filter, setFilter] = useState("all");
  const cats = ["all", ...new Set(MOCK_PRODUCTS.map(p => p.category))];
  const filtered = filter === "all" ? products : products.filter(p => p.category === filter);
  const published = products.filter(p => p.published).length;

  function togglePublish(id) {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, published: !p.published } : p));
    toast.success("Produto atualizado na vitrine");
  }

  return (
    <View>
      <View style={g.row}>
        <SummaryKPI label="PRODUTOS" value={String(products.length)} />
        <SummaryKPI label="PUBLICADOS" value={String(published)} color={Colors.green} />
        <SummaryKPI label="OCULTOS" value={String(products.length - published)} color={Colors.ink3} />
      </View>

      <View style={z.filterRow}>
        {cats.map(c => (
          <Pressable key={c} onPress={() => setFilter(c)} style={[z.filterBtn, filter === c && z.filterBtnActive]}>
            <Text style={[z.filterText, filter === c && z.filterTextActive]}>{c === "all" ? "Todos" : c}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={z.hint}>Selecione quais produtos do estoque aparecem na vitrine do seu site.</Text>

      <View style={z.card}>
        {filtered.map(prod => (
          <HoverRow key={prod.id} style={z.prodRow}>
            <View style={z.prodLeft}>
              <View style={[z.prodImg, { backgroundColor: prod.published ? Colors.violetD : Colors.bg4 }]}>
                <Icon name="package" size={18} color={prod.published ? Colors.violet3 : Colors.ink3} />
              </View>
              <View style={z.prodInfo}>
                <Text style={z.prodName}>{prod.name}</Text>
                <Text style={z.prodMeta}>R$ {prod.price.toFixed(2)} / {prod.category}</Text>
              </View>
            </View>
            <View style={z.prodRight}>
              <View style={[z.prodBadge, { backgroundColor: prod.published ? Colors.greenD : Colors.bg4 }]}>
                <Text style={[z.prodBadgeText, { color: prod.published ? Colors.green : Colors.ink3 }]}>{prod.published ? "Publicado" : "Oculto"}</Text>
              </View>
              <Switch value={prod.published} onValueChange={() => togglePublish(prod.id)} trackColor={{ true: Colors.green, false: Colors.bg4 }} />
            </View>
          </HoverRow>
        ))}
      </View>

      <Pressable onPress={() => toast.info("Importar produtos do estoque")} style={z.importBtn}>
        <Icon name="package" size={16} color={Colors.violet3} />
        <Text style={z.importBtnText}>Importar do estoque</Text>
      </Pressable>
    </View>
  );
}

// ── Tab: Frete ───────────────────────────────────
function TabFrete() {
  const [options, setOptions] = useState(FREIGHT_OPTIONS);

  function toggle(id) {
    setOptions(prev => prev.map(o => o.id === id ? { ...o, enabled: !o.enabled } : o));
    toast.success("Op\\u00e7\\u00e3o de frete atualizada");
  }

  return (
    <View>
      <Text style={z.hint}>Configure as op\\u00e7\\u00f5es de entrega dispon\\u00edveis no seu site. O cliente escolhe na hora da compra.</Text>
      <View style={z.card}>
        {options.map(opt => (
          <HoverRow key={opt.id} style={z.freightRow}>
            <View style={z.freightLeft}>
              <View style={[z.freightIcon, { backgroundColor: opt.enabled ? Colors.violetD : Colors.bg4 }]}>
                <Icon name={opt.icon} size={20} color={opt.enabled ? Colors.violet3 : Colors.ink3} />
              </View>
              <View style={z.freightInfo}>
                <Text style={z.freightName}>{opt.name}</Text>
                <Text style={z.freightDesc}>{opt.desc}</Text>
                <View style={z.freightMeta}>
                  <Text style={z.freightMetaText}>{opt.estimate}</Text>
                  <Text style={z.freightMetaDot}>\\u00b7</Text>
                  <Text style={z.freightMetaText}>{opt.cost}</Text>
                </View>
              </View>
            </View>
            <Switch value={opt.enabled} onValueChange={() => toggle(opt.id)} trackColor={{ true: Colors.green, false: Colors.bg4 }} />
          </HoverRow>
        ))}
      </View>

      <View style={z.infoCard}>
        <Icon name="alert" size={14} color={Colors.amber} />
        <Text style={z.infoText}>Uber Flash requer integra\\u00e7\\u00e3o com Uber Direct (configurado no setup da Aura). Correios e Transportadora exigem contrato com o parceiro.</Text>
      </View>
    </View>
  );
}

// ── Tab: Analytics ────────────────────────────────
function TabAnalytics() {
  const a = MOCK_ANALYTICS;
  const fmt = (n) => "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  return (
    <View>
      <View style={g.row}>
        <SummaryKPI label="VISITAS" value={String(a.visits)} />
        <SummaryKPI label="PEDIDOS" value={String(a.orders)} color={Colors.green} />
        <SummaryKPI label="CONVERS\\u00c3O" value={a.conversion + "%"} color={Colors.violet3} />
        <SummaryKPI label="RECEITA" value={fmt(a.revenue)} color={Colors.green} />
      </View>

      <View style={z.section}>
        <Text style={z.sectionTitle}>Produtos mais vistos</Text>
        <View style={z.card}>
          {a.topProducts.map((p, i) => (
            <HoverRow key={p.name} style={z.topRow}>
              <View style={z.topLeft}>
                <View style={z.topRank}><Text style={z.topRankText}>{i + 1}</Text></View>
                <Text style={z.topName}>{p.name}</Text>
              </View>
              <View style={z.topRight}>
                <Text style={z.topViews}>{p.views} visitas</Text>
                <Text style={z.topOrders}>{p.orders} pedidos</Text>
              </View>
            </HoverRow>
          ))}
        </View>
      </View>

      <View style={z.infoCard}>
        <Icon name="star" size={14} color={Colors.violet3} />
        <Text style={z.infoText}>Analytics em tempo real dispon\\u00edvel ap\\u00f3s publica\\u00e7\\u00e3o do site. Dados atualizados a cada 5 minutos.</Text>
      </View>
    </View>
  );
}

// ── Shared components ────────────────────────────
function Field({ label, value, onChange, placeholder, multiline }) {
  return (
    <View style={z.field}>
      <Text style={z.fieldLabel}>{label}</Text>
      <TextInput style={[z.input, multiline && z.textarea]} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={Colors.ink3} multiline={multiline} />
    </View>
  );
}

function SummaryKPI({ label, value, color }) {
  return (
    <View style={g.kpi}>
      <Text style={g.kpiLabel}>{label}</Text>
      <Text style={[g.kpiValue, color && { color }]}>{value}</Text>
    </View>
  );
}

// ── Main Screen ──────────────────────────────────
export default function CanalDigitalScreen() {
  const [tab, setTab] = useState(0);
  const { isDemo } = useAuthStore();

  return (
    <ScrollView style={g.screen} contentContainerStyle={g.content}>
      <PageHeader title="Canal Digital" />
      <TabBar tabs={TABS} active={tab} onSelect={setTab} />
      {tab === 0 && <TabMeuSite />}
      {tab === 1 && <TabVitrine />}
      {tab === 2 && <TabFrete />}
      {tab === 3 && <TabAnalytics />}
      <DemoBanner />
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────
const g = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 960, alignSelf: "center", width: "100%" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  kpi: { flex: 1, minWidth: IS_WIDE ? 120 : "45%", backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, alignItems: "center", gap: 6 },
  kpiLabel: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.8 },
  kpiValue: { fontSize: 20, fontWeight: "800", color: Colors.ink },
});

const z = StyleSheet.create({
  // Preview
  previewCard: { backgroundColor: Colors.bg3, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: Colors.border2, marginBottom: 16 },
  previewHeader: { padding: 24 },
  previewTopBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  previewLogo: { width: 80, height: 32 },
  previewBrand: { fontSize: 18, fontWeight: "800" },
  previewNav: { flexDirection: "row", gap: 16 },
  previewNavItem: { fontSize: 11, color: Colors.ink3, fontWeight: "500" },
  previewTitle: { fontSize: 22, fontWeight: "800", color: Colors.ink, marginBottom: 6 },
  previewDesc: { fontSize: 13, color: Colors.ink3, lineHeight: 20, marginBottom: 16 },
  previewBtn: { alignSelf: "flex-start", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
  previewBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  previewFooter: { borderTopWidth: 1, borderTopColor: Colors.border, paddingVertical: 10, alignItems: "center" },
  previewFooterText: { fontSize: 9, color: Colors.ink3, fontStyle: "italic" },
  // URL
  urlRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.bg3, borderRadius: 10, padding: 12, marginBottom: 20, borderWidth: 1, borderColor: Colors.border },
  urlText: { flex: 1, fontSize: 12, color: Colors.violet3, fontWeight: "500" },
  urlCopy: { backgroundColor: Colors.violetD, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  urlCopyText: { fontSize: 10, color: Colors.violet3, fontWeight: "600" },
  // Section
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 14, color: Colors.ink, fontWeight: "700", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  card: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border },
  // Fields
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 11, color: Colors.ink3, fontWeight: "600", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.3 },
  fieldHint: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  input: { backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.ink },
  textarea: { minHeight: 80, textAlignVertical: "top" },
  // Color picker
  colorRow: { flexDirection: "row", gap: 10, marginTop: 6, marginBottom: 16 },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  colorDotActive: { borderWidth: 3, borderColor: "#fff" },
  // Publish
  publishRow: { flexDirection: "row", alignItems: "center", marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  // Save
  saveBtn: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  // Hint
  hint: { fontSize: 12, color: Colors.ink3, lineHeight: 18, marginBottom: 16 },
  // Vitrine
  filterRow: { flexDirection: "row", gap: 6, marginBottom: 16, flexWrap: "wrap" },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  filterBtnActive: { backgroundColor: Colors.violetD, borderColor: Colors.violet },
  filterText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  filterTextActive: { color: Colors.violet3, fontWeight: "600" },
  prodRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  prodLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  prodImg: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  prodInfo: { flex: 1, gap: 2 },
  prodName: { fontSize: 14, color: Colors.ink, fontWeight: "600" },
  prodMeta: { fontSize: 11, color: Colors.ink3 },
  prodRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  prodBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  prodBadgeText: { fontSize: 9, fontWeight: "600" },
  importBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.violetD, borderRadius: 12, paddingVertical: 14, marginTop: 16, borderWidth: 1, borderColor: Colors.border2 },
  importBtnText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  // Freight
  freightRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  freightLeft: { flexDirection: "row", gap: 12, flex: 1 },
  freightIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  freightInfo: { flex: 1, gap: 2 },
  freightName: { fontSize: 14, color: Colors.ink, fontWeight: "700" },
  freightDesc: { fontSize: 11, color: Colors.ink3 },
  freightMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  freightMetaText: { fontSize: 10, color: Colors.violet3, fontWeight: "500" },
  freightMetaDot: { fontSize: 10, color: Colors.ink3 },
  // Info card
  infoCard: { flexDirection: "row", gap: 8, backgroundColor: Colors.amberD, borderRadius: 12, padding: 14, marginTop: 16 },
  infoText: { fontSize: 11, color: Colors.amber, flex: 1, lineHeight: 16 },
  // Analytics
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  topLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  topRank: { width: 28, height: 28, borderRadius: 8, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center" },
  topRankText: { fontSize: 12, fontWeight: "700", color: Colors.violet3 },
  topName: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  topRight: { alignItems: "flex-end", gap: 2 },
  topViews: { fontSize: 11, color: Colors.ink3 },
  topOrders: { fontSize: 11, color: Colors.green, fontWeight: "600" },
});
`;

fs.writeFileSync(canalFile, canalContent, 'utf-8');
console.log('  OK: canal.tsx created (' + canalContent.length + ' chars)');
total++;

// ═══════════════════════════════════════════════════
// 2. Update sidebar - remove "soon" from Canal Digital
// ═══════════════════════════════════════════════════
console.log('\n=== Updating sidebar ===');

const layoutFile = p.join('app', '(tabs)', '_layout.tsx');
if (fs.existsSync(layoutFile)) {
  let c = fs.readFileSync(layoutFile, 'utf-8');
  
  // Remove soon: true from Canal Digital
  if (c.includes('{ r: "/canal", l: "Canal Digital", ic: "bar_chart", soon: true }')) {
    c = c.replace(
      '{ r: "/canal", l: "Canal Digital", ic: "bar_chart", soon: true }',
      '{ r: "/canal", l: "Canal Digital", ic: "bar_chart" }'
    );
    fs.writeFileSync(layoutFile, c, 'utf-8');
    console.log('  OK: Canal Digital enabled in sidebar');
    total++;
  } else {
    console.log('  SKIP: Canal Digital sidebar pattern not found');
  }
}

// ═══════════════════════════════════════════════════
console.log('\n========================================');
console.log('DONE: ' + total + ' changes applied');
console.log('========================================');
console.log('\ngit add -A && git commit -m "feat: FE-22 Canal Digital - mini-site, vitrine, frete, analytics" && git push');
