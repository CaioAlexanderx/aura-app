// ============================================================
// AURA. — Nova condicional · casca do wizard (C6, 26/11/2026)
//
// DNA do TrocaModal/PedidoModal (CLAUDE.md, armadilha 5): cabeçalho com ícone,
// barra de passos numerada, miolo à esquerda, resumo roxo à direita, rodapé
// com a frase do que falta e Voltar / Continuar. Casca nova com os mesmos
// estilos (o TrocaModal e o PedidoModal não são tocados).
//
// Web: WebPortal (o z-index do react-native-web prende overlay fixo no shell).
// Celular: alvos de 44 px, texto de 12 px ou mais, sem rolagem lateral (o
// painel é width 100%, o miolo quebra em coluna abaixo de 760 px).
// ============================================================
import { type ReactNode } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, Platform, useWindowDimensions } from "react-native";
import { Colors, IS_DARK_MODE } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { WebPortal } from "@/components/WebPortal";
import { TEXTOS_DA_NOVA as T } from "./textos";

const IS_WEB = Platform.OS === "web";

type Props = {
  titulo: string;
  /** Passo de 1 a 4. 0 = escolha da loja (sem barra de passos). */
  passo: number;
  corpo: ReactNode;
  /** Resumo roxo à direita (ausente em "Pronto" e na escolha da loja). */
  trilho?: ReactNode;
  /** Rodapé inteiro (info + botões). Ausente = sem rodapé. */
  rodape?: ReactNode;
  /** Esconde o corpo sem desmontar (o "Novo cliente" troca o miolo). */
  corpoEscondido?: boolean;
  /** Miolo extra que entra no lugar do corpo (formulário "Novo cliente"). */
  miolo?: ReactNode;
  onFechar: () => void;
  /** Toque fora fecha? (Não em "Pronto": a lojista decide por um botão.) */
  fechaPeloFundo?: boolean;
  testID?: string;
};

export function Casca({ titulo, passo, corpo, trilho, rodape, corpoEscondido, miolo, onFechar, fechaPeloFundo = true, testID = "nova-condicional-modal" }: Props) {
  const { width } = useWindowDimensions();
  const largo = width >= 760;

  const panelWeb: any = IS_WEB ? {
    background: IS_DARK_MODE ? "rgba(18,10,35,0.98)" : "rgba(255,255,255,0.98)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(124,58,237,0.3)",
    boxShadow: IS_DARK_MODE ? "0 24px 60px -10px rgba(0,0,0,0.7)" : "0 24px 60px -10px rgba(124,58,237,0.22)",
  } : null;
  const dialogo = IS_WEB ? ({ role: "dialog", "aria-modal": true, "aria-label": T.titulo } as any) : {};

  const conteudo = (
    <View style={s.overlay} testID={testID}>
      <Pressable style={s.backdrop} onPress={fechaPeloFundo ? onFechar : undefined} accessibilityLabel={T.fechar} />
      <View style={[s.panel, IS_WEB ? panelWeb : { backgroundColor: Colors.bg3 }]} {...dialogo}>
        <View style={s.header}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
            <View style={s.headerIco}><Icon name="tag" size={16} color="#a78bfa" /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.headerTitle}>{titulo}</Text>
              {largo && passo !== 4 && <Text style={s.headerSub}>{T.subtitulo}</Text>}
            </View>
          </View>
          <Pressable onPress={onFechar} style={s.closeBtn} accessibilityLabel={T.fechar} testID="nova-fechar" accessibilityRole="button">
            <Icon name="x" size={16} color={Colors.ink3} />
          </Pressable>
        </View>

        {passo >= 1 && (
          <View style={s.stepBar} testID="nova-passos">
            {T.passos.map((rotulo, idx) => {
              const n = idx + 1;
              const done = passo > n;
              const active = passo === n;
              return (
                <View key={rotulo} style={s.stepItem}>
                  <View style={[s.stepDot, done && s.stepDotDone, active && s.stepDotActive]}>
                    {done ? <Icon name="check" size={10} color="#fff" /> : <Text style={[s.stepDotTxt, active && { color: "#fff" }]}>{n}</Text>}
                  </View>
                  {(largo || active) && (
                    <Text style={[s.stepLabel, (active || done) && { color: active ? "#a78bfa" : Colors.ink2, fontWeight: active ? "700" : "500" }]} numberOfLines={1}>
                      {largo ? rotulo : T.passoDe(n, rotulo)}
                    </Text>
                  )}
                  {idx < T.passos.length - 1 && largo && <View style={[s.stepSep, done && { backgroundColor: "rgba(124,58,237,0.4)" }]} />}
                </View>
              );
            })}
          </View>
        )}

        {miolo}

        <ScrollView
          style={[s.body, (corpoEscondido || !!miolo) && s.escondido]}
          contentContainerStyle={s.bodyContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[s.grade, !largo && s.gradeEstreita]}>
            <View style={{ flex: largo ? 1 : undefined, minWidth: 0, alignSelf: "stretch" }}>{corpo}</View>
            {trilho ? <View style={[s.trilhoBox, !largo && s.trilhoEstreito]}>{trilho}</View> : null}
          </View>
        </ScrollView>

        {rodape ? <View style={s.footer}>{rodape}</View> : null}
      </View>
    </View>
  );

  return IS_WEB ? <WebPortal active>{conteudo}</WebPortal> : conteudo;
}

