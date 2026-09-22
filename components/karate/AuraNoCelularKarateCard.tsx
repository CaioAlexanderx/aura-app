// ============================================================
// AURA. — Karatê · Configurações do dojô: "Aura no celular" (PWA 2b.1)
//
// Criado: 22/09/2026
//
// A porta permanente para instalar o Aura Karatê como app. O card do shell
// (InstalarKarateCard) some depois de "Agora não" e só existe em tela de
// celular; este fica sempre aqui, para quem dispensou, para quem quer um
// segundo aparelho e para quem abriu no computador e precisa do endereço.
//
// Quatro estados, decididos por useInstalarApp():
//   instalado    → "Instalado neste celular" + aviso de solicitação (no
//                  iPhone ele SÓ funciona com o app instalado, então é
//                  aqui que ele ganha destaque) + endereço p/ outro aparelho
//   podeInstalar → botão Instalar (convite nativo do Chrome)
//   ehIphone     → botão "Ver como instalar" (guia Shoji)
//   senão        → computador sem convite: só o endereço para o celular
//
// O aviso reaproveita services/webPush.ts — o mesmo fluxo do sino do
// Karatê. Nada novo de push aqui.
//
// Mockup: docs/mockups/pwa-2b1-karate-instalar.html, tela C.
//
// 22/09/2026 — ganhou a linha "Versão do app" (o botão Atualizar), FORA dos
// quatro estados acima: ela vale instalado ou não. No app instalado não
// existe barra de endereço, logo não existe F5. A lógica e o TEXTO são os
// mesmos do varejo (hooks/useAtualizarApp); só a roupa é Shoji. Tirei daqui
// o "Atualizações chegam sozinhas": elas chegam, mas só na próxima vez que
// o app abre de verdade, e prometer o que o botão existe para resolver é
// mentir na cara do sensei.
// ============================================================
import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from "react-native";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { KarateColors, KarateFonts, ShojiPalette } from "@/constants/karateTheme";
import { useInstalarApp } from "@/hooks/useInstalarApp";
import { isMicrositeHost } from "@/utils/microsite";
import { GuiaInstalarKarate } from "@/components/karate/GuiaInstalarKarate";
import { detalheDaAtualizacao, rotuloDaAtualizacao, useAtualizarApp } from "@/hooks/useAtualizarApp";
import { ativarAviso, desativarAviso, estadoDoAviso, type EstadoDoAviso } from "@/services/webPush";

export function AuraNoCelularKarateCard() {
  const company = useAuthStore((s) => s.company) as any;
  const { instalado, podeInstalar, ehIphone, instalar, enderecoDoPainel } = useInstalarApp();
  const [guiaAberto, setGuiaAberto] = useState(false);
  const [instalando, setInstalando] = useState(false);

  if (Platform.OS !== "web") return null;
  if (isMicrositeHost()) return null;

  async function aoInstalar() {
    setInstalando(true);
    try {
      const r = await instalar();
      if (r === "aceito") toast.success("Aura Karatê instalado! Procure o ícone na tela inicial.");
      else if (r === "indisponivel") toast.error("O navegador não ofereceu a instalação agora. Tente de novo mais tarde.");
    } finally {
      setInstalando(false);
    }
  }

  return (
    <View style={s.card}>
      <Text style={s.cab}>Aura no celular</Text>

      {instalado ? (
        <>
          <View style={s.linha}>
            <View style={[s.selo, s.seloOk]}>
              <Icon name="check" size={19} color={ShojiPalette.paperWarm} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.titulo}>Instalado neste celular</Text>
              <Text style={s.descricao}>Você está usando o Aura Karatê pelo app.</Text>
            </View>
          </View>
          <LinhaDoAviso companyId={company?.id} />
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitulo}>Instalar em outro aparelho</Text>
              <Text style={s.rowDetalhe}>Abra {enderecoDoPainel} no celular e toque em Instalar.</Text>
            </View>
          </View>
        </>
      ) : podeInstalar || ehIphone ? (
        <>
          <View style={s.linha}>
            <View style={s.selo}><Text style={s.seloTxt}>空</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.titulo}>{ehIphone ? "Instalar no iPhone" : "Instalar neste aparelho"}</Text>
              <Text style={s.descricao}>
                {ehIphone
                  ? "Ícone na tela inicial, tela cheia e aviso de solicitação, que no iPhone só funciona assim."
                  : "Abre em tela cheia, como app, e avisa quando chega solicitação."}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={ehIphone ? () => setGuiaAberto(true) : aoInstalar}
            style={s.btn}
            disabled={instalando}
            accessibilityRole="button"
          >
            <Text style={s.btnTxt}>{ehIphone ? "Ver como instalar" : instalando ? "Abrindo..." : "Instalar"}</Text>
          </Pressable>
          <GuiaInstalarKarate visible={guiaAberto} onClose={() => setGuiaAberto(false)} />
        </>
      ) : (
        <View style={s.linha}>
          <View style={s.selo}><Text style={s.seloTxt}>空</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.titulo}>Leve o Aura Karatê para o celular</Text>
            <Text style={s.descricao}>
              Abra <Text style={s.endereco}>{enderecoDoPainel}</Text> no navegador do celular e toque em Instalar.
              Ícone na tela inicial, tela cheia e aviso de solicitação.
            </Text>
          </View>
        </View>
      )}

      <LinhaDeAtualizacao />
    </View>
  );
}

