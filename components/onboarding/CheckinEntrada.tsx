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
//
// 19/10/2026 (card tq-31): o Continuar leva à primeira tela conforme a
// resposta (utils/checkinDestino.ts), não mais sempre ao Painel. O plano do
// JWT pode estar velho (CLAUDE.md, armadilha 1): a tela revalida o
// /auth/me no mount e o Continuar espera essa revalidação (no máximo
// LIMITE_DA_ESPERA_MS) antes de decidir por plano. A importação assistida
// abre o wa.me no MESMO toque, antes de qualquer espera (senão o navegador
// bloqueia a aba nova). Pular continua indo ao Painel.
//
// 19/10/2026 (card tq-33, decisão da Nina): conta sem frente
// (companies.segment vazio) vê antes uma pergunta a mais, "O que a sua loja
// vende?", com as frentes do cartão "Sua frente" de Configurações. Um toque
// grava pela mesma rota (PATCH /companies/:id/segment → segment_source
// 'user'). Quem já tem frente segue com as três perguntas de sempre.
// ============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, useWindowDimensions, Linking, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { useAuthStore } from "@/stores/auth";
import { useVisibleModules } from "@/hooks/useVisibleModules";
import { useCheckin } from "@/hooks/useCheckin";
import { garantirTemProduto, useTemProduto } from "@/hooks/useTemProduto";
import { PERGUNTAS_CHECKIN, TEXTOS_CHECKIN, TEXTOS_FRENTE_CHECKIN, type ChaveResposta } from "@/constants/checkin";
import { checkinApi, checkinQueryKey, type CheckinEstado, type CheckinRespostas } from "@/services/checkinApi";
import {
  abrirCom, corpoCompleto, corpoDaResposta, corpoDoPular, opcoesDeFrente, opcoesVisiveis,
  precisaPerguntarFrente, quantasRespostas,
} from "@/utils/checkinRegras";
// 19/10/2026 (tq-33): pergunta da frente — mesma lista e mesma rota do
// cartão "Sua frente" de Configurações.
import { SEGMENT_LABEL } from "@/constants/primeirosPassos";
import { frenteApi, type Segmento, type TrocarFrenteResponse } from "@/services/primeirosPassosApi";
import { mensagemDoErro } from "@/components/screens/configuracoes/FrenteDaLoja";
import { ROTA_PAINEL, destinoDoCheckin } from "@/utils/checkinDestino";

/** Quanto o Continuar espera o /auth/me e a contagem de produtos. */
export const LIMITE_DA_ESPERA_MS = 4000;

function comLimite<T>(p: Promise<T>, ms: number): Promise<T | undefined> {
  return Promise.race([p, new Promise<undefined>((r) => setTimeout(() => r(undefined), ms))]);
}

