// ============================================================
// AURA. — A nota dos PRODUTOS na venda concluída (CP4b, 14/11/2026).
// Mockup aprovado "Venda concluída: notas" (KSY6Uh7rES7ZwcEqyvG2Vh):
//
//   caso 1 · sem CNPJ: NFC-e em destaque (como sempre, com a automática);
//            "Cliente precisa de NF-e? (empresa / CNPJ) →" abre o assistente
//   caso 2 · cliente com CNPJ: a NF-e vira a principal ("Sugerida") e a
//            NFC-e é a alternativa. A automática da NFC-e ESPERA (a nota
//            indicada é a NF-e, que a lojista confere no assistente)
//   caso 3 · produto + serviço: este bloco vai no cartão dos produtos
//   caso 4 · loja sem nota ativa: convite, nunca bloqueio (no NfceActions)
//
// Uma nota de produtos por venda: quando uma das duas sai, a outra some
// (o backend recusa a segunda com 409 de qualquer jeito).
// Regras puras em utils/nfe55.ts (notaSugerida, automaticaEspera).
// ============================================================
import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { NfceActions, type NfceActionsProps } from "@/components/screens/pdv/NfceActions";
import type { RespostaEmissao } from "@/services/nfe55Api";
import { automaticaEspera, notaSugerida } from "@/utils/nfe55";
import { Nfe55Wizard } from "./Nfe55Wizard";
import { abrirDanfe, baixarXml } from "./nfe55Acoes";
import { ConviteNotaFiscal } from "./ConviteNotaFiscal";

type Props = Omit<NfceActionsProps, "onEmitted"> & {
  /** CPF/CNPJ que a venda conhece (CPF na nota ou quem contratou). */
  documentoDoCliente?: string | null;
  saleNumber?: number | null;
  /** nfce_config.is_active da loja. undefined = ainda não se sabe (tela de sempre). */
  notaAtiva?: boolean;
};

