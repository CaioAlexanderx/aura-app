import { View, Text, Pressable, StyleSheet, Linking, Platform } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useColors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { authApi } from "@/services/api";
import {
  handshakeDoMe, linkDoHandshake, TEXTOS_ZAP_NO_PAINEL, type HandshakeDoMe,
} from "@/utils/whatsappDoCadastro";

// ============================================================
// Faixa "Seu WhatsApp ainda não foi confirmado" no Painel (tq-115, 26/10/2026)
//
// O cadastro cria um código AURA-XXXX para a pessoa mandar no WhatsApp da
// Aura (tq-66/tq-69). Quem não mandou, ou mandou e a equipe ainda não
// confirmou, vê esta faixa discreta no fluxo do Painel, com o botão que abre
// o wa.me da Aura (constants/suporteAura) com o código já escrito.
//
//   · Uma leitura do /auth/me ao abrir o Painel (staleTime infinito, sem
//     polling, sem refetch no foco). O backend só devolve o handshake ao
//     dono da empresa; membro, conta antiga e dojô recebem null.
//   · Some quando o estado é 'confirmado', na visão consolidada (o código é
//     por empresa), em demo, para staff e quando a leitura falha.
//   · Sem "dispensar": a confirmação é da equipe; a faixa some sozinha
//     quando ela confirma e o Painel é aberto de novo.
// ============================================================

/** Abre o link num toque só. Web: nova aba, síncrono. Nativo: Linking. */
function abrirLink(url: string) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && typeof window.open === "function") window.open(url, "_blank", "noopener");
  } else {
    Linking.openURL(url).catch(() => {});
  }
}

export const zapNoPainelQueryKey = (cid: string | null) => ["whatsapp-handshake", cid];

export function WhatsappNaoConfirmadoFaixa() {
  const C = useColors();
  const token = useAuthStore((s) => s.token);
  const company = useAuthStore((s) => s.company);
  const isStaff = useAuthStore((s) => s.isStaff);
  const isDemo = useAuthStore((s) => s.isDemo);
  const consolidado = useAuthStore((s) => s.consolidatedView);

  const cid = company?.id || null;
  const pode = !!token && !!cid && !isStaff && !isDemo && !consolidado;

  const { data } = useQuery<HandshakeDoMe | null>({
    queryKey: zapNoPainelQueryKey(cid),
    enabled: pode,
    retry: false,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      try {
        return handshakeDoMe(await authApi.meSession());
      } catch {
        return null;
      }
    },
  });

  if (!pode || !data || data.estado === "confirmado") return null;

  return (
    <View style={[s.faixa, { backgroundColor: C.bg2, borderColor: C.border2 }]} testID="zap-nao-confirmado">
      <View style={s.texto}>
        <Text style={[s.titulo, { color: C.ink }]} testID="zap-nao-confirmado-titulo">{TEXTOS_ZAP_NO_PAINEL.titulo}</Text>
        <Text style={[s.sub, { color: C.ink3 }]} testID="zap-nao-confirmado-sub">{TEXTOS_ZAP_NO_PAINEL.sub(data.codigo)}</Text>
      </View>
      <Pressable
        onPress={() => abrirLink(linkDoHandshake(data.codigo))}
        accessibilityRole="button"
        style={[s.botao, { borderColor: C.violet3 }]}
        testID="zap-nao-confirmado-abrir"
      >
        <Text style={[s.botaoTxt, { color: C.violet3 }]}>{TEXTOS_ZAP_NO_PAINEL.botao}</Text>
      </Pressable>
    </View>
  );
}

// Sem hover: o estado do botão é permanente (CLAUDE.md, armadilha 7).
const s = StyleSheet.create({
  faixa: {
    borderWidth: 1, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 16,
    flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12,
  },
  texto: { flexGrow: 1, flexShrink: 1, flexBasis: 220, minWidth: 0, gap: 2 },
  titulo: { fontSize: 13, fontWeight: "700" },
  sub: { fontSize: 12, lineHeight: 17 },
  botao: { borderWidth: 1, borderRadius: 10, minHeight: 36, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  botaoTxt: { fontSize: 12.5, fontWeight: "700" },
} as any);

export default WhatsappNaoConfirmadoFaixa;