/** Abre o link num toque só. Web: nova aba, síncrono. Nativo: Linking. */
function abrirLink(url: string) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && typeof window.open === "function") window.open(url, "_blank", "noopener");
  } else {
    Linking.openURL(url).catch(() => {});
  }
}
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
  const habilitada = !!data && data.habilitado && !data.respondido && !data.pulou;
  // Já pergunta se a loja tem produto enquanto ela responde (destino do Caixa).
  const temProdutoQ = useTemProduto(companyId, habilitada);
  // O destino é decidido depois de um await: lê sempre a versão mais nova.
  const modulosRef = useRef(modulos);
  modulosRef.current = modulos;
  const revalidacao = useRef<Promise<unknown>>(Promise.resolve());

  const [respostas, setRespostas] = useState<CheckinRespostas>({});
  const semeado = useRef(false);
  const algumPutFalhou = useRef(false);
  const saindo = useRef(false);

  // ── Frente (tq-33): só para conta sem `segment` gravado ──
  // `frente` = o que foi gravado NESTA tela. A pergunta continua na tela
  // depois do toque (o store passa a ter o segment, e a regra sozinha a
  // esconderia no meio da resposta).
  const [frente, setFrente] = useState<Segmento | null>(null);
  const [gravandoFrente, setGravandoFrente] = useState(false);
  const [erroFrente, setErroFrente] = useState<string | null>(null);
  const [frenteJaGravada, setFrenteJaGravada] = useState(false);
  const frenteGravada = useRef<Segmento | null>(null);
  const respostaFrente = useRef<TrocarFrenteResponse | null>(null);
  const mostrarFrente = !frenteJaGravada && (frente !== null || precisaPerguntarFrente(company));

  // Plano stale no JWT (CLAUDE.md, armadilha 1): revalida no mount.
  useEffect(() => {
    const st: any = useAuthStore.getState?.() || {};
    if (typeof st.refreshMe === "function") {
      revalidacao.current = Promise.resolve().then(() => st.refreshMe()).catch(() => {});
    }
  }, []);

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

  /**
   * Um toque grava a frente: PATCH /companies/:id/segment (frenteApi.trocar,
   * a rota do cartão "Sua frente"; o backend grava segment_source = 'user').
   * Antes, espera o /auth/me revalidado: se a conta já ganhou uma frente
   * (outra aba, Gestão Aura), não sobrescreve e a pergunta some.
   */
  async function escolherFrente(seg: Segmento) {
    if (!companyId || gravandoFrente || seg === frente) return;
    const anterior = frente;
    setFrente(seg);
    setErroFrente(null);
    setGravandoFrente(true);
    try {
      await revalidacao.current;
      const st: any = useAuthStore.getState?.() || {};
      const atual = (st.company?.segment as string | null | undefined) || null;
      if (atual && atual !== frenteGravada.current) {
        setFrente(null);
        setFrenteJaGravada(true);
        return;
      }
      const res = await frenteApi.trocar(companyId, { segment: seg });
      frenteGravada.current = (res?.segment as Segmento) || seg;
      respostaFrente.current = res || null;
      // Só o segment agora: a vertical do Studio (se for o caso) entra no
      // Continuar — o guard raiz troca de shell por vertical_active, e isso
      // no meio do check-in tiraria a pessoa da tela.
      if (typeof st.updateCompany === "function") st.updateCompany({ segment: frenteGravada.current } as any);
      queryClient.invalidateQueries({ queryKey: ["pdv-settings"] });
      queryClient.invalidateQueries({ queryKey: ["first-steps"] });
    } catch (err: any) {
      setFrente(anterior);
      setErroFrente(mensagemDoErro(err));
    } finally {
      setGravandoFrente(false);
    }
  }

  async function continuar() {
    if (saindo.current) return;
    // Personalizados (Studio): a frente nova abre o Aura Studio.
    if (respostaFrente.current?.vertical_active === "studio") {
      saindo.current = true;
      atualizarCache({ respondido: true, respostas });
      const st: any = useAuthStore.getState?.() || {};
      if (typeof st.updateCompany === "function") st.updateCompany({ vertical_active: "studio" } as any);
      router.replace("/studio" as any);
      return;
    }
    // Marca antes de atualizar o cache: o efeito acima (respondido = true)
    // não pode mandar ao Painel enquanto o destino é decidido.
    saindo.current = true;
    if (companyId && algumPutFalhou.current) {
      checkinApi.put(companyId, corpoCompleto(respostas)).catch(() => {});
    }
    const loja = (company as any)?.name || null;
    // 1) wa.me no mesmo toque (importação assistida), antes de qualquer espera.
    const previa = destinoDoCheckin(respostas, { modulos, temProduto: temProdutoQ.data ?? null, loja });
    if (previa.whatsapp) abrirLink(previa.whatsapp);
    atualizarCache({ respondido: true, respostas });
    // 2) plano revalidado e contagem de produtos, com limite: nunca prende.
    const [, temProduto] = (await comLimite(
      Promise.all([revalidacao.current, companyId ? garantirTemProduto(queryClient, companyId) : Promise.resolve(null)]),
      LIMITE_DA_ESPERA_MS,
    )) || [undefined, null];
    // Deixa o React aplicar o /auth/me novo antes de ler os módulos.
    await new Promise((r) => setTimeout(r, 0));
    const destino = destinoDoCheckin(respostas, { modulos: modulosRef.current, temProduto: temProduto ?? null, loja });
    router.replace(destino.rota as any);
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
  const respondidas = quantasRespostas(respostas) + (frente ? 1 : 0);
  const duasColunas = width >= LARGURA_DUAS_COLUNAS;
  const mostrandoTela = !isLoading && !!data && data.habilitado && !data.respondido && !data.pulou;

  if (!mostrandoTela) {
    return (
      <View style={[s.centro, { backgroundColor: C.bg }]} testID="checkin-carregando">
        <ActivityIndicator color={C.violet3} />
      </View>
    );
  }

  const perguntaFrente = mostrarFrente ? (
    <View style={s.pergunta} testID="checkin-pergunta-frente">
      <Text style={[s.perguntaTxt, { color: C.ink }]} accessibilityRole="header">{TEXTOS_FRENTE_CHECKIN.pergunta}</Text>
      <View style={s.chips} accessibilityRole="radiogroup">
        {opcoesDeFrente((company as any)?.plan).map((seg) => {
          const on = frente === seg;
          return (
            <Pressable
              key={seg}
              onPress={() => { void escolherFrente(seg); }}
              disabled={gravandoFrente}
              accessibilityRole="radio"
              accessibilityState={{ selected: on, checked: on, busy: on && gravandoFrente }}
              style={[
                s.chip,
                { borderColor: C.border, backgroundColor: "transparent" },
                on && { borderColor: C.violet, backgroundColor: C.violetD },
              ]}
              testID={`checkin-chip-frente-${seg}`}
            >
              <Text style={[s.chipTxt, { color: C.ink2 }, on && { color: C.violet3 }]}>{SEGMENT_LABEL[seg]}</Text>
            </Pressable>
          );
        })}
      </View>
      {gravandoFrente && <Text style={[s.nota, { color: C.ink3, textAlign: "left" }]}>{TEXTOS_FRENTE_CHECKIN.gravando}</Text>}
      {!!erroFrente && (
        <Text style={[s.nota, { color: C.red, textAlign: "left" }]} testID="checkin-frente-erro">{erroFrente}</Text>
      )}
    </View>
  ) : null;

  const perguntas = (
    <View style={s.col}>
      {perguntaFrente}
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
          <Text style={[s.saudacao, { color: C.ink3 }]}>
            {mostrarFrente ? TEXTOS_FRENTE_CHECKIN.saudacao : TEXTOS_CHECKIN.saudacao}
          </Text>
          <Text style={[s.titulo, { color: C.ink, fontFamily: Fonts.heading }]} accessibilityRole="header">
            {mostrarFrente ? TEXTOS_FRENTE_CHECKIN.titulo : TEXTOS_CHECKIN.titulo}
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
