// ============================================================
// AURA. — Estoque · "Cadastrar vários" dentro do "+ Produto" (E2, 17/11/2026)
//
// Mockup aprovado: estoque-portas-mockup-17-11.html, partes 2 e 3. Textos
// aprovados pelo Caio em 17/11 (Fase 1).
//
// A barra do Estoque perdeu "+ Em lote" (E1). Quem tem muitos produtos
// para cadastrar abre "+ Produto" e acha a saída ali, numa faixa logo
// abaixo do cabeçalho. Tocar nela troca o miolo do mesmo modal (padrão
// TrocaModal: o cabeçalho muda, o corpo muda, "Voltar para um só" no
// topo) pela escolha da origem:
//
//   · Planilha (Excel ou CSV): o fluxo de hoje (importPlanilha +
//     ImportPlanilhaModal), com o modelo para baixar;
//   · Digitar ou colar uma lista: o QuickBatchProductsModal de hoje.
//
// Aqui só há tela. Quem decide o que cada origem faz é o pai
// (ItemFormModal → app/(tabs)/estoque.tsx). A faixa só aparece no cadastro
// novo de produto, fora do demo e do consolidado (o ItemFormModal decide).
// ============================================================
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { Colors, IS_DARK_MODE } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { BaixarModelo } from "./BaixarModelo";

export const TEXTOS_CADASTRAR_VARIOS = {
  faixaTitulo: "Tem muitos para cadastrar?",
  faixaApoio: "Mande uma planilha ou cole uma lista, e a Aura cadastra todos de uma vez.",
  faixaBotao: "Cadastrar vários",
  faixaCelularTitulo: "Cadastrar vários de uma vez",
  faixaCelularApoio: "Planilha ou lista colada",
  titulo: "Cadastrar vários",
  subtitulo: "Você confere tudo antes de gravar.",
  voltar: "Voltar para um só",
  planilhaTitulo: "Planilha (Excel ou CSV)",
  planilhaApoio: "Cadastra vários produtos de uma vez. Use a sua planilha ou o nosso modelo.",
  planilhaApoioCelular: "Use a sua ou o nosso modelo.",
  planilhaBotao: "Escolher planilha",
  listaTitulo: "Digitar ou colar uma lista",
  listaApoio: "Um produto por linha: nome, preço, tamanho, cor e estoque. Dá para colar direto do Excel.",
  listaApoioCelular: "Um produto por linha.",
  listaBotao: "Abrir a lista",
} as const;

/** O que o pai entrega ao ItemFormModal para a faixa existir. */
export type AcoesCadastrarVarios = {
  /** Abre o seletor de arquivo da importação de planilha de hoje. */
  onPlanilha: () => void;
  /** Abre o QuickBatchProductsModal (com "← Voltar" para a escolha). */
  onLista: () => void;
  /** Importação de planilha lendo ou gravando. */
  planilhaOcupada?: boolean;
  /** Abrir o modal já na escolha da origem (o "← Voltar" da lista). */
  abrirNaEscolha?: boolean;
};

// ── Faixa no formulário ──────────────────────────────────────
export function FaixaCadastrarVarios({ narrow, onPress }: { narrow: boolean; onPress: () => void }) {
  const T = TEXTOS_CADASTRAR_VARIOS;
  if (narrow) {
    // Celular: a faixa inteira é o botão (alvo de 44 px).
    return (
      <Pressable
        onPress={onPress}
        style={[s.faixa, s.faixaCelular]}
        accessibilityRole="button"
        accessibilityLabel={T.faixaCelularTitulo + ". " + T.faixaCelularApoio}
        testID="faixa-cadastrar-varios"
      >
        <Icon name="layers" size={16} color={Colors.violet3} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.faixaForte}>{T.faixaCelularTitulo}</Text>
          <Text style={s.faixaTxt}>{T.faixaCelularApoio}</Text>
        </View>
        <Icon name="chevron_right" size={16} color={Colors.violet3} />
      </Pressable>
    );
  }
  return (
    <View style={s.faixa} testID="faixa-cadastrar-varios">
      <Icon name="layers" size={16} color={Colors.violet3} />
      <Text style={[s.faixaTxt, { flex: 1, minWidth: 0 }]}>
        <Text style={s.faixaForte}>{T.faixaTitulo}</Text>
        {" " + T.faixaApoio}
      </Text>
      <Pressable
        onPress={onPress}
        style={s.faixaBotao}
        accessibilityRole="button"
        testID="faixa-cadastrar-varios-botao"
      >
        <Text style={s.faixaBotaoTxt}>{T.faixaBotao}</Text>
      </Pressable>
    </View>
  );
}

// ── A escolha da origem (troca o miolo do modal) ─────────────
type EscolhaProps = {
  narrow: boolean;
  onVoltar: () => void;
  onFechar: () => void;
  onPlanilha: () => void;
  onLista: () => void;
  planilhaOcupada?: boolean;
};

