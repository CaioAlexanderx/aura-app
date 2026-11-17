// ============================================================
// AURA. — Ajuda "Imprimir sem a janela de confirmação" (p-161, 17/11/2026)
//
// Abre pelo "veja como" do "Neste computador" da impressão automática
// (ImpressaoNesteAparelho), só no computador com "Imprimir aqui". Passo a
// passo do atalho do Chrome com --kiosk-printing, com capturas reais do
// Windows e do Chrome. No Mac, a linha do Terminal. Textos em
// textosDaAjudaSemJanela.ts.
// ============================================================
import { useState } from "react";
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { ResponsiveSheet } from "@/components/ResponsiveSheet";
import { toast } from "@/components/Toast";
import {
  COMANDO_CHROME_MAC, COMANDO_CHROME_WINDOWS, COMANDO_EDGE_WINDOWS, TEXTOS_DA_AJUDA as T, ehMac,
} from "@/components/screens/configuracoes/textosDaAjudaSemJanela";

const IMG_IMPRESSORA = require("../../../assets/ajuda/impressao/chrome-escolher-impressora.png");
const IMG_ATALHO = require("../../../assets/ajuda/impressao/windows-criar-atalho.png");
const IMG_PROPRIEDADES = require("../../../assets/ajuda/impressao/windows-propriedades-do-atalho.png");

type Props = { visivel: boolean; onFechar: () => void; mac?: boolean };

async function copiar(texto: string) {
  try {
    if (Platform.OS !== "web" || !navigator?.clipboard?.writeText) throw new Error("sem clipboard");
    await navigator.clipboard.writeText(texto);
    toast.success(T.copiado);
  } catch {
    toast.error(T.naoCopiou);
  }
}

function Linha({ texto, testID }: { texto: string; testID: string }) {
  return (
    <View style={s.cmd}>
      <Text testID={testID} selectable style={s.cmdTexto}>{texto}</Text>
      <Pressable onPress={() => copiar(texto)} style={s.cmdBtn} accessibilityRole="button" accessibilityLabel={T.copiar}>
        <Icon name="copy" size={13} color={Colors.violet3} />
        <Text style={s.cmdBtnTexto}>{T.copiar}</Text>
      </Pressable>
    </View>
  );
}

function Passo({ n, titulo, children }: { n: string; titulo: string; children: React.ReactNode }) {
  return (
    <View style={s.passo}>
      <View style={s.passoTopo}>
        <View style={s.passoN}><Text style={s.passoNTexto}>{n}</Text></View>
        <Text style={s.passoTitulo}>{titulo}</Text>
      </View>
      <View style={s.passoCorpo}>{children}</View>
    </View>
  );
}

function Foto({ fonte, proporcao, larguraMax, alt }: { fonte: any; proporcao: number; larguraMax?: number; alt: string }) {
  return (
    <View style={[s.foto, larguraMax ? { maxWidth: larguraMax, alignSelf: "center", width: "100%" } : null]}>
      <Image source={fonte} accessibilityLabel={alt} resizeMode="contain" style={{ width: "100%", aspectRatio: proporcao }} />
    </View>
  );
}

