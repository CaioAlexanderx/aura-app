import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { nfeApi } from "@/services/api";
import { toast } from "@/components/Toast";
import { ns } from "./shared";

export function EmitNfceForm({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const [cpf, setCpf] = useState("");
  const [totalValue, setTotalValue] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("pix");

  const emitMut = useMutation({
    mutationFn: (body: any) => nfeApi.emitNfce(companyId, body),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ["nfe-docs", companyId] }); toast.success(`NFC-e ${res.status === "authorized" ? "autorizada" : "enviada"}!`); setCpf(""); setTotalValue(""); },
    onError: (err: any) => toast.error(err?.message || "Erro ao emitir NFC-e"),
  });

  function handleEmit() {
    if (!totalValue.trim() || parseFloat(totalValue) <= 0) { toast.error("Valor total obrigatorio"); return; }
    emitMut.mutate({ recipient_cpf: cpf.replace(/\D/g, "") || undefined, items: [{ description: "Venda PDV", quantity: 1, unit_value: parseFloat(totalValue.replace(",", ".")) }], total_value: parseFloat(totalValue.replace(",", ".")), payment_method: paymentMethod });
  }

  return (
    <View style={ns.formCard}>
      <Text style={ns.formTitle}>Emitir NFC-e (Nota de Consumidor)</Text>
      <Text style={ns.formHint}>Para vendas no varejo. O CPF do consumidor e opcional.</Text>
      <View style={ns.formRow}>
        <View style={{ flex: 1 }}><Text style={ns.fLabel}>CPF do consumidor (opcional)</Text><TextInput style={ns.fInput} value={cpf} onChangeText={setCpf} placeholder="000.000.000-00" placeholderTextColor={Colors.ink3} keyboardType="number-pad" /></View>
        <View style={{ flex: 1 }}><Text style={ns.fLabel}>Valor total (R$) *</Text><TextInput style={ns.fInput} value={totalValue} onChangeText={setTotalValue} placeholder="0,00" placeholderTextColor={Colors.ink3} keyboardType="decimal-pad" /></View>
      </View>
      <View style={ns.formRow}>
        <View style={{ flex: 1 }}>
          <Text style={ns.fLabel}>Pagamento</Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {["pix", "dinheiro", "cartao", "debito"].map(m => <Pressable key={m} onPress={() => setPaymentMethod(m)} style={[ns.chip, paymentMethod === m && ns.chipActive]}><Text style={[ns.chipText, paymentMethod === m && ns.chipTextActive]}>{m.charAt(0).toUpperCase() + m.slice(1)}</Text></Pressable>)}
          </View>
        </View>
      </View>
      <Pressable onPress={handleEmit} disabled={emitMut.isPending} style={[ns.emitBtn, emitMut.isPending && { opacity: 0.6 }]}>{emitMut.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={ns.emitBtnText}>Emitir NFC-e</Text>}</Pressable>
    </View>
  );
}
