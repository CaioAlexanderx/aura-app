// p4-commercial.js
// Run from aura-app root: node p4-commercial.js
// FE-PLANS-01: Plans page with annual toggle (15% OFF)
// FE-TRIAL-01: Trial banner on dashboard
// FE-REFERRAL-01: Referral section in configuracoes

const fs = require('fs');
const p = require('path');

// ============================================================
// FE-PLANS-01: Plans page — app/(tabs)/planos.tsx
// ============================================================

const planosContent = `import { useState } from "react";
import { View, Text, ScrollView, Pressable, Platform, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";

const IS = typeof window !== "undefined" ? window.innerWidth > 768 : false;

const PLANS = [
  {
    key: "essencial", name: "Essencial", subtitle: "Para come\u00e7ar",
    monthly: 89, features: [
      "Financeiro b\u00e1sico", "PDV / Caixa", "Estoque", "NF-e (at\u00e9 50/m\u00eas)",
      "Contabilidade guiada", "Suporte chat", "1 usu\u00e1rio",
    ],
  },
  {
    key: "negocio", name: "Neg\u00f3cio", subtitle: "Para crescer", popular: true,
    monthly: 199, features: [
      "Tudo do Essencial +", "CRM completo", "WhatsApp Business",
      "Canal Digital (loja online)", "Folha de Pagamento", "AgentBanners",
      "NF-e ilimitada", "At\u00e9 3 usu\u00e1rios", "Analista de Neg\u00f3cios",
    ],
  },
  {
    key: "expansao", name: "Expans\u00e3o", subtitle: "Para escalar",
    monthly: 299, features: [
      "Tudo do Neg\u00f3cio +", "5 Agentes IA + chat", "FAB conversacional",
      "Custo Avan\u00e7ado", "Analytics avan\u00e7ado", "Multi-gateway",
      "Usu\u00e1rios ilimitados", "Suporte priorit\u00e1rio",
    ],
  },
];

const ADDONS = [
  { name: "M\u00f3dulo Vertical", price: 69, desc: "Odonto, Sal\u00e3o, Food, Pet... (a partir do Neg\u00f3cio)" },
  { name: "Usu\u00e1rio adicional", price: 19, desc: "Por usu\u00e1rio/m\u00eas (todos os planos)" },
  { name: "Consultoria on-demand", price: 149, desc: "Por hora (m\u00ednimo 2h) \u2014 setup, automa\u00e7\u00f5es, treinamento" },
];

const fmt = (n: number) => "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

export default function PlanosScreen() {
  const [annual, setAnnual] = useState(false);
  const { company, isDemo } = useAuthStore();
  const currentPlan = (company?.plan as string) || "essencial";
  const discount = 0.15;
  const w = Platform.OS === "web";

  function price(monthly: number) {
    if (annual) return Math.round(monthly * (1 - discount) * 100) / 100;
    return monthly;
  }

  function savings(monthly: number) {
    return Math.round(monthly * discount * 12 * 100) / 100;
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: IS ? 32 : 20, paddingBottom: 48, maxWidth: 960, alignSelf: "center", width: "100%" }}>
      <Text style={s.title}>Planos Aura.</Text>
      <Text style={s.subtitle}>Escolha o plano ideal para o seu neg\u00f3cio</Text>

      {/* Annual toggle */}
      <View style={s.toggleWrap}>
        <Pressable onPress={() => setAnnual(false)} style={[s.toggleBtn, !annual && s.toggleActive]}>
          <Text style={[s.toggleText, !annual && s.toggleTextActive]}>Mensal</Text>
        </Pressable>
        <Pressable onPress={() => setAnnual(true)} style={[s.toggleBtn, annual && s.toggleActive]}>
          <Text style={[s.toggleText, annual && s.toggleTextActive]}>Anual</Text>
          <View style={s.discountBadge}><Text style={s.discountText}>15% OFF</Text></View>
        </Pressable>
      </View>

      {annual && (
        <Text style={s.savingsHint}>Economize at\u00e9 {fmt(savings(299))} por ano no plano Expans\u00e3o</Text>
      )}

      {/* Plan cards */}
      <View style={s.plansRow}>
        {PLANS.map(plan => {
          const isCurrent = plan.key === currentPlan;
          const mo = price(plan.monthly);
          return (
            <View key={plan.key} style={[s.planCard, plan.popular && s.planPopular, isCurrent && s.planCurrent]}>
              {plan.popular && <View style={s.popularBadge}><Text style={s.popularText}>Mais popular</Text></View>}
              <Text style={s.planName}>{plan.name}</Text>
              <Text style={s.planSub}>{plan.subtitle}</Text>
              <View style={s.priceRow}>
                {annual && <Text style={s.priceOld}>R$ {plan.monthly}</Text>}
                <Text style={s.priceValue}>R$ {mo.toFixed(2).replace(".", ",")}</Text>
                <Text style={s.pricePeriod}>/{annual ? "m\u00eas (anual)" : "m\u00eas"}</Text>
              </View>
              {annual && <Text style={s.yearlySave}>Economia de {fmt(savings(plan.monthly))}/ano</Text>}
              <View style={s.featuresList}>
                {plan.features.map(f => (
                  <View key={f} style={s.featureRow}>
                    <Icon name="check" size={12} color={Colors.green} />
                    <Text style={s.featureText}>{f}</Text>
                  </View>
                ))}
              </View>
              <Pressable
                style={[s.planBtn, isCurrent && s.planBtnCurrent]}
                onPress={() => isCurrent ? null : toast.info("Upgrade ser\u00e1 habilitado ap\u00f3s integra\u00e7\u00e3o Asaas")}
              >
                <Text style={[s.planBtnText, isCurrent && s.planBtnTextCurrent]}>
                  {isCurrent ? "Plano atual" : "Escolher plano"}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      {/* Add-ons */}
      <Text style={s.sectionTitle}>Add-ons</Text>
      <View style={s.addonsRow}>
        {ADDONS.map(a => (
          <View key={a.name} style={s.addonCard}>
            <Text style={s.addonName}>{a.name}</Text>
            <Text style={s.addonPrice}>R$ {a.price}{a.name.includes("hora") ? "/h" : "/m\u00eas"}</Text>
            <Text style={s.addonDesc}>{a.desc}</Text>
          </View>
        ))}
      </View>

      {isDemo && <View style={s.demo}><Text style={s.demoText}>Modo demonstrativo</Text></View>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 24, fontWeight: "800", color: Colors.ink, textAlign: "center", marginBottom: 4 },
  subtitle: { fontSize: 14, color: Colors.ink3, textAlign: "center", marginBottom: 24 },
  toggleWrap: { flexDirection: "row", justifyContent: "center", gap: 4, backgroundColor: Colors.bg3, borderRadius: 12, padding: 4, alignSelf: "center", marginBottom: 12 },
  toggleBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  toggleActive: { backgroundColor: Colors.violet },
  toggleText: { fontSize: 13, color: Colors.ink3, fontWeight: "600" },
  toggleTextActive: { color: "#fff" },
  discountBadge: { backgroundColor: Colors.green, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  discountText: { fontSize: 9, color: "#fff", fontWeight: "700" },
  savingsHint: { fontSize: 12, color: Colors.green, textAlign: "center", marginBottom: 20, fontWeight: "500" },
  plansRow: { flexDirection: IS ? "row" : "column", gap: 12, marginBottom: 32 },
  planCard: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 20, padding: 24, borderWidth: 1.5, borderColor: Colors.border },
  planPopular: { borderColor: Colors.violet, borderWidth: 2 },
  planCurrent: { borderColor: Colors.green + "66" },
  popularBadge: { backgroundColor: Colors.violet, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start", marginBottom: 8 },
  popularText: { fontSize: 10, color: "#fff", fontWeight: "700" },
  planName: { fontSize: 20, fontWeight: "800", color: Colors.ink, marginBottom: 2 },
  planSub: { fontSize: 12, color: Colors.ink3, marginBottom: 16 },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 4, marginBottom: 4 },
  priceOld: { fontSize: 14, color: Colors.ink3, textDecorationLine: "line-through" },
  priceValue: { fontSize: 28, fontWeight: "800", color: Colors.ink },
  pricePeriod: { fontSize: 12, color: Colors.ink3 },
  yearlySave: { fontSize: 11, color: Colors.green, fontWeight: "500", marginBottom: 16 },
  featuresList: { gap: 8, marginBottom: 20, marginTop: 8 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  featureText: { fontSize: 13, color: Colors.ink, fontWeight: "500" },
  planBtn: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  planBtnCurrent: { backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.green + "44" },
  planBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  planBtnTextCurrent: { color: Colors.green },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: Colors.ink, marginBottom: 12 },
  addonsRow: { flexDirection: IS ? "row" : "column", gap: 10, marginBottom: 32 },
  addonCard: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border },
  addonName: { fontSize: 14, fontWeight: "700", color: Colors.ink, marginBottom: 4 },
  addonPrice: { fontSize: 18, fontWeight: "800", color: Colors.violet3, marginBottom: 4 },
  addonDesc: { fontSize: 11, color: Colors.ink3, lineHeight: 16 },
  demo: { alignSelf: "center", backgroundColor: Colors.violetD, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  demoText: { fontSize: 11, color: Colors.violet3, fontWeight: "500" },
});
`;

