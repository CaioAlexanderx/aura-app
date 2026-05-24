// ============================================================
// AURA. — PDV · Troca v3 · Step 1 — BUSCA UNIVERSAL
//
// 24/05/2026 — Reescrito do zero pra v3.
// Mockup: Aura/mockup_troca_v3.html
//
// FRICÇÃO ATACADA: funcionária do Davi não localizou a venda.
//
// Princípios v3:
//   • 1 campo único — detecta CPF, nome, código de barras, número da NFC-e ou ID
//   • Vendas recentes do GRUPO sempre visíveis (não escondidas atrás de search)
//   • Cross-filial = default. Badge clara em cada card (esta loja vs outra)
//   • Multi-seleção mantida (v2 feature) mas desinflada visualmente (1 venda
//     é o caminho normal — checkbox aparece grande mas não é o foco do step)
// ============================================================
import { useState, useEffect, useMemo, useRef } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { trocaApi, type SaleForTroca, type SearchForTrocaParams } from "@/services/trocaApi";
import type { SelectedSaleRow } from "./types";
import { fmtBRL } from "./types";

type Props = {
  companyId: string;
  selectedSales: SelectedSaleRow[];
  onChangeSelected: (next: SelectedSaleRow[]) => void;
};

// ─── Heurísticas pra detectar o tipo do input ──────────────────
function detectQuery(raw: string): SearchForTrocaParams {
  const v = raw.trim();
  if (!v) return {};

  // Chave NFC-e: 44 dígitos
  const onlyDigits = v.replace(/\D/g, "");
  if (onlyDigits.length === 44) {
    return { nfce_chave: onlyDigits };
  }

  // CPF (11 dígitos) / CNPJ (14 dígitos) — usa como q (LIKE no cpf_cnpj)
  if (onlyDigits.length === 11 || onlyDigits.length === 14) {
    return { q: onlyDigits };
  }

  // Nº de pedido — começa com # ou v/V seguido de hex
  if (/^[#vV-]/.test(v) || /^[a-f0-9]{6,8}$/i.test(v)) {
    return { order_number: v };
  }

  // Código de barras / SKU — 8+ dígitos puros
  if (/^\d{8,}$/.test(v) && onlyDigits.length !== 11 && onlyDigits.length !== 14) {
    return { q: v };
  }

  // Default: texto livre (nome, vendedor, produto)
  return { q: v };
}

export function Step1Search({ companyId, selectedSales, onChangeSelected }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SaleForTroca[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debouncedRef = useRef<any>(null);
  const lastReqRef = useRef(0);

  // Carrega vendas recentes do grupo na primeira renderização (sem filtro)
  useEffect(() => {
    runSearch("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  // Debounced search ao digitar
  useEffect(() => {
    if (debouncedRef.current) clearTimeout(debouncedRef.current);
    debouncedRef.current = setTimeout(() => {
      runSearch(query);
    }, 280);
    return () => {
      if (debouncedRef.current) clearTimeout(debouncedRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function runSearch(rawQ: string) {
    const params = detectQuery(rawQ);
    const reqId = ++lastReqRef.current;
    setLoading(true);
    setError(null);
    try {
      const rows = await trocaApi.searchSalesForTroca(companyId, {
        ...params,
        days: 90,
        limit: 50,
      });
      if (reqId !== lastReqRef.current) return;
      setResults(rows);
    } catch (e: any) {
      if (reqId !== lastReqRef.current) return;
      setError(e?.message || "Erro ao buscar vendas");
      setResults([]);
    } finally {
      if (reqId === lastReqRef.current) setLoading(false);
    }
  }

  const isSelected = (id: string) => selectedSales.some((s) => s.id === id);

  function toggleSelect(row: SaleForTroca) {
    if (isSelected(row.id)) {
      onChangeSelected(selectedSales.filter((s) => s.id !== row.id));
    } else {
      const enriched: SelectedSaleRow = { ...row, items: row.items || [] };
      onChangeSelected([...selectedSales, enriched]);
    }
  }

  const showingRecents = query.trim() === "";
  const detected = useMemo(() => detectQuery(query), [query]);
  const detectedLabel = useMemo(() => {
    if (!query.trim()) return "";
    if (detected.nfce_chave) return "Detectei: chave da NFC-e";
    if (detected.order_number) return "Detectei: número do pedido";
    const onlyDigits = query.replace(/\D/g, "");
    if (onlyDigits.length === 11) return "Detectei: CPF";
    if (onlyDigits.length === 14) return "Detectei: CNPJ";
    if (/^\d{8,}$/.test(query.trim())) return "Detectei: código de barras";
    return "Buscando por: nome / vendedor / produto";
  }, [query, detected]);

  return (
    <View>
      {/* Search hero */}
      <View style={s.searchWrap}>
        <Icon name="search" size={18} color="#a78bfa" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Busque por CPF, nome, código de barras ou nº da NFC-e…"
          placeholderTextColor={Colors.ink3}
          style={s.searchInput}
          autoFocus
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery("")} style={s.clearBtn}>
            <Icon name="x" size={12} color={Colors.ink3} />
          </Pressable>
        )}
      </View>

      {!!detectedLabel && (
        <Text style={s.detectLine}>{detectedLabel}</Text>
      )}

      {/* Hint chips */}
      <View style={s.hintsRow}>
        <Text style={s.hintsLabel}>Atalhos:</Text>
        {[
          { label: "CPF" },
          { label: "Nome" },
          { label: "Código de barras" },
          { label: "Nº NFC-e" },
        ].map((h) => (
          <View key={h.label} style={s.hint}>
            <Text style={s.hintTxt}>{h.label}</Text>
          </View>
        ))}
      </View>

      {/* Banner cross-filial info */}
      <View style={s.xfBanner}>
        <Icon name="repeat" size={14} color="#60a5fa" />
        <Text style={s.xfBannerTxt}>
          <Text style={{ fontWeight: "700", color: "#bfdbfe" }}>Vendas de todas as suas filiais</Text> são pesquisadas — a troca pode acontecer em qualquer loja do grupo.
        </Text>
      </View>

      {/* Selected summary */}
      {selectedSales.length > 0 && (
        <View style={s.selectedSummary}>
          <Icon name="check" size={14} color="#10b981" />
          <Text style={s.selectedSummaryTxt}>
            {selectedSales.length} {selectedSales.length === 1 ? "venda selecionada" : "vendas selecionadas"} · {fmtBRL(selectedSales.reduce((sum, x) => sum + x.total_amount, 0))}
          </Text>
          <Pressable onPress={() => onChangeSelected([])} style={s.selectedClear}>
            <Text style={s.selectedClearTxt}>Limpar</Text>
          </Pressable>
        </View>
      )}

      {/* Results header */}
      <View style={s.resultsHead}>
        <Text style={s.resultsTitle}>
          {showingRecents ? "Vendas recentes do grupo (90 dias)" : "Resultados"}
        </Text>
        {loading && <ActivityIndicator size="small" color="#a78bfa" />}
      </View>

      {/* Error */}
      {error && (
        <View style={s.errorBox}>
          <Icon name="alert-circle" size={14} color="#fca5a5" />
          <Text style={s.errorTxt}>{error}</Text>
        </View>
      )}

      {/* Empty state */}
      {!loading && results.length === 0 && !error && (
        <View style={s.emptyBox}>
          <Icon name="search" size={28} color={Colors.ink3} />
          <Text style={s.emptyTitle}>
            {showingRecents ? "Sem vendas recentes" : "Nada encontrado"}
          </Text>
          <Text style={s.emptySub}>
            {showingRecents
              ? "Quando registrar uma venda, ela aparece aqui pra troca."
              : "Tente outro CPF, nome, código ou número da NFC-e."}
          </Text>
        </View>
      )}

      {/* Results list */}
      <View style={{ gap: 10 }}>
        {results.map((row) => {
          const sel = isSelected(row.id);
          return (
            <Pressable
              key={row.id}
              onPress={() => toggleSelect(row)}
              style={[s.saleCard, sel && s.saleCardSel]}
            >
              <View style={[s.cb, sel && s.cbSel]}>
                {sel && <Icon name="check" size={12} color="#fff" />}
              </View>

              <View style={{ flex: 1, gap: 6 }}>
                <View style={s.metaRow}>
                  <Text style={s.saleId}>#{row.id.slice(0, 8).toUpperCase()}</Text>
                  <View style={[s.filialBadge, row.is_cross_filial ? s.filialOther : s.filialCurrent]}>
                    <Icon name="store" size={10} color={row.is_cross_filial ? "#fb923c" : "#a78bfa"} />
                    <Text style={[s.filialTxt, { color: row.is_cross_filial ? "#fdba74" : "#c4b5fd" }]}>
                      {row.is_cross_filial ? `${row.company_name} (outra filial)` : `${row.company_name} (esta loja)`}
                    </Text>
                  </View>
                  <View style={s.paidBadge}>
                    <Text style={s.paidTxt}>Pago</Text>
                  </View>
                </View>

                <Text style={s.custName}>
                  {row.customer_name || "Sem cadastro"}
                  {row.cpf_cnpj && <Text style={s.custDoc}>  ·  {row.cpf_cnpj}</Text>}
                </Text>

                <View style={s.itemsRow}>
                  {(row.items || []).slice(0, 3).map((it, idx) => (
                    <View key={idx} style={s.itemChip}>
                      <Text style={s.itemTxt} numberOfLines={1}>
                        {it.quantity}× {it.product_name_snapshot}
                      </Text>
                    </View>
                  ))}
                  {(row.items || []).length > 3 && (
                    <View style={s.itemChip}>
                      <Text style={s.itemTxt}>+{row.items.length - 3} itens</Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={{ alignItems: "flex-end", gap: 4 }}>
                <Text style={s.amount}>{fmtBRL(row.total_amount)}</Text>
                <Text style={s.date}>{fmtDate(row.created_at)}</Text>
                {row.seller_name && (
                  <Text style={s.seller}>Vend: {row.seller_name}</Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })
      + " · " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

const s = StyleSheet.create({
  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "rgba(124,58,237,0.06)",
    borderWidth: 2, borderColor: "rgba(124,58,237,0.25)",
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
  },
  searchInput: {
    flex: 1, color: Colors.ink, fontSize: 15, fontWeight: "500",
    paddingVertical: 4,
  },
  clearBtn: {
    width: 24, height: 24, borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center", justifyContent: "center",
  },
  detectLine: {
    fontSize: 11.5, color: "#a78bfa", marginTop: 8, marginLeft: 4, fontWeight: "500",
  },
  hintsRow: {
    flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap",
    marginTop: 12,
  },
  hintsLabel: { fontSize: 11, color: Colors.ink3, fontWeight: "600", marginRight: 2 },
  hint: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3,
  },
  hintTxt: { color: Colors.ink2, fontSize: 11, fontWeight: "500" },
  xfBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(37,99,235,0.10)",
    borderWidth: 1, borderColor: "rgba(96,165,250,0.25)",
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    marginTop: 14,
  },
  xfBannerTxt: { color: "#93c5fd", fontSize: 12.5, flex: 1 },
  selectedSummary: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(16,185,129,0.12)",
    borderWidth: 1, borderColor: "rgba(16,185,129,0.3)",
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
    marginTop: 12,
  },
  selectedSummaryTxt: { color: "#6ee7b7", fontSize: 12.5, fontWeight: "600", flex: 1 },
  selectedClear: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  selectedClearTxt: { color: Colors.ink2, fontSize: 11, fontWeight: "600" },
  resultsHead: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginTop: 18, marginBottom: 10,
  },
  resultsTitle: {
    fontSize: 11.5, color: Colors.ink3, fontWeight: "700",
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(239,68,68,0.1)",
    borderWidth: 1, borderColor: "rgba(239,68,68,0.3)",
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 10,
  },
  errorTxt: { color: "#fca5a5", fontSize: 12.5 },
  emptyBox: {
    alignItems: "center", paddingVertical: 28, gap: 8,
  },
  emptyTitle: { color: Colors.ink2, fontSize: 14, fontWeight: "700", marginTop: 6 },
  emptySub: { color: Colors.ink3, fontSize: 12.5, textAlign: "center", maxWidth: 320 },
  saleCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 12, padding: 14,
  },
  saleCardSel: {
    backgroundColor: "rgba(124,58,237,0.12)",
    borderColor: Colors.violet,
  },
  cb: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
    backgroundColor: "transparent",
    marginTop: 2,
  },
  cbSel: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  saleId: { color: Colors.ink3, fontSize: 11.5, fontWeight: "700" },
  filialBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5,
  },
  filialCurrent: { backgroundColor: "rgba(124,58,237,0.18)" },
  filialOther: { backgroundColor: "rgba(251,146,60,0.15)" },
  filialTxt: { fontSize: 11, fontWeight: "700" },
  paidBadge: {
    backgroundColor: "rgba(16,185,129,0.18)",
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5,
  },
  paidTxt: { color: "#6ee7b7", fontSize: 10.5, fontWeight: "700" },
  custName: { color: Colors.ink, fontSize: 14.5, fontWeight: "600" },
  custDoc: { color: Colors.ink3, fontWeight: "400", fontSize: 12.5 },
  itemsRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  itemChip: {
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5,
    maxWidth: 280,
  },
  itemTxt: { color: Colors.ink2, fontSize: 11.5 },
  amount: { color: Colors.ink, fontSize: 17, fontWeight: "800", letterSpacing: -0.2 },
  date: { color: Colors.ink3, fontSize: 11.5 },
  seller: { color: Colors.ink3, fontSize: 11 },
});
