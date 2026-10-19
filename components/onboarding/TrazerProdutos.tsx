// ============================================================
// AURA. — "Como você quer trazer seus produtos?" (19/10/2026, card tq-34)
//
// Quadro 2 do "caminho proposto" no mockup aprovado pelo Caio
// (claude.ai/artifact/WjWnEitYY49kPCapdY4hcV). O check-in leva aqui quem
// tem de 51 a 300 produtos, anota no caderno ou ainda não anota. Três
// cartões tocáveis (regras e destinos em utils/trazerProdutos.ts):
//
//   · Um por um   → cadastro do produto (/estoque?novo=produto&depois=pdv);
//   · Quero ajuda → wa.me da Aura com a mensagem pronta, no MESMO toque
//                   (senão o navegador bloqueia a aba nova), e o cadastro
//                   um por um: começa pelo primeiro produto enquanto o resto
//                   chega. Etiqueta "Sugerido para 51 a 300 produtos" só
//                   quando o check-in respondeu essa faixa ou "Caderno";
//   · Planilha    → "Baixar modelo" (o mesmo do app#1109) e o convite
//                   "Importar sua planilha" do Estoque.
//
// Tela cheia sem item no NAV, como o /checkin; chave própria
// `onboarding.trazer_produtos` (Essencial). Só tela e roteamento: nada de
// venda, estoque, importação ou impressão muda aqui.
//
// Recarga direto na rota (mesma proteção do INC-2026-10-19-02, app#1110):
// nada navega antes da sessão restaurada (isHydrated) e do navegador raiz
// montado (useRootNavigationState().key). O plano do JWT pode estar velho
// (CLAUDE.md, armadilha 1): revalida o /auth/me ao montar e só manda ao
// Painel por falta de módulo depois disso (com limite, nunca prende).
//
// Visão consolidada (multi-CNPJ): trazer produtos é de UMA loja, como o
// check-in; no consolidado a tela vai ao Painel.
//
// Sem hover (CLAUDE.md, armadilha 7): o cartão sugerido fica marcado o
// tempo todo, não ao passar o mouse.
// ============================================================
import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, Linking, Platform } from "react-native";
import { useRootNavigationState, useRouter } from "expo-router";
import { useColors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { useVisibleModules } from "@/hooks/useVisibleModules";
import { useCheckin } from "@/hooks/useCheckin";
import { TEXTOS_CHECKIN } from "@/constants/checkin";
import { MOD_TRAZER_PRODUTOS, TEXTOS_TRAZER_PRODUTOS as T } from "@/constants/trazerProdutos";
import { ROTA_PAINEL } from "@/utils/checkinDestino";
import { acaoPlanilha, acaoQueroAjuda, acaoUmPorUm, mostrarSugerido, type AcaoTrazerProdutos } from "@/utils/trazerProdutos";
import { BaixarModelo } from "@/components/screens/estoque/BaixarModelo";

/** Quanto a tela espera o /auth/me antes de decidir por módulo. */
export const LIMITE_DA_REVALIDACAO_MS = 4000;

/** Abre o link num toque só. Web: nova aba, síncrono. Nativo: Linking. */
function abrirLink(url: string) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && typeof window.open === "function") window.open(url, "_blank", "noopener");
  } else {
    Linking.openURL(url).catch(() => {});
  }
}

