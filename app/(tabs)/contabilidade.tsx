import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { IS_WIDE, fmt } from "@/constants/helpers";
import { SummaryCard } from "@/components/SummaryCard";
import { TabBar } from "@/components/TabBar";
import { HoverCard } from "@/components/HoverCard";
import { HoverRow } from "@/components/HoverRow";
import { DemoBanner } from "@/components/DemoBanner";
import { PageHeader } from "@/components/PageHeader";

const TABS = ["Calendario", "Guias", "Historico"];

// ── Mock Data ────────────────────────────────────────────────

const OBLIGATIONS = [
  { id: "1", name: "DAS-MEI", due: "20/04/2026", daysLeft: 21, amount: 76.90, status: "upcoming" as const, category: "aura_resolve",
    description: "Documento de Arrecadacao do Simples Nacional para MEI. Reune INSS, ISS e ICMS em uma unica guia mensal.",
    steps: ["Aura calcula o valor automaticamente", "QR Code Pix gerado para pagamento", "Aura confirma o pagamento"] },
  { id: "2", name: "FGTS", due: "07/04/2026", daysLeft: 8, amount: 320.00, status: "attention" as const, category: "aura_resolve",
    description: "Fundo de Garantia do Tempo de Servico. Obrigatorio para empresas com funcionarios registrados.",
    steps: ["Aura calcula com base na folha", "Guia gerada automaticamente", "Aura confirma o pagamento"] },
  { id: "3", name: "eSocial", due: "15/04/2026", daysLeft: 16, amount: null, status: "upcoming" as const, category: "aura_facilita",
    description: "Sistema de escrituracao digital das obrigacoes fiscais e trabalhistas. Envia informacoes sobre funcionarios ao governo.",
    steps: ["Aura prepara os dados e gera o arquivo XML", "Voce acessa o portal gov.br/esocial", "Faca login com sua conta Gov.br", "Clique em 'Enviar arquivo'", "Selecione o XML que a Aura gerou", "Confirme o envio - pronto!"] },
  { id: "4", name: "DASN-SIMEI", due: "31/05/2026", daysLeft: 62, amount: null, status: "future" as const, category: "aura_facilita",
    description: "Declaracao Anual do Simples Nacional para MEI. Resume o faturamento do ano anterior.",
    steps: ["Aura consolida seu faturamento anual", "Aura pre-preenche os dados da declaracao", "Voce acessa o portal do Simples Nacional", "Confira os valores e clique em 'Transmitir'"] },
  { id: "5", name: "PGDAS-D", due: "20/04/2026", daysLeft: 21, amount: 1105.20, status: "upcoming" as const, category: "aura_facilita",
    description: "Programa Gerador do Documento de Arrecadacao do Simples Nacional. Apura a receita bruta mensal para calculo do DAS.",
    steps: ["Aura apura sua receita bruta do mes", "Aura calcula o DAS estimado", "Voce acessa o PGDAS-D no portal do Simples", "Confira os valores que a Aura preparou", "Transmita a apuracao e pague o DAS gerado"] },
];

const COMPLETED = [
  { id: "c1", name: "DAS-MEI", month: "Marco/2026", completedAt: "18/03/2026", amount: 76.90 },
  { id: "c2", name: "FGTS", month: "Marco/2026", completedAt: "05/03/2026", amount: 320.00 },
  { id: "c3", name: "DAS-MEI", month: "Fevereiro/2026", completedAt: "18/02/2026", amount: 76.90 },
  { id: "c4", name: "FGTS", month: "Fevereiro/2026", completedAt: "06/02/2026", amount: 320.00 },
  { id: "c5", name: "DAS-MEI", month: "Janeiro/2026", completedAt: "19/01/2026", amount: 76.90 },
];

const STREAK = { current: 3, best: 5, total: 12 };

// ── Category Badge ───────────────────────────────────────────

