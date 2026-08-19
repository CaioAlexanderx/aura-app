// ============================================================
// AURA STUDIO · Wizard de pedido em massa pra evento (Fase 6)
//
// 4ª aplicação do <StudioWorkflow> canônico.
//
// FIX (bug #10 QA, 19/08/2026): eram 5 passos onde cabiam 2 — passo 3 era
// um campo já preenchido pelo preço do produto, passo 4 tinha 2 campos
// opcionais e passo 5 só relia o que já estava na tela. Reduzido a:
//   1. Evento, produto e pessoas
//   2. Preço e prazo (com resumo inline + "Criar evento")
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

// Gera uma chave de rascunho nova a cada "sessão de criação" (mount inicial
// + toda vez que um evento é criado com sucesso). Ver FIX bug #11 abaixo.
function makeSessionKey(): string {
  return "bulk-order-wizard-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

// FIX (bug #17 QA): máscara simples AAAA-MM-DD — só dígitos, dash automático.
function maskDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  const y = digits.slice(0, 4);
  const m = digits.slice(4, 6);
  const d = digits.slice(6, 8);
  return [y, m, d].filter(Boolean).join("-");
}

function fmtISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return fmtISO(d);
}

export function BulkOrderWizard({ onClose, onSaved, products }: Props) {
  const t = useStudioTokens();
  const s = useMemo(() => buildStyles(t), [t]);
  const { company } = useAuthStore();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Draft>(DEFAULT_DRAFT);
  const [pricing, setPricing] = useState<BulkPricingPreview | null>(null);
  // FIX (bug #11 QA): draftKey era uma string fixa ("bulk-order-wizard") —
  // como o Modal que hospeda o wizard (pedidos.tsx) não desmonta o
  // componente entre aberturas, o ESTADO REACT (não só o localStorage)
  // sobrevivia: o 2º evento abria com os dados do 1º ainda no `draft`.
  // Chave única por sessão de criação + reset explícito do form ao
  // concluir com sucesso (abaixo) resolve os dois ângulos do bug.
  const [sessionKey, setSessionKey] = useState(makeSessionKey);
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

  // 2 passos (FIX bug #10 QA): 1) evento+produto+pessoas 2) preço+prazo.
  const canAdvance =
    step === 1 ? draft.event_name.trim().length > 1 && !!draft.product_id && names.length > 0 :
    parseFloat(draft.unit_price) > 0;

  const deadlineValid = !draft.delivery_deadline || /^\d{4}-\d{2}-\d{2}$/.test(draft.delivery_deadline);

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
      // Reseta o form + troca a chave de rascunho ANTES de notificar o pai:
      // se o Modal reabrir esta mesma instância pra um novo evento, ela já
      // nasce limpa (sem dados do evento recém-criado).
      setDraft(DEFAULT_DRAFT);
      setPricing(null);
      setStep(1);
      setSessionKey(makeSessionKey());
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
        steps={["Evento, produto e pessoas", "Preço e prazo"]}
        current={step}
        onBack={step > 1 ? () => setStep((x) => x - 1) : undefined}
        onNext={step < 2 ? () => setStep((x) => x + 1) : undefined}
        onConcluir={step === 2 ? handleConcluir : undefined}
        primaryCta={step === 2 ? "Criar evento" : undefined}
        primaryDisabled={!canAdvance}
        draftKey={sessionKey}
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
            <ScrollView style={{ maxHeight: 160 }}>
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

            <Text style={[s.label, { marginTop: 14 }]}>Quem vai receber? *</Text>
            <Text style={s.help}>
              Cole a lista de nomes — um por linha. Cada nome vira uma unidade personalizada.
            </Text>
            <TextInput
              style={[s.input, { minHeight: 140, fontFamily: "monospace", fontSize: 13 }]}
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

        {step === 2 && (
          <View style={s.block}>
            <Text style={s.q}>Preço e prazo</Text>
            <Text style={s.help}>
              Confira o resumo do evento, ajuste o preço unitário e (se souber) o prazo de entrega.
            </Text>

            {/* Resumo inline — substitui o antigo passo 5 "Confirmar" */}
            <View style={s.summary}>
              <Row label="Evento" value={draft.event_name} />
              {draft.customer_name && <Row label="Cliente" value={draft.customer_name + (draft.customer_phone ? " · " + draft.customer_phone : "")} />}
              <Row label="Produto" value={draft.product_name} />
              <Row label="Quantidade" value={`${names.length} pessoas`} />
            </View>

            <Text style={[s.label, { marginTop: 16 }]}>Preço unitário (R$)</Text>
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

            <Text style={[s.label, { marginTop: 16 }]}>Data de entrega (opcional)</Text>
            <TextInput
              style={[s.input, !deadlineValid && { borderColor: "#EF4444" }]}
              placeholder="AAAA-MM-DD"
              value={draft.delivery_deadline}
              onChangeText={(v) => upd({ delivery_deadline: maskDateInput(v) })}
              keyboardType="number-pad"
              maxLength={10}
            />
            {/* FIX (bug #17 QA): atalhos de data — evita digitar formato errado */}
            <View style={s.deadlineShortcuts}>
              {[
                { label: "Hoje", days: 0 },
                { label: "+7d", days: 7 },
                { label: "+15d", days: 15 },
              ].map((sc) => (
                <Pressable
                  key={sc.label}
                  style={s.deadlineChip}
                  onPress={() => upd({ delivery_deadline: addDaysISO(sc.days) })}
                >
                  <Text style={s.deadlineChipTxt}>{sc.label}</Text>
                </Pressable>
              ))}
            </View>
            {!deadlineValid ? (
              <Text style={[s.subHelp, { color: "#EF4444" }]}>Formato inválido — use AAAA-MM-DD (ex: 2026-12-25).</Text>
            ) : (
              <Text style={s.subHelp}>Formato: 2026-12-25</Text>
            )}

            <Text style={[s.label, { marginTop: 14 }]}>Observações (opcional)</Text>
            <TextInput
              style={[s.input, { minHeight: 80 }]}
              placeholder="Detalhes pra ajudar na produção..."
              value={draft.notes}
              onChangeText={(v) => upd({ notes: v })}
              multiline
            />

            <Text style={[s.help, { marginTop: 14 }]}>
              Ao criar, este evento entra no Hub e na linha de produção. Você poderá gerar mockups individuais e enviar pra aprovação do cliente.
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

  deadlineShortcuts: { flexDirection: "row", gap: 6, marginTop: 8 },
  deadlineChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: t.paperCardElev, borderWidth: 1, borderColor: t.ink5 },
  deadlineChipTxt: { fontSize: 11.5, color: t.ink2, fontWeight: "700" },

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
