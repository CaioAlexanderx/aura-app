// ============================================================
// AURA. — Estoque · botão "Importar" com menu
//
// QA de 23/09/2026: a barra do Estoque tinha sete ações, com "Importar
// DANFE" e "Importar planilha" lado a lado e sem explicação — e "DANFE"
// não é palavra de balcão. Agora é um botão só, "Importar", que abre um
// menu com as duas origens e uma frase do que cada uma faz.
//
// Toque e clique abrem/fecham igual (nada de hover-reveal — CLAUDE.md
// regra 7). O menu vai por WebPortal, ancorado no botão: dentro da barra
// ele ficaria preso no z-index:0 das Views do RNW e a lista de produtos
// pintaria por cima (memória "overlay fixo dentro de shell"). Fecha ao
// tocar fora, no Esc e ao escolher uma opção.
// ============================================================
import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform, ActivityIndicator } from "react-native";
import { Colors, IS_DARK_MODE } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { WebPortal } from "@/components/WebPortal";

type Props = {
  onNota: () => void;
  onPlanilha: () => void;
  /** Importação de planilha em andamento (lendo/gravando). */
  ocupado?: boolean;
  /** Só o ícone (tela estreita). */
  compacto?: boolean;
};

export const OPCOES_IMPORTAR = {
  nota: {
    titulo: "Nota do fornecedor (XML/DANFE)",
    texto: "Cadastra e dá entrada no estoque a partir da nota",
  },
  planilha: {
    titulo: "Planilha (Excel ou CSV)",
    texto: "Cadastra vários produtos de uma vez",
  },
} as const;

type Posicao = { top: number; left: number; width: number };

const LARGURA = 320;
const MARGEM = 16;

function calcularPosicao(el: any): Posicao | null {
  if (Platform.OS !== "web" || typeof window === "undefined" || !el?.getBoundingClientRect) return null;
  const r = el.getBoundingClientRect();
  const vw = window.innerWidth;
  const width = Math.min(LARGURA, vw - MARGEM * 2);
  // Alinha a borda direita do menu com a do botão, sem sair da tela.
  let left = r.right - width;
  left = Math.max(MARGEM, Math.min(left, vw - width - MARGEM));
  return { top: r.bottom + 6, left, width };
}

export function ImportarMenu({ onNota, onPlanilha, ocupado, compacto }: Props) {
  const [aberto, setAberto] = useState(false);
  const [pos, setPos] = useState<Posicao | null>(null);
  const botaoRef = useRef<any>(null);

  useEffect(() => {
    if (!aberto || Platform.OS !== "web" || typeof window === "undefined") return;
    const fechar = () => setAberto(false);
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    window.addEventListener("resize", fechar);
    window.addEventListener("keydown", tecla);
    return () => {
      window.removeEventListener("resize", fechar);
      window.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  function alternar() {
    if (aberto) { setAberto(false); return; }
    setPos(calcularPosicao(botaoRef.current));
    setAberto(true);
  }

  function escolher(acao: () => void) {
    setAberto(false);
    acao();
  }

  const menu = (
    <View style={s.camada} testID="importar-menu">
      <Pressable style={s.fundo} onPress={() => setAberto(false)} testID="importar-menu-fundo" />
      <View
        style={[
          s.menu,
          pos ? { top: pos.top, left: pos.left, width: pos.width } : s.menuSemAncora,
          Platform.OS === "web" ? ({ boxShadow: IS_DARK_MODE ? "0 18px 40px -8px rgba(0,0,0,0.6)" : "0 18px 40px -8px rgba(124,58,237,0.25)" } as any) : null,
        ]}
        accessibilityRole={"menu" as any}
      >
        <Opcao
          testID="importar-opcao-nota"
          icone="file_text"
          titulo={OPCOES_IMPORTAR.nota.titulo}
          texto={OPCOES_IMPORTAR.nota.texto}
          onPress={() => escolher(onNota)}
        />
        <View style={s.divisor} />
        <Opcao
          testID="importar-opcao-planilha"
          icone="grid"
          titulo={OPCOES_IMPORTAR.planilha.titulo}
          texto={OPCOES_IMPORTAR.planilha.texto}
          onPress={() => escolher(onPlanilha)}
          desabilitada={ocupado}
        />
      </View>
    </View>
  );

  return (
    <>
      <Pressable
        ref={botaoRef}
        onPress={alternar}
        style={[s.botao, aberto && s.botaoAberto, compacto && s.botaoCompacto]}
        testID="importar-botao"
        accessibilityLabel="Importar"
        accessibilityState={{ expanded: aberto } as any}
      >
        {ocupado ? <ActivityIndicator size="small" color={Colors.violet3} /> : <Icon name="upload" size={14} color={Colors.violet3} />}
        {!compacto && <Text style={s.botaoTxt}>Importar</Text>}
        {!compacto && <Icon name={aberto ? "chevron_up" : "chevron_down"} size={13} color={Colors.violet3} />}
      </Pressable>
      {aberto && (Platform.OS === "web" ? <WebPortal active>{menu}</WebPortal> : menu)}
    </>
  );
}

function Opcao({ icone, titulo, texto, onPress, desabilitada, testID }: {
  icone: string; titulo: string; texto: string; onPress: () => void; desabilitada?: boolean; testID: string;
}) {
  return (
    <Pressable
      onPress={desabilitada ? undefined : onPress}
      disabled={desabilitada}
      style={({ pressed }: any) => [s.opcao, pressed && s.opcaoPress, desabilitada && { opacity: 0.5 }]}
      testID={testID}
      accessibilityRole={"menuitem" as any}
    >
      <View style={s.opcaoIco}><Icon name={icone} size={16} color={Colors.violet3} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.opcaoTitulo}>{titulo}</Text>
        <Text style={s.opcaoTexto}>{texto}</Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  botao: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(124,58,237,0.18)", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: "rgba(167,139,250,0.35)", borderStyle: "dashed" as any,
  },
  botaoAberto: { borderStyle: "solid" as any, borderColor: Colors.violet3 },
  botaoCompacto: { paddingHorizontal: 10, gap: 0 },
  botaoTxt: { fontSize: 13, color: Colors.violet3, fontWeight: "700" },
  camada: { position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0 },
  fundo: { position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0 },
  menu: {
    position: "absolute" as any,
    backgroundColor: Colors.bg3, borderRadius: 12, padding: 6,
    borderWidth: 1, borderColor: "rgba(124,58,237,0.3)",
  },
  // Sem medida do botão (nativo): menu no topo, com as margens da tela.
  menuSemAncora: { top: 80, left: MARGEM, right: MARGEM },
  opcao: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 12, borderRadius: 9, minHeight: 48 },
  opcaoPress: { backgroundColor: Colors.violetD },
  opcaoIco: {
    width: 32, height: 32, borderRadius: 9, backgroundColor: "rgba(124,58,237,0.14)",
    alignItems: "center", justifyContent: "center",
  },
  opcaoTitulo: { fontSize: 13.5, fontWeight: "700", color: Colors.ink },
  opcaoTexto: { fontSize: 12.5, color: Colors.ink3, marginTop: 2, lineHeight: 17 },
  divisor: { height: 1, backgroundColor: "rgba(124,58,237,0.12)", marginHorizontal: 8 },
});

export default ImportarMenu;
