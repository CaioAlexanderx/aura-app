// ============================================================
// AURA. — Personalizados: peças da visão de todas as lojas (p-187)
//
// O que a Produção e os Orçamentos 3D consolidados têm em comum: o aviso de
// "só para ler", o seletor de lojas (do `breakdown` do servidor), os chips
// de filtro, a paginação e o "Abrir na loja".
//
// Nada aqui grava. "Abrir na loja" troca a empresa ativa (o mesmo
// switchCompany do seletor do cabeçalho) e abre o item na tela da loja, que
// é onde a pessoa age (regra da casa: mutação só por CNPJ). No web a troca
// recarrega a página; o redirect pós-troca (aura_post_switch_redirect, lido
// em stores/auth.ts) leva direto ao item, como na ficha do Crediário.
//
// Ações sempre visíveis, sem hover (regra 7 do CLAUDE.md).
// ============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, Platform } from "react-native";
import { useRouter } from "expo-router";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import type { StudioPalette } from "@/constants/studio-tokens";
import type { StudioConsolidadoBreakdown } from "@/services/meAggregates";
import {
  TAMANHO_DA_PAGINA, lojaDoFiltro, seletorDeLojas, textoDaPagina, temProxima, type SeletorDeLojas,
} from "@/components/personalizados/regrasDoConsolidado";

const CHAVE_DO_REDIRECT = "aura_post_switch_redirect";

/** Troca para a loja e abre `rota` nela. `abrindo` é a chave do item em curso. */
export function useAbrirNaLoja() {
  const switchCompany = useAuthStore((st) => st.switchCompany);
  const router = useRouter();
  const [abrindo, setAbrindo] = useState<string | null>(null);

  const abrir = useCallback(async (companyId: string, rota: string, chave: string) => {
    if (abrindo || !companyId) return;
    const web = Platform.OS === "web" && typeof window !== "undefined";
    if (web) {
      try { window.sessionStorage.setItem(CHAVE_DO_REDIRECT, rota); } catch {}
    }
    setAbrindo(chave);
    try {
      await switchCompany(companyId);
      // No celular não há recarga: o estado troca e a rota abre aqui.
      if (!web) {
        router.replace(rota as any);
        setAbrindo(null);
      }
    } catch {
      if (web) {
        try { window.sessionStorage.removeItem(CHAVE_DO_REDIRECT); } catch {}
      }
      setAbrindo(null);
      toast.error("Não foi possível abrir a loja. Troque pelo seletor de empresa.");
    }
  }, [abrindo, switchCompany, router]);

  return { abrir, abrindo };
}

type RespostaDoConsolidado = {
  total: number;
  offset: number;
  filtered_company_id: string | null;
  breakdown: StudioConsolidadoBreakdown[];
};

export type PedidoAoServidor<S> = { company_id: string | null; status: S | null; offset: number; limit: number };

/**
 * A lista consolidada: loja, filtro, página e a resposta do servidor.
 *
 * O primeiro pedido vai sem loja (todas). Se alguma loja da resposta não tem
 * a frente ligada, "todas" não vale (regrasDoConsolidado.seletorDeLojas) e o
 * hook pede de novo, já com a primeira loja do seletor. A lista só aparece
 * quando a resposta é do filtro em vigor: nada de mostrar pedido de uma loja
 * com outra escolhida.
 */