// ============================================================
// FE-TRIAL-01: Trial banner component
// ============================================================

const trialBannerContent = `import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { Icon } from "@/components/Icon";

export function TrialBanner() {
  const { trialActive, trialEndsAt, isDemo } = useAuthStore();
  const router = useRouter();

  if (isDemo || !trialActive || !trialEndsAt) return null;

  const now = new Date();
  const end = new Date(trialEndsAt);
  const daysLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000));
  const urgent = daysLeft <= 2;

  return (
    <View style={[s.banner, urgent && s.bannerUrgent]}>
      <View style={s.left}>
        <Icon name="star" size={16} color={urgent ? Colors.red : Colors.amber} />
        <View style={s.textWrap}>
          <Text style={[s.title, urgent && { color: Colors.red }]}>
            Teste gr\u00e1tis \u00b7 {daysLeft} {daysLeft === 1 ? "dia restante" : "dias restantes"}
          </Text>
          <Text style={s.sub}>
            {urgent
              ? "Seu per\u00edodo de teste termina em breve. Assine para n\u00e3o perder acesso."
              : "Voc\u00ea est\u00e1 no per\u00edodo de teste do plano Neg\u00f3cio."}
          </Text>
        </View>
      </View>
      <Pressable onPress={() => router.push("/planos" as any)} style={s.btn}>
        <Text style={s.btnText}>Assinar agora</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  banner: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: Colors.amberD, borderRadius: 12, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: Colors.amber + "33", flexWrap: "wrap", gap: 10,
  },
  bannerUrgent: { backgroundColor: Colors.redD, borderColor: Colors.red + "33" },
  left: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 200 },
  textWrap: { flex: 1 },
  title: { fontSize: 13, fontWeight: "700", color: Colors.amber },
  sub: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  btn: { backgroundColor: Colors.violet, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 },
  btnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
});
`;