export const s = StyleSheet.create({
  overlay: {
    position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center",
    zIndex: 100, padding: 16,
  },
  backdrop: { position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0 },
  panel: { width: "100%", maxWidth: 900, maxHeight: "94%", borderRadius: 18, overflow: "hidden", flexDirection: "column" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10,
    paddingHorizontal: 22, paddingTop: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: "rgba(124,58,237,0.15)",
  },
  headerIco: { width: 32, height: 32, borderRadius: 9, backgroundColor: "rgba(124,58,237,0.18)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: Colors.ink, letterSpacing: -0.2 },
  headerSub: { fontSize: 12, color: Colors.ink3, marginTop: 1 },
  closeBtn: {
    width: 44, height: 44, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center",
  },
  stepBar: {
    flexDirection: "row", alignItems: "center", flexWrap: "wrap",
    paddingHorizontal: 22, paddingVertical: 12, backgroundColor: "rgba(0,0,0,0.18)",
    borderBottomWidth: 1, borderBottomColor: "rgba(124,58,237,0.1)", gap: 6,
  },
  stepItem: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1, minWidth: 0 },
  stepDot: {
    width: 24, height: 24, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  stepDotActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  stepDotDone: { backgroundColor: "rgba(52,211,153,0.85)", borderColor: "#34d399" },
  stepDotTxt: { color: Colors.ink3, fontSize: 12, fontWeight: "700" },
  stepLabel: { color: Colors.ink3, fontSize: 12.5, fontWeight: "500", flexShrink: 1 },
  stepSep: { width: 28, height: 1.5, backgroundColor: "rgba(255,255,255,0.1)", marginHorizontal: 4 },
  body: { flexGrow: 0, flexShrink: 1 },
  escondido: { display: "none" },
  bodyContent: { padding: 20, paddingBottom: 12 },
  grade: { flexDirection: "row", gap: 18, alignItems: "flex-start" },
  gradeEstreita: { flexDirection: "column", alignItems: "stretch" },
  trilhoBox: { width: 270, flexShrink: 0, backgroundColor: "#251347", borderWidth: 1, borderColor: "rgba(167,139,250,0.38)", borderRadius: 14, padding: 16 },
  trilhoEstreito: { width: "100%" as any, marginTop: 4 },
  footer: {
    paddingHorizontal: 22, paddingVertical: 14, borderTopWidth: 1, borderTopColor: "rgba(124,58,237,0.15)",
    backgroundColor: "rgba(0,0,0,0.18)", flexDirection: "row", flexWrap: "wrap",
    justifyContent: "space-between", alignItems: "center", gap: 12,
  },
});

/** Estilos dos blocos que os passos repartem (botões, notas, campos, linhas). */
export const e = StyleSheet.create({
  qst: { fontSize: 12, color: Colors.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  footerInfo: { flex: 1, minWidth: 180, fontSize: 12.5, color: Colors.ink2, fontWeight: "500" },
  footerErro: { flex: 1, minWidth: 180, flexDirection: "row", alignItems: "flex-start", gap: 8 },
  footerErroTxt: { flex: 1, fontSize: 13, color: Colors.red, fontWeight: "700", lineHeight: 18 },
  footerActions: { flexDirection: "row", gap: 8, flexShrink: 0, flexWrap: "wrap" },
  btnPri: {
    backgroundColor: Colors.violet, minHeight: 44, paddingHorizontal: 20, borderRadius: 10,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
  },
  btnPriTxt: { color: "#fff", fontSize: 13.5, fontWeight: "700" },
  btnSec: {
    backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    minHeight: 44, paddingHorizontal: 16, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
  },
  btnSecTxt: { color: Colors.ink, fontSize: 13, fontWeight: "500" },
  desligado: { opacity: 0.45 },
  nota: { flexDirection: "row", gap: 8, alignItems: "flex-start", padding: 10, borderRadius: 10, backgroundColor: "rgba(37,99,235,0.16)", marginTop: 12 },
  notaTxt: { flex: 1, fontSize: 12.5, color: Colors.ink2, lineHeight: 18 },
  notaAmbar: { backgroundColor: Colors.amberD, borderWidth: 1, borderColor: Colors.amber },
  notaVm: { backgroundColor: "rgba(248,113,113,0.12)", borderWidth: 1, borderColor: Colors.red },
  campo: { marginBottom: 12 },
  rotulo: { color: Colors.ink2, fontSize: 12, fontWeight: "600", marginBottom: 6 },
  input: {
    minHeight: 46, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border2,
    backgroundColor: "rgba(0,0,0,0.12)", color: Colors.ink, fontSize: 14,
  },
  dica: { color: Colors.ink3, fontSize: 12, marginTop: 5, lineHeight: 17 },
  erro: { color: Colors.red, fontSize: 12, marginTop: 5 },
  voltar: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", minHeight: 44, paddingRight: 10 },
  voltarTxt: { color: Colors.violet3, fontSize: 13, fontWeight: "600" },
  // Trilho (resumo roxo)
  credRot: { fontSize: 12, fontWeight: "700", letterSpacing: 0.8, color: "#ddd6fe", textTransform: "uppercase" },
  rLinha: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8, paddingVertical: 4 },
  rRot: { fontSize: 12.5, color: "#ddd6fe" },
  rVal: { fontSize: 13, fontWeight: "700", color: "#fff", flexShrink: 1, textAlign: "right" },
  rTot: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.22)", marginTop: 6, paddingTop: 8 },
  rTotVal: { fontSize: 20, fontWeight: "800", color: "#fff" },
  rNota: { flexDirection: "row", gap: 6, marginTop: 12, alignItems: "flex-start" },
  rNotaTxt: { flex: 1, fontSize: 12, color: "#ddd6fe", lineHeight: 17 },
});
