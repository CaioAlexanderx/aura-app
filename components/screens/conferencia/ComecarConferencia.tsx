// ============================================================
// AURA. — Conferir estoque: começar (p-108, entrega B)
//
// Escolher o que conferir (uma categoria, a loja toda, só o que tem
// estoque), contagem às cegas ligada por padrão, motivo opcional. Abaixo,
// os rascunhos em andamento (Continuar / Descartar) e as últimas
// conferências, com o link para o histórico (entrega C).
//
// A loja é a do contexto: no consolidado a PortaDaConferencia já perguntou.
// ============================================================
import { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, TextInput, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { useProducts } from "@/hooks/useProducts";
import { useProductCategories } from "@/hooks/useProductCategories";
import {
  conferenciaEstoqueApi,
  lerErroDaConferencia,
  type Conferencia,
  type TipoDeEscopo,
} from "@/services/conferenciaEstoqueApi";
import { eContavel, plural, textoDoEscopo } from "@/utils/conferenciaContagem";
import { useConferenciaContexto } from "@/hooks/useConferenciaResultado";
import { custoEmMassaApi } from "@/services/custoEmMassaApi";
import { ce } from "./estilos";

export const ROTA_CONFERENCIA = "/conferencia-estoque";
export function rotaDaContagem(id: string): string { return ROTA_CONFERENCIA + "/" + encodeURIComponent(id); }

function dataCurta(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
}

const STATUS_TEXTO: Record<string, string> = {
  aplicada: "Ajustada",
  desfeita: "Desfeita",
  descartada: "Descartada",
  rascunho: "Em andamento",
};

function Opcao({ marcada, titulo, detalhe, onPress, testID }: { marcada: boolean; titulo: string; detalhe: string; onPress: () => void; testID: string }) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ checked: marcada }}
      style={{
        flexDirection: "row", gap: 10, alignItems: "flex-start", padding: 12, borderRadius: 12, borderWidth: 1,
        borderColor: marcada ? Colors.violet : Colors.border, backgroundColor: marcada ? Colors.violetD : Colors.bg4,
      }}
    >
      <View style={{
        width: 18, height: 18, borderRadius: 9, borderWidth: 2, marginTop: 2,
        borderColor: marcada ? Colors.violet : Colors.ink3, alignItems: "center", justifyContent: "center",
      }}>
        {marcada && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.violet }} />}
      </View>
      <View style={ce.espaco}>
        <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.ink }}>{titulo}</Text>
        <Text style={ce.nota}>{detalhe}</Text>
      </View>
    </Pressable>
  );
}

