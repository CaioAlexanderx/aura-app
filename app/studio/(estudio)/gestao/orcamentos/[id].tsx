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
//   - "Adicionar item" → modal busca produto ou item avulso
//     Integração A→B: ao selecionar produto chama calculateQuoteLine
//     (motor de precificação, Fase B). Fallback ao preço cadastrado.
//   - "Enviar" → studioApi.sendQuote → exibe link + wa.me
//   - "Converter em Pedido" (só accepted) → studioApi.convertQuote
//
// 19/08/2026 (QA UX pass):
//   - Busca de produto usava fetch relativo sem auth (falhava sempre no
//     nativo, sem auth na web) e engolia o erro em "Nenhum produto
//     encontrado". Agora usa `request` de services/api (injeta token) e
//     mostra toast no catch.
//   - Alert.alert é no-op no react-native-web — validação de item avulso
//     e confirmação de conversão em pedido nunca apareciam. Trocados por
//     notify()/toast + banner inline com CTA "Ver pedido".
//   - handleSend agora aguarda persist() antes de enviar, senão o link
//     ia pro cliente com valores desatualizados.
//   - Modal de item unificado (1 busca só, item avulso oferecido inline).
//   - Thumbnails de produto na busca e na lista de itens.
//   - Migrado para useStudioTokens + StudioScreen/StudioBreadcrumb/
//     StudioLoading/StudioEmpty — antes era 100% hardcoded (ficava branco
//     no dark mode).
// ============================================================
import { useEffect, useState, useMemo } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  TextInput, ActivityIndicator, Modal, Linking, Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { useAuth } from "@/hooks/useAuth";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import type { StudioPalette } from "@/constants/studio-tokens";
import { request } from "@/services/api";
import { toast } from "@/components/Toast";
import { notify } from "@/utils/webAlert";
import { StudioScreen } from "@/components/studio/StudioScreen";
import { StudioBreadcrumb } from "@/components/studio/StudioBreadcrumb";
import { StudioLoading } from "@/components/studio/StudioLoading";
import { StudioEmpty } from "@/components/studio/StudioEmpty";
import {
  studioApi,
  type StudioQuote,
  type StudioQuoteItem,
  type StudioQuoteStatus,
  type StudioQuoteCreated,
  type PricingBreakdown,
} from "@/services/studioApi";

// Item de linha local: estende StudioQuoteItem com image_url — cosmético
// só neste editor (thumbnail), não faz parte do tipo compartilhado nem
// é persistido no backend.
type LineItem = Omit<StudioQuoteItem, "id"> & { image_url?: string | null };

// Resultado de busca de produto (subset do catálogo, endpoint /products?q=).
type ProductSearchResult = {
  id: string;
  name: string;
  price: number | string;
  cost_price?: number | string | null;
  image_url?: string | null;
};

// ─── Status pills ─────────────────────────────────────────────
// Cores semânticas fixas — não dependem do theme (mesmo padrão de gestao/orcamentos.tsx).
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

// ─── Thumbnail de produto ───────────────────────────────────
function ProductThumb({ uri, t, size = 36 }: { uri?: string | null; t: StudioPalette; size?: number }) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: 8, backgroundColor: t.bgSoft }}
      />
    );
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: 8,
      backgroundColor: t.primarySoft, alignItems: "center", justifyContent: "center",
    }}>
      <Icon name="package" size={Math.round(size * 0.5)} color={t.primary} />
    </View>
  );
}