export function useListaConsolidada<S extends string, R extends RespostaDoConsolidado>({
  ativo, ligadas, buscar,
}: {
  ativo: boolean;
  ligadas: Set<string>;
  buscar: (pedido: PedidoAoServidor<S>) => Promise<R>;
}) {
  const [loja, setLoja] = useState<string | null>(null);
  const [status, setStatus] = useState<S | null>(null);
  const [offset, setOffset] = useState(0);
  const [resposta, setResposta] = useState<R | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const sequencia = useRef(0);
  const buscarRef = useRef(buscar);
  buscarRef.current = buscar;

  const seletor = useMemo(() => seletorDeLojas(resposta?.breakdown, ligadas), [resposta, ligadas]);
  const filtro = resposta ? lojaDoFiltro(loja, seletor) : loja;

  useEffect(() => {
    if (!ativo) return;
    const minha = ++sequencia.current;
    setCarregando(true);
    buscarRef.current({ company_id: filtro, status, offset, limit: TAMANHO_DA_PAGINA })
      .then((r) => {
        if (minha !== sequencia.current) return;
        setResposta(r);
        setErro(null);
      })
      .catch((e: any) => {
        if (minha !== sequencia.current) return;
        setErro(e?.message || "Não deu para carregar as lojas.");
      })
      .finally(() => {
        if (minha === sequencia.current) setCarregando(false);
      });
  }, [ativo, filtro, status, offset, tentativa]);

  const doFiltro = !!resposta && (resposta.filtered_company_id || null) === filtro;

  return {
    seletor,
    filtro,
    status,
    offset,
    resposta: doFiltro ? resposta : null,
    /** O servidor já respondeu ao menos uma vez (o seletor tem de onde sair). */
    respondeu: !!resposta,
    carregando,
    erro,
    escolherLoja: (id: string | null) => { setLoja(id); setOffset(0); },
    escolherStatus: (s: S | null) => { setStatus(s); setOffset(0); },
    anterior: () => setOffset((o) => Math.max(0, o - TAMANHO_DA_PAGINA)),
    proxima: () => setOffset((o) => o + TAMANHO_DA_PAGINA),
    tentarDeNovo: () => setTentativa((n) => n + 1),
  };
}

export function AvisoSoLeitura({ texto, testID }: { texto: string; testID?: string }) {
  const t = useStudioTokens();
  const s = useMemo(() => estilos(t), [t]);
  return (
    <View style={s.aviso} testID={testID || "consolidado-aviso"}>
      <Text style={s.avisoTxt}>{texto}</Text>
    </View>
  );
}

export function SeletorDeLojasView({
  seletor, escolhida, onEscolher,
}: {
  seletor: SeletorDeLojas;
  /** A loja do filtro em vigor (null = todas). */
  escolhida: string | null;
  onEscolher: (companyId: string | null) => void;
}) {
  const t = useStudioTokens();
  const s = useMemo(() => estilos(t), [t]);
  if (!seletor.lojas.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.faixa} contentContainerStyle={s.faixaDentro} testID="consolidado-lojas">
      {seletor.podeVerTodas ? (
        <Chip
          s={s}
          ativo={escolhida === null}
          texto={`Todas as lojas ${seletor.totalDasLojas}`}
          rotulo={`Todas as lojas, ${seletor.totalDasLojas}`}
          onPress={() => onEscolher(null)}
          testID="consolidado-loja-todas"
        />
      ) : null}
      {seletor.lojas.map((l) => (
        <Chip
          key={l.company_id}
          s={s}
          ativo={escolhida === String(l.company_id)}
          texto={`${l.company_name} ${l.total}`}
          rotulo={`${l.company_name}${l.is_primary ? " (principal)" : ""}, ${l.total}`}
          onPress={() => onEscolher(String(l.company_id))}
          testID={`consolidado-loja-${l.company_id}`}
        />
      ))}
    </ScrollView>
  );
}

export function ChipsDeFiltro<K extends string>({
  opcoes, escolhida, onEscolher, prefixo,
}: {
  opcoes: { key: K | null; label: string }[];
  escolhida: K | null;
  onEscolher: (k: K | null) => void;
  prefixo: string;
}) {
  const t = useStudioTokens();
  const s = useMemo(() => estilos(t), [t]);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.faixa} contentContainerStyle={s.faixaDentro} testID={`${prefixo}-filtros`}>
      {opcoes.map((o) => (
        <Chip
          key={o.key || "todos"}
          s={s}
          ativo={escolhida === o.key}
          texto={o.label}
          rotulo={o.label}
          onPress={() => onEscolher(o.key)}
          testID={`${prefixo}-filtro-${o.key || "todos"}`}
          leve
        />
      ))}
    </ScrollView>
  );
}

function Chip({
  s, ativo, texto, rotulo, onPress, testID, leve,
}: {
  s: ReturnType<typeof estilos>;
  ativo: boolean;
  texto: string;
  rotulo: string;
  onPress: () => void;
  testID: string;
  leve?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: ativo }}
      accessibilityLabel={rotulo}
      style={[s.chip, leve && s.chipLeve, ativo && s.chipAtivo]}
      testID={testID}
    >
      <Text style={[s.chipTxt, ativo && s.chipTxtAtivo]} numberOfLines={1}>{texto}</Text>
    </Pressable>
  );
}

