// ============================================================
// AURA. — Ordens de Serviço: listagem
//
// A OS nasce na ENTRADA do equipamento (antes da venda) — esta tela é a
// bancada da loja: o que está aberto, o que está pronto esperando o
// cliente, o que já saiu. A busca cobre número da OS, nome do cliente e
// marca/modelo/série do aparelho — que é como o cliente se identifica
// quando esqueceu o papel.
//
// A tela abre mesmo com os_enabled desligado, de propósito (o backend
// também deixa): a loja que desativou o módulo ainda precisa enxergar os
// aparelhos que estão no balcão dela pra devolver. Só a CRIAÇÃO some.
// ============================================================
import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, TextInput } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { usePdvSettings } from "@/hooks/usePdvSettings";
import { serviceOrdersApi, OS_STATUS_LABEL, type OsStatus, type ServiceOrder } from "@/services/serviceOrdersApi";

const fmt = (n: number | string) => `R$ ${Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

function fmtDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

// Cores dos badges de status: verde só quando o ciclo fechou bem.
const STATUS_COLOR: Record<OsStatus, string> = {
  aberta:      Colors.violet3,
  em_execucao: "#d97706",
  pronta:      "#0891b2",
  entregue:    Colors.green,
  cancelada:   Colors.ink3,
};

const CHIPS: Array<{ key: OsStatus | "todas"; label: string }> = [
  { key: "todas",       label: "Todas" },
  { key: "aberta",      label: "Abertas" },
  { key: "em_execucao", label: "Em execução" },
  { key: "pronta",      label: "Prontas" },
  { key: "entregue",    label: "Entregues" },
  { key: "cancelada",   label: "Canceladas" },
];

export default function OsListScreen() {
  const { company } = useAuthStore();
  const { settings } = usePdvSettings();
  const [status, setStatus] = useState<OsStatus | "todas">("todas");
  const [busca, setBusca] = useState("");
  // q só vai pro backend no submit — digitar não dispara uma request por tecla.
  const [q, setQ] = useState("");

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["service-orders", company?.id, status, q],
    queryFn: function () {
      if (!company?.id) throw new Error("no company");
      return serviceOrdersApi.list(company.id, {
        status: status === "todas" ? undefined : status,
        q: q || undefined,
      });
    },
    enabled: !!company?.id,
    staleTime: 30_000,
  });

  const orders: ServiceOrder[] = data?.orders || [];

  return (
    <ScrollView style={st.screen} contentContainerStyle={st.content}>
      <View style={st.headerRow}>
        <Pressable onPress={() => router.back()} style={st.backBtn} testID="os-back">
          <Icon name="chevron_left" size={16} color={Colors.violet3} />
          <Text style={st.backText}>Voltar</Text>
        </Pressable>
      </View>

      <View style={st.titleRow}>
        <View style={{ flex: 1 }}>
          <Text style={st.pageTitle}>Ordens de Serviço</Text>
          <Text style={st.pageSubtitle}>A OS é aberta na entrada do equipamento e fecha na venda ou na retirada</Text>
        </View>
        {settings.os_enabled === true && (
          <Pressable onPress={() => router.push("/os/nova" as any)} style={st.newBtn} testID="os-nova">
            <Icon name="plus" size={14} color="#fff" />
            <Text style={st.newBtnText}>Nova OS</Text>
          </Pressable>
        )}
      </View>

      {settings.os_enabled !== true && (
        <View style={st.disabledBanner}>
          <Text style={st.disabledText}>
            O módulo está desligado — você ainda vê as OS existentes, mas não abre novas.
            Ative em Configurações › Políticas do Caixa.
          </Text>
        </View>
      )}

      {/* Busca */}
      <View style={st.searchBox}>
        <Icon name="search" size={14} color={Colors.ink3} />
        <TextInput
          style={st.searchInput}
          value={busca}
          onChangeText={setBusca}
          onSubmitEditing={() => setQ(busca.trim())}
          placeholder="Nº da OS, cliente, marca, modelo ou série"
          placeholderTextColor={Colors.ink3}
          returnKeyType="search"
          testID="os-busca"
        />
        {q !== "" && (
          <Pressable onPress={() => { setBusca(""); setQ(""); }}>
            <Icon name="x" size={14} color={Colors.ink3} />
          </Pressable>
        )}
      </View>

      {/* Chips de status */}
      <View style={st.chips}>
        {CHIPS.map((c) => (
          <Pressable
            key={c.key}
            onPress={() => setStatus(c.key)}
            style={[st.chip, status === c.key && st.chipOn]}
            testID={`os-chip-${c.key}`}
          >
            <Text style={[st.chipText, status === c.key && st.chipTextOn]}>{c.label}</Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={st.loadingBox}><ActivityIndicator color={Colors.violet3} /></View>
      ) : orders.length === 0 ? (
        <View style={st.emptyBox}>
          <Icon name="tool" size={28} color={Colors.ink3} />
          <Text style={st.emptyTitle}>{q ? "Nada encontrado" : "Nenhuma ordem de serviço"}</Text>
          <Text style={st.emptyDesc}>
            {q
              ? "Confira o número ou tente pelo nome do cliente."
              : "Quando um cliente deixar um equipamento, abra a OS aqui — ela vira o comprovante dele."}
          </Text>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {orders.map((os) => (
            <Pressable
              key={os.id}
              onPress={() => router.push(("/os/" + os.id) as any)}
              style={st.card}
              testID={`os-row-${os.os_number}`}
            >
              <View style={st.cardTop}>
                <Text style={st.osNumber}>#{os.os_number ?? "—"}</Text>
                <View style={[st.badge, { borderColor: STATUS_COLOR[os.status] }]}>
                  <Text style={[st.badgeText, { color: STATUS_COLOR[os.status] }]}>{OS_STATUS_LABEL[os.status]}</Text>
                </View>
              </View>
              <Text style={st.customer}>{os.customer_name || "Cliente"}</Text>
              <Text style={st.equipment} numberOfLines={1}>
                {[os.equipment_type, os.equipment_brand, os.equipment_model].filter(Boolean).join(" · ") || os.reported_issue}
              </Text>
              <View style={st.cardBottom}>
                <Text style={st.date}>{fmtDate(os.created_at)}</Text>
                <Text style={st.amount}>{fmt(os.estimated_amount)}</Text>
              </View>
            </Pressable>
          ))}
          {isFetching && <ActivityIndicator color={Colors.violet3} size="small" />}
        </View>
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 20, paddingBottom: 56, maxWidth: 720, alignSelf: "center", width: "100%" },

  headerRow: { marginBottom: 16 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  backText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },

  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 14 },
  pageTitle: { fontSize: 22, fontWeight: "800", color: Colors.ink, marginBottom: 4, letterSpacing: -0.4 },
  pageSubtitle: { fontSize: 12, color: Colors.ink3, lineHeight: 17 },
  newBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.violet, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  newBtnText: { fontSize: 13, color: "#fff", fontWeight: "700" },

  disabledBanner: { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, padding: 12, marginBottom: 12 },
  disabledText: { fontSize: 12, color: Colors.ink3, lineHeight: 17 },

  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12, marginBottom: 10 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 13, color: Colors.ink },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg2 },
  chipOn: { backgroundColor: Colors.violet + "22", borderColor: Colors.violet },
  chipText: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
  chipTextOn: { color: Colors.violet3 },

  loadingBox: { paddingVertical: 40, alignItems: "center" },
  emptyBox: { alignItems: "center", paddingVertical: 48, gap: 8 },
  emptyTitle: { fontSize: 15, color: Colors.ink, fontWeight: "700" },
  emptyDesc: { fontSize: 12, color: Colors.ink3, textAlign: "center", maxWidth: 320, lineHeight: 17 },

  card: { backgroundColor: Colors.bg3, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  osNumber: { fontSize: 15, color: Colors.ink, fontWeight: "800", letterSpacing: 0.3 },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  customer: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  equipment: { fontSize: 12, color: Colors.ink3, marginTop: 2 },
  cardBottom: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  date: { fontSize: 11, color: Colors.ink3 },
  amount: { fontSize: 13, color: Colors.ink, fontWeight: "700" },
});