export function TrazerProdutos() {
  const C = useColors();
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const company = useAuthStore((s) => s.company);
  const consolidado = useAuthStore((s) => s.consolidatedView);
  // Recarga direto em /trazer-produtos: nada antes da sessão e do navegador raiz.
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const navState = useRootNavigationState();
  const pronta = !!isHydrated && navState?.key != null;
  const companyId = company?.id || null;
  const modulos = useVisibleModules();
  // As respostas do check-in (para a etiqueta "Sugerido"): o cache do
  // Continuar ou, numa recarga, o GET de sempre.
  const { data: checkin } = useCheckin(companyId, !!isHydrated && !!companyId);

  const [revalidado, setRevalidado] = useState(false);
  const pediuRevalidacao = useRef(false);
  const saindo = useRef(false);
  // Toque duplo não empilha duas telas; voltar a esta tela libera de novo.
  const tocouEm = useRef(0);

  // Plano stale no JWT (armadilha 1): revalida uma vez, com a sessão de volta.
  useEffect(() => {
    if (!isHydrated || pediuRevalidacao.current) return;
    pediuRevalidacao.current = true;
    const st: any = useAuthStore.getState?.() || {};
    const pedido = typeof st.refreshMe === "function" && st.token
      ? Promise.resolve().then(() => st.refreshMe()).catch(() => {})
      : Promise.resolve();
    let vivo = true;
    Promise.race([pedido, new Promise((r) => setTimeout(r, LIMITE_DA_REVALIDACAO_MS))])
      .then(() => { if (vivo) setRevalidado(true); });
    return () => { vivo = false; };
  }, [isHydrated]);

  const permitida = !!companyId && !consolidado && modulos.has(MOD_TRAZER_PRODUTOS) && modulos.has("estoque");

  // Sem empresa, consolidado ou sem o módulo: Painel. Sem sessão nenhuma, o
  // layout raiz já leva ao login; esta tela não disputa a navegação.
  useEffect(() => {
    if (!pronta || !revalidado || !token || permitida || saindo.current) return;
    saindo.current = true;
    router.replace(ROTA_PAINEL as any);
  }, [pronta, revalidado, token, permitida, router]);

  function ir(acao: AcaoTrazerProdutos) {
    if (!pronta || saindo.current) return;
    const agora = Date.now();
    if (agora - tocouEm.current < 1000) return;
    tocouEm.current = agora;
    // wa.me no mesmo toque, antes da navegação.
    if (acao.whatsapp) abrirLink(acao.whatsapp);
    router.push(acao.rota as any);
  }

  if (!pronta || !permitida) {
    return (
      <View style={[s.centro, { backgroundColor: C.bg }]} testID="trazer-carregando">
        <ActivityIndicator color={C.violet3} />
      </View>
    );
  }

  const respostas = checkin?.respostas || null;
  const sugerido = mostrarSugerido(respostas);
  const loja = (company as any)?.name || null;

  const seta = <Icon name="chevron-forward" size={16} color={C.ink3} />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={s.conteudo} testID="trazer-raiz">
      <View style={[s.cartao, { backgroundColor: C.bg, borderColor: C.border2 }]}>
        <Text style={[s.marca, { color: C.ink, fontFamily: Fonts.heading }]}>{TEXTOS_CHECKIN.marca}</Text>
        <Text style={[s.titulo, { color: C.ink, fontFamily: Fonts.heading }]} accessibilityRole="header">{T.titulo}</Text>

        <View style={s.opcoes}>
          <Pressable
            onPress={() => ir(acaoUmPorUm(modulos))}
            accessibilityRole="button"
            accessibilityLabel={T.umPorUm.titulo + ". " + T.umPorUm.sub}
            style={[s.opcao, { borderColor: C.border2, backgroundColor: C.bg2 }]}
            testID="trazer-um-por-um"
          >
            <View style={s.opcaoTxt}>
              <Text style={[s.opcaoTitulo, { color: C.ink }]}>{T.umPorUm.titulo}</Text>
              <Text style={[s.opcaoSub, { color: C.ink2 }]}>{T.umPorUm.sub}</Text>
            </View>
            {seta}
          </Pressable>

          <Pressable
            onPress={() => ir(acaoQueroAjuda(modulos, loja, respostas))}
            accessibilityRole="button"
            accessibilityLabel={T.ajuda.titulo + ". " + (sugerido ? T.ajuda.sugerido + ". " : "") + T.ajuda.sub}
            style={[
              s.opcao,
              { borderColor: C.border2, backgroundColor: C.bg2 },
              sugerido && { borderColor: C.violet, backgroundColor: C.violetD },
            ]}
            testID="trazer-ajuda"
          >
            <View style={s.opcaoTxt}>
              <Text style={[s.opcaoTitulo, { color: C.ink }]}>{T.ajuda.titulo}</Text>
              {sugerido && (
                <View style={[s.etiqueta, { backgroundColor: C.violetD, borderColor: C.violet }]} testID="trazer-sugerido">
                  <Text style={[s.etiquetaTxt, { color: C.violet3 }]}>{T.ajuda.sugerido}</Text>
                </View>
              )}
              <Text style={[s.opcaoSub, { color: C.ink2 }]}>{T.ajuda.sub}</Text>
            </View>
            {seta}
          </Pressable>

          <View style={[s.opcaoCaixa, { borderColor: C.border2, backgroundColor: C.bg2 }]}>
            <Pressable
              onPress={() => ir(acaoPlanilha())}
              accessibilityRole="button"
              accessibilityLabel={T.planilha.titulo + ". " + T.planilha.sub}
              style={s.opcaoToque}
              testID="trazer-planilha"
            >
              <View style={s.opcaoTxt}>
                <Text style={[s.opcaoTitulo, { color: C.ink }]}>{T.planilha.titulo}</Text>
                <Text style={[s.opcaoSub, { color: C.ink2 }]}>{T.planilha.sub}</Text>
              </View>
              {seta}
            </Pressable>
            <View style={s.modelo}>
              <BaixarModelo testID="trazer-baixar-modelo" />
            </View>
          </View>
        </View>

        <Text style={[s.apoio, { color: C.ink3 }]} testID="trazer-apoio">{T.apoio}</Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  conteudo: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 16, paddingVertical: 28 },
  cartao: { width: "100%", maxWidth: 560, borderWidth: 1, borderRadius: 28, padding: 22, gap: 16 },
  marca: { fontSize: 22 },
  titulo: { fontSize: 27, lineHeight: 31 },
  opcoes: { gap: 10 },
  // Área de toque de pelo menos 44 px (o cartão inteiro é o botão).
  opcao: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderWidth: 1, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 14, minHeight: 64,
  },
  opcaoCaixa: { borderWidth: 1, borderRadius: 14, overflow: "hidden" },
  opcaoToque: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingTop: 14, paddingBottom: 8, paddingHorizontal: 14, minHeight: 56,
  },
  opcaoTxt: { flex: 1, gap: 4, minWidth: 0 },
  opcaoTitulo: { fontSize: 15, fontWeight: "700" },
  opcaoSub: { fontSize: 13, lineHeight: 18 },
  etiqueta: { alignSelf: "flex-start", borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  etiquetaTxt: { fontSize: 11.5, fontWeight: "700" },
  modelo: { paddingHorizontal: 14, paddingBottom: 14, alignItems: "flex-start" },
  apoio: { fontSize: 12.5, textAlign: "center" },
} as any);

export default TrazerProdutos;
