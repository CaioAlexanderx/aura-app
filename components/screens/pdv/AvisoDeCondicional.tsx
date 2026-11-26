// ============================================================
// AURA. — Caixa · aviso ao bipar peça que consta com cliente (C13)
//
// Mockup da Venda condicional ("Bipou peça que consta com cliente"): quando o
// toque ou o bipe ia lançar uma peça que já saiu em condicional e não há outra
// livre, avisa. Provável devolução não registrada. Nunca trava: "Vender mesmo
// assim" lança como sempre, "Não vender" só fecha e "Ver a condicional" por
// ora leva à aba Condicionais em Vendas (o detalhe da condicional vem depois).
// Mesmo desenho de AvisoDeReserva: WebPortal no web, role="dialog", Esc =
// "Não vender".
// ============================================================
import { useEffect } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { WebPortal } from "@/components/WebPortal";
import { TEXTOS_COM_CLIENTES as T, ROTA_DAS_CONDICIONAIS } from "@/utils/comClientes";

export type AvisoDeCondicionalDados = {
  nome: string;
  estoque: number;
  comClientes: number;
};

export function AvisoDeCondicional({ aviso, onNaoVender, onVender }: {
  aviso: AvisoDeCondicionalDados | null;
  onNaoVender: () => void;
  onVender: () => void;
}) {
  const router = useRouter();
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
  function ver() {
    onNaoVender();
    router.push(ROTA_DAS_CONDICIONAIS as any);
  }
  const dialogo = Platform.OS === "web" ? ({ role: "dialog", "aria-modal": true, "aria-label": T.avisoTitulo } as any) : {};
  const conteudo = (
    <View style={s.fundo} testID="aviso-com-clientes">
      <Pressable style={StyleSheet.absoluteFill} onPress={onNaoVender} accessibilityLabel={T.naoVender} />
      <View style={s.caixa} {...dialogo} accessibilityRole="alert">
        <Icon name="alert" size={16} color={Colors.amber} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.nome} numberOfLines={1}>{aviso.nome}</Text>
          <Text style={s.tit}>{T.avisoTitulo}</Text>
          <Text style={s.txt}>{T.avisoTexto}</Text>
          <View style={s.acoes}>
            <Pressable onPress={onNaoVender} style={[s.btn, s.btnSec]} testID="aviso-com-clientes-nao" accessibilityRole="button">
              <Text style={s.btnSecTxt}>{T.naoVender}</Text>
            </Pressable>
            <Pressable onPress={onVender} style={[s.btn, s.btnSec]} testID="aviso-com-clientes-vender" accessibilityRole="button">
              <Text style={s.btnSecTxt}>{T.venderMesmoAssim}</Text>
            </Pressable>
            <Pressable onPress={ver} style={[s.btn, s.btnPri]} testID="aviso-com-clientes-ver" accessibilityRole="button">
              <Text style={s.btnPriTxt}>{T.verACondicional}</Text>
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
  tit: { fontSize: 15, color: Colors.ink, fontWeight: "700" },
  txt: { fontSize: 13, color: Colors.ink, lineHeight: 19, marginTop: 4 },
  acoes: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  btn: { minHeight: 44, paddingHorizontal: 18, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  btnSec: { backgroundColor: "rgba(255,255,255,0.055)", borderWidth: 1, borderColor: "rgba(120,100,240,0.36)" },
  btnSecTxt: { fontSize: 13.5, color: Colors.ink, fontWeight: "500" },
  btnPri: { backgroundColor: Colors.violet },
  btnPriTxt: { fontSize: 13.5, color: "#fff", fontWeight: "700" },
});

export default AvisoDeCondicional;