// ============================================================
// FE-REFERRAL-01: Referral card component
// ============================================================

const referralContent = `import { useState, useEffect } from "react";
import { View, Text, Pressable, StyleSheet, Platform, Alert } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { referralsApi } from "@/services/api";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";

export function ReferralCard() {
  const { user, isDemo, token } = useAuthStore();
  const [code, setCode] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, completed: 0, pending: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token || isDemo) return;
    loadReferrals();
  }, [token]);

  async function loadReferrals() {
    try {
      const data = await referralsApi.mine();
      setCode(data.code?.code || null);
      setStats(data.stats || { total: 0, completed: 0, pending: 0 });
    } catch {}
  }

  async function generateCode() {
    setLoading(true);
    try {
      const data = await referralsApi.generate();
      setCode(data.code);
      toast.success("C\u00f3digo de indica\u00e7\u00e3o gerado!");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao gerar c\u00f3digo");
    } finally {
      setLoading(false);
    }
  }

  function copyCode() {
    if (!code) return;
    if (Platform.OS === "web" && typeof navigator !== "undefined") {
      navigator.clipboard.writeText(code);
      toast.success("C\u00f3digo copiado!");
    }
  }

  function shareWhatsApp() {
    if (!code) return;
    const msg = encodeURIComponent(
      "Oi! Estou usando a Aura pra gerenciar meu neg\u00f3cio e est\u00e1 sendo incr\u00edvel. " +
      "Vou te dar 20% de desconto no primeiro m\u00eas.\\n\\n" +
      "Use o c\u00f3digo " + code + " ou acesse:\\n" +
      "https://getaura.com.br/r/" + code
    );
    const url = "https://wa.me/?text=" + msg;
    if (Platform.OS === "web") window.open(url, "_blank");
  }

  if (isDemo) {
    return (
      <View style={s.card}>
        <View style={s.header}>
          <Icon name="star" size={20} color={Colors.violet3} />
          <Text style={s.title}>Indique e ganhe</Text>
        </View>
        <Text style={s.desc}>
          Ganhe 20% de desconto indicando amigos. Quem voc\u00ea indicar tamb\u00e9m ganha 20% no primeiro m\u00eas.
        </Text>
        <View style={s.codeBox}>
          <Text style={s.codeLabel}>Seu c\u00f3digo</Text>
          <Text style={s.codeValue}>REF-DEMO</Text>
        </View>
        <Text style={s.demoNote}>Dispon\u00edvel com conta real</Text>
      </View>
    );
  }

  return (
    <View style={s.card}>
      <View style={s.header}>
        <Icon name="star" size={20} color={Colors.violet3} />
        <Text style={s.title}>Indique e ganhe</Text>
      </View>
      <Text style={s.desc}>
        Ganhe 20% de desconto indicando amigos. Quem voc\u00ea indicar tamb\u00e9m ganha 20% no primeiro m\u00eas.
      </Text>

      {code ? (
        <>
          <View style={s.codeBox}>
            <Text style={s.codeLabel}>Seu c\u00f3digo</Text>
            <Text style={s.codeValue}>{code}</Text>
          </View>
          <View style={s.actions}>
            <Pressable onPress={copyCode} style={s.actionBtn}>
              <Icon name="clipboard" size={14} color={Colors.violet3} />
              <Text style={s.actionText}>Copiar</Text>
            </Pressable>
            <Pressable onPress={shareWhatsApp} style={[s.actionBtn, s.whatsBtn]}>
              <Icon name="message" size={14} color="#25D366" />
              <Text style={[s.actionText, { color: "#25D366" }]}>WhatsApp</Text>
            </Pressable>
          </View>
          {stats.total > 0 && (
            <View style={s.statsRow}>
              <View style={s.stat}><Text style={s.statNum}>{stats.completed}</Text><Text style={s.statLabel}>Conclu\u00eddas</Text></View>
              <View style={s.stat}><Text style={s.statNum}>{stats.pending}</Text><Text style={s.statLabel}>Pendentes</Text></View>
              <View style={s.stat}><Text style={[s.statNum, { color: Colors.green }]}>{stats.completed}</Text><Text style={s.statLabel}>Descontos</Text></View>
            </View>
          )}
        </>
      ) : (
        <Pressable onPress={generateCode} style={s.generateBtn} disabled={loading}>
          <Text style={s.generateText}>{loading ? "Gerando..." : "Gerar meu c\u00f3digo"}</Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  title: { fontSize: 16, fontWeight: "700", color: Colors.ink },
  desc: { fontSize: 12, color: Colors.ink3, lineHeight: 18, marginBottom: 16 },
  codeBox: { backgroundColor: Colors.violetD, borderRadius: 12, padding: 16, alignItems: "center", marginBottom: 12, borderWidth: 1, borderColor: Colors.border2 },
  codeLabel: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 },
  codeValue: { fontSize: 22, fontWeight: "800", color: Colors.violet3, letterSpacing: 2 },
  actions: { flexDirection: "row", gap: 8, marginBottom: 12 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  whatsBtn: { borderColor: "#25D366" + "44" },
  actionText: { fontSize: 12, fontWeight: "600", color: Colors.violet3 },
  statsRow: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, alignItems: "center", backgroundColor: Colors.bg4, borderRadius: 10, padding: 10 },
  statNum: { fontSize: 18, fontWeight: "800", color: Colors.ink },
  statLabel: { fontSize: 9, color: Colors.ink3, marginTop: 2 },
  generateBtn: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  generateText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  demoNote: { fontSize: 11, color: Colors.ink3, textAlign: "center", fontStyle: "italic", marginTop: 8 },
});
`;

