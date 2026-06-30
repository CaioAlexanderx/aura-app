import { useState, useMemo, useRef, useEffect } from "react";
import { View, Text, Pressable, ScrollView, Modal, Platform, ActivityIndicator, TextInput, Switch } from "react-native";
import { FoodColors } from "@/constants/food-tokens";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { request, BASE_URL } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { usePdvSettings } from "@/hooks/usePdvSettings";
import { useVisibleModules } from "@/hooks/useVisibleModules";
import { useQueryClient } from "@tanstack/react-query";
import { type FoodTable, type FoodComanda } from "@/hooks/useFoodTables";
import { printThermalUrl, buildCupomUrl } from "@/utils/printThermal";

// ============================================================
// CloseTableModal — Fase 7 Aura Food.
// DNA TrocaModal: wizard multi-passo (Revisar -> Pagamento ->
//   NFC-e -> Confirmacao).
//
// POST /companies/:id/food/orders/:oid/close-and-emit
//   body { payments[], service_fee_pct?, emit_nfce?, customer? }
//   resp { sale_id, sale_payments, nfce, service_fee_amount }
//
// Decisoes (24/05/2026):
//   - 1 sale por mesa (todos os pedidos abertos consolidados no backend)
//   - oid = primeiro pedido aberto (backend resolve os demais)
//   - throttle 1.5s anti dupla emissao (memory caixa_dois_bugs_09mai2026)
//   - taxa servico FORA do NFC-e (linha separada no cupom)
//   - apos NFC-e ok, oferece imprimir cupom termico (window.print)
// ============================================================

type StepKey = "review" | "payment" | "nfce" | "confirm";

export type ClosePayment = {
  method: "dinheiro" | "pix" | "credito" | "debito" | "crediario";
  amount: number;
  tendered?: number; // troco em dinheiro
};

export type CloseRequest = {
  payments: ClosePayment[];
  service_fee_pct?: number;
  emit_nfce?: boolean;
  customer?: {
    cpf?: string | null;
    name?: string | null;
    email?: string | null;
  } | null;
};

export type CloseResponse = {
  sale_id: string;
  sale_payments: any[];
  nfce: {
    status: "emitida" | "falhou" | "sem_emissao";
    qr_url?: string | null;
    key?: string | null;
    error?: string | null;
    order_id?: string | null; // backend pode retornar o oid pra cupom
  } | null;
  service_fee_amount: number;
};

const METHODS: { key: ClosePayment["method"]; label: string; icon: string; color: string }[] = [
  { key: "dinheiro",  label: "Dinheiro", icon: "banknote",   color: FoodColors.green },
  { key: "pix",       label: "Pix",      icon: "qrcode",     color: FoodColors.cyan  },
  { key: "debito",    label: "Debito",   icon: "card",       color: FoodColors.amber },
  { key: "credito",   label: "Credito",  icon: "card",       color: FoodColors.violet},
  { key: "crediario", label: "Fiado",    icon: "users",      color: FoodColors.rose  },
];

interface Props {
  table: FoodTable;
  comanda: FoodComanda; // ja carregada pelo TableDrawer
  onClose: () => void;
  // staff escape hatch (link discreto "Fechar sem registrar")
  onForceFree?: () => void;
}

