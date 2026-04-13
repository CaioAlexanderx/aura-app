import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { nfeApi } from "@/services/api";
import { toast } from "@/components/Toast";
import { ns } from "./shared";

export function EmitNfseForm({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const [recipientName, setRecipientName] = useState("");
  const [recipientDoc, setRecipientDoc] = useState("");
  const [description, setDescription] = useState("");
  const [serviceCode, setServiceCode] = useState("");
  const [value, setValue] = useState("");
  const [issRate, setIssRate] = useState("2");
  const [recipientEmail, setRecipientEmail] = useState("");

  const emitMut = useMutation({
    mutationFn: (body: any) => nfeApi.emitNfse(companyId, body),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ["nfe-docs", companyId] }); toast.success(`NFS-e ${res.status === "authorized" ? "autorizada" : "enviada para processamento"}!`); setRecipientName(""); setRecipientDoc(""); setDescription(""); setValue(""); setRecipientEmail(""); },
    onError: (err: any) => toast.error(err?.message || "Erro ao emitir NFS-e"),
  });

  function handleEmit() {
    if (!description.trim()) { toast.error("Descricao do servico obrigatoria"); return; }
    if (!value.trim() || parseFloat(value) <= 0) { toast.error("Valor obrigatorio"); return; }
    emitMut.mutate({ recipient_name: recipientName.trim() || undefined, recipient_cnpj: recipientDoc.replace(/\D/g, "").length === 14 ? recipientDoc.replace(/\D/g, "") : undefined, recipient_cpf: recipientDoc.replace(/\D/g, "").length === 11 ? recipientDoc.replace(/\D/g, "") : undefined, recipient_email: recipientEmail.trim() || undefined, description: description.trim(), service_code: serviceCode.trim() || undefined, value: parseFloat(value.replace(",", ".")), iss_rate: parseFloat(issRate.replace(",", ".")) || 2 });
  }

  return (
    <View style={ns.formCard}>
      <Text style={ns.formTitle}>Emitir NFS-e (Nota de Servico)</Text>
      <Text style={ns.formHint}>Preencha os dados do servico prestado. O tomador e opcional.</Text>
      <View style={ns.formRow}>
        <View style={{ flex: 1 }}><Text style={ns.fLabel}>Nome do tomador</Text><TextInput style={ns.fInput} value={recipientName} onChangeText={setRecipientName} placeholder="Razao social ou nome" placeholderTextColor={Colors.ink3} /></View>
        <View style={{ flex: 1 }}><Text style={ns.fLabel}>CNPJ/CPF do tomador</Text><TextInput style={ns.fInput} value={recipientDoc} onChangeText={setRecipientDoc} placeholder="00.000.000/0001-00" placeholderTextColor={Colors.ink3} keyboardType="number-pad" /></View>
      </View>
      <View style={ns.formRow}><View style={{ flex: 2 }}><Text style={ns.fLabel}>Descricao do servico *</Text><TextInput style={[ns.fInput, { minHeight: 60 }]} value={description} onChangeText={setDescription} placeholder="Descreva o servico prestado..." placeholderTextColor={Colors.ink3} multiline /></View></View>
      <View style={ns.formRow}>
        <View style={{ flex: 1 }}><Text style={ns.fLabel}>Codigo do servico</Text><TextInput style={ns.fInput} value={serviceCode} onChangeText={setServiceCode} placeholder="Ex: 1.05" placeholderTextColor={Colors.ink3} /></View>
        <View style={{ flex: 1 }}><Text style={ns.fLabel}>Valor (R$) *</Text><TextInput style={ns.fInput} value={value} onChangeText={setValue} placeholder="0,00" placeholderTextColor={Colors.ink3} keyboardType="decimal-pad" /></View>
        <View style={{ flex: 1 }}><Text style={ns.fLabel}>ISS (%)</Text><TextInput style={ns.fInput} value={issRate} onChangeText={setIssRate} placeholder="2" placeholderTextColor={Colors.ink3} keyboardType="decimal-pad" /></View>
      </View>
      <View style={ns.formRow}><View style={{ flex: 1 }}><Text style={ns.fLabel}>E-mail do tomador (envio automatico)</Text><TextInput style={ns.fInput} value={recipientEmail} onChangeText={setRecipientEmail} placeholder="cliente@empresa.com" placeholderTextColor={Colors.ink3} autoCapitalize="none" keyboardType="email-address" /></View></View>
      <Pressable onPress={handleEmit} disabled={emitMut.isPending} style={[ns.emitBtn, emitMut.isPending && { opacity: 0.6 }]}>{emitMut.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={ns.emitBtnText}>Emitir NFS-e</Text>}</Pressable>
    </View>
  );
}