function CatBadge({ category }: { category: string }) {
  const isResolve = category === "aura_resolve";
  return (
    <View style={[cb.badge, { backgroundColor: isResolve ? Colors.greenD : Colors.amberD }]}>
      <Text style={[cb.text, { color: isResolve ? Colors.green : Colors.amber }]}>
        {isResolve ? "Aura resolve" : "Aura facilita, voce resolve"}
      </Text>
    </View>
  );
}
const cb = StyleSheet.create({
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" },
  text: { fontSize: 9, fontWeight: "700", letterSpacing: 0.3 },
});

// ── Status Indicator ─────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  const colors = { attention: Colors.red, upcoming: Colors.amber, future: Colors.ink3 };
  return <View style={[sd.dot, { backgroundColor: (colors as any)[status] || Colors.ink3 }]} />;
}
const sd = StyleSheet.create({ dot: { width: 10, height: 10, borderRadius: 5 } });

// ── Obligation Card (Calendar tab) ───────────────────────────

function ObligationCard({ obl, onOpenGuide }: { obl: typeof OBLIGATIONS[0]; onOpenGuide: () => void }) {
  const isWeb = Platform.OS === "web";
  const urgencyColor = obl.daysLeft <= 7 ? Colors.red : obl.daysLeft <= 15 ? Colors.amber : Colors.ink3;
  const urgencyLabel = obl.daysLeft <= 7 ? "Urgente" : obl.daysLeft <= 15 ? "Em breve" : "Agendado";

  return (
    <HoverCard style={oc.card}>
      <View style={oc.header}>
        <View style={oc.headerLeft}>
          <StatusDot status={obl.status} />
          <Text style={oc.name}>{obl.name}</Text>
        </View>
        <View style={[oc.urgencyBadge, { backgroundColor: urgencyColor + "18" }]}>
          <Text style={[oc.urgencyText, { color: urgencyColor }]}>{urgencyLabel}</Text>
        </View>
      </View>

      <Text style={oc.desc}>{obl.description}</Text>

      <View style={oc.infoRow}>
        <View style={oc.infoItem}>
          <Text style={oc.infoLabel}>Vencimento</Text>
          <Text style={oc.infoValue}>{obl.due}</Text>
        </View>
        <View style={oc.infoItem}>
          <Text style={oc.infoLabel}>Prazo</Text>
          <Text style={[oc.infoValue, { color: urgencyColor }]}>{obl.daysLeft} dias</Text>
        </View>
        {obl.amount != null && (
          <View style={oc.infoItem}>
            <Text style={oc.infoLabel}>Valor estimado</Text>
            <Text style={oc.infoValue}>{fmt(obl.amount)}</Text>
          </View>
        )}
      </View>

      <CatBadge category={obl.category} />

      <View style={oc.footer}>
        <Pressable onPress={onOpenGuide} style={oc.guideBtn}>
          <Text style={oc.guideBtnText}>Ver guia passo a passo</Text>
        </Pressable>
        {obl.category === "aura_resolve" && obl.amount != null && (
          <Pressable style={oc.payBtn}>
            <Text style={oc.payBtnText}>Pagar com Pix</Text>
          </Pressable>
        )}
      </View>
    </HoverCard>
  );
}
const oc = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: Colors.border, marginBottom: 12 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { fontSize: 16, color: Colors.ink, fontWeight: "700" },
  urgencyBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  urgencyText: { fontSize: 10, fontWeight: "700" },
  desc: { fontSize: 12, color: Colors.ink3, lineHeight: 18, marginBottom: 14 },
  infoRow: { flexDirection: "row", gap: 16, marginBottom: 12, flexWrap: "wrap" },
  infoItem: { gap: 3 },
  infoLabel: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  infoValue: { fontSize: 14, color: Colors.ink, fontWeight: "700" },
  footer: { flexDirection: "row", gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border, flexWrap: "wrap" },
  guideBtn: { backgroundColor: Colors.violetD, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border2 },
  guideBtnText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  payBtn: { backgroundColor: Colors.violet, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  payBtnText: { fontSize: 12, color: "#fff", fontWeight: "700" },
});

