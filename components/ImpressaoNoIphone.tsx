// ============================================================
// AURA. — ImpressaoNoIphone: o aviso honesto quando imprimir não dá
//
// Criado: 22/09/2026 (PWA Fase 2)
//
// No iPhone com a Aura INSTALADA, imprimir por janela nova não funciona:
// o app instalado não tem a visualização de impressão do Safari, e a
// janela que abriria é uma janela morta. É limitação da Apple, não da
// Aura. Em vez de falhar em silêncio, mostramos o caminho: abrir a Aura
// no Safari e repetir a impressão por lá.
//
// Padrão do Toast: um store zustand que qualquer módulo aciona
// (`avisarImpressaoNoIphone()`, inclusive de services/printWindow.ts) e
// UM componente montado em GlobalOverlays que desenha a folha.
//
// Mockup: docs/mockups/pwa-fase2-offline-versao-iphone.html, tela C.
// ============================================================
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { create } from "zustand";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { ResponsiveSheet } from "@/components/ResponsiveSheet";
import { toast } from "@/components/Toast";
import { ENDERECO_DO_PAINEL } from "@/services/instalarApp";

type EstadoDoAviso = { visivel: boolean; abrir: () => void; fechar: () => void };
export const useImpressaoNoIphone = create<EstadoDoAviso>((set) => ({
  visivel: false,
  abrir: () => set({ visivel: true }),
  fechar: () => set({ visivel: false }),
}));

/** Chamado por quem tentaria abrir a janela de impressão no iPhone instalado. */
export function avisarImpressaoNoIphone(): void {
  useImpressaoNoIphone.getState().abrir();
}

const PASSOS = [
  { n: "1", titulo: "Abra a Aura no Safari", detalhe: `${ENDERECO_DO_PAINEL}, com o mesmo login.` },
  { n: "2", titulo: "Repita a impressão por lá", detalhe: "O Safari abre a visualização, e o botão Compartilhar tem “Imprimir”." },
];

export function ImpressaoNoIphoneSheet() {
  const visivel = useImpressaoNoIphone((s) => s.visivel);
  const fechar = useImpressaoNoIphone((s) => s.fechar);
  const [copiando, setCopiando] = useState(false);

  if (Platform.OS !== "web") return null;

  async function copiarEndereco() {
    setCopiando(true);
    try {
      await navigator.clipboard.writeText(`https://${ENDERECO_DO_PAINEL}`);
      toast.success("Endereço copiado. Cole no Safari.");
      fechar();
    } catch {
      toast.error(`Não foi possível copiar. O endereço é ${ENDERECO_DO_PAINEL}.`);
    } finally {
      setCopiando(false);
    }
  }

  return (
    <ResponsiveSheet visible={visivel} onClose={fechar} maxWidth={440}>
      <View style={s.header}>
        <Text style={s.titulo}>Imprimir pelo app do iPhone</Text>
        <Text style={s.sub}>
          O iPhone não deixa o app instalado abrir a impressão. É uma limitação da Apple, não da Aura. O caminho é pelo Safari:
        </Text>
      </View>
      <View style={s.lista}>
        {PASSOS.map((p) => (
          <View key={p.n} style={s.passo}>
            <View style={s.passoN}><Text style={s.passoNTexto}>{p.n}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.passoTitulo}>{p.titulo}</Text>
              <Text style={s.passoDetalhe}>{p.detalhe}</Text>
            </View>
          </View>
        ))}
      </View>
      <View style={s.rodape}>
        <Pressable onPress={fechar} style={s.btnGhost} accessibilityRole="button">
          <Text style={s.btnGhostTexto}>Agora não</Text>
        </Pressable>
        <Pressable onPress={copiarEndereco} style={s.btn} disabled={copiando} accessibilityRole="button">
          <Icon name="copy" size={14} color="#fff" />
          <Text style={s.btnTexto}>{copiando ? "Copiando..." : "Copiar endereço"}</Text>
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
  passo: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 12 },
  passoN: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border },
  passoNTexto: { color: Colors.violet3, fontWeight: "700", fontSize: 14 },
  passoTitulo: { fontSize: 14, fontWeight: "600", color: Colors.ink, lineHeight: 18 },
  passoDetalhe: { fontSize: 12, color: Colors.ink3, marginTop: 2, lineHeight: 16 },
  rodape: { flexDirection: "row", gap: 8, padding: 18, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  btn: { flex: 1, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 12 },
  btnTexto: { color: "#fff", fontSize: 14, fontWeight: "700" },
  btnGhost: { flex: 1, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border2, borderRadius: 12, paddingVertical: 12 },
  btnGhostTexto: { color: Colors.ink2, fontSize: 14, fontWeight: "600" },
});

export default ImpressaoNoIphoneSheet;
