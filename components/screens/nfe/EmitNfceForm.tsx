import { useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, ScrollView } from "react-native";
import { Colors } from "@/constants/colors";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { nfceApi, type NfceEmissionItem } from "@/services/nfceApi";
import { ns } from "./shared";

// Forma de pagamento → código tPag enviado pro backend.
// Backend mapeia via paymentCode() e Nuvem Fiscal espera tabela SEFAZ.
const PAGAMENTOS = [
  { key: "dinheiro", label: "Dinheiro" },
  { key: "pix",      label: "Pix"      },
  { key: "credito",  label: "Crédito"  },
  { key: "debito",   label: "Débito"   },
  { key: "outros",   label: "Outros"   },
];

type ItemRow = NfceEmissionItem & { _id: string };

function newItemRow(): ItemRow {
  return {
    _id: Math.random().toString(36).slice(2),
    product_name: "",
    quantity: 1,
    unit_price: 0,
    ncm: "00000000",
    cfop: "5102",
    unit: "UN",
  };
}

const fmtBR = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function EmitNfceForm({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<"nfce" | "nfe">("nfce");
  const [items, setItems] = useState<ItemRow[]>([newItemRow()]);
  const [cpf, setCpf] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("dinheiro");
  const [paymentChange, setPaymentChange] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const total = useMemo(
    () => items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0),
    [items]
  );

  const emitMut = useMutation({
    mutationFn: (body: any) => nfceApi.emit(companyId, body),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["nfce-emissions", companyId] });
      const labelTipo = res.tipo === "nfe" ? "NF-e" : "NFC-e";
      toast.success(
        res.nfce.status === "autorizada"
          ? `${labelTipo} #${res.nfce.numero} autorizada!`
          : `${labelTipo} #${res.nfce.numero} ${res.nfce.status}`
      );
      // reset
      setItems([newItemRow()]);
      setCpf(""); setCnpj(""); setCustomerName(""); setObservacoes("");
    },
    onError: (err: any) => {
      // Backend devolve { error, payload, nfce_id } em rejeição da Nuvem Fiscal
      const detail = err?.data?.payload
        ? ` (campo: ${err.data.payload?.erros?.[0]?.campo || "?"})`
        : "";
      toast.error((err?.message || "Erro ao emitir nota") + detail);
    },
  });

  function updateItem(id: string, patch: Partial<ItemRow>) {
    setItems(prev => prev.map(it => (it._id === id ? { ...it, ...patch } : it)));
  }
  function removeItem(id: string) {
    setItems(prev => (prev.length === 1 ? prev : prev.filter(it => it._id !== id)));
  }

  function handleEmit() {
    // Validação local antes do POST
    const cleanItems = items
      .filter(i => (i.product_name || "").trim() && Number(i.quantity) > 0 && Number(i.unit_price) > 0)
      .map(({ _id, ...rest }) => rest);

    if (!cleanItems.length) { toast.error("Adicione ao menos um item válido (nome, qty, preço)"); return; }
    if (tipo === "nfe" && !cpf.replace(/\D/g, "") && !cnpj.replace(/\D/g, "")) {
      toast.error("NF-e exige CPF ou CNPJ do destinatário"); return;
    }

    emitMut.mutate({
      items: cleanItems,
      tipo,
      customer_cpf:   cpf.replace(/\D/g, "") || undefined,
      recipient_cnpj: cnpj.replace(/\D/g, "") || undefined,
      customer_name:  customerName.trim() || undefined,
      payment_method: paymentMethod,
      payment_change: paymentChange ? Number(paymentChange.replace(",", ".")) : undefined,
      observacoes:    observacoes.trim() || undefined,
    });
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={ns.formCard}>
        <Text style={ns.formTitle}>Emitir nota fiscal</Text>
        <Text style={ns.formHint}>
          NFC-e (modelo 65) é o padrão para venda direta ao consumidor. Use NF-e (modelo 55)
          quando o cliente exigir nota com CNPJ.
        </Text>

        {/* Toggle tipo */}
        <View style={{ flexDirection: "row", gap: 6, marginTop: 12, marginBottom: 8 }}>
          {(["nfce", "nfe"] as const).map(k => (
            <Pressable key={k} onPress={() => setTipo(k)}
              style={[ns.chip, tipo === k && ns.chipActive, { flex: 1, alignItems: "center" }]}>
              <Text style={[ns.chipText, tipo === k && ns.chipTextActive]}>
                {k === "nfce" ? "NFC-e (consumidor)" : "NF-e (B2B)"}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Items */}
        <Text style={ns.fLabel}>Itens da venda</Text>
        {items.map((it, idx) => (
          <View key={it._id} style={{
            backgroundColor: Colors.bg4, borderRadius: 12, padding: 12, marginBottom: 8,
            borderWidth: 1, borderColor: Colors.border,
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
              <Text style={{ fontSize: 11, color: Colors.ink3, fontWeight: "600", flex: 1 }}>
                Item {idx + 1}
              </Text>
              {items.length > 1 && (
                <Pressable onPress={() => removeItem(it._id)} hitSlop={8}>
                  <Icon name="trash" size={14} color={Colors.red} />
                </Pressable>
              )}
            </View>

            <TextInput style={[ns.fInput, { marginBottom: 6 }]}
              value={it.product_name} onChangeText={v => updateItem(it._id, { product_name: v })}
              placeholder="Descrição do produto/serviço" placeholderTextColor={Colors.ink3} />

            <View style={{ flexDirection: "row", gap: 6 }}>
              <View style={{ flex: 1 }}>
                <Text style={ns.fLabel}>Qty</Text>
                <TextInput style={ns.fInput}
                  value={String(it.quantity)} onChangeText={v => updateItem(it._id, { quantity: Number(v.replace(",", ".")) || 0 })}
                  placeholder="1" placeholderTextColor={Colors.ink3} keyboardType="decimal-pad" />
              </View>
              <View style={{ flex: 2 }}>
                <Text style={ns.fLabel}>Preço unit.</Text>
                <TextInput style={ns.fInput}
                  value={it.unit_price ? String(it.unit_price) : ""}
                  onChangeText={v => updateItem(it._id, { unit_price: Number(v.replace(",", ".")) || 0 })}
                  placeholder="0,00" placeholderTextColor={Colors.ink3} keyboardType="decimal-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={ns.fLabel}>Subtotal</Text>
                <View style={[ns.fInput, { justifyContent: "center" }]}>
                  <Text style={{ fontSize: 13, color: Colors.ink, fontWeight: "600" }}>
                    {fmtBR((Number(it.quantity) || 0) * (Number(it.unit_price) || 0))}
                  </Text>
                </View>
              </View>
            </View>

            {/* Avançado por item: NCM, CFOP, Unidade */}
            {showAdvanced && (
              <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
                <View style={{ flex: 1 }}>
                  <Text style={ns.fLabel}>NCM</Text>
                  <TextInput style={ns.fInput}
                    value={it.ncm || ""} onChangeText={v => updateItem(it._id, { ncm: v.replace(/\D/g, "").slice(0, 8) })}
                    placeholder="00000000" placeholderTextColor={Colors.ink3} keyboardType="number-pad" maxLength={8} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ns.fLabel}>CFOP</Text>
                  <TextInput style={ns.fInput}
                    value={it.cfop || ""} onChangeText={v => updateItem(it._id, { cfop: v.replace(/\D/g, "").slice(0, 4) })}
                    placeholder="5102" placeholderTextColor={Colors.ink3} keyboardType="number-pad" maxLength={4} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ns.fLabel}>Unid</Text>
                  <TextInput style={ns.fInput}
                    value={it.unit || ""} onChangeText={v => updateItem(it._id, { unit: v.toUpperCase().slice(0, 6) })}
                    placeholder="UN" placeholderTextColor={Colors.ink3} maxLength={6} />
                </View>
              </View>
            )}
          </View>
        ))}

        <View style={{ flexDirection: "row", gap: 6, marginBottom: 8 }}>
          <Pressable onPress={() => setItems(prev => [...prev, newItemRow()])}
            style={[ns.configBtn, { flex: 1, alignItems: "center" }]}>
            <Text style={ns.configBtnText}>+ Adicionar item</Text>
          </Pressable>
          <Pressable onPress={() => setShowAdvanced(v => !v)}
            style={[ns.configBtn, { alignItems: "center" }]}>
            <Text style={ns.configBtnText}>{showAdvanced ? "Ocultar" : "NCM/CFOP"}</Text>
          </Pressable>
        </View>

        {/* Destinatário */}
        <Text style={[ns.fLabel, { marginTop: 12 }]}>Destinatário {tipo === "nfce" ? "(opcional)" : "(obrigatório)"}</Text>
        <View style={ns.formRow}>
          <View style={{ flex: 1 }}>
            <Text style={ns.fLabel}>{tipo === "nfe" ? "CPF ou CNPJ" : "CPF"}</Text>
            <TextInput style={ns.fInput}
              value={tipo === "nfe" && !cpf ? cnpj : cpf}
              onChangeText={v => { tipo === "nfe" && v.replace(/\D/g, "").length > 11 ? (setCnpj(v), setCpf("")) : (setCpf(v), setCnpj("")); }}
              placeholder={tipo === "nfe" ? "CPF ou CNPJ" : "000.000.000-00"} placeholderTextColor={Colors.ink3} keyboardType="number-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={ns.fLabel}>Nome</Text>
            <TextInput style={ns.fInput}
              value={customerName} onChangeText={setCustomerName}
              placeholder="Cliente" placeholderTextColor={Colors.ink3} />
          </View>
        </View>

        {/* Pagamento */}
        <Text style={[ns.fLabel, { marginTop: 12 }]}>Pagamento</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
          {PAGAMENTOS.map(p => (
            <Pressable key={p.key} onPress={() => setPaymentMethod(p.key)}
              style={[ns.chip, paymentMethod === p.key && ns.chipActive]}>
              <Text style={[ns.chipText, paymentMethod === p.key && ns.chipTextActive]}>{p.label}</Text>
            </Pressable>
          ))}
        </View>
        {paymentMethod === "dinheiro" && (
          <View style={{ marginTop: 6 }}>
            <Text style={ns.fLabel}>Troco (opcional)</Text>
            <TextInput style={ns.fInput}
              value={paymentChange} onChangeText={setPaymentChange}
              placeholder="0,00" placeholderTextColor={Colors.ink3} keyboardType="decimal-pad" />
          </View>
        )}

        {/* Observações */}
        <Text style={[ns.fLabel, { marginTop: 12 }]}>Observações (opcional)</Text>
        <TextInput style={[ns.fInput, { minHeight: 60 }]} multiline
          value={observacoes} onChangeText={setObservacoes}
          placeholder="Aparece no infCpl da nota" placeholderTextColor={Colors.ink3} />

        {/* Total + emitir */}
        <View style={{
          flexDirection: "row", alignItems: "center", marginTop: 16,
          paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border,
        }}>
          <Text style={{ flex: 1, fontSize: 12, color: Colors.ink3, fontWeight: "600" }}>Total</Text>
          <Text style={{ fontSize: 22, fontWeight: "800", color: Colors.ink }}>{fmtBR(total)}</Text>
        </View>

        <Pressable onPress={handleEmit} disabled={emitMut.isPending || total <= 0}
          style={[ns.emitBtn, (emitMut.isPending || total <= 0) && { opacity: 0.55 }]}>
          {emitMut.isPending
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={ns.emitBtnText}>Emitir {tipo === "nfe" ? "NF-e" : "NFC-e"}</Text>}
        </Pressable>
      </View>
    </ScrollView>
  );
}
