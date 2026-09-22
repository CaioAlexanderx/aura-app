// ============================================================
// AURA. — GuiaInstalarIphone: como pôr a Aura na tela inicial do iPhone
//
// Criado: 22/09/2026 (PWA Fase 1)
//
// O iPhone não tem convite de instalação (não existe beforeinstallprompt
// no Safari nem no Chrome do iOS). O caminho é manual e escondido:
// Compartilhar › Adicionar à Tela de Início › Adicionar. Sem este guia,
// "instalar" no iPhone é um botão que não faz nada.
//
// Contêiner: ResponsiveSheet (bottom sheet em tela estreita, diálogo no
// resto), com o padrão header fixo → ScrollView → rodapé com CTA.
// Mockup: docs/mockups/pwa-instalar-app.html, tela B.
// ============================================================
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { ResponsiveSheet } from "@/components/ResponsiveSheet";

type Props = {
  visible: boolean;
  onClose: () => void;
};

const PASSOS: { icone: string; cor: string; titulo: string; detalhe: string }[] = [
  {
    icone: "share_2",
    cor: "#0a84ff",
    titulo: "Toque em Compartilhar",
    detalhe: "O quadrado com a seta para cima, na barra de baixo do Safari.",
  },
  {
    icone: "plus",
    cor: Colors.ink,
    titulo: "Adicionar à Tela de Início",
    detalhe: "Role a lista de opções até achar. Fica depois de “Adicionar aos Favoritos”.",
  },
  {
    icone: "check",
    cor: Colors.green,
    titulo: "Toque em Adicionar",
    detalhe: "Pronto. A Aura aparece como app na tela inicial. Da próxima vez, abra por lá.",
  },
];

export function GuiaInstalarIphone({ visible, onClose }: Props) {
  return (
    <ResponsiveSheet visible={visible} onClose={onClose} maxWidth={440}>
      <View style={s.header}>
        <Text style={s.titulo}>Instalar a Aura no iPhone</Text>
        <Text style={s.sub}>O iPhone não mostra um botão de instalar. São três toques no Safari:</Text>
      </View>

      <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={s.lista}>
        {PASSOS.map((p, i) => (
          <View key={p.titulo} style={s.passo} accessibilityLabel={`Passo ${i + 1}: ${p.titulo}`}>
            <View style={s.passoIcone}>
              <Icon name={p.icone} size={20} color={p.cor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.passoTitulo}>{p.titulo}</Text>
              <Text style={s.passoDetalhe}>{p.detalhe}</Text>
            </View>
          </View>
        ))}
        <View style={s.notaBox}>
          <Icon name="info" size={13} color={Colors.ink3} />
          <Text style={s.nota}>
            Depois de instalar, entre com seu login uma vez. O app instalado tem memória separada do Safari.
          </Text>
        </View>
      </ScrollView>

      <View style={s.rodape}>
        <Pressable onPress={onClose} style={s.cta} accessibilityRole="button">
          <Text style={s.ctaTexto}>Entendi</Text>
        </Pressable>
      </View>
    </ResponsiveSheet>
  );
}

const s = StyleSheet.create({
  header: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 6, gap: 4 },
  titulo: { fontSize: 17, fontWeight: "700", color: Colors.ink, letterSpacing: -0.2 },
  sub: { fontSize: 13, color: Colors.ink3, lineHeight: 18 },
  lista: { paddingHorizontal: 18, paddingVertical: 10, gap: 10 },
  passo: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 14, padding: 12,
  },
  passoIcone: {
    width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border,
  },
  passoTitulo: { fontSize: 14, fontWeight: "600", color: Colors.ink, lineHeight: 18 },
  passoDetalhe: { fontSize: 12, color: Colors.ink3, marginTop: 2, lineHeight: 16 },
  notaBox: { flexDirection: "row", gap: 8, alignItems: "flex-start", paddingHorizontal: 2, marginTop: 4 },
  nota: { flex: 1, fontSize: 12, color: Colors.ink3, lineHeight: 17 },
  rodape: { padding: 18, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  cta: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  ctaTexto: { color: "#fff", fontSize: 15, fontWeight: "700" },
});

export default GuiaInstalarIphone;