export function CadastrarVariosEscolha({ narrow, onVoltar, onFechar, onPlanilha, onLista, planilhaOcupada }: EscolhaProps) {
  const T = TEXTOS_CADASTRAR_VARIOS;
  return (
    <>
      <View style={s.header} testID="cadastrar-varios">
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
          <View style={s.headerIco}><Icon name="layers" size={16} color={Colors.violet3} /></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.headerTitle} numberOfLines={1}>{T.titulo}</Text>
            <Text style={s.headerSub} numberOfLines={2}>{T.subtitulo}</Text>
          </View>
        </View>
        <Pressable onPress={onFechar} style={s.headerBtn} accessibilityLabel="Fechar" testID="cadastrar-varios-fechar">
          <Icon name="x" size={16} color={Colors.ink3} />
        </Pressable>
      </View>

      <ScrollView style={s.body} contentContainerStyle={s.bodyContent} keyboardShouldPersistTaps="handled">
        <Pressable onPress={onVoltar} style={s.voltar} accessibilityRole="button" testID="cadastrar-varios-voltar">
          <Icon name="chevron_left" size={15} color={Colors.violet3} />
          <Text style={s.voltarTxt}>{T.voltar}</Text>
        </Pressable>

        <View style={[s.origens, narrow && { flexDirection: "column" }]}>
          <View style={[s.origem, narrow && s.origemCelular]} testID="cadastrar-varios-planilha">
            <View style={s.origemIco}><Icon name="grid" size={20} color={Colors.violet3} /></View>
            <View style={narrow ? { flex: 1, minWidth: 0 } : null}>
              <Text style={s.origemTitulo}>{T.planilhaTitulo}</Text>
              <Text style={s.origemTxt}>{narrow ? T.planilhaApoioCelular : T.planilhaApoio}</Text>
            </View>
            <View style={[s.origemAcoes, narrow && { width: "100%" }]}>
              <Pressable
                onPress={planilhaOcupada ? undefined : onPlanilha}
                disabled={planilhaOcupada}
                style={[s.btnPri, narrow && s.btnCelular, planilhaOcupada && { opacity: 0.6 }]}
                accessibilityRole="button"
                testID="cadastrar-varios-escolher-planilha"
              >
                {planilhaOcupada && <ActivityIndicator size="small" color="#fff" />}
                <Text style={s.btnPriTxt}>{T.planilhaBotao}</Text>
              </Pressable>
              <BaixarModelo testID="cadastrar-varios-modelo" />
            </View>
          </View>

          <View style={[s.origem, narrow && s.origemCelular]} testID="cadastrar-varios-lista">
            <View style={s.origemIco}><Icon name="list" size={20} color={Colors.violet3} /></View>
            <View style={narrow ? { flex: 1, minWidth: 0 } : null}>
              <Text style={s.origemTitulo}>{T.listaTitulo}</Text>
              <Text style={s.origemTxt}>{narrow ? T.listaApoioCelular : T.listaApoio}</Text>
            </View>
            <View style={[s.origemAcoes, narrow && { width: "100%" }]}>
              <Pressable onPress={onLista} style={[s.btnPri, narrow && s.btnCelular]} accessibilityRole="button" testID="cadastrar-varios-abrir-lista">
                <Text style={s.btnPriTxt}>{T.listaBotao}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </>
  );
}

// Sem hover: tudo é toque/clique (CLAUDE.md, armadilha 7).
const s = StyleSheet.create({
  faixa: {
    flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap",
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14,
    backgroundColor: IS_DARK_MODE ? "rgba(124,58,237,0.12)" : "#f3efff",
    borderWidth: 1, borderColor: "rgba(124,58,237,0.3)", borderStyle: "dashed" as any,
  },
  faixaCelular: { flexWrap: "nowrap", borderStyle: "solid" as any, minHeight: 44 },
  faixaForte: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  faixaTxt: { fontSize: 13, color: Colors.ink2, lineHeight: 18 },
  faixaBotao: {
    minHeight: 36, justifyContent: "center", paddingHorizontal: 14, borderRadius: 9,
    backgroundColor: IS_DARK_MODE ? "rgba(124,58,237,0.18)" : "#ffffff",
    borderWidth: 1, borderColor: "rgba(124,58,237,0.4)",
  },
  faixaBotaoTxt: { fontSize: 13, fontWeight: "700", color: Colors.violet3 },

  // Cabeçalho: as mesmas medidas do cabeçalho do ItemFormModal.
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12,
    paddingHorizontal: 22, paddingTop: 14, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: "rgba(124,58,237,0.15)",
  },
  headerIco: {
    width: 32, height: 32, borderRadius: 9,
    backgroundColor: "rgba(124,58,237,0.18)",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  headerBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: IS_DARK_MODE ? "rgba(255,255,255,0.06)" : "rgba(109,40,217,0.06)",
    borderWidth: 1, borderColor: IS_DARK_MODE ? "rgba(255,255,255,0.1)" : "rgba(109,40,217,0.18)",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: Colors.ink, letterSpacing: -0.2 },
  headerSub: { fontSize: 12, color: Colors.ink3, marginTop: 1 },
  body: { flexGrow: 0 },
  bodyContent: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 22 },

  voltar: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", minHeight: 44, paddingRight: 8, marginBottom: 4 },
  voltarTxt: { fontSize: 13, fontWeight: "600", color: Colors.violet3 },

  origens: { flexDirection: "row", gap: 12, alignItems: "stretch" },
  origem: {
    flex: 1, minWidth: 0, gap: 8, padding: 16, borderRadius: 14,
    backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border,
  },
  origemCelular: { flex: undefined as any, flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", gap: 12 },
  origemIco: {
    width: 38, height: 38, borderRadius: 10, backgroundColor: "rgba(124,58,237,0.14)",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  origemTitulo: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  origemTxt: { fontSize: 12.5, color: Colors.ink3, lineHeight: 18, marginTop: 2 },
  origemAcoes: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 4 },
  btnPri: {
    flexDirection: "row", alignItems: "center", gap: 6, minHeight: 36,
    backgroundColor: Colors.violet, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8,
  },
  btnCelular: { minHeight: 44 },
  btnPriTxt: { color: "#fff", fontSize: 12.5, fontWeight: "700" },
});
