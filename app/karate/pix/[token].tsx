// ============================================================
// Página pública de pagamento PIX — Aura Karatê (Fase F4/PIX)
// Rota: /karate/pix/[token]  (PÚBLICA, sem login)
//
// Aberta a partir do botão "Ver QR grande e copiar o código" do e-mail de
// cobrança (karateBillingMailer.js/karateMailer.js no backend). Existe
// porque e-mail NÃO executa JavaScript — um botão "copiar" de verdade só
// existe fora do e-mail. Esta página é esse "fora do e-mail": mostra o QR
// grande (bom pra quem abriu no desktop e vai pagar pelo celular) e um
// botão de cópia que funciona de fato, com confirmação visual.
//
// Backend: GET /public/karate/pix/:token (karatePixPublic.js) — token
// stateless assinado (karatePixPublicToken.js). Bypass do AuthGuard em
// app/_layout.tsx via segments[1]==="pix" (mesmo padrão de roster-update/
// roster-self, que também não usam slug).
//
// CUIDADO DE PRIVACIDADE (decisão documentada no PR): a resposta do
// backend só tem valor, competência e o BR Code — NUNCA nome, CPF,
// telefone, e-mail ou qualquer id de dojô/praticante. Esta tela segue a
// mesma regra: não exibe (e não pede) nada além disso. Quem abre o link
// não precisa se identificar pra ver/pagar a própria cobrança.
//
// QR gerado CLIENT-SIDE (PixQRCode, já usa react-native-qrcode-svg — sem
// dependência nova, sem endpoint de imagem no backend).
// ============================================================
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Platform,
  Clipboard,
  Linking,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Icon } from "@/components/Icon";
import { KarateColors, ShojiPalette, KarateRadius, KarateFonts } from "@/constants/karateTheme";
import { PixQRCode } from "@/components/karate/PixQRCode";
import { karatePublicApi, PixPublicData } from "@/services/karatePublicApi";

const C = KarateColors;
const P = ShojiPalette;

