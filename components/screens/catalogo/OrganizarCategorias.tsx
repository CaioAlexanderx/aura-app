// ============================================================
// AURA. — Organizar categorias: o conteúdo (árvore + ações)
//
// 10/11/2026: o conteúdo saiu de app/catalogo/organizar.tsx para cá. Dois
// lugares montam a mesma coisa:
//   - o modal "Organizar categorias" do Estoque
//     (components/screens/estoque/categorias/OrganizarCategoriasModal.tsx);
//   - a rota /catalogo/organizar, que fica para os links antigos e para a
//     Vitrine do Canal Digital.
// Antes, o botão do Estoque abria a rota: uma página fora do shell, com
// outro desenho, e o "Voltar" caía no Painel (ver utils/voltarDoCatalogo).
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
//
// Sem Icon (react-native-svg) de propósito: este conteúdo é renderizado
// nos testes da rota com react-native mockado. Os glifos são texto.
// ============================================================
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from "react-native";
import { useColors } from "@/constants/colors";
import { useCategories, canHaveChildren, type FlatCategory } from "@/hooks/useCategories";
import { useCategoryTree } from "@/hooks/useCategoryTree";
import { useBannerDeCategoria } from "@/hooks/useBannerDeCategoria";
import { useAuthStore } from "@/stores/auth";
import { computeVisibleModules } from "@/hooks/useVisibleModules";
import { SPECS } from "@/components/screens/canal/specsDeImagem";
import type { Category } from "@/services/categoriesApi";

type PendenteExclusao = { cat: Category; productCount: number } | null;

type Props = {
  /** Abre o assistente de migração (estado vazio). */
  onAbrirMigracao: () => void;
};

