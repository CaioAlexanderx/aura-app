// Verificação pública de certificado — /karate/verify/cert/[token]
// PÚBLICA (aberta via QR). Fica em app/karate/verify/* → bypass do AuthGuard.
// Consome GET /public/karate/verify/cert/:token e re-renderiza o certificado.
import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, StyleSheet, Platform, TouchableOpacity } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Icon } from "@/components/Icon";
import { KarateColors as P, KarateRadius, KarateFonts } from "@/constants/karateTheme";
import { karatePublicApi } from "@/services/karatePublicApi";
import { CertificatePreview, printCertificate } from "@/components/karate/certificado/CertificatePreview";
import type { CertData, CertTemplate } from "@/components/karate/certificado/buildCertificateHtml";

export default function VerifyCertScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [state, setState] = useState<"loading" | "valid" | "revoked" | "notfound" | "error">("loading");
  const [resp, setResp] = useState<any>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await karatePublicApi.verifyCert(String(token));
        if (!alive) return;
        if (r?.valid) { setResp(r); setState("valid"); }
        else if (r?.revoked) { setResp(r); setState("revoked"); }
        else setState("notfound");
      } catch (e: any) {
        if (!alive) return;
        setState(e?.status === 404 ? "notfound" : "error");
      }
    })();
    return () => { alive = false; };
  }, [token]);

  const verifyUrl = Platform.OS === "web" ? window.location.href : `https://app.getaura.com.br/karate/verify/cert/${token}`;
  const data: CertData | null = resp?.data ? { ...resp.data, verify_url: verifyUrl } : null;
  const template: CertTemplate | null = resp?.template || null;

  return (
    <ScrollView style={st.page} contentContainerStyle={st.wrap}>
      <View style={st.card}>
        {state === "loading" ? (
          <View style={{ padding: 40, alignItems: "center" }}><ActivityIndicator color={P.primary} /></View>
        ) : state === "valid" && data && template ? (
          <>
            <View style={st.badgeRow}>
              <View style={[st.glyph, { backgroundColor: P.okSoft }]}><Icon name="checkmark-circle" size={26} color={P.ok} /></View>
              <View style={{ flex: 1 }}>
                <Text style={st.title}>Certificado autêntico</Text>
                <Text style={st.sub}>Emitido por {resp.federation_name || "—"}{resp.issued_at ? ` · ${new Date(resp.issued_at).toLocaleDateString("pt-BR")}` : ""}</Text>
              </View>
            </View>
            <View style={{ alignItems: "center", marginTop: 6 }}>
              <CertificatePreview data={data} template={template} width={640} />
            </View>
            {Platform.OS === "web" ? (
              <TouchableOpacity style={st.btn} onPress={() => printCertificate(data, template)}>
                <Icon name="download" size={16} color="#fff" /><Text style={st.btnTxt}>Baixar / imprimir</Text>
              </TouchableOpacity>
            ) : null}
          </>
        ) : (
          <View style={st.errBlock}>
            <View style={[st.glyph, { backgroundColor: state === "revoked" ? P.warnSoft : P.dangerSoft }]}>
              <Icon name={state === "revoked" ? "alert_circle" : "close-circle"} size={26} color={state === "revoked" ? P.warn : P.red} />
            </View>
            <Text style={st.title}>{state === "revoked" ? "Certificado revogado" : "Certificado não encontrado"}</Text>
            <Text style={st.sub}>{state === "revoked" ? "Este certificado foi revogado pela federação." : "Não localizamos um certificado com este código. Verifique o QR."}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  page: { flex: 1, backgroundColor: P.bg },
  wrap: { alignItems: "center", padding: 20, paddingTop: 32, paddingBottom: 56 },
  card: { width: "100%", maxWidth: 760, backgroundColor: P.glass, borderWidth: 1, borderColor: P.border, borderRadius: KarateRadius.lg, padding: 20 },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  glyph: { width: 46, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: KarateFonts.heading, fontSize: 18, color: P.ink },
  sub: { fontSize: 12.5, color: P.ink3, marginTop: 3, lineHeight: 17 },
  errBlock: { alignItems: "center", gap: 10, paddingVertical: 20 },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: P.primary, borderRadius: 10, paddingVertical: 13, marginTop: 16 },
  btnTxt: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
