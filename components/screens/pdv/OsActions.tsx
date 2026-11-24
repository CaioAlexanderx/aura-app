// ============================================================
// AURA. — components/screens/pdv/OsActions.tsx
//
// Bloco de Ordem de Serviço na tela de sucesso da venda (SaleComplete),
// ao lado de "imprimir cupom" e "emitir NFC-e" — como pedido em 31/08.
//
// Como a OS nasce ANTES da venda, este bloco não cria OS nenhuma: ele
// procura as OS **prontas** do cliente da venda e oferece fechar o ciclo
// — entregar vinculando esta venda (sale_id) e imprimir o A4. É o momento
// real do balcão: o cliente veio buscar o aparelho e pagou agora.
//
// Silencioso por desenho: sem toggle, sem cliente na venda ou sem OS
// pronta, não renderiza nada — a tela de sucesso não ganha ruído pra
// quem não usa o módulo.
// ============================================================
import { useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform, ActivityIndicator } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { usePdvSettings } from "@/hooks/usePdvSettings";
import { serviceOrdersApi, printOs, type ServiceOrder } from "@/services/serviceOrdersApi";

const fmt = (n: number | string) => `R$ ${Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

type Props = {
  companyId: string;
  saleId: string;
  customerId?: string;
};

export function OsActions({ companyId, saleId, customerId }: Props) {
  const { settings } = usePdvSettings();
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [delivered, setDelivered] = useState<Record<string, boolean>>({});

  const reparoOn = settings.os_enabled === true;
  const oticaOn = settings.otica_enabled === true;
  const enabled = (reparoOn || oticaOn) && !!customerId;

  const { data, isLoading } = useQuery({
    queryKey: ["service-orders", companyId, "pronta", customerId, "caixa"],
    queryFn: () => serviceOrdersApi.list(companyId, { status: "pronta", customer_id: customerId }),
    enabled,
    staleTime: 0, // tela de sucesso: o estado do balcão é agora, não cache
  });

  if (!enabled) return null;
  // Reparo: como sempre. Ótica (p-208, 23/11/2026): SÓ a OS aberta SEM sinal
  // e sem venda — a venda deste Caixa é a primeira e única dela. A OS de
  // óculos COM sinal nunca entra aqui: o saldo dela já é parcela do crediário
  // da venda do sinal, e vincular esta venda cobraria o cliente duas vezes
  // (o backend também recusa, 409 OS_JA_TEM_VENDA). Ela é recebida na faixa
  // "Óculos deste cliente", sem venda nova.
  const orders: ServiceOrder[] = (data?.orders || []).filter((o: any) => {
    const kind = o.kind || "reparo";
    if (kind === "reparo") return reparoOn;
    return oticaOn && kind === "otica" && !o.deposit_sale_id && !o.sale_id;
  });
  if (!isLoading && orders.length === 0 && Object.keys(delivered).length === 0) return null;

  async function handleDeliver(os: ServiceOrder) {
    if (busyId) return;
    setBusyId(os.id);
    try {
      await serviceOrdersApi.setStatus(companyId, os.id, "entregue", { sale_id: saleId });
      setDelivered((prev) => ({ ...prev, [os.id]: true }));
      qc.invalidateQueries({ queryKey: ["service-orders"] });
      toast.success(`OS #${os.os_number} entregue e vinculada à venda`);
      if (Platform.OS === "web") printOs(companyId, os.id);
    } catch (err: any) {
      toast.error(err?.data?.error || "Erro ao entregar a OS");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View style={st.box} testID="os-actions">
      <View style={st.head}>
        <Icon name="tool" size={13} color={Colors.violet3} />
        <Text style={st.title}>Ordem de Serviço</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color={Colors.violet3} size="small" />
      ) : (
        orders.map((os) => {
          const done = delivered[os.id];
          return (
            <View key={os.id} style={st.row}>
              <View style={{ flex: 1 }}>
                <Text style={st.osLabel}>#{os.os_number} · {fmt(os.estimated_amount)}</Text>
                <Text style={st.osMeta} numberOfLines={1}>
                  {[os.equipment_type, os.equipment_brand, os.equipment_model].filter(Boolean).join(" ") || os.reported_issue}
                </Text>
              </View>
              {done ? (
                <Pressable onPress={() => printOs(companyId, os.id)} style={st.reprintBtn} testID={`os-reimprimir-${os.os_number}`}>
                  <Icon name="check" size={12} color={Colors.green} />
                  <Text style={st.reprintText}>Reimprimir</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => handleDeliver(os)}
                  style={[st.deliverBtn, busyId === os.id && { opacity: 0.6 }]}
                  disabled={busyId !== null}
                  testID={`os-entregar-${os.os_number}`}
                >
                  {busyId === os.id
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={st.deliverText}>Entregar e imprimir</Text>}
                </Pressable>
              )}
            </View>
          );
        })
      )}
      <Text style={st.hint}>Prontas deste cliente — entregar vincula a OS a esta venda.</Text>
    </View>
  );
}

const st = StyleSheet.create({
  box: { width: "100%", backgroundColor: Colors.bg4, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 12, marginTop: 12 },
  head: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  title: { fontSize: 11, color: Colors.ink3, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  osLabel: { fontSize: 13, color: Colors.ink, fontWeight: "700" },
  osMeta: { fontSize: 11, color: Colors.ink3, marginTop: 1 },
  deliverBtn: { backgroundColor: Colors.violet, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9 },
  deliverText: { fontSize: 12, color: "#fff", fontWeight: "700" },
  reprintBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: Colors.border2, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8 },
  reprintText: { fontSize: 12, color: Colors.ink, fontWeight: "600" },
  hint: { fontSize: 10, color: Colors.ink3, marginTop: 6 },
});

export default OsActions;
