// ============================================================
// AURA STUDIO · CollectCustomizationModal
//
// Sub-onda Marketplaces S-2 (25/05/2026)
//
// Modal pra coletar personalizacao de pedido vindo de marketplace
// (ML/Shopee). Quando o cliente compra no marketplace, o pedido
// cai em marketplace_orders.vertical='studio' sem customization_data.
// Lojista abre esse modal a partir do KDS ou Hub Studio, preenche
// os fields da personalizacao (mesmo padrao do PDV/storefront),
// salva via PATCH /studio/marketplace-orders/:oid/customization,
// e o pedido avanca pra pending_art no KDS.
//
// Mostra info do pedido (cliente, plataforma, items), customization
// config do produto (carrega via studioApi.getCustomizationConfig),
// FieldEditor pra cada field, PersonalizationPreview SVG ao vivo.
//
// Se o pedido tem multiplos items, mostra abas — 1 aba por item.
// customization_data final fica { [product_id]: { [field_id]: value } }.
// ============================================================
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, TextInput,
  Platform,
} from "react-native";
import { Icon } from "@/components/Icon";
import { StudioColors } from "@/constants/studio-tokens";
import {
  studioApi,
  type MarketplaceOrderStudio,
  type CustomizationConfig,
  type CustomizationField,
} from "@/services/studioApi";
import { PersonalizationPreview } from "@/components/studio/PersonalizationPreview";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";

type Props = {
  order: MarketplaceOrderStudio;
  onClose: () => void;
  onSaved?: () => void;
};

type ProductConfigCache = {
  [productId: string]: {
    name: string;
    config: CustomizationConfig | null;
    is_personalizable: boolean;
  };
};

const PLATFORM_LABEL: Record<string, string> = {
  mercado_livre: "Mercado Livre",
  shopee: "Shopee",
};

