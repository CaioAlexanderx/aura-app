// ============================================================
// AURA. — Produtos sem categoria: atribuição em lote (F0)
// Rota: /catalogo/sem-categoria
//
// ── O BURACO QUE ISTO FECHA ─────────────────────────────────
// O índice de saúde (E1) mediu na Davi: dos 1.434 produtos ativos, só
// 251 têm categoria em texto. Os outros **1.183 são órfãos**.
//
// O wizard de migração classifica TEXTOS existentes — e aqui não há
// texto. Sem esta tela o piloto organiza 17,5% do catálogo e o resto
// segue invisível na navegação da loja. É a maior distância entre o que
// o backend já sabe fazer e o que o lojista consegue fazer.
//
// ── O DESENHO: SELECIONAR MUITOS, DECIDIR UMA VEZ ───────────
// 1.183 produtos não se categorizam um a um. O fluxo é: filtrar, marcar
// em bloco, escolher a categoria, aplicar. "Marcar todos os visíveis" é
// o botão que faz o trabalho render.
//
// ── `mode`: replace_primary, e por quê ──────────────────────
// Contrato §4: `ON CONFLICT DO NOTHING` de primária falha EM SILÊNCIO
// num produto que já tem primária — 200, e nada muda. Como esta tela
// também serve para reclassificar, usamos `replace_primary`, que
// desmarca antes. `add_secondary` fica para quando existir navegação por
// faceta e fizer sentido um produto estar em dois lugares.
// ============================================================
import { useMemo, useState } from "react";
import {
  ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { useRouter } from "expo-router";
import { useColors } from "@/constants/colors";
import { useCategories } from "@/hooks/useCategories";
import { useUnclassifiedProducts } from "@/hooks/useUnclassifiedProducts";
import type { Category } from "@/services/categoriesApi";

const PAGINA = 60;

export default function SemCategoriaScreen() {
  const C = useColors();
  const router = useRouter();

  const [busca, setBusca] = useState("");
  const [soComEstoque, setSoComEstoque] = useState(false);
  const [marcados, setMarcados] = useState<Record<string, true>>({});
  const [categoriaAlvo, setCategoriaAlvo] = useState<string | null>(null);

  const { flattened, isLoading: carregandoArvore } = useCategories();
  const { produtos, total, isLoading, atribuirEmLote, isAtribuindo } =
    useUnclassifiedProducts({
      q: busca.trim() || undefined,
      has_stock: soComEstoque || undefined,
      limit: PAGINA,
    });

  const idsMarcados = useMemo(() => Object.keys(marcados), [marcados]);
  const alvo = useMemo(
    () => flattened.find((c: Category) => c.id === categoriaAlvo) || null,
    [flattened, categoriaAlvo]
  );

  // Só folhas e nós que já são destino razoável. Manter os de nível 0
  // disponíveis é deliberado: numa árvore recém-criada, "Feminino" pode
  // ser o único destino que existe.
  const destinos = flattened;

  function alternar(id: string) {
    setMarcados((m) => {
      const novo = { ...m };
      if (novo[id]) delete novo[id];
      else novo[id] = true;
      return novo;
    });
  }

  function marcarTodosVisiveis() {
    setMarcados((m) => {
      const novo = { ...m };
      produtos.forEach((p: any) => { novo[p.id] = true; });
      return novo;
    });
  }

  async function aplicar() {
    if (!categoriaAlvo || idsMarcados.length === 0) return;
    await atribuirEmLote(idsMarcados, categoriaAlvo, "replace_primary");
    setMarcados({});
  }

  const s = estilos(C);
  const semArvore = !carregandoArvore && destinos.length === 0;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={s.wrap}>
      <Pressable onPress={() => router.back()} style={s.voltar} accessibilityRole="button">
        <Text style={{ color: C.ink3, fontSize: 13 }}>← Voltar</Text>
      </Pressable>

      <Text style={s.titulo}>Produtos sem categoria</Text>
      <Text style={s.sub}>
        Estes produtos não aparecem na navegação por categoria da loja. Marque vários,
        escolha o destino e aplique de uma vez.
      </Text>

      {semArvore ? (
        <View style={s.card}>
          <Text style={s.corpo}>
            Você ainda não tem categorias. Crie a árvore primeiro — sem destino, não há como
            categorizar.
          </Text>
          <Pressable onPress={() => router.push("/catalogo/organizar")} accessibilityRole="button">
            <Text style={[s.acao, { marginTop: 8 }]}>Organizar catálogo →</Text>
          </Pressable>
        </View>
      ) : null}

      {/* ── Filtro ────────────────────────────────────────────── */}
      <View style={s.card}>
        <TextInput
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar por nome"
          placeholderTextColor={C.ink3}
          style={[s.input, { color: C.ink, borderColor: C.border }]}
        />
        <Pressable
          onPress={() => setSoComEstoque((v) => !v)}
          style={s.checkLinha}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: soComEstoque }}
        >
          <View style={[s.check, soComEstoque && { backgroundColor: C.ink, borderColor: C.ink }]} />
          <Text style={s.corpo}>Só produtos com estoque</Text>
        </Pressable>
        <Text style={s.status}>
          {isLoading ? "Carregando…" : `${total} produto(s) sem categoria`}
          {total > produtos.length ? ` · mostrando ${produtos.length}` : ""}
        </Text>
      </View>

      {/* ── Lista ─────────────────────────────────────────────── */}
      <View style={s.card}>
        <View style={s.listaTopo}>
          <Text style={s.passo}>
            {idsMarcados.length > 0 ? `${idsMarcados.length} marcado(s)` : "Marque os produtos"}
          </Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Pressable onPress={marcarTodosVisiveis} accessibilityRole="button">
              <Text style={s.acao}>marcar visíveis</Text>
            </Pressable>
            {idsMarcados.length > 0 ? (
              <Pressable onPress={() => setMarcados({})} accessibilityRole="button">
                <Text style={[s.acao, { color: C.ink3 }]}>limpar</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {isLoading ? <ActivityIndicator color={C.ink3} /> : null}

        {!isLoading && produtos.length === 0 ? (
          <Text style={s.corpo}>
            Nenhum produto sem categoria com esse filtro. Se a lista estiver vazia por
            completo, o catálogo está coberto.
          </Text>
        ) : null}

        {produtos.map((p: any) => {
          const on = !!marcados[p.id];
          return (
            <Pressable
              key={p.id}
              onPress={() => alternar(p.id)}
              style={s.produto}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
            >
              <View style={[s.check, on && { backgroundColor: C.ink, borderColor: C.ink }]} />
              <Text style={s.nome} numberOfLines={1}>{p.name}</Text>
              {p.stock_qty != null ? (
                <Text style={s.contagem}>{p.stock_qty} un</Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {/* ── Destino + aplicar ─────────────────────────────────── */}
      <View style={s.card}>
        <Text style={s.passo}>Categoria de destino</Text>
        {carregandoArvore ? <ActivityIndicator color={C.ink3} /> : null}
        <View style={s.destinos}>
          {destinos.map((c: Category) => {
            const on = categoriaAlvo === c.id;
            return (
              <Pressable
                key={c.id}
                onPress={() => setCategoriaAlvo(on ? null : c.id)}
                style={[s.chip, on && { backgroundColor: C.ink, borderColor: C.ink }]}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
              >
                <Text style={[s.chipTxt, on && { color: C.bg }]}>
                  {c.path.replace(/^\//, "").replace(/\//g, " › ")}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={aplicar}
          disabled={!categoriaAlvo || idsMarcados.length === 0 || isAtribuindo}
          style={[s.btn, {
            backgroundColor: C.ink,
            opacity: !categoriaAlvo || idsMarcados.length === 0 || isAtribuindo ? 0.45 : 1,
          }]}
          accessibilityRole="button"
        >
          {isAtribuindo ? (
            <ActivityIndicator color={C.bg} />
          ) : (
            <Text style={[s.btnTxt, { color: C.bg }]}>
              {alvo && idsMarcados.length
                ? `Mover ${idsMarcados.length} para ${alvo.name}`
                : "Escolha produtos e destino"}
            </Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

function estilos(C: any) {
  return StyleSheet.create({
    wrap:      { padding: 20, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" },
    voltar:    { paddingVertical: 8, alignSelf: "flex-start" },
    titulo:    { fontSize: 22, fontWeight: "800", color: C.ink, marginTop: 4 },
    sub:       { fontSize: 14, color: C.ink3, marginTop: 6, marginBottom: 18, lineHeight: 20 },
    card:      { backgroundColor: C.bg3, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 16 },
    passo:     { fontSize: 15, fontWeight: "700", color: C.ink },
    corpo:     { fontSize: 13, color: C.ink3, lineHeight: 19 },
    status:    { fontSize: 13, color: C.ink, marginTop: 10, fontWeight: "600" },
    input:     { borderWidth: 1, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 9, fontSize: 13, ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}) },
    checkLinha:{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
    check:     { width: 16, height: 16, borderRadius: 4, borderWidth: 1.5, borderColor: C.border },
    listaTopo: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
    produto:   { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderTopWidth: 1, borderColor: C.border },
    nome:      { fontSize: 14, color: C.ink, flexShrink: 1, flex: 1 },
    contagem:  { fontSize: 12, color: C.ink3 },
    destinos:  { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10, marginBottom: 4 },
    chip:      { borderWidth: 1, borderColor: C.border, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
    chipTxt:   { fontSize: 12, color: C.ink, fontWeight: "600" },
    btn:       { marginTop: 14, borderRadius: 10, paddingVertical: 11, alignItems: "center" },
    btnTxt:    { fontSize: 14, fontWeight: "700" },
    acao:      { fontSize: 12, color: C.ink, fontWeight: "600" },
  });
}
