import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Platform, Dimensions } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";

const { width: SCREEN_W } = Dimensions.get("window");
const IS_WIDE = SCREEN_W > 768;
const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const TABS = ["Clientes", "Ranking", "Retencao"];

const MOCK_CUSTOMERS = [
  { id: "1", name: "Maria Silva", email: "maria@email.com", phone: "(12) 99999-1111", instagram: "@mariasilva", birthday: "15/06", lastPurchase: "29/03/2026", totalSpent: 2840.00, visits: 18, ltv: 2840.00, firstVisit: "10/01/2025", tags: ["Frequente", "VIP"], rating: 5 },
  { id: "2", name: "Pedro Costa", email: "pedro@email.com", phone: "(12) 99999-2222", instagram: "@pedrocosta", birthday: "22/09", lastPurchase: "28/03/2026", totalSpent: 1560.00, visits: 12, ltv: 1560.00, firstVisit: "15/03/2025", tags: ["Frequente"], rating: 4 },
  { id: "3", name: "Ana Oliveira", email: "ana@email.com", phone: "(12) 99999-3333", instagram: "", birthday: "03/12", lastPurchase: "25/03/2026", totalSpent: 3200.00, visits: 22, ltv: 3200.00, firstVisit: "20/08/2024", tags: ["VIP", "Aniversario proximo"], rating: 5 },
  { id: "4", name: "Joao Santos", email: "joao@email.com", phone: "(12) 99999-4444", instagram: "@joaosantos", birthday: "08/04", lastPurchase: "20/03/2026", totalSpent: 890.00, visits: 7, ltv: 890.00, firstVisit: "01/09/2025", tags: ["Aniversario proximo"], rating: null },
  { id: "5", name: "Carlos Lima", email: "carlos@email.com", phone: "(12) 99999-5555", instagram: "", birthday: "30/11", lastPurchase: "10/02/2026", totalSpent: 450.00, visits: 4, ltv: 450.00, firstVisit: "15/11/2025", tags: ["Inativo"], rating: 3 },
  { id: "6", name: "Fernanda Souza", email: "fer@email.com", phone: "(12) 99999-6666", instagram: "@fersouza", birthday: "17/07", lastPurchase: "27/03/2026", totalSpent: 1980.00, visits: 14, ltv: 1980.00, firstVisit: "05/05/2025", tags: ["Frequente"], rating: 5 },
  { id: "7", name: "Lucas Mendes", email: "lucas@email.com", phone: "(12) 99999-7777", instagram: "", birthday: "25/01", lastPurchase: "15/01/2026", totalSpent: 220.00, visits: 2, ltv: 220.00, firstVisit: "10/12/2025", tags: ["Novo"], rating: null },
  { id: "8", name: "Beatriz Almeida", email: "bia@email.com", phone: "(12) 99999-8888", instagram: "@biaalmeida", birthday: "09/05", lastPurchase: "28/03/2026", totalSpent: 4100.00, visits: 30, ltv: 4100.00, firstVisit: "01/01/2024", tags: ["VIP", "Frequente"], rating: 5 },
];

const MOCK_RETENTION = {
  newThisMonth: 3,
  returning: 5,
  inactive: 1,
  avgTicket: 391.91,
  avgVisits: 13.6,
  birthdaysThisWeek: [
    { name: "Joao Santos", date: "08/04", daysUntil: 10 },
  ],
};

type Customer = typeof MOCK_CUSTOMERS[0];

// ── Summary Card ─────────────────────────────────────────────

function SummaryCard({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  const [hovered, setHovered] = useState(false);
  const isWeb = Platform.OS === "web";
  return (
    <Pressable
      onHoverIn={isWeb ? () => setHovered(true) : undefined}
      onHoverOut={isWeb ? () => setHovered(false) : undefined}
      style={[sm.card, hovered && { transform: [{ translateY: -2 }], borderColor: Colors.border2 }, isWeb && { transition: "all 0.2s ease" } as any]}
    >
      <Text style={sm.label}>{label}</Text>
      <Text style={[sm.value, color ? { color } : {}]}>{value}</Text>
      {sub && <Text style={sm.sub}>{sub}</Text>}
    </Pressable>
  );
}
const sm = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, flex: 1, minWidth: IS_WIDE ? 140 : "45%", margin: 4 },
  label: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 },
  value: { fontSize: 20, fontWeight: "800", color: Colors.ink, letterSpacing: -0.5 },
  sub: { fontSize: 10, color: Colors.ink3, marginTop: 4 },
});

