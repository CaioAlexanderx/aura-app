// ============================================================
// AURA. — Caixa · botão "Guardar" com o menu Pedido / Orçamento (A1, p-63a)
//
// Mockup "Pedido separado de venda", parte 1 (aprovado pelo Caio em 17/11).
// O botão do meio do rodapé do carrinho deixa de ser "Orçamento" e vira
// "Guardar". Tocar abre o menu "Guardar esta venda como":
//   • Pedido: as peças ficam reservadas para a cliente (abre o Novo pedido);
//   • Orçamento: faz exatamente o que o botão "Orçamento" fazia (imprime; na
//     loja com Matcon, salva na esteira). Quem decide é o CartPanel, que
//     passa o mesmo onGenerateQuote/onSaveQuote de antes.
//
// Só existe com o Pedido ligado (utils/pedido.ts). Sem ele o CartPanel nem
// importa este botão para a tela: o rodapé é o de sempre.
//
// Onde o menu abre:
//   • web largo: cartão logo acima do botão, por WebPortal (o z-index do
//     react-native-web prende overlay fixo dentro do shell). Sem campo de
//     texto, então o WebPortal serve (a exceção da JanelaEmpilhada é para
//     janela com campo por cima de outro Modal);
//   • celular (web estreito ou nativo): folha de baixo com "Fechar".
// role="dialog" + aria-modal: os atalhos do Caixa param enquanto o menu está
// aberto (dialogoAbertoNaTela). Esc fecha. Nada depende de hover.
// ============================================================
import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform, Modal, useWindowDimensions, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { WebPortal } from "@/components/WebPortal";

export const TEXTOS_DO_GUARDAR = {
  botao: "Guardar",
  titulo: "Guardar esta venda como",
  pedido: "Pedido",
  pedidoSub: "As peças ficam reservadas para a cliente. Dá para receber um sinal agora.",
  orcamento: "Orçamento",
  orcamentoSub: "Só o preço, para a cliente pensar. Nada fica reservado.",
  fechar: "Fechar",
} as const;

type Props = {
  /** Carrinho vazio ou venda em andamento: o botão não abre. */
  disabled?: boolean;
  /** Salvando o orçamento do Matcon: spinner no botão, como antes. */
  busy?: boolean;
  onPedido: () => void;
  /** null = a loja não tem Orçamento neste carrinho (o item some). */
  onOrcamento: (() => void) | null;
  /** Estilo do botão do meio do rodapé (o mesmo do "Orçamento"). */
  style?: any;
  textStyle?: any;
};

const LARGURA_MENU = 352;

