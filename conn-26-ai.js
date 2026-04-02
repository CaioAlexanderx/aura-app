// conn-26-ai.js
// Run from aura-app root: node conn-26-ai.js
// CONN-26: Agentes IA frontend — connect to real API
// Adds: AI API to api.ts + useQuery in agentes.tsx + chat input

const fs = require('fs');
const p = require('path');
let changes = 0;

// ============================================================
// 1. Add AI API to services/api.ts
// ============================================================
console.log('\n=== Adding AI API to api.ts ===');

const apiPath = p.join('services', 'api.ts');
if (fs.existsSync(apiPath)) {
  let c = fs.readFileSync(apiPath, 'utf-8');

  if (!c.includes('aiApi')) {
    c = c.replace(
      'export { request, BASE_URL };',
      `// ── AI / Agentes API ─────────────────────────────────────────
export const aiApi = {
  chat: (companyId: string, message: string, context?: string, history?: any[]) =>
    request<{ response: string; context: string; model: string; usage?: any }>(
      \`/companies/\${companyId}/ai/chat\`,
      { method: "POST", body: { message, context: context || "geral", history: history || [] }, timeout: 30000 }
    ),

  activity: (companyId: string, limit?: number) =>
    request<{ activity: any[]; summary: any[]; total: number }>(
      \`/companies/\${companyId}/ai/activity?limit=\${limit || 20}\`
    ),
};

export { request, BASE_URL };`
    );
    console.log('  OK: Added aiApi (chat + activity) to api.ts');
    changes++;
  }

  fs.writeFileSync(apiPath, c, 'utf-8');
}

// ============================================================
// 2. Update agentes.tsx — connect to real API + add chat
// ============================================================
console.log('\n=== Updating agentes.tsx ===');

