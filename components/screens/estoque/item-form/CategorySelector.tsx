// ============================================================
// AURA. — Cadastro de item · categoria numa linha + folha
//
// O passo 1 tinha uma régua de chips que roubava a cena do NOME. Agora
// é um botão de uma linha, já preenchido com a última categoria usada,
// e "Trocar" abre a árvore numa folha por cima do painel.
//
// A árvore (CategoryTreePicker) é o caminho principal; o fallback de
// chips continua no ar enquanto a empresa não tiver árvore — que é o
// estado real da maioria das bases. Serviço usa categorias de texto
// type='service', separadas das de produto (igual ao AddServiceForm).
// ============================================================
import { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { CategoryTreePicker, type CategorySelection } from "@/components/catalog/CategoryTreePicker";
import { useCategories } from "@/hooks/useCategories";
import { useProductCategories } from "@/hooks/useProductCategories";
import { Chip, Entrada, MiniBtn, s } from "./ui";
import type { ItemType } from "./types";

// Caminho legível de um nó da árvore: "Roupas › Vestidos".
export function useBreadcrumbLabel(): (id: string | null) => string {
  const { flattened } = useCategories();
  return useMemo(() => {
    const map: Record<string, string> = {};
    flattened.forEach((f) => {
      map[f.category.id] = f.breadcrumb.map((n) => n.name).join(" › ");
    });
    return (id: string | null) => (id ? map[id] || "" : "");
  }, [flattened]);
}

export function CategoriaSeletor({
  rotulo, ultimaUsada, onAbrir,
}: {
  rotulo: string;
  ultimaUsada: boolean;
  onAbrir: () => void;
}) {
  return (
    <Pressable onPress={onAbrir} style={cs.linha} accessibilityLabel="Escolher categoria">
      <Icon name="tag" size={14} color={Colors.ink3} />
      {rotulo ? (
        <Text style={cs.valor} numberOfLines={1}>{rotulo}</Text>
      ) : (
        <Text style={cs.placeholder}>Escolher categoria</Text>
      )}
      {rotulo && ultimaUsada ? (
        <View style={cs.badge}><Text style={cs.badgeTxt}>última usada</Text></View>
      ) : null}
      <Text style={cs.trocar}>{rotulo ? "Trocar" : "Escolher"}</Text>
    </Pressable>
  );
}

export function CategoriaSheet({
  type, selecao, onChangeSelecao, legado, onChangeLegado, categoriasLegado, productId, onClose,
  sugeridas,
}: {
  type: ItemType;
  selecao: CategorySelection;
  onChangeSelecao: (v: CategorySelection) => void;
  legado: string;
  onChangeLegado: (v: string) => void;
  categoriasLegado: string[];
  productId?: string;
  onClose: () => void;
  // 22/09/2026 (perfil de cadastro): categorias do ramo, oferecidas só a
  // quem ainda não tem nenhuma. Sem a prop, a folha é a de hoje.
  sugeridas?: readonly string[];
}) {
  const isProduto = type === "product";
  const { tree } = useCategories();
  const temArvore = isProduto && tree.length > 0;
  const { categories: gerenciadas } = useProductCategories(isProduto ? "product" : "service");
  const [novaCat, setNovaCat] = useState("");
  const [mostrarNova, setMostrarNova] = useState(false);

  // Lista de chips do fallback: gerenciadas + as que já existem nos itens.
  const lista = useMemo(() => {
    const nomes = gerenciadas.map((c) => c.name);
    const set = new Set(nomes.map((n) => n.toLowerCase()));
    (categoriasLegado || []).forEach((c) => {
      if (c && !set.has(c.toLowerCase())) { nomes.push(c); set.add(c.toLowerCase()); }
    });
    if (!isProduto && !set.has("servicos")) nomes.push("Servicos");
    return nomes;
  }, [gerenciadas, categoriasLegado, isProduto]);
  const doRamo = isProduto && lista.length === 0 ? (sugeridas || []) : [];

  const corPorNome = useMemo(() => {
    const map: Record<string, string | null> = {};
    gerenciadas.forEach((c) => { map[c.name] = c.color; });
    return map;
  }, [gerenciadas]);

  function escolherLegado(nome: string) {
    onChangeLegado(nome);
    setMostrarNova(false);
    onClose();
  }

  function criarNova() {
    const nome = novaCat.trim();
    if (!nome) return;
    onChangeLegado(nome);
    setNovaCat("");
    setMostrarNova(false);
    onClose();
  }

  return (
    <View style={cs.sheetOverlay}>
      <Pressable style={cs.sheetBackdrop} onPress={onClose} />
      <View style={cs.sheetCard}>
        <View style={cs.sheetHead}>
          <Text style={cs.sheetTitulo}>Categoria</Text>
          <Pressable onPress={onClose} style={cs.sheetX} accessibilityLabel="Fechar">
            <Icon name="x" size={14} color={Colors.ink3} />
          </Pressable>
        </View>
        <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          {temArvore ? (
            <CategoryTreePicker
              value={selecao}
              onChange={(v) => { onChangeSelecao(v); if (v.primaryCategoryId) onClose(); }}
              productId={productId}
            />
          ) : (
            <View>
              {doRamo.length > 0 ? (
                <View style={{ marginBottom: 10 }}>
                  <Text style={[s.hint, { marginTop: 0, marginBottom: 6 }]}>Sugestões do seu ramo — toque para usar:</Text>
                  <View style={s.chips}>
                    {doRamo.map((c) => (
                      <Chip key={"ramo-" + c} label={c} onPress={() => escolherLegado(c)} />
                    ))}
                  </View>
                </View>
              ) : null}
              <View style={s.chips}>
                {lista.map((c) => (
                  <Chip
                    key={c}
                    label={c}
                    active={legado === c && !mostrarNova}
                    swatch={corPorNome[c] || undefined}
                    onPress={() => escolherLegado(c)}
                  />
                ))}
                <Chip label="+ Nova" dashed onPress={() => setMostrarNova(true)} />
              </View>
              {mostrarNova && (
                <View style={[s.linha2, { marginTop: 10 }]}>
                  <Entrada
                    value={novaCat}
                    onChangeText={setNovaCat}
                    placeholder="Nome da nova categoria"
                    style={{ flex: 1 }}
                    autoFocus
                    onSubmitEditing={criarNova}
                  />
                  <MiniBtn label="Usar" onPress={criarNova} disabled={!novaCat.trim()} />
                </View>
              )}
            </View>
          )}
          <Text style={s.hint}>
            {temArvore
              ? "Organize a árvore em Catálogo › Organizar catálogo."
              : isProduto
                ? 'Gerencie suas categorias pelo botão "Categorias" na tela de Estoque.'
                : "Categorias de serviço são separadas das de produto."}
          </Text>
        </ScrollView>
      </View>
    </View>
  );
}

const cs = {
  linha: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 10,
    backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10,
  },
  valor: { fontSize: 13.5, color: Colors.ink, flexShrink: 1 },
  placeholder: { fontSize: 13.5, color: Colors.ink3, flex: 1 },
  badge: {
    borderRadius: 5, paddingHorizontal: 6, paddingVertical: 1,
    backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border,
  },
  badgeTxt: { fontSize: 10.5, color: Colors.ink3 },
  trocar: { marginLeft: "auto" as any, fontSize: 12, color: Colors.violet3, fontWeight: "700" as const },
  sheetOverlay: {
    position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: "flex-end" as const, alignItems: "center" as const, zIndex: 40,
  },
  sheetBackdrop: {
    position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheetCard: {
    width: "100%" as const, maxHeight: "82%" as any,
    backgroundColor: Colors.bg3,
    borderTopLeftRadius: 18, borderTopRightRadius: 18,
    borderTopWidth: 1, borderColor: "rgba(124,58,237,0.3)",
  },
  sheetHead: {
    flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const,
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  sheetTitulo: { fontSize: 14, color: Colors.ink, fontWeight: "700" as const },
  sheetX: {
    width: 30, height: 30, borderRadius: 8, backgroundColor: Colors.bg4,
    alignItems: "center" as const, justifyContent: "center" as const,
  },
};
