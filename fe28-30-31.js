// fe28-30-31.js
// Run from aura-app root: node fe28-30-31.js
// FE-31: Suporte (Seu Analista de Negocios)
// FE-28: AgentBanner component (proativo embutido nas abas)
// FE-30: Refactor agentes.tsx para painel de atividade

const fs = require('fs');
const p = require('path');
let total = 0;

// ═══════════════════════════════════════════════════
// FE-28: AgentBanner component
// ═══════════════════════════════════════════════════
console.log('\n=== FE-28: AgentBanner component ===');

const bannerFile = p.join('components', 'AgentBanner.tsx');
const bannerContent = `import { useState } from "react";
import { View, Text, Pressable, Platform, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";

type AgentInsight = {
  title: string;
  desc: string;
  action: string;
  actionLabel: string;
  priority: "high" | "medium" | "low";
  icon: string;
};

type Props = {
  agent: string;
  insight: AgentInsight;
  onAction?: () => void;
};

export function AgentBanner({ agent, insight, onAction }: Props) {
  const { company } = useAuthStore();
  const [dismissed, setDismissed] = useState(false);
  const [h, sH] = useState(false);
  const w = Platform.OS === "web";

  // Only show for Negocio+ plans (or demo)
  const plan = company?.plan || "essencial";
  if (plan === "essencial") return null;
  if (dismissed) return null;

  const pc = insight.priority === "high" ? Colors.red : insight.priority === "medium" ? Colors.amber : Colors.green;
  const pcBg = insight.priority === "high" ? Colors.redD : insight.priority === "medium" ? Colors.amberD : Colors.greenD;

  return (
    <Pressable
      onHoverIn={w ? () => sH(true) : undefined}
      onHoverOut={w ? () => sH(false) : undefined}
      style={[s.banner, h && { borderColor: Colors.border2, transform: [{ translateY: -1 }] }, w && { transition: "all 0.2s ease" } as any]}
    >
      <View style={s.row}>
        <View style={[s.icon, { backgroundColor: pc + "18" }]}>
          <Icon name={insight.icon as any} size={18} color={pc} />
        </View>
        <View style={s.info}>
          <View style={s.topRow}>
            <View style={s.agentTag}>
              <Icon name="star" size={10} color={Colors.violet3} />
              <Text style={s.agentLabel}>Agente {agent}</Text>
            </View>
            <View style={[s.priorityBadge, { backgroundColor: pcBg }]}>
              <Text style={[s.priorityText, { color: pc }]}>{insight.priority === "high" ? "Urgente" : insight.priority === "medium" ? "Aten\u00e7\u00e3o" : "Info"}</Text>
            </View>
          </View>
          <Text style={s.title}>{insight.title}</Text>
          <Text style={s.desc} numberOfLines={2}>{insight.desc}</Text>
        </View>
      </View>
      <View style={s.actions}>
        <Pressable onPress={onAction} style={s.actionBtn}>
          <Text style={s.actionText}>{insight.actionLabel}</Text>
          <Icon name="chevron_right" size={14} color="#fff" />
        </Pressable>
        <Pressable onPress={() => setDismissed(true)} style={s.dismissBtn}>
          <Text style={s.dismissText}>Dispensar</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  banner: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  row: { flexDirection: "row", gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 2 },
  info: { flex: 1, gap: 4 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 },
  agentTag: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.violetD, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  agentLabel: { fontSize: 9, fontWeight: "700", color: Colors.violet3, letterSpacing: 0.3 },
  priorityBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  priorityText: { fontSize: 9, fontWeight: "700", letterSpacing: 0.3 },
  title: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  desc: { fontSize: 12, color: Colors.ink3, lineHeight: 17 },
  actions: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.violet, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 },
  actionText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  dismissBtn: { paddingVertical: 10, paddingHorizontal: 12 },
  dismissText: { fontSize: 11, color: Colors.ink3, fontWeight: "500" },
});

export default AgentBanner;
`;
fs.writeFileSync(bannerFile, bannerContent, 'utf-8');
console.log('  OK: components/AgentBanner.tsx created');
total++;