export function OrganizarCategorias({ onAbrirMigracao }: Props) {
  // Banner da categoria: so o primeiro nivel entra na tira da home.
  const banner = useBannerDeCategoria();
  const C = useColors();
  // Banner de categoria vive na vitrine do Canal Digital (plano Negocio+).
  // Quem nao tem o Canal nao ve o botao nem a frase: no Essencial o que o
  // plano nao tem some. Mesma regra do menu (computeVisibleModules): override
  // de modulo antes do plano. O plano vem do login e pode estar velho
  // (CLAUDE.md, armadilha 1), entao revalida /auth/me ao abrir.
  const company = useAuthStore((st) => st.company);
  const refreshMe = useAuthStore((st) => st.refreshMe);
  useEffect(() => {
    if (typeof refreshMe === "function") refreshMe().catch(() => {});
  }, [refreshMe]);
  const temCanal = useMemo(
    () => computeVisibleModules(company?.plan, (company as any)?.module_overrides, null).has("canal"),
    [company?.plan, (company as any)?.module_overrides]
  );
  const { tree, flattened, isLoading, create, isCreating } = useCategories();
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

  // `flattened` é FlatCategory[] ({ category, breadcrumb }), não
  // Category[]. A tela lia `c.path` direto no item e o "mover" quebrava
  // (path undefined → startsWith). Aqui vira a lista de Category.
  const todas: Category[] = useMemo(
    () => (flattened || []).map((f: FlatCategory) => f.category),
    [flattened]
  );

  // Destinos possíveis num move: qualquer nó que ainda aceite filho, menos
  // o próprio e menos a própria subárvore (o backend barra com
  // CATEGORY_CYCLE, mas oferecer a opção seria oferecer um erro).
  const destinosMove = useMemo(() => {
    if (!movendo) return [];
    const prefixo = movendo.path + "/";
    return todas.filter(
      (c: Category) =>
        c.id !== movendo.id &&
        !c.path.startsWith(prefixo) &&
        canHaveChildren(c)
    );
  }, [movendo, todas]);

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

  function campoCriar(parentId: string | null, placeholder: string) {
    return (
      <View style={[s.criar, parentId ? { marginLeft: 24 } : null]}>
        <TextInput
          value={nomeNovo}
          onChangeText={setNomeNovo}
          placeholder={placeholder}
          placeholderTextColor={C.ink3}
          autoFocus
          onSubmitEditing={() => confirmarCriacao(parentId)}
          style={[s.input, { color: C.ink, borderColor: C.border2 }]}
          testID="organizar-criar-nome"
        />
        <View style={s.criarBotoes}>
          <Pressable
            onPress={() => confirmarCriacao(parentId)}
            disabled={isCreating}
            style={[s.btnPri, { opacity: nomeNovo.trim() ? 1 : 0.5 }]}
            accessibilityRole="button"
            testID="organizar-criar-confirmar"
          >
            <Text style={s.btnPriTxt}>Criar</Text>
          </Pressable>
          <Pressable onPress={() => setCriandoEm(null)} style={s.btnSec} accessibilityRole="button" testID="organizar-criar-cancelar">
            <Text style={s.btnSecTxt}>Cancelar</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  function renderNo(cat: Category, nivel: number) {
    const filhos = cat.children || [];
    const aberto = abertos[cat.id] ?? nivel === 0;
    const total = cat.product_count_total ?? cat.product_count;
    const podeTerFilho = canHaveChildren(cat);

    return (
      <View key={cat.id} style={{ marginLeft: nivel * 16 }}>
        <View style={s.no} testID={`organizar-no-${cat.id}`}>
          <View style={s.linha}>
            {filhos.length ? (
              <Pressable
                onPress={() => setAbertos((a) => ({ ...a, [cat.id]: !aberto }))}
                accessibilityRole="button"
                accessibilityLabel={aberto ? "Recolher" : "Expandir"}
                style={s.chevron}
                testID={`organizar-expandir-${cat.id}`}
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
                style={[s.input, { color: C.ink, borderColor: C.border2 }]}
                testID={`organizar-renomear-campo-${cat.id}`}
              />
            ) : (
              <Pressable
                onPress={() => { setRenomeando(cat.id); setNomeEdit(cat.name); }}
                style={{ flex: 1, minWidth: 0 }}
                accessibilityRole="button"
                accessibilityLabel={`Renomear ${cat.name}`}
              >
                <Text style={s.nome} numberOfLines={1}>{cat.name}</Text>
              </Pressable>
            )}

            {/* product_count_total: a subárvore inteira. Ver cabeçalho. */}
            <View style={s.contagemPill} accessibilityLabel={`${total} produto(s)`}>
              <Text style={s.contagem}>{total}</Text>
            </View>
          </View>

          <View style={s.acoes}>
            {podeTerFilho ? (
              <Pressable
                onPress={() => { setCriandoEm(cat.id); setNomeNovo(""); }}
                style={s.acao}
                accessibilityRole="button"
                testID={`organizar-sub-${cat.id}`}
              >
                <Text style={s.acaoTxt}>+ Subcategoria</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => { setRenomeando(cat.id); setNomeEdit(cat.name); }}
              style={s.acao}
              accessibilityRole="button"
              testID={`organizar-renomear-${cat.id}`}
            >
              <Text style={s.acaoTxt}>Renomear</Text>
            </Pressable>
            {nivel === 0 && temCanal ? (
              <Pressable
                onPress={() => banner.escolherEEnviar(cat.id)}
                style={s.acao}
                accessibilityRole="button"
                accessibilityLabel={`Banner de ${cat.name}`}
                testID={`banner-${cat.id}`}
              >
                <Text style={[s.acaoTxt, cat.banner_url ? { color: C.green } : null]}>
                  {cat.banner_url ? "Banner ✓" : "Banner"}
                </Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => setMovendo(cat)} style={s.acao} accessibilityRole="button" testID={`organizar-mover-${cat.id}`}>
              <Text style={s.acaoTxt}>Mover</Text>
            </Pressable>
            <Pressable
              onPress={() => tentarExcluir(cat)}
              disabled={isRemoving}
              style={s.acao}
              accessibilityRole="button"
              testID={`organizar-excluir-${cat.id}`}
            >
              <Text style={[s.acaoTxt, { color: C.red }]}>Excluir</Text>
            </Pressable>
          </View>
        </View>

        {criandoEm === cat.id ? campoCriar(cat.id, `Nova subcategoria em ${cat.name}`) : null}

        {aberto ? filhos.map((f) => renderNo(f, nivel + 1)) : null}
      </View>
    );
  }

  // ── Mover: ocupa o lugar da árvore até escolher ou cancelar ──
  if (movendo) {
    return (
      <View testID="organizar-mover-painel">
        <Text style={s.passo}>Mover “{movendo.name}” para dentro de:</Text>
        {destinosMove.length === 0 ? (
          <Text style={s.corpo}>
            Não há destino possível. Só categorias de nível 0 e 1 aceitam filhos, e a própria
            subárvore não conta.
          </Text>
        ) : null}
        <View style={{ gap: 8, marginTop: 10 }}>
          {destinosMove.map((d: Category) => (
            <Pressable
              key={d.id}
              onPress={async () => { await move(movendo.id, d.id); setMovendo(null); }}
              style={s.destino}
              accessibilityRole="button"
              testID={`organizar-mover-destino-${d.id}`}
            >
              <Text style={s.destinoTxt}>{d.path.replace(/^\//, "").replace(/\//g, " › ")}</Text>
            </Pressable>
          ))}
          <Pressable
            onPress={async () => { await move(movendo.id, null); setMovendo(null); }}
            style={s.destino}
            accessibilityRole="button"
            testID="organizar-mover-raiz"
          >
            <Text style={s.destinoTxt}>Tornar categoria principal</Text>
          </Pressable>
        </View>
        <View style={s.rodapeAcoes}>
          <Pressable onPress={() => setMovendo(null)} style={s.btnSec} accessibilityRole="button" testID="organizar-mover-cancelar">
            <Text style={s.btnSecTxt}>Cancelar</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Excluir com destino: idem ─────────────────────────────
  if (excluir) {
    const pronto = !!destino.trim();
    return (
      <View testID="organizar-excluir-painel">
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
          style={[s.input, { color: C.ink, borderColor: C.border2, marginTop: 12, flex: 0 }]}
          testID="organizar-excluir-destino"
        />
        <View style={s.rodapeAcoes}>
          <Pressable
            onPress={() => { setExcluir(null); setDestino(""); }}
            style={s.btnSec}
            accessibilityRole="button"
            testID="organizar-excluir-cancelar"
          >
            <Text style={s.btnSecTxt}>Cancelar</Text>
          </Pressable>
          <Pressable
            onPress={excluirComDestino}
            disabled={!pronto || isRemoving}
            style={[s.btnPri, { opacity: pronto ? 1 : 0.5 }]}
            accessibilityRole="button"
            testID="organizar-excluir-confirmar"
          >
            <Text style={s.btnPriTxt}>Mover produtos e excluir</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View testID="organizar-categorias">
      <Text style={s.sub}>
        Até três níveis. O número ao lado de cada categoria conta os produtos dela e de tudo
        que está abaixo.
      </Text>
      {/* A medida sai de specsDeImagem.ts — a mesma que o resto do painel
          usa. Escrita aqui de novo, viraria a segunda fonte. So aparece
          para quem tem o Canal Digital (ver temCanal acima). */}
      {temCanal ? (
        <Text style={s.sub} testID="organizar-frase-banner">
          As categorias principais podem ter um banner na sua loja ({SPECS.categoria.resumo}).
          Sem banner, a categoria aparece com um fundo da sua cor.
        </Text>
      ) : null}

      {isLoading ? <View style={{ paddingVertical: 16 }}><ActivityIndicator color={C.violet3} /></View> : null}

      {!isLoading && tree.length === 0 ? (
        <View style={s.vazio}>
          <Text style={s.corpo}>
            Nenhuma categoria ainda. Crie a primeira abaixo — ou, se o catálogo já tem
            categoria em texto, use o assistente de migração.
          </Text>
          <Pressable onPress={onAbrirMigracao} style={s.link} accessibilityRole="button" testID="organizar-migracao">
            <Text style={s.linkTxt}>Abrir assistente de migração →</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={{ gap: 8 }}>
        {tree.map((c: Category) => renderNo(c, 0))}
      </View>

      {criandoEm === "raiz" ? (
        campoCriar(null, "Nome da categoria principal")
      ) : (
        <Pressable
          onPress={() => { setCriandoEm("raiz"); setNomeNovo(""); }}
          style={s.novaRaiz}
          accessibilityRole="button"
          testID="organizar-nova-raiz"
        >
          <Text style={s.novaRaizTxt}>+ Categoria principal</Text>
        </Pressable>
      )}
    </View>
  );
}

// Mesmo vocabulário dos modais do Estoque (Transferências, Últimos
// reajustes): item em bg2 com borda e raio 12, botão primário violeta,
// secundário com borda border2, alvos de toque de 44 px nos botões.
function estilos(C: any) {
  return StyleSheet.create({
    sub:        { fontSize: 12.5, color: C.ink3, marginBottom: 10, lineHeight: 18 },
    vazio:      { backgroundColor: C.bg2, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 10 },
    passo:      { fontSize: 15, fontWeight: "700", color: C.ink, marginBottom: 6 },
    corpo:      { fontSize: 13, color: C.ink3, lineHeight: 19 },
    no:         { backgroundColor: C.bg2, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 10, paddingVertical: 8 },
    linha:      { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 32 },
    chevron:    { width: 24, height: 32, alignItems: "center", justifyContent: "center" },
    nome:       { fontSize: 13.5, color: C.ink, fontWeight: "700" },
    contagemPill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2, backgroundColor: C.violetD, borderWidth: 1, borderColor: C.border2 },
    contagem:   { fontSize: 11.5, color: C.ink2, fontWeight: "700" },
    acoes:      { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6, marginLeft: 32 },
    acao:       { minHeight: 32, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: C.border2, justifyContent: "center" },
    acaoTxt:    { fontSize: 12, color: C.violet3, fontWeight: "700" },
    criar:      { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 8, marginBottom: 4 },
    criarBotoes:{ flexDirection: "row", gap: 8 },
    novaRaiz:   { minHeight: 44, borderRadius: 10, borderWidth: 1, borderStyle: "dashed", borderColor: C.border2, alignItems: "center", justifyContent: "center", marginTop: 10 },
    novaRaizTxt:{ color: C.violet3, fontSize: 13, fontWeight: "700" },
    link:       { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
    linkTxt:    { color: C.violet3, fontSize: 12.5, fontWeight: "700" },
    destino:    { minHeight: 44, justifyContent: "center", paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.bg2 },
    destinoTxt: { color: C.ink, fontSize: 13, fontWeight: "600" },
    rodapeAcoes:{ flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 8, marginTop: 14 },
    btnPri:     { backgroundColor: C.violet, minHeight: 44, paddingHorizontal: 16, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    btnPriTxt:  { color: "#fff", fontSize: 13, fontWeight: "700" },
    btnSec:     { minHeight: 44, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: C.border2, alignItems: "center", justifyContent: "center" },
    btnSecTxt:  { color: C.ink, fontSize: 13, fontWeight: "600" },
    input:      { flex: 1, minWidth: 160, minHeight: 40, borderWidth: 1, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 8, fontSize: 13, ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}) },
  });
}

export default OrganizarCategorias;
