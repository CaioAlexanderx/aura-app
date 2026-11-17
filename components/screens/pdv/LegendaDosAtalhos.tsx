// ============================================================
// AURA. — components/screens/pdv/LegendaDosAtalhos.tsx (17/11/2026, p-155 / A3)
//
// A legenda "Atalhos do Caixa": painel sobre a grade, ancorado na busca, com
// quatro grupos na ordem da venda (mockup "Caixa e Troca", decisão 5). O
// carrinho, onde mora metade dos atalhos, continua à vista.
//
//   - Abre pelo botão "Atalhos" ao lado da busca e por Alt+A (⌥A); fecha no
//     ×, no Esc (listener do Caixa, ação "fechar") ou num clique fora.
//   - Entra por WebPortal: dentro do shell o z-index:0 do RNW prenderia o
//     painel por baixo da grade (regra do overlay dentro de shell).
//   - As teclas vêm de utils/atalhosDoCaixa, no sistema do aparelho; os
//     textos, de ./textosDosAtalhos. Estrutura copiada do
//     DentalShortcutsHelp.
// ============================================================
import { useEffect, useState, type RefObject } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from "react-native";
import { Colors, Glass, IS_DARK_MODE } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { WebPortal } from "@/components/WebPortal";
import { useSistemaDoTeclado, useTemTeclado } from "@/hooks/useTemTeclado";
import {
  TECLAS_DE_CAMPO, teclasDaLegenda, textoDaCombinacao, type SistemaDoTeclado,
} from "@/utils/atalhosDoCaixa";
import { EtiquetaDeTecla } from "./EtiquetaDeTecla";
import { LEGENDA_DOS_ATALHOS, TEXTOS_DOS_ATALHOS as T, type LinhaDaLegenda } from "./textosDosAtalhos";

/** As teclas de uma linha da legenda, já com "ou" / "a" no meio. */
export function pedacosDaLinha(l: LinhaDaLegenda, so: SistemaDoTeclado): { tecla?: string; palavra?: string }[] {
  const out: { tecla?: string; palavra?: string }[] = [];
  const poe = (teclas: string[], separador: string | null) => {
    teclas.forEach((t, i) => {
      if (i > 0 && separador) out.push({ palavra: separador });
      out.push({ tecla: t });
    });
  };
  if (l.faixa) {
    const a = teclasDaLegenda(l.faixa[0], so)[0];
    const b = teclasDaLegenda(l.faixa[1], so)[0];
    if (a && b) poe([a, b], T.a);
    return out;
  }
  if (l.campo) {
    poe(TECLAS_DE_CAMPO[l.campo].map(c => textoDaCombinacao(c, so)), l.juntas ? null : T.ou);
    return out;
  }
  const todas: string[] = [];
  for (const acao of l.acoes || []) for (const t of teclasDaLegenda(acao, so)) if (!todas.includes(t)) todas.push(t);
  poe(todas, T.ou);
  return out;
}

type Posicao = { top: number; left: number; width: number; maxHeight: number };

function medir(ancora: RefObject<any> | undefined): Posicao {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;
  try {
    const el: any = ancora && ancora.current;
    const r = el && typeof el.getBoundingClientRect === "function" ? el.getBoundingClientRect() : null;
    if (r && r.width > 0) {
      const top = Math.round(r.bottom + 4);
      const left = Math.max(8, Math.round(r.left));
      const width = Math.min(Math.round(r.width), vw - left - 8);
      return { top, left, width: Math.max(280, width), maxHeight: Math.max(200, vh - top - 16) };
    }
  } catch {}
  const width = Math.min(720, vw - 32);
  return { top: 80, left: Math.round((vw - width) / 2), width, maxHeight: vh - 96 };
}

type Props = {
  aberta: boolean;
  onFechar: () => void;
  /** A linha da busca: o painel abre logo abaixo dela, na largura dela. */
  ancora?: RefObject<any>;
};