// ═══════════════════════════════════════════════════
// Wire AgentBanner into key tabs
// ═══════════════════════════════════════════════════
console.log('\n=== FE-28: Wiring banners into tabs ===');

const bannerWirings = [
  {
    file: p.join('app', '(tabs)', 'financeiro.tsx'),
    agent: 'Financeiro',
    importCheck: 'AgentBanner',
    importLine: 'import { AgentBanner } from "@/components/AgentBanner";',
    afterPattern: '<TabBar active={activeTab} onSelect={setActiveTab} />',
    jsx: `
        <AgentBanner agent="Financeiro" insight={{ title: "2 cobran\u00e7as em atraso", desc: "Clientes Jo\u00e3o Santos (R$ 1.240) e Carlos Lima (R$ 430) est\u00e3o com pagamento atrasado. Envie lembrete via WhatsApp.", actionLabel: "Enviar cobran\u00e7a", action: "cobrar", priority: "high", icon: "alert" }} onAction={() => toast.info("Enviando cobran\u00e7a via WhatsApp...")} />`
  },
  {
    file: p.join('app', '(tabs)', 'estoque.tsx'),
    agent: 'Estoque',
    importCheck: 'AgentBanner',
    importLine: 'import { AgentBanner } from "@/components/AgentBanner";',
    afterPattern: '<TabBar',
    jsx: `
      <AgentBanner agent="Estoque" insight={{ title: "3 produtos com estoque baixo", desc: "Pomada modeladora (2 un.), Shampoo premium (5 un.) e Kit barba (1 un.) abaixo do m\u00ednimo.", actionLabel: "Criar pedido compra", action: "repor", priority: "high", icon: "package" }} />`
  },
  {
    file: p.join('app', '(tabs)', 'contabilidade.tsx'),
    agent: 'Cont\u00e1bil',
    importCheck: 'AgentBanner',
    importLine: 'import { AgentBanner } from "@/components/AgentBanner";',
    afterPattern: '<TabBar',
    jsx: `
      <AgentBanner agent="Cont\u00e1bil" insight={{ title: "DAS vence em 14 dias", desc: "O DAS-MEI de abril vence em 20/04. Valor estimado: R$ 76,90. Gere o QR Code Pix.", actionLabel: "Gerar QR Code", action: "das", priority: "high", icon: "alert" }} />`
  },
  {
    file: p.join('app', '(tabs)', 'clientes.tsx'),
    agent: 'CRM',
    importCheck: 'AgentBanner',
    importLine: 'import { AgentBanner } from "@/components/AgentBanner";',
    afterPattern: '<TabBar',
    jsx: `
      <AgentBanner agent="CRM" insight={{ title: "5 anivers\u00e1rios esta semana", desc: "Maria Silva (02/04), Pedro Costa (03/04), Ana Oliveira (05/04) e mais 2. Envie uma mensagem!", actionLabel: "Enviar parab\u00e9ns", action: "aniversario", priority: "medium", icon: "users" }} />`
  },
  {
    file: p.join('app', '(tabs)', 'canal.tsx'),
    agent: 'Marketing',
    importCheck: 'AgentBanner',
    importLine: 'import { AgentBanner } from "@/components/AgentBanner";',
    afterPattern: '<TabBar',
    jsx: `
      <AgentBanner agent="Marketing" insight={{ title: "Sugest\u00e3o: post para Instagram", desc: "O combo corte+barba \u00e9 seu produto com maior convers\u00e3o (12%). Que tal um post destacando ele?", actionLabel: "Gerar rascunho", action: "post", priority: "medium", icon: "star" }} />`
  },
];

bannerWirings.forEach(({ file, agent, importCheck, importLine, afterPattern, jsx }) => {
  if (!fs.existsSync(file)) { console.log('  SKIP: ' + file + ' not found'); return; }
  let c = fs.readFileSync(file, 'utf-8');
  if (c.includes(importCheck)) { console.log('  SKIP: ' + p.basename(file) + ' already has banner'); return; }

  // Add import
  const lastImport = c.lastIndexOf('import ');
  const lineEnd = c.indexOf('\n', lastImport);
  c = c.slice(0, lineEnd + 1) + importLine + '\n' + c.slice(lineEnd + 1);

  // Add JSX after TabBar
  const tabIdx = c.indexOf(afterPattern);
  if (tabIdx > -1) {
    const tabLineEnd = c.indexOf('\n', tabIdx);
    c = c.slice(0, tabLineEnd + 1) + jsx + '\n' + c.slice(tabLineEnd + 1);
    fs.writeFileSync(file, c, 'utf-8');
    console.log('  OK: ' + p.basename(file) + ' - Agente ' + agent);
    total++;
  } else {
    console.log('  WARN: TabBar not found in ' + p.basename(file));
  }
});

