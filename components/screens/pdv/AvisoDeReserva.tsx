// ============================================================
// AURA. — Caixa · aviso ao vender peça reservada (A4, p-63d)
//
// Mockup "Pedido separado de venda", parte 1 ("Vender a peça reservada").
// Aparece quando o toque na grade ou o bipe ia lançar uma peça que está
// separada em pedido e o carrinho passaria do que está livre. Nunca trava:
// "Vender mesmo assim" lança como sempre; "Não vender" só fecha.
// Sem campo de texto e aberto por cima do Caixa: WebPortal no web (o z-index
// do react-native-web prende overlay fixo no shell). role="dialog" +
// aria-modal: os atalhos do Caixa param enquanto ele está na tela. Esc =
// "Não vender".
// ============================================================
import { useEffect } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { WebPortal } from "@/components/WebPortal";
import { TEXTOS_DA_RESERVA as T } from "@/utils/reservaDoPedido";

export type AvisoDeReservaDados = {
  nome: string;
  estoque: number;
  reservado: number;
};

export function AvisoDeReserva({ aviso, onNaoVender, onVender }: {
  aviso: AvisoDeReservaDados | null;
  onNaoVender: () => void;
  onVender: () => void;
}) {
  useEffect(() => {
    if (!aviso || Platform.OS !== "web" || typeof window === "undefined") return;
    function aoTecla(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      onNaoVender();
    }
    window.addEventListener("keydown", aoTecla);
    return () => window.removeEventListener("keydown", aoTecla);
  }, [aviso, onNaoVender]);

  if (!aviso) return null;
  const dialogo = Platform.OS === "web" ? ({ role: "dialog", "aria-modal": true, "aria-label": T.avisoTitulo } as any) : {};
  const conteudo = (
    <View style={s.fundo} testID="aviso-reserva">
      <Pressable style={StyleSheet.absoluteFill} onPress={onNaoVender} accessibilityLabel={T.naoVender} />
      <View style={s.caixa} {...dialogo} accessibilityRole="alert">
        <Icon name="alert" size={16} color={Colors.amber} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.nome} numberOfLines={1}>{aviso.nome}</Text>
          <Text style={s.txt}>
            <Text style={s.tit}>{T.avisoTitulo}</Text>
            {T.avisoTexto(aviso.estoque)}
          </Text>
          <View style={s.acoes}>
            <Pressable onPress={onNaoVender} style={[s.btn, s.btnSec]} testID="aviso-reserva-nao" accessibilityRole="button">
              <Text style={s.btnSecTxt}>{T.naoVender}</Text>
            </Pressable>
            <Pressable onPress={onVender} style={[s.btn, s.btnPri]} testID="aviso-reserva-vender" accessibilityRole="button">
              <Text style={s.btnPriTxt}>{T.venderMesmoAssim}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
  return Platform.OS === "web" ? <WebPortal active>{conteudo}</WebPortal> : conteudo;
}

const s = StyleSheet.create({
  fundo: {
    position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0, zIndex: 120,
    backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: 16,
  },
  caixa: {
    width: "100%", maxWidth: 520, flexDirection: "row", gap: 10, alignItems: "flex-start",
    padding: 14, borderRadius: 12, backgroundColor: Colors.bg3,
    borderWidth: 1, borderColor: Colors.amber,
  },
  nome: { fontSize: 12, color: Colors.ink3, fontWeight: "600", marginBottom: 2 },
  txt: { fontSize: 13, color: Colors.ink, lineHeight: 19 },
  tit: { fontWeight: "700" },
  acoes: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  btn: { minHeight: 44, paddingHorizontal: 18, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  btnSec: { backgroundColor: "rgba(255,255,255,0.055)", borderWidth: 1, borderColor: "rgba(120,100,240,0.36)" },
  btnSecTxt: { fontSize: 13.5, color: Colors.ink, fontWeight: "500" },
  btnPri: { backgroundColor: Colors.violet },
  btnPriTxt: { fontSize: 13.5, color: "#fff", fontWeight: "700" },
});

export default AvisoDeReserva;