export function Paginacao({
  offset, naPagina, total, carregando, onAnterior, onProxima, prefixo,
}: {
  offset: number;
  naPagina: number;
  total: number;
  carregando: boolean;
  onAnterior: () => void;
  onProxima: () => void;
  prefixo: string;
}) {
  const t = useStudioTokens();
  const s = useMemo(() => estilos(t), [t]);
  const podeVoltar = offset > 0 && !carregando;
  const podeAvancar = temProxima(offset, naPagina, total) && !carregando;
  if (!total) return null;
  return (
    <View style={s.paginacao} testID={`${prefixo}-paginacao`}>
      <Text style={s.paginaTxt} testID={`${prefixo}-pagina`}>{textoDaPagina(offset, naPagina, total)}</Text>
      <View style={s.paginaBotoes}>
        <Pressable
          style={[s.botao, !podeVoltar && s.botaoApagado]}
          onPress={onAnterior}
          disabled={!podeVoltar}
          accessibilityRole="button"
          accessibilityState={{ disabled: !podeVoltar }}
          testID={`${prefixo}-anterior`}
        >
          <Text style={s.botaoTxt}>Anterior</Text>
        </Pressable>
        <Pressable
          style={[s.botao, !podeAvancar && s.botaoApagado]}
          onPress={onProxima}
          disabled={!podeAvancar}
          accessibilityRole="button"
          accessibilityState={{ disabled: !podeAvancar }}
          testID={`${prefixo}-proxima`}
        >
          <Text style={s.botaoTxt}>Próxima</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function BotaoAbrirNaLoja({
  nomeDaLoja, abrindo, onPress, testID,
}: {
  nomeDaLoja: string;
  abrindo: boolean;
  onPress: () => void;
  testID: string;
}) {
  const t = useStudioTokens();
  const s = useMemo(() => estilos(t), [t]);
  return (
    <Pressable
      style={s.botaoAbrir}
      onPress={onPress}
      disabled={abrindo}
      accessibilityRole="button"
      accessibilityLabel={`Abrir na loja ${nomeDaLoja}`}
      testID={testID}
    >
      <Text style={s.botaoAbrirTxt}>{abrindo ? "Abrindo…" : "Abrir na loja"}</Text>
    </Pressable>
  );
}

export function SeloDaLoja({ nome }: { nome: string }) {
  const t = useStudioTokens();
  const s = useMemo(() => estilos(t), [t]);
  return (
    <View style={s.seloLoja}>
      <Text style={s.seloLojaTxt} numberOfLines={1}>{nome}</Text>
    </View>
  );
}

function estilos(t: StudioPalette) {
  return StyleSheet.create({
    aviso: { borderRadius: 10, borderWidth: 1, borderColor: t.primaryBorder, backgroundColor: t.primaryGhost, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 },
    avisoTxt: { fontSize: 12.5, color: t.ink2, lineHeight: 18 },

    faixa: { flexGrow: 0, marginBottom: 10 },
    faixaDentro: { gap: 6, paddingRight: 8 },
    // 44 px: alvo de toque confortável no celular.
    chip: { justifyContent: "center", minHeight: 44, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: t.primaryBorder, backgroundColor: t.paperCard, maxWidth: 260 },
    chipLeve: { backgroundColor: "transparent" },
    chipAtivo: { backgroundColor: t.primary, borderColor: t.primary },
    chipTxt: { fontSize: 12.5, fontWeight: "600", color: t.ink2 },
    chipTxtAtivo: { color: "#fff" },

    paginacao: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 14, flexWrap: "wrap" },
    paginaTxt: { fontSize: 12.5, color: t.ink3, fontVariant: ["tabular-nums"] },
    paginaBotoes: { flexDirection: "row", gap: 8 },
    botao: { alignItems: "center", justifyContent: "center", minHeight: 40, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: t.primaryBorder, backgroundColor: t.paperCard },
    botaoApagado: { opacity: 0.45 },
    botaoTxt: { fontSize: 12, fontWeight: "600", color: t.ink2 },

    botaoAbrir: { alignItems: "center", justifyContent: "center", minHeight: 40, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: t.primaryBorder, backgroundColor: t.primaryGhost, marginTop: 2 },
    botaoAbrirTxt: { fontSize: 12, fontWeight: "700", color: t.ink },

    seloLoja: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: t.primaryGhost, borderWidth: 1, borderColor: t.primaryBorder, maxWidth: 180 },
    seloLojaTxt: { fontSize: 10.5, fontWeight: "700", color: t.accentInk },
  });
}