// ------------------------------------------------------------
// Versão do app: verifica e recarrega. No app instalado é a ÚNICA saída
// para um bundle velho — lá não tem barra de endereço, não tem recarregar.
// Mesma lógica e mesmo texto do varejo; só a roupa é Shoji.
// ------------------------------------------------------------
function LinhaDeAtualizacao() {
  const { estado, atualizar, ocupado } = useAtualizarApp();

  return (
    <View style={s.row}>
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitulo}>Versão do app</Text>
        <Text style={s.rowDetalhe}>{detalheDaAtualizacao(estado)}</Text>
      </View>
      <Pressable
        onPress={atualizar}
        disabled={ocupado}
        style={[s.pill, estado === "atualizado" ? s.pillOn : s.pillNeutro]}
        accessibilityRole="button"
        accessibilityLabel="Atualizar o Aura Karatê para a versão mais nova"
      >
        <Text style={[s.pillTxt, { color: estado === "atualizado" ? KarateColors.ok : KarateColors.ink2 }]}>
          {rotuloDaAtualizacao(estado)}
        </Text>
      </Pressable>
    </View>
  );
}

// ------------------------------------------------------------
// Aviso de solicitação: liga/desliga o Web Push desta conta neste
// aparelho. Só aparece quando o navegador suporta.
// ------------------------------------------------------------
function LinhaDoAviso({ companyId }: { companyId?: string }) {
  const [estado, setEstado] = useState<EstadoDoAviso | "carregando">("carregando");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    estadoDoAviso().then((e) => { if (vivo) setEstado(e); }).catch(() => { if (vivo) setEstado("indisponivel"); });
    return () => { vivo = false; };
  }, []);

  if (estado === "indisponivel" || estado === "carregando") return null;

  async function alternar() {
    if (!companyId) return;
    setOcupado(true);
    try {
      const novo = estado === "ativo" ? await desativarAviso(companyId) : await ativarAviso(companyId);
      setEstado(novo);
      if (novo === "ativo") toast.success("Aviso de solicitação ligado neste aparelho.");
      else if (novo === "bloqueado") toast.error("O navegador bloqueou as notificações. Libere nas configurações do site.");
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível alterar o aviso agora.");
    } finally {
      setOcupado(false);
    }
  }

  const ligado = estado === "ativo";
  return (
    <View style={s.row}>
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitulo}>Aviso de solicitação</Text>
        <Text style={s.rowDetalhe}>
          {estado === "bloqueado"
            ? "Bloqueado pelo navegador. Libere as notificações do site para ligar."
            : "Toca e mostra na tela, mesmo com o app fechado."}
        </Text>
      </View>
      {estado === "bloqueado" ? (
        <View style={[s.pill, s.pillOff]}><Text style={[s.pillTxt, { color: KarateColors.warn }]}>Bloqueado</Text></View>
      ) : (
        <Pressable onPress={alternar} disabled={ocupado || !companyId} style={[s.pill, ligado ? s.pillOn : s.pillOff]} accessibilityRole="button">
          <Text style={[s.pillTxt, { color: ligado ? KarateColors.ok : KarateColors.warn }]}>
            {ocupado ? "..." : ligado ? "Ligado" : "Ligar"}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: ShojiPalette.glassHi,
    borderWidth: 1, borderColor: ShojiPalette.line2,
    borderRadius: 4, padding: 13, gap: 2,
  } as ViewStyle,
  cab: {
    fontFamily: KarateFonts.body, fontSize: 10, fontWeight: "700",
    letterSpacing: 1.6, textTransform: "uppercase", color: ShojiPalette.red2, marginBottom: 7,
  } as TextStyle,
  linha: { flexDirection: "row", alignItems: "flex-start", gap: 11, paddingVertical: 5 } as ViewStyle,
  selo: { width: 40, height: 40, borderRadius: 3, alignItems: "center", justifyContent: "center", backgroundColor: ShojiPalette.headRed } as ViewStyle,
  seloOk: { backgroundColor: KarateColors.ok } as ViewStyle,
  seloTxt: { fontFamily: KarateFonts.heading, fontSize: 20, color: ShojiPalette.paperWarm } as TextStyle,
  titulo: { fontFamily: KarateFonts.heading, fontWeight: "600", fontSize: 14, color: KarateColors.ink, lineHeight: 19 } as TextStyle,
  descricao: { fontFamily: KarateFonts.body, fontSize: 12, color: KarateColors.ink2, lineHeight: 17, marginTop: 3 } as TextStyle,
  endereco: { color: ShojiPalette.red2, fontWeight: "700" } as TextStyle,
  btn: { alignSelf: "flex-start", backgroundColor: ShojiPalette.ink, borderRadius: 3, paddingVertical: 9, paddingHorizontal: 14, marginTop: 8 } as ViewStyle,
  btnTxt: { fontFamily: KarateFonts.body, color: ShojiPalette.paperWarm, fontSize: 12.5, fontWeight: "700" } as TextStyle,
  row: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 9, borderTopWidth: 1, borderTopColor: ShojiPalette.line, marginTop: 4,
  } as ViewStyle,
  rowTitulo: { fontFamily: KarateFonts.body, fontSize: 12.5, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  rowDetalhe: { fontFamily: KarateFonts.body, fontSize: 11, color: KarateColors.ink3, marginTop: 2, lineHeight: 15 } as TextStyle,
  pill: { borderRadius: 999, paddingVertical: 4, paddingHorizontal: 9, borderWidth: 1 } as ViewStyle,
  pillOn: { backgroundColor: KarateColors.okSoft, borderColor: ShojiPalette.okLine } as ViewStyle,
  pillOff: { backgroundColor: KarateColors.warnSoft, borderColor: ShojiPalette.line2 } as ViewStyle,
  pillNeutro: { backgroundColor: ShojiPalette.glassHi, borderColor: ShojiPalette.line2 } as ViewStyle,
  pillTxt: { fontFamily: KarateFonts.body, fontSize: 10, fontWeight: "700" } as TextStyle,
});

export default AuraNoCelularKarateCard;
