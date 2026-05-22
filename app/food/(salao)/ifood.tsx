import { useState, useMemo } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, Platform } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Icon } from "@/components/Icon";
import { FoodColors } from "@/constants/food-tokens";
import { request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";

// ============================================================
// /food/(salao)/ifood — Fase 6 (iFood CSV import).
//
// 2026-05-22 (Fase 8): renomeado de delivery.tsx. O nome "Delivery"
// passa a se referir ao despacho do delivery próprio (/despacho).
// O conteúdo abaixo continua sendo a UI de import CSV do iFood.
//
// 3 abas: Importar / Pedidos importados / Estatísticas.
// ============================================================

type Tab = "importar" | "pedidos" | "stats";

type IfoodOrder = {
  id: string;
  external_id: string;
  status: string;
  customer_name: string | null;
  payment_method: string | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  created_at: string;
  imported_at: string;
  items: any[];
};

type IfoodStat = {
  source: string;
  channel: string;
  orders: number;
  revenue: number | null;
  avg_ticket: number | null;
};

type ImportResult = {
  batch_id: string;
  total_in_csv: number;
  imported: number;
  skipped: number;
  errors: Array<{ line: number; external_id: string; error: string }>;
};

function path(cid: string, suffix: string) {
  return "/companies/" + cid + "/food/ifood" + suffix;
}
const BASE_URL = ((typeof process !== "undefined" && (process.env as any)?.EXPO_PUBLIC_API_URL) ||
  "https://aura-backend-production-f805.up.railway.app/api/v1");

export default function IfoodScreen() {
  const [tab, setTab] = useState<Tab>("importar");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  return (
    <View style={{ gap: 12 }}>
      <View>
        <Text style={{ fontSize: 22, fontWeight: "800", color: FoodColors.ink }}>iFood</Text>
        <Text style={{ fontSize: 12, color: FoodColors.ink3, marginTop: 2 }}>
          Importe pedidos do iFood via CSV. Integração oficial via API entra em fase futura.
        </Text>
      </View>

      <View style={{ flexDirection: "row", gap: 6, paddingVertical: 4 }}>
        {(["importar", "pedidos", "stats"] as Tab[]).map(t => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={{
              paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
              backgroundColor: tab === t ? FoodColors.red : FoodColors.surface,
              borderWidth: 1, borderColor: tab === t ? FoodColors.red : FoodColors.border,
            }}
          >
            <Text style={{
              color: tab === t ? "#fff" : FoodColors.ink2,
              fontWeight: "600", fontSize: 13, textTransform: "capitalize",
            }}>
              {t === "stats" ? "Estatísticas" : t}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === "importar"  && <ImportTab />}
      {tab === "pedidos"   && <OrdersTab statusFilter={statusFilter} setStatusFilter={setStatusFilter} />}
      {tab === "stats"     && <StatsTab />}
    </View>
  );
}

// ============================================================
// IMPORTAR
// ============================================================
function ImportTab() {
  const { company, token } = useAuthStore();
  const qc = useQueryClient();
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileName, setFileName]       = useState<string | null>(null);
  const [result, setResult]           = useState<ImportResult | null>(null);
  const [error, setError]             = useState<string | null>(null);

  const importM = useMutation({
    mutationFn: (csv: string) =>
      request<ImportResult>(path(company!.id, "/import"), { method: "POST", body: { csv } }),
    onSuccess: (r) => {
      setResult(r);
      setError(null);
      qc.invalidateQueries({ queryKey: ["food-ifood-orders", company?.id] });
      qc.invalidateQueries({ queryKey: ["food-ifood-stats", company?.id] });
    },
    onError: (e: any) => setError(e?.message || "Erro ao importar"),
  });

  const handlePickFile = () => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,text/csv";
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = () => { setFileContent(String(reader.result)); };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleDownloadTemplate = () => {
    if (Platform.OS !== "web" || typeof window === "undefined" || !token) return;
    fetch(BASE_URL + path(company!.id, "/template"), {
      headers: { Authorization: "Bearer " + token },
    })
      .then(r => r.text())
      .then(csv => {
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "modelo-ifood-aura.csv"; a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => setError("Erro ao baixar modelo"));
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={{
        backgroundColor: FoodColors.surface, borderRadius: 12, padding: 18,
        borderWidth: 1, borderColor: FoodColors.border, alignItems: "center", gap: 10,
      }}>
        <Text style={{ fontSize: 36 }}>📄</Text>
        <Text style={{ fontSize: 14, color: FoodColors.ink, fontWeight: "700" }}>
          {fileName || "Selecione arquivo CSV do iFood"}
        </Text>
        <Text style={{ fontSize: 11, color: FoodColors.ink3, textAlign: "center", maxWidth: 360 }}>
          {fileContent
            ? Math.round(fileContent.length / 1024) + " KB pronto pra enviar"
            : "Exporte do painel iFood ou use o modelo abaixo. Linhas duplicadas (mesmo número) serão ignoradas automaticamente."}
        </Text>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
          <Pressable onPress={handlePickFile} style={{
            backgroundColor: FoodColors.surface2, paddingHorizontal: 14, paddingVertical: 10,
            borderRadius: 8, borderWidth: 1, borderColor: FoodColors.border,
          }}>
            <Text style={{ color: FoodColors.ink, fontSize: 13, fontWeight: "600" }}>
              {fileName ? "📁 Trocar arquivo" : "📁 Escolher arquivo"}
            </Text>
          </Pressable>
          {fileContent && (
            <Pressable
              onPress={() => importM.mutate(fileContent)}
              disabled={importM.isPending}
              style={{
                backgroundColor: FoodColors.red, paddingHorizontal: 14, paddingVertical: 10,
                borderRadius: 8, opacity: importM.isPending ? 0.5 : 1,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>
                {importM.isPending ? "Importando..." : "↑ Importar agora"}
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      <Pressable onPress={handleDownloadTemplate} style={{ alignSelf: "center" }}>
        <Text style={{ color: FoodColors.cyan, fontSize: 12, fontWeight: "600", textDecorationLine: "underline" }}>
          ↓ Baixar modelo CSV (formato Aura)
        </Text>
      </Pressable>

      {error && (
        <View style={{
          backgroundColor: "rgba(239,68,68,0.1)", borderLeftWidth: 3,
          borderLeftColor: FoodColors.red, padding: 12, borderRadius: 6,
        }}>
          <Text style={{ fontSize: 12, color: FoodColors.red, fontWeight: "700" }}>{error}</Text>
        </View>
      )}

      {result && (
        <View style={{
          backgroundColor: FoodColors.surface, borderRadius: 12, padding: 16,
          borderWidth: 1, borderColor: FoodColors.border, gap: 10,
        }}>
          <Text style={{ fontSize: 14, color: FoodColors.green, fontWeight: "800" }}>✓ Importação concluída</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <ResultStat label="Importados" value={result.imported} color={FoodColors.green} />
            <ResultStat label="Pulados" value={result.skipped} color={FoodColors.amber} />
            <ResultStat label="Erros" value={result.errors.length} color={FoodColors.red} />
            <ResultStat label="Total CSV" value={result.total_in_csv} color={FoodColors.ink3} />
          </View>
          {result.errors.length > 0 && (
            <View>
              <Text style={{ fontSize: 11, color: FoodColors.ink3, marginBottom: 4 }}>Linhas com erro:</Text>
              {result.errors.slice(0, 5).map((e, i) => (
                <Text key={i} style={{ fontSize: 11, color: FoodColors.red }}>
                  • Linha {e.line} ({e.external_id}): {e.error}
                </Text>
              ))}
              {result.errors.length > 5 && (
                <Text style={{ fontSize: 11, color: FoodColors.ink3 }}>
                  ...e mais {result.errors.length - 5} linhas
                </Text>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function ResultStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{
      flex: 1, backgroundColor: FoodColors.surface2, borderRadius: 8, padding: 10,
      borderWidth: 1, borderColor: FoodColors.border, alignItems: "center",
    }}>
      <Text style={{ fontSize: 20, fontWeight: "800", color }}>{value}</Text>
      <Text style={{ fontSize: 9, color: FoodColors.ink3, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</Text>
    </View>
  );
}

// ============================================================
// PEDIDOS IMPORTADOS
// ============================================================
function OrdersTab({ statusFilter, setStatusFilter }: { statusFilter: string | null; setStatusFilter: (s: string | null) => void }) {
  const { company, token } = useAuthStore();
  const { data, isLoading } = useQuery<IfoodOrder[]>({
    queryKey: ["food-ifood-orders", company?.id, statusFilter],
    queryFn: () => {
      const qs = new URLSearchParams({ limit: "50" });
      if (statusFilter) qs.set("status", statusFilter);
      return request<IfoodOrder[]>(path(company!.id, "/orders?" + qs.toString()));
    },
    enabled: !!token && !!company?.id,
  });

  const STATUS = [
    { v: null,         l: "Todos" },
    { v: "delivered",  l: "Entregue" },
    { v: "cancelled",  l: "Cancelado" },
    { v: "preparing",  l: "Preparando" },
    { v: "pending",    l: "Pendente" },
  ];

  return (
    <View style={{ gap: 10 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {STATUS.map(s => (
          <Pressable
            key={s.l}
            onPress={() => setStatusFilter(s.v)}
            style={{
              paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
              backgroundColor: statusFilter === s.v ? FoodColors.redDim : FoodColors.surface,
              borderWidth: 1, borderColor: statusFilter === s.v ? FoodColors.red : FoodColors.border,
            }}
          >
            <Text style={{
              color: statusFilter === s.v ? FoodColors.red : FoodColors.ink3,
              fontSize: 12, fontWeight: "600",
            }}>{s.l}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {isLoading ? (
        <View style={{ paddingVertical: 30, alignItems: "center" }}>
          <ActivityIndicator color={FoodColors.red} />
        </View>
      ) : !data || data.length === 0 ? (
        <View style={{
          backgroundColor: FoodColors.surface, borderRadius: 10, padding: 30,
          alignItems: "center", borderWidth: 1, borderColor: FoodColors.border, borderStyle: "dashed",
        }}>
          <Text style={{ fontSize: 13, color: FoodColors.ink3 }}>Nenhum pedido importado</Text>
        </View>
      ) : (
        <View style={{
          backgroundColor: FoodColors.surface, borderRadius: 10,
          borderWidth: 1, borderColor: FoodColors.border, overflow: "hidden",
        }}>
          {data.map(o => (
            <View key={o.id} style={{
              flexDirection: "row", paddingHorizontal: 14, paddingVertical: 10,
              alignItems: "center", gap: 10,
              borderBottomWidth: 1, borderBottomColor: FoodColors.border,
            }}>
              <Text style={{ minWidth: 90, fontSize: 11, color: FoodColors.cyan, fontWeight: "700" }}>
                #{o.external_id}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, color: FoodColors.ink, fontWeight: "600" }} numberOfLines={1}>
                  {o.customer_name || "Sem nome"}
                </Text>
                <Text style={{ fontSize: 10, color: FoodColors.ink3 }}>
                  {new Date(o.created_at).toLocaleString("pt-BR")}
                  {o.payment_method ? "  ·  " + o.payment_method : ""}
                </Text>
              </View>
              <Text style={{ fontSize: 9, color: FoodColors.ink3, textTransform: "uppercase", fontWeight: "700" }}>
                {o.status}
              </Text>
              <Text style={{ fontSize: 13, color: FoodColors.green, fontWeight: "800", minWidth: 80, textAlign: "right" }}>
                R$ {Number(o.total).toFixed(2)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ============================================================
// STATS
// ============================================================
function StatsTab() {
  const { company, token } = useAuthStore();
  const { data, isLoading } = useQuery<IfoodStat[]>({
    queryKey: ["food-ifood-stats", company?.id],
    queryFn: () => request<IfoodStat[]>(path(company!.id, "/stats")),
    enabled: !!token && !!company?.id,
  });

  if (isLoading) {
    return (
      <View style={{ paddingVertical: 30, alignItems: "center" }}>
        <ActivityIndicator color={FoodColors.red} />
      </View>
    );
  }

  if (!data || data.length === 0) {
    return (
      <View style={{
        backgroundColor: FoodColors.surface, borderRadius: 10, padding: 30,
        alignItems: "center", borderWidth: 1, borderColor: FoodColors.border,
      }}>
        <Text style={{ fontSize: 36 }}>📊</Text>
        <Text style={{ fontSize: 13, color: FoodColors.ink3, marginTop: 8 }}>
          Sem estatísticas. Importe pedidos primeiro.
        </Text>
      </View>
    );
  }

  const totalOrders  = data.reduce((s, d) => s + Number(d.orders || 0), 0);
  const totalRevenue = data.reduce((s, d) => s + Number(d.revenue || 0), 0);
  const avgTicket    = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  return (
    <View style={{ gap: 12 }}>
      <Text style={{ fontSize: 11, color: FoodColors.ink3, textTransform: "uppercase", fontWeight: "600" }}>
        Últimos 30 dias
      </Text>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <KpiCard label="Total pedidos" value={String(totalOrders)} color={FoodColors.red} />
        <KpiCard label="Receita" value={"R$ " + totalRevenue.toFixed(2)} color={FoodColors.green} />
        <KpiCard label="Ticket médio" value={"R$ " + avgTicket.toFixed(2)} color={FoodColors.cyan} />
      </View>
      <Text style={{ fontSize: 11, color: FoodColors.ink3, textTransform: "uppercase", fontWeight: "600", marginTop: 8 }}>
        Por canal
      </Text>
      <View style={{
        backgroundColor: FoodColors.surface, borderRadius: 10,
        borderWidth: 1, borderColor: FoodColors.border, overflow: "hidden",
      }}>
        {data.map((s, i) => (
          <View key={i} style={{
            flexDirection: "row", paddingHorizontal: 14, paddingVertical: 12,
            borderBottomWidth: 1, borderBottomColor: FoodColors.border,
            alignItems: "center", gap: 10,
          }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, color: FoodColors.ink, fontWeight: "700" }}>
                {s.channel === "ifood" ? "iFood" : s.channel === "presencial" ? "Presencial" : s.channel}
              </Text>
              <Text style={{ fontSize: 10, color: FoodColors.ink3 }}>fonte: {s.source}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontSize: 13, color: FoodColors.green, fontWeight: "800" }}>
                R$ {Number(s.revenue || 0).toFixed(2)}
              </Text>
              <Text style={{ fontSize: 10, color: FoodColors.ink3 }}>
                {s.orders} pedidos · ticket R$ {Number(s.avg_ticket || 0).toFixed(2)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{
      flex: 1, minWidth: 130,
      backgroundColor: FoodColors.surface, borderRadius: 10, padding: 12,
      borderWidth: 1, borderColor: FoodColors.border,
    }}>
      <Text style={{ fontSize: 10, color: FoodColors.ink3, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</Text>
      <Text style={{ fontSize: 18, color, fontWeight: "800", marginTop: 2 }}>{value}</Text>
    </View>
  );
}