// ═══════════════════════════════════════════════════
// FE-30: Refactor agentes.tsx to activity panel
// ═══════════════════════════════════════════════════
console.log('\n=== FE-30: Refactor agentes.tsx ===');

const agentesFile = p.join('app', '(tabs)', 'agentes.tsx');
const agentesContent = `import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { IS_WIDE } from "@/constants/helpers";
import { useAuthStore } from "@/stores/auth";
import { PageHeader } from "@/components/PageHeader";
import { Icon } from "@/components/Icon";
import { DemoBanner } from "@/components/DemoBanner";

// Mock activity log - in production, this comes from backend
const ACTIVITY_LOG = [
  { id: "1", agent: "Financeiro", action: "Cobran\u00e7a enviada", detail: "Lembrete WhatsApp para Jo\u00e3o Santos - R$ 1.240,00", time: "Hoje, 14:32", icon: "wallet", status: "done" },
  { id: "2", agent: "Estoque", action: "Alerta de reposi\u00e7\u00e3o", detail: "Pomada modeladora atingiu estoque m\u00ednimo (2 un.)", time: "Hoje, 11:15", icon: "package", status: "pending" },
  { id: "3", agent: "CRM", action: "Parab\u00e9ns enviado", detail: "Mensagem de anivers\u00e1rio para Maria Silva", time: "Hoje, 08:00", icon: "users", status: "done" },
  { id: "4", agent: "Cont\u00e1bil", action: "Lembrete DAS", detail: "DAS-MEI de abril vence em 14 dias - R$ 76,90", time: "Ontem, 20:00", icon: "calculator", status: "pending" },
  { id: "5", agent: "Marketing", action: "Post sugerido", detail: "Rascunho de post para Instagram: combo corte+barba", time: "Ontem, 18:30", icon: "bar_chart", status: "done" },
  { id: "6", agent: "Financeiro", action: "Fluxo de caixa", detail: "Proje\u00e7\u00e3o 30 dias: caixa saud\u00e1vel (margem 46,6%)", time: "Ontem, 09:00", icon: "wallet", status: "info" },
  { id: "7", agent: "CRM", action: "Reativa\u00e7\u00e3o", detail: "8 clientes inativos h\u00e1 30+ dias identificados", time: "28/03, 20:00", icon: "users", status: "pending" },
  { id: "8", agent: "Estoque", action: "Curva ABC", detail: "Relat\u00f3rio atualizado: 80% receita de 3 produtos", time: "28/03, 10:00", icon: "package", status: "info" },
];

const AGENTS_SUMMARY = [
  { name: "Financeiro", icon: "wallet", actions: 12, saved: "3.2h", color: Colors.green },
  { name: "Estoque", icon: "package", actions: 8, saved: "1.8h", color: Colors.amber },
  { name: "CRM", icon: "users", actions: 15, saved: "2.5h", color: Colors.violet3 },
  { name: "Cont\u00e1bil", icon: "calculator", actions: 6, saved: "4.1h", color: Colors.red },
  { name: "Marketing", icon: "bar_chart", actions: 4, saved: "1.0h", color: "#db2777" },
];

function ActivityRow({ item }: { item: typeof ACTIVITY_LOG[0] }) {
  const [h, sH] = useState(false);
  const w = Platform.OS === "web";
  const sc = item.status === "done" ? Colors.green : item.status === "pending" ? Colors.amber : Colors.violet3;
  const sl = item.status === "done" ? "Conclu\u00eddo" : item.status === "pending" ? "Pendente" : "Info";
  return (
    <Pressable onHoverIn={w ? () => sH(true) : undefined} onHoverOut={w ? () => sH(false) : undefined}
      style={[z.actRow, h && { backgroundColor: Colors.bg4 }, w && { transition: "background-color 0.15s ease" } as any]}>
      <View style={[z.actIcon, { backgroundColor: sc + "18" }]}>
        <Icon name={item.icon as any} size={18} color={sc} />
      </View>
      <View style={z.actInfo}>
        <View style={z.actTop}>
          <Text style={z.actAgent}>{item.agent}</Text>
          <View style={[z.actBadge, { backgroundColor: sc + "18" }]}><Text style={[z.actBadgeText, { color: sc }]}>{sl}</Text></View>
        </View>
        <Text style={z.actAction}>{item.action}</Text>
        <Text style={z.actDetail}>{item.detail}</Text>
      </View>
      <Text style={z.actTime}>{item.time}</Text>
    </Pressable>
  );
}

export default function AgentesScreen() {
  const { isDemo } = useAuthStore();
  const totalActions = AGENTS_SUMMARY.reduce((s, a) => s + a.actions, 0);
  const totalSaved = AGENTS_SUMMARY.reduce((s, a) => s + parseFloat(a.saved), 0).toFixed(1);

  return (
    <ScrollView style={z.screen} contentContainerStyle={z.content}>
      <PageHeader title="Agentes" />
      <Text style={z.subtitle}>Painel de atividade dos seus agentes de IA</Text>

      {/* Summary KPIs */}
      <View style={z.kpiRow}>
        <View style={z.kpi}>
          <Text style={z.kpiValue}>{totalActions}</Text>
          <Text style={z.kpiLabel}>A\u00e7\u00f5es este m\u00eas</Text>
        </View>
        <View style={z.kpi}>
          <Text style={[z.kpiValue, { color: Colors.green }]}>{totalSaved}h</Text>
          <Text style={z.kpiLabel}>Tempo economizado</Text>
        </View>
        <View style={z.kpi}>
          <Text style={[z.kpiValue, { color: Colors.violet3 }]}>5</Text>
          <Text style={z.kpiLabel}>Agentes ativos</Text>
        </View>
      </View>

      {/* Agents grid */}
      <Text style={z.sectionTitle}>Seus agentes</Text>
      <View style={z.agentsGrid}>
        {AGENTS_SUMMARY.map(ag => (
          <View key={ag.name} style={z.agentCard}>
            <View style={[z.agentIcon, { backgroundColor: ag.color + "18" }]}>
              <Icon name={ag.icon as any} size={20} color={ag.color} />
            </View>
            <Text style={z.agentName}>{ag.name}</Text>
            <View style={z.agentStats}>
              <Text style={z.agentStat}>{ag.actions} a\u00e7\u00f5es</Text>
              <Text style={[z.agentStat, { color: Colors.green }]}>{ag.saved} salvas</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Activity log */}
      <Text style={z.sectionTitle}>Atividade recente</Text>
      <View style={z.card}>
        {ACTIVITY_LOG.map(item => <ActivityRow key={item.id} item={item} />)}
      </View>

      <View style={z.infoCard}>
        <Icon name="star" size={14} color={Colors.violet3} />
        <Text style={z.infoText}>Os agentes analisam seus dados em tempo real e executam a\u00e7\u00f5es automaticamente. Insights proativos aparecem no topo de cada aba.</Text>
      </View>

      <DemoBanner />
    </ScrollView>
  );
}

const z = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 960, alignSelf: "center", width: "100%" },
  subtitle: { fontSize: 13, color: Colors.ink3, marginBottom: 20, marginTop: -8 },
  // KPIs
  kpiRow: { flexDirection: "row", gap: 8, marginBottom: 24 },
  kpi: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, alignItems: "center", gap: 6 },
  kpiValue: { fontSize: 28, fontWeight: "800", color: Colors.ink },
  kpiLabel: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  // Agents grid
  sectionTitle: { fontSize: 15, fontWeight: "600", color: Colors.ink, marginBottom: 12 },
  agentsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 },
  agentCard: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, minWidth: IS_WIDE ? 160 : "47%", flex: 1, gap: 8, alignItems: "center" },
  agentIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  agentName: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  agentStats: { flexDirection: "row", gap: 10 },
  agentStat: { fontSize: 10, color: Colors.ink3, fontWeight: "500" },
  // Activity log
  card: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  actRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 14, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: Colors.border, borderRadius: 8 },
  actIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 2 },
  actInfo: { flex: 1, gap: 2 },
  actTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  actAgent: { fontSize: 10, fontWeight: "700", color: Colors.violet3, textTransform: "uppercase", letterSpacing: 0.5 },
  actBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  actBadgeText: { fontSize: 8, fontWeight: "700" },
  actAction: { fontSize: 14, fontWeight: "600", color: Colors.ink },
  actDetail: { fontSize: 11, color: Colors.ink3, lineHeight: 16 },
  actTime: { fontSize: 10, color: Colors.ink3, minWidth: 80, textAlign: "right" },
  // Info
  infoCard: { flexDirection: "row", gap: 8, backgroundColor: Colors.violetD, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: Colors.border2 },
  infoText: { fontSize: 11, color: Colors.violet3, flex: 1, lineHeight: 16 },
});
`;
fs.writeFileSync(agentesFile, agentesContent, 'utf-8');
console.log('  OK: agentes.tsx refactored to activity panel');
total++;