export function CloseTableModal({ table, comanda, onClose, onForceFree }: Props) {
  const { company, token } = useAuthStore();
  const { settings } = usePdvSettings();
  const visible = useVisibleModules();
  const qc = useQueryClient();

  const isWeb = Platform.OS === "web";
  const planAllowsNfce = visible.has("food.nfce");
  const settingsAllowsNfce = settings?.food_nfce_manual_enabled === true;

  const [step, setStep] = useState<StepKey>("review");
  const [payments, setPayments] = useState<ClosePayment[]>([]);
  const [emitNfce, setEmitNfce] = useState<boolean>(false);
  const [includeServiceFee, setIncludeServiceFee] = useState<boolean>(
    Number(comanda.service_fee_pct || 0) > 0
  );
  const [cpf, setCpf] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<CloseResponse | null>(null);
  const [nfceError, setNfceError] = useState<string | null>(null);

  // Throttle 1.5s anti dupla click — memory caixa_dois_bugs_09mai2026
  const lastClickRef = useRef<number>(0);

  // Inicializa default emit_nfce baseado nas settings + plano. Apenas
  // quando settings carregar (que pode acontecer apos mount).
  useEffect(() => {
    if (settingsAllowsNfce && planAllowsNfce) {
      setEmitNfce(true);
    }
  }, [settingsAllowsNfce, planAllowsNfce]);

  // ===== Calculos =====
  const subtotal = Number(comanda.subtotal_open || 0);
  const discount = Number(comanda.discount_total || 0);
  const serviceFeePct = includeServiceFee ? Number(comanda.service_fee_pct || 0) : 0;
  const serviceFeeAmount = +((subtotal - discount) * (serviceFeePct / 100)).toFixed(2);
  const total = +(subtotal - discount + serviceFeeAmount).toFixed(2);

  const paidTotal = useMemo(
    () => payments.reduce((s, p) => s + Number(p.amount || 0), 0),
    [payments]
  );
  const remaining = +(total - paidTotal).toFixed(2);
  const fullyPaid = remaining <= 0.005;

  // primeiro pedido aberto pra usar como oid no endpoint /close-and-emit
  const primaryOrderId = useMemo(() => {
    const open = (comanda.orders || []).find(
      o => o.status !== "delivered" && o.status !== "cancelled"
    );
    return open?.id || comanda.orders?.[0]?.id || null;
  }, [comanda.orders]);

  function addPayment(method: ClosePayment["method"]) {
    const amount = Math.max(0, remaining);
    setPayments(prev => [...prev, { method, amount }]);
  }
  function updatePayment(idx: number, patch: Partial<ClosePayment>) {
    setPayments(prev => prev.map((p, i) => i === idx ? { ...p, ...patch } : p));
  }
  function removePayment(idx: number) {
    setPayments(prev => prev.filter((_, i) => i !== idx));
  }

  // ===== Submit =====
  async function handleSubmit() {
    const now = Date.now();
    if (now - lastClickRef.current < 1500) return; // throttle
    lastClickRef.current = now;

    if (!company?.id || !primaryOrderId) {
      toast.error("Pedido nao encontrado");
      return;
    }
    if (!fullyPaid) {
      toast.error("Pagamento nao cobre o total");
      return;
    }

    setLoading(true);
    setNfceError(null);

    const cleanCpf = (cpf || "").replace(/\D/g, "");
    const body: CloseRequest = {
      payments: payments.map(p => ({
        method: p.method,
        amount: Number(p.amount || 0),
        tendered: p.method === "dinheiro" && p.tendered ? Number(p.tendered) : undefined,
      })),
      service_fee_pct: serviceFeePct,
      emit_nfce: emitNfce && planAllowsNfce && settingsAllowsNfce,
      customer: (emitNfce && (cleanCpf || customerName || email)) ? {
        cpf: cleanCpf || null,
        name: customerName.trim() || null,
        email: email.trim() || null,
      } : null,
    };

    try {
      const resp = await request<CloseResponse>(
        "/companies/" + company.id + "/food/orders/" + primaryOrderId + "/close-and-emit",
        { method: "POST", body, retry: 0 }
      );
      setResponse(resp);

      // invalida queries afetadas
      qc.invalidateQueries({ queryKey: ["food-tables", company.id] });
      qc.invalidateQueries({ queryKey: ["food-comanda", company.id, table.id] });
      qc.invalidateQueries({ queryKey: ["food-kds-active", company.id] });
      qc.invalidateQueries({ queryKey: ["food-kds-ready", company.id] });

      const saleShort = resp.sale_id ? resp.sale_id.slice(0, 8) : "";
      toast.success("Mesa fechada • Sale #" + saleShort);

      if (resp.nfce && resp.nfce.status === "falhou") {
        setNfceError(resp.nfce.error || "Erro desconhecido na emissao NFC-e");
      }
      // permanece no passo confirm pra usuario poder imprimir / decidir
      setStep("confirm");
    } catch (err: any) {
      toast.error(err?.data?.error || err?.message || "Erro ao fechar mesa");
    } finally {
      setLoading(false);
    }
  }

  function handlePrintCupom() {
    if (!company?.id) return;
    const oid = response?.nfce?.order_id || primaryOrderId;
    if (!oid) return;
    const url = buildCupomUrl(BASE_URL, company.id, oid, token);
    printThermalUrl(url);
  }

  // ===== UI =====
  const stepIdx = (
    step === "review"  ? 0 :
    step === "payment" ? 1 :
    step === "nfce"    ? 2 :
    3
  );

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{
        flex: 1, backgroundColor: "rgba(0,0,0,0.7)",
        justifyContent: "center", alignItems: "center", padding: isWeb ? 24 : 0,
      }}>
        <View style={{
          backgroundColor: FoodColors.bg,
          width: isWeb ? "100%" : "100%",
          maxWidth: 560,
          height: isWeb ? "auto" : "100%",
          maxHeight: isWeb ? "90%" : "100%",
          borderRadius: isWeb ? 16 : 0,
          borderWidth: 1, borderColor: FoodColors.border,
          overflow: "hidden",
        }}>
          {/* Header com stepper */}
          <View style={{
            paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12,
            borderBottomWidth: 1, borderBottomColor: FoodColors.border,
          }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: FoodColors.red, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" }}>
                  FECHAR MESA {table.number}
                </Text>
                <Text style={{ fontSize: 18, color: FoodColors.ink, fontWeight: "800", marginTop: 2 }}>
                  {step === "review"  ? "Revisar consumo" :
                   step === "payment" ? "Pagamento" :
                   step === "nfce"    ? "Nota fiscal (opcional)" :
                                        "Mesa fechada"}
                </Text>
              </View>
              <Pressable onPress={onClose} style={{
                width: 32, height: 32, alignItems: "center", justifyContent: "center",
                borderRadius: 8, backgroundColor: FoodColors.surface2,
              }}>
                <Icon name="x" size={16} color={FoodColors.ink3} />
              </Pressable>
            </View>
            {/* Stepper bullets */}
            <View style={{ flexDirection: "row", gap: 6, marginTop: 12 }}>
              {[0,1,2,3].map(i => (
                <View key={i} style={{
                  flex: 1, height: 3, borderRadius: 2,
                  backgroundColor: i <= stepIdx ? FoodColors.red : FoodColors.border,
                }} />
              ))}
            </View>
          </View>

          {/* Body */}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 14 }}>
            {step === "review" && (
              <ReviewStep
                comanda={comanda}
                subtotal={subtotal}
                discount={discount}
                serviceFeePct={Number(comanda.service_fee_pct || 0)}
                serviceFeeAmount={serviceFeeAmount}
                includeServiceFee={includeServiceFee}
                onToggleServiceFee={setIncludeServiceFee}
                total={total}
              />
            )}

            {step === "payment" && (
              <PaymentStep
                total={total}
                remaining={remaining}
                payments={payments}
                onAdd={addPayment}
                onUpdate={updatePayment}
                onRemove={removePayment}
              />
            )}

            {step === "nfce" && (
              <NfceStep
                emitNfce={emitNfce}
                setEmitNfce={setEmitNfce}
                planAllowsNfce={planAllowsNfce}
                settingsAllowsNfce={settingsAllowsNfce}
                cpf={cpf} setCpf={setCpf}
                name={customerName} setName={setCustomerName}
                email={email} setEmail={setEmail}
              />
            )}

            {step === "confirm" && response && (
              <ConfirmStep
                response={response}
                nfceError={nfceError}
                onPrintCupom={handlePrintCupom}
                onRetryNfce={() => { setNfceError(null); setStep("nfce"); }}
              />
            )}
          </ScrollView>

          {/* Footer */}
          <View style={{
            padding: 14, borderTopWidth: 1, borderTopColor: FoodColors.border,
            flexDirection: "row", gap: 8, alignItems: "center",
          }}>
            {step !== "confirm" && (
              <>
                {step !== "review" ? (
                  <Pressable onPress={() => {
                    if (step === "payment") setStep("review");
                    else if (step === "nfce") setStep("payment");
                  }} style={{
                    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 8,
                    backgroundColor: FoodColors.surface2,
                  }}>
                    <Text style={{ color: FoodColors.ink2, fontSize: 13, fontWeight: "600" }}>Voltar</Text>
                  </Pressable>
                ) : (
                  onForceFree && (
                    <Pressable onPress={() => {
                      if (typeof window !== "undefined" && Platform.OS === "web") {
                        if (!window.confirm("Liberar mesa sem registrar venda? Pedidos abertos serao cancelados.")) return;
                      }
                      onForceFree();
                    }} style={{ paddingHorizontal: 10, paddingVertical: 8 }}>
                      <Text style={{ color: FoodColors.ink4, fontSize: 11, textDecorationLine: "underline" }}>
                        Fechar sem registrar
                      </Text>
                    </Pressable>
                  )
                )}
                <View style={{ flex: 1 }} />
                {step === "review" && (
                  <Pressable onPress={() => setStep("payment")} style={primaryBtn}>
                    <Text style={primaryBtnText}>{"Pagamento ->"}</Text>
                  </Pressable>
                )}
                {step === "payment" && (
                  <Pressable
                    onPress={() => fullyPaid && setStep("nfce")}
                    disabled={!fullyPaid}
                    style={[primaryBtn, !fullyPaid && { opacity: 0.4 }]}
                  >
                    <Text style={primaryBtnText}>{fullyPaid ? "NFC-e -> " : "Falta R$ " + remaining.toFixed(2)}</Text>
                  </Pressable>
                )}
                {step === "nfce" && (
                  <Pressable
                    onPress={handleSubmit}
                    disabled={loading || !fullyPaid}
                    style={[primaryBtn, (loading || !fullyPaid) && { opacity: 0.6 }]}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={primaryBtnText}>Fechar mesa</Text>
                    )}
                  </Pressable>
                )}
              </>
            )}
            {step === "confirm" && (
              <>
                <View style={{ flex: 1 }} />
                <Pressable onPress={onClose} style={primaryBtn}>
                  <Text style={primaryBtnText}>Concluir</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const primaryBtn: any = {
  paddingHorizontal: 18, paddingVertical: 12, borderRadius: 8,
  backgroundColor: FoodColors.red, alignItems: "center", minWidth: 140,
};
const primaryBtnText: any = { color: "#fff", fontSize: 14, fontWeight: "800" };

// ============================================================
// PASSO 1 — Revisar consumo
// ============================================================
function ReviewStep({
  comanda, subtotal, discount, serviceFeePct, serviceFeeAmount,
  includeServiceFee, onToggleServiceFee, total,
}: {
  comanda: FoodComanda;
  subtotal: number; discount: number; serviceFeePct: number; serviceFeeAmount: number;
  includeServiceFee: boolean; onToggleServiceFee: (v: boolean) => void;
  total: number;
}) {
  // agrega itens iguais de pedidos diferentes
  const aggregated = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; total: number }>();
    (comanda.orders || []).forEach(o => {
      if (o.status === "cancelled") return;
      o.items.forEach(it => {
        const key = (it.item_name || "") + "|" + (it.variation_name || "");
        const cur = map.get(key) || { name: it.item_name + (it.variation_name ? " (" + it.variation_name + ")" : ""), qty: 0, total: 0 };
        cur.qty += Number(it.quantity || 0);
        cur.total += Number(it.total_price || 0);
        map.set(key, cur);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [comanda.orders]);

  return (
    <>
      <View style={{
        backgroundColor: FoodColors.surface, borderRadius: 10, padding: 12,
        borderWidth: 1, borderColor: FoodColors.border, gap: 6,
      }}>
        {aggregated.map((row, i) => (
          <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
            <Text style={{ fontSize: 13, color: FoodColors.ink2, flex: 1 }}>
              <Text style={{ color: FoodColors.ink3, fontWeight: "700" }}>{row.qty}x </Text>
              {row.name}
            </Text>
            <Text style={{ fontSize: 13, color: FoodColors.ink, fontWeight: "600" }}>
              R$ {row.total.toFixed(2)}
            </Text>
          </View>
        ))}
        {aggregated.length === 0 && (
          <Text style={{ color: FoodColors.ink3, textAlign: "center", padding: 12 }}>Mesa sem itens</Text>
        )}
      </View>

      {/* Taxa de servico toggle */}
      {serviceFeePct > 0 && (
        <View style={{
          flexDirection: "row", alignItems: "center", gap: 10,
          backgroundColor: FoodColors.surface2, borderRadius: 10, padding: 12,
          borderWidth: 1, borderColor: FoodColors.border,
        }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, color: FoodColors.ink, fontWeight: "700" }}>
              Taxa de servico ({serviceFeePct}%)
            </Text>
            <Text style={{ fontSize: 11, color: FoodColors.ink3, marginTop: 2 }}>
              Gorjeta opcional pro garcom — fora da NFC-e
            </Text>
          </View>
          <Switch
            value={includeServiceFee}
            onValueChange={onToggleServiceFee}
            trackColor={{ false: FoodColors.border, true: FoodColors.red + "66" }}
            thumbColor={includeServiceFee ? FoodColors.red : FoodColors.ink3}
          />
        </View>
      )}

      <View style={{ gap: 4, marginTop: 4 }}>
        <Row label="Subtotal" value={subtotal} />
        {discount > 0 && <Row label="Desconto" value={-discount} muted />}
        {includeServiceFee && serviceFeeAmount > 0 && (
          <Row label={"Taxa servico (" + serviceFeePct + "%)"} value={serviceFeeAmount} muted />
        )}
        <View style={{ height: 1, backgroundColor: FoodColors.border, marginVertical: 6 }} />
        <Row label="TOTAL A COBRAR" value={total} bold />
      </View>
    </>
  );
}

// ============================================================
// PASSO 2 — Pagamento multi-method
// ============================================================
function PaymentStep({
  total, remaining, payments, onAdd, onUpdate, onRemove,
}: {
  total: number;
  remaining: number;
  payments: ClosePayment[];
  onAdd: (m: ClosePayment["method"]) => void;
  onUpdate: (idx: number, patch: Partial<ClosePayment>) => void;
  onRemove: (idx: number) => void;
}) {
  return (
    <>
      <View style={{
        backgroundColor: FoodColors.surface, borderRadius: 10, padding: 14,
        borderWidth: 1, borderColor: FoodColors.border,
      }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 11, color: FoodColors.ink3, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Total a cobrar
          </Text>
          <Text style={{ fontSize: 22, color: FoodColors.green, fontWeight: "800" }}>
            R$ {total.toFixed(2)}
          </Text>
        </View>
        {remaining > 0.005 && (
          <Text style={{ fontSize: 11, color: FoodColors.amber, marginTop: 4, textAlign: "right" }}>
            Restam R$ {remaining.toFixed(2)}
          </Text>
        )}
        {remaining < -0.005 && (
          <Text style={{ fontSize: 11, color: FoodColors.cyan, marginTop: 4, textAlign: "right" }}>
            Troco R$ {Math.abs(remaining).toFixed(2)}
          </Text>
        )}
      </View>

      {/* Chips de metodo */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {METHODS.map(m => (
          <Pressable key={m.key} onPress={() => onAdd(m.key)} style={{
            paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8,
            backgroundColor: FoodColors.surface2,
            borderWidth: 1, borderColor: m.color + "55",
            flexDirection: "row", alignItems: "center", gap: 6,
          }}>
            <Text style={{ color: m.color, fontWeight: "700", fontSize: 12 }}>+ {m.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Lista de pagamentos */}
      {payments.length === 0 ? (
        <View style={{
          padding: 18, borderRadius: 10, borderWidth: 1, borderColor: FoodColors.border,
          borderStyle: "dashed", alignItems: "center",
        }}>
          <Text style={{ fontSize: 12, color: FoodColors.ink3 }}>Adicione um pagamento acima</Text>
        </View>
      ) : (
        payments.map((p, idx) => {
          const m = METHODS.find(x => x.key === p.method)!;
          const change = p.method === "dinheiro" && p.tendered && p.tendered > p.amount
            ? p.tendered - p.amount
            : 0;
          return (
            <View key={idx} style={{
              backgroundColor: FoodColors.surface, borderRadius: 10, padding: 12,
              borderWidth: 1, borderColor: FoodColors.border,
              flexDirection: "row", alignItems: "center", gap: 10,
            }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: m.color, fontWeight: "700", textTransform: "uppercase" }}>
                  {m.label}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                  <Text style={{ fontSize: 11, color: FoodColors.ink3 }}>R$</Text>
                  <TextInput
                    value={String(p.amount)}
                    onChangeText={(v) => onUpdate(idx, { amount: Number((v || "0").replace(/[^\d.]/g, "")) || 0 })}
                    keyboardType="decimal-pad"
                    style={{
                      backgroundColor: FoodColors.surface2, borderRadius: 6,
                      paddingHorizontal: 8, paddingVertical: 6, color: FoodColors.ink,
                      fontSize: 14, fontWeight: "700", minWidth: 90,
                    }}
                  />
                </View>
                {p.method === "dinheiro" && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
                    <Text style={{ fontSize: 10, color: FoodColors.ink3 }}>Recebido R$</Text>
                    <TextInput
                      value={p.tendered ? String(p.tendered) : ""}
                      onChangeText={(v) => onUpdate(idx, { tendered: Number((v || "0").replace(/[^\d.]/g, "")) || undefined })}
                      placeholder="opcional"
                      placeholderTextColor={FoodColors.ink4}
                      keyboardType="decimal-pad"
                      style={{
                        backgroundColor: FoodColors.surface2, borderRadius: 6,
                        paddingHorizontal: 8, paddingVertical: 4, color: FoodColors.ink,
                        fontSize: 12, minWidth: 80,
                      }}
                    />
                    {change > 0 && (
                      <Text style={{ fontSize: 11, color: FoodColors.cyan, fontWeight: "700" }}>
                        Troco R$ {change.toFixed(2)}
                      </Text>
                    )}
                  </View>
                )}
              </View>
              <Pressable onPress={() => onRemove(idx)} style={{ padding: 6 }}>
                <Icon name="x" size={14} color={FoodColors.ink3} />
              </Pressable>
            </View>
          );
        })
      )}
    </>
  );
}

// ============================================================
// PASSO 3 — NFC-e (opcional)
// ============================================================
function NfceStep({
  emitNfce, setEmitNfce, planAllowsNfce, settingsAllowsNfce,
  cpf, setCpf, name, setName, email, setEmail,
}: {
  emitNfce: boolean; setEmitNfce: (v: boolean) => void;
  planAllowsNfce: boolean; settingsAllowsNfce: boolean;
  cpf: string; setCpf: (v: string) => void;
  name: string; setName: (v: string) => void;
  email: string; setEmail: (v: string) => void;
}) {
  const blocked = !planAllowsNfce || !settingsAllowsNfce;
  const blockReason = !planAllowsNfce
    ? "Disponivel a partir do plano Negocio"
    : !settingsAllowsNfce
      ? "Habilite NFC-e manual em Configuracoes > PDV > Restaurante"
      : null;

  return (
    <>
      <View style={{
        backgroundColor: FoodColors.surface, borderRadius: 10, padding: 14,
        borderWidth: 1, borderColor: blocked ? FoodColors.border : FoodColors.red + "33",
        flexDirection: "row", alignItems: "center", gap: 10,
      }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, color: blocked ? FoodColors.ink3 : FoodColors.ink, fontWeight: "700" }}>
            Emitir NFC-e
          </Text>
          <Text style={{ fontSize: 11, color: FoodColors.ink3, marginTop: 4, lineHeight: 16 }}>
            {blockReason || "Gera cupom fiscal eletronico e libera impressao termica 80mm pro cliente."}
          </Text>
        </View>
        <Switch
          value={emitNfce && !blocked}
          onValueChange={(v) => !blocked && setEmitNfce(v)}
          disabled={blocked}
          trackColor={{ false: FoodColors.border, true: FoodColors.red + "66" }}
          thumbColor={emitNfce && !blocked ? FoodColors.red : FoodColors.ink3}
        />
      </View>

      {emitNfce && !blocked && (
        <View style={{
          backgroundColor: FoodColors.surface2, borderRadius: 10, padding: 12,
          borderWidth: 1, borderColor: FoodColors.border, gap: 10,
        }}>
          <Text style={{ fontSize: 11, color: FoodColors.ink3, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Dados do cliente (opcional)
          </Text>
          <Field label="CPF" value={cpf} onChange={setCpf} placeholder="000.000.000-00" keyboardType="numeric" />
          <Field label="Nome" value={name} onChange={setName} placeholder="Nome completo" />
          <Field label="Email" value={email} onChange={setEmail} placeholder="opcional pra envio do XML" keyboardType="email-address" />
        </View>
      )}

      {!emitNfce && !blocked && (
        <Text style={{ fontSize: 11, color: FoodColors.ink4, textAlign: "center", fontStyle: "italic" }}>
          Cliente nao quer nota — vamos pular emissao
        </Text>
      )}
    </>
  );
}

function Field({ label, value, onChange, placeholder, keyboardType }: any) {
  return (
    <View>
      <Text style={{ fontSize: 10, color: FoodColors.ink3, marginBottom: 4 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={FoodColors.ink4}
        keyboardType={keyboardType}
        autoCapitalize="none"
        style={{
          backgroundColor: FoodColors.bg, color: FoodColors.ink,
          padding: 8, borderRadius: 6, fontSize: 13,
          borderWidth: 1, borderColor: FoodColors.border,
        }}
      />
    </View>
  );
}

// ============================================================
// PASSO 4 — Confirmacao + Imprimir
// ============================================================
function ConfirmStep({
  response, nfceError, onPrintCupom, onRetryNfce,
}: {
  response: CloseResponse;
  nfceError: string | null;
  onPrintCupom: () => void;
  onRetryNfce: () => void;
}) {
  const nfce = response.nfce;
  const ok = nfce && nfce.status === "emitida";
  const failed = nfce && nfce.status === "falhou";
  const skipped = !nfce || nfce.status === "sem_emissao";

  return (
    <>
      <View style={{
        backgroundColor: FoodColors.surface, borderRadius: 10, padding: 16,
        borderWidth: 1, borderColor: FoodColors.green + "55",
        alignItems: "center", gap: 8,
      }}>
        <Text style={{ fontSize: 38 }}>🍽️</Text>
        <Text style={{ fontSize: 16, color: FoodColors.ink, fontWeight: "800" }}>Mesa fechada</Text>
        <Text style={{ fontSize: 11, color: FoodColors.ink3 }}>
          Venda registrada · Sale #{response.sale_id ? response.sale_id.slice(0, 8) : ""}
        </Text>
      </View>

      {ok && (
        <View style={{
          backgroundColor: FoodColors.surface2, borderRadius: 10, padding: 12,
          borderWidth: 1, borderColor: FoodColors.green + "33", gap: 10,
        }}>
          <Text style={{ fontSize: 12, color: FoodColors.green, fontWeight: "700" }}>
            ✓ NFC-e emitida com sucesso
          </Text>
          {nfce!.key && (
            <Text style={{ fontSize: 10, color: FoodColors.ink3, fontFamily: Platform.OS === "web" ? "monospace" : undefined }}>
              {nfce!.key}
            </Text>
          )}
          <Pressable onPress={onPrintCupom} style={{
            backgroundColor: FoodColors.red, padding: 12, borderRadius: 8, alignItems: "center",
          }}>
            <Text style={{ color: "#fff", fontSize: 13, fontWeight: "800" }}>🖨 Imprimir cupom termico</Text>
          </Pressable>
        </View>
      )}

      {failed && (
        <View style={{
          backgroundColor: "rgba(239,68,68,0.12)", borderRadius: 10, padding: 12,
          borderWidth: 1, borderColor: FoodColors.red + "55", gap: 8,
        }}>
          <Text style={{ fontSize: 12, color: FoodColors.red, fontWeight: "700" }}>
            ⚠ NFC-e nao foi emitida
          </Text>
          <Text style={{ fontSize: 11, color: FoodColors.ink3 }}>
            {nfceError || nfce!.error || "Erro desconhecido"}
          </Text>
          <Text style={{ fontSize: 10, color: FoodColors.ink4 }}>
            A venda foi registrada normalmente. Voce pode tentar reemitir mais tarde no painel de NFC-e.
          </Text>
          <Pressable onPress={onRetryNfce} style={{
            backgroundColor: FoodColors.surface, padding: 10, borderRadius: 8, alignItems: "center",
            borderWidth: 1, borderColor: FoodColors.border,
          }}>
            <Text style={{ color: FoodColors.ink2, fontSize: 12, fontWeight: "700" }}>Tentar novamente</Text>
          </Pressable>
        </View>
      )}

      {skipped && (
        <Text style={{ fontSize: 11, color: FoodColors.ink4, textAlign: "center", fontStyle: "italic" }}>
          NFC-e nao foi emitida (cliente dispensou ou recurso indisponivel)
        </Text>
      )}
    </>
  );
}

// ============================================================
function Row({ label, value, bold, muted }: { label: string; value: number; bold?: boolean; muted?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={{
        fontSize: bold ? 13 : 12,
        color: bold ? FoodColors.ink : (muted ? FoodColors.ink3 : FoodColors.ink2),
        fontWeight: bold ? "800" : "500",
      }}>{label}</Text>
      <Text style={{
        fontSize: bold ? 18 : 13,
        color: bold ? FoodColors.green : (muted ? FoodColors.ink3 : FoodColors.ink),
        fontWeight: bold ? "800" : "600",
      }}>R$ {Number(value).toFixed(2)}</Text>
    </View>
  );
}

export default CloseTableModal;