export function NotaDeProdutosDaVenda(props: Props) {
  const { documentoDoCliente, saleNumber, notaAtiva, autoEmit, ...nfce } = props;
  const [assistente, setAssistente] = useState(false);
  const [nfe, setNfe] = useState<RespostaEmissao | null>(null);
  const [nfceSaiu, setNfceSaiu] = useState(false);

  if (notaAtiva === false) return <ConviteNotaFiscal />;

  const sugerida = notaSugerida(documentoDoCliente);
  const espera = automaticaEspera(!!autoEmit, documentoDoCliente);

  const wizard = assistente ? (
    <Nfe55Wizard
      visible
      companyId={nfce.companyId}
      saleId={nfce.saleId}
      saleNumber={saleNumber}
      onClose={() => setAssistente(false)}
      onEmitida={(r) => setNfe(r)}
    />
  ) : null;

  if (nfe) {
    return (
      <View style={st.ok} testID="venda-nfe-autorizada">
        <Text style={st.okT}>● NF-e nº {nfe.numero} autorizada</Text>
        <View style={st.acoes}>
          <Pressable style={st.btnS} onPress={() => abrirDanfe(nfce.companyId, nfe.nfe.id)} testID="venda-nfe-danfe"><Text style={st.btnST}>DANFE A4</Text></Pressable>
          <Pressable style={st.btnS} onPress={() => baixarXml(nfce.companyId, nfe.nfe.id, nfe.chave_acesso)} testID="venda-nfe-xml"><Text style={st.btnST}>XML</Text></Pressable>
        </View>
        {wizard}
      </View>
    );
  }

  if (sugerida === "nfe") {
    return (
      <View style={st.col} testID="venda-nota-nfe-sugerida">
        {!nfceSaiu && (
          <View style={[st.card, st.cardMain]}>
            <View style={st.head}>
              <View style={st.ico}><Text style={st.icoT}>55</Text></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={st.t}>Nota fiscal eletrônica (NF-e)</Text>
                <Text style={st.sub}>Sugerida: o cliente tem CNPJ</Text>
              </View>
              <View style={st.selo}><Text style={st.seloT}>Sugerida</Text></View>
            </View>
            <Text style={st.msg}>Já trazemos CNPJ, nome e endereço do cadastro. Você confere a Inscrição Estadual e emite.</Text>
            <Pressable style={st.btnP} onPress={() => setAssistente(true)} accessibilityRole="button" testID="venda-emitir-nfe">
              <Icon name="file_text" size={16} color="#fff" />
              <Text style={st.btnPT}>Emitir NF-e</Text>
            </Pressable>
            {espera ? <Text style={st.peq} testID="venda-automatica-esperou">A emissão automática da NFC-e esperou porque o cliente tem CNPJ.</Text> : null}
          </View>
        )}
        <View style={st.card} testID="venda-nfce-alternativa">
          <View style={st.head}>
            <View style={st.ico}><Text style={st.icoT}>65</Text></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={st.t}>Prefere o cupom fiscal (NFC-e)?</Text>
              <Text style={st.sub}>Também aceita o CNPJ do cliente, só na loja e dentro do estado.</Text>
            </View>
          </View>
          <NfceActions {...nfce} autoEmit={false} notaAtiva={notaAtiva} onEmitted={() => setNfceSaiu(true)} />
        </View>
        <Text style={st.um}>Uma venda tem uma nota para os produtos: NFC-e ou NF-e. As duas juntas contariam a mesma mercadoria duas vezes na Sefaz.</Text>
        {wizard}
      </View>
    );
  }

  return (
    <View style={st.col} testID="venda-nota-nfce">
      <NfceActions {...nfce} autoEmit={autoEmit} notaAtiva={notaAtiva} onEmitted={() => setNfceSaiu(true)} />
      {!nfceSaiu && (
        <Pressable style={st.link} onPress={() => setAssistente(true)} accessibilityRole="button" testID="venda-precisa-nfe">
          <Text style={st.linkT}>Cliente precisa de NF-e? (empresa / CNPJ) →</Text>
        </Pressable>
      )}
      {wizard}
    </View>
  );
}

const st = StyleSheet.create({
  col: { width: "100%", gap: 10 },
  card: { width: "100%", padding: 12, borderRadius: 12, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border, gap: 10 },
  cardMain: { borderColor: Colors.violet },
  head: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  ico: { width: 30, height: 30, borderRadius: 8, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center" },
  icoT: { fontSize: 11, fontWeight: "800", color: Colors.violet3 },
  t: { fontSize: 13, fontWeight: "800", color: Colors.ink },
  sub: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  selo: { backgroundColor: Colors.violet, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  seloT: { fontSize: 11, fontWeight: "700", color: "#fff" },
  msg: { fontSize: 12.5, color: Colors.ink2 },
  peq: { fontSize: 11.5, color: Colors.ink2 },
  btnP: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", minHeight: 46, borderRadius: 12, backgroundColor: Colors.violet },
  btnPT: { fontSize: 14, fontWeight: "700", color: "#fff" },
  um: { fontSize: 11.5, color: Colors.ink3, backgroundColor: Colors.bg3, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: Colors.border },
  link: { minHeight: 44, justifyContent: "center" },
  linkT: { fontSize: 13, fontWeight: "700", color: Colors.violet3 },
  ok: { width: "100%", gap: 8, padding: 12, borderRadius: 12, backgroundColor: "rgba(5,150,105,0.09)", borderWidth: 1, borderColor: "rgba(5,150,105,0.3)", alignItems: "center" },
  okT: { fontSize: 13, fontWeight: "700", color: Colors.green },
  acoes: { flexDirection: "row", gap: 8, width: "100%" },
  btnS: { flex: 1, minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg3, alignItems: "center", justifyContent: "center" },
  btnST: { fontSize: 12.5, fontWeight: "700", color: Colors.violet3 },
});
