// ============================================================
// AURA. — Ótica: Laboratório
//
// A tela do dia a dia da ótica. Não é uma lista de OS: é uma ESTEIRA. O
// que o dono quer saber de manhã é "quantos pares estão no laboratório e
// quais atrasaram", e isso tem que caber numa olhada — por isso as cinco
// estações com contagem no topo e os atrasados marcados por forma (faixa
// vermelha + "▲"), não só por cor.
//
// Mockup aprovado: docs/mockups/otica-modulo.html (15/09/2026), tela 1.
//
// Dados: OS kind='otica' (service_orders) + /otica/dashboard. Sem gate de
// leitura: com o toggle desligado a tela continua mostrando os óculos que
// já estão no laboratório — o backend bloqueia só a escrita.
// ============================================================
import { useMemo, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, TextInput, Platform } from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { ScreenHero } from "@/components/ScreenHero";
import { useAuthStore } from "@/stores/auth";
import { usePdvSettings } from "@/hooks/usePdvSettings";
import { serviceOrdersApi, OS_STATUS_LABEL } from "@/services/serviceOrdersApi";
import {
  oticaApi, LAB_STATUS_LABEL, type LabStatus, type OpticalOrder, LENS_USE_LABEL, daysUntil,
} from "@/services/oticaApi";