// ── Guide View ───────────────────────────────────────────────

function GuideView({ obl, onBack }: { obl: typeof OBLIGATIONS[0]; onBack: () => void }) {
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const isResolve = obl.category === "aura_resolve";
  const allDone = completedSteps.length === obl.steps.length;

  function toggleStep(i: number) {
    setCompletedSteps(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);
  }

  return (
    <View>
      <Pressable onPress={onBack} style={gv.backBtn}>
        <Text style={gv.backText}>{"<"} Voltar</Text>
      </Pressable>

      <View style={gv.header}>
        <Text style={gv.title}>{obl.name}</Text>
        <CatBadge category={obl.category} />
      </View>

      <Text style={gv.desc}>{obl.description}</Text>

      <View style={gv.metaRow}>
        <View style={gv.metaItem}><Text style={gv.metaLabel}>Vencimento</Text><Text style={gv.metaValue}>{obl.due}</Text></View>
        <View style={gv.metaItem}><Text style={gv.metaLabel}>Prazo</Text><Text style={gv.metaValue}>{obl.daysLeft} dias</Text></View>
        {obl.amount != null && <View style={gv.metaItem}><Text style={gv.metaLabel}>Valor estimado</Text><Text style={gv.metaValue}>{fmt(obl.amount)}</Text></View>}
      </View>

      <View style={gv.divider} />

      <Text style={gv.stepsTitle}>Passo a passo</Text>
      <Text style={gv.stepsHint}>
        {isResolve ? "A Aura cuida de tudo automaticamente. Acompanhe o progresso:" : "A Aura prepara os dados. Siga os passos para concluir:"}
      </Text>

      <View style={gv.stepsList}>
        {obl.steps.map((step, i) => {
          const done = completedSteps.includes(i);
          const isAuraStep = step.toLowerCase().startsWith("aura");
          return (
            <Pressable key={i} onPress={() => toggleStep(i)} style={[gv.stepRow, done && gv.stepDone]}>
              <View style={[gv.stepCheck, done && gv.stepCheckDone]}>
                <Text style={[gv.stepCheckText, done && gv.stepCheckTextDone]}>{done ? "OK" : String(i + 1)}</Text>
              </View>
              <View style={gv.stepContent}>
                <Text style={[gv.stepText, done && gv.stepTextDone]}>{step}</Text>
                {isAuraStep && !done && <Text style={gv.stepAuto}>Automatico</Text>}
              </View>
            </Pressable>
          );
        })}
      </View>

      {allDone && (
        <View style={gv.completeBanner}>
          <Text style={gv.completeIcon}>OK</Text>
          <Text style={gv.completeText}>Todos os passos concluidos!</Text>
        </View>
      )}

      <View style={gv.disclaimer}>
        <Text style={gv.disclaimerIcon}>i</Text>
        <Text style={gv.disclaimerText}>
          Valores e prazos sao estimativas para apoio contabil. Consulte sempre o portal oficial para confirmacao.
        </Text>
      </View>
    </View>
  );
}
const gv = StyleSheet.create({
  backBtn: { marginBottom: 16 },
  backText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  title: { fontSize: 22, color: Colors.ink, fontWeight: "700" },
  desc: { fontSize: 13, color: Colors.ink3, lineHeight: 20, marginBottom: 16 },
  metaRow: { flexDirection: "row", gap: 20, marginBottom: 16, flexWrap: "wrap" },
  metaItem: { gap: 3 },
  metaLabel: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  metaValue: { fontSize: 16, color: Colors.ink, fontWeight: "700" },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 16 },
  stepsTitle: { fontSize: 16, color: Colors.ink, fontWeight: "700", marginBottom: 4 },
  stepsHint: { fontSize: 12, color: Colors.ink3, marginBottom: 16, lineHeight: 18 },
  stepsList: { gap: 6, marginBottom: 20 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.bg3, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border },
  stepDone: { borderColor: Colors.green + "44", backgroundColor: Colors.greenD },
  stepCheck: { width: 32, height: 32, borderRadius: 10, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border },
  stepCheckDone: { backgroundColor: Colors.green, borderColor: Colors.green },
  stepCheckText: { fontSize: 12, fontWeight: "700", color: Colors.ink3 },
  stepCheckTextDone: { color: "#fff" },
  stepContent: { flex: 1, gap: 2 },
  stepText: { fontSize: 13, color: Colors.ink, fontWeight: "500" },
  stepTextDone: { color: Colors.ink3, textDecorationLine: "line-through" },
  stepAuto: { fontSize: 10, color: Colors.violet3, fontWeight: "500" },
  completeBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.greenD, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: Colors.green + "44" },
  completeIcon: { fontSize: 16, color: Colors.green, fontWeight: "800" },
  completeText: { fontSize: 13, color: Colors.green, fontWeight: "600" },
  disclaimer: { flexDirection: "row", gap: 8, backgroundColor: Colors.amberD, borderRadius: 12, padding: 14 },
  disclaimerIcon: { fontSize: 14, color: Colors.amber, fontWeight: "700" },
  disclaimerText: { fontSize: 11, color: Colors.amber, flex: 1, lineHeight: 16 },
});