// ── Tab Bar ──────────────────────────────────────────────────

function TabBar({ active, onSelect }: { active: number; onSelect: (i: number) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tb.scroll} contentContainerStyle={tb.row}>
      {TABS.map((tab, i) => (
        <Pressable key={tab} onPress={() => onSelect(i)} style={[tb.tab, active === i && tb.tabActive]}>
          <Text style={[tb.label, active === i && tb.labelActive]}>{tab}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
const tb = StyleSheet.create({
  scroll: { flexGrow: 0, marginBottom: 20 },
  row: { flexDirection: "row", gap: 6 },
  tab: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  tabActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  label: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  labelActive: { color: "#fff", fontWeight: "600" },
});

// ── Tag Badge ────────────────────────────────────────────────

function TagBadge({ tag }: { tag: string }) {
  const colorMap: Record<string, { bg: string; fg: string }> = {
    "VIP": { bg: Colors.violetD, fg: Colors.violet3 },
    "Frequente": { bg: Colors.greenD, fg: Colors.green },
    "Novo": { bg: Colors.amberD, fg: Colors.amber },
    "Inativo": { bg: Colors.redD, fg: Colors.red },
    "Aniversario proximo": { bg: Colors.amberD, fg: Colors.amber },
  };
  const c = colorMap[tag] || { bg: Colors.bg4, fg: Colors.ink3 };
  return (<View style={[tg.badge, { backgroundColor: c.bg }]}><Text style={[tg.text, { color: c.fg }]}>{tag}</Text></View>);
}
const tg = StyleSheet.create({
  badge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  text: { fontSize: 9, fontWeight: "600", letterSpacing: 0.3 },
});

// ── Stars ────────────────────────────────────────────────────

function Stars({ rating }: { rating: number | null }) {
  if (rating == null) return <Text style={{ fontSize: 10, color: Colors.ink3 }}>Sem avaliacao</Text>;
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1,2,3,4,5].map(i => (
        <Text key={i} style={{ fontSize: 12, color: i <= rating ? Colors.amber : Colors.ink3 }}>*</Text>
      ))}
    </View>
  );
}

// ── Customer Row ─────────────────────────────────────────────

function CustomerRow({ customer, onExpand, expanded }: { customer: Customer; onExpand: () => void; expanded: boolean }) {
  const [hovered, setHovered] = useState(false);
  const isWeb = Platform.OS === "web";
  return (
    <View>
      <Pressable
        onPress={onExpand}
        onHoverIn={isWeb ? () => setHovered(true) : undefined}
        onHoverOut={isWeb ? () => setHovered(false) : undefined}
        style={[cr.row, hovered && { backgroundColor: Colors.bg4 }, isWeb && { transition: "background-color 0.15s ease" } as any]}
      >
        <View style={cr.left}>
          <View style={cr.avatar}><Text style={cr.avatarText}>{customer.name.charAt(0)}</Text></View>
          <View style={cr.info}>
            <Text style={cr.name}>{customer.name}</Text>
            <Text style={cr.meta}>{customer.phone}{customer.instagram ? " / " + customer.instagram : ""}</Text>
          </View>
        </View>
        <View style={cr.right}>
          <Text style={cr.ltv}>{fmt(customer.totalSpent)}</Text>
          <View style={cr.tags}>{customer.tags.slice(0, 2).map(t => <TagBadge key={t} tag={t} />)}</View>
        </View>
      </Pressable>
      {expanded && (
        <View style={cr.detail}>
          <View style={cr.detailGrid}>
            <View style={cr.detailItem}><Text style={cr.detailLabel}>E-mail</Text><Text style={cr.detailValue}>{customer.email}</Text></View>
            <View style={cr.detailItem}><Text style={cr.detailLabel}>Telefone</Text><Text style={cr.detailValue}>{customer.phone}</Text></View>
            <View style={cr.detailItem}><Text style={cr.detailLabel}>Aniversario</Text><Text style={cr.detailValue}>{customer.birthday}</Text></View>
            <View style={cr.detailItem}><Text style={cr.detailLabel}>Instagram</Text><Text style={[cr.detailValue, { color: Colors.violet3 }]}>{customer.instagram || "---"}</Text></View>
            <View style={cr.detailItem}><Text style={cr.detailLabel}>Primeira visita</Text><Text style={cr.detailValue}>{customer.firstVisit}</Text></View>
            <View style={cr.detailItem}><Text style={cr.detailLabel}>Ultima compra</Text><Text style={cr.detailValue}>{customer.lastPurchase}</Text></View>
            <View style={cr.detailItem}><Text style={cr.detailLabel}>Total gasto</Text><Text style={[cr.detailValue, { color: Colors.green }]}>{fmt(customer.totalSpent)}</Text></View>
            <View style={cr.detailItem}><Text style={cr.detailLabel}>Visitas</Text><Text style={cr.detailValue}>{customer.visits}</Text></View>
            <View style={cr.detailItem}><Text style={cr.detailLabel}>Avaliacao</Text><Stars rating={customer.rating} /></View>
          </View>
          <View style={cr.detailActions}>
            <Pressable style={cr.actionBtn}><Text style={cr.actionText}>Enviar WhatsApp</Text></Pressable>
            <Pressable style={cr.actionBtn}><Text style={cr.actionText}>Pedir avaliacao</Text></Pressable>
            <Pressable style={cr.actionBtn}><Text style={cr.actionText}>Ver historico</Text></Pressable>
          </View>
        </View>
      )}
    </View>
  );
}
const cr = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  left: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border2 },
  avatarText: { fontSize: 14, fontWeight: "700", color: Colors.violet3 },
  info: { flex: 1 },
  name: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  meta: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  right: { alignItems: "flex-end", gap: 4 },
  ltv: { fontSize: 13, color: Colors.green, fontWeight: "700" },
  tags: { flexDirection: "row", gap: 4 },
  detail: { backgroundColor: Colors.bg4, borderRadius: 12, padding: 16, marginHorizontal: 8, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  detailGrid: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  detailItem: { width: "30%", minWidth: 100, paddingVertical: 6, gap: 3 },
  detailLabel: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  detailValue: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  detailActions: { flexDirection: "row", gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border, flexWrap: "wrap" },
  actionBtn: { backgroundColor: Colors.bg3, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: Colors.border },
  actionText: { fontSize: 11, color: Colors.violet3, fontWeight: "600" },
});

