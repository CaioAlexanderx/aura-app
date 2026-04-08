import { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput } from "react-native";
import { Colors } from "@/constants/colors";

export function ScannerBar({ onScan }: { onScan: (code: string) => void }) {
  const [code, setCode] = useState("");
  function handleScan() { if (!code.trim()) return; onScan(code.trim()); setCode(""); }
  return (
    <View style={s.bar}>
      <TextInput style={s.input} placeholder="Codigo de barras ou QR..." placeholderTextColor={Colors.ink3} value={code} onChangeText={setCode} onSubmitEditing={handleScan} />
      <Pressable onPress={handleScan} style={s.btn}><Text style={s.btnText}>Buscar</Text></Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: "row", gap: 8, marginBottom: 16 },
  input: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, color: Colors.ink },
  btn: { backgroundColor: Colors.bg4, borderRadius: 10, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border },
  btnText: { fontSize: 12, color: Colors.ink, fontWeight: "600" },
});

export default ScannerBar;
