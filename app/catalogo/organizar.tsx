// ============================================================
// AURA. — C1: tela Organizar catálogo (F0)
//
// O lojista vê a árvore de 3 níveis e a reorganiza sozinho. Rota:
// /catalogo/organizar
//
// ── DUAS REGRAS QUE A TELA TORNA VISÍVEIS ───────────────────
//
// 1. TRÊS NÍVEIS, NUNCA QUATRO. O botão de criar subcategoria some no
//    nível 2 (canHaveChildren) — mas o CHECK do banco continua sendo a
//    verdade: se um 422 CATEGORY_MAX_DEPTH chegar mesmo assim, a
//    mensagem é tratada. A UI é conveniência, não guarda.
//
// 2. EXCLUIR NÃO PERDE PRODUTO. Apagar categoria com produtos devolve
//    409 CATEGORY_HAS_PRODUCTS com a contagem, e a tela usa esse número
//    para perguntar PARA ONDE os produtos vão antes de tentar de novo
//    com ?move_to=. O caminho "apaga e some com os produtos" não existe.
//
// ── CONTAGEM: SUBÁRVORE, NÃO SÓ O NÓ ────────────────────────
// Nó pai mostra `product_count_total` (a subárvore inteira). Mostrar só
// `product_count` faria "Feminino" parecer vazio quando tudo está em
// "Feminino > Calçados" — foi por isso que a decisão DEC-01 separou os
// dois campos.
//
// ── PRODUCT-ONLY ────────────────────────────────────────────
// Nenhum seletor de tipo. Os endpoints novos são product-only (DEC-03);
// o CRUD legado segue bilíngue só por retrocompatibilidade.
// ============================================================
import { useMemo, useState } from "react";
import {
  ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { useRouter } from "expo-router";
import { useColors } from "@/constants/colors";
import { useCategories, canHaveChildren } from "@/hooks/useCategories";
import { useCategoryTree } from "@/hooks/useCategoryTree";
import type { Category } from "@/services/categoriesApi";

type PendenteExclusao = { cat: Category; productCount: number } | null;

export default function OrganizarCatalogoScreen() {
  const C = useColors();
  const router = useRouter();
  const { tree, flattened, isLoading, create, isCreating, refetch } = useCategories();
  const { rename, remove, move, isRemoving } = useCategoryTree();

  const [abertos, setAbertos] = useState<Record<string, boolean>>({});
  const [criandoEm, setCriandoEm] = useState<string | null | "raiz">(null);
  const [nomeNovo, setNomeNovo] = useState("");
  const [renomeando, setRenomeando] = useState<string | null>(null);
  const [nomeEdit, setNomeEdit] = useState("");
  const [movendo, setMovendo] = useState<Category | null>(null);
  const [excluir, setExcluir] = useState<PendenteExclusao>(null);
  const [destino, setDestino] = useState("");

  const s = estilos(C);

  // Destinos possíveis num move: qualquer nó que ainda aceite filho, menos
  // o próprio e menos a própria subárvore (o backend barra com
  // CATEGORY_CYCLE, mas oferecer a opção seria oferecer um erro).
  const destinosMove = useMemo(() => {
    if (!movendo) return [];
    const prefixo = movendo.path + "/";
    return flattened.filter(
      (c: Category) =>
        c.id !== movendo.id &&
        !c.path.startsWith(prefixo) &&
        canHaveChildren(c)
    );
  }, [movendo, flattened]);

  async function confirmarCriacao(parentId: string | null) {
    const nome = nomeNovo.trim();
    if (!nome) return;
    await create({ name: nome, ...(parentId ? { parent_id: parentId } : {}) });
    setNomeNovo("");
    setCriandoEm(null);
  }

  async function confirmarRename(cat: Category) {
    const nome = nomeEdit.trim();
    if (!nome || nome === cat.name) { setRenomeando(null); return; }
    await rename(cat.id, nome);
    setRenomeando(null);
  }

  // Primeiro tenta sem destino. O 409 é o que informa a contagem — e é
  // ele que abre a pergunta "para onde vão os produtos?".
  async function tentarExcluir(cat: Category) {
    const erro = await remove(cat.id);
    if (!erro) return;
    if (erro.code === "CATEGORY_HAS_PRODUCTS") {
      setExcluir({ cat, productCount: erro.productCount ?? 0 });
      setDestino("");
      return;
    }
    // CATEGORY_HAS_CHILDREN e os demais já viraram mensagem no hook.
  }

  async function excluirComDestino() {
    if (!excluir) return;
    const alvo = destino.trim();
    if (!alvo) return;
    const erro = await remove(excluir.cat.id, alvo);
    if (!erro) { setExcluir(null); setDestino(""); }
  }

  function renderNo(cat: Category, nivel: number) {
    const filhos = cat.children || [];
    const aberto = abertos[cat.id] ?? nivel === 0;
    const total = cat.product_count_total ?? cat.product_count;
    const podeTerFilho = canHaveChildren(cat);

    return (
      <View key={cat.id} style={{ marginLeft: nivel * 14 }}>
        <View style={s.linha}>
          {filhos.length ? (
            <Pressable
              onPress={() => setAbertos((a) => ({ ...a, [cat.id]: !aberto }))}
              accessibilityRole="button"
              accessibilityLabel={aberto ? "Recolher" : "Expandir"}
              style={s.chevron}
            >
              <Text style={{ color: C.ink3, fontSize: 12 }}>{aberto ? "▾" : "▸"}</Text>
            </Pressable>
          ) : (
            <View style={s.chevron} />
          )}

          {renomeando === cat.id ? (
            <TextInput
              value={nomeEdit}
              onChangeText={setNomeEdit}
              onBlur={() => confirmarRename(cat)}
              onSubmitEditing={() => confirmarRename(cat)}
              autoFocus
              style={[s.inputInline, { color: C.ink, borderColor: C.border }]}
            />
          ) : (
            <Pressable
              onPress={() => { setRenomeando(cat.id); setNomeEdit(cat.name); }}
              style={{ flexShrink: 1 }}
              accessibilityRole="button"
              accessibilityLabel={`Renomear ${cat.name}`}
            >
              <Text style={s.nome} numberOfLines={1}>{cat.name}</Text>
            </Pressable>
          )}

          {/* product_count_total: a subárvore inteira. Ver cabeçalho. */}
          <Text style={s.contagem}>{total}</Text>

          <View style={s.acoes}>
            {podeTerFilho ? (
              <Pressable onPress={() => { setCriandoEm(cat.id); setNomeNovo(""); }} accessibilityRole="button">
                <Text style={s.acao}>+ sub</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => setMovendo(cat)} accessibilityRole="button">
              <Text style={s.acao}>mover</Text>
            </Pressable>
            <Pressable onPress={() => tentarExcluir(cat)} disabled={isRemoving} accessibilityRole="button">
              <Text style={[s.acao, { color: C.ink3 }]}>excluir</Text>
            </Pressable>
          </View>
        </View>

        {criandoEm === cat.id ? (
          <View style={s.criar}>
            <TextInput
              value={nomeNovo}
              onChangeText={setNomeNovo}
              placeholder={`Nova subcategoria em ${cat.name}`}
              placeholderTextColor={C.ink3}
              autoFocus
              onSubmitEditing={() => confirmarCriacao(cat.id)}
              style={[s.input, { color: C.ink, borderColor: C.border }]}
            />
            <Pressable onPress={() => confirmarCriacao(cat.id)} disabled={isCreating} accessibilityRole="button">
              <Text style={s.acao}>criar</Text>
            </Pressable>
            <Pressable onPress={() => setCriandoEm(null)} accessibilityRole="button">
              <Text style={[s.acao, { color: C.ink3 }]}>cancelar</Text>
            </Pressable>
          </View>
        ) : null}

        {aberto ? filhos.map((f) => renderNo(f, nivel + 1)) : null}
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={s.wrap}>
      <Pressable onPress={() => router.back()} style={s.voltar} accessibilityRole="button">
        <Text style={{ color: C.ink3, fontSize: 13 }}>← Voltar</Text>
      </Pressable>

      <Text style={s.titulo}>Organizar catálogo</Text>
      <Text style={s.sub}>
        Até três níveis. O número ao lado de cada categoria conta os produtos dela e de tudo
        que está abaixo.
      </Text>

      {isLoading ? <ActivityIndicator color={C.ink3} /> : null}

      {!isLoading && tree.length === 0 ? (
        <View style={s.vazio}>
          <Text style={s.corpo}>
            Nenhuma categoria ainda. Crie a primeira abaixo — ou, se o catálogo já tem
            categoria em texto, use o assistente de migração.
          </Text>
          <Pressable onPress={() => router.push("/catalogo/migracao")} accessibilityRole="button">
            <Text style={[s.acao, { marginTop: 8 }]}>Abrir assistente de migração →</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={s.card}>
        {tree.map((c: Category) => renderNo(c, 0))}

        {criandoEm === "raiz" ? (
          <View style={s.criar}>
            <TextInput
              value={nomeNovo}
              onChangeText={setNomeNovo}
              placeholder="Nome da categoria principal"
              placeholderTextColor={C.ink3}
              autoFocus
              onSubmitEditing={() => confirmarCriacao(null)}
              style={[s.input, { color: C.ink, borderColor: C.border }]}
            />
            <Pressable onPress={() => confirmarCriacao(null)} disabled={isCreating} accessibilityRole="button">
              <Text style={s.acao}>criar</Text>
            </Pressable>
            <Pressable onPress={() => setCriandoEm(null)} accessibilityRole="button">
              <Text style={[s.acao, { color: C.ink3 }]}>cancelar</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => { setCriandoEm("raiz"); setNomeNovo(""); }}
            style={s.novaRaiz}
            accessibilityRole="button"
          >
            <Text style={s.acao}>+ categoria principal</Text>
          </Pressable>
        )}
      </View>

      {/* ── Mover ─────────────────────────────────────────────── */}
      {movendo ? (
        <View style={s.card}>
          <Text style={s.passo}>Mover “{movendo.name}” para dentro de:</Text>
          {destinosMove.length === 0 ? (
            <Text style={s.corpo}>
              Não há destino possível. Só categorias de nível 0 e 1 aceitam filhos, e a própria
              subárvore não conta.
            </Text>
          ) : null}
          {destinosMove.map((d: Category) => (
            <Pressable
              key={d.id}
              onPress={async () => { await move(movendo.id, d.id); setMovendo(null); }}
              style={s.destino}
              accessibilityRole="button"
            >
              <Text style={{ color: C.ink, fontSize: 13 }}>{d.path.replace(/^\//, "").replace(/\//g, " › ")}</Text>
            </Pressable>
          ))}
          <Pressable
            onPress={async () => { await move(movendo.id, null); setMovendo(null); }}
            style={s.destino}
            accessibilityRole="button"
          >
            <Text style={{ color: C.ink, fontSize: 13 }}>Tornar categoria principal</Text>
          </Pressable>
          <Pressable onPress={() => setMovendo(null)} accessibilityRole="button">
            <Text style={[s.acao, { color: C.ink3, marginTop: 8 }]}>cancelar</Text>
          </Pressable>
        </View>
      ) : null}

      {/* ── Excluir com destino ───────────────────────────────── */}
      {excluir ? (
        <View style={[s.card, { borderColor: C.border }]}>
          <Text style={s.passo}>Excluir “{excluir.cat.name}”</Text>
          <Text style={s.corpo}>
            {excluir.productCount} produto(s) usam esta categoria. Diga para onde eles vão — o
            nome ou o caminho de outra categoria.
          </Text>
          <TextInput
            value={destino}
            onChangeText={setDestino}
            placeholder="Ex.: Sandálias"
            placeholderTextColor={C.ink3}
            style={[s.input, { color: C.ink, borderColor: C.border, marginTop: 10 }]}
          />
          <View style={{ flexDirection: "row", gap: 14, marginTop: 10 }}>
            <Pressable onPress={excluirComDestino} disabled={!destino.trim() || isRemoving} accessibilityRole="button">
              <Text style={[s.acao, { opacity: destino.trim() ? 1 : 0.45 }]}>
                Mover produtos e excluir
              </Text>
            </Pressable>
            <Pressable onPress={() => { setExcluir(null); setDestino(""); }} accessibilityRole="button">
              <Text style={[s.acao, { color: C.ink3 }]}>cancelar</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

function estilos(C: any) {
  return StyleSheet.create({
    wrap:       { padding: 20, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" },
    voltar:     { paddingVertical: 8, alignSelf: "flex-start" },
    titulo:     { fontSize: 22, fontWeight: "800", color: C.ink, marginTop: 4 },
    sub:        { fontSize: 14, color: C.ink3, marginTop: 6, marginBottom: 18, lineHeight: 20 },
    card:       { backgroundColor: C.bg3, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 16 },
    vazio:      { backgroundColor: C.bg3, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 16 },
    passo:      { fontSize: 15, fontWeight: "700", color: C.ink, marginBottom: 6 },
    corpo:      { fontSize: 13, color: C.ink3, lineHeight: 19 },
    linha:      { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 7 },
    chevron:    { width: 16, alignItems: "center" },
    nome:       { fontSize: 14, color: C.ink, fontWeight: "600" },
    contagem:   { fontSize: 12, color: C.ink3, minWidth: 28, textAlign: "right" },
    acoes:      { flexDirection: "row", gap: 10, marginLeft: "auto" },
    acao:       { fontSize: 12, color: C.ink, fontWeight: "600" },
    criar:      { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 6, marginLeft: 24 },
    novaRaiz:   { paddingVertical: 10, marginTop: 4 },
    destino:    { paddingVertical: 9, borderTopWidth: 1, borderColor: C.border },
    input:      { flex: 1, borderWidth: 1, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 8, fontSize: 13, ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}) },
    inputInline:{ borderWidth: 1, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4, fontSize: 14, minWidth: 140 },
  });
}