export function ComecarConferencia() {
  const company = useAuthStore((s) => s.company);
  const companyId = company?.id || null;
  const qc = useQueryClient();
  const { products } = useProducts();
  const { categories } = useProductCategories("product");

  const [tipo, setTipo] = useState<TipoDeEscopo | null>(null);
  const [categoriasEscolhidas, setCategoriasEscolhidas] = useState<string[]>([]);
  const [asCegas, setAsCegas] = useState(true);
  const [motivo, setMotivo] = useState("");
  const [erroAoComecar, setErroAoComecar] = useState<string | null>(null);
  const [confirmarDescarte, setConfirmarDescarte] = useState<string | null>(null);

  // 12/11/2026: atalho "Produtos sem custo · Preencher custos". Só para quem
  // edita o estoque E vê custo; some com N = 0, antes da migration 448 ou
  // se a contagem falhar (nada aparece desabilitado).
  const ctxCusto = useConferenciaContexto(null);
  const podePreencherCusto = !!companyId && ctxCusto.podeEditar && !ctxCusto.semCusto;
  const semCusto = useQuery({
    queryKey: ["custos-sem-custo", companyId],
    queryFn: () => custoEmMassaApi.contagem(companyId!),
    enabled: podePreencherCusto,
    retry: false,
    // Volta da tela de custos com o número de agora.
    staleTime: 0,
  });
  const nSemCusto = podePreencherCusto && semCusto.data ? Number(semCusto.data.todos) || 0 : 0;

  const contaveis = useMemo(() => products.filter(eContavel), [products]);
  const comEstoque = useMemo(() => contaveis.filter((p) => (p.stock || 0) > 0).length, [contaveis]);
  const temCategorias = categories.length > 0;
  const tipoEfetivo: TipoDeEscopo = tipo || (temCategorias ? "categoria" : "loja_toda");
  const itensDasCategorias = useMemo(() => {
    const nomes = new Set(categories.filter((c) => categoriasEscolhidas.includes(c.id)).map((c) => c.name));
    return contaveis.filter((p) => nomes.has(p.category)).length;
  }, [categories, categoriasEscolhidas, contaveis]);

  const lista = useQuery({
    queryKey: ["conferencias-estoque", companyId],
    queryFn: () => conferenciaEstoqueApi.listar(companyId!, { limit: 20 }),
    enabled: !!companyId,
    retry: false,
    // Volta da contagem com o número de itens contados de agora.
    staleTime: 0,
  });
  const erroDaLista = lista.error ? lerErroDaConferencia(lista.error) : null;
  const emPreparo = erroDaLista?.tipo === "em_preparo";
  const todas: Conferencia[] = lista.data || [];
  const rascunhos = todas.filter((c) => c.status === "rascunho");
  const ultimas = todas.filter((c) => c.status === "aplicada" || c.status === "desfeita").slice(0, 3);

  const comecar = useMutation({
    mutationFn: () => conferenciaEstoqueApi.criar(companyId!, {
      escopo: tipoEfetivo === "categoria" ? { tipo: "categoria", category_ids: categoriasEscolhidas } : { tipo: tipoEfetivo },
      as_cegas: asCegas,
      motivo: motivo.trim() || null,
    }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["conferencias-estoque", companyId] });
      const id = r && r.conferencia && r.conferencia.id;
      if (id) router.push(rotaDaContagem(id) as any);
    },
    onError: (e) => setErroAoComecar(lerErroDaConferencia(e).mensagem),
  });

  const descartar = useMutation({
    mutationFn: (id: string) => conferenciaEstoqueApi.descartar(companyId!, id),
    onSuccess: () => {
      setConfirmarDescarte(null);
      qc.invalidateQueries({ queryKey: ["conferencias-estoque", companyId] });
    },
    onError: (e) => setErroAoComecar(lerErroDaConferencia(e).mensagem),
  });

  const faltaCategoria = tipoEfetivo === "categoria" && categoriasEscolhidas.length === 0;
  const podeComecar = !!companyId && !faltaCategoria && !comecar.isPending && !emPreparo;

  function alternarCategoria(id: string) {
    setTipo("categoria");
    setCategoriasEscolhidas((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : atual.concat(id)));
  }

  return (
    <ScrollView style={ce.tela} contentContainerStyle={ce.conteudo}>
      <Text style={ce.titulo}>Conferir estoque</Text>
      <Text style={ce.sub}>Conte o que está na prateleira. A Aura compara com o sistema e você decide o que ajustar.</Text>

      {emPreparo && (
        <View style={ce.aviso} testID="conferencia-em-preparo">
          <Text style={ce.avisoTexto}>{erroDaLista!.mensagem}</Text>
        </View>
      )}

      <View style={ce.card}>
        <Text style={ce.cardTitulo}>O que você vai conferir?</Text>
        {temCategorias && (
          <Opcao
            testID="escopo-categoria"
            marcada={tipoEfetivo === "categoria"}
            titulo="Uma categoria"
            detalhe={categoriasEscolhidas.length
              ? plural(itensDasCategorias, "item cadastrado", "itens cadastrados") + ". Bom para começar."
              : "Escolha abaixo. Bom para começar."}
            onPress={() => setTipo("categoria")}
          />
        )}
        {temCategorias && tipoEfetivo === "categoria" && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {categories.map((c) => {
              const on = categoriasEscolhidas.includes(c.id);
              return (
                <Pressable
                  key={c.id}
                  onPress={() => alternarCategoria(c.id)}
                  testID={"categoria-" + c.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  style={[ce.chip, { paddingVertical: 7, paddingHorizontal: 12 }, on && { backgroundColor: Colors.violet, borderColor: Colors.violet }]}
                >
                  <Text style={[ce.chipTexto, on && { color: "#fff" }]}>{c.name}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
        <Opcao
          testID="escopo-loja-toda"
          marcada={tipoEfetivo === "loja_toda"}
          titulo="A loja toda"
          detalhe={(contaveis.length ? plural(contaveis.length, "item", "itens") + ". " : "") + "Dá para pausar e voltar."}
          onPress={() => setTipo("loja_toda")}
        />
        <Opcao
          testID="escopo-com-estoque"
          marcada={tipoEfetivo === "com_estoque"}
          titulo="Só o que tem estoque no sistema"
          detalhe={(comEstoque ? plural(comEstoque, "item", "itens") + ". " : "") + "Deixa de fora o que está zerado. Quem aparecer a mais entra como sobra."}
          onPress={() => setTipo("com_estoque")}
        />

        {nSemCusto > 0 && (
          <View style={[ce.aviso, ce.linha, { flexWrap: "wrap" }]} testID="atalho-sem-custo">
            <Text style={{ fontSize: 22, fontWeight: "800", color: Colors.amber }}>{nSemCusto.toLocaleString("pt-BR")}</Text>
            <View style={[ce.espaco, { minWidth: 180 }]}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.ink }}>{nSemCusto === 1 ? "Produto sem custo" : "Produtos sem custo"}</Text>
              <Text style={ce.nota}>Sem o custo, a Aura não calcula quanto vale o que falta ou sobra. Preencha agora ou depois da contagem.</Text>
            </View>
            <Pressable onPress={() => router.push((ROTA_CONFERENCIA + "/custos") as any)} style={[ce.btnFantasma, ce.btnPequeno, { minHeight: 44 }]}
              accessibilityRole="button" testID="preencher-custos">
              <Text style={ce.btnFantasmaTexto}>Preencher custos</Text>
            </Pressable>
          </View>
        )}

        <Pressable
          onPress={() => setAsCegas(!asCegas)}
          testID="as-cegas"
          accessibilityRole="switch"
          accessibilityState={{ checked: asCegas }}
          style={[ce.linha, { paddingVertical: 6, flexWrap: "nowrap" }]}
        >
          <View style={{
            width: 42, height: 24, borderRadius: 12, padding: 3, justifyContent: "center",
            backgroundColor: asCegas ? Colors.violet : Colors.bg4, borderWidth: 1, borderColor: asCegas ? Colors.violet : Colors.border,
          }}>
            <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: "#fff", alignSelf: asCegas ? "flex-end" : "flex-start" }} />
          </View>
          <View style={ce.espaco}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.ink }}>Contagem às cegas</Text>
            <Text style={ce.nota}>
              {asCegas
                ? "A quantidade do sistema fica escondida enquanto você conta. Quem vê o número tende a confirmar, não a contar."
                : "A tela de contar vai mostrar quanto o sistema tem de cada item."}
            </Text>
          </View>
        </Pressable>

        <View style={{ gap: 6 }}>
          <Text style={ce.rotulo}>Motivo (opcional)</Text>
          <TextInput
            value={motivo}
            onChangeText={setMotivo}
            placeholder="Ex.: inventário do mês"
            placeholderTextColor={Colors.ink3}
            maxLength={120}
            style={ce.input}
            testID="motivo"
          />
        </View>

        {faltaCategoria && <Text style={ce.nota}>Escolha pelo menos uma categoria para começar.</Text>}
        {erroAoComecar && <Text style={ce.erroTexto} testID="erro-comecar">{erroAoComecar}</Text>}
        <View style={ce.linha}>
          <Pressable
            onPress={() => { if (podeComecar) { setErroAoComecar(null); comecar.mutate(); } }}
            disabled={!podeComecar}
            style={[ce.btn, !podeComecar && ce.desligado]}
            accessibilityRole="button"
            testID="comecar"
          >
            {comecar.isPending ? <ActivityIndicator color="#fff" /> : <Text style={ce.btnTexto}>Começar a conferir</Text>}
          </Pressable>
        </View>
      </View>

      {lista.isLoading && <ActivityIndicator color={Colors.violet3} />}

      {erroDaLista && !emPreparo && (
        <View style={ce.card}>
          <Text style={ce.nota}>{erroDaLista.mensagem}</Text>
          <View style={ce.linha}>
            <Pressable onPress={() => lista.refetch()} style={[ce.btnFantasma, ce.btnPequeno]} testID="lista-tentar">
              <Text style={ce.btnFantasmaTexto}>Tentar de novo</Text>
            </Pressable>
          </View>
        </View>
      )}

      {rascunhos.length > 0 && (
        <View style={ce.card} testID="rascunhos">
          <Text style={ce.cardTitulo}>Em andamento</Text>
          {rascunhos.map((c) => (
            <View key={c.id} style={{ gap: 8 }}>
              <View style={ce.linha}>
                <View style={ce.espaco}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.ink }}>{textoDoEscopo(c.escopo, categories)}</Text>
                  <Text style={ce.nota}>
                    {"Nº " + c.numero}
                    {dataCurta(c.criada_em || c.created_at) ? " · começou em " + dataCurta(c.criada_em || c.created_at) : ""}
                    {typeof c.itens_contados === "number" ? " · " + plural(c.itens_contados, "item contado", "itens contados") : ""}
                  </Text>
                </View>
                <Pressable onPress={() => setConfirmarDescarte(c.id)} style={[ce.btnFantasma, ce.btnPequeno]} testID={"descartar-" + c.id}>
                  <Text style={ce.btnFantasmaTexto}>Descartar</Text>
                </Pressable>
                <Pressable onPress={() => router.push(rotaDaContagem(c.id) as any)} style={[ce.btn, ce.btnPequeno]} testID={"continuar-" + c.id}>
                  <Text style={ce.btnTexto}>Continuar</Text>
                </Pressable>
              </View>
              {confirmarDescarte === c.id && (
                <View style={ce.aviso}>
                  <Text style={ce.avisoTexto}>Descartar esta conferência? O que foi contado nela some, e o estoque continua como está.</Text>
                  <View style={ce.linha}>
                    <Pressable onPress={() => setConfirmarDescarte(null)} style={[ce.btnFantasma, ce.btnPequeno]}>
                      <Text style={ce.btnFantasmaTexto}>Não, manter</Text>
                    </Pressable>
                    <Pressable onPress={() => descartar.mutate(c.id)} disabled={descartar.isPending} style={[ce.btn, ce.btnPequeno]} testID={"confirmar-descarte-" + c.id}>
                      <Text style={ce.btnTexto}>Sim, descartar</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {!emPreparo && !erroDaLista && !lista.isLoading && (
        <View style={ce.card} testID="ultimas">
          <View style={ce.linha}>
            <Text style={[ce.cardTitulo, ce.espaco]}>Últimas conferências</Text>
            <Pressable onPress={() => router.push((ROTA_CONFERENCIA + "/historico") as any)} testID="ver-historico" accessibilityRole="link">
              <Text style={{ color: Colors.violet3, fontWeight: "700", fontSize: 13.5 }}>Ver histórico</Text>
            </Pressable>
          </View>
          {ultimas.length === 0 && <Text style={ce.nota}>Nenhuma conferência ajustada ainda.</Text>}
          {ultimas.map((c) => (
            <View key={c.id} style={ce.linha}>
              <View style={ce.espaco}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.ink }}>
                  {dataCurta(c.aplicada_em || c.criada_em || c.created_at)} · {textoDoEscopo(c.escopo, categories)}
                </Text>
                <Text style={ce.nota}>
                  {typeof c.itens_contados === "number" ? plural(c.itens_contados, "item", "itens") : "Nº " + c.numero}
                  {c.criada_por_nome ? " · por " + c.criada_por_nome : ""}
                </Text>
              </View>
              <View style={[ce.chip, c.status === "aplicada" && ce.chipVerde]}>
                <Text style={[ce.chipTexto, c.status === "aplicada" && ce.chipVerdeTexto]}>
                  {c.status === "aplicada" && c.pode_desfazer_ate ? "Desfazer até " + dataCurta(c.pode_desfazer_ate) : STATUS_TEXTO[c.status] || c.status}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