export function LegendaDosAtalhos({ aberta, onFechar, ancora }: Props) {
  const so = useSistemaDoTeclado();
  const [pos, setPos] = useState<Posicao>(() => medir(ancora));
  useEffect(() => {
    if (!aberta) return;
    setPos(medir(ancora));
    if (typeof window === "undefined") return;
    const aoMudar = () => setPos(medir(ancora));
    window.addEventListener("resize", aoMudar);
    return () => window.removeEventListener("resize", aoMudar);
  }, [aberta, ancora]);

  if (!aberta) return null;
  const duasColunas = pos.width >= 560;
  const dialogo = Platform.OS === "web" ? ({ role: "dialog", "aria-label": T.titulo } as any) : {};

  return (
    <WebPortal active>
      <Pressable style={s.fundo} onPress={onFechar} accessibilityLabel={T.fechar} testID="legenda-fundo" />
      <View
        {...dialogo}
        testID="legenda-dos-atalhos"
        style={[
          s.painel,
          { top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight },
          Platform.OS === "web"
            ? ({ boxShadow: IS_DARK_MODE ? "0 24px 60px -10px rgba(0,0,0,0.7)" : "0 24px 60px -10px rgba(124,58,237,0.22)" } as any)
            : null,
        ]}
      >
        <View style={s.cabeca}>
          <Text style={s.titulo}>{T.titulo}</Text>
          <Text style={s.subtitulo}>{T.subtitulo}</Text>
          <View style={{ flex: 1 }} />
          <Pressable onPress={onFechar} style={s.x} accessibilityRole="button" accessibilityLabel={T.fechar} testID="legenda-fechar">
            <Icon name="x" size={14} color={Colors.ink3} />
          </Pressable>
        </View>
        <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={s.grade}>
          {LEGENDA_DOS_ATALHOS.map(g => (
            <View key={g.numero} style={[s.grupo, duasColunas ? s.grupoMeio : s.grupoInteiro]} testID={"legenda-grupo-" + g.numero}>
              <View style={s.grupoCabeca}>
                <View style={s.numero}><Text style={s.numeroTxt}>{g.numero}</Text></View>
                <Text style={s.grupoTitulo}>{g.titulo}</Text>
              </View>
              {g.linhas.map(l => (
                <View key={l.texto} style={s.linha} testID="legenda-linha">
                  <Text style={s.linhaTxt}>{l.texto}</Text>
                  <View style={s.teclas}>
                    {pedacosDaLinha(l, so).map((p, i) => p.tecla
                      ? <EtiquetaDeTecla key={i} texto={p.tecla} sempre />
                      : <Text key={i} style={s.palavra}>{p.palavra}</Text>)}
                  </View>
                </View>
              ))}
            </View>
          ))}
          <View style={s.rodape}>
            <Icon name="info" size={14} color={Colors.violet3} />
            <Text style={s.rodapeTxt}>{T.rodape}</Text>
          </View>
        </ScrollView>
      </View>
    </WebPortal>
  );
}

/** O botão "Atalhos" ao lado da busca (só com mouse e teclado). */
export function BotaoDosAtalhos({ aberta, onPress }: { aberta: boolean; onPress: () => void }) {
  const teclado = useTemTeclado();
  if (!teclado) return null;
  return (
    <Pressable
      onPress={onPress}
      style={[s.botao, aberta && s.botaoAberto]}
      accessibilityRole="button"
      accessibilityLabel={T.botaoA11y}
      accessibilityState={{ expanded: aberta }}
      testID="pdv-botao-atalhos"
      {...(Platform.OS === "web" ? ({ className: "caixa-chip" } as any) : {})}
    >
      <Text style={s.botaoTxt}>{T.botao}</Text>
      <EtiquetaDeTecla acao="legenda" />
    </Pressable>
  );
}

/** A linha embaixo da busca, com texto digitado e resultado na grade. */
export function DicaDaBusca({ visivel }: { visivel: boolean }) {
  const teclado = useTemTeclado();
  if (!teclado || !visivel) return null;
  return (
    <View style={s.dica} testID="pdv-dica-da-busca">
      <EtiquetaDeTecla campo="adicionarDestacado" />
      <Text style={s.dicaTxt}>{T.dicaEnter}</Text>
      <Text style={s.dicaTxt}>·</Text>
      <EtiquetaDeTecla texto="↑" />
      <EtiquetaDeTecla texto="↓" />
      <Text style={s.dicaTxt}>{T.dicaSetas}</Text>
      <Text style={s.dicaTxt}>·</Text>
      <EtiquetaDeTecla campo="limparBusca" />
      <Text style={s.dicaTxt}>{T.dicaEsc}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  botao: {
    flexDirection: "row", alignItems: "center", gap: 8, height: 44, paddingHorizontal: 12,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg3, flexShrink: 0,
  },
  botaoAberto: { backgroundColor: Colors.violetD, borderColor: "rgba(124,58,237,0.48)" },
  botaoTxt: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  dica: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: -4, marginBottom: 10 },
  dicaTxt: { fontSize: 12, color: Colors.ink2 },
  fundo: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "transparent" } as any,
  painel: {
    position: "absolute",
    paddingTop: 16, paddingBottom: 12, paddingHorizontal: 18,
    borderRadius: 14, borderWidth: 1, borderColor: "rgba(124,58,237,0.48)",
    backgroundColor: Platform.OS === "web" ? (Glass.pop as any) : Colors.bg3,
  } as any,
  cabeca: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  titulo: { fontSize: 15, fontWeight: "700", color: Colors.ink },
  subtitulo: { fontSize: 12, color: Colors.ink3 },
  x: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  grade: { flexDirection: "row", flexWrap: "wrap", columnGap: 26, rowGap: 14 } as any,
  grupo: { minWidth: 0 },
  grupoMeio: { width: "47%" as any, flexGrow: 1 },
  grupoInteiro: { width: "100%" as any },
  grupoCabeca: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  numero: { width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center" },
  numeroTxt: { fontSize: 11, fontWeight: "700", color: Colors.violet3 },
  grupoTitulo: { fontSize: 11, fontWeight: "700", letterSpacing: 1.1, textTransform: "uppercase", color: Colors.violet3 },
  linha: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10,
    minHeight: 26, paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  linhaTxt: { flex: 1, minWidth: 0, fontSize: 12.5, color: Colors.ink2 },
  teclas: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 0 },
  palavra: { fontSize: 11, color: Colors.ink3 },
  rodape: { width: "100%" as any, flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 4 },
  rodapeTxt: { flex: 1, fontSize: 12, color: Colors.ink2, lineHeight: 18 },
});

export default LegendaDosAtalhos;
