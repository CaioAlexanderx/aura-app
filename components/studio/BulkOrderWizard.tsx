// ============================================================
// AURA STUDIO · Wizard de pedido em massa pra evento (Fase 6)
//
// 4ª aplicação do <StudioWorkflow> canônico — 5 passos:
//   1. Evento + Produto
//   2. Lista de pessoas (CSV cola ou manual)
//   3. Preço (mostra preview escalonado em tempo real)
//   4. Prazo de entrega
//   5. Confirmar
// ============================================================
import { useEffect, useState, useMemo } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from "react-native";
import { Icon } from "@/components/Icon";
import { StudioWorkflow } from "@/components/studio/StudioWorkflow";
import { type StudioPalette } from "@/constants/studio-tokens";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { studioBulkHubApi, type BulkPricingPreview } from "@/services/studioBulkHubApi";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";

type Props = {
  onClose: () => void;
  onSaved: () => void;
  products: Array<{ id: string; name: string; price: number }>;
};

type Draft = {
  event_name: string;
  customer_name: string;
  customer_phone: string;
  product_id: string;
  product_name: string;
  unit_price: string;
  names_raw: string;       // cola direto, 1 nome por linha
  delivery_deadline: string;
  notes: string;
};

const DEFAULT_DRAFT: Draft = {
  event_name: "",
  customer_name: "",
  customer_phone: "",
  product_id: "",
  product_name: "",
  unit_price: "",
  names_raw: "",
  delivery_deadline: "",
  notes: "",
};