const agPath = p.join('app', '(tabs)', 'agentes.tsx');
if (fs.existsSync(agPath)) {
  let c = fs.readFileSync(agPath, 'utf-8');

  // 2a. Add imports
  if (!c.includes('useQuery')) {
    c = c.replace(
      'import { useState } from "react";',
      'import { useState } from "react";\nimport { useQuery, useMutation } from "@tanstack/react-query";\nimport { aiApi } from "@/services/api";\nimport { TextInput } from "react-native";'
    );
    // Remove duplicate TextInput if already imported from RN
    c = c.replace(
      'import { View, Text, ScrollView, StyleSheet, Pressable, Platform } from "react-native";',
      'import { View, Text, ScrollView, StyleSheet, Pressable, Platform, TextInput } from "react-native";'
    );
    // Clean up the extra TextInput import we added
    c = c.replace('import { TextInput } from "react-native";\n', '');
    console.log('  OK: Added useQuery + aiApi imports');
    changes++;
  }

  // 2b. Add API queries + chat state in component
  if (c.includes('const { isDemo } = useAuthStore();') && !c.includes('aiApi.activity')) {
    c = c.replace(
      'const { isDemo } = useAuthStore();',
      `const { isDemo, company, token } = useAuthStore();

  // CONN-26: Fetch real activity from API
  const { data: apiActivity } = useQuery({
    queryKey: ["ai-activity", company?.id],
    queryFn: () => aiApi.activity(company!.id, 20),
    enabled: !!company?.id && !!token && !isDemo,
    retry: 1,
    staleTime: 30000,
  });

  // Chat state
  const [chatMsg, setChatMsg] = useState("");
  const [chatCtx, setChatCtx] = useState("geral");
  const [chatHistory, setChatHistory] = useState<{ role: string; content: string }[]>([]);
  const [chatResponse, setChatResponse] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const chatMutation = useMutation({
    mutationFn: () => aiApi.chat(company!.id, chatMsg, chatCtx, chatHistory),
    onSuccess: (data) => {
      setChatHistory(prev => [...prev, { role: "user", content: chatMsg }, { role: "assistant", content: data.response }]);
      setChatResponse(data.response);
      setChatMsg("");
      setChatLoading(false);
    },
    onError: (err: any) => {
      setChatResponse(err?.message || "Erro ao processar mensagem.");
      setChatLoading(false);
    },
  });

  function handleSendChat() {
    if (!chatMsg.trim() || chatLoading) return;
    setChatLoading(true);
    setChatResponse("");
    chatMutation.mutate();
  }

  // Use API data if available
  const activityData = apiActivity?.activity?.length ? apiActivity.activity.map((a: any) => ({
    id: a.id, agent: a.agent || "Geral",
    action: a.action || "Acao", detail: a.detail || "",
    time: a.time ? new Date(a.time).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "---",
    icon: { Financeiro: "wallet", Estoque: "package", CRM: "users", Contabil: "calculator", Marketing: "bar_chart" }[a.agent] || "star",
    status: a.status || "done",
  })) : ACTIVITY_LOG;

  const summaryData = apiActivity?.summary?.length ? apiActivity.summary.map((s: any) => ({
    name: s.name, icon: { Financeiro: "wallet", Estoque: "package", CRM: "users", Contabil: "calculator", Marketing: "bar_chart" }[s.name] || "star",
    actions: s.actions, saved: (s.actions * 0.25).toFixed(1) + "h",
    color: { Financeiro: Colors.green, Estoque: Colors.amber, CRM: Colors.violet3, Contabil: Colors.red, Marketing: "#db2777" }[s.name] || Colors.violet3,
  })) : AGENTS_SUMMARY;`
    );
    console.log('  OK: Added API queries + chat state');
    changes++;
  }

  // 2c. Replace AGENTS_SUMMARY references with summaryData
  if (c.includes('const totalActions = AGENTS_SUMMARY.reduce')) {
    c = c.replace(
      'const totalActions = AGENTS_SUMMARY.reduce((s, a) => s + a.actions, 0);',
      'const totalActions = summaryData.reduce((s: number, a: any) => s + (a.actions || 0), 0);'
    );
    c = c.replace(
      'const totalSaved = AGENTS_SUMMARY.reduce((s, a) => s + parseFloat(a.saved), 0).toFixed(1);',
      'const totalSaved = summaryData.reduce((s: number, a: any) => s + parseFloat(a.saved || "0"), 0).toFixed(1);'
    );
    console.log('  OK: KPIs use dynamic data');
    changes++;
  }

  // 2d. Replace AGENTS_SUMMARY.map with summaryData.map
  if (c.includes('{AGENTS_SUMMARY.map(ag =>')) {
    c = c.replace('{AGENTS_SUMMARY.map(ag =>', '{summaryData.map((ag: any) =>');
    console.log('  OK: Agents grid uses dynamic data');
    changes++;
  }

  // 2e. Replace ACTIVITY_LOG.map with activityData.map
  if (c.includes('{ACTIVITY_LOG.map(item =>')) {
    c = c.replace('{ACTIVITY_LOG.map(item =>', '{activityData.map((item: any) =>');
    console.log('  OK: Activity log uses dynamic data');
    changes++;
  }

  // 2f. Add chat UI section before the info card
  if (c.includes('<View style={z.infoCard}>') && !c.includes('chatSection')) {
    c = c.replace(
      '<View style={z.infoCard}>',
      `{/* Chat with AI */}
      <Text style={z.sectionTitle}>Conversar com agente</Text>
      <View style={z.chatCard}>
        <View style={z.chatCtxRow}>
          {["geral", "financeiro", "estoque", "crm", "contabil", "marketing"].map(ctx => (
            <Pressable key={ctx} onPress={() => setChatCtx(ctx)}
              style={[z.chatCtxChip, chatCtx === ctx && z.chatCtxChipActive]}>
              <Text style={[z.chatCtxText, chatCtx === ctx && z.chatCtxTextActive]}>
                {ctx.charAt(0).toUpperCase() + ctx.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
        {chatHistory.length > 0 && (
          <View style={z.chatHistory}>
            {chatHistory.slice(-6).map((h, i) => (
              <View key={i} style={[z.chatBubble, h.role === "user" ? z.chatUser : z.chatAssistant]}>
                <Text style={[z.chatBubbleText, h.role === "user" && { color: "#fff" }]}>{h.content}</Text>
              </View>
            ))}
          </View>
        )}
        {chatResponse && chatHistory.length === 0 && (
          <View style={z.chatResponseBox}>
            <Text style={z.chatResponseText}>{chatResponse}</Text>
          </View>
        )}
        <View style={z.chatInputRow}>
          <TextInput style={z.chatInput} value={chatMsg} onChangeText={setChatMsg}
            placeholder="Pergunte algo ao agente..." placeholderTextColor={Colors.ink3}
            onSubmitEditing={handleSendChat} editable={!chatLoading} />
          <Pressable onPress={handleSendChat} style={[z.chatSendBtn, chatLoading && { opacity: 0.5 }]}>
            <Text style={z.chatSendText}>{chatLoading ? "..." : "Enviar"}</Text>
          </Pressable>
        </View>
      </View>

      <View style={z.infoCard}>`
    );
    console.log('  OK: Added chat UI section');
    changes++;
  }

  // 2g. Add chat styles
  if (!c.includes('chatCard')) {
    c = c.replace(
      'infoText: { fontSize: 11, color: Colors.violet3, flex: 1, lineHeight: 16 },',
      `infoText: { fontSize: 11, color: Colors.violet3, flex: 1, lineHeight: 16 },
  // Chat
  chatCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  chatCtxRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  chatCtxChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border },
  chatCtxChipActive: { backgroundColor: Colors.violetD, borderColor: Colors.violet },
  chatCtxText: { fontSize: 11, color: Colors.ink3, fontWeight: "500" },
  chatCtxTextActive: { color: Colors.violet3, fontWeight: "600" },
  chatHistory: { gap: 8, marginBottom: 12, maxHeight: 300 },
  chatBubble: { borderRadius: 12, padding: 12, maxWidth: "85%" },
  chatUser: { backgroundColor: Colors.violet, alignSelf: "flex-end" },
  chatAssistant: { backgroundColor: Colors.bg4, alignSelf: "flex-start", borderWidth: 1, borderColor: Colors.border },
  chatBubbleText: { fontSize: 13, color: Colors.ink, lineHeight: 18 },
  chatResponseBox: { backgroundColor: Colors.bg4, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  chatResponseText: { fontSize: 13, color: Colors.ink, lineHeight: 18 },
  chatInputRow: { flexDirection: "row", gap: 8 },
  chatInput: { flex: 1, backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, color: Colors.ink },
  chatSendBtn: { backgroundColor: Colors.violet, borderRadius: 10, paddingHorizontal: 18, justifyContent: "center" },
  chatSendText: { color: "#fff", fontSize: 13, fontWeight: "700" },`
    );
    console.log('  OK: Added chat styles');
    changes++;
  }

  fs.writeFileSync(agPath, c, 'utf-8');
  console.log('  SAVED: agentes.tsx (' + c.length + ' bytes)');
}

// ============================================================
console.log('\n========================================');
console.log('DONE: ' + changes + ' changes applied');
console.log('========================================');
console.log('  api.ts    — aiApi.chat() + aiApi.activity()');
console.log('  agentes.tsx — useQuery activity + chat UI + dynamic data');
console.log('\nBackend endpoints (already pushed):');
console.log('  POST /companies/:id/ai/chat     — chat with contextual AI');
console.log('  GET  /companies/:id/ai/activity  — activity log');
console.log('\nRun:');
console.log('  git add -A && git commit -m "feat: CONN-26 Agentes IA frontend connected to real API + chat UI" && git push');
