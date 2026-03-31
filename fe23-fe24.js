// fe23-fe24.js
// Run from aura-app root: node fe23-fe24.js
// FE-23: Login/Register → Onboarding integrated (no /onboarding route needed)
// FE-24: Rename Assistente IA → Agentes (contextual per tab)

const fs = require('fs');
const p = require('path');
let total = 0;

// ═══════════════════════════════════════════════════
// FE-23: Integrate onboarding into layout
// After register, onboardingComplete=false → show onboarding overlay
// ═══════════════════════════════════════════════════
console.log('\n=== FE-23: Login → Onboarding integrado ===');

const layout = p.join('app', '(tabs)', '_layout.tsx');
if (fs.existsSync(layout)) {
  let c = fs.readFileSync(layout, 'utf-8');

  if (c.includes('OnboardingOverlay')) {
    console.log('  SKIP: already applied');
  } else {
    // 1. Add import for onboarding
    c = c.replace(
      "import { ToastContainer } from \"@/components/Toast\";",
      "import { ToastContainer } from \"@/components/Toast\";\nimport OnboardingScreen from \"@/app/(tabs)/onboarding\";"
    );
    console.log('  OK: Added onboarding import');

    // 2. Add onboardingComplete to Sidebar's useAuthStore destructure
    // Already destructuring from useAuthStore in Sidebar and TabsLayout, so we check in TabsLayout

    // 3. In TabsLayout, wrap content with onboarding check
    // Find the TabsLayout function and add the onboarding guard
    c = c.replace(
      'export default function TabsLayout() {\n  useWebFonts();\n  const C = useColors();\n  const { isDark } = useThemeStore();',
      'export default function TabsLayout() {\n  useWebFonts();\n  const C = useColors();\n  const { isDark } = useThemeStore();\n  const { onboardingComplete, token } = useAuthStore();'
    );

    // 4. Add onboarding overlay for web version
    c = c.replace(
      "if (w) return (\n    <div style={{ display: \"flex\", flexDirection: \"row\", height: \"100vh\", width: \"100%\", background: C.bg, position: \"relative\" } as any}>\n      <Sidebar />\n      <div key={themeKey} style={{ flex: 1, minHeight: \"100%\", background: grad, overflow: \"auto\", position: \"relative\" } as any}>\n        <ToastContainer />\n        <PageTransition><Slot /></PageTransition>\n      </div>\n    </div>\n  );",
      "if (w && token && !onboardingComplete) return (\n    <div style={{ display: \"flex\", flexDirection: \"row\", height: \"100vh\", width: \"100%\", background: C.bg, position: \"relative\" } as any}>\n      <div key={themeKey} style={{ flex: 1, minHeight: \"100%\", background: grad, overflow: \"auto\", position: \"relative\" } as any}>\n        <ToastContainer />\n        <OnboardingScreen />\n      </div>\n    </div>\n  );\n\n  if (w) return (\n    <div style={{ display: \"flex\", flexDirection: \"row\", height: \"100vh\", width: \"100%\", background: C.bg, position: \"relative\" } as any}>\n      <Sidebar />\n      <div key={themeKey} style={{ flex: 1, minHeight: \"100%\", background: grad, overflow: \"auto\", position: \"relative\" } as any}>\n        <ToastContainer />\n        <PageTransition><Slot /></PageTransition>\n      </div>\n    </div>\n  );"
    );

    // 5. Add mobile version too
    c = c.replace(
      "return (\n    <View style={{ flex: 1, backgroundColor: C.bg }}>\n      <View key={themeKey} style={{ flex: 1 }}>\n        <ToastContainer />\n        <PageTransition><Slot /></PageTransition>\n      </View>\n      <MBar />\n    </View>\n  );",
      "if (token && !onboardingComplete) return (\n    <View style={{ flex: 1, backgroundColor: C.bg }}>\n      <View key={themeKey} style={{ flex: 1 }}>\n        <ToastContainer />\n        <OnboardingScreen />\n      </View>\n    </View>\n  );\n\n  return (\n    <View style={{ flex: 1, backgroundColor: C.bg }}>\n      <View key={themeKey} style={{ flex: 1 }}>\n        <ToastContainer />\n        <PageTransition><Slot /></PageTransition>\n      </View>\n      <MBar />\n    </View>\n  );"
    );

    fs.writeFileSync(layout, c, 'utf-8');
    console.log('  OK: Onboarding overlay integrated into layout');
    console.log('  → After register: shows onboarding fullscreen (no sidebar)');
    console.log('  → After completeOnboarding: shows normal app with sidebar');
    total++;
  }
}