// ── Guides List ──────────────────────────────────────────────

function GuidesList({ obligations, onSelect }: { obligations: typeof OBLIGATIONS; onSelect: (id: string) => void }) {
  const resolves = obligations.filter(o => o.category === "aura_resolve");
  const facilita = obligations.filter(o => o.category === "aura_facilita");

  function Section({ title, hint, items, color }: { title: string; hint: string; items: typeof OBLIGATIONS; color: string }) {
    return (
      <View style={gl.section}>
        <View style={gl.sectionHeader}>
          <View style={[gl.sectionDot, { backgroundColor: color }]} />
          <View>
            <Text style={gl.sectionTitle}>{title}</Text>
            <Text style={gl.sectionHint}>{hint}</Text>
          </View>
        </View>
        {items.map(obl => (
          <HoverRow key={obl.id} style={gl.guideRow} onPress={() => onSelect(obl.id)}>
            <View style={gl.guideLeft}>
              <Text style={gl.guideName}>{obl.name}</Text>
              <Text style={gl.guideSteps}>{obl.steps.length} passos</Text>
            </View>
            <View style={gl.guideRight}>
              {obl.amount != null && <Text style={gl.guideAmount}>{fmt(obl.amount)}</Text>}
              <Text style={gl.guideArrow}>{">"}</Text>
            </View>
          </HoverRow>
        ))}
      </View>
    );
  }

  return (
    <View>
      <View style={gl.intro}>
        <Text style={gl.introIcon}>i</Text>
        <Text style={gl.introText}>
          Guias passo a passo para resolver suas obrigacoes contabeis. A Aura prepara os dados e te guia pelo processo.
        </Text>
      </View>
      <Section title="Aura resolve" hint="A Aura cuida de tudo automaticamente" items={resolves} color={Colors.green} />
      <Section title="Aura facilita, voce resolve" hint="A Aura prepara, voce confirma no portal oficial" items={facilita} color={Colors.amber} />
    </View>
  );
}
const gl = StyleSheet.create({
  intro: { flexDirection: "row", gap: 8, backgroundColor: Colors.violetD, borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: Colors.border2 },
  introIcon: { fontSize: 14, color: Colors.violet3, fontWeight: "700" },
  introText: { fontSize: 12, color: Colors.ink2, flex: 1, lineHeight: 18 },
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  sectionDot: { width: 10, height: 10, borderRadius: 5 },
  sectionTitle: { fontSize: 15, color: Colors.ink, fontWeight: "700" },
  sectionHint: { fontSize: 11, color: Colors.ink3, marginTop: 1 },
  guideRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, paddingHorizontal: 14, borderRadius: 12, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, marginBottom: 6 },
  guideLeft: { gap: 2 },
  guideName: { fontSize: 14, color: Colors.ink, fontWeight: "600" },
  guideSteps: { fontSize: 11, color: Colors.ink3 },
  guideRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  guideAmount: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  guideArrow: { fontSize: 16, color: Colors.ink3, fontWeight: "600" },
});

