import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { ROTULO_PEDIR_AJUDA_IMPORTACAO, TEXTO_ESCOPO_IMPORTACAO } from "@/utils/importacaoLancamentos";

// Resultado da importação de lançamentos: o que entrou, as primeiras linhas
// que ficaram de fora com o motivo que o backend devolveu e, quando o arquivo
// não era de receitas e despesas, o convite para a gente ajudar a trazer.
// "Pedir ao Time Aura" leva ao chamado em /suporte (a tela de suporte ainda
// não abre com assunto e mensagem preenchidos por parâmetro).
type Props = {
  visible: boolean;
  titulo: string;
  resumo: string;
  motivos: string[];
  oferecerAjuda: boolean;
  onPedirAjuda: () => void;
  onFechar: () => void;
};

export function ResultadoImportacaoModal({ visible, titulo, resumo, motivos, oferecerAjuda, onPedirAjuda, onFechar }: Props) {
  if (!visible) return null;
  const isWeb = Platform.OS === "web";
  return (
    <View testID="resultado-importacao" style={[s.overlay, { position: (isWeb ? "fixed" : "absolute") as any }]}>
      <Pressable style={s.backdrop} onPress={onFechar} />
      <View style={s.dialog}>
        <Text style={s.title}>{titulo}</Text>
        <Text style={s.message}>{resumo}</Text>
        {motivos.length > 0 ? (
          <View style={s.motivos} testID="resultado-importacao-motivos">
            {motivos.map(function(m, i) { return <Text key={i} style={s.motivo}>{m}</Text>; })}
          </View>
        ) : null}
        {oferecerAjuda ? <Text style={s.escopo}>{TEXTO_ESCOPO_IMPORTACAO}</Text> : null}
        {oferecerAjuda ? (
          <Pressable testID="resultado-importacao-ajuda" onPress={onPedirAjuda} style={s.ajudaBtn}>
            <Text style={s.ajudaText}>{ROTULO_PEDIR_AJUDA_IMPORTACAO}</Text>
          </Pressable>
        ) : null}
        <Pressable testID="resultado-importacao-fechar" onPress={onFechar} style={s.fecharBtn}>
          <Text style={s.fecharText}>Fechar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: { top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center", zIndex: 9999 },
  backdrop: { position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)" },
  dialog: { backgroundColor: Colors.bg3, borderRadius: 20, padding: 24, maxWidth: 420, width: "90%", borderWidth: 1, borderColor: Colors.border2, zIndex: 10000 },
  title: { fontSize: 18, fontWeight: "700", color: Colors.ink, marginBottom: 8 },
  message: { fontSize: 14, color: Colors.ink, lineHeight: 21, marginBottom: 12 },
  motivos: { backgroundColor: Colors.bg4, borderRadius: 12, padding: 12, gap: 6, marginBottom: 12 },
  motivo: { fontSize: 12, color: Colors.ink3, lineHeight: 18 },
  escopo: { fontSize: 13, color: Colors.ink3, lineHeight: 20, marginBottom: 12 },
  ajudaBtn: { paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.violet2, alignItems: "center", marginBottom: 10 },
  ajudaText: { fontSize: 14, color: Colors.violet3, fontWeight: "700" },
  fecharBtn: { paddingVertical: 13, borderRadius: 12, backgroundColor: Colors.violet, alignItems: "center" },
  fecharText: { fontSize: 14, color: "#fff", fontWeight: "700" },
});

export default ResultadoImportacaoModal;
