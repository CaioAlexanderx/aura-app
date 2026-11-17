// ============================================================
// AURA. — Personalizados: a ficha técnica de um produto, em tela cheia (p-178)
//
// O editor é o do Studio, sem cópia: StudioFichaTecnicaPanel, o mesmo que o
// /studio monta na aba "Ficha Técnica" do produto. Aqui ele fica dentro de
// <TemaDoNegocio> (cores e tema do Negócio) e abre por cima de quem chamou:
//   - a aba Fichas Técnicas de /personalizados/insumos;
//   - a seção "Ficha técnica" do cadastro do item no Estoque.
//
// Web: WebPortal (o z-index:0 do RNW prende overlay fixo dentro do shell).
// Nativo: Modal em tela cheia.
//
// O painel precisa do customization_config do produto para a quantidade por
// opção (multiplicador por cor, tamanho...). No /studio ele vem na lista de
// produtos; aqui é lido antes de montar o painel, pela mesma rota que o
// editor de personalização usa. Se a leitura falhar o painel abre sem as
// opções: os multiplicadores já gravados continuam como estão ao salvar.
// ============================================================
import { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, Modal, StyleSheet, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { WebPortal } from "@/components/WebPortal";
import { studioApi } from "@/services/studioApi";
import StudioFichaTecnicaPanel from "@/components/studio/StudioFichaTecnicaPanel";
import { TemaDoNegocio } from "@/components/personalizados/TemaDoNegocio";
import { TEXTOS_DA_COMPOSICAO } from "@/components/personalizados/regrasDosInsumos";

type Props = {
  companyId: string;
  produtoId: string;
  nome: string;
  preco: number;
  /** Fecha a tela (quem chamou relê o que precisar). */
  onFechar: () => void;
  /** Ficha salva. */
  onSalvo?: () => void;
  /** Os atalhos "Ir pra Insumos" do painel. */
  aoIrParaInsumos: () => void;
};

export function ComposicaoEmTelaCheia(p: Props) {
  // undefined = lendo; null = sem config (ou a leitura falhou).
  const [config, setConfig] = useState<any>(undefined);

  useEffect(() => {
    let vivo = true;
    setConfig(undefined);
    studioApi.getCustomizationConfig(p.companyId, p.produtoId)
      .then((r) => { if (vivo) setConfig(r?.config ?? null); })
      .catch(() => { if (vivo) setConfig(null); });
    return () => { vivo = false; };
  }, [p.companyId, p.produtoId]);

  const tela = (
    <View style={st.tela} testID="editor-composicao">
      <View style={st.topo}>
        <Pressable
          testID="fechar-composicao"
          onPress={p.onFechar}
          accessibilityRole="button"
          accessibilityLabel={TEXTOS_DA_COMPOSICAO.voltar}
          style={st.voltar}
        >
          <Icon name="arrow-left" size={14} color={Colors.ink2} />
          <Text style={st.voltarTxt}>{TEXTOS_DA_COMPOSICAO.voltar}</Text>
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={st.titulo} numberOfLines={1}>{TEXTOS_DA_COMPOSICAO.titulo}</Text>
          <Text style={st.sub} numberOfLines={1}>{p.nome}</Text>
        </View>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={st.corpo} keyboardShouldPersistTaps="handled">
        <View style={st.largura}>
          {config === undefined ? (
            <Text style={st.sub} testID="composicao-lendo">Carregando…</Text>
          ) : (
            <TemaDoNegocio>
              <StudioFichaTecnicaPanel
                productId={p.produtoId}
                companyId={p.companyId}
                productName={p.nome}
                productPrice={p.preco}
                customizationConfig={config}
                onSaved={() => { if (p.onSalvo) p.onSalvo(); }}
                aoIrParaInsumos={p.aoIrParaInsumos}
              />
            </TemaDoNegocio>
          )}
        </View>
      </ScrollView>
    </View>
  );

  if (Platform.OS === "web") return <WebPortal active>{tela}</WebPortal>;
  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={p.onFechar}>
      {tela}
    </Modal>
  );
}

const st = StyleSheet.create({
  tela: { flex: 1, backgroundColor: Colors.bg, ...(Platform.OS === "web" ? { height: "100%" as any } : null) },
  topo: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.bg2,
  },
  voltar: {
    flexDirection: "row", alignItems: "center", gap: 6,
    minHeight: 44, paddingHorizontal: 12, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border2,
  },
  voltarTxt: { fontSize: 13, fontWeight: "600", color: Colors.ink2 },
  titulo: { fontSize: 16, fontWeight: "700", color: Colors.ink },
  sub: { fontSize: 12, color: Colors.ink3, marginTop: 2 },
  corpo: { padding: 16, paddingBottom: 48 },
  largura: { width: "100%", maxWidth: 960, alignSelf: "center" },
});