// ═══════════════════════════════════════════════════
// FE-31: Suporte screen
// ═══════════════════════════════════════════════════
console.log('\n=== FE-31: Suporte (Seu Analista de Neg\u00f3cios) ===');

const suporteFile = p.join('app', '(tabs)', 'suporte.tsx');
const suporteContent = `import { useState, useRef } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Platform, Linking } from "react-native";
import { Colors } from "@/constants/colors";
import { IS_WIDE } from "@/constants/helpers";
import { useAuthStore } from "@/stores/auth";
import { PageHeader } from "@/components/PageHeader";
import { Icon } from "@/components/Icon";
import { DemoBanner } from "@/components/DemoBanner";
import { toast } from "@/components/Toast";

const AURA_EMAIL = "suporte@getaura.com.br";
const AURA_WHATSAPP = "5512999990000";

const MOCK_MESSAGES = [
  { id: "1", from: "analyst", name: "Equipe Aura", text: "Ol\u00e1! Sou seu Analista de Neg\u00f3cios na Aura. Estou aqui para ajudar com configura\u00e7\u00f5es, d\u00favidas, leitura de dados e acompanhamento de prazos. Como posso te ajudar hoje?", time: "09:00" },
  { id: "2", from: "user", text: "Oi! Preciso de ajuda para entender meu DRE deste m\u00eas.", time: "09:15" },
  { id: "3", from: "analyst", name: "Equipe Aura", text: "Claro! Analisando seus dados de mar\u00e7o: sua margem l\u00edquida est\u00e1 em 46,6%, que \u00e9 excelente para o segmento. As despesas fixas representam 17% do faturamento. Quer que eu detalhe alguma categoria espec\u00edfica?", time: "09:18" },
  { id: "4", from: "user", text: "Sim, quero entender melhor as despesas operacionais.", time: "09:20" },
  { id: "5", from: "analyst", name: "Equipe Aura", text: "Suas despesas operacionais somam R$ 894,80 este m\u00eas. Os principais itens s\u00e3o: material de limpeza (R$ 45,90), insumos (R$ 320,00) e manuten\u00e7\u00e3o (R$ 528,90). Comparando com fevereiro, houve aumento de 8% - principalmente pela manuten\u00e7\u00e3o. Posso ajudar a identificar oportunidades de redu\u00e7\u00e3o?", time: "09:22" },
];

const QUICK_ACTIONS = [
  { label: "Ajuda com configura\u00e7\u00e3o", icon: "settings" },
  { label: "Entender meus dados", icon: "bar_chart" },
  { label: "D\u00favida sobre obriga\u00e7\u00f5es", icon: "calculator" },
  { label: "Suporte t\u00e9cnico", icon: "alert" },
];

function ChatBubble({ msg }: { msg: typeof MOCK_MESSAGES[0] }) {
  const isAnalyst = msg.from === "analyst";
  return (
    <View style={[z.bubble, isAnalyst ? z.bubbleAnalyst : z.bubbleUser]}>
      {isAnalyst && (
        <View style={z.analystHeader}>
          <View style={z.analystAvatar}><Icon name="star" size={12} color={Colors.violet3} /></View>
          <Text style={z.analystName}>{msg.name}</Text>
        </View>
      )}
      <Text style={z.bubbleText}>{msg.text}</Text>
      <Text style={z.bubbleTime}>{msg.time}</Text>
    </View>
  );
}

export default function SuporteScreen() {
  const { user, isDemo } = useAuthStore();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState(MOCK_MESSAGES);

  function sendMessage() {
    if (!message.trim()) return;
    const newMsg = { id: Date.now().toString(), from: "user", text: message.trim(), time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) };
    setMessages(prev => [...prev, newMsg]);
    setMessage("");
    // Simulate analyst response
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(), from: "analyst", name: "Equipe Aura",
        text: "Recebi sua mensagem! Um analista vai responder em breve. Tempo m\u00e9dio de resposta: 2h \u00fateis.",
        time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      }]);
    }, 1500);
  }

  return (
    <ScrollView style={z.screen} contentContainerStyle={z.content}>
      <PageHeader title="Seu Analista de Neg\u00f3cios" />

      {/* Hero card */}
      <View style={z.heroCard}>
        <View style={z.heroIcon}>
          <Icon name="star" size={28} color={Colors.violet3} />
        </View>
        <Text style={z.heroTitle}>Um membro extra na sua equipe</Text>
        <Text style={z.heroDesc}>Seu Analista de Neg\u00f3cios est\u00e1 dispon\u00edvel para configura\u00e7\u00e3o, leitura de dados, acompanhamento de prazos, d\u00favidas e suporte t\u00e9cnico.</Text>
        <View style={z.heroStats}>
          <View style={z.heroStat}>
            <Text style={z.heroStatValue}>2h</Text>
            <Text style={z.heroStatLabel}>Tempo resposta</Text>
          </View>
          <View style={z.heroStatDivider} />
          <View style={z.heroStat}>
            <Text style={z.heroStatValue}>Seg-S\u00e1b</Text>
            <Text style={z.heroStatLabel}>8h \u00e0s 18h</Text>
          </View>
          <View style={z.heroStatDivider} />
          <View style={z.heroStat}>
            <Text style={[z.heroStatValue, { color: Colors.green }]}>Incluso</Text>
            <Text style={z.heroStatLabel}>No seu plano</Text>
          </View>
        </View>
      </View>

      {/* Contact buttons */}
      <View style={z.contactRow}>
        <Pressable onPress={() => { Linking.openURL("https://wa.me/" + AURA_WHATSAPP); toast.success("Abrindo WhatsApp..."); }} style={[z.contactBtn, { backgroundColor: "#25D366" }]}>
          <Icon name="star" size={18} color="#fff" />
          <Text style={z.contactBtnText}>WhatsApp</Text>
        </Pressable>
        <Pressable onPress={() => { Linking.openURL("mailto:" + AURA_EMAIL); toast.success("Abrindo e-mail..."); }} style={[z.contactBtn, { backgroundColor: Colors.violet }]}>
          <Icon name="file_text" size={18} color="#fff" />
          <Text style={z.contactBtnText}>E-mail</Text>
        </Pressable>
      </View>

      {/* Chat section */}
      <Text style={z.sectionTitle}>Chat com seu analista</Text>

      {/* Quick actions */}
      <View style={z.quickRow}>
        {QUICK_ACTIONS.map(qa => (
          <Pressable key={qa.label} onPress={() => setMessage(qa.label)} style={z.quickBtn}>
            <Icon name={qa.icon as any} size={14} color={Colors.violet3} />
            <Text style={z.quickText}>{qa.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Messages */}
      <View style={z.chatCard}>
        {messages.map(msg => <ChatBubble key={msg.id} msg={msg} />)}
      </View>

      {/* Reply bar */}
      <View style={z.replyBar}>
        <TextInput style={z.replyInput} value={message} onChangeText={setMessage} placeholder="Digite sua mensagem..." placeholderTextColor={Colors.ink3} onSubmitEditing={sendMessage} />
        <Pressable onPress={sendMessage} style={z.sendBtn}>
          <Icon name="chevron_right" size={18} color="#fff" />
        </Pressable>
      </View>

      <DemoBanner />
    </ScrollView>
  );
}

const z = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 960, alignSelf: "center", width: "100%" },
  // Hero
  heroCard: { backgroundColor: Colors.violetD, borderRadius: 20, padding: 28, borderWidth: 1, borderColor: Colors.border2, alignItems: "center", marginBottom: 20, gap: 10 },
  heroIcon: { width: 60, height: 60, borderRadius: 20, backgroundColor: Colors.bg3, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border, marginBottom: 4 },
  heroTitle: { fontSize: 20, fontWeight: "800", color: Colors.ink, textAlign: "center" },
  heroDesc: { fontSize: 13, color: Colors.ink3, textAlign: "center", lineHeight: 20, maxWidth: 400 },
  heroStats: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 0 },
  heroStat: { alignItems: "center", paddingHorizontal: 20, gap: 4 },
  heroStatValue: { fontSize: 16, fontWeight: "800", color: Colors.ink },
  heroStatLabel: { fontSize: 10, color: Colors.ink3 },
  heroStatDivider: { width: 1, height: 32, backgroundColor: Colors.border },
  // Contact
  contactRow: { flexDirection: "row", gap: 10, marginBottom: 24 },
  contactBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, paddingVertical: 14 },
  contactBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  // Section
  sectionTitle: { fontSize: 15, fontWeight: "600", color: Colors.ink, marginBottom: 12 },
  // Quick actions
  quickRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 16 },
  quickBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.bg3, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.border },
  quickText: { fontSize: 11, color: Colors.ink3, fontWeight: "500" },
  // Chat
  chatCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 16, gap: 12 },
  bubble: { maxWidth: "80%", borderRadius: 16, padding: 14, gap: 4 },
  bubbleAnalyst: { alignSelf: "flex-start", backgroundColor: Colors.bg4 },
  bubbleUser: { alignSelf: "flex-end", backgroundColor: Colors.violet },
  analystHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  analystAvatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center" },
  analystName: { fontSize: 11, fontWeight: "700", color: Colors.violet3 },
  bubbleText: { fontSize: 13, color: Colors.ink, lineHeight: 19 },
  bubbleTime: { fontSize: 9, color: Colors.ink3, alignSelf: "flex-end" },
  // Reply
  replyBar: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  replyInput: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 12, fontSize: 13, color: Colors.ink, borderWidth: 1, borderColor: Colors.border },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.violet, alignItems: "center", justifyContent: "center" },
});
`;
fs.writeFileSync(suporteFile, suporteContent, 'utf-8');
console.log('  OK: suporte.tsx created');
total++;

