// ============================================================
// TelefoneDaFicha — Aura · Crediário (F2 do redesenho da ficha, 23/11/2026)
//
// Pedido do Caio (21/11): o telefone do cadastro à vista no cabeçalho da
// ficha e "Editar cliente" sem ir para a página Clientes (mockup aprovado,
// seção f). A lista do crediário tirou o telefone dizendo que ele "vive na
// ficha" — e a ficha não mostrava.
//
//  - Tela larga: toque no número copia ("Telefone copiado"); ao lado, "Abrir
//    WhatsApp" (conversa vazia pelo wa.me; a cobrança pronta é o "Cobrar") e
//    "✎ Editar cliente".
//  - Celular (< 768 px): o toque no número abre três opções logo abaixo —
//    Copiar número, Abrir conversa no WhatsApp, Ligar. Nada de hover.
//  - Sem telefone: "Sem telefone · adicionar", que abre o Editar cliente já
//    no campo do telefone.
// ============================================================
import { useState } from "react";
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { Colors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { copyText } from "@/utils/clipboard";
import { formatarTelefone } from "@/utils/telefone";
import { buildTelUrl, buildWhatsAppUrl, openWhatsApp, openTel } from "@/utils/whatsapp";

export type TelefoneDaFichaProps = {
  phone: string | null | undefined;
  /** Abre a edição do cadastro. `focoNoTelefone` = veio do "adicionar". */
  onEditar?: (focoNoTelefone: boolean) => void;
};

export const LARGURA_DO_CELULAR = 768;

export function TelefoneDaFicha({ phone, onEditar }: TelefoneDaFichaProps) {
  const { width } = useWindowDimensions();
  const celular = width < LARGURA_DO_CELULAR;
  const [opcoes, setOpcoes] = useState(false);
  const numero = formatarTelefone(phone || "");
  const temTelefone = !!numero;
  // Número que o wa.me não aceita (curto, DDI estrangeiro): sem o atalho.
  const abreWhatsApp = temTelefone && !!buildWhatsAppUrl(phone);
  // Idem para o discador: número inválido não tem "Ligar".
  const daParaLigar = temTelefone && !!buildTelUrl(phone);

  function copiar() {
    setOpcoes(false);
    copyText(numero, "Telefone copiado");
  }
  function abrirConversa() {
    setOpcoes(false);
    // Síncrono no toque: o navegador bloqueia o pop-up depois de um await.
    openWhatsApp(phone);
  }
  function ligar() {
    setOpcoes(false);
    openTel(phone);
  }

  return (
    <View>
      <View style={s.linha}>
        {temTelefone ? (
          <Pressable
            style={({ pressed }: any) => [s.tel, (pressed || opcoes) && s.telOn]}
            onPress={celular ? () => setOpcoes(v => !v) : copiar}
            accessibilityRole="button"
            accessibilityLabel={celular ? `Telefone ${numero}. Toque para ver as opções` : `Telefone ${numero}. Toque para copiar`}
            accessibilityState={celular ? { expanded: opcoes } : undefined}
            testID="ficha-telefone"
          >
            <Text style={s.telNum}>{numero}</Text>
            <Text style={s.telAcao}>{celular ? "⌄" : "copiar"}</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[s.tel, s.telSem]}
            onPress={() => onEditar?.(true)}
            disabled={!onEditar}
            accessibilityRole="button"
            testID="ficha-sem-telefone"
          >
            <Text style={[s.telNum, { color: Colors.ink3 }]}>Sem telefone ·</Text>
            {!!onEditar && <Text style={s.telAcao}>adicionar</Text>}
          </Pressable>
        )}
        {temTelefone && abreWhatsApp && !celular && (
          <Pressable style={s.link} onPress={abrirConversa} accessibilityRole="button" testID="ficha-abrir-whatsapp">
            <Text style={s.linkTxt}>Abrir WhatsApp</Text>
          </Pressable>
        )}
        {!!onEditar && (
          <Pressable style={s.link} onPress={() => onEditar(false)} accessibilityRole="button" testID="ficha-editar-cliente">
            <Text style={s.linkTxt}>✎ Editar cliente</Text>
          </Pressable>
        )}
      </View>

      {celular && opcoes && temTelefone && (
        <View style={s.menu} testID="ficha-telefone-opcoes">
          <Pressable style={s.menuItem} onPress={copiar} accessibilityRole="button" testID="ficha-copiar">
            <Text style={s.menuTxt}>Copiar número</Text>
          </Pressable>
          {abreWhatsApp && (
            <Pressable style={s.menuItem} onPress={abrirConversa} accessibilityRole="button" testID="ficha-abrir-whatsapp">
              <Text style={s.menuTxt}>Abrir conversa no WhatsApp</Text>
            </Pressable>
          )}
          {daParaLigar && (
            <Pressable style={s.menuItem} onPress={ligar} accessibilityRole="button" testID="ficha-ligar">
              <Text style={s.menuTxt}>Ligar</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  linha: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4, marginTop: 4 },
  // Alvo de toque de 44 px.
  tel: {
    flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44,
    paddingHorizontal: 9, borderRadius: 8, borderWidth: 1, borderColor: Colors.border,
  },
  telOn: { borderColor: Colors.violet2, backgroundColor: Colors.violetD },
  telSem: { borderStyle: "dashed" },
  telNum: { fontFamily: Fonts.body, fontSize: 12.5, color: Colors.ink2, fontVariant: ["tabular-nums"] as any },
  telAcao: { fontFamily: Fonts.body, fontSize: 11, fontWeight: "700", color: Colors.violet3 },
  link: { minHeight: 44, justifyContent: "center", paddingHorizontal: 8, borderRadius: 8 },
  linkTxt: { fontFamily: Fonts.body, fontSize: 12.5, fontWeight: "700", color: Colors.violet3 },
  menu: {
    marginTop: 6, padding: 4, borderRadius: 11, gap: 2, alignSelf: "flex-start", minWidth: 220,
    borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg3,
  },
  menuItem: { minHeight: 44, justifyContent: "center", paddingHorizontal: 10, borderRadius: 8 },
  menuTxt: { fontFamily: Fonts.body, fontSize: 13, fontWeight: "600", color: Colors.ink },
});

export default TelefoneDaFicha;