export function CollectCustomizationModal({ order, onClose, onSaved }: Props) {
  const { company } = useAuthStore();
  const cid = company?.id;

  // Items do pedido — pode ter múltiplos product_id
  const items = useMemo(() => {
    return (order.items || []).filter((it) => !!it.product_id);
  }, [order.items]);

  const [activeIdx, setActiveIdx] = useState(0);
  const activeItem = items[activeIdx];

  // Cache de configs por product_id
  const [configCache, setConfigCache] = useState<ProductConfigCache>({});
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [valuesByProduct, setValuesByProduct] = useState<Record<string, Record<string, any>>>({});

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carrega customization_config do produto ativo
  useEffect(() => {
    if (!cid || !activeItem?.product_id || configCache[activeItem.product_id]) return;
    setLoadingConfig(true);
    studioApi.getCustomizationConfig(cid, activeItem.product_id)
      .then((res) => {
        setConfigCache((prev) => ({
          ...prev,
          [activeItem.product_id!]: {
            name: res.name,
            config: res.config,
            is_personalizable: res.is_personalizable,
          },
        }));
        // Inicializa values com defaults (primeira cor da paleta, se houver)
        if (res.config?.fields && !valuesByProduct[activeItem.product_id!]) {
          const init: Record<string, any> = {};
          for (const f of res.config.fields) {
            if (f.type === "color" && f.config.colors?.length) {
              init[f.id] = f.config.colors[0];
            }
          }
          setValuesByProduct((prev) => ({ ...prev, [activeItem.product_id!]: init }));
        }
      })
      .catch((e) => setError(e?.message || "Erro ao carregar customization_config"))
      .finally(() => setLoadingConfig(false));
  }, [cid, activeItem?.product_id, configCache, valuesByProduct]);

  const activeConfig = activeItem?.product_id ? configCache[activeItem.product_id] : null;
  const activeValues = activeItem?.product_id
    ? (valuesByProduct[activeItem.product_id] || {})
    : {};

  function setFieldValue(productId: string, fieldId: string, value: any) {
    setValuesByProduct((prev) => ({
      ...prev,
      [productId]: { ...(prev[productId] || {}), [fieldId]: value },
    }));
  }

  async function save() {
    if (!cid) return;
    setError(null);

    // Valida required fields em todos os items
    for (const it of items) {
      if (!it.product_id) continue;
      const cfg = configCache[it.product_id]?.config;
      const vals = valuesByProduct[it.product_id] || {};
      if (cfg?.fields) {
        for (const f of cfg.fields) {
          if (f.required) {
            const v = vals[f.id];
            if (v == null || (typeof v === "string" && !v.trim())) {
              setError(`Preencha "${f.label}" do produto "${configCache[it.product_id!]?.name || "—"}"`);
              return;
            }
          }
        }
      }
    }

    setSaving(true);
    try {
      // customization_data final: { [product_id]: { [field_id]: value } }
      const customization = valuesByProduct;
      await studioApi.collectMarketplaceCustomization(cid, order.id, customization);
      toast.success("✨ Personalização salva. Pedido avançou pra produção.");
      onSaved?.();
      onClose();
    } catch (e: any) {
      setError(e?.message || "Erro ao salvar personalização");
    } finally {
      setSaving(false);
    }
  }

  const platformLabel = PLATFORM_LABEL[order.platform] || order.platform;
  const hasMultipleItems = items.length > 1;

  return (
    <View style={s.modalRoot}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={onClose} style={s.closeBtn}>
          <Icon name="x" size={18} color={StudioColors.ink2} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>COLETAR PERSONALIZAÇÃO · {platformLabel}</Text>
          <Text style={s.title}>Pedido #{order.external_id || order.id.slice(0, 8)}</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Resumo do pedido */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>RESUMO DO PEDIDO</Text>
          <View style={s.summaryGrid}>
            <View style={s.summaryCell}>
              <Text style={s.summaryLabel}>Cliente</Text>
              <Text style={s.summaryValue}>{order.customer_name || "—"}</Text>
              {order.customer_doc && (
                <Text style={s.summarySub}>{order.customer_doc}</Text>
              )}
            </View>
            <View style={s.summaryCell}>
              <Text style={s.summaryLabel}>Valor</Text>
              <Text style={s.summaryValue}>R$ {Number(order.total).toFixed(2)}</Text>
              <Text style={s.summarySub}>{items.length} item{items.length === 1 ? "" : "s"}</Text>
            </View>
            <View style={s.summaryCell}>
              <Text style={s.summaryLabel}>Status</Text>
              <Text style={s.summaryValue}>{order.status}</Text>
            </View>
          </View>
        </View>

        {/* Tabs por item (se múltiplos) */}
        {hasMultipleItems && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingVertical: 8 }}>
            {items.map((it, idx) => (
              <Pressable
                key={idx}
                onPress={() => setActiveIdx(idx)}
                style={[s.itemTab, activeIdx === idx && s.itemTabActive]}
              >
                <Text style={[s.itemTabTxt, activeIdx === idx && s.itemTabTxtActive]}>
                  {idx + 1}. {(it.product_name || it.product_id || "Item").slice(0, 30)}
                </Text>
                <Text style={[s.itemTabQty, activeIdx === idx && s.itemTabTxtActive]}>
                  Qtd {it.quantity}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Configurador do item ativo */}
        <View style={s.section}>
          {!activeItem ? (
            <Text style={s.empty}>Pedido sem items personalizáveis.</Text>
          ) : loadingConfig ? (
            <ActivityIndicator color={StudioColors.primary} />
          ) : !activeConfig ? null : !activeConfig.is_personalizable || !activeConfig.config ? (
            <View style={s.warningBox}>
              <Icon name="alert-circle" size={16} color="#92400E" />
              <Text style={s.warningTxt}>
                Produto "{activeConfig.name}" não tem customization_config configurado. Pule este item.
              </Text>
            </View>
          ) : (
            <>
              <Text style={s.sectionLabel}>
                PERSONALIZAÇÃO · {activeConfig.name}
              </Text>

              {/* Preview live */}
              <View style={{ alignItems: "center", marginVertical: 12 }}>
                <PersonalizationPreview
                  config={activeConfig.config}
                  values={activeValues}
                  size={240}
                  productName={activeConfig.name}
                  showLabel={false}
                />
              </View>

              {/* Fields */}
              <View style={{ gap: 12 }}>
                {activeConfig.config.fields.map((f) => (
                  <CollectFieldEditor
                    key={f.id}
                    field={f}
                    value={activeValues[f.id]}
                    onChange={(v) => setFieldValue(activeItem.product_id!, f.id, v)}
                  />
                ))}
              </View>
            </>
          )}
        </View>

        {error && (
          <View style={{ marginHorizontal: 20 }}>
            <View style={s.errorBox}>
              <Icon name="alert-circle" size={14} color="#991B1B" />
              <Text style={s.errorTxt}>{error}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Footer save */}
      <View style={s.footer}>
        <Pressable onPress={onClose} style={s.cancelBtn}>
          <Text style={s.cancelTxt}>Fechar</Text>
        </Pressable>
        <Pressable
          onPress={save}
          disabled={saving || items.length === 0}
          style={[s.saveBtn, (saving || items.length === 0) && { opacity: 0.4 }]}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Icon name="check" size={14} color="#fff" />
              <Text style={s.saveTxt}>Salvar e avançar pra produção</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

// ============================================================
// Field editor (versão simplificada — sem templates por enquanto;
// em S-2 o lojista preenche o que o cliente forneceu por outro canal)
// ============================================================
function CollectFieldEditor({
  field, value, onChange,
}: {
  field: CustomizationField;
  value: any;
  onChange: (v: any) => void;
}) {
  if (field.type === "text") {
    const maxChars = field.config.max_chars || 30;
    return (
      <View>
        <Text style={s.fieldLabel}>
          {field.label} {field.required && <Text style={{ color: "#EF4444" }}>*</Text>}
        </Text>
        <TextInput
          value={String(value || "")}
          onChangeText={(t) => onChange(t.slice(0, maxChars))}
          placeholder={`O que o cliente pediu? (max ${maxChars} chars)`}
          placeholderTextColor={StudioColors.ink4}
          maxLength={maxChars}
          style={s.input}
        />
        <Text style={s.charCount}>{String(value || "").length}/{maxChars}</Text>
      </View>
    );
  }

  if (field.type === "color") {
    const colors = field.config.colors || ["#FFFFFF", "#000000"];
    return (
      <View>
        <Text style={s.fieldLabel}>
          {field.label} {field.required && <Text style={{ color: "#EF4444" }}>*</Text>}
        </Text>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {colors.map((c) => (
            <Pressable
              key={c}
              onPress={() => onChange(c)}
              style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: c,
                borderWidth: value === c ? 3 : 1,
                borderColor: value === c ? StudioColors.primary : StudioColors.ink5,
              }}
            />
          ))}
        </View>
      </View>
    );
  }

  if (field.type === "option") {
    const choices = field.config.choices || [];
    return (
      <View>
        <Text style={s.fieldLabel}>
          {field.label} {field.required && <Text style={{ color: "#EF4444" }}>*</Text>}
        </Text>
        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
          {choices.map((c) => (
            <Pressable
              key={c.value}
              onPress={() => onChange(c.value)}
              style={[
                s.chip,
                value === c.value && { backgroundColor: StudioColors.primary, borderColor: StudioColors.primary },
              ]}
            >
              <Text style={[s.chipTxt, value === c.value && { color: "#fff" }]}>{c.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  if (field.type === "image" || field.type === "template") {
    return (
      <View>
        <Text style={s.fieldLabel}>
          {field.label} {field.required && <Text style={{ color: "#EF4444" }}>*</Text>}
        </Text>
        <Text style={s.fieldHelp}>
          Cole o link da imagem que o cliente enviou (WhatsApp, e-mail, etc).
        </Text>
        <TextInput
          value={String(value || "")}
          onChangeText={onChange}
          placeholder="https://..."
          placeholderTextColor={StudioColors.ink4}
          style={s.input}
        />
      </View>
    );
  }

  return null;
}

const s = StyleSheet.create({
  modalRoot: { flex: 1, backgroundColor: StudioColors.bg },

  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: StudioColors.ink5,
    backgroundColor: "#fff",
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
    backgroundColor: StudioColors.bgSoft,
  },
  eyebrow: { fontSize: 10.5, color: StudioColors.accent, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" },
  title: { fontSize: 18, fontWeight: "800", color: StudioColors.ink, marginTop: 2, letterSpacing: -0.3 },

  section: {
    marginHorizontal: 20, marginTop: 12,
    padding: 16, gap: 8,
    backgroundColor: StudioColors.paperCard, borderRadius: 14,
    borderWidth: 1, borderColor: StudioColors.ink5,
  },
  sectionLabel: { fontSize: 10.5, color: StudioColors.ink3, fontWeight: "800", letterSpacing: 0.5 },

  summaryGrid: { flexDirection: "row", gap: 12, flexWrap: "wrap", marginTop: 6 },
  summaryCell: { flex: 1, minWidth: 120 },
  summaryLabel: { fontSize: 10.5, color: StudioColors.ink4, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  summaryValue: { fontSize: 14, color: StudioColors.ink, fontWeight: "800", marginTop: 2 },
  summarySub: { fontSize: 11, color: StudioColors.ink3, marginTop: 1 },

  itemTab: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    backgroundColor: "#fff", borderWidth: 1.5, borderColor: StudioColors.ink5,
    minWidth: 120,
  },
  itemTabActive: { backgroundColor: StudioColors.primarySoft, borderColor: StudioColors.primary },
  itemTabTxt: { fontSize: 12, fontWeight: "700", color: StudioColors.ink2 },
  itemTabTxtActive: { color: StudioColors.primary },
  itemTabQty: { fontSize: 10.5, color: StudioColors.ink3, marginTop: 2 },

  empty: { fontSize: 12, color: StudioColors.ink3, fontStyle: "italic", textAlign: "center", padding: 20 },

  warningBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#FEF3C7", padding: 12, borderRadius: 10,
  },
  warningTxt: { color: "#92400E", fontSize: 12, fontWeight: "600", flex: 1 },

  fieldLabel: { fontSize: 12, color: StudioColors.ink2, fontWeight: "700", marginBottom: 6 },
  fieldHelp: { fontSize: 11.5, color: StudioColors.ink3, marginBottom: 6, fontStyle: "italic" },
  input: {
    backgroundColor: "#fff", color: StudioColors.ink, padding: 12,
    borderRadius: 10, fontSize: 14,
    borderWidth: 1.5, borderColor: StudioColors.ink5,
  },
  charCount: { fontSize: 10.5, color: StudioColors.ink4, marginTop: 4 },

  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    backgroundColor: "#fff", borderWidth: 1.5, borderColor: StudioColors.ink5,
  },
  chipTxt: { fontSize: 12, color: StudioColors.ink2, fontWeight: "700" },

  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#FEE2E2", padding: 12, borderRadius: 10,
    marginTop: 12,
  },
  errorTxt: { color: "#991B1B", fontSize: 12, fontWeight: "600", flex: 1 },

  footer: {
    flexDirection: "row", gap: 10, padding: 16,
    borderTopWidth: 1, borderTopColor: StudioColors.ink5,
    backgroundColor: "#fff",
  },
  cancelBtn: {
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1.5, borderColor: StudioColors.ink5,
  },
  cancelTxt: { fontSize: 13, color: StudioColors.ink2, fontWeight: "700" },
  saveBtn: {
    flex: 1, flexDirection: "row", gap: 8,
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: 10,
    backgroundColor: StudioColors.primary,
    alignItems: "center", justifyContent: "center",
  },
  saveTxt: { fontSize: 13, color: "#fff", fontWeight: "800" },
});

export default CollectCustomizationModal;
