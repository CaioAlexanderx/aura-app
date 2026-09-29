// ============================================================
// components/studio/orcamentoModal/CatalogoDoOrcamento.tsx
//
// "Adicionar" no modal do orçamento (29/09/2026). Antes a lista só
// aparecia depois de digitar 2 letras, e a folha fechava a cada peça.
// Agora o catálogo abre JÁ CHEIO, no lugar da coluna das peças: busca,
// categorias, "Mais usados" e "Recentes" (backend, por CNPJ) e todos de
// A a Z, com foto, preço e o selo do modelo (3D / 2D / Sem mockup).
// Tocar adiciona e a lojista continua escolhendo; o rodapé do modal tem
// o Concluir. "Item avulso" abre um formulário na própria seção.
// ============================================================
import React, { useMemo, useState } from "react";
import { View, Text, Pressable, TextInput, ScrollView, ActivityIndicator } from "react-native";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import type { ProdutosFrequentesDoOrcamento } from "@/services/studioApi";
import type { VisualTemplate } from "@/services/studioVisualApi";
import { reais } from "@/components/studio/orcamentoVideo/condicoesDoOrcamento";
import {
  TODAS_AS_CATEGORIAS, categoriasDoCatalogo, gruposDoCatalogo, lerPreco, lerQuantidade, seloDoModelo,
  type ProdutoDoCatalogo,
} from "./regras";
import { Botao, Campo, Chip, FotoDoProduto, Secao, Selo, type Tema } from "./ui";

const PAGINA = 40;

type Props = {
  tema: Tema;
  produtos: ProdutoDoCatalogo[] | null;
  erro: string | null;
  frequentes: ProdutosFrequentesDoOrcamento | null;
  templates: VisualTemplate[];
  /** product_id → quantas unidades já estão no orçamento. */
  noOrcamento: Record<string, number>;
  onAdicionar: (p: ProdutoDoCatalogo) => void;
  onAvulso: (item: { description: string; quantity: number; unit_price: number }) => void;
  onRecarregar: () => void;
};