// ── History Tab ──────────────────────────────────────────────

function HistoryTab() {
  return (
    <View>
      {/* Streak */}
      <HoverCard style={ht.streakCard}>
        <View style={ht.streakHeader}>
          <Text style={ht.streakTitle}>Sequencia de conformidade</Text>
          <View style={ht.streakBadge}><Text style={ht.streakBadgeText}>{STREAK.current} meses</Text></View>
        </View>
        <Text style={ht.streakHint}>Voce esta em dia com suas obrigacoes ha {STREAK.current} meses consecutivos!</Text>
        <View style={ht.streakStats}>
          <View style={ht.streakStat}>
            <Text style={ht.streakStatValue}>{STREAK.current}</Text>
            <Text style={ht.streakStatLabel}>Atual</Text>
          </View>
          <View style={ht.streakStat}>
            <Text style={[ht.streakStatValue, { color: Colors.amber }]}>{STREAK.best}</Text>
            <Text style={ht.streakStatLabel}>Recorde</Text>
          </View>
          <View style={ht.streakStat}>
            <Text style={ht.streakStatValue}>{STREAK.total}</Text>
            <Text style={ht.streakStatLabel}>Total pagas</Text>
          </View>
        </View>
        {/* Visual streak dots */}
        <View style={ht.dotsRow}>
          {[...Array(6)].map((_, i) => (
            <View key={i} style={[ht.dot, i < STREAK.current ? ht.dotActive : {}]}>
              <Text style={[ht.dotText, i < STREAK.current ? ht.dotTextActive : {}]}>{i < STREAK.current ? "OK" : ""}</Text>
            </View>
          ))}
        </View>
      </HoverCard>

      {/* Completed list */}
      <Text style={ht.listTitle}>Obrigacoes concluidas</Text>
      <View style={ht.listCard}>
        {COMPLETED.map(c => (
          <HoverRow key={c.id} style={ht.row}>
            <View style={ht.checkCircle}><Text style={ht.checkText}>OK</Text></View>
            <View style={ht.rowInfo}>
              <Text style={ht.rowName}>{c.name}</Text>
              <Text style={ht.rowMeta}>{c.month} - pago em {c.completedAt}</Text>
            </View>
            <Text style={ht.rowAmount}>{fmt(c.amount)}</Text>
          </HoverRow>
        ))}
      </View>
    </View>
  );
}
const ht = StyleSheet.create({
  streakCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border2, marginBottom: 24 },
  streakHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  streakTitle: { fontSize: 16, color: Colors.ink, fontWeight: "700" },
  streakBadge: { backgroundColor: Colors.greenD, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  streakBadgeText: { fontSize: 12, color: Colors.green, fontWeight: "700" },
  streakHint: { fontSize: 12, color: Colors.ink3, marginBottom: 16, lineHeight: 18 },
  streakStats: { flexDirection: "row", gap: 12, marginBottom: 16 },
  streakStat: { flex: 1, alignItems: "center", backgroundColor: Colors.bg4, borderRadius: 10, padding: 12 },
  streakStatValue: { fontSize: 22, fontWeight: "800", color: Colors.green },
  streakStatLabel: { fontSize: 10, color: Colors.ink3, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  dotsRow: { flexDirection: "row", gap: 8, justifyContent: "center" },
  dot: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border },
  dotActive: { backgroundColor: Colors.greenD, borderColor: Colors.green + "66" },
  dotText: { fontSize: 9, fontWeight: "700", color: Colors.ink3 },
  dotTextActive: { color: Colors.green },
  listTitle: { fontSize: 15, color: Colors.ink, fontWeight: "700", marginBottom: 12 },
  listCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 8, borderWidth: 1, borderColor: Colors.border, marginBottom: 20 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  checkCircle: { width: 28, height: 28, borderRadius: 8, backgroundColor: Colors.greenD, alignItems: "center", justifyContent: "center" },
  checkText: { fontSize: 9, fontWeight: "800", color: Colors.green },
  rowInfo: { flex: 1, gap: 2 },
  rowName: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  rowMeta: { fontSize: 11, color: Colors.ink3 },
  rowAmount: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
});

