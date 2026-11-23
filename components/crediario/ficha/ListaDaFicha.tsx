// ============================================================
// ListaDaFicha — Aura · Crediário (F3 do redesenho da ficha, 23/11/2026)
//
// A carteira em versão estreita, à esquerda da ficha em tela cheia (mockup
// aprovado, seção a: "Esquerda: as clientes"). Trocar de ficha é um toque;
// "‹ Crediário" (ou Esc) volta para a lista em um toque.
//
// Presentational: a busca, o filtro e a ordem são os MESMOS da página
// (crediario.tsx) — a lista de baixo não desmonta e, ao voltar, está como
// estava. Na tela média (sem coluna da lista) o mesmo componente abre por
// cima pelo "Trocar cliente".
//
// Sem hover-reveal (regra 7): o hover só pinta o fundo; nada aparece nele.
// ============================================================
import { useEffect } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { Icon } from "@/components/Icon";

const IS_WEB = Platform.OS === "web";

export type ClienteDaLista = {
  id: string;
  nome: string;
  /** "Em dia", "Em atraso · 19 dias", "Conferir". */
  situacao: string;
  atrasada: boolean;
  /** Valor já formatado (e escondido pelo olho, se for o caso). */
  valor: string;
};

export type ListaDaFichaProps = {
  clientes: ClienteDaLista[];
  selecionadaId: string | null;
  onEscolher: (id: string, nome: string) => void;
  onVoltar: () => void;
  busca: string;
  onBusca: (v: string) => void;
  /** "todos" | "atraso" | faixa de atraso escolhida na página. */
  filtro: string;
  onFiltro: (f: "todos" | "atraso") => void;
  /** Rótulo da faixa quando o filtro da página é uma faixa ("31–60 dias"). */
  rotuloDaFaixa?: string | null;
  carregando?: boolean;
};

