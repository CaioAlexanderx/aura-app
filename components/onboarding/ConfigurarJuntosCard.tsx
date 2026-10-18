import { useState } from "react";
import { View, Text, Pressable, StyleSheet, Linking, Platform } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { useAuthStore } from "@/stores/auth";
import { useVisibleModules } from "@/hooks/useVisibleModules";
import {
  MOD_CONFIGURAR_JUNTOS, TEXTOS_CONFIGURAR_JUNTOS, linkConfigurarJuntos,
} from "@/constants/configurarJuntos";
import {
  lerSetupCall, setupCallApi, setupCallQueryKey, type SetupCallAcao, type SetupCallEstado,
} from "@/services/setupCallApi";

// ============================================================
// Oferta "vamos configurar juntos" (18/10/2026, card f2-04)
//
// Cartão NO FLUXO do Painel, logo abaixo dos primeiros passos (não é modal
// nem banner flutuante). Para quem acabou de se cadastrar: uma conversa de 20
// minutos com o time da Aura para deixar o Caixa e o estoque prontos.
//
//   · "Marcar pelo WhatsApp" abre o wa.me da Aura com o texto pronto (aberto
//     no mesmo toque, antes de qualquer espera de rede, senão o navegador
//     bloqueia o pop-up) e avisa o servidor (onboarding.setup_call_requested).
//   · "Agora não" some com o cartão para aquela conta (servidor grava
//     onboarding.setup_call_dismissed; some na hora, sem esperar a rede).
//
// Quem decide se aparece é o servidor (`disponivel`): não aparece para staff,
// conta que já assina, cadastro antigo, filial nem quem já respondeu. Aqui o
// cartão ainda some na visão consolidada multi-CNPJ (a oferta é por empresa),
// em demo, sem o módulo visível (membro sem permissão de configurações) e
// quando o GET falha ou a rota não existe.
// ============================================================

type Fase = "oferta" | "aberto" | "fechado";

/** Abre o link num toque só. Web: nova aba, síncrono. Nativo: Linking. */
function abrirLink(url: string) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && typeof window.open === "function") window.open(url, "_blank", "noopener");
  } else {
    Linking.openURL(url).catch(() => {});
  }
}

export function ConfigurarJuntosCard() {
  const C = useColors();
  const qc = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const company = useAuthStore((s) => s.company);
  const isStaff = useAuthStore((s) => s.isStaff);
  const isDemo = useAuthStore((s) => s.isDemo);
  const consolidado = useAuthStore((s) => s.consolidatedView);
  const visiveis = useVisibleModules();
  const [fase, setFase] = useState<Fase>("oferta");

  const cid = company?.id || null;
  const pode = !!token && !!cid && !isStaff && !isDemo && !consolidado && visiveis.has(MOD_CONFIGURAR_JUNTOS);

  const { data } = useQuery<SetupCallEstado | null>({
    queryKey: setupCallQueryKey(cid),
    enabled: pode,
    retry: false,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      try {
        return lerSetupCall(await setupCallApi.get(cid as string));
      } catch {
        return null;
      }
    },
  });

  if (!pode || !data || fase === "fechado") return null;
  // Depois de tocar em "Marcar", a confirmação fica até fechar; fora isso o
  // cartão só existe enquanto o servidor diz que a oferta está disponível.
  if (fase === "oferta" && (!data.disponivel || data.solicitado || data.dispensado)) return null;

  function registrar(acao: SetupCallAcao) {
    if (!cid) return;
    // Fire-and-forget: o evento é para medir, nunca segura o toque.
    setupCallApi.registrar(cid, acao).catch(() => {});
    // O cache passa a refletir a escolha: voltar ao Painel não reabre o cartão.
    qc.setQueryData<SetupCallEstado | null>(setupCallQueryKey(cid), (atual) => (atual
      ? { ...atual, solicitado: acao === "solicitou" || atual.solicitado, dispensado: acao === "dispensou" || atual.dispensado }
      : atual));
  }

  function marcar() {
    // 1) abre o WhatsApp no mesmo toque; 2) só então fala com o servidor.
    abrirLink(linkConfigurarJuntos((company as any)?.name));
    registrar("solicitou");
    setFase("aberto");
  }

  function agoraNao() {
    registrar("dispensou");
    setFase("fechado");
  }

  if (fase === "aberto") {
    return (
      <View style={[s.card, { backgroundColor: C.bg2, borderColor: C.border2 }]} testID="configurar-juntos-aberto">
        <Text style={[s.sub, { color: C.ink2 }]}>{TEXTOS_CONFIGURAR_JUNTOS.aberto}</Text>
        <Pressable
          onPress={() => setFase("fechado")}
          accessibilityRole="button"
          style={s.link}
          testID="configurar-juntos-fechar"
        >
          <Text style={[s.linkTxt, { color: C.violet3 }]}>{TEXTOS_CONFIGURAR_JUNTOS.fechar}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[s.card, { backgroundColor: C.bg2, borderColor: C.border2 }]} testID="configurar-juntos">
      <View style={s.texto}>
        <Text
          style={[s.titulo, { color: C.ink, fontFamily: Fonts.heading }]}
          accessibilityRole="header"
          testID="configurar-juntos-titulo"
        >
          {TEXTOS_CONFIGURAR_JUNTOS.titulo}
        </Text>
        <Text style={[s.sub, { color: C.ink2 }]} testID="configurar-juntos-sub">{TEXTOS_CONFIGURAR_JUNTOS.sub}</Text>
      </View>
      <View style={s.acoes}>
        <Pressable
          onPress={marcar}
          accessibilityRole="button"
          style={[s.botao, { backgroundColor: C.violet }]}
          testID="configurar-juntos-marcar"
        >
          <Text style={s.botaoTxt}>{TEXTOS_CONFIGURAR_JUNTOS.marcar}</Text>
        </Pressable>
        <Pressable
          onPress={agoraNao}
          accessibilityRole="button"
          style={s.link}
          testID="configurar-juntos-agora-nao"
        >
          <Text style={[s.linkTxt, { color: C.ink3 }]}>{TEXTOS_CONFIGURAR_JUNTOS.agoraNao}</Text>
        </Pressable>
      </View>
    </View>
  );
}

// Sem hover: o estado dos botões é permanente (CLAUDE.md, armadilha 7).
const s = StyleSheet.create({
  card: {
    borderWidth: 1, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 20,
    flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12,
  },
  texto: { flexGrow: 1, flexShrink: 1, flexBasis: 240, minWidth: 0, gap: 3 },
  titulo: { fontSize: 15, fontWeight: "700" },
  sub: { fontSize: 13, lineHeight: 18 },
  acoes: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  botao: { borderRadius: 12, minHeight: 42, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  botaoTxt: { color: "#fff", fontSize: 13.5, fontWeight: "700" },
  link: { minHeight: 40, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  linkTxt: { fontSize: 13, fontWeight: "600", textDecorationLine: "underline" },
} as any);

export default ConfigurarJuntosCard;