// ── Ranking Row ──────────────────────────────────────────────

function RankingRow({ customer, rank, metric }: { customer: Customer; rank: number; metric: "ltv" | "visits" }) {
  const [hovered, setHovered] = useState(false);
  const isWeb = Platform.OS === "web";
  const medalColors = ["", Colors.amber, Colors.ink3, "#cd7f32"];
  const medalColor = rank <= 3 ? medalColors[rank] : undefined;

  return (
    <Pressable
      onHoverIn={isWeb ? () => setHovered(true) : undefined}
      onHoverOut={isWeb ? () => setHovered(false) : undefined}
      style={[rk.row, hovered && { backgroundColor: Colors.bg4 }, isWeb && { transition: "background-color 0.15s ease" } as any]}
    >
      <View style={[rk.rank, medalColor ? { backgroundColor: medalColor + "22" } : {}]}>
        <Text style={[rk.rankText, medalColor ? { color: medalColor } : {}]}>{rank}</Text>
      </View>
      <View style={rk.avatar}><Text style={rk.avatarText}>{customer.name.charAt(0)}</Text></View>
      <View style={rk.info}>
        <Text style={rk.name}>{customer.name}</Text>
        <View style={rk.tags}>{customer.tags.slice(0, 2).map(t => <TagBadge key={t} tag={t} />)}</View>
      </View>
      <View style={rk.right}>
        <Text style={rk.value}>{metric === "ltv" ? fmt(customer.totalSpent) : `${customer.visits} visitas`}</Text>
        <Stars rating={customer.rating} />
      </View>
    </Pressable>
  );
}
const rk = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  rank: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg4 },
  rankText: { fontSize: 13, fontWeight: "800", color: Colors.ink3 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 12, fontWeight: "700", color: Colors.violet3 },
  info: { flex: 1, gap: 4 },
  name: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  tags: { flexDirection: "row", gap: 4 },
  right: { alignItems: "flex-end", gap: 4 },
  value: { fontSize: 14, color: Colors.green, fontWeight: "700" },
});

// ── Retention Card ───────────────────────────────────────────

function RetentionBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total * 100).toFixed(0) : "0";
  return (
    <View style={rt.barContainer}>
      <View style={rt.barHeader}>
        <Text style={rt.barLabel}>{label}</Text>
        <Text style={[rt.barCount, { color }]}>{value} clientes ({pct}%)</Text>
      </View>
      <View style={rt.barTrack}>
        <View style={[rt.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}
const rt = StyleSheet.create({
  barContainer: { gap: 6 },
  barHeader: { flexDirection: "row", justifyContent: "space-between" },
  barLabel: { fontSize: 12, color: Colors.ink, fontWeight: "500" },
  barCount: { fontSize: 12, fontWeight: "700" },
  barTrack: { height: 10, backgroundColor: Colors.bg4, borderRadius: 5, overflow: "hidden" },
  barFill: { height: 10, borderRadius: 5 },
});

// ── Main Screen ──────────────────────────────────────────────

export default function ClientesScreen() {
  const { isDemo } = useAuthStore();
  const [activeTab, setActiveTab] = useState(0);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rankMetric, setRankMetric] = useState<"ltv" | "visits">("ltv");

  const filtered = MOCK_CUSTOMERS.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.email.toLowerCase().includes(q) || c.instagram.toLowerCase().includes(q);
  });

  const totalClients = MOCK_CUSTOMERS.length;
  const totalLtv = MOCK_CUSTOMERS.reduce((s, c) => s + c.totalSpent, 0);
  const ret = MOCK_RETENTION;

  const ranked = [...MOCK_CUSTOMERS].sort((a, b) => rankMetric === "ltv" ? b.totalSpent - a.totalSpent : b.visits - a.visits);

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Text style={s.pageTitle}>Clientes</Text>

      <View style={s.summaryRow}>
        <SummaryCard label="TOTAL CLIENTES" value={String(totalClients)} />
        <SummaryCard label="FATURAMENTO TOTAL" value={fmt(totalLtv)} color={Colors.green} />
        <SummaryCard label="TICKET MEDIO" value={fmt(ret.avgTicket)} />
        <SummaryCard label="MEDIA VISITAS" value={ret.avgVisits.toFixed(1)} />
      </View>

      <TabBar active={activeTab} onSelect={setActiveTab} />

      {/* Tab 1: Clientes */}
      {activeTab === 0 && (
        <View>
          <TextInput
            style={s.searchInput}
            placeholder="Buscar por nome, telefone, email ou Instagram..."
            placeholderTextColor={Colors.ink3}
            value={search}
            onChangeText={setSearch}
          />
          <View style={s.listCard}>
            {filtered.map(c => (
              <CustomerRow
                key={c.id}
                customer={c}
                expanded={expandedId === c.id}
                onExpand={() => setExpandedId(expandedId === c.id ? null : c.id)}
              />
            ))}
            {filtered.length === 0 && <View style={s.empty}><Text style={s.emptyText}>Nenhum cliente encontrado</Text></View>}
          </View>
        </View>
      )}

      {/* Tab 2: Ranking */}
      {activeTab === 1 && (
        <View>
          <View style={s.rankToggle}>
            <Pressable onPress={() => setRankMetric("ltv")} style={[s.rankBtn, rankMetric === "ltv" && s.rankBtnActive]}>
              <Text style={[s.rankBtnText, rankMetric === "ltv" && s.rankBtnTextActive]}>Por faturamento</Text>
            </Pressable>
            <Pressable onPress={() => setRankMetric("visits")} style={[s.rankBtn, rankMetric === "visits" && s.rankBtnActive]}>
              <Text style={[s.rankBtnText, rankMetric === "visits" && s.rankBtnTextActive]}>Por frequencia</Text>
            </Pressable>
          </View>
          <View style={s.listCard}>
            {ranked.map((c, i) => <RankingRow key={c.id} customer={c} rank={i + 1} metric={rankMetric} />)}
          </View>
        </View>
      )}

      {/* Tab 3: Retencao */}
      {activeTab === 2 && (
        <View>
          <View style={s.retentionCard}>
            <Text style={s.retentionTitle}>Composicao da base</Text>
            <View style={s.retentionBars}>
              <RetentionBar label="Novos (este mes)" value={ret.newThisMonth} total={totalClients} color={Colors.amber} />
              <RetentionBar label="Retornando" value={ret.returning} total={totalClients} color={Colors.green} />
              <RetentionBar label="Inativos (30+ dias)" value={ret.inactive} total={totalClients} color={Colors.red} />
            </View>
          </View>

          {ret.birthdaysThisWeek.length > 0 && (
            <View style={s.birthdayCard}>
              <Text style={s.birthdayTitle}>Aniversarios proximos</Text>
              {ret.birthdaysThisWeek.map(b => (
                <View key={b.name} style={s.birthdayRow}>
                  <View style={s.birthdayLeft}>
                    <Text style={s.birthdayIcon}>*</Text>
                    <View>
                      <Text style={s.birthdayName}>{b.name}</Text>
                      <Text style={s.birthdayDate}>{b.date} - em {b.daysUntil} dias</Text>
                    </View>
                  </View>
                  <Pressable style={s.birthdayBtn}><Text style={s.birthdayBtnText}>Enviar parabens</Text></Pressable>
                </View>
              ))}
            </View>
          )}

          <View style={s.reviewCard}>
            <Text style={s.reviewTitle}>Avaliacoes dos clientes</Text>
            <Text style={s.reviewHint}>Link de avaliacao enviado para todos os clientes apos compra - sem filtro (review gating proibido).</Text>
            <View style={s.reviewStats}>
              <View style={s.reviewStat}>
                <Text style={s.reviewStatValue}>{MOCK_CUSTOMERS.filter(c => c.rating != null).length}</Text>
                <Text style={s.reviewStatLabel}>Avaliacoes</Text>
              </View>
              <View style={s.reviewStat}>
                <Text style={[s.reviewStatValue, { color: Colors.green }]}>
                  {(MOCK_CUSTOMERS.filter(c => c.rating != null).reduce((s, c) => s + (c.rating || 0), 0) / MOCK_CUSTOMERS.filter(c => c.rating != null).length).toFixed(1)}
                </Text>
                <Text style={s.reviewStatLabel}>Media</Text>
              </View>
              <View style={s.reviewStat}>
                <Text style={[s.reviewStatValue, { color: Colors.amber }]}>
                  {MOCK_CUSTOMERS.filter(c => c.rating === 5).length}
                </Text>
                <Text style={s.reviewStatLabel}>5 estrelas</Text>
              </View>
            </View>
            <Pressable style={s.googleBtn}><Text style={s.googleBtnText}>Ver avaliacoes no Google</Text></Pressable>
          </View>
        </View>
      )}

      {isDemo && <View style={s.demoBanner}><Text style={s.demoText}>Modo demonstrativo - dados ilustrativos</Text></View>}
    </ScrollView>
  );
}

