// ============================================================
// AURA STUDIO · Editor / Detalhe de Orçamento
// Localização canônica: gestao/orcamentos/[id] (P2 30/05/2026)
//
// id='novo' → cria novo orçamento
// id=uuid   → carrega e permite editar (se draft) ou ver
//
// Funcionalidades:
//   - Header: status pill + ações contextuais
//   - Campos: cliente (nome, phone), validade, sinal %
//   - Lista de itens com subtotal por linha
//   - Rodapé: subtotal, desconto, total
//   - "Adicionar item" → modal busca produto ou texto livre
//     Integração A→B: ao selecionar produto chama calculateQuoteLine
//     (motor de precificação, Fase B). Fallback ao preço cadastrado.
//   - "Enviar" → studioApi.sendQuote → exibe link + wa.me
//   - "Converter em Pedido" (só accepted) → studioApi.convertQuote
// ============================================================
import { useEffect, useState, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  TextInput, ActivityIndicator, Modal, Alert, Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { useAuth } from "@/hooks/useAuth";
import {
  studioApi,
  type StudioQuote,
  type StudioQuoteItem,
  type StudioQuoteStatus,
  type StudioQuoteCreated,
  type PricingBreakdown,
} from "@/services/studioApi";

// ─── Status pills ─────────────────────────────────────────────
const STATUS_LABEL: Record<StudioQuoteStatus, string> = {
  draft: "Rascunho", sent: "Enviado", accepted: "Aceito",
  rejected: "Recusado", expired: "Expirado", converted: "Convertido",
};
const STATUS_COLORS: Record<StudioQuoteStatus, { bg: string; text: string }> = {
  draft:     { bg: "#F1F5F9", text: "#64748B" },
  sent:      { bg: "#DBEAFE", text: "#1D4ED8" },
  accepted:  { bg: "#D1FAE5", text: "#065F46" },
  rejected:  { bg: "#FEE2E2", text: "#991B1B" },
  expired:   { bg: "#FEF3C7", text: "#92400E" },
  converted: { bg: "#EDE9FE", text: "#5B21B6" },
};
function StatusPill({ status }: { status: StudioQuoteStatus }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.draft;
  return (
    <View style={[pill.wrap, { backgroundColor: c.bg }]}>
      <Text style={[pill.txt, { color: c.text }]}>{STATUS_LABEL[status] || status}</Text>
    </View>
  );
}
const pill = StyleSheet.create({
  wrap: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  txt:  { fontSize: 11, fontWeight: "700" },
});

// ─── Modal de adicionar item ──────────────────────────────────
type ItemModalProps = {
  visible: boolean;
  companyId: string;
  onClose: () => void;
  onAdd: (item: Omit<StudioQuoteItem, "id">) => void;
};
function AddItemModal({ visible, companyId, onClose, onAdd }: ItemModalProps) {
  const [query, setQuery]       = useState("");
  const [results, setResults]   = useState<any[]>([]);
  const [searching, setSearch]  = useState(false);
  const [pricing, setPricing]   = useState(false); // A→B: calculando preço
  const [desc, setDesc]         = useState("");
  const [qty, setQty]           = useState("1");
  const [price, setPrice]       = useState("");
  const [mode, setMode]         = useState<"search" | "free">("search");

  useEffect(() => {
    if (!visible) { setQuery(""); setResults([]); setDesc(""); setQty("1"); setPrice(""); setMode("search"); setPricing(false); }
  }, [visible]);

  async function doSearch(q: string) {
    if (!q.trim() || !companyId) return;
    setSearch(true);
    try {
      const r = await fetch(`/api/v1/companies/${companyId}/products?q=${encodeURIComponent(q)}&limit=20`);
      const data = await r.json();
      setResults(data.products || []);
    } catch { setResults([]); }
    finally { setSearch(false); }
  }

  // Integração A→B: ao selecionar produto, pede preço ao motor de precificação (Fase B).
  // Fallback gracioso: se motor retornar 501 (stub) ou não tiver regra, usa preço cadastrado.
  async function selectProduct(p: any) {
    setPricing(true);
    let suggestedPrice = parseFloat(p.price) || 0;
    let pricingMeta: PricingBreakdown["breakdown"] | null = null;
    let unitCost: number | null = p.cost_price ? parseFloat(p.cost_price) : null;

    if (companyId) {
      try {
        const calc = await studioApi.calculateQuoteLine(companyId, {
          product_id: p.id,
          quantity:   1,
        });
        if (calc.unit_price > 0) {
          suggestedPrice = calc.unit_price;
          pricingMeta    = calc.breakdown;
          if (calc.breakdown.base_cost > 0) unitCost = calc.breakdown.base_cost;
        }
      } catch {
        // Motor B ainda em stub ou sem regra — usa preço cadastrado no produto
      }
    }

    onAdd({
      product_id:   p.id,
      description:  p.name,
      quantity:     1,
      unit_price:   suggestedPrice,
      unit_cost:    unitCost,
      pricing_meta: pricingMeta ?? undefined,
    });
    setPricing(false);
    onClose();
  }

  function addFree() {
    if (!desc.trim()) return Alert.alert("Descrição obrigatória");
    const q = Math.max(0.01, parseFloat(qty.replace(",", ".")) || 1);
    const p = Math.max(0, parseFloat(price.replace(",", ".")) || 0);
    onAdd({ product_id: null, description: desc.trim(), quantity: q, unit_price: p });
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={m.bg}>
        <View style={m.card}>
          <View style={m.topRow}>
            <Text style={m.title}>Adicionar item</Text>
            <Pressable onPress={onClose}><Icon name="x" size={20} color="#64748B" /></Pressable>
          </View>

          {/* Tabs */}
          <View style={m.tabs}>
            <Pressable style={[m.tab, mode === "search" && m.tabActive]} onPress={() => setMode("search")}>
              <Text style={[m.tabTxt, mode === "search" && m.tabTxtActive]}>Buscar produto</Text>
            </Pressable>
            <Pressable style={[m.tab, mode === "free" && m.tabActive]} onPress={() => setMode("free")}>
              <Text style={[m.tabTxt, mode === "free" && m.tabTxtActive]}>Item livre</Text>
            </Pressable>
          </View>

          {mode === "search" ? (
            <View style={{ gap: 10 }}>
              <View style={m.searchRow}>
                <TextInput
                  style={m.searchInput}
                  placeholder="Nome do produto..."
                  value={query}
                  onChangeText={(v) => { setQuery(v); if (v.length >= 2) doSearch(v); }}
                  autoFocus
                />
                {(searching || pricing) && <ActivityIndicator size="small" color="#1E3A8A" />}
              </View>
              {pricing && (
                <Text style={m.pricingHint}>Consultando motor de precificação...</Text>
              )}
              <ScrollView style={{ maxHeight: 260 }}>
                {results.map((p) => (
                  <Pressable key={p.id} style={m.resultRow} onPress={() => selectProduct(p)} disabled={pricing}>
                    <Text style={m.resultName}>{p.name}</Text>
                    <Text style={m.resultPrice}>R$ {parseFloat(p.price || 0).toFixed(2)}</Text>
                  </Pressable>
                ))}
                {!searching && query.length >= 2 && results.length === 0 && (
                  <Text style={m.noResults}>Nenhum produto encontrado</Text>
                )}
              </ScrollView>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <TextInput style={m.input} placeholder="Descrição do item *" value={desc} onChangeText={setDesc} autoFocus />
              <View style={m.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={m.label}>Qtd</Text>
                  <TextInput style={m.input} value={qty} onChangeText={setQty} keyboardType="decimal-pad" />
                </View>
                <View style={{ flex: 2 }}>
                  <Text style={m.label}>Preço unit. (R$)</Text>
                  <TextInput style={m.input} value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="0,00" />
                </View>
              </View>
              <Pressable style={m.addBtn} onPress={addFree}>
                <Text style={m.addBtnTxt}>Adicionar item</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const m = StyleSheet.create({
  bg: { flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "flex-end" },
  card: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "85%" },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  title: { fontSize: 17, fontWeight: "800", color: "#0F172A" },
  tabs: { flexDirection: "row", gap: 8, marginBottom: 14 },
  tab: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 10, backgroundColor: "#F1F5F9" },
  tabActive: { backgroundColor: "#EFF6FF", borderWidth: 1.5, borderColor: "#1E3A8A" },
  tabTxt: { fontSize: 13, fontWeight: "600", color: "#64748B" },
  tabTxtActive: { color: "#1E3A8A" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  searchInput: {
    flex: 1, backgroundColor: "#F8FAFC", borderWidth: 1.5, borderColor: "#CBD5E1",
    borderRadius: 10, padding: 12, fontSize: 14, color: "#0F172A",
  },
  pricingHint: { fontSize: 12, color: "#1E3A8A", fontStyle: "italic", textAlign: "center" },
  resultRow: {
    flexDirection: "row", justifyContent: "space-between", paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "#F1F5F9",
  },
  resultName: { fontSize: 14, color: "#0F172A", flex: 1 },
  resultPrice: { fontSize: 14, fontWeight: "700", color: "#1E3A8A" },
  noResults: { textAlign: "center", color: "#94A3B8", paddingVertical: 16 },
  input: {
    backgroundColor: "#F8FAFC", borderWidth: 1.5, borderColor: "#CBD5E1",
    borderRadius: 10, padding: 12, fontSize: 14, color: "#0F172A",
  },
  row2: { flexDirection: "row", gap: 10 },
  label: { fontSize: 12, color: "#64748B", fontWeight: "600", marginBottom: 4 },
  addBtn: { backgroundColor: "#1E3A8A", paddingVertical: 14, borderRadius: 12, alignItems: "center", marginTop: 4 },
  addBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 14 },
});

// ─── Componente principal ────────────────────────────────────
export default function OrcamentoEditorScreen() {
  const { id }      = useLocalSearchParams<{ id: string }>();
  const router      = useRouter();
  const { companyId } = useAuth();
  const isNew = id === "novo";

  // Form fields
  const [customerName,  setCustomerName]  = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [validityDays,  setValidityDays]  = useState("7");
  const [depositPct,    setDepositPct]    = useState("");
  const [discount,      setDiscount]      = useState("0");
  const [notes,         setNotes]         = useState("");
  const [items,         setItems]         = useState<Omit<StudioQuoteItem, "id">[]>([]);

  // State
  const [quote,    setQuote]   = useState<StudioQuote | null>(null);
  const [loading,  setLoading] = useState(!isNew);
  const [saving,   setSaving]  = useState(false);
  const [error,    setError]   = useState<string | null>(null);
  const [addModal, setAddModal] = useState(false);
  const [sentData, setSentData] = useState<StudioQuoteCreated | null>(null);

  // Carrega orçamento existente
  useEffect(() => {
    if (isNew || !companyId) return;
    studioApi.getQuote(companyId, id!)
      .then(({ quote: q, items: its }) => {
        setQuote(q);
        setCustomerName(q.customer_name || "");
        setCustomerPhone(q.customer_phone || "");
        setValidityDays(String(q.validity_days || 7));
        setDepositPct(q.deposit_pct != null ? String(q.deposit_pct) : "");
        setDiscount(String(q.discount || 0));
        setNotes(q.notes || "");
        setItems(its.map((it) => ({
          product_id:  it.product_id,
          description: it.description,
          quantity:    it.quantity,
          unit_price:  it.unit_price,
          unit_cost:   it.unit_cost,
          pricing_meta: it.pricing_meta,
          customization: it.customization,
          sort_order:  it.sort_order,
        })));
      })
      .catch((e: any) => setError(e?.message || "Erro ao carregar orçamento"))
      .finally(() => setLoading(false));
  }, [id, companyId, isNew]);

  // Totais calculados localmente
  const disc     = Math.max(0, parseFloat(discount.replace(",", ".")) || 0);
  const subtotal = items.reduce((a, it) => a + it.quantity * it.unit_price, 0);
  const total    = Math.max(0, subtotal - disc);
  const depPct   = parseFloat(depositPct.replace(",", ".")) || 0;
  const depAmt   = depPct > 0 ? (total * depPct / 100) : 0;

  const isDraft  = !quote || quote.status === "draft";
  const canSend  = quote?.status === "draft" || quote?.status === "sent";

  // ─── Salvar / Criar ─────────────────────────────────────────
  async function save(): Promise<StudioQuote | null> {
    if (!companyId) return null;
    setSaving(true);
    setError(null);
    try {
      const body = {
        customer_name:  customerName.trim() || undefined,
        customer_phone: customerPhone.trim() || undefined,
        items: items.map((it, i) => ({ ...it, sort_order: i })),
        discount: disc,
        validity_days: Math.max(1, parseInt(validityDays) || 7),
        deposit_pct: depPct > 0 ? depPct : null,
        deposit_amount: depPct > 0 ? parseFloat(depAmt.toFixed(2)) : null,
        notes: notes.trim() || undefined,
      };

      if (isNew) {
        const q = await studioApi.createQuote(companyId, { ...body, items: body.items as any });
        setQuote(q);
        // P2: rota canônica sob gestao/orcamentos/
        router.replace(`/studio/gestao/orcamentos/${q.id}` as any);
        return q;
      } else {
        const q = await studioApi.updateQuote(companyId, id!, body as any);
        setQuote(q);
        return q;
      }
    } catch (e: any) {
      setError(e?.message || "Erro ao salvar");
      return null;
    } finally {
      setSaving(false);
    }
  }

  // ─── Enviar ─────────────────────────────────────────────────
  async function handleSend() {
    if (!companyId || !quote) return;
    setSaving(true);
    setError(null);
    try {
      const data = await studioApi.sendQuote(companyId, quote.id);
      setQuote(data);
      setSentData(data);
    } catch (e: any) {
      setError(e?.message || "Erro ao enviar orçamento");
    } finally {
      setSaving(false);
    }
  }

  // ─── Converter ──────────────────────────────────────────────
  async function handleConvert() {
    if (!companyId || !quote) return;
    setSaving(true);
    setError(null);
    try {
      const data = await studioApi.convertQuote(companyId, quote.id);
      setQuote(data.quote);
      Alert.alert(
        "Pedido criado!",
        "O orçamento foi convertido em pedido Studio.",
        [{ text: "Ver pedido", onPress: () => router.push(`/studio/pedidos/${data.order_id}` as any) }]
      );
    } catch (e: any) {
      setError(e?.message || "Erro ao converter orçamento");
    } finally {
      setSaving(false);
    }
  }

  // ─── Render ──────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#1E3A8A" />
      </View>
    );
  }

  // Pós-envio: exibe link
  if (sentData) {
    return (
      <View style={s.root}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.backBtn}>
            <Icon name="arrow-left" size={20} color="#0F172A" />
          </Pressable>
          <Text style={s.headerTitle}>Orçamento enviado</Text>
        </View>
        <ScrollView contentContainerStyle={s.sentContainer}>
          <View style={s.sentCard}>
            <Icon name="check-circle" size={48} color="#10B981" />
            <Text style={s.sentTitle}>Link gerado!</Text>
            <Text style={s.sentUrl}>{(sentData as any).quote_url}</Text>
            <Pressable
              style={s.copyBtn}
              onPress={() => Linking.openURL((sentData as any).quote_url)}
            >
              <Icon name="external-link" size={16} color="#fff" />
              <Text style={s.copyBtnTxt}>Abrir link</Text>
            </Pressable>
            {(sentData as any).wa_me_link && (
              <Pressable
                style={[s.copyBtn, { backgroundColor: "#25D366", marginTop: 10 }]}
                onPress={() => Linking.openURL((sentData as any).wa_me_link!)}
              >
                <Icon name="message-circle" size={16} color="#fff" />
                <Text style={s.copyBtnTxt}>Enviar pelo WhatsApp</Text>
              </Pressable>
            )}
            <Pressable style={s.backLink} onPress={() => setSentData(null)}>
              <Text style={s.backLinkTxt}>Voltar ao orçamento</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Icon name="arrow-left" size={20} color="#0F172A" />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>
          {isNew ? "Novo orçamento" : (customerName || "Orçamento")}
        </Text>
        {quote && <StatusPill status={quote.status} />}
      </View>

      <ScrollView contentContainerStyle={s.form}>
        {error ? (
          <View style={s.errorBanner}>
            <Text style={s.errorTxt}>{error}</Text>
          </View>
        ) : null}

        {/* Dados do cliente */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>CLIENTE</Text>
          <TextInput
            style={s.input}
            placeholder="Nome do cliente"
            value={customerName}
            onChangeText={setCustomerName}
            editable={isDraft}
          />
          <TextInput
            style={s.input}
            placeholder="Telefone / WhatsApp"
            value={customerPhone}
            onChangeText={setCustomerPhone}
            keyboardType="phone-pad"
            editable={isDraft}
          />
        </View>

        {/* Itens */}
        <View style={s.section}>
          <View style={s.sectionRow}>
            <Text style={s.sectionLabel}>ITENS</Text>
            {isDraft && (
              <Pressable style={s.addItemBtn} onPress={() => setAddModal(true)}>
                <Icon name="plus" size={14} color="#1E3A8A" />
                <Text style={s.addItemTxt}>Adicionar item</Text>
              </Pressable>
            )}
          </View>

          {items.length === 0 ? (
            <View style={s.emptyItems}>
              <Text style={s.emptyItemsTxt}>Nenhum item adicionado</Text>
            </View>
          ) : (
            items.map((it, i) => (
              <View key={i} style={s.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.itemName}>{it.description}</Text>
                  <Text style={s.itemDetail}>
                    {it.quantity} × R$ {it.unit_price.toFixed(2)}
                    {it.pricing_meta ? " (motor B)" : ""}
                  </Text>
                </View>
                <Text style={s.itemTotal}>
                  R$ {(it.quantity * it.unit_price).toFixed(2)}
                </Text>
                {isDraft && (
                  <Pressable
                    style={s.removeBtn}
                    onPress={() => setItems((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <Icon name="trash-2" size={15} color="#DC2626" />
                  </Pressable>
                )}
              </View>
            ))
          )}
        </View>

        {/* Config */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>CONFIGURAÇÕES</Text>
          <View style={s.row2}>
            <View style={{ flex: 1 }}>
              <Text style={s.inputLabel}>Validade (dias)</Text>
              <TextInput
                style={s.input}
                value={validityDays}
                onChangeText={setValidityDays}
                keyboardType="number-pad"
                editable={isDraft}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.inputLabel}>Sinal (%)</Text>
              <TextInput
                style={s.input}
                value={depositPct}
                onChangeText={setDepositPct}
                keyboardType="decimal-pad"
                placeholder="0"
                editable={isDraft}
              />
            </View>
          </View>
          <Text style={s.inputLabel}>Observações</Text>
          <TextInput
            style={[s.input, { minHeight: 80, textAlignVertical: "top" }]}
            value={notes}
            onChangeText={setNotes}
            multiline
            editable={isDraft}
            placeholder="Detalhes, prazos, instruções..."
          />
        </View>

        {/* Totais */}
        <View style={s.totalsCard}>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Subtotal</Text>
            <Text style={s.totalVal}>R$ {subtotal.toFixed(2)}</Text>
          </View>
          {isDraft ? (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Desconto</Text>
              <TextInput
                style={s.discountInput}
                value={discount}
                onChangeText={setDiscount}
                keyboardType="decimal-pad"
              />
            </View>
          ) : (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Desconto</Text>
              <Text style={s.totalVal}>R$ {disc.toFixed(2)}</Text>
            </View>
          )}
          {depPct > 0 && (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Sinal ({depPct}%)</Text>
              <Text style={s.totalVal}>R$ {depAmt.toFixed(2)}</Text>
            </View>
          )}
          <View style={[s.totalRow, s.totalRowFinal]}>
            <Text style={s.totalLabelFinal}>Total</Text>
            <Text style={s.totalValFinal}>R$ {total.toFixed(2)}</Text>
          </View>
        </View>

        {/* Ações */}
        <View style={s.actionsSection}>
          {isDraft && (
            <Pressable
              style={[s.btnPrimary, saving && s.btnDisabled]}
              onPress={save}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <><Icon name="save" size={16} color="#fff" /><Text style={s.btnPrimaryTxt}>Salvar rascunho</Text></>}
            </Pressable>
          )}

          {canSend && quote && (
            <Pressable
              style={[s.btnSend, saving && s.btnDisabled]}
              onPress={handleSend}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <><Icon name="send" size={16} color="#fff" /><Text style={s.btnPrimaryTxt}>Enviar ao cliente</Text></>}
            </Pressable>
          )}

          {quote?.status === "accepted" && (
            <Pressable
              style={[s.btnConvert, saving && s.btnDisabled]}
              onPress={handleConvert}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <><Icon name="shopping-bag" size={16} color="#fff" /><Text style={s.btnPrimaryTxt}>Converter em Pedido</Text></>}
            </Pressable>
          )}
        </View>
      </ScrollView>

      <AddItemModal
        visible={addModal}
        companyId={companyId || ""}
        onClose={() => setAddModal(false)}
        onAdd={(item) => setItems((prev) => [...prev, item])}
      />
    </View>
  );
}

const NAVY = "#1E3A8A";
const MAGENTA = "#EC4899";

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F8FAFC" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "800", color: "#0F172A" },

  form: { padding: 16, gap: 14, paddingBottom: 60 },

  errorBanner: {
    backgroundColor: "#FEE2E2", borderRadius: 10, padding: 12,
  },
  errorTxt: { color: "#991B1B", fontSize: 13.5, fontWeight: "600" },

  section: { backgroundColor: "#fff", borderRadius: 14, padding: 16, gap: 10, borderWidth: 1, borderColor: "#E2E8F0" },
  sectionLabel: {
    fontSize: 10, color: "#64748B", fontWeight: "800",
    letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4,
  },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  addItemBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, backgroundColor: "#EFF6FF",
    borderWidth: 1, borderColor: "#BFDBFE",
  },
  addItemTxt: { fontSize: 12.5, fontWeight: "700", color: NAVY },

  input: {
    backgroundColor: "#F8FAFC", borderWidth: 1.5, borderColor: "#CBD5E1",
    borderRadius: 10, padding: 12, fontSize: 14, color: "#0F172A",
  },
  inputLabel: { fontSize: 12, color: "#64748B", fontWeight: "600", marginBottom: 2 },
  row2: { flexDirection: "row", gap: 10 },

  emptyItems: { alignItems: "center", paddingVertical: 20 },
  emptyItemsTxt: { color: "#94A3B8", fontSize: 13 },

  itemRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F1F5F9",
  },
  itemName: { fontSize: 14, fontWeight: "600", color: "#0F172A" },
  itemDetail: { fontSize: 12, color: "#64748B", marginTop: 2 },
  itemTotal: { fontSize: 14, fontWeight: "700", color: NAVY },
  removeBtn: { padding: 6 },

  totalsCard: {
    backgroundColor: "#fff", borderRadius: 14, padding: 16,
    gap: 10, borderWidth: 1, borderColor: "#E2E8F0",
  },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalRowFinal: { paddingTop: 10, borderTopWidth: 1, borderTopColor: "#F1F5F9", marginTop: 4 },
  totalLabel: { fontSize: 13.5, color: "#64748B" },
  totalVal: { fontSize: 13.5, color: "#0F172A", fontWeight: "600" },
  totalLabelFinal: { fontSize: 15, fontWeight: "800", color: "#0F172A" },
  totalValFinal: { fontSize: 18, fontWeight: "800", color: NAVY },
  discountInput: {
    backgroundColor: "#F8FAFC", borderWidth: 1.5, borderColor: "#CBD5E1",
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
    fontSize: 14, color: "#0F172A", textAlign: "right", minWidth: 80,
  },

  actionsSection: { gap: 10, paddingBottom: 20 },
  btnPrimary: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: NAVY, paddingVertical: 16, borderRadius: 14,
  },
  btnSend: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#0EA5E9", paddingVertical: 16, borderRadius: 14,
  },
  btnConvert: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#10B981", paddingVertical: 16, borderRadius: 14,
  },
  btnPrimaryTxt: { color: "#fff", fontSize: 15, fontWeight: "800" },
  btnDisabled: { opacity: 0.5 },

  // Sent state
  sentContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  sentCard: {
    backgroundColor: "#fff", borderRadius: 18, padding: 28, alignItems: "center",
    maxWidth: 440, width: "100%", gap: 12, borderWidth: 1, borderColor: "#D1FAE5",
  },
  sentTitle: { fontSize: 22, fontWeight: "800", color: "#0F172A" },
  sentUrl: {
    fontSize: 13, color: "#475569", textAlign: "center",
    backgroundColor: "#F1F5F9", borderRadius: 8, padding: 10, width: "100%",
  },
  copyBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: NAVY, paddingVertical: 12, paddingHorizontal: 24,
    borderRadius: 12, width: "100%", justifyContent: "center",
  },
  copyBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 14 },
  backLink: { marginTop: 8 },
  backLinkTxt: { fontSize: 13, color: "#64748B", textDecorationLine: "underline" },
});
