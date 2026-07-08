// Meus certificados — página pública do participante (microsite da federação).
// Consulta por CPF e lista os certificados emitidos, com link p/ verificar/baixar.
import React, { useState } from "react";
import { View, Text, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, Platform } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Icon } from "@/components/Icon";
import { KarateColors as P, KarateRadius, KarateFonts } from "@/constants/karateTheme";
import { karatePublicApi } from "@/services/karatePublicApi";

function maskCpf(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}
const VERIFY = "https://app.getaura.com.br/karate/verify/cert";

export default function MeusCertificadosScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [cpf, setCpf] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [certs, setCerts] = useState<any[]>([]);
  const [fedName, setFedName] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const search = async () => {
    if (cpf.replace(/\D/g, "").length < 11) { setErr("Informe um CPF válido."); return; }
    setState("loading"); setErr(null);
    try {
      const r = await karatePublicApi.myCerts(String(slug), cpf.replace(/\D/g, ""));
      setCerts(r.certificates || []); setFedName(r.federation?.name || ""); setState("done");
    } catch (e: any) { setErr(e?.message ?? "Erro ao consultar."); setState("idle"); }
  };
  const open = (token: string) => { if (Platform.OS === "web") window.open(`${VERIFY}/${token}`, "_blank"); };

  return (
    <ScrollView style={st.page} contentContainerStyle={st.wrap}>
      <View style={st.card}>
        <View style={st.head}>
          <View style={[st.glyph, { backgroundColor: P.primarySoft }]}><Icon name="ribbon" size={22} color={P.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={st.title}>Meus certificados</Text>
            <Text style={st.sub}>Consulte pelo seu CPF os certificados emitidos.</Text>
          </View>
        </View>

        <Text style={st.lbl}>CPF</Text>
        <TextInput style={st.input} value={cpf} onChangeText={(v) => setCpf(maskCpf(v))} keyboardType="numeric"
          placeholder="000.000.000-00" placeholderTextColor={P.ink4} maxLength={14} />
        {err ? <Text style={st.err}>{err}</Text> : null}
        <TouchableOpacity style={st.btn} onPress={search} disabled={state === "loading"}>
          {state === "loading" ? <ActivityIndicator color="#fff" /> : <Text style={st.btnTxt}>Buscar certificados</Text>}
        </TouchableOpacity>

        {state === "done" ? (
          certs.length === 0 ? (
            <Text style={st.empty}>Nenhum certificado encontrado para este CPF{fedName ? ` na ${fedName}` : ""}.</Text>
          ) : (
            <View style={{ marginTop: 14 }}>
              {certs.map((c) => (
                <TouchableOpacity key={c.verify_token} style={st.row} onPress={() => open(c.verify_token)}>
                  <View style={[st.glyph2, { backgroundColor: P.okSoft }]}><Icon name="checkmark-circle" size={18} color={P.ok} /></View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={st.rowT} numberOfLines={2}>{c.course_name || "Certificado"}</Text>
                    <Text style={st.rowS}>Emitido em {c.issued_at ? new Date(c.issued_at).toLocaleDateString("pt-BR") : "—"}</Text>
                  </View>
                  <Icon name="chevron-forward" size={18} color={P.ink3} />
                </TouchableOpacity>
              ))}
            </View>
          )
        ) : null}
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  page: { flex: 1, backgroundColor: P.bg },
  wrap: { alignItems: "center", padding: 20, paddingTop: 32, paddingBottom: 56 },
  card: { width: "100%", maxWidth: 480, backgroundColor: P.glass, borderWidth: 1, borderColor: P.border, borderRadius: KarateRadius.lg, padding: 20 },
  head: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  glyph: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  glyph2: { width: 34, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: KarateFonts.heading, fontSize: 18, color: P.ink },
  sub: { fontSize: 12.5, color: P.ink3, marginTop: 2 },
  lbl: { fontSize: 11.5, color: P.ink3, marginTop: 14, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.3 },
  input: { borderWidth: 1, borderColor: P.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, color: P.ink, backgroundColor: P.bg },
  err: { color: P.red, fontSize: 12.5, marginTop: 8 },
  btn: { backgroundColor: P.primary, borderRadius: 10, paddingVertical: 13, alignItems: "center", marginTop: 14 },
  btnTxt: { color: "#fff", fontSize: 14, fontWeight: "700" },
  empty: { fontSize: 13, color: P.ink3, marginTop: 16, textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 12, borderTopWidth: 1, borderTopColor: P.border },
  rowT: { fontSize: 14, fontWeight: "600", color: P.ink },
  rowS: { fontSize: 12, color: P.ink3, marginTop: 2 },
});