export function GuardarMenu({ disabled, busy, onPedido, onOrcamento, style, textStyle }: Props) {
  const [aberto, setAberto] = useState(false);
  const [ancora, setAncora] = useState<{ left: number; bottom: number; width: number } | null>(null);
  const botaoRef = useRef<any>(null);
  const { width: larguraTela, height: alturaTela } = useWindowDimensions();
  const folha = Platform.OS !== "web" || larguraTela < 640;

  function abrir() {
    if (disabled || busy) return;
    if (!folha) {
      const r = botaoRef.current?.getBoundingClientRect?.();
      if (r) {
        const left = Math.max(12, Math.min(r.left + r.width / 2 - LARGURA_MENU / 2, larguraTela - LARGURA_MENU - 12));
        setAncora({ left, bottom: Math.max(12, alturaTela - r.top + 8), width: LARGURA_MENU });
      } else setAncora(null);
    }
    setAberto(true);
  }
  function fechar() { setAberto(false); }
  function escolher(acao: () => void) { setAberto(false); acao(); }

  useEffect(() => {
    if (!aberto || Platform.OS !== "web" || typeof window === "undefined") return;
    function aoTecla(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setAberto(false);
    }
    window.addEventListener("keydown", aoTecla);
    return () => window.removeEventListener("keydown", aoTecla);
  }, [aberto]);

  const opcoes = (
    <View accessibilityRole={"menu" as any} accessibilityLabel={TEXTOS_DO_GUARDAR.titulo}>
      <Text style={s.titulo}>{TEXTOS_DO_GUARDAR.titulo}</Text>
      <Pressable
        testID="guardar-opcao-pedido"
        accessibilityRole={"menuitem" as any}
        onPress={() => escolher(onPedido)}
        style={({ pressed }: any) => [s.opcao, pressed && s.opcaoFoco]}
      >
        <View style={s.opcaoIco}><Icon name="bag" size={18} color={Colors.violet3} /></View>
        <View style={s.opcaoTxt}>
          <Text style={s.opcaoNome}>{TEXTOS_DO_GUARDAR.pedido}</Text>
          <Text style={s.opcaoSub}>{TEXTOS_DO_GUARDAR.pedidoSub}</Text>
        </View>
      </Pressable>
      {onOrcamento && (
        <Pressable
          testID="guardar-opcao-orcamento"
          accessibilityRole={"menuitem" as any}
          onPress={() => escolher(onOrcamento)}
          style={({ pressed }: any) => [s.opcao, s.opcaoSep, pressed && s.opcaoFoco]}
        >
          <View style={s.opcaoIco}><Icon name="file_text" size={18} color={Colors.violet3} /></View>
          <View style={s.opcaoTxt}>
            <Text style={s.opcaoNome}>{TEXTOS_DO_GUARDAR.orcamento}</Text>
            <Text style={s.opcaoSub}>{TEXTOS_DO_GUARDAR.orcamentoSub}</Text>
          </View>
        </Pressable>
      )}
    </View>
  );

  const dialogo = { role: "dialog", "aria-modal": true, "aria-label": TEXTOS_DO_GUARDAR.titulo } as any;

  const menuFolha = (
    <View style={s.fundo} testID="guardar-menu">
      <Pressable style={StyleSheet.absoluteFill} onPress={fechar} accessibilityLabel={TEXTOS_DO_GUARDAR.fechar} />
      <View style={s.folha} {...(Platform.OS === "web" ? dialogo : {})}>
        <View style={s.alca} />
        {opcoes}
        <Pressable testID="guardar-fechar" onPress={fechar} style={s.fecharBtn} accessibilityRole="button">
          <Text style={s.fecharTxt}>{TEXTOS_DO_GUARDAR.fechar}</Text>
        </Pressable>
      </View>
    </View>
  );

  const menuCartao = (
    <View style={s.fundoClaro} testID="guardar-menu">
      <Pressable style={StyleSheet.absoluteFill} onPress={fechar} accessibilityLabel={TEXTOS_DO_GUARDAR.fechar} />
      <View
        style={[s.cartao, ancora ? { left: ancora.left, bottom: ancora.bottom, width: ancora.width } : s.cartaoCentro]}
        {...dialogo}
      >
        {opcoes}
      </View>
    </View>
  );

  return (
    <>
      <Pressable
        ref={botaoRef}
        testID="cta-guardar"
        onPress={abrir}
        disabled={!!disabled || !!busy}
        accessibilityRole="button"
        accessibilityState={{ expanded: aberto, disabled: !!disabled }}
        aria-expanded={aberto}
        aria-haspopup="menu"
        style={[style, (disabled || busy) && { opacity: 0.5 }]}
      >
        {busy ? (
          <ActivityIndicator color={Colors.violet3} size="small" />
        ) : (
          <>
            <Icon name="bag" size={15} color={Colors.violet3} />
            <Text style={textStyle} numberOfLines={1}>{TEXTOS_DO_GUARDAR.botao}</Text>
            <Icon name={aberto ? "chevron_down" : "chevron_up"} size={13} color={Colors.violet3} />
          </>
        )}
      </Pressable>
      {Platform.OS === "web" ? (
        <WebPortal active={aberto}>{folha ? menuFolha : menuCartao}</WebPortal>
      ) : (
        <Modal visible={aberto} transparent animationType="fade" onRequestClose={fechar}>
          {menuFolha}
        </Modal>
      )}
    </>
  );
}

const s = StyleSheet.create({
  fundo: { position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  fundoClaro: { position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0 },
  folha: {
    backgroundColor: Colors.bg3, borderTopLeftRadius: 18, borderTopRightRadius: 18,
    borderTopWidth: 1, borderColor: "rgba(124,58,237,0.48)", padding: 10, paddingBottom: 14,
  },
  alca: { width: 40, height: 4, borderRadius: 4, backgroundColor: "rgba(120,100,240,0.28)", alignSelf: "center", marginTop: 2, marginBottom: 8 },
  cartao: {
    position: "absolute" as any, backgroundColor: Colors.bg3, borderRadius: 14, padding: 6,
    borderWidth: 1, borderColor: "rgba(124,58,237,0.48)",
    shadowColor: "#000", shadowOpacity: 0.45, shadowRadius: 30, shadowOffset: { width: 0, height: 18 },
  },
  cartaoCentro: { left: "50%" as any, bottom: 96, width: LARGURA_MENU, marginLeft: -LARGURA_MENU / 2 },
  titulo: { fontSize: 11, fontWeight: "700", letterSpacing: 1.1, textTransform: "uppercase", color: Colors.ink3, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 4 },
  opcao: { flexDirection: "row", gap: 12, alignItems: "flex-start", padding: 10, minHeight: 60, borderRadius: 10 },
  opcaoSep: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)" },
  opcaoFoco: { backgroundColor: "rgba(124,58,237,0.16)" },
  opcaoIco: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(124,58,237,0.16)", alignItems: "center", justifyContent: "center" },
  opcaoTxt: { flex: 1, minWidth: 0 },
  opcaoNome: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  opcaoSub: { fontSize: 12, color: Colors.ink2, lineHeight: 17, marginTop: 2 },
  fecharBtn: {
    minHeight: 44, marginTop: 6, borderRadius: 10, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.055)", borderWidth: 1, borderColor: "rgba(120,100,240,0.28)",
  },
  fecharTxt: { fontSize: 13.5, fontWeight: "500", color: Colors.ink },
});

export default GuardarMenu;
