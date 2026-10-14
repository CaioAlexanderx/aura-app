// ============================================================
// AURA. — Check-in de entrada (cartão t1-12, parte 2; 14/10/2026)
//
// Depois da escolha de frente e antes do Painel: três perguntas em chip
// (por onde começar, onde anota o que tem, quantos produtos), nenhum campo
// digitado, "Pular" sempre visível, menos de 1 minuto. Mockup aprovado:
// claude.ai/artifact/2FzKTdEMq3DSbmPgNkJjnj. Texto e opções em
// constants/checkin.ts; regras em utils/checkinRegras.ts.
//
//   · cada chip grava na hora (PUT parcial) — fechar a aba no meio não perde
//     o que já foi marcado; se um PUT falhar, o "Continuar" reenvia tudo;
//   · "Pular" grava `pulou: true` e segue sem esperar a rede;
//   · erro de rede, 404 ou `habilitado: false` = vai direto ao Painel: este
//     componente nunca é um beco sem saída;
//   · opção que o plano não tem some (Essencial: sem fiado, sem loja online),
//     nunca desabilitada;
//   · nada de hover (regra 7 do CLAUDE.md): o estado do chip é permanente.
// ============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { useAuthStore } from "@/stores/auth";
import { useVisibleModules } from "@/hooks/useVisibleModules";
import { useCheckin } from "@/hooks/useCheckin";
import { PERGUNTAS_CHECKIN, TEXTOS_CHECKIN, type ChaveResposta } from "@/constants/checkin";
import { checkinApi, checkinQueryKey, type CheckinEstado, type CheckinRespostas } from "@/services/checkinApi";
import {
  abrirCom, corpoCompleto, corpoDaResposta, corpoDoPular, opcoesVisiveis, quantasRespostas,
} from "@/utils/checkinRegras";

const ROTA_PAINEL = "/(tabs)";
const LARGURA_DUAS_COLUNAS = 760;

