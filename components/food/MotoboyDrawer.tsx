import { useState, useMemo } from "react";
import { View, Text, Pressable, ScrollView, TextInput, ActivityIndicator, Platform } from "react-native";
import { FoodColors } from "@/constants/food-tokens";
import { Icon } from "@/components/Icon";
import {
  useCommissionReport,
  useDelivererHistory,
  useCreateDeliverer,
  useUpdateDeliverer,
  useDeleteDeliverer,
  useMarkPayout,
  vehicleIcon,
  vehicleLabel,
  type FoodDeliverer,
} from "@/hooks/useFoodDeliverers";

// ============================================================
// MotoboyDrawer — drawer direito (520px desktop / fullscreen mobile)
// com 3 tabs: Detalhes / Relatório / Histórico.
//
// DNA TrocaModal: header fixo, tabs no topo, scrollable body,
// footer com ações principais.
// ============================================================

type Tab = "detalhes" | "relatorio" | "historico";

export function MotoboyDrawer({
  deliverer,
  onClose,
  isCreating,
}: {
  deliverer: FoodDeliverer | null;
  onClose: () => void;
  isCreating: boolean;
}) {
  const [tab, setTab] = useState<Tab>("detalhes");
  const isMobile = Platform.OS !== "web";
  const w = isMobile ? "100%" : 520;

  return (
    <View style={{
      position: "absolute", top: 0, right: 0, bottom: 0,
      width: w as any, backgroundColor: FoodColors.bg,
      borderLeftWidth: 1, borderLeftColor: FoodColors.border,
      zIndex: 100,
      ...(Platform.OS === "web" ? ({ boxShadow: "-12px 0 32px rgba(0,0,0,0.4)" } as any) : {}),
    }}>
      {/* Header */}
      <View style={{
        flexDirection: "row", alignItems: "center", gap: 10,
        paddingHorizontal: 16, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: FoodColors.border,
      }}>
        <Pressable onPress={onClose} style={{
          width: 32, height: 32, borderRadius: 8, backgroundColor: FoodColors.surface,
          alignItems: "center", justifyContent: "center",
        }}>
          <Icon name="x" size={14} color={FoodColors.ink2} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: FoodColors.ink }}>
            {isCreating ? "Novo motoboy" : deliverer?.name || "Motoboy"}
          </Text>
          {!isCreating && deliverer && (
            <Text style={{ fontSize: 11, color: FoodColors.ink3, marginTop: 1 }}>
              {vehicleIcon(deliverer.vehicle)} {vehicleLabel(deliverer.vehicle)}
              {deliverer.phone ? "  ·  " + deliverer.phone : ""}
            </Text>
          )}
        </View>
      </View>

      {/* Tabs (só pra existente; criação pula direto pra Detalhes) */}
      {!isCreating && (
        <View style={{ flexDirection: "row", paddingHorizontal: 12, paddingTop: 10, gap: 4 }}>
          {(["detalhes", "relatorio", "historico"] as Tab[]).map(t => (
            <Pressable key={t} onPress={() => setTab(t)} style={{
              flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center",
              backgroundColor: tab === t ? FoodColors.surface2 : "transparent",
              borderBottomWidth: 2,
              borderBottomColor: tab === t ? FoodColors.red : "transparent",
            }}>
              <Text style={{
                fontSize: 12, fontWeight: "700",
                color: tab === t ? FoodColors.red : FoodColors.ink3,
                textTransform: "capitalize",
              }}>
                {t === "relatorio" ? "Relatório" : t === "historico" ? "Histórico" : "Detalhes"}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Body */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        {(isCreating || tab === "detalhes") && (
          <DetalhesTab deliverer={deliverer} isCreating={isCreating} onClose={onClose} />
        )}
        {!isCreating && tab === "relatorio" && deliverer && (
          <RelatorioTab deliverer={deliverer} />
        )}
        {!isCreating && tab === "historico" && deliverer && (
          <HistoricoTab deliverer={deliverer} />
        )}
      </ScrollView>
    </View>
  );
}

// ============================================================
// Detalhes (form criar/editar)
// ============================================================
function DetalhesTab({
  deliverer, isCreating, onClose,
}: {
  deliverer: FoodDeliverer | null;
  isCreating: boolean;
  onClose: () => void;
}) {
  const create = useCreateDeliverer();
  const update = useUpdateDeliverer();
  const del    = useDeleteDeliverer();

  const [name, setName]         = useState(deliverer?.name || "");
  const [phone, setPhone]       = useState(deliverer?.phone || "");
  const [vehicle, setVehicle]   = useState<FoodDeliverer["vehicle"]>(deliverer?.vehicle || "moto");
  const [mode, setMode]         = useState<FoodDeliverer["commission_mode"]>(deliverer?.commission_mode || "fixed");
  const [value, setValue]       = useState(String(deliverer?.commission_value ?? 5));
  const [active, setActive]     = useState(deliverer?.active ?? true);
  const [error, setError]       = useState<string | null>(null);

  const submit = () => {
    setError(null);
    if (!name.trim()) { setError("Nome é obrigatório"); return; }
    const numValue = Number(value);
    if (!Number.isFinite(numValue) || numValue < 0) { setError("Comissão inválida"); return; }
    const body = {
      name: name.trim(),
      phone: phone.trim() || null,
      vehicle,
      commission_mode: mode,
      commission_value: numValue,
      active,
    };
    if (isCreating) {
      create.mutate(body, { onSuccess: onClose, onError: (e: any) => setError(e?.message || "Erro ao criar") });
    } else if (deliverer) {
      update.mutate({ id: deliverer.id, ...body }, {
        onSuccess: onClose,
        onError: (e: any) => setError(e?.message || "Erro ao salvar"),
      });
    }
  };

  const handleDelete = () => {
    if (!deliverer) return;
    if (Platform.OS === "web" && typeof window !== "undefined") {
      if (!window.confirm("Remover motoboy " + deliverer.name + "?")) return;
    }
    del.mutate(deliverer.id, { onSuccess: onClose, onError: (e: any) => setError(e?.message || "Erro") });
  };

  const isPending = create.isPending || update.isPending;

  return (
    <View style={{ gap: 14 }}>
      <Field label="Nome">
        <Input value={name} onChange={setName} placeholder="Ex.: João Silva" />
      </Field>
      <Field label="Telefone (WhatsApp)">
        <Input value={phone} onChange={setPhone} placeholder="(11) 99999-0000" keyboardType="phone-pad" />
      </Field>

      <Field label="Veículo">
        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
          {(["moto", "bike", "carro", "a_pe"] as const).map(v => (
            <Chip key={v} label={vehicleIcon(v) + " " + vehicleLabel(v)} active={vehicle === v} onPress={() => setVehicle(v)} />
          ))}
        </View>
      </Field>

      <Field label="Comissão">
        <View style={{ flexDirection: "row", gap: 6, marginBottom: 8 }}>
          <Chip label="R$ fixo por entrega" active={mode === "fixed"} onPress={() => setMode("fixed")} />
          <Chip label="% do pedido" active={mode === "pct"} onPress={() => setMode("pct")} />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={{ fontSize: 13, color: FoodColors.ink3, minWidth: 24 }}>
            {mode === "fixed" ? "R$" : "%"}
          </Text>
          <Input value={value} onChange={setValue} keyboardType="decimal-pad" />
        </View>
      </Field>

      <Pressable onPress={() => setActive(!active)} style={{
        flexDirection: "row", alignItems: "center", gap: 10,
        padding: 12, borderRadius: 10, backgroundColor: FoodColors.surface,
        borderWidth: 1, borderColor: FoodColors.border,
      }}>
        <View style={{
          width: 18, height: 18, borderRadius: 4,
          backgroundColor: active ? FoodColors.green : "transparent",
          borderWidth: 1.5, borderColor: active ? FoodColors.green : FoodColors.ink4,
          alignItems: "center", justifyContent: "center",
        }}>
          {active && <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>✓</Text>}
        </View>
        <Text style={{ flex: 1, fontSize: 13, color: FoodColors.ink, fontWeight: "600" }}>
          Ativo (aparece no despacho)
        </Text>
      </Pressable>

      {error && (
        <View style={{
          backgroundColor: "rgba(239,68,68,0.1)", borderLeftWidth: 3,
          borderLeftColor: FoodColors.red, padding: 10, borderRadius: 6,
        }}>
          <Text style={{ fontSize: 12, color: FoodColors.red, fontWeight: "700" }}>{error}</Text>
        </View>
      )}

      <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
        {!isCreating && deliverer && (
          <Pressable onPress={handleDelete} disabled={del.isPending} style={{
            paddingHorizontal: 14, paddingVertical: 12, borderRadius: 8,
            backgroundColor: FoodColors.surface, borderWidth: 1, borderColor: FoodColors.red,
          }}>
            <Text style={{ color: FoodColors.red, fontSize: 13, fontWeight: "700" }}>
              {del.isPending ? "..." : "Remover"}
            </Text>
          </Pressable>
        )}
        <Pressable onPress={submit} disabled={isPending} style={{
          flex: 1, paddingVertical: 12, borderRadius: 8,
          backgroundColor: FoodColors.red, alignItems: "center",
          opacity: isPending ? 0.5 : 1,
        }}>
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "800" }}>
            {isPending ? "Salvando..." : isCreating ? "Cadastrar motoboy" : "Salvar alterações"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ============================================================
// Relatório de comissão
// ============================================================
function RelatorioTab({ deliverer }: { deliverer: FoodDeliverer }) {
  const today = new Date();
  const thirtyAgo = new Date(today.getTime() - 30 * 86400_000);
  const [from, setFrom] = useState(thirtyAgo.toISOString().slice(0, 10));
  const [to, setTo]     = useState(today.toISOString().slice(0, 10));

  const { data, isLoading } = useCommissionReport(deliverer.id, { from, to });
  const payout = useMarkPayout();

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", gap: 6 }}>
        <Field label="De" flex>
          <Input value={from} onChange={setFrom} placeholder="YYYY-MM-DD" />
        </Field>
        <Field label="Até" flex>
          <Input value={to} onChange={setTo} placeholder="YYYY-MM-DD" />
        </Field>
      </View>

      {isLoading ? (
        <View style={{ paddingVertical: 30, alignItems: "center" }}>
          <ActivityIndicator color={FoodColors.red} />
        </View>
      ) : data ? (
        <>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <Kpi label="Entregas" value={String(data.deliveries_count)} color={FoodColors.cyan} />
            <Kpi label="Valor entregue" value={"R$ " + Number(data.delivered_value).toFixed(2)} color={FoodColors.ink} />
          </View>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <Kpi label="Comissão total" value={"R$ " + Number(data.commission_total).toFixed(2)} color={FoodColors.green} />
            <Kpi label="Não-paga" value={"R$ " + Number(data.commission_unpaid).toFixed(2)} color={FoodColors.amber} />
          </View>

          {Number(data.commission_unpaid) > 0 && (
            <Pressable
              onPress={() => payout.mutate({ id: deliverer.id, until: data.to })}
              disabled={payout.isPending}
              style={{
                backgroundColor: FoodColors.surface2, borderRadius: 8, padding: 12,
                borderWidth: 1, borderColor: FoodColors.amber, alignItems: "center",
                opacity: payout.isPending ? 0.5 : 1,
              }}
            >
              <Text style={{ color: FoodColors.amber, fontSize: 13, fontWeight: "700" }}>
                {payout.isPending ? "Salvando..." : "Marcar como pago até " + data.to}
              </Text>
            </Pressable>
          )}

          <Text style={{ fontSize: 10, color: FoodColors.ink3, textTransform: "uppercase",
            fontWeight: "700", letterSpacing: 0.5, marginTop: 8 }}>
            Entregas no período
          </Text>
          <View style={{ backgroundColor: FoodColors.surface, borderRadius: 8,
            borderWidth: 1, borderColor: FoodColors.border, overflow: "hidden" }}>
            {data.orders.length === 0 ? (
              <View style={{ padding: 20, alignItems: "center" }}>
                <Text style={{ fontSize: 12, color: FoodColors.ink3 }}>Sem entregas no período</Text>
              </View>
            ) : data.orders.map(o => (
              <View key={o.order_id} style={{
                flexDirection: "row", paddingHorizontal: 12, paddingVertical: 10,
                borderBottomWidth: 1, borderBottomColor: FoodColors.border, gap: 8,
              }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, color: FoodColors.ink, fontWeight: "600" }} numberOfLines={1}>
                    #{o.external_short} · {o.customer_name || "Sem nome"}
                  </Text>
                  <Text style={{ fontSize: 10, color: FoodColors.ink3 }}>
                    {new Date(o.dispatched_at).toLocaleString("pt-BR")}
                    {o.paid_to_deliverer ? "  ·  ✓ paga" : "  ·  ⌛ não-paga"}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 12, color: FoodColors.green, fontWeight: "700" }}>
                    +R$ {Number(o.commission).toFixed(2)}
                  </Text>
                  <Text style={{ fontSize: 9, color: FoodColors.ink3 }}>
                    de R$ {Number(o.total).toFixed(2)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

// ============================================================
// Histórico de despachos
// ============================================================
function HistoricoTab({ deliverer }: { deliverer: FoodDeliverer }) {
  const { data, isLoading } = useDelivererHistory(deliverer.id, 50);
  if (isLoading) {
    return <View style={{ paddingVertical: 30, alignItems: "center" }}>
      <ActivityIndicator color={FoodColors.red} /></View>;
  }
  if (!data || data.length === 0) {
    return <View style={{ padding: 30, alignItems: "center" }}>
      <Text style={{ fontSize: 13, color: FoodColors.ink3 }}>Sem histórico de despachos</Text></View>;
  }
  return (
    <View style={{ backgroundColor: FoodColors.surface, borderRadius: 8,
      borderWidth: 1, borderColor: FoodColors.border, overflow: "hidden" }}>
      {data.map(h => (
        <View key={h.id} style={{
          paddingHorizontal: 12, paddingVertical: 10,
          borderBottomWidth: 1, borderBottomColor: FoodColors.border,
        }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 2 }}>
            <Text style={{ fontSize: 12, color: FoodColors.ink, fontWeight: "700" }}>
              #{h.external_short}
            </Text>
            <Text style={{ fontSize: 11, color: FoodColors.green, fontWeight: "700" }}>
              R$ {Number(h.total).toFixed(2)}
            </Text>
          </View>
          <Text style={{ fontSize: 11, color: FoodColors.ink2 }} numberOfLines={1}>
            {h.customer_name || "Sem nome"}
            {h.address_summary ? "  ·  " + h.address_summary : ""}
          </Text>
          <Text style={{ fontSize: 10, color: FoodColors.ink3, marginTop: 2 }}>
            {new Date(h.dispatched_at).toLocaleString("pt-BR")}
            {h.delivered_at ? "  →  entregue em " + (h.duration_min ?? "?") + " min" : "  ·  em rota"}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ============================================================
// Subcomponentes utilitários
// ============================================================
function Field({ label, children, flex }: { label: string; children: any; flex?: boolean }) {
  return (
    <View style={{ flex: flex ? 1 : undefined }}>
      <Text style={{ fontSize: 10, color: FoodColors.ink3, fontWeight: "700",
        textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>{label}</Text>
      {children}
    </View>
  );
}

function Input({ value, onChange, placeholder, keyboardType }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  keyboardType?: "default" | "phone-pad" | "decimal-pad";
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={FoodColors.ink4}
      keyboardType={keyboardType || "default"}
      style={{
        backgroundColor: FoodColors.surface, borderRadius: 8, padding: 10,
        borderWidth: 1, borderColor: FoodColors.border, color: FoodColors.ink,
        fontSize: 13, flex: 1,
      }}
    />
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{
      paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8,
      backgroundColor: active ? FoodColors.redDim : FoodColors.surface,
      borderWidth: 1, borderColor: active ? FoodColors.red : FoodColors.border,
    }}>
      <Text style={{
        fontSize: 12, fontWeight: "600",
        color: active ? FoodColors.red : FoodColors.ink2,
      }}>{label}</Text>
    </Pressable>
  );
}

function Kpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{
      flex: 1, backgroundColor: FoodColors.surface, borderRadius: 8, padding: 10,
      borderWidth: 1, borderColor: FoodColors.border,
    }}>
      <Text style={{ fontSize: 9, color: FoodColors.ink3, textTransform: "uppercase",
        letterSpacing: 0.5, fontWeight: "600" }}>{label}</Text>
      <Text style={{ fontSize: 16, color, fontWeight: "800", marginTop: 2 }}>{value}</Text>
    </View>
  );
}

export default MotoboyDrawer;