export function AjudaImprimirSemJanela({ visivel, onFechar, mac }: Props) {
  const [noMac] = useState(() => (typeof mac === "boolean" ? mac : ehMac()));

  return (
    <ResponsiveSheet visible={visivel} onClose={onFechar} maxWidth={560}>
      <View style={s.header}>
        <Text style={s.titulo}>{T.titulo}</Text>
        <Text style={s.sub}>{T.sub}</Text>
      </View>
      <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={s.lista} testID="ajuda-sem-janela">
        <Passo n="1" titulo={T.passo1Titulo}>
          <Text style={s.texto}>{T.passo1}</Text>
          <Foto fonte={IMG_IMPRESSORA} proporcao={936 / 604} alt="Janela de impressão do Chrome com o campo Destino marcado" />
        </Passo>

        {noMac ? (
          <Passo n="2" titulo={T.macTitulo}>
            <Text style={s.texto}>{T.mac}</Text>
            <Linha texto={COMANDO_CHROME_MAC} testID="ajuda-comando-mac" />
          </Passo>
        ) : (
          <>
            <Passo n="2" titulo={T.passo2Titulo}>
              <Text style={s.texto}>{T.passo2}</Text>
              <Linha texto={COMANDO_CHROME_WINDOWS} testID="ajuda-comando-chrome" />
              <Foto fonte={IMG_ATALHO} proporcao={614 / 454} alt="Assistente Criar Atalho do Windows com o endereço colado" />
              <Text style={s.textoMenor}>{T.edge}</Text>
              <Linha texto={COMANDO_EDGE_WINDOWS} testID="ajuda-comando-edge" />
            </Passo>
            <Passo n="3" titulo={T.passo3Titulo}>
              <Text style={s.texto}>{T.passo3}</Text>
            </Passo>
            <View style={s.caixa}>
              <Text style={s.caixaTitulo}>{T.outraPastaTitulo}</Text>
              <Text style={s.texto}>{T.outraPasta}</Text>
              <Linha texto={T.complementoKiosk} testID="ajuda-complemento" />
              <Foto fonte={IMG_PROPRIEDADES} proporcao={363 / 566} larguraMax={260} alt="Propriedades do atalho com o campo Destino marcado" />
            </View>
          </>
        )}

        <View style={[s.caixa, s.caixaAviso]}>
          <Text style={s.caixaTitulo}>{T.avisoTitulo}</Text>
          <Text style={s.texto}>{T.aviso}</Text>
          <Text style={[s.texto, { marginTop: 6 }]}>{T.voltar}</Text>
        </View>
      </ScrollView>
      <View style={s.rodape}>
        <Pressable onPress={onFechar} style={s.btn} accessibilityRole="button" testID="ajuda-sem-janela-fechar">
          <Text style={s.btnTexto}>{T.fechar}</Text>
        </Pressable>
      </View>
    </ResponsiveSheet>
  );
}

const s = StyleSheet.create({
  header: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 8, gap: 4 },
  titulo: { fontSize: 17, fontWeight: "700", color: Colors.ink, letterSpacing: -0.2 },
  sub: { fontSize: 13, color: Colors.ink3, lineHeight: 18 },
  lista: { paddingHorizontal: 18, paddingVertical: 10, gap: 12 },
  passo: { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 12, gap: 8 },
  passoTopo: { flexDirection: "row", alignItems: "center", gap: 10 },
  passoN: { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border },
  passoNTexto: { color: Colors.violet3, fontWeight: "700", fontSize: 13 },
  passoTitulo: { flex: 1, fontSize: 14, fontWeight: "600", color: Colors.ink },
  passoCorpo: { gap: 8 },
  texto: { fontSize: 13, color: Colors.ink2, lineHeight: 19 },
  textoMenor: { fontSize: 12, color: Colors.ink3, lineHeight: 17, marginTop: 2 },
  foto: { borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: Colors.border, backgroundColor: "#ffffff" },
  cmd: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingVertical: 8, paddingLeft: 10, paddingRight: 6 },
  cmdTexto: { flex: 1, minWidth: 0, fontSize: 11, lineHeight: 16, color: Colors.ink, fontFamily: Platform.OS === "web" ? "ui-monospace, Menlo, Consolas, monospace" : undefined },
  cmdBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: Colors.violet + "55" },
  cmdBtnTexto: { fontSize: 12, fontWeight: "700", color: Colors.violet3 },
  caixa: { borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 12, gap: 8 },
  caixaAviso: { backgroundColor: Colors.violetD },
  caixaTitulo: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  rodape: { padding: 18, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  btn: { alignItems: "center", justifyContent: "center", backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 12 },
  btnTexto: { color: "#fff", fontSize: 14, fontWeight: "700" },
});

export default AjudaImprimirSemJanela;
