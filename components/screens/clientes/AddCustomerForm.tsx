import { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, Dimensions } from "react-native";
import { Colors } from "@/constants/colors";
import { toast } from "@/components/Toast";
import type { Customer } from "./types";
import { maskPhone, maskDate } from "@/utils/masks";

const IS_WIDE = (typeof window !== "undefined" ? window.innerWidth : Dimensions.get("window").width) > 768;

function formatInstagram(v: string): string {
  const cleaned = v.replace(/\s/g, "");
  if (cleaned && !cleaned.startsWith("@")) return "@" + cleaned;
  return cleaned;
}

type Props = {
  onSave: (c: Customer) => void;
  onCancel: () => void;
  initialData?: Customer;
};

export function AddCustomerForm({ onSave, onCancel, initialData }: Props) {
  const isEdit = !!initialData;
  const [name, setName] = useState(initialData?.name || "");
  const [phone, setPhone] = useState(initialData?.phone || "");
  const [email, setEmail] = useState(initialData?.email || "");
  const [instagram, setInstagram] = useState(initialData?.instagram || "");
  const [birthday, setBirthday] = useState(initialData?.birthday || "");
  const [notes, setNotes] = useState(initialData?.notes || "");

  function handleSave() {
    if (!name.trim()) { toast.error("Preencha o nome"); return; }
    onSave({
      id: initialData?.id || Date.now().toString(),
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      instagram: instagram.trim(),
      birthday: birthday.trim(),
      lastPurchase: initialData?.lastPurchase || "---",
      totalSpent: initialData?.totalSpent || 0,
      visits: initialData?.visits || 0,
      firstVisit: initialData?.firstVisit || new Date().toLocaleDateString("pt-BR"),
      notes: notes.trim(),
      rating: initialData?.rating || null,
    });
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>{isEdit ? "Editar cliente" : "Adicionar cliente"}</Text>
        <Pressable onPress={onCancel} style={s.closeBtn}><Text style={s.closeText}>x</Text></Pressable>
      </View>
      <Text style={s.hint}>Campos com * sao obrigatorios.</Text>

      <Text style={s.label}>Nome completo *</Text>
      <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Ex: Maria da Silva" placeholderTextColor={Colors.ink3} />
      <View style={{ height: 16 }} />

      <View style={s.row2}>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Telefone / WhatsApp</Text>
          <TextInput style={s.input} value={phone} onChangeText={v => setPhone(maskPhone(v))} placeholder="(12) 99999-0000" placeholderTextColor={Colors.ink3} keyboardType="phone-pad" maxLength={15} />
          <View style={{ height: 16 }} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>E-mail</Text>
          <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="email@email.com" placeholderTextColor={Colors.ink3} keyboardType="email-address" autoCapitalize="none" />
          <View style={{ height: 16 }} />
        </View>
      </View>

      <View style={s.row2}>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Instagram</Text>
          <TextInput style={s.input} value={instagram} onChangeText={v => setInstagram(formatInstagram(v))} placeholder="@usuario" placeholderTextColor={Colors.ink3} autoCapitalize="none" />
          <View style={{ height: 16 }} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Aniversario (DD/MM ou DD/MM/AAAA)</Text>
          <TextInput style={s.input} value={birthday} onChangeText={v => setBirthday(maskDate(v))} placeholder="15/06" placeholderTextColor={Colors.ink3} keyboardType="number-pad" maxLength={10} />
          <View style={{ height: 16 }} />
        </View>
      </View>

      <Text style={s.label}>Observacoes</Text>
      <TextInput style={[s.input, { minHeight: 70, textAlignVertical: "top" }]} value={notes} onChangeText={setNotes} placeholder="Preferencias, alergias..." placeholderTextColor={Colors.ink3} multiline numberOfLines={3} />

      <View style={s.footer}>
        <Pressable onPress={onCancel} style={s.cancelBtn}><Text style={s.cancelText}>Cancelar</Text></Pressable>
        <Pressable onPress={handleSave} style={s.saveBtn}>
          <Text style={s.saveText}>{isEdit ? "Salvar alteracoes" : "Salvar cliente"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { backgroundColor: Colors.bg3, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: Colors.border2, marginBottom: 24 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  title: { fontSize: 20, color: Colors.ink, fontWeight: "700" },
  closeBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  closeText: { fontSize: 16, color: Colors.ink3, fontWeight: "600" },
  hint: { fontSize: 12, color: Colors.ink3, marginBottom: 16 },
  label: { fontSize: 12, color: Colors.ink3, fontWeight: "600", marginBottom: 6 },
  input: { backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, color: Colors.ink },
  row2: { flexDirection: IS_WIDE ? "row" : "column", gap: IS_WIDE ? 12 : 0 },
  footer: { flexDirection: "row", gap: 10, justifyContent: "flex-end", marginTop: 16 },
  cancelBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  cancelText: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  saveBtn: { backgroundColor: Colors.violet, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  saveText: { fontSize: 13, color: "#fff", fontWeight: "700" },
});

export default AddCustomerForm;