export function BulkOrderWizard({ onClose, onSaved, products }: Props) {
  const t = useStudioTokens();
  const s = useMemo(() => buildStyles(t), [t]);
  const { company } = useAuthStore();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Draft>(DEFAULT_DRAFT);
  const [pricing, setPricing] = useState<BulkPricingPreview | null>(null);
  const upd = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  // parser de nomes — uma linha por pessoa, vazias removidas
  const names = useMemo(() =>
    draft.names_raw.split("\n").map((n) => n.trim()).filter(Boolean)
  , [draft.names_raw]);

  // Preview de pricing chamado quando muda qty ou preço unitário
  useEffect(() => {
    if (!company?.id || !names.length || !parseFloat(draft.unit_price)) {
      setPricing(null); return;
    }
    const timer = setTimeout(() => {
      studioBulkHubApi.previewBulkPricing(company.id, names.length, parseFloat(draft.unit_price))
        .then(setPricing)
        .catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [company?.id, names.length, draft.unit_price]);

  const canAdvance =
    step === 1 ? draft.event_name.trim().length > 1 && !!draft.product_id :
    step === 2 ? names.length > 0 :
    step === 3 ? parseFloat(draft.unit_price) > 0 :
    true;

  async function handleConcluir() {
    if (!company?.id) return;
    try {
      await studioBulkHubApi.createBulkEvent(company.id, {
        event_name: draft.event_name.trim(),
        customer_name: draft.customer_name.trim() || undefined,
        customer_phone: draft.customer_phone.trim() || undefined,
        product_id: draft.product_id,
        base_unit_price: parseFloat(draft.unit_price),
        delivery_deadline: draft.delivery_deadline || undefined,
        notes: draft.notes.trim() || undefined,
        status: "confirmed",
        items: names.map((n) => ({ recipient_name: n })),
      });
      toast.success(`✨ Evento criado com ${names.length} pessoas!`);
      onSaved();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao criar evento");
    }
  }


  const Row = ({ label, value, highlight, big }: { label: string; value: string; highlight?: "green" | "primary"; big?: boolean }) => {
    return (
      <View style={s.sumRow}>
        <Text style={s.sumLabel}>{label}</Text>
        <Text style={[
          s.sumValue,
          big && { fontSize: 16, fontWeight: "800" },
          highlight === "green" && { color: t.mint },
          highlight === "primary" && { color: t.primary },
        ]}>{value}</Text>
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={s.closeRow}>
        <Pressable onPress={onClose} style={s.closeBtn}>
          <Icon name="x" size={18} color={t.ink2} />
        </Pressable>
      </View>

      <StudioWorkflow
        title="Novo pedido pra evento"
        steps={["Evento + produto", "Lista de pessoas", "Preço", "Prazo", "Confirmar"]}
        current={step}
        onBack={step > 1 ? () => setStep((x) => x - 1) : undefined}
        onNext={step < 5 ? () => setStep((x) => x + 1) : undefined}
        onConcluir={step === 5 ? handleConcluir : undefined}
        primaryDisabled={!canAdvance}
        draftKey="bulk-order-wizard"
        draft={draft}
        onDraftRestored={(d: any) => setDraft({ ...DEFAULT_DRAFT, ...d })}
      >
        {step === 1 && (
          <View style={s.block}>
            <Text style={s.q}>De qual evento estamos falando?</Text>
            <Text style={s.help}>Ex: "Casamento da Marília", "Festa Empresa X", "Lembrancinha aniversário 30 anos".</Text>

            <Text style={s.label}>Nome do evento *</Text>
            <TextInput
              style={s.input}
              placeholder="Ex: Casamento Marília & João"
              value={draft.event_name}
              onChangeText={(v) => upd({ event_name: v })}
              autoFocus
            />

            <Text style={[s.label, { marginTop: 14 }]}>Cliente que está pedindo (opcional)</Text>
            <View style={s.row2}>
              <TextInput
                style={[s.input, { flex: 2 }]}
                placeholder="Nome"
                value={draft.customer_name}
                onChangeText={(v) => upd({ customer_name: v })}
              />
              <TextInput
                style={[s.input, { flex: 1 }]}
                placeholder="Telefone"
                value={draft.customer_phone}
                onChangeText={(v) => upd({ customer_phone: v })}
                keyboardType="phone-pad"
              />
            </View>

            <Text style={[s.label, { marginTop: 14 }]}>Produto *</Text>
            <ScrollView style={{ maxHeight: 200 }}>
              {products.map((p) => (
                <Pressable
                  key={p.id}
                  style={[s.prodCard, draft.product_id === p.id && s.prodCardSel]}
                  onPress={() => upd({
                    product_id: p.id,
                    product_name: p.name,
                    unit_price: String(p.price || 0),
                  })}
                >
                  <View style={[s.prodDot, draft.product_id === p.id && { backgroundColor: t.primary }]}>
                    {draft.product_id === p.id && <Icon name="check" size={12} color="#fff" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.prodName}>{p.name}</Text>
                    <Text style={s.prodPrice}>R$ {Number(p.price).toFixed(2)}</Text>
                  </View>
                </Pressable>
              ))}
              {products.length === 0 && (
                <Text style={s.help}>Sem produtos personalizáveis cadastrados. Cadastre em Estúdio › Produtos primeiro.</Text>
              )}
            </ScrollView>
          </View>
        )}

        {step === 2 && (
          <View style={s.block}>
            <Text style={s.q}>Quem vai receber?</Text>
            <Text style={s.help}>
              Cole a lista de nomes — um por linha. Cada nome vira uma unidade personalizada.
              No futuro vamos aceitar planilha CSV direto.
            </Text>

            <Text style={s.label}>Lista de pessoas</Text>
            <TextInput
              style={[s.input, { minHeight: 200, fontFamily: "monospace", fontSize: 13 }]}
              placeholder={"Marília\nJoão\nMaria\n..."}
              value={draft.names_raw}
              onChangeText={(v) => upd({ names_raw: v })}
              multiline
            />
            <View style={s.countBadge}>
              <Icon name="users" size={12} color={t.primary} />
              <Text style={s.countTxt}>{names.length} pessoas</Text>
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={s.block}>
            <Text style={s.q}>Quanto vai cobrar por unidade?</Text>
            <Text style={s.help}>
              Conforme aumenta a quantidade, oferecemos desconto automático pra você passar pro cliente.
            </Text>

            <Text style={s.label}>Preço unitário (R$)</Text>
            <TextInput
              style={s.input}
              keyboardType="decimal-pad"
              value={draft.unit_price}
              onChangeText={(v) => upd({ unit_price: v.replace(",", ".") })}
            />

            {pricing && (
              <View style={s.pricingCard}>
                <View style={s.pricingRow}>
                  <Text style={s.pricingLabel}>{pricing.qty} × R$ {pricing.unit_price.toFixed(2)}</Text>
                  <Text style={s.pricingValue}>R$ {(pricing.qty * pricing.unit_price).toFixed(2)}</Text>
                </View>
                {pricing.discount_pct > 0 && (
                  <View style={s.pricingRow}>
                    <Text style={[s.pricingLabel, { color: t.mint }]}>
                      Desconto {pricing.discount_pct}% (volume)
                    </Text>
                    <Text style={[s.pricingValue, { color: t.mint }]}>
                      − R$ {pricing.savings.toFixed(2)}
                    </Text>
                  </View>
                )}
                <View style={[s.pricingRow, s.pricingTotal]}>
                  <Text style={s.pricingTotalLabel}>Total</Text>
                  <Text style={s.pricingTotalValue}>R$ {pricing.total_amount.toFixed(2)}</Text>
                </View>

                <View style={s.tiersBox}>
                  <Text style={s.tiersLabel}>FAIXAS DE DESCONTO</Text>
                  {pricing.tiers.map((tier) => (
                    <Text key={tier.from} style={[
                      s.tier,
                      pricing.qty >= tier.from && { color: t.mint, fontWeight: "700" },
                    ]}>
                      {pricing.qty >= tier.from ? "✓ " : "○ "}{tier.label}
                    </Text>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {step === 4 && (
          <View style={s.block}>
            <Text style={s.q}>Quando precisa entregar?</Text>
            <Text style={s.help}>
              Ajude a planejar a produção. Você pode mudar depois se precisar.
            </Text>

            <Text style={s.label}>Data de entrega</Text>
            <TextInput
              style={s.input}
              placeholder="AAAA-MM-DD"
              value={draft.delivery_deadline}
              onChangeText={(v) => upd({ delivery_deadline: v })}
            />
            <Text style={s.subHelp}>Formato: 2026-12-25</Text>

            <Text style={[s.label, { marginTop: 14 }]}>Observações (opcional)</Text>
            <TextInput
              style={[s.input, { minHeight: 80 }]}
              placeholder="Detalhes pra ajudar na produção..."
              value={draft.notes}
              onChangeText={(v) => upd({ notes: v })}
              multiline
            />
          </View>
        )}

        {step === 5 && (
          <View style={s.block}>
            <Text style={s.q}>Conferir e confirmar</Text>
            <View style={s.summary}>
              <Row label="Evento" value={draft.event_name} />
              {draft.customer_name && <Row label="Cliente" value={draft.customer_name + (draft.customer_phone ? " · " + draft.customer_phone : "")} />}
              <Row label="Produto" value={draft.product_name} />
              <Row label="Quantidade" value={`${names.length} pessoas`} />
              {pricing && (
                <>
                  <Row label="Preço unitário" value={`R$ ${parseFloat(draft.unit_price).toFixed(2)}`} />
                  {pricing.discount_pct > 0 && (
                    <Row label="Desconto" value={`${pricing.discount_pct}% (− R$ ${pricing.savings.toFixed(2)})`} highlight="green" />
                  )}
                  <Row label="Total" value={`R$ ${pricing.total_amount.toFixed(2)}`} highlight="primary" big />
                </>
              )}
              {draft.delivery_deadline && <Row label="Entrega" value={draft.delivery_deadline} />}
            </View>
            <Text style={[s.help, { marginTop: 14 }]}>
              Ao confirmar, este evento entra no Hub e na linha de produção. Você poderá gerar mockups individuais e enviar pra aprovação do cliente.
            </Text>
          </View>
        )}
      </StudioWorkflow>
    </View>
  );
}


const buildStyles = (t: StudioPalette) => StyleSheet.create({
  closeRow: { flexDirection: "row", justifyContent: "flex-end", padding: 12 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: t.paperCardElev },
  block: { maxWidth: 560 },
  q: { fontSize: 17, fontWeight: "800", color: t.ink, letterSpacing: -0.3 },
  help: { fontSize: 13, color: t.ink3, marginTop: 4, marginBottom: 16, lineHeight: 19 },
  subHelp: { fontSize: 11.5, color: t.ink3, marginTop: 4, fontStyle: "italic" },
  label: { fontSize: 11, color: t.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 },
  input: { backgroundColor: t.paperCardElev, borderWidth: 1.5, borderColor: t.ink5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: t.ink },
  row2: { flexDirection: "row", gap: 8 },

  prodCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: t.ink5, backgroundColor: t.paperCardElev, marginBottom: 6 },
  prodCardSel: { borderColor: t.primary, backgroundColor: t.primaryGhost },
  prodDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: t.ink4, alignItems: "center", justifyContent: "center" },
  prodName: { fontSize: 13.5, fontWeight: "700", color: t.ink },
  prodPrice: { fontSize: 12, color: t.ink3, marginTop: 2 },

  countBadge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: t.primarySoft, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, marginTop: 8 },
  countTxt: { color: t.primary, fontWeight: "800", fontSize: 12 },

  pricingCard: { marginTop: 16, backgroundColor: t.paperCardElev, borderWidth: 1, borderColor: t.ink5, borderRadius: 14, padding: 16 },
  pricingRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  pricingLabel: { fontSize: 13, color: t.ink2 },
  pricingValue: { fontSize: 13.5, fontWeight: "700", color: t.ink },
  pricingTotal: { borderTopWidth: 1, borderTopColor: t.ink5, marginTop: 6, paddingTop: 12 },
  pricingTotalLabel: { fontSize: 14, fontWeight: "800", color: t.ink },
  pricingTotalValue: { fontSize: 18, fontWeight: "800", color: t.primary },

  tiersBox: { marginTop: 14, padding: 12, backgroundColor: t.bgSoft, borderRadius: 10 },
  tiersLabel: { fontSize: 10, fontWeight: "800", color: t.ink3, letterSpacing: 0.6, marginBottom: 6 },
  tier: { fontSize: 12, color: t.ink3, paddingVertical: 2 },

  summary: { backgroundColor: t.paperCard, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: t.ink5 },
  sumRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, alignItems: "center" },
  sumLabel: { fontSize: 12.5, color: t.ink3 },
  sumValue: { fontSize: 13.5, fontWeight: "600", color: t.ink, textAlign: "right", maxWidth: "60%" },
});

export default BulkOrderWizard;