// ═══════════════════════════════════════════════════
// FE-24: Rename IA → Agentes + create screen
// ═══════════════════════════════════════════════════
console.log('\n=== FE-24: Rename IA → Agentes ===');

// 1. Update sidebar navigation
if (fs.existsSync(layout)) {
  let c = fs.readFileSync(layout, 'utf-8');

  if (c.includes('Agentes')) {
    console.log('  SKIP: sidebar already renamed');
  } else {
    c = c.replace(
      '{ r: "/ia", l: "Assistente IA", ic: "star", soon: true }',
      '{ r: "/agentes", l: "Agentes", ic: "star" }'
    );
    fs.writeFileSync(layout, c, 'utf-8');
    console.log('  OK: Sidebar renamed IA → Agentes (enabled, not "soon")');
    total++;
  }
}

// 2. Create agentes.tsx screen
const agentesFile = p.join('app', '(tabs)', 'agentes.tsx');
if (fs.existsSync(agentesFile)) {
  console.log('  SKIP: agentes.tsx already exists');
} else {
  const agentesContent = `import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Platform, TextInput } from "react-native";
import { Colors } from "@/constants/colors";
import { IS_WIDE } from "@/constants/helpers";
import { useAuthStore } from "@/stores/auth";
import { PageHeader } from "@/components/PageHeader";
import { Icon } from "@/components/Icon";
import { DemoBanner } from "@/components/DemoBanner";

const TABS = ["Cont\\u00e1bil", "Financeiro", "Estoque", "CRM", "Marketing"];

type Insight = { id: string; icon: string; title: string; desc: string; action: string; priority: "high" | "medium" | "low" };

const INSIGHTS: Record<string, Insight[]> = {
  "Cont\\u00e1bil": [
    { id: "c1", icon: "alert", title: "DAS vence em 14 dias", desc: "O DAS-MEI de abril vence em 20/04. Valor estimado: R$ 76,90. Gere o QR Code Pix para pagar sem atraso.", action: "Ver obriga\\u00e7\\u00e3o", priority: "high" },
    { id: "c2", icon: "trending_up", title: "Faturamento pr\\u00f3ximo do limite MEI", desc: "Voc\\u00ea est\\u00e1 em 68% do limite anual de R$ 81.000. No ritmo atual, pode ultrapassar em setembro.", action: "Ver proje\\u00e7\\u00e3o", priority: "medium" },
    { id: "c3", icon: "check", title: "FGTS em dia", desc: "Todas as guias de FGTS est\\u00e3o pagas e em dia. Pr\\u00f3ximo vencimento: 07/04.", action: "Ver calend\\u00e1rio", priority: "low" },
  ],
  "Financeiro": [
    { id: "f1", icon: "wallet", title: "Fluxo de caixa positivo", desc: "Seu caixa est\\u00e1 saud\\u00e1vel com margem de 46,6% este m\\u00eas. Receitas superam despesas em R$ 8.580.", action: "Ver resumo", priority: "low" },
    { id: "f2", icon: "alert", title: "2 cobran\\u00e7as em atraso", desc: "Clientes Jo\\u00e3o Santos (R$ 1.240) e Carlos Lima (R$ 430) est\\u00e3o com pagamento atrasado.", action: "Enviar cobran\\u00e7a", priority: "high" },
    { id: "f3", icon: "trending_up", title: "Oportunidade: renegociar fornecedor", desc: "Seus gastos com Distribuidora ABC aumentaram 12% nos \\u00faltimos 3 meses. Considere renegociar.", action: "Ver detalhes", priority: "medium" },
  ],
  "Estoque": [
    { id: "e1", icon: "package", title: "3 produtos com estoque baixo", desc: "Pomada modeladora (2 un.), Shampoo premium (5 un.) e Kit barba (1 un.) est\\u00e3o abaixo do m\\u00ednimo.", action: "Ver estoque", priority: "high" },
    { id: "e2", icon: "trending_up", title: "Produto mais vendido: Corte masculino", desc: "47 vendas este m\\u00eas. Considere criar um combo com barba para aumentar o ticket m\\u00e9dio.", action: "Criar combo", priority: "medium" },
    { id: "e3", icon: "star", title: "Curva ABC atualizada", desc: "80% da receita vem de 3 produtos. Foque o marketing nesses itens para maximizar retorno.", action: "Ver curva ABC", priority: "low" },
  ],
  "CRM": [
    { id: "r1", icon: "users", title: "12 clientes novos este m\\u00eas", desc: "Crescimento de 15% em rela\\u00e7\\u00e3o ao m\\u00eas anterior. Taxa de reten\\u00e7\\u00e3o: 73%.", action: "Ver clientes", priority: "low" },
    { id: "r2", icon: "star", title: "5 anivers\\u00e1rios esta semana", desc: "Maria Silva (02/04), Pedro Costa (03/04), Ana Oliveira (05/04) e mais 2. Envie uma mensagem!", action: "Enviar parab\\u00e9ns", priority: "medium" },
    { id: "r3", icon: "alert", title: "8 clientes inativos h\\u00e1 30+ dias", desc: "Esses clientes n\\u00e3o voltaram no \\u00faltimo m\\u00eas. Uma campanha de reativa\\u00e7\\u00e3o pode recuper\\u00e1-los.", action: "Ver inativos", priority: "high" },
  ],
  "Marketing": [
    { id: "m1", icon: "bar_chart", title: "Seu site teve 234 visitas", desc: "Convers\\u00e3o de 7,7%. Os 3 produtos mais vistos s\\u00e3o: Corte masculino, Combo corte+barba, Shampoo.", action: "Ver analytics", priority: "low" },
    { id: "m2", icon: "star", title: "Sugest\\u00e3o: post para Instagram", desc: "Que tal postar uma foto do combo corte+barba? \\u00c9 seu produto com maior taxa de convers\\u00e3o.", action: "Gerar post", priority: "medium" },
    { id: "m3", icon: "trending_up", title: "Hor\\u00e1rio ideal para postar", desc: "Seus clientes acessam mais entre 18h-20h. Programe posts para esse hor\\u00e1rio.", action: "Ver hor\\u00e1rios", priority: "low" },
  ],
};

function InsightCard({ insight }: { insight: Insight }) {
  const [h, sH] = useState(false);
  const w = Platform.OS === "web";
  const pc = insight.priority === "high" ? Colors.red : insight.priority === "medium" ? Colors.amber : Colors.green;
  const pBg = insight.priority === "high" ? Colors.redD : insight.priority === "medium" ? Colors.amberD : Colors.greenD;
  const pLabel = insight.priority === "high" ? "Urgente" : insight.priority === "medium" ? "Aten\\u00e7\\u00e3o" : "Info";

  return (
    <Pressable
      onHoverIn={w ? () => sH(true) : undefined}
      onHoverOut={w ? () => sH(false) : undefined}
      style={[s.insightCard, h && { borderColor: Colors.border2, transform: [{ translateY: -2 }] }, w && { transition: "all 0.2s ease" }]}
    >
      <View style={s.insightHeader}>
        <View style={[s.insightIcon, { backgroundColor: pc + "18" }]}>
          <Icon name={insight.icon} size={18} color={pc} />
        </View>
        <View style={[s.insightBadge, { backgroundColor: pBg }]}>
          <Text style={[s.insightBadgeText, { color: pc }]}>{pLabel}</Text>
        </View>
      </View>
      <Text style={s.insightTitle}>{insight.title}</Text>
      <Text style={s.insightDesc}>{insight.desc}</Text>
      <Pressable style={s.insightAction}>
        <Text style={s.insightActionText}>{insight.action}</Text>
        <Icon name="chevron_right" size={14} color={Colors.violet3} />
      </Pressable>
    </Pressable>
  );
}

export default function AgentesScreen() {
  const [tab, setTab] = useState(0);
  const { isDemo } = useAuthStore();
  const currentTab = TABS[tab];
  const insights = INSIGHTS[currentTab] || [];

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <PageHeader title="Agentes" />
      <Text style={s.subtitle}>Insights e sugest\\u00f5es contextuais para cada \\u00e1rea do seu neg\\u00f3cio</Text>

      {/* Tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabScroll} contentContainerStyle={s.tabRow}>
        {TABS.map((t, i) => (
          <Pressable key={t} onPress={() => setTab(i)} style={[s.tab, tab === i && s.tabActive]}>
            <Text style={[s.tabText, tab === i && s.tabTextActive]}>{t}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Agent header */}
      <View style={s.agentCard}>
        <View style={s.agentIcon}>
          <Icon name="star" size={24} color={Colors.violet3} />
        </View>
        <View style={s.agentInfo}>
          <Text style={s.agentName}>Agente {currentTab}</Text>
          <Text style={s.agentDesc}>
            {currentTab === "Cont\\u00e1bil" && "Monitora prazos, obriga\\u00e7\\u00f5es e limites fiscais do seu neg\\u00f3cio."}
            {currentTab === "Financeiro" && "Analisa fluxo de caixa, cobran\\u00e7as e oportunidades financeiras."}
            {currentTab === "Estoque" && "Acompanha n\\u00edveis, tendencias de venda e sugest\\u00f5es de compra."}
            {currentTab === "CRM" && "Identifica oportunidades de reten\\u00e7\\u00e3o, anivers\\u00e1rios e reativa\\u00e7\\u00e3o."}
            {currentTab === "Marketing" && "Sugere conte\\u00fados, hor\\u00e1rios e estrat\\u00e9gias para seu Canal Digital."}
          </Text>
        </View>
      </View>

      {/* Insights */}
      <Text style={s.sectionTitle}>{insights.length} insights para voc\\u00ea</Text>
      {insights.map(i => <InsightCard key={i.id} insight={i} />)}

      <DemoBanner />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 960, alignSelf: "center", width: "100%" },
  subtitle: { fontSize: 13, color: Colors.ink3, marginBottom: 20, marginTop: -8 },
  // Tabs
  tabScroll: { flexGrow: 0, marginBottom: 20 },
  tabRow: { flexDirection: "row", gap: 6 },
  tab: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  tabActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  tabText: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  tabTextActive: { color: "#fff", fontWeight: "600" },
  // Agent header
  agentCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: Colors.violetD, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border2, marginBottom: 24 },
  agentIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: Colors.bg3, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border },
  agentInfo: { flex: 1, gap: 4 },
  agentName: { fontSize: 16, fontWeight: "700", color: Colors.ink },
  agentDesc: { fontSize: 12, color: Colors.ink3, lineHeight: 18 },
  // Section
  sectionTitle: { fontSize: 14, fontWeight: "600", color: Colors.ink, marginBottom: 12 },
  // Insight cards
  insightCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: Colors.border, marginBottom: 10 },
  insightHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  insightIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  insightBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  insightBadgeText: { fontSize: 9, fontWeight: "700", letterSpacing: 0.3 },
  insightTitle: { fontSize: 15, fontWeight: "700", color: Colors.ink, marginBottom: 4 },
  insightDesc: { fontSize: 12, color: Colors.ink3, lineHeight: 18, marginBottom: 12 },
  insightAction: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" },
  insightActionText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
});
`;

  fs.writeFileSync(agentesFile, agentesContent, 'utf-8');
  console.log('  OK: agentes.tsx created');
  total++;
}

// ═══════════════════════════════════════════════════
console.log('\n========================================');
console.log('DONE: ' + total + ' changes applied');
console.log('========================================');
console.log('\nRun:');
console.log('  node scripts/fix-unicode-all.js');
console.log('  git add -A && git commit -m "feat: FE-23 onboarding integrated + FE-24 Agentes per tab" && git push');
