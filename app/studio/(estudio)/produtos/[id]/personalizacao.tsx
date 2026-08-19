// ============================================================
// AURA STUDIO · /studio/produtos/[id]/personalizacao — REDIRECT
//
// Esta rota era o segundo editor de personalização. Gravava a mesma
// coluna `products.customization_config` que o painel do estoque, em
// outro formato, e nunca teve navegação apontando para ela — nenhum
// link, nenhuma entrada de NAV. Na prática só o painel era alcançável,
// e foi o painel que produziu a configuração que travou a compra na
// sheid-mania (F1 §3.1).
//
// O que era bom aqui não morreu: a forma do config virou
// components/studio/customizationConfig.ts, e as duas seções que só
// existiam nesta tela — serviço de arte e guia de medidas — foram para
// o painel, que é o editor canônico. Ver
// docs/studio/PERSONALIZACAO_CANONICA.md.
//
// A rota fica de pé como redirect porque pode haver link salvo: quem
// chegar aqui vai para o estoque, onde a personalização de fato mora.
// ============================================================
import { useEffect } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useStudioTokens } from "@/contexts/StudioThemeMode";

export default function PersonalizacaoRedirect() {
  const router = useRouter();
  const t = useStudioTokens();

  useEffect(() => {
    // replace, não push: esta tela não é um lugar para onde voltar.
    router.replace("/studio/estoque" as any);
  }, [router]);

  return (
    <View style={[styles.wrap, { backgroundColor: t.bg }]}>
      <ActivityIndicator color={t.primary} />
      <Text style={[styles.txt, { color: t.ink3 }]}>
        A personalização agora fica no Estoque, dentro do produto.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  txt: { fontSize: 13, fontWeight: "600", textAlign: "center" },
});
