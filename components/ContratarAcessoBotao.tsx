// ============================================================
// AURA. — Botão "Contratar acesso" no limite de funcionários (p-106)
//
// Fica sob "Limite de funcionários atingido…" na Equipe. O destino depende
// da conta (utils/contratarAcesso): checkout com o seletor, cartão do acesso
// de funcionário para a temporada na página Black Friday ou o WhatsApp de
// ajuda. A conta é por empresa: no modo consolidado (sem empresa) não há
// botão.
//
// Plano velho no JWT (armadilha 1 do CLAUDE.md): relê o /auth/me ao montar,
// porque o destino depende do billing_status da conta. O valor combinado vem
// do /billing/quote (custom), a mesma cotação que o checkout abre.
// ============================================================
import { useEffect } from "react";
import { Pressable, Text, StyleSheet, Linking } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { billingApi } from "@/services/billingApi";
import { useVisibleModules } from "@/hooks/useVisibleModules";
import { useBlackFridayLiberada } from "@/hooks/useBlackFridayLiberada";
import { BLACK_FRIDAY_MOD } from "@/constants/blackFriday";
import { assentoTemporadaVisivel } from "@/components/screens/configuracoes/assentoTemporada";
import { destinoDoContratarAcesso, TEXTO_CONTRATAR_ACESSO } from "@/utils/contratarAcesso";

export function ContratarAcessoBotao() {
  const auth = useAuthStore() as any;
  const company = auth.company;
  const refreshMe = auth.refreshMe;
  const visible = useVisibleModules();
  const liberada = useBlackFridayLiberada();

  useEffect(() => {
    if (typeof refreshMe !== "function") return;
    try { Promise.resolve(refreshMe()).catch(() => {}); } catch { /* o /me se atualiza no próximo mount */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const plano = String(company?.plan || "").toLowerCase();
  const ciclo = String(company?.billing_cycle || "").toLowerCase() === "annual" ? "annual" : "monthly";
  const planoValido = plano === "essencial" || plano === "negocio" || plano === "expansao";
  // Mesma chave de cache da cotação do checkout (Pix, extra_seats=0).
  const { data: cotacao } = useQuery({
    queryKey: ["billing-quote", company?.id, plano, ciclo, "pix", 0],
    queryFn: () => billingApi.quote(company!.id, plano, ciclo, "PIX", 0),
    enabled: !!company?.id && planoValido && !auth.isDemo,
    retry: false, staleTime: 30000,
  });

  if (!company?.id || auth.isDemo) return null;

  const destino = destinoDoContratarAcesso({
    emDia: company?.billing_status === "active",
    combinado: !!cotacao && cotacao.custom === true,
    temporada: liberada && assentoTemporadaVisivel() && visible.has(BLACK_FRIDAY_MOD),
  });

  function abrir() {
    if (destino.tipo === "whatsapp") {
      Linking.openURL(destino.url).catch(() => { /* sem app de WhatsApp: nada a fazer */ });
      return;
    }
    router.push(destino.rota as any);
  }

  return (
    <Pressable testID="equipe-contratar-acesso" onPress={abrir} accessibilityRole="button" style={s.btn}>
      <Text style={s.txt}>{TEXTO_CONTRATAR_ACESSO}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: { alignSelf: "center", marginTop: 8, minHeight: 36, justifyContent: "center", backgroundColor: Colors.violet, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14 },
  txt: { fontSize: 12.5, color: "#fff", fontWeight: "600" },
});