// ============================================================
// WRITE FILES
// ============================================================

// Plans page
const planosDir = p.join('app', '(tabs)');
fs.writeFileSync(p.join(planosDir, 'planos.tsx'), planosContent, 'utf-8');
console.log('OK: app/(tabs)/planos.tsx created (' + planosContent.length + ' chars)');

// Trial banner component
const compDir = 'components';
fs.writeFileSync(p.join(compDir, 'TrialBanner.tsx'), trialBannerContent, 'utf-8');
console.log('OK: components/TrialBanner.tsx created');

// Referral card component
fs.writeFileSync(p.join(compDir, 'ReferralCard.tsx'), referralContent, 'utf-8');
console.log('OK: components/ReferralCard.tsx created');

// ============================================================
// Wire TrialBanner into Dashboard
// ============================================================
const dashPath = p.join('app', '(tabs)', 'index.tsx');
if (fs.existsSync(dashPath)) {
  let c = fs.readFileSync(dashPath, 'utf-8');

  if (!c.includes('TrialBanner')) {
    // Add import
    c = c.replace(
      'import { DemoTour } from "@/components/DemoTour";',
      'import { DemoTour } from "@/components/DemoTour";\nimport { TrialBanner } from "@/components/TrialBanner";'
    );

    // Add component after DemoTour
    c = c.replace(
      '<DemoTour visible={isDemo} />',
      '<DemoTour visible={isDemo} />\n      <TrialBanner />'
    );

    fs.writeFileSync(dashPath, c, 'utf-8');
    console.log('OK: TrialBanner wired into Dashboard');
  }
}