export function CheckinEntrada() {
  const C = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const company = useAuthStore((s) => s.company);
  const companyId = company?.id || null;
  const modulos = useVisibleModules();
  const { data, isLoading } = useCheckin(companyId, !!companyId);

  const [respostas, setRespostas] = useState<CheckinRespostas>({});
  const semeado = useRef(false);
  const algumPutFalhou = useRef(false);
  const saindo = useRef(false);

  // Retoma o que já estava gravado (quem marcou e fechou a aba).
  useEffect(() => {
    if (semeado.current || !data) return;
    semeado.current = true;
    if (data.respostas && Object.keys(data.respostas).length > 0) setRespostas(data.respostas);
  }, [data]);

  const seguirParaOPainel = useCallback(() => {
    if (saindo.current) return;
    saindo.current = true;
    router.replace(ROTA_PAINEL as any);
  }, [router]);

  // Sem sessão de empresa, sem rota, erro ou desligada: direto ao Painel.
  useEffect(() => {
    if (isLoading) return;
    if (!companyId || !data || !data.habilitado || data.respondido || data.pulou) seguirParaOPainel();
  }, [isLoading, companyId, data, seguirParaOPainel]);

  function atualizarCache(parcial: Partial<CheckinEstado>) {
    queryClient.setQueryData<CheckinEstado | null>(checkinQueryKey(companyId), (atual) =>
      atual ? { ...atual, ...parcial } : atual);
  }

  function escolher(chave: ChaveResposta, valor: string) {
    if (!companyId) return;
    const corpo = corpoDaResposta(chave, valor);
    if (!corpo) return;
    setRespostas((r) => ({ ...r, [chave]: valor }));
    // Grava na hora; falha não interrompe a tela, o Continuar reenvia.
    checkinApi.put(companyId, corpo).catch(() => { algumPutFalhou.current = true; });
  }

  function continuar() {
    if (companyId && algumPutFalhou.current) {
      checkinApi.put(companyId, corpoCompleto(respostas)).catch(() => {});
    }
    atualizarCache({ respondido: true, respostas });
    seguirParaOPainel();
  }

  function pular() {
    if (companyId) checkinApi.put(companyId, corpoDoPular()).catch(() => {});
    atualizarCache({ pulou: true });
    seguirParaOPainel();
  }

  const aberta = useMemo(
    () => abrirCom(respostas, { testeComecaNaVenda: (company as any)?.trial?.mode === "primeira_venda" }),
    [respostas, company],
  );
  const respondidas = quantasRespostas(respostas);
  const duasColunas = width >= LARGURA_DUAS_COLUNAS;
  const mostrandoTela = !isLoading && !!data && data.habilitado && !data.respondido && !data.pulou;

  if (!mostrandoTela) {
    return (
      <View style={[s.centro, { backgroundColor: C.bg }]} testID="checkin-carregando">
        <ActivityIndicator color={C.violet3} />
      </View>
    );
  }

  const perguntas = (
    <View style={s.col}>
      {PERGUNTAS_CHECKIN.map((p) => {
        const opcoes = opcoesVisiveis(p, modulos);
        if (opcoes.length === 0) return null;
        return (
          <View key={p.chave} style={s.pergunta} testID={`checkin-pergunta-${p.chave}`}>
            <Text style={[s.perguntaTxt, { color: C.ink }]} accessibilityRole="header">{p.pergunta}</Text>
            <View style={s.chips} accessibilityRole="radiogroup">
              {opcoes.map((o) => {
                const on = respostas[p.chave] === o.valor;
                return (
                  <Pressable
                    key={o.valor}
                    onPress={() => escolher(p.chave, o.valor)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on, checked: on }}
                    style={[
                      s.chip,
                      { borderColor: C.border, backgroundColor: "transparent" },
                      on && { borderColor: C.violet, backgroundColor: C.violetD },
                    ]}
                    testID={`checkin-chip-${p.chave}-${o.valor}`}
                  >
                    <Text style={[s.chipTxt, { color: C.ink2 }, on && { color: C.violet3 }]}>{o.rotulo}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );

  const lateral = (
    <View style={s.col}>
      <View
        style={[s.abrir, { backgroundColor: C.bg2, borderColor: C.border2 }]}
        testID="checkin-abrir-com"
      >
        <Text style={[s.abrirRotulo, { color: C.ink3 }]}>{TEXTOS_CHECKIN.abrirComRotulo}</Text>
        <Text style={[s.abrirGrande, { color: aberta ? C.ink : C.ink3, fontWeight: aberta ? "700" : "500" }]}>
          {aberta ? aberta.titulo : TEXTOS_CHECKIN.abrirComVazio}
        </Text>
        {!!aberta && <Text style={[s.abrirMais, { color: C.ink2 }]}>{aberta.sub}</Text>}
      </View>

      <View style={s.rodape}>
        <Pressable
          onPress={continuar}
          disabled={respondidas === 0}
          accessibilityRole="button"
          accessibilityState={{ disabled: respondidas === 0 }}
          style={[s.botao, { backgroundColor: C.violet }, respondidas === 0 && s.botaoApagado]}
          testID="checkin-continuar"
        >
          <Text style={s.botaoTxt}>{TEXTOS_CHECKIN.continuar}</Text>
        </Pressable>
        <Pressable onPress={pular} accessibilityRole="button" style={s.pular} testID="checkin-pular">
          <Text style={[s.pularTxt, { color: C.violet3 }]}>{TEXTOS_CHECKIN.pular}</Text>
        </Pressable>
        <Text style={[s.nota, { color: C.ink3 }]}>{TEXTOS_CHECKIN.rodape}</Text>
      </View>
    </View>
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={s.conteudo}
      testID="checkin-raiz"
    >
      <View style={[s.cartao, { backgroundColor: C.bg, borderColor: C.border2 }]}>
        <View style={s.marcaLinha}>
          <Text style={[s.marca, { color: C.ink, fontFamily: Fonts.heading }]}>{TEXTOS_CHECKIN.marca}</Text>
          <Text style={[s.tempo, { color: C.ink3 }]}>{TEXTOS_CHECKIN.tempo}</Text>
        </View>
        <View style={s.cabeca}>
          <Text style={[s.saudacao, { color: C.ink3 }]}>{TEXTOS_CHECKIN.saudacao}</Text>
          <Text style={[s.titulo, { color: C.ink, fontFamily: Fonts.heading }]} accessibilityRole="header">
            {TEXTOS_CHECKIN.titulo}
          </Text>
          <Text style={[s.sub, { color: C.ink2 }]}>{TEXTOS_CHECKIN.subtitulo}</Text>
        </View>
        <View style={duasColunas ? s.linha : s.pilha}>
          {perguntas}
          {lateral}
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  conteudo: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 16, paddingVertical: 28 },
  cartao: { width: "100%", maxWidth: 760, borderWidth: 1, borderRadius: 28, padding: 22, gap: 18 },
  marcaLinha: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  marca: { fontSize: 22 },
  tempo: { fontSize: 11.5, fontWeight: "600" },
  cabeca: { gap: 6 },
  saudacao: { fontSize: 11.5, fontWeight: "600" },
  titulo: { fontSize: 29, lineHeight: 32 },
  sub: { fontSize: 13 },
  linha: { flexDirection: "row", gap: 28, alignItems: "flex-start" },
  pilha: { flexDirection: "column", gap: 18 },
  col: { flex: 1, gap: 18, minWidth: 0 },
  pergunta: { gap: 8 },
  perguntaTxt: { fontSize: 13.5, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, minHeight: 40, justifyContent: "center" },
  chipTxt: { fontSize: 12.5, fontWeight: "600" },
  abrir: { borderWidth: 1, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, gap: 4 },
  abrirRotulo: { fontSize: 11, fontWeight: "700", letterSpacing: 0.7, textTransform: "uppercase" },
  abrirGrande: { fontSize: 15 },
  abrirMais: { fontSize: 12.5 },
  rodape: { gap: 10, alignItems: "stretch" },
  botao: { borderRadius: 12, minHeight: 46, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  botaoApagado: { opacity: 0.45 },
  botaoTxt: { color: "#fff", fontSize: 14, fontWeight: "700" },
  pular: { minHeight: 40, alignItems: "center", justifyContent: "center", padding: 10 },
  pularTxt: { fontSize: 13, fontWeight: "600", textDecorationLine: "underline" },
  nota: { fontSize: 11.5, textAlign: "center" },
} as any);

export default CheckinEntrada;