// ─── Modal de adicionar item ──────────────────────────────────
// QA: era 2 abas ("Buscar produto" / "Item livre") obrigando decidir antes
// de digitar. Unificado — 1 campo de busca só; sem resultado, a própria
// lista oferece "Adicionar '<texto>' como item avulso". Item avulso também
// fica disponível via link discreto pra quem já sabe o preço de cabeça.
type ItemModalProps = {
  visible: boolean;
  companyId: string;
  t: StudioPalette;
  onClose: () => void;
  onAdd: (item: LineItem) => void;
};
function AddItemModal({ visible, companyId, t, onClose, onAdd }: ItemModalProps) {
  const s = useMemo(() => buildModalStyles(t), [t]);
  const [query, setQuery]       = useState("");
  const [results, setResults]   = useState<ProductSearchResult[]>([]);
  const [searching, setSearch]  = useState(false);
  const [pricing, setPricing]   = useState(false); // A→B: calculando preço
  const [freeOpen, setFreeOpen] = useState(false);
  const [desc, setDesc]         = useState("");
  const [qty, setQty]           = useState("1");
  const [price, setPrice]       = useState("");

  useEffect(() => {
    if (!visible) {
      setQuery(""); setResults([]); setDesc(""); setQty("1"); setPrice("");
      setFreeOpen(false); setPricing(false);
    }
  }, [visible]);

  async function doSearch(q: string) {
    if (!q.trim() || !companyId) return;
    setSearch(true);
    try {
      // QA item 1: era fetch("/api/v1/...") — URL relativa sem token. No app
      // nativo não há origin (falha sempre); na web bate no próprio domínio
      // sem Authorization. `request` injeta token + BASE_URL corretos.
      const { products } = await request<{ products: ProductSearchResult[] }>(
        `/companies/${companyId}/products?q=${encodeURIComponent(q)}&limit=20`,
        { method: "GET" }
      );
      setResults(products || []);
    } catch (e: any) {
      setResults([]);
      toast.error(`[${e?.status ?? "?"}] ${e?.data?.error || e?.message || "Erro ao buscar produtos"}`);
    } finally {
      setSearch(false);
    }
  }

  // Integração A→B: ao selecionar produto, pede preço ao motor de precificação (Fase B).
  // Fallback gracioso: se motor retornar 501 (stub) ou não tiver regra, usa preço cadastrado.
  async function selectProduct(p: ProductSearchResult) {
    setPricing(true);
    let suggestedPrice = parseFloat(String(p.price)) || 0;
    let pricingMeta: PricingBreakdown["breakdown"] | null = null;
    let unitCost: number | null = p.cost_price ? parseFloat(String(p.cost_price)) : null;

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
      image_url:    p.image_url ?? null,
    });
    setPricing(false);
    onClose();
  }

  function addFree() {
    if (!desc.trim()) {
      // QA item 2: Alert.alert é no-op na web — essa validação nunca aparecia.
      notify("Descrição obrigatória", "Informe o que está sendo cobrado nesse item.");
      return;
    }
    const q = Math.max(0.01, parseFloat(qty.replace(",", ".")) || 1);
    const p = Math.max(0, parseFloat(price.replace(",", ".")) || 0);
    onAdd({ product_id: null, description: desc.trim(), quantity: q, unit_price: p });
    onClose();
  }

  function offerFreeFromQuery() {
    setDesc(query.trim());
    setFreeOpen(true);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.bg}>
        <View style={s.card}>
          <View style={s.topRow}>
            <Text style={s.title}>Adicionar item</Text>
            <Pressable onPress={onClose}><Icon name="x" size={20} color={t.ink3} /></Pressable>
          </View>

          <View style={s.searchRow}>
            <Icon name="search" size={16} color={t.ink4} />
            <TextInput
              style={s.searchInput}
              placeholder="Nome do produto..."
              placeholderTextColor={t.ink4}
              value={query}
              onChangeText={(v) => { setQuery(v); if (v.length >= 2) doSearch(v); else setResults([]); }}
              autoFocus
            />
            {(searching || pricing) && <ActivityIndicator size="small" color={t.primary} />}
          </View>
          {pricing && (
            <Text style={s.pricingHint}>Consultando motor de precificação...</Text>
          )}

          <ScrollView style={{ maxHeight: 260 }} keyboardShouldPersistTaps="handled">
            {results.map((p) => (
              <Pressable key={p.id} style={s.resultRow} onPress={() => selectProduct(p)} disabled={pricing}>
                <ProductThumb uri={p.image_url} t={t} />
                <Text style={s.resultName} numberOfLines={1}>{p.name}</Text>
                <Text style={s.resultPrice}>R$ {parseFloat(String(p.price || 0)).toFixed(2)}</Text>
              </Pressable>
            ))}
            {!searching && query.length >= 2 && results.length === 0 && (
              <Pressable style={s.offerFreeRow} onPress={offerFreeFromQuery}>
                <Icon name="plus" size={14} color={t.primary} />
                <Text style={s.offerFreeTxt} numberOfLines={1}>
                  Adicionar "{query.trim()}" como item avulso
                </Text>
              </Pressable>
            )}
          </ScrollView>

          {!freeOpen ? (
            <Pressable style={s.freeToggle} onPress={() => setFreeOpen(true)}>
              <Text style={s.freeToggleTxt}>+ Item avulso (sem produto cadastrado)</Text>
            </Pressable>
          ) : (
            <View style={s.freeBox}>
              <TextInput
                style={s.input}
                placeholder="Descrição do item *"
                placeholderTextColor={t.ink4}
                value={desc}
                onChangeText={setDesc}
              />
              <View style={s.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Qtd</Text>
                  <TextInput style={s.input} value={qty} onChangeText={setQty} keyboardType="decimal-pad" />
                </View>
                <View style={{ flex: 2 }}>
                  <Text style={s.label}>Preço unit. (R$)</Text>
                  <TextInput
                    style={s.input}
                    value={price}
                    onChangeText={setPrice}
                    keyboardType="decimal-pad"
                    placeholder="0,00"
                    placeholderTextColor={t.ink4}
                  />
                </View>
              </View>
              <Pressable style={s.addBtn} onPress={addFree}>
                <Text style={s.addBtnTxt}>Adicionar item avulso</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function buildModalStyles(t: StudioPalette) {
  return StyleSheet.create({
    bg: { flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "flex-end" },
    card: { backgroundColor: t.paperCardElev, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "85%" },
    topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
    title: { fontSize: 17, fontWeight: "800", color: t.ink },
    searchRow: {
      flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: t.bgSoft, borderWidth: 1.5, borderColor: t.ink5,
      borderRadius: 10, paddingHorizontal: 12,
    },
    searchInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: t.ink },
    pricingHint: { fontSize: 12, color: t.primary, fontStyle: "italic", textAlign: "center", marginTop: 8 },
    resultRow: {
      flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10,
      borderBottomWidth: 1, borderBottomColor: t.ink5,
    },
    resultName: { fontSize: 14, color: t.ink, flex: 1 },
    resultPrice: { fontSize: 14, fontWeight: "700", color: t.primary },
    offerFreeRow: {
      flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 14,
      justifyContent: "center",
    },
    offerFreeTxt: { fontSize: 13, color: t.primary, fontWeight: "700", flexShrink: 1 },
    freeToggle: { paddingVertical: 12, alignItems: "center" },
    freeToggleTxt: { fontSize: 12.5, color: t.ink3, fontWeight: "600" },
    freeBox: { gap: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: t.ink5, marginTop: 4 },
    input: {
      backgroundColor: t.bgSoft, borderWidth: 1.5, borderColor: t.ink5,
      borderRadius: 10, padding: 12, fontSize: 14, color: t.ink,
    },
    row2: { flexDirection: "row", gap: 10 },
    label: { fontSize: 12, color: t.ink3, fontWeight: "600", marginBottom: 4 },
    addBtn: { backgroundColor: t.primary, paddingVertical: 14, borderRadius: 12, alignItems: "center", marginTop: 4 },
    addBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 14 },
  });
}

// ─── Componente principal ────────────────────────────────────
export default function OrcamentoEditorScreen() {
  const { id }      = useLocalSearchParams<{ id: string }>();
  const router      = useRouter();
  const { companyId } = useAuth();
  const t = useStudioTokens();
  const s = useMemo(() => buildStyles(t), [t]);
  const isNew = id === "novo";

  const crumbs = [
    { label: "Estúdio", href: "/studio" },
    { label: "Orçamentos", href: "/studio/gestao/orcamentos" },
  ];

  // Form fields
  const [customerName,  setCustomerName]  = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [validityDays,  setValidityDays]  = useState("7");
  const [depositPct,    setDepositPct]    = useState("");
  const [discount,      setDiscount]      = useState("0");
  const [notes,         setNotes]         = useState("");
  const [items,         setItems]         = useState<LineItem[]>([]);

  // State
  const [quote,    setQuote]   = useState<StudioQuote | null>(null);
  const [loading,  setLoading] = useState(!isNew);
  const [saving,   setSaving]  = useState(false);
  const [error,    setError]   = useState<string | null>(null);
  const [addModal, setAddModal] = useState(false);
  const [sentData, setSentData] = useState<StudioQuoteCreated | null>(null);

  // Carrega orçamento existente
  useEffect(() => {
    if (isNew) { setLoading(false); return; }
    // QA item 12: early return sem setLoading(false) podia deixar o spinner
    // travado se companyId nunca chegasse a resolver. companyId nas deps
    // garante que, assim que a auth popular, o effect roda de novo.
    if (!companyId) { setLoading(false); return; }
    setLoading(true);
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
      .catch((e: any) => {
        const msg = `[${e?.status ?? "?"}] ${e?.data?.error || e?.message || "Erro ao carregar orçamento"}`;
        setError(msg);
        toast.error(msg);
      })
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
  async function persist(): Promise<StudioQuote | null> {
    if (!companyId) return null;
    setSaving(true);
    setError(null);
    try {
      const body = {
        customer_name:  customerName.trim() || undefined,
        customer_phone: customerPhone.trim() || undefined,
        items: items.map((it, i) => ({
          product_id:   it.product_id,
          description:  it.description,
          quantity:     it.quantity,
          unit_price:   it.unit_price,
          unit_cost:    it.unit_cost,
          pricing_meta: it.pricing_meta,
          customization: it.customization,
          sort_order:   i,
        })),
        discount: disc,
        validity_days: Math.max(1, parseInt(validityDays) || 7),
        deposit_pct: depPct > 0 ? depPct : null,
        deposit_amount: depPct > 0 ? parseFloat(depAmt.toFixed(2)) : null,
        notes: notes.trim() || undefined,
      };

      if (isNew) {
        const q = await studioApi.createQuote(companyId, { ...body, items: body.items as any });
        setQuote(q);
        toast.success("Orçamento criado");
        // P2: rota canônica sob gestao/orcamentos/
        router.replace(`/studio/gestao/orcamentos/${q.id}` as any);
        return q;
      } else {
        const q = await studioApi.updateQuote(companyId, id!, body as any);
        setQuote(q);
        // QA item 13: antes save() não dava nenhum feedback ao editar.
        toast.success("Alterações salvas");
        return q;
      }
    } catch (e: any) {
      const msg = `[${e?.status ?? "?"}] ${e?.data?.error || e?.message || "Erro ao salvar"}`;
      setError(msg);
      toast.error(msg);
      return null;
    } finally {
      setSaving(false);
    }
  }

  // ─── Enviar ─────────────────────────────────────────────────
  async function handleSend() {
    if (!companyId || !quote) return;
    // QA item 3: enviar sem salvar antes mandava valores desatualizados
    // pro cliente (desconto/itens/validade alterados e não persistidos).
    const saved = await persist();
    if (!saved) return; // erro já mostrado por persist()
    setSaving(true);
    setError(null);
    try {
      const data = await studioApi.sendQuote(companyId, saved.id);
      setQuote(data);
      setSentData(data);
    } catch (e: any) {
      const msg = `[${e?.status ?? "?"}] ${e?.data?.error || e?.message || "Erro ao enviar orçamento"}`;
      setError(msg);
      toast.error(msg);
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
      // QA item 2: Alert.alert com botão "Ver pedido" é no-op na web — o
      // botão nunca aparecia. Toast de sucesso + banner inline com CTA
      // clicável (quote.order_id já vem setado por data.quote).
      toast.success("Pedido criado! Orçamento convertido em pedido Studio.");
    } catch (e: any) {
      const msg = `[${e?.status ?? "?"}] ${e?.data?.error || e?.message || "Erro ao converter orçamento"}`;
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  // ─── Render ──────────────────────────────────────────────────
  if (loading) {
    return (
      <StudioScreen variant="reading" scroll={false}>
        <StudioBreadcrumb items={[...crumbs, { label: "Carregando..." }]} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <StudioLoading variant="spinner" label="Carregando orçamento..." />
        </View>
      </StudioScreen>
    );
  }

  // Pós-envio: exibe link
  if (sentData) {
    return (
      <StudioScreen variant="reading" scroll={false}>
        <StudioBreadcrumb items={[...crumbs, { label: "Orçamento enviado" }]} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <View style={s.sentCard}>
            <Icon name="check-circle" size={48} color={t.success} />
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
        </View>
      </StudioScreen>
    );
  }

  return (
    <StudioScreen variant="reading">
      <StudioBreadcrumb items={[...crumbs, { label: isNew ? "Novo orçamento" : (customerName || "Orçamento") }]} />

      <View style={s.container}>
        {/* Header */}
        <View style={s.headRow}>
          <Text style={s.h1} numberOfLines={1}>
            {isNew ? "Novo orçamento" : (customerName || "Orçamento")}
          </Text>
          {quote && <StatusPill status={quote.status} />}
        </View>

        {error ? (
          <View style={s.errorBanner}>
            <Icon name="alert-circle" size={16} color={t.dangerInk} />
            <Text style={s.errorTxt}>{error}</Text>
          </View>
        ) : null}

        {quote?.status === "converted" && quote.order_id ? (
          <View style={s.convertedBanner}>
            <Icon name="check-circle" size={18} color={t.successInk} />
            <Text style={s.convertedTxt}>Este orçamento virou pedido.</Text>
            <Pressable
              style={s.convertedBtn}
              onPress={() => router.push(`/studio/pedidos/${quote.order_id}` as any)}
            >
              <Text style={s.convertedBtnTxt}>Ver pedido</Text>
              <Icon name="arrow-right" size={14} color="#fff" />
            </Pressable>
          </View>
        ) : null}

        {/* Dados do cliente */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>CLIENTE</Text>
          <TextInput
            style={s.input}
            placeholder="Nome do cliente"
            placeholderTextColor={t.ink4}
            value={customerName}
            onChangeText={setCustomerName}
            editable={isDraft}
          />
          <TextInput
            style={s.input}
            placeholder="Telefone / WhatsApp"
            placeholderTextColor={t.ink4}
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
                <Icon name="plus" size={14} color={t.primary} />
                <Text style={s.addItemTxt}>Adicionar item</Text>
              </Pressable>
            )}
          </View>

          {items.length === 0 ? (
            <StudioEmpty
              icon="package"
              title="Nenhum item adicionado"
              desc={isDraft ? 'Toque em "Adicionar item" para montar o orçamento.' : undefined}
              compact
            />
          ) : (
            items.map((it, i) => (
              <View key={i} style={s.itemRow}>
                <ProductThumb uri={it.image_url} t={t} size={34} />
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
                    <Icon name="trash-2" size={15} color={t.danger} />
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
                placeholderTextColor={t.ink4}
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
            placeholderTextColor={t.ink4}
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
              onPress={persist}
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
      </View>

      <AddItemModal
        visible={addModal}
        companyId={companyId || ""}
        t={t}
        onClose={() => setAddModal(false)}
        onAdd={(item) => setItems((prev) => [...prev, item])}
      />
    </StudioScreen>
  );
}

function buildStyles(t: StudioPalette) {
  return StyleSheet.create({
    container: { padding: 16, gap: 14, paddingBottom: 60 },

    headRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },
    h1: { flex: 1, fontSize: 22, fontWeight: "800", color: t.ink, letterSpacing: -0.3 },

    errorBanner: {
      flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: t.dangerSoft, borderRadius: 10, padding: 12,
    },
    errorTxt: { flex: 1, color: t.dangerInk, fontSize: 13.5, fontWeight: "600" },

    convertedBanner: {
      flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap",
      backgroundColor: t.successSoft, borderRadius: 12, padding: 14,
    },
    convertedTxt: { flex: 1, minWidth: 160, fontSize: 13.5, fontWeight: "700", color: t.successInk },
    convertedBtn: {
      flexDirection: "row", alignItems: "center", gap: 6,
      backgroundColor: t.success, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 10,
    },
    convertedBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 13 },

    section: { backgroundColor: t.paperCard, borderRadius: 14, padding: 16, gap: 10, borderWidth: 1, borderColor: t.ink5 },
    sectionLabel: {
      fontSize: 10, color: t.ink3, fontWeight: "800",
      letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4,
    },
    sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    addItemBtn: {
      flexDirection: "row", alignItems: "center", gap: 4,
      paddingHorizontal: 10, paddingVertical: 6,
      borderRadius: 8, backgroundColor: t.primarySoft,
      borderWidth: 1, borderColor: t.primarySoft,
    },
    addItemTxt: { fontSize: 12.5, fontWeight: "700", color: t.primary },

    input: {
      backgroundColor: t.bgSoft, borderWidth: 1.5, borderColor: t.ink5,
      borderRadius: 10, padding: 12, fontSize: 14, color: t.ink,
    },
    inputLabel: { fontSize: 12, color: t.ink3, fontWeight: "600", marginBottom: 2 },
    row2: { flexDirection: "row", gap: 10 },

    itemRow: {
      flexDirection: "row", alignItems: "center", gap: 10,
      paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.ink5,
    },
    itemName: { fontSize: 14, fontWeight: "600", color: t.ink },
    itemDetail: { fontSize: 12, color: t.ink3, marginTop: 2 },
    itemTotal: { fontSize: 14, fontWeight: "700", color: t.primary },
    removeBtn: { padding: 6 },

    totalsCard: {
      backgroundColor: t.paperCard, borderRadius: 14, padding: 16,
      gap: 10, borderWidth: 1, borderColor: t.ink5,
    },
    totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    totalRowFinal: { paddingTop: 10, borderTopWidth: 1, borderTopColor: t.ink5, marginTop: 4 },
    totalLabel: { fontSize: 13.5, color: t.ink3 },
    totalVal: { fontSize: 13.5, color: t.ink, fontWeight: "600" },
    totalLabelFinal: { fontSize: 15, fontWeight: "800", color: t.ink },
    totalValFinal: { fontSize: 18, fontWeight: "800", color: t.primary },
    discountInput: {
      backgroundColor: t.bgSoft, borderWidth: 1.5, borderColor: t.ink5,
      borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
      fontSize: 14, color: t.ink, textAlign: "right", minWidth: 80,
    },

    actionsSection: { gap: 10, paddingBottom: 20 },
    btnPrimary: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      backgroundColor: t.primary, paddingVertical: 16, borderRadius: 14,
    },
    btnSend: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      backgroundColor: t.info, paddingVertical: 16, borderRadius: 14,
    },
    btnConvert: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      backgroundColor: t.success, paddingVertical: 16, borderRadius: 14,
    },
    btnPrimaryTxt: { color: "#fff", fontSize: 15, fontWeight: "800" },
    btnDisabled: { opacity: 0.5 },

    // Sent state
    sentCard: {
      backgroundColor: t.paperCardElev, borderRadius: 18, padding: 28, alignItems: "center",
      maxWidth: 440, width: "100%", gap: 12, borderWidth: 1, borderColor: t.successSoft,
    },
    sentTitle: { fontSize: 22, fontWeight: "800", color: t.ink },
    sentUrl: {
      fontSize: 13, color: t.ink2, textAlign: "center",
      backgroundColor: t.bgSoft, borderRadius: 8, padding: 10, width: "100%",
    },
    copyBtn: {
      flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: t.primary, paddingVertical: 12, paddingHorizontal: 24,
      borderRadius: 12, width: "100%", justifyContent: "center",
    },
    copyBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 14 },
    backLink: { marginTop: 8 },
    backLinkTxt: { fontSize: 13, color: t.ink3, textDecorationLine: "underline" },
  });
}