export function CatalogoDoOrcamento({ tema, produtos, erro, frequentes, templates, noOrcamento, onAdicionar, onAvulso, onRecarregar }: Props) {
  const { t, escuro, estreito } = tema;
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState(TODAS_AS_CATEGORIAS);
  const [limite, setLimite] = useState(PAGINA);
  const [avulsoAberto, setAvulsoAberto] = useState(false);
  const [desc, setDesc] = useState("");
  const [qtd, setQtd] = useState("1");
  const [preco, setPreco] = useState("");

  const categorias = useMemo(() => categoriasDoCatalogo(produtos || []), [produtos]);
  const grupos = useMemo(
    () => gruposDoCatalogo(produtos || [], frequentes, { busca, categoria }),
    [produtos, frequentes, busca, categoria],
  );

  function adicionarAvulso() {
    const d = desc.trim();
    if (!d) { toast.error("Diga o que está sendo cobrado neste item"); return; }
    onAvulso({ description: d, quantity: lerQuantidade(qtd) ?? 1, unit_price: lerPreco(preco) ?? 0 });
    setDesc(""); setQtd("1"); setPreco("");
    setAvulsoAberto(false);
  }

  function linha(p: ProdutoDoCatalogo, extra?: string) {
    const selo = seloDoModelo(p.visual_template_key, templates);
    const ja = noOrcamento[p.id] || 0;
    return (
      <Pressable
        key={p.id}
        onPress={() => onAdicionar(p)}
        accessibilityRole="button"
        accessibilityLabel={`${p.name}, ${reais(p.price)}${ja ? ", já no orçamento, adicionar mais uma" : ", adicionar"}`}
        testID={"produto-" + p.id}
        style={{
          flexDirection: "row", alignItems: "center", gap: 10, minHeight: 56, padding: 6, borderRadius: 12,
          borderWidth: 1.5, borderColor: ja ? t.success : "transparent", backgroundColor: t.paperCardElev,
        }}
      >
        <FotoDoProduto t={t} uri={p.image_url} tamanho={40} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text numberOfLines={1} style={{ fontWeight: "700", fontSize: 13.5, color: t.ink }}>{p.name}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <Selo t={t} tipo={selo.tipo} rotulo={selo.rotulo} />
            <Text numberOfLines={1} style={{ fontSize: 12, color: t.ink3, flexShrink: 1 }}>
              {[p.category, extra, ja ? `${String(ja).replace(".", ",")} no orçamento` : null].filter(Boolean).join(" · ")}
            </Text>
          </View>
        </View>
        <Text style={{ fontWeight: "800", color: t.ink, fontSize: 13.5 }}>{reais(p.price)}</Text>
        <View style={{ width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: ja ? t.successSoft : t.primarySoft }}>
          <Icon name={ja ? "check" : "plus"} size={18} color={ja ? t.successInk : escuro ? t.primary2 : t.primary} />
        </View>
      </Pressable>
    );
  }

  function grupo(titulo: string, sub: string, filhos: React.ReactNode[], testID: string) {
    if (!filhos.length) return null;
    return (
      <View style={{ gap: 4 }} testID={testID}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6, marginBottom: 2 }}>
          <Text style={{ fontSize: 11, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase", color: t.ink3 }}>{titulo}</Text>
          <Text style={{ fontSize: 11, color: t.ink3 }}>{sub}</Text>
        </View>
        {filhos}
      </View>
    );
  }

  const total = produtos?.length ?? 0;
  const todosVisiveis = grupos.todos.slice(0, limite);

  return (
    <Secao
      tema={tema}
      testID="catalogo"
      titulo={<>Catálogo{produtos ? <Text style={{ color: t.ink }}> · {total} {total === 1 ? "produto" : "produtos"}</Text> : null}</>}
      direita={<Chip tema={tema} rotulo="+ Item avulso" ligado={avulsoAberto} onPress={() => setAvulsoAberto((v) => !v)} testID="chip-avulso" />}
    >
      {avulsoAberto ? (
        <View style={{ borderWidth: 1.5, borderColor: t.primary, borderRadius: 12, padding: 12, gap: 10, backgroundColor: t.paperCardElev }} testID="form-avulso">
          <Campo tema={tema} rotulo="Descrição" value={desc} onChangeText={setDesc} placeholder="Ex.: criação da arte" autoFocus />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}><Campo tema={tema} rotulo="Quantidade" value={qtd} onChangeText={setQtd} keyboardType="decimal-pad" /></View>
            <View style={{ flex: 1 }}><Campo tema={tema} rotulo="Preço unitário (R$)" value={preco} onChangeText={setPreco} keyboardType="decimal-pad" placeholder="0,00" /></View>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
            <Botao tema={tema} tipo="ter" pequeno rotulo="Cancelar" onPress={() => setAvulsoAberto(false)} />
            <Botao tema={tema} tipo="sec" pequeno rotulo="Adicionar item avulso" icone="plus" onPress={adicionarAvulso} testID="adicionar-avulso" />
          </View>
        </View>
      ) : null}

      <View style={{ justifyContent: "center" }}>
        <View style={{ position: "absolute", left: 11, zIndex: 1 }} pointerEvents="none"><Icon name="search" size={16} color={t.ink3} /></View>
        <TextInput
          value={busca}
          onChangeText={(v) => { setBusca(v); setLimite(PAGINA); }}
          placeholder="Buscar por nome, código ou categoria"
          placeholderTextColor={t.ink3}
          accessibilityLabel="Buscar produto"
          testID="busca-catalogo"
          style={{ minHeight: 44, borderRadius: 10, borderWidth: 1.5, borderColor: t.ink5, backgroundColor: t.paperCardElev, paddingLeft: 36, paddingRight: 12, fontSize: 14, color: t.ink }}
        />
      </View>

      {categorias.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} accessibilityRole={"group" as any} accessibilityLabel="Categoria">
          {[TODAS_AS_CATEGORIAS, ...categorias].map((c) => (
            <Chip key={c} tema={tema} rotulo={c === TODAS_AS_CATEGORIAS ? "Todos" : c} ligado={categoria === c} onPress={() => { setCategoria(c); setLimite(PAGINA); }} />
          ))}
        </ScrollView>
      ) : null}

      {produtos === null ? (
        <View style={{ paddingVertical: 24, alignItems: "center", gap: 8 }}>
          <ActivityIndicator color={t.primary} />
          <Text style={{ color: t.ink3, fontSize: 12.5 }}>Carregando o catálogo…</Text>
        </View>
      ) : erro ? (
        <View style={{ paddingVertical: 18, alignItems: "center", gap: 6 }}>
          <Text style={{ color: t.dangerInk, fontSize: 13, textAlign: "center" }}>{erro}</Text>
          <Botao tema={tema} tipo="sec" pequeno rotulo="Tentar de novo" onPress={onRecarregar} />
        </View>
      ) : total === 0 ? (
        <Text style={{ color: t.ink3, fontSize: 13, textAlign: "center", paddingVertical: 18 }}>
          Nenhum produto cadastrado. Use o item avulso ou cadastre no Estoque.
        </Text>
      ) : (
        <View style={{ gap: 6 }}>
          {grupo("Mais usados", "últimos 90 dias", grupos.maisUsados.map(({ produto, usos }) => linha(produto, `${usos} ${usos === 1 ? "orçamento" : "orçamentos"}`)), "grupo-mais-usados")}
          {grupo("Recentes", "que você usou por último", grupos.recentes.map((p) => linha(p)), "grupo-recentes")}
          {grupo(grupos.buscando ? "Resultados" : "Todos os produtos", grupos.buscando ? `${grupos.todos.length}` : "A–Z", todosVisiveis.map((p) => linha(p)), "grupo-todos")}
          {grupos.buscando && grupos.todos.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 14, gap: 6 }}>
              <Text style={{ color: t.ink3, fontSize: 13, textAlign: "center" }}>Nada com “{busca.trim()}”.</Text>
              <Botao tema={tema} tipo="sec" pequeno rotulo={`Adicionar “${busca.trim()}” como item avulso`} onPress={() => { setDesc(busca.trim()); setAvulsoAberto(true); }} />
            </View>
          ) : null}
          {grupos.todos.length > limite ? (
            <Botao tema={tema} tipo="ter" pequeno rotulo={`Mostrar mais ${Math.min(PAGINA, grupos.todos.length - limite)} de ${grupos.todos.length - limite}`} onPress={() => setLimite((n) => n + PAGINA)} />
          ) : null}
        </View>
      )}
      {estreito ? null : <Text style={{ fontSize: 11.5, color: t.ink3 }}>Toque numa peça para adicionar. Dá para adicionar várias antes de concluir.</Text>}
    </Secao>
  );
}

export default CatalogoDoOrcamento;