// ═══════════════════════════════════════════════════
// Update sidebar - add Suporte
// ═══════════════════════════════════════════════════
console.log('\n=== Updating sidebar for Suporte ===');

const layoutFile = p.join('app', '(tabs)', '_layout.tsx');
if (fs.existsSync(layoutFile)) {
  let c = fs.readFileSync(layoutFile, 'utf-8');
  if (c.includes('/suporte')) {
    console.log('  SKIP: suporte already in sidebar');
  } else {
    // Add Suporte after Contabilidade in the Contabil section
    c = c.replace(
      '{ s: "Contabil", i: [{ r: "/contabilidade", l: "Contabilidade", ic: "calculator" }]}',
      '{ s: "Contabil", i: [{ r: "/contabilidade", l: "Contabilidade", ic: "calculator" },{ r: "/suporte", l: "Seu Analista", ic: "star" }]}'
    );
    fs.writeFileSync(layoutFile, c, 'utf-8');
    console.log('  OK: Suporte added to sidebar (Contabil section)');
    total++;
  }
}

// ═══════════════════════════════════════════════════
console.log('\n========================================');
console.log('DONE: ' + total + ' changes applied');
console.log('========================================');
console.log('\nRun:');
console.log('  node scripts/fix-unicode-all.js');
console.log('  git add -A && git commit -m "feat: FE-31 Suporte + FE-28 AgentBanner + FE-30 activity panel"');
console.log('  git push origin main');