// ============================================================
// Wire ReferralCard into Configuracoes
// ============================================================
const configPath = p.join('app', '(tabs)', 'configuracoes.tsx');
if (fs.existsSync(configPath)) {
  let c = fs.readFileSync(configPath, 'utf-8');

  if (!c.includes('ReferralCard')) {
    // Add import
    if (c.includes('import { Icon }')) {
      c = c.replace(
        'import { Icon }',
        'import { ReferralCard } from "@/components/ReferralCard";\nimport { Icon }'
      );
    }

    // Add ReferralCard before DemoBanner or at the end of content
    if (c.includes('<DemoBanner')) {
      c = c.replace('<DemoBanner', '<ReferralCard />\n      <DemoBanner');
    } else if (c.includes('isDemo &&')) {
      c = c.replace('isDemo &&', 'true && <ReferralCard />\n      {isDemo &&');
    }

    fs.writeFileSync(configPath, c, 'utf-8');
    console.log('OK: ReferralCard wired into Configuracoes');
  }
}

// ============================================================
// Self-cleanup
// ============================================================
console.log('\nAll P4 commercial features created!');
console.log('Run:');
console.log('  git add -A && git commit -m "feat: P4 - plans page + trial banner + referral card" && git push');

try { fs.unlinkSync('p4-commercial.js'); console.log('Self-deleted p4-commercial.js'); } catch {}