// Toque não tem hover: as ações do card ficam sempre visíveis (regra 7).
const TOUCH = Platform.OS !== "web"
  || (typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(hover: none)").matches);

const fmtMoney = (n: number | string | null | undefined) =>
  `R$ ${Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

function fmtDayMonth(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
}

function daysSince(iso?: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

/** Atrasada = prometido já passou e ainda não está pronta nem fechada. */
export function isLate(os: Pick<OpticalOrder, "promised_at" | "status">): boolean {
  if (!os.promised_at) return false;
  if (os.status === "pronta" || os.status === "entregue" || os.status === "cancelada") return false;
  const d = daysUntil(String(os.promised_at).slice(0, 10));
  return d != null && d < 0;
}

type Chip = "andamento" | "atrasadas" | "prontas" | "entregues" | "todas";
const CHIPS: { key: Chip; label: string }[] = [
  { key: "andamento", label: "Em andamento" },
  { key: "atrasadas", label: "Atrasadas" },
  { key: "prontas", label: "Prontas" },
  { key: "entregues", label: "Entregues" },
  { key: "todas", label: "Todas" },
];

const STATIONS: { key: LabStatus | "pronta"; label: string }[] = [
  { key: "aguardando_envio", label: "Aguardando envio" },
  { key: "no_laboratorio", label: "No laboratório" },
  { key: "recebida", label: "Recebidas" },
  { key: "em_montagem", label: "Montagem" },
  { key: "pronta", label: "Prontas" },
];

const BADGE_COLOR: Record<string, string> = {
  aguardando_envio: Colors.ink3,
  no_laboratorio: "#38bdf8",
  recebida: Colors.violet3,
  em_montagem: Colors.violet3,
  refacao: Colors.amber,
  pronta: Colors.green,
  entregue: Colors.ink3,
  cancelada: Colors.ink3,
};

function stageOf(os: OpticalOrder): { key: string; label: string } {
  if (os.status === "pronta") return { key: "pronta", label: "Pronta" };
  if (os.status === "entregue" || os.status === "cancelada") return { key: os.status, label: OS_STATUS_LABEL[os.status] };
  const ls = (os.lab_status || "aguardando_envio") as LabStatus;
  return { key: ls, label: LAB_STATUS_LABEL[ls] || ls };
}

function lensSummary(os: OpticalOrder): string {
  const o = os.optical;
  if (!o) return os.reported_issue || "";
  const parts: string[] = [];
  if (o.use) parts.push(LENS_USE_LABEL[o.use] || o.use);
  if (o.lens?.brand || o.lens?.design) parts.push([o.lens.brand, o.lens.design].filter(Boolean).join(" "));
  if (o.lens?.material) parts.push(o.lens.material);
  if (o.frame?.description) parts.push(o.frame.description);
  return parts.join(" · ");
}

export default function OticaLaboratorioScreen() {
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const { settings } = usePdvSettings();
  const enabled = settings.otica_enabled === true;
  const [chip, setChip] = useState<Chip>("andamento");
  const [busca, setBusca] = useState("");
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: dash } = useQuery({
    queryKey: ["otica-dashboard", company?.id],
    queryFn: () => oticaApi.dashboard(company!.id),
    enabled: !!company?.id,
    staleTime: 30_000,
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["service-orders", company?.id, "otica", chip, q],
    queryFn: () => serviceOrdersApi.list(company!.id, {
      kind: "otica",
      status: chip === "prontas" ? "pronta" : chip === "entregues" ? "entregue" : undefined,
      q: q || undefined,
      days: chip === "todas" || chip === "entregues" ? 365 : 180,
      limit: 300,
    }),
    enabled: !!company?.id,
    staleTime: 30_000,
  });

  const orders = useMemo(() => {
    const all = ((data?.orders || []) as OpticalOrder[]);
    let list = all;
    if (chip === "andamento") list = all.filter((o) => o.status === "aberta" || o.status === "em_execucao" || o.status === "pronta");
    if (chip === "atrasadas") list = all.filter(isLate);
    // Atrasadas primeiro, depois as mais antigas no laboratório.
    return [...list].sort((a, b) => Number(isLate(b)) - Number(isLate(a)) || new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [data, chip]);

  const counts = dash?.counts;
  const lateCount = counts?.atrasadas ?? 0;
  const inLab = counts?.no_laboratorio ?? 0;
  const ready = counts?.pronta_aguardando_retirada ?? 0;
  const inProgress = counts
    ? (counts.aguardando_envio + counts.no_laboratorio + counts.recebida + counts.em_montagem + counts.refacao + counts.pronta_aguardando_retirada)
    : null;

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["service-orders"] });
    qc.invalidateQueries({ queryKey: ["otica-dashboard"] });
  }

  async function quick(os: OpticalOrder, fn: () => Promise<any>, ok: string) {
    if (busyId || !company?.id) return;
    setBusyId(os.id);
    try {
      await fn();
      invalidate();
      toast.success(ok);
    } catch (err: any) {
      toast.error(err?.data?.error || "Não deu para atualizar a OS");
    } finally {
      setBusyId(null);
    }
  }

  function quickAction(os: OpticalOrder): { label: string; run: () => void; primary?: boolean } | null {
    if (!company?.id || !enabled) return null;
    const stage = stageOf(os).key;
    if (stage === "aguardando_envio") {
      return { label: "Enviar ao laboratório", primary: true, run: () => quick(os, () => oticaApi.setLabStatus(company.id, os.id, "no_laboratorio"), `OS #${os.os_number} enviada ao laboratório`) };
    }
    if (stage === "no_laboratorio") {
      return { label: "Lentes chegaram", primary: true, run: () => quick(os, () => oticaApi.setLabStatus(company.id, os.id, "recebida"), `Lentes da OS #${os.os_number} recebidas`) };
    }
    if (stage === "pronta" && !os.ready_notified_at) {
      return { label: "Avisar cliente", primary: true, run: () => router.push(("/otica/" + os.id) as any) };
    }
    return null;
  }

  return (
    <ScrollView style={st.screen} contentContainerStyle={st.content}>
      <ScreenHero
        eyebrow="Ótica"
        title="Laboratório"
        live
        subtitle={
          inProgress == null ? "Carregando a esteira…" : (
            <Text>
              {inProgress} {inProgress === 1 ? "par" : "pares"} em andamento · {inLab} no laboratório ·{" "}
              <Text style={{ color: lateCount > 0 ? Colors.amber : Colors.ink3, fontWeight: lateCount > 0 ? "700" : "400" }}>
                {lateCount} {lateCount === 1 ? "atrasado" : "atrasados"}
              </Text>
              {" "}· {ready} {ready === 1 ? "pronto" : "prontos"} aguardando retirada
              {!!dash?.expiring_prescriptions_30d && ` · ${dash.expiring_prescriptions_30d} ${dash.expiring_prescriptions_30d === 1 ? "receita vence" : "receitas vencem"} em 30 dias`}
            </Text>
          )
        }
        actions={
          <>
            <Pressable onPress={() => router.push("/otica/receitas" as any)} style={st.ghostBtn} testID="otica-receitas">
              <Icon name="eye" size={14} color={Colors.ink} />
              <Text style={st.ghostBtnText}>Receitas</Text>
            </Pressable>
            {enabled && (
              <Pressable onPress={() => router.push("/otica/nova" as any)} style={st.newBtn} testID="otica-nova">
                <Icon name="plus" size={14} color="#fff" />
                <Text style={st.newBtnText}>Nova OS de óculos</Text>
              </Pressable>
            )}
          </>
        }
      />

      {!enabled && (
        <View style={st.disabledBanner}>
          <Text style={st.disabledText}>
            O módulo Ótica está desligado — você ainda vê as OS existentes, mas não abre novas nem muda etapas. Ligue em Configurações › Vendas.
          </Text>
        </View>
      )}

      {/* Esteira */}
      <View style={st.rail} testID="otica-esteira">
        {STATIONS.map((s, i) => {
          const n = s.key === "pronta" ? ready : (counts?.[s.key as LabStatus] ?? 0);
          const isLab = s.key === "no_laboratorio";
          const isReady = s.key === "pronta";
          return (
            <View key={s.key} style={[st.station, isLab && n > 0 && st.stationOn, isReady && st.stationReady]}>
              <Text style={[st.stationN, isReady && { color: Colors.green }]}>{counts ? n : "–"}</Text>
              <Text style={st.stationL}>{s.label}</Text>
              {isLab && lateCount > 0 && <Text style={st.stationLate}>{lateCount} {lateCount === 1 ? "passou" : "passaram"} do prazo</Text>}
              {i < STATIONS.length - 1 && <Text style={st.stationArrow}>›</Text>}
            </View>
          );
        })}
      </View>

      <View style={st.searchBox}>
        <Icon name="search" size={14} color={Colors.ink3} />
        <TextInput
          style={st.searchInput}
          value={busca}
          onChangeText={setBusca}
          onSubmitEditing={() => setQ(busca.trim())}
          placeholder="Nº da OS, cliente ou pedido do laboratório"
          placeholderTextColor={Colors.ink3}
          returnKeyType="search"
          testID="otica-busca"
        />
        {!!q && (
          <Pressable onPress={() => { setBusca(""); setQ(""); }} accessibilityLabel="Limpar busca">
            <Icon name="x" size={14} color={Colors.ink3} />
          </Pressable>
        )}
      </View>

      <View style={st.chips}>
        {CHIPS.map((c) => (
          <Pressable key={c.key} onPress={() => setChip(c.key)} style={[st.chip, chip === c.key && st.chipOn]} testID={`otica-chip-${c.key}`}>
            <Text style={[st.chipText, chip === c.key && st.chipTextOn]}>{c.label}</Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={st.loadingBox}><ActivityIndicator color={Colors.violet3} /></View>
      ) : orders.length === 0 ? (
        <View style={st.emptyBox} testID="otica-vazio">
          <Icon name="glasses" size={30} color={Colors.ink3} />
          <Text style={st.emptyTitle}>
            {q ? "Nada encontrado" : chip === "atrasadas" ? "Nenhum par atrasado" : chip === "prontas" ? "Nenhum par pronto aguardando retirada" : "Nenhum óculos em andamento"}
          </Text>
          <Text style={st.emptyDesc}>
            {q
              ? "Confira o número da OS ou tente pelo nome do cliente."
              : chip === "atrasadas"
                ? "Boa notícia: todo pedido no laboratório está dentro do prazo prometido."
                : "Quando um cliente fechar um par, abra a OS aqui: a receita fica congelada, o sinal entra no caixa e o laboratório ganha uma etapa própria."}
          </Text>
          {enabled && chip === "andamento" && !q && (
            <Pressable onPress={() => router.push("/otica/nova" as any)} style={[st.newBtn, { marginTop: 8 }]}>
              <Icon name="plus" size={14} color="#fff" />
              <Text style={st.newBtnText}>Nova OS de óculos</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <View style={{ gap: 8 }} testID="otica-lista">
          {orders.map((os) => (
            <OrderCard
              key={os.id}
              os={os}
              busy={busyId === os.id}
              action={quickAction(os)}
              onOpen={() => router.push(("/otica/" + os.id) as any)}
            />
          ))}
          {isFetching && <ActivityIndicator color={Colors.violet3} size="small" />}
        </View>
      )}
    </ScrollView>
  );
}

function OrderCard({ os, action, busy, onOpen }: {
  os: OpticalOrder;
  action: { label: string; run: () => void; primary?: boolean } | null;
  busy: boolean;
  onOpen: () => void;
}) {
  const [hover, setHover] = useState(false);
  const late = isLate(os);
  const stage = stageOf(os);
  const color = BADGE_COLOR[stage.key] || Colors.ink3;
  const inLabDays = stage.key === "no_laboratorio" || stage.key === "refacao" ? daysSince(os.lab_sent_at) : null;
  const readyDays = stage.key === "pronta" ? daysSince(os.delivered_at || os.lab_received_at || os.created_at) : null;
  const showActions = TOUCH || hover;
  const deposit = os.deposit_sale_total != null ? Number(os.deposit_sale_total) : null;
  const total = Number(os.estimated_amount || 0);

  return (
    <Pressable
      onPress={onOpen}
      onHoverIn={Platform.OS === "web" ? () => setHover(true) : undefined}
      onHoverOut={Platform.OS === "web" ? () => setHover(false) : undefined}
      style={[st.card, late && st.cardLate]}
      testID={`otica-os-${os.os_number}`}
    >
      <View style={st.cardNum}>
        <Text style={st.osNumber}>#{os.os_number ?? "—"}</Text>
        <Text style={st.osLab} numberOfLines={1}>
          {os.lab_name ? os.lab_name + (os.lab_order_ref ? " · " + os.lab_order_ref : "") : "sem laboratório"}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={st.customer}>{os.customer_name || "Cliente"}</Text>
        <Text style={st.lens} numberOfLines={2}>{lensSummary(os)}</Text>
        {!!os.lab_redo_count && os.lab_redo_count > 0 && (
          <Text style={st.redo}>refação #{os.lab_redo_count}</Text>
        )}
      </View>
      <View style={st.cardRight}>
        <View style={[st.badge, { borderColor: color }]}>
          <Text style={[st.badgeText, { color }]}>
            {stage.label}
            {inLabDays != null ? ` · ${inLabDays} ${inLabDays === 1 ? "dia" : "dias"}` : ""}
            {readyDays != null && readyDays > 0 ? ` · ${readyDays} ${readyDays === 1 ? "dia" : "dias"} no balcão` : ""}
          </Text>
        </View>
        {!!os.promised_at && (
          <Text style={[st.due, late && st.dueLate]}>
            {late ? "▲ " : ""}prometido {fmtDayMonth(os.promised_at)}
          </Text>
        )}
        {!os.promised_at && total > 0 && (
          <Text style={st.due}>{deposit != null ? `sinal ${fmtMoney(deposit)}` : fmtMoney(total)}</Text>
        )}
        {action && (
          <View style={[st.hoverActions, !showActions && st.hoverHidden]}>
            <Pressable
              onPress={(e) => { (e as any)?.stopPropagation?.(); action.run(); }}
              style={[st.miniBtn, action.primary && st.miniBtnPrimary]}
              disabled={busy}
              testID={`otica-acao-${os.os_number}`}
            >
              {busy
                ? <ActivityIndicator size="small" color={action.primary ? "#fff" : Colors.ink} />
                : <Text style={[st.miniBtnText, action.primary && { color: "#fff" }]}>{action.label}</Text>}
            </Pressable>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 20, paddingBottom: 56, maxWidth: 980, alignSelf: "center", width: "100%" },

  ghostBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  ghostBtnText: { fontSize: 13, color: Colors.ink, fontWeight: "700" },
  newBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.violet, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  newBtnText: { fontSize: 13, color: "#fff", fontWeight: "700" },

  disabledBanner: { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, padding: 12, marginBottom: 12 },
  disabledText: { fontSize: 12, color: Colors.ink3, lineHeight: 17 },

  rail: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6, marginBottom: 18 },
  station: { flexGrow: 1, flexBasis: 150, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, position: "relative" },
  stationOn: { borderColor: Colors.violet, backgroundColor: Colors.violetD },
  stationReady: { borderColor: Colors.green + "66" },
  stationN: { fontFamily: Fonts.heading, fontSize: 34, lineHeight: 36, color: Colors.ink },
  stationL: { fontSize: 10, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase", color: Colors.ink3, marginTop: 4 },
  stationLate: { fontSize: 11, color: Colors.amber, marginTop: 4, fontWeight: "600" },
  stationArrow: { position: "absolute", right: -7, top: "42%", color: Colors.ink3, fontSize: 18 },

  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12, marginBottom: 10 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 13, color: Colors.ink },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg2 },
  chipOn: { backgroundColor: Colors.violet + "22", borderColor: Colors.violet },
  chipText: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
  chipTextOn: { color: Colors.violet3 },

  loadingBox: { paddingVertical: 40, alignItems: "center" },
  emptyBox: { alignItems: "center", paddingVertical: 48, gap: 8 },
  emptyTitle: { fontSize: 15, color: Colors.ink, fontWeight: "700", textAlign: "center" },
  emptyDesc: { fontSize: 12, color: Colors.ink3, textAlign: "center", maxWidth: 360, lineHeight: 17 },

  card: { backgroundColor: Colors.bg3, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, flexDirection: "row", gap: 14, alignItems: "center", flexWrap: "wrap" },
  cardLate: { borderLeftWidth: 3, borderLeftColor: Colors.red },
  cardNum: { width: 118 },
  osNumber: { fontSize: 15, color: Colors.ink, fontWeight: "800", letterSpacing: 0.3 },
  osLab: { fontSize: 10, color: Colors.ink3, fontFamily: Fonts.mono, marginTop: 2 },
  customer: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  lens: { fontSize: 12, color: Colors.ink3, marginTop: 2, lineHeight: 16 },
  redo: { fontSize: 11, color: Colors.amber, marginTop: 2, fontWeight: "600" },
  cardRight: { alignItems: "flex-end", gap: 6, minWidth: 150 },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  due: { fontSize: 11, color: Colors.ink3 },
  dueLate: { color: Colors.red, fontWeight: "700" },
  hoverActions: { flexDirection: "row", gap: 6 },
  hoverHidden: { opacity: 0, height: 0, overflow: "hidden" },
  miniBtn: { borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg4, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, minWidth: 90, alignItems: "center" },
  miniBtnPrimary: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  miniBtnText: { fontSize: 12, fontWeight: "700", color: Colors.ink },
});