// ── Main Screen ──────────────────────────────────────────────

export default function ContabilidadeScreen() {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedGuide, setSelectedGuide] = useState<string | null>(null);

  const attentionCount = OBLIGATIONS.filter(o => o.daysLeft <= 7).length;
  const upcomingCount = OBLIGATIONS.filter(o => o.daysLeft > 7 && o.daysLeft <= 30).length;
  const totalDue = OBLIGATIONS.filter(o => o.amount != null).reduce((s, o) => s + (o.amount || 0), 0);

  const selectedObl = selectedGuide ? OBLIGATIONS.find(o => o.id === selectedGuide) : null;

  // If a guide is selected, show guide detail
  if (selectedObl) {
    return (
      <ScrollView style={s.screen} contentContainerStyle={s.content}>
        <GuideView obl={selectedObl} onBack={() => setSelectedGuide(null)} />
        <DemoBanner />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <PageHeader title="Contabilidade" />

      <View style={s.summaryRow}>
        <SummaryCard label="URGENTE" value={String(attentionCount)} color={attentionCount > 0 ? Colors.red : Colors.green} sub={attentionCount > 0 ? "Vence em 7 dias" : "Nenhuma"} />
        <SummaryCard label="PROXIMAS" value={String(upcomingCount)} sub="Nos proximos 30 dias" />
        <SummaryCard label="TOTAL ESTIMADO" value={fmt(totalDue)} sub="Valor das guias" />
        <SummaryCard label="SEQUENCIA" value={`${STREAK.current} meses`} color={Colors.green} sub="Em dia" />
      </View>

      <TabBar tabs={TABS} active={activeTab} onSelect={setActiveTab} />

      {/* Tab 1: Calendario */}
      {activeTab === 0 && (
        <View>
          {OBLIGATIONS.filter(o => o.daysLeft <= 7).length > 0 && (
            <View style={s.urgentBanner}>
              <Text style={s.urgentText}>Voce tem {OBLIGATIONS.filter(o => o.daysLeft <= 7).length} obrigacao(oes) vencendo em menos de 7 dias</Text>
            </View>
          )}
          {[...OBLIGATIONS].sort((a, b) => a.daysLeft - b.daysLeft).map(obl => (
            <ObligationCard key={obl.id} obl={obl} onOpenGuide={() => { setSelectedGuide(obl.id); }} />
          ))}
          <View style={s.legalNote}>
            <Text style={s.legalText}>Valores sao estimativas para apoio contabil informativo.</Text>
          </View>
        </View>
      )}

      {/* Tab 2: Guias */}
      {activeTab === 1 && (
        <GuidesList obligations={OBLIGATIONS} onSelect={setSelectedGuide} />
      )}

      {/* Tab 3: Historico */}
      {activeTab === 2 && <HistoryTab />}

      <DemoBanner />
    </ScrollView>
  );
}

// ── Styles ─────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 960, alignSelf: "center", width: "100%" },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4, marginBottom: 20 },
  urgentBanner: { backgroundColor: Colors.redD, borderRadius: 12, padding: 14, marginBottom: 16 },
  urgentText: { fontSize: 13, color: Colors.red, fontWeight: "600" },
  legalNote: { alignItems: "center", paddingVertical: 12 },
  legalText: { fontSize: 10, color: Colors.ink3, fontStyle: "italic" },
});
