// ============================================================================
// AURA. — Página Black Friday · "Promoção em lote" no consolidado (p-91)
//
// Achado do QA (09/11/2026): em "Todas as empresas" a seção sumia sem
// explicação. A promoção é por empresa, então no consolidado a seção fica no
// lugar de sempre como um cartão curto, que explica e troca a empresa ativa.
// O fluxo de troca é o mesmo do app (CompanyPickerModal + switchCompany, como
// em Notas fiscais › Certificado): no web a página recarrega e volta para
// /black-friday já na empresa escolhida. Nenhuma chamada de promoções aqui.
// ============================================================================
import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { CompanyPickerModal } from "@/components/CompanyPickerModal";

export var TEXTO_PROMOCAO_POR_EMPRESA = "A promoção é feita por empresa. Escolha a empresa para criar ou ver a promoção.";

type Props = {
  /** p-120: a mesma porta serve à campanha da loja online, com o texto dela. */
  texto?: string;
  acao?: string;
  testID?: string;
};

export function EscolherEmpresaParaPromocao({ texto, acao, testID }: Props = {}) {
  var base = testID || "promo-escolher-empresa";
  var { switchCompany, switching } = useAuthStore() as any;
  var [aberto, setAberto] = useState(false);

  function trocar(id: string) {
    setAberto(false);
    // Depois da troca, volta para esta página (não para o Painel).
    if (Platform.OS === "web" && typeof window !== "undefined") {
      try {
        var path = window.location.pathname + window.location.search;
        if (path && path !== "/") window.sessionStorage.setItem("aura_post_switch_redirect", path);
      } catch {}
    }
    Promise.resolve(switchCompany(id)).catch(function () {});
  }

  return (
    <View style={s.cartao} testID={base}>
      <Text style={s.txt}>{texto || TEXTO_PROMOCAO_POR_EMPRESA}</Text>
      <Pressable
        style={[s.btn, switching && { opacity: 0.6 }]}
        onPress={function () { setAberto(true); }}
        disabled={!!switching}
        testID={base + "-btn"}
        accessibilityRole="button"
      >
        <Text style={s.btnTxt}>{switching ? "Trocando..." : "Escolher empresa"}</Text>
      </Pressable>
      <CompanyPickerModal
        visible={aberto}
        context="black-friday-promocao"
        actionLabel={acao || "criar ou ver a promoção"}
        onPick={trocar}
        onCancel={function () { setAberto(false); }}
      />
    </View>
  );
}

var s = StyleSheet.create({
  cartao: {
    borderWidth: 1, borderStyle: "dashed", borderColor: Colors.border2, borderRadius: 12, padding: 16,
    flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 14,
  },
  txt: { flex: 1, minWidth: 200, fontSize: 13.5, color: Colors.ink2, lineHeight: 20 },
  btn: { minHeight: 44, borderRadius: 12, backgroundColor: Colors.violet, paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  btnTxt: { fontSize: 14, fontWeight: "700", color: "#fff" },
});