function fmtBRL(v: number): string {
  return (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function PixPublicScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [data, setData] = useState<PixPublicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    karatePublicApi
      .getPixPublic(String(token || ""))
      .then((d) => { if (alive) setData(d); })
      .catch(() => { if (alive) setNotFound(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [token]);

  const handleCopy = useCallback(() => {
    if (!data) return;
    if (Platform.OS === "web") {
      navigator.clipboard?.writeText(data.pix_code).catch(() => {
        Clipboard.setString(data.pix_code);
      });
    } else {
      Clipboard.setString(data.pix_code);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }, [data]);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.wrap}>
      {loading ? (
        <View style={{ paddingVertical: 60 }}>
          <ActivityIndicator color={C.primary} />
        </View>
      ) : notFound || !data ? (
        <View style={styles.card}>
          <View style={styles.nfGlyph}>
            <Icon name="alert-circle" size={30} color={C.ink3} />
          </View>
          <Text style={styles.nfH}>Link não disponível</Text>
          <Text style={styles.nfP}>
            Este link de pagamento não é válido ou expirou. Peça um novo e-mail de cobrança
            ou fale com a federação.
          </Text>
        </View>
      ) : (
        <View style={styles.card}>
          <View style={styles.redBar} />

          <View style={styles.head}>
            <Text style={styles.eyebrow}>Cobrança de anuidade</Text>
            <Text style={styles.competencia}>Competência {data.reference_period}</Text>
            <Text style={styles.amount}>{fmtBRL(data.amount)}</Text>
          </View>

          <View style={styles.qrWrap}>
            <PixQRCode payload={data.pix_code} size={220} />
          </View>

          <Text style={styles.codeLabel}>PIX copia e cola</Text>
          <View style={styles.codeBox}>
            <Text style={styles.codeText} selectable accessibilityLabel={`Código PIX: ${data.pix_code}`}>
              {data.pix_code}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.copyBtn, copied && styles.copyBtnDone]}
            onPress={handleCopy}
            accessibilityRole="button"
            accessibilityLabel={copied ? "Código copiado" : "Copiar código PIX"}
          >
            <Icon name={copied ? "checkmark-circle" : "copy-outline"} size={16} color={copied ? P.ok : "#fff"} />
            <Text style={[styles.copyBtnLabel, copied && styles.copyBtnLabelDone]}>
              {copied ? "Código copiado!" : "Copiar código PIX"}
            </Text>
          </TouchableOpacity>

          <Text style={styles.hint}>
            Abra o app do seu banco, escolha pagar com PIX e escaneie o QR acima ou cole o
            código copiado.
          </Text>
        </View>
      )}

      <TouchableOpacity style={styles.auraFooter} onPress={() => Linking.openURL("https://www.getaura.com.br")} accessibilityRole="link">
        <View style={styles.footSeal}>
          <Text style={styles.footSealK}>空</Text>
        </View>
        <View>
          <Text style={styles.footWm}>Aura · Karatê</Text>
          <Text style={styles.footSub}>Pagamento seguro via PIX</Text>
        </View>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg } as ViewStyle,
  wrap: { alignItems: "center", padding: 20, paddingTop: 40, paddingBottom: 56 } as ViewStyle,

  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: KarateRadius.lg,
    overflow: "hidden",
    alignItems: "center",
    paddingBottom: 24,
    ...Platform.select({
      web: { boxShadow: "0 16px 40px rgba(28,23,20,0.14)" } as any,
      default: { shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.14, shadowRadius: 22, elevation: 5 },
    }),
  } as ViewStyle,

  redBar: { width: "100%", height: 4, backgroundColor: "#b02a2a" } as ViewStyle,

  head: { alignItems: "center", paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8, gap: 4 } as ViewStyle,
  eyebrow: {
    fontFamily: KarateFonts.body,
    fontSize: 11,
    fontWeight: "700",
    color: C.ink3,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  } as TextStyle,
  competencia: { fontFamily: KarateFonts.body, fontSize: 13, color: C.ink2 } as TextStyle,
  amount: {
    fontFamily: KarateFonts.serif,
    fontSize: 34,
    fontWeight: "700",
    color: C.ink,
    marginTop: 4,
  } as TextStyle,

  qrWrap: { marginTop: 18, marginBottom: 8 } as ViewStyle,

  codeLabel: {
    alignSelf: "flex-start",
    marginLeft: 24,
    marginTop: 10,
    fontFamily: KarateFonts.body,
    fontSize: 11,
    fontWeight: "800",
    color: C.ink,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  } as TextStyle,
  codeBox: {
    width: "100%",
    paddingHorizontal: 24,
    marginTop: 6,
  } as ViewStyle,
  codeText: {
    fontFamily: KarateFonts.mono,
    fontSize: 11.5,
    lineHeight: 17,
    color: C.ink2,
    backgroundColor: C.bg2,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: KarateRadius.sm,
    padding: 10,
  } as TextStyle,

  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
    marginHorizontal: 24,
    alignSelf: "stretch",
    borderRadius: KarateRadius.md,
    paddingVertical: 13,
    backgroundColor: "#b02a2a",
  } as ViewStyle,
  copyBtnDone: {
    backgroundColor: P.okSoft,
  } as ViewStyle,
  copyBtnLabel: {
    fontFamily: KarateFonts.body,
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
  } as TextStyle,
  copyBtnLabelDone: {
    color: P.ok,
  } as TextStyle,

  hint: {
    fontFamily: KarateFonts.body,
    fontSize: 11.5,
    color: C.ink3,
    textAlign: "center",
    lineHeight: 16,
    marginTop: 14,
    paddingHorizontal: 24,
  } as TextStyle,

  nfGlyph: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.bg2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 28,
  } as ViewStyle,
  nfH: { fontFamily: KarateFonts.heading, fontSize: 18, fontWeight: "700", color: C.ink, marginTop: 14 } as TextStyle,
  nfP: {
    fontFamily: KarateFonts.body,
    fontSize: 13,
    color: C.ink3,
    textAlign: "center",
    lineHeight: 19,
    paddingHorizontal: 28,
    paddingTop: 6,
    paddingBottom: 28,
  } as TextStyle,

  auraFooter: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 28 } as ViewStyle,
  footSeal: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.ink,
    alignItems: "center",
    justifyContent: "center",
  } as ViewStyle,
  footSealK: { color: "#fff", fontSize: 14, fontFamily: KarateFonts.serif } as TextStyle,
  footWm: { fontFamily: KarateFonts.body, fontSize: 12, fontWeight: "700", color: C.ink } as TextStyle,
  footSub: { fontFamily: KarateFonts.body, fontSize: 10.5, color: C.ink3 } as TextStyle,
});