export function ListaDaFicha({
  clientes, selecionadaId, onEscolher, onVoltar, busca, onBusca, filtro, onFiltro, rotuloDaFaixa, carregando,
}: ListaDaFichaProps) {
  // Setas trocam a ficha: a linha escolhida não pode sumir para fora da lista.
  useEffect(() => {
    if (!IS_WEB || !selecionadaId || typeof document === "undefined") return;
    const el = document.getElementById(`ficha-lista-${selecionadaId}`) as any;
    try { el?.scrollIntoView?.({ block: "nearest" }); } catch {}
  }, [selecionadaId]);

  return (
    <View style={s.raiz} testID="ficha-lista">
      <Pressable
        onPress={onVoltar}
        style={({ hovered }: any) => [s.voltar, hovered && { backgroundColor: Colors.violetD }]}
        accessibilityRole="button"
        accessibilityLabel="Voltar para a lista do crediário"
        testID="ficha-lista-voltar"
      >
        <View style={{ transform: [{ rotate: "180deg" }] }}>
          <Icon name="chevron_right" size={15} color={Colors.violet3} />
        </View>
        <Text style={s.voltarTxt}>Crediário</Text>
        {IS_WEB && <Text style={s.kbd}>Esc</Text>}
      </Pressable>

      <View style={s.busca}>
        <Icon name="search" size={13} color={Colors.ink3} />
        <TextInput
          style={s.buscaInput}
          placeholder="Buscar cliente…"
          placeholderTextColor={Colors.ink3}
          value={busca}
          onChangeText={onBusca}
          autoCorrect={false}
          autoCapitalize="none"
          testID="ficha-lista-busca"
        />
      </View>

      <View style={s.filtros}>
        <Filtro rotulo="Todos" ativo={filtro === "todos"} onPress={() => onFiltro("todos")} />
        <Filtro rotulo="Em atraso" ativo={filtro === "atraso"} onPress={() => onFiltro("atraso")} />
        {!!rotuloDaFaixa && filtro !== "todos" && filtro !== "atraso" && (
          <Filtro rotulo={rotuloDaFaixa} ativo onPress={() => onFiltro("todos")} />
        )}
      </View>

      <ScrollView style={s.lista} contentContainerStyle={{ paddingHorizontal: 6, paddingBottom: 8 }}>
        {clientes.length === 0 && !carregando && (
          <Text style={s.vazio}>{busca ? "Ninguém com esse nome." : "Nenhuma cliente neste filtro."}</Text>
        )}
        {clientes.map((c) => {
          const on = c.id === selecionadaId;
          return (
            <Pressable
              key={c.id}
              nativeID={`ficha-lista-${c.id}`}
              onPress={() => onEscolher(c.id, c.nome)}
              style={({ hovered, pressed }: any) => [s.item, (hovered || pressed) && s.itemHover, on && s.itemOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${c.nome}, ${c.situacao}, ${c.valor}`}
              testID={`ficha-lista-item-${c.id}`}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.nome} numberOfLines={1}>{c.nome}</Text>
                <Text style={[s.sit, c.atrasada && { color: Colors.red }]} numberOfLines={1}>{c.situacao}</Text>
              </View>
              <Text style={s.valor} numberOfLines={1}>{c.valor}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={s.rodape} numberOfLines={1}>
        {clientes.length} {clientes.length === 1 ? "cliente" : "clientes"}{IS_WEB ? " · ↑ ↓ troca de ficha" : ""}
      </Text>
    </View>
  );
}

function Filtro({ rotulo, ativo, onPress }: { rotulo: string; ativo: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[s.filtro, ativo && s.filtroOn]}
      accessibilityRole="button"
      accessibilityState={{ selected: ativo }}
      testID={`ficha-lista-filtro-${rotulo}`}
    >
      <Text style={[s.filtroTxt, ativo && { color: "#fff" }]} numberOfLines={1}>{rotulo}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  raiz: { flex: 1, minHeight: 0, backgroundColor: Colors.bg2 },
  voltar: {
    flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44,
    marginHorizontal: 12, marginTop: 12, marginBottom: 8, paddingHorizontal: 12,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border2,
  },
  voltarTxt: { fontFamily: Fonts.body, fontSize: 13, fontWeight: "700", color: Colors.violet3, flex: 1 },
  kbd: {
    fontFamily: Fonts.mono, fontSize: 11, color: Colors.ink3,
    borderWidth: 1, borderColor: Colors.border2, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1,
  },
  busca: {
    flexDirection: "row", alignItems: "center", gap: 7, marginHorizontal: 12, marginBottom: 8,
    paddingHorizontal: 10, minHeight: 40, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg3,
  },
  buscaInput: { fontFamily: Fonts.body, flex: 1, minWidth: 0, fontSize: 12.5, color: Colors.ink, outlineStyle: "none" } as any,
  filtros: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginHorizontal: 12, marginBottom: 6 },
  filtro: {
    minHeight: 32, justifyContent: "center", paddingHorizontal: 10, borderRadius: 99,
    borderWidth: 1, borderColor: Colors.border,
  },
  filtroOn: { backgroundColor: Colors.violet, borderColor: Colors.violet2 },
  filtroTxt: { fontFamily: Fonts.body, fontSize: 11, fontWeight: "700", color: Colors.ink2 },
  lista: { flex: 1, minHeight: 0 },
  vazio: { fontFamily: Fonts.body, fontSize: 12, color: Colors.ink3, padding: 12 },
  item: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 10 },
  itemHover: { backgroundColor: Colors.violetD },
  itemOn: { backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2 },
  nome: { fontFamily: Fonts.body, fontSize: 12.5, fontWeight: "600", color: Colors.ink },
  sit: { fontFamily: Fonts.body, fontSize: 11, color: Colors.ink3, marginTop: 1 },
  valor: { fontFamily: Fonts.mono, fontSize: 12, fontWeight: "500", color: Colors.ink, fontVariant: ["tabular-nums"] as any },
  rodape: {
    fontFamily: Fonts.body, fontSize: 11, color: Colors.ink3,
    paddingHorizontal: 14, paddingVertical: 9, borderTopWidth: 1, borderTopColor: Colors.border,
  },
});

export default ListaDaFicha;
