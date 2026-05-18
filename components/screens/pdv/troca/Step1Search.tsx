// ============================================================
// AURA. — PDV · Troca v2 · Step 1 (Localizar vendas)
// Multi-seleção de vendas — pode escolher 1+ pra combinar numa
// troca única. 4 modos: cliente/CPF | nº pedido | barcode | QR.
//
// Doc: Aura/AUDITORIA_TROCA_PDV_2026-05-17.docx
// 17/05/2026 (FASE A — UI Redesign)
// ============================================================
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  View, Text, Pressable, StyleSheet, TextInput,
  ActivityIndicator, Platform,
} from "react-native";
import { Colors, Glass, IS_DARK_MODE } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { salesApi } from "@/services/api";
import { trocaApi } from "@/services/trocaApi";
import type { SaleForTroca } from "@/services/trocaApi";
import { SearchModeBar, STEP1_MODES, placeholderFor } from "./SearchModeBar";
import type { Step1SearchMode, SelectedSaleRow } from "./types";
import { fmtBRL } from "./types";

const IS_WEB = Platform.OS === "web";

// SaleRow unificado pro Step 1 — vem do searchSalesForTroca (com items
// inline) ou de salesApi.list (sem items, precisa round-trip se selecionado).
type SaleRow = {
  id: string;
  total_amount: number;
  created_at: string;
  payment_method: string;
  customer_id: string | null;
  customer_name: string | null;
  cpf_cnpj: string | null;
  seller_id: string | null;
  seller_name: string | null;
  company_id: string;
  company_name: string;
  is_cross_filial: boolean;
  item_count: number;
  items?: SaleForTroca["items"];
};

const MAX_DAYS_BACK = 90;
const DEFAULT_DAYS_BACK = 7;

function todayISO() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}
function daysAgoISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}
function daysBetween(fromISO: string, toISO: string) {
  const ms = new Date(toISO).getTime() - new Date(fromISO).getTime();
  return Math.max(1, Math.round(ms / 86400000) + 1);
}

type Props = {
  companyId: string;
  selectedSales: SelectedSaleRow[];
  onChangeSelected: (next: SelectedSaleRow[]) => void;
};