// ── Styles ─────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 960, alignSelf: "center", width: "100%" },
  pageTitle: { fontSize: 22, color: Colors.ink, fontWeight: "700", marginBottom: 20 },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4, marginBottom: 20 },
  searchInput: { backgroundColor: Colors.bg3, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, color: Colors.ink, marginBottom: 16 },
  listCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 8, borderWidth: 1, borderColor: Colors.border, marginBottom: 20 },
  empty: { alignItems: "center", paddingVertical: 40 },
  emptyText: { fontSize: 13, color: Colors.ink3 },

  rankToggle: { flexDirection: "row", gap: 6, marginBottom: 16 },
  rankBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  rankBtnActive: { backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  rankBtnText: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  rankBtnTextActive: { color: Colors.violet3, fontWeight: "600" },

  retentionCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border, marginBottom: 20 },
  retentionTitle: { fontSize: 15, color: Colors.ink, fontWeight: "700", marginBottom: 16 },
  retentionBars: { gap: 16 },

  birthdayCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border2, marginBottom: 20 },
  birthdayTitle: { fontSize: 15, color: Colors.ink, fontWeight: "700", marginBottom: 12 },
  birthdayRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10 },
  birthdayLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  birthdayIcon: { fontSize: 20, color: Colors.amber },
  birthdayName: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  birthdayDate: { fontSize: 11, color: Colors.ink3, marginTop: 1 },
  birthdayBtn: { backgroundColor: Colors.violetD, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: Colors.border2 },
  birthdayBtnText: { fontSize: 11, color: Colors.violet3, fontWeight: "600" },

  reviewCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border, marginBottom: 20 },
  reviewTitle: { fontSize: 15, color: Colors.ink, fontWeight: "700", marginBottom: 4 },
  reviewHint: { fontSize: 11, color: Colors.ink3, marginBottom: 16, lineHeight: 16 },
  reviewStats: { flexDirection: "row", gap: 16, marginBottom: 16 },
  reviewStat: { alignItems: "center", flex: 1, backgroundColor: Colors.bg4, borderRadius: 10, padding: 12 },
  reviewStatValue: { fontSize: 22, fontWeight: "800", color: Colors.ink },
  reviewStatLabel: { fontSize: 10, color: Colors.ink3, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  googleBtn: { backgroundColor: Colors.bg4, borderRadius: 10, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: Colors.border },
  googleBtnText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },

  demoBanner: { alignSelf: "center", backgroundColor: Colors.violetD, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginTop: 8 },
  demoText: { fontSize: 11, color: Colors.violet3, fontWeight: "500" },
});