export function Step1Search({
  companyId,
  selectedSales,
  onChangeSelected,
}: Props) {
  const [mode, setMode] = useState<Step1SearchMode>("text");
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState<string>(daysAgoISO(DEFAULT_DAYS_BACK));
  const [dateTo, setDateTo] = useState<string>(todayISO());
  const [loading, setLoading] = useState(false);
  const [recentSales, setRecentSales] = useState<SaleRow[]>([]);

  const minDate = useMemo(() => daysAgoISO(MAX_DAYS_BACK), []);
  const today = useMemo(() => todayISO(), []);
  const rangeDays = useMemo(() => daysBetween(dateFrom, dateTo), [dateFrom, dateTo]);

  useEffect(() => {
    if (dateFrom < minDate) setDateFrom(minDate);
    if (dateFrom > dateTo) setDateFrom(dateTo);
  }, [dateFrom, dateTo, minDate]);

  // Set de IDs já selecionados (lookup O(1)).
  const selectedIds = useMemo(() => new Set(selectedSales.map((s) => s.id)), [selectedSales]);

  // ─── Loader ──────────────────────────────────────────────────
  const loadSales = useCallback(() => {
    if (!companyId) return;
    setLoading(true);

    if (mode === "text") {
      // Endpoint group-aware (cross-filial).
      const days = Math.min(MAX_DAYS_BACK, daysBetween(dateFrom, today));
      const params: any = { days, limit: 30 };
      if (query.trim()) params.q = query.trim();
      trocaApi
        .searchSalesForTroca(companyId, params)
        .then((rows) => {
          const mapped: SaleRow[] = (rows || []).map((r) => ({
            id: r.id,
            total_amount: parseFloat(String(r.total_amount)),
            created_at: r.created_at,
            payment_method: r.payment_method,
            customer_id: r.customer_id,
            customer_name: r.customer_name,
            cpf_cnpj: r.cpf_cnpj,
            seller_id: r.seller_id,
            seller_name: r.seller_name,
            company_id: r.company_id,
            company_name: r.company_name || "—",
            is_cross_filial: !!r.is_cross_filial,
            item_count: parseInt(String(r.item_count || 0), 10),
            items: r.items,
          }));
          setRecentSales(mapped);
        })
        .catch(() => setRecentSales([]))
        .finally(() => setLoading(false));
    } else if (mode === "barcode") {
      // Endpoint legado — same-filial only. Filtra por barcode do produto.
      const params: any = {
        date_from: dateFrom + "T00:00:00",
        date_to: dateTo + "T23:59:59",
        status: "active",
        limit: 30,
      };
      if (query.trim()) params.product_barcode = query.trim();
      salesApi
        .list(companyId, params)
        .then((res) => {
          const mapped: SaleRow[] = (res.sales || []).map((s: any) => ({
            id: s.id,
            total_amount: parseFloat(s.total_amount),
            created_at: s.created_at,
            payment_method: s.payment_method,
            customer_id: s.customer_id || s.customer?.id || null,
            customer_name: s.customer_name || s.customer?.name || null,
            cpf_cnpj: s.cpf_cnpj || s.customer?.cpf_cnpj || null,
            seller_id: s.seller_id || null,
            seller_name: s.seller_name || null,
            company_id: companyId,
            company_name: "",
            is_cross_filial: false,
            item_count: s.items_count ?? 0,
            items: undefined,
          }));
          setRecentSales(mapped);
        })
        .catch(() => setRecentSales([]))
        .finally(() => setLoading(false));
    } else {
      // order | qr — backend ainda não tem endpoint dedicado.
      // Por enquanto, faz fallback text mode com a query truncada.
      setLoading(false);
      setRecentSales([]);
    }
  }, [companyId, mode, query, dateFrom, dateTo, today]);

  useEffect(() => { loadSales(); }, [loadSales]);

  // ─── pickSale: alterna seleção, carrega detail se preciso ────
  async function toggleSale(row: SaleRow) {
    if (selectedIds.has(row.id)) {
      onChangeSelected(selectedSales.filter((s) => s.id !== row.id));
      return;
    }

    // Adicionando — se já tem items inline, vai direto.
    if (row.items && row.items.length > 0) {
      const sel: SelectedSaleRow = { ...row, items: row.items } as any;
      onChangeSelected([...selectedSales, sel]);
      return;
    }

    // barcode mode (sem items inline) → round-trip pra carregar items.
    try {
      const detail = await salesApi.get(companyId, row.id);
      const items: SaleForTroca["items"] = (detail.items || []).map((it: any) => ({
        product_id: it.product_id,
        variant_id: it.variant_id || null,
        product_name_snapshot: it.product_name_snapshot || it.product_name,
        quantity: parseFloat(it.quantity),
        unit_price: parseFloat(it.unit_price),
      }));
      const sel: SelectedSaleRow = { ...row, items } as any;
      onChangeSelected([...selectedSales, sel]);
    } catch (e: any) {
      // Erro silencioso — a UI já mostra o card; reverter seria pior.
      // O Step 2 vai exibir "venda sem itens carregados" se chegar nesse estado.
    }
  }

  // ─── Banners ─────────────────────────────────────────────────
  const hasCrossFilialInList = recentSales.some((s) => s.is_cross_filial);
  const showOrderQrPlaceholder = mode === "order" || mode === "qr";

  // ─── Selection summary ───────────────────────────────────────
  const selCount = selectedSales.length;
  const selTotal = selectedSales.reduce((s, r) => s + r.total_amount, 0);

  return (
    <View>
      <Text style={s.sectionTitle}>Localizar venda original</Text>
      <Text style={s.sectionSub}>
        Selecione uma ou mais vendas — o cliente pode trazer itens de compras diferentes na mesma troca.
      </Text>

      {/* Cross-filial banner */}
      {mode === "text" && hasCrossFilialInList && (
        <View style={s.crossBanner}>
          <View style={s.crossBannerIcon}>
            <Text style={{ fontSize: 14 }}>🏢</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.crossBannerTitle}>Busca em todas as suas filiais</Text>
            <Text style={s.crossBannerSub}>
              Vendas com badge azul foram feitas em outra filial do seu grupo — você pode trocá-las normalmente.
            </Text>
          </View>
        </View>
      )}

      {/* Barcode same-filial warning */}
      {mode === "barcode" && (
        <View style={s.warnBanner}>
          <Text style={{ fontSize: 12 }}>⚠️</Text>
          <Text style={s.warnBannerTxt}>
            Busca por código de barras está limitada a esta filial. Use{" "}
            <Text style={{ fontWeight: "700" }}>Cliente/CPF</Text> para buscar em todas.
          </Text>
        </View>
      )}

      {/* Order/QR placeholder — backend ainda não tem endpoint dedicado */}
      {showOrderQrPlaceholder && (
        <View style={s.warnBanner}>
          <Text style={{ fontSize: 12 }}>🚧</Text>
          <Text style={s.warnBannerTxt}>
            {mode === "order"
              ? "Busca por número do pedido está em rollout. Por enquanto use Cliente/CPF."
              : "Leitura de QR do cupom NFC-e está em rollout. Por enquanto use Cliente/CPF."}
          </Text>
        </View>
      )}

      {/* Date range */}
      <View style={s.dateRow}>
        <View style={s.dateField}>
          <Text style={s.dateLabel}>De</Text>
          {IS_WEB ? (
            <input
              type="date"
              value={dateFrom}
              min={minDate}
              max={dateTo}
              onChange={(e: any) => setDateFrom(e.target.value)}
              style={{
                padding: "10px 12px",
                borderRadius: 9,
                background: Glass.bgInput as any,
                border: "1px solid " + (Glass.bgInputBorder as any),
                color: Colors.ink as any,
                fontSize: 13,
                outline: "none",
                width: "100%",
              }}
            />
          ) : (
            <TextInput
              style={s.input as any}
              value={dateFrom}
              onChangeText={setDateFrom}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.ink3}
            />
          )}
        </View>
        <View style={s.dateField}>
          <Text style={s.dateLabel}>Até</Text>
          {IS_WEB ? (
            <input
              type="date"
              value={dateTo}
              min={dateFrom}
              max={today}
              onChange={(e: any) => setDateTo(e.target.value)}
              style={{
                padding: "10px 12px",
                borderRadius: 9,
                background: Glass.bgInput as any,
                border: "1px solid " + (Glass.bgInputBorder as any),
                color: Colors.ink as any,
                fontSize: 13,
                outline: "none",
                width: "100%",
              }}
            />
          ) : (
            <TextInput
              style={s.input as any}
              value={dateTo}
              onChangeText={setDateTo}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.ink3}
            />
          )}
        </View>
      </View>
      <Text style={s.rangeHint}>
        {rangeDays === 1 ? "1 dia" : `${rangeDays} dias`} · janela máxima de {MAX_DAYS_BACK} dias atrás
      </Text>

      {/* Mode bar */}
      <SearchModeBar mode={mode} modes={STEP1_MODES} onChange={setMode} />

      {/* Search input */}
      <TextInput
        style={s.input as any}
        value={query}
        onChangeText={setQuery}
        placeholder={placeholderFor(mode, STEP1_MODES)}
        placeholderTextColor={Colors.ink3}
        autoFocus
        editable={!showOrderQrPlaceholder}
      />

      {/* Results */}
      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator color={Colors.violet} />
        </View>
      ) : recentSales.length === 0 ? (
        <Text style={s.emptyTxt}>
          {showOrderQrPlaceholder
            ? "Use Cliente/CPF por enquanto."
            : mode === "barcode" && query.trim()
            ? "Nenhuma venda com esse código de barras no período."
            : "Nenhuma venda ativa encontrada no período."}
        </Text>
      ) : (
        recentSales.map((sale) => {
          const selected = selectedIds.has(sale.id);
          return (
            <Pressable
              key={sale.id}
              style={[s.saleCard, selected && s.saleCardSelected]}
              onPress={() => toggleSale(sale)}
            >
              <View style={[s.checkbox, selected && s.checkboxOn]}>
                {selected && <Icon name="check" size={12} color="#fff" />}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={s.saleCardTop}>
                  <Text style={s.saleCustomer} numberOfLines={1}>
                    {sale.customer_name || "Sem cliente"}
                  </Text>
                  {sale.is_cross_filial && (
                    <View style={s.badgeFilial}>
                      <Text style={s.badgeFilialIcon}>🏢</Text>
                      <Text style={s.badgeFilialTxt} numberOfLines={1}>
                        {sale.company_name}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={s.saleMeta}>
                  {new Date(sale.created_at).toLocaleDateString("pt-BR", {
                    day: "2-digit", month: "2-digit",
                  })}{" "}
                  às{" "}
                  {new Date(sale.created_at).toLocaleTimeString("pt-BR", {
                    hour: "2-digit", minute: "2-digit",
                  })}
                  {" · "}
                  {sale.item_count} {sale.item_count === 1 ? "item" : "itens"}
                  {sale.cpf_cnpj ? ` · CPF ${sale.cpf_cnpj}` : ""}
                </Text>
              </View>
              <View style={s.saleAmount}>
                <Text style={s.saleAmountVal}>{fmtBRL(sale.total_amount)}</Text>
              </View>
            </Pressable>
          );
        })
      )}

      {/* Multi-banner (≥2 selected) */}
      {selCount > 1 && (
        <View style={s.multiBanner}>
          <Text style={{ fontSize: 16 }}>🧾</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.multiBannerTitle}>
              Combinando {selCount} vendas em uma só troca
            </Text>
            <Text style={s.multiBannerSub}>
              Cupom de devolução único, comissão dividida proporcionalmente. NFC-e nova segue a regra fiscal mais antiga (definido no Step 4).
            </Text>
          </View>
        </View>
      )}

      {/* Selection summary */}
      <View style={[s.selSummary, selCount === 0 && { opacity: 0.5 }]}>
        <View>
          <Text style={s.selCount}>
            <Text style={{ fontWeight: "700", color: Colors.violet3 }}>{selCount}</Text>{" "}
            {selCount === 1 ? "venda selecionada" : "vendas selecionadas"}
          </Text>
          <Text style={s.selTotal}>Total combinado: {fmtBRL(selTotal)}</Text>
        </View>
        {selCount === 0 && (
          <Text style={s.selHint}>Selecione ao menos uma venda para avançar</Text>
        )}
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const s = StyleSheet.create({
  sectionTitle: {
    fontSize: 15, fontWeight: "700", color: Colors.ink, marginBottom: 2, letterSpacing: -0.2,
  },
  sectionSub: {
    fontSize: 12, color: Colors.ink3, marginBottom: 14,
  },

  // Cross-filial banner
  crossBanner: {
    flexDirection: "row", gap: 10, padding: 12,
    backgroundColor: "rgba(96,165,250,0.08)",
    borderWidth: 1, borderColor: "rgba(96,165,250,0.25)",
    borderRadius: 10, marginBottom: 12,
  },
  crossBannerIcon: {
    width: 28, height: 28, borderRadius: 7,
    backgroundColor: "rgba(96,165,250,0.15)",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  crossBannerTitle: { fontSize: 12, fontWeight: "700", color: "#60a5fa", marginBottom: 2 },
  crossBannerSub: { fontSize: 11, color: Colors.ink2, lineHeight: 16 },

  // Warning banner (barcode same-filial / order-qr placeholder)
  warnBanner: {
    flexDirection: "row", gap: 8, alignItems: "center",
    padding: 10, marginBottom: 12,
    backgroundColor: "rgba(251,191,36,0.08)",
    borderWidth: 1, borderColor: "rgba(251,191,36,0.25)",
    borderRadius: 9,
  },
  warnBannerTxt: { fontSize: 11, color: Colors.ink2, lineHeight: 16, flex: 1 },

  // Date range
  dateRow: { flexDirection: "row", gap: 10, marginBottom: 6 },
  dateField: { flex: 1 },
  dateLabel: {
    fontSize: 11, fontWeight: "600", textTransform: "uppercase",
    letterSpacing: 0.5, color: Colors.ink3, marginBottom: 6,
  },
  rangeHint: {
    fontSize: 11, color: Colors.ink4, marginBottom: 14, fontStyle: "italic",
  },

  // Input
  input: {
    backgroundColor: Glass.bgInput,
    borderWidth: 1, borderColor: Glass.bgInputBorder,
    color: Colors.ink, paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 9, fontSize: 13, marginBottom: 12,
  },

  // Empty/loading
  emptyTxt: {
    color: Colors.ink3, fontSize: 12, fontStyle: "italic",
    textAlign: "center", paddingVertical: 20,
  },
  centered: { paddingVertical: 24, alignItems: "center" },

  // Sale card
  saleCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 12, marginBottom: 6,
    backgroundColor: IS_DARK_MODE ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.02)",
    borderWidth: 1, borderColor: IS_DARK_MODE ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
    borderRadius: 12,
  },
  saleCardSelected: {
    backgroundColor: "rgba(124,58,237,0.1)",
    borderColor: "rgba(139,92,246,0.5)",
  },
  checkbox: {
    width: 20, height: 20, borderRadius: 6,
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: "transparent", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  checkboxOn: {
    backgroundColor: Colors.violet, borderColor: Colors.violet,
  },
  saleCardTop: {
    flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3,
  },
  saleCustomer: { fontSize: 13, fontWeight: "600", color: Colors.ink, flexShrink: 1 },
  saleMeta: { fontSize: 11, color: Colors.ink3 },
  saleAmount: { flexShrink: 0 },
  saleAmountVal: { fontSize: 13, fontWeight: "700", color: Colors.ink, textAlign: "right" },
  badgeFilial: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "rgba(96,165,250,0.15)",
    borderWidth: 1, borderColor: "rgba(96,165,250,0.3)",
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999,
  },
  badgeFilialIcon: { fontSize: 9 },
  badgeFilialTxt: { fontSize: 10, fontWeight: "700", color: "#60a5fa", maxWidth: 100 },

  // Multi banner (2+ selected)
  multiBanner: {
    marginTop: 12, padding: 12,
    flexDirection: "row", gap: 10, alignItems: "flex-start",
    backgroundColor: "rgba(96,165,250,0.08)",
    borderWidth: 1, borderColor: "rgba(96,165,250,0.25)",
    borderRadius: 10,
  },
  multiBannerTitle: { fontSize: 12, fontWeight: "700", color: "#60a5fa", marginBottom: 2 },
  multiBannerSub: { fontSize: 11, color: Colors.ink2, lineHeight: 16 },

  // Selection summary
  selSummary: {
    marginTop: 14, padding: 14,
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", gap: 12,
    backgroundColor: "rgba(124,58,237,0.1)",
    borderWidth: 1, borderColor: "rgba(124,58,237,0.3)",
    borderRadius: 12,
  },
  selCount: { fontSize: 13, fontWeight: "600", color: Colors.ink2 },
  selTotal: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  selHint: { fontSize: 11, color: Colors.ink3, fontStyle: "italic" },
});

export default Step1Search;
