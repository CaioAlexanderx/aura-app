// ============================================================
// AURA. — Cadastro de item (aberto) · seção "O item"
//
// Nome, o aviso de duplicata COM AÇÃO e a categoria numa linha. É a
// primeira coisa da coluna esquerda e a única que o Salvar cobra junto
// com o preço.
// ============================================================
import { useEffect, useRef } from "react";
import { View, Text, Pressable } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { hexToName } from "@/utils/colorNames";
import { Campo, Entrada, Secao, IS_WEB, s } from "./ui";
import { CategoriaSeletor } from "./CategorySelector";
import { nomeDoTipo, statusItem, type ItemType } from "./types";

export type DuplicataRow = {
  id: string; name: string; sku?: string; barcode?: string;
  color?: string; size?: string; price?: number; stock_qty?: number;
};

type Props = {
  type: ItemType;
  nome: string;
  onNome: (v: string) => void;
  duplicatas: DuplicataRow[];
  onDupMerge: (d: DuplicataRow) => void;
  onDupNao: () => void;
  categoriaRotulo: string;
  categoriaUltimaUsada: boolean;
  onAbrirCategoria: () => void;
  onSubmit: () => void;
  autoFocus: boolean;
  narrow: boolean;
};

export function SecaoItem({
  type, nome, onNome, duplicatas, onDupMerge, onDupNao,
  categoriaRotulo, categoriaUltimaUsada, onAbrirCategoria, onSubmit, autoFocus, narrow,
}: Props) {
  const isProduto = type === "product";
  const nomeRef = useRef<any>(null);

  // Foco automático só no desktop/web — no celular abriria o teclado por
  // cima do modal antes de a lojista ver o que tem na tela. preventScroll
  // evita o salto do painel inteiro.
  useEffect(() => {
    if (!autoFocus || !IS_WEB || narrow) return;
    const t = setTimeout(() => {
      const node: any = nomeRef.current;
      if (!node || typeof node.focus !== "function") return;
      try { node.focus({ preventScroll: true }); } catch (_) { node.focus(); }
    }, 60);
    return () => clearTimeout(t);
  }, [autoFocus, narrow]);

  return (
    <Secao icon={isProduto ? "package" : "star"} titulo="O item" selo={statusItem(nome)}>
      <Campo label={"Nome do " + nomeDoTipo(type)} required>
        <Entrada
          ref={nomeRef}
          value={nome}
          onChangeText={onNome}
          onSubmitEditing={onSubmit}
          returnKeyType="done"
          placeholder={isProduto ? "Ex.: Vestido midi floral" : "Ex.: Corte feminino, Manicure, Consultoria"}
          autoComplete="off"
          style={s.inputGrande}
        />
      </Campo>

      {duplicatas.length > 0 && (
        <View style={st.dup}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            <Icon name="alert" size={14} color={Colors.amber} />
            <Text style={st.dupTitulo} numberOfLines={2}>
              {'Você já tem "' + duplicatas[0].name + '" com ' + duplicatas.length +
                (duplicatas.length === 1 ? " variação" : " variações")}
            </Text>
          </View>
          <Text style={st.dupSub}>
            Se for o mesmo produto em outra cor ou tamanho, adicione lá em vez de criar outro.
          </Text>
          <View style={{ marginTop: 6, gap: 4 }}>
            {duplicatas.slice(0, 4).map((d, i) => (
              <View key={d.id || i} style={st.dupLinha}>
                {d.color ? <View style={[st.dupDot, { backgroundColor: d.color }]} /> : null}
                <Text style={st.dupLinhaTxt} numberOfLines={1}>
                  {d.color ? hexToName(d.color) : ""}
                  {d.color && d.size ? " · " : ""}
                  {d.size || ""}
                  {!d.color && !d.size ? (d.sku || d.barcode || d.name) : ""}
                </Text>
                <Text style={st.dupQtd}>{(d.stock_qty ?? 0) + " un"}</Text>
              </View>
            ))}
            {duplicatas.length > 4 && (
              <Text style={st.dupMais}>{"+ " + (duplicatas.length - 4) + " outros"}</Text>
            )}
          </View>
          <View style={st.dupAcoes}>
            <Pressable onPress={() => onDupMerge(duplicatas[0])} style={st.dupGo}>
              <Icon name="layers" size={13} color="#fff" />
              <Text style={st.dupGoTxt}>Adicionar como cor ou tamanho dele</Text>
            </Pressable>
            <Pressable onPress={onDupNao} hitSlop={6}>
              <Text style={st.dupNao}>Não, é outro produto</Text>
            </Pressable>
          </View>
        </View>
      )}

      <Campo label="Categoria" optional="opcional" style={{ marginBottom: 0 }}>
        <CategoriaSeletor
          rotulo={categoriaRotulo}
          ultimaUsada={categoriaUltimaUsada}
          onAbrir={onAbrirCategoria}
        />
      </Campo>
    </Secao>
  );
}

const st = {
  dup: {
    backgroundColor: Colors.amberD, borderWidth: 1, borderColor: "rgba(251,191,36,0.35)",
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: -4, marginBottom: 12,
  },
  dupTitulo: { fontSize: 12.5, color: Colors.amber, fontWeight: "700" as const, flex: 1 },
  dupSub: { fontSize: 11.5, color: Colors.ink2, marginTop: 3, lineHeight: 16 },
  dupLinha: { flexDirection: "row" as const, alignItems: "center" as const, gap: 6 },
  dupDot: { width: 9, height: 9, borderRadius: 5 },
  dupLinhaTxt: { fontSize: 11.5, color: Colors.ink2, flex: 1 },
  dupQtd: { fontSize: 11.5, color: Colors.ink2, fontWeight: "600" as const },
  dupMais: { fontSize: 11, color: Colors.ink3, fontStyle: "italic" as const },
  dupAcoes: { flexDirection: "row" as const, alignItems: "center" as const, gap: 10, marginTop: 10, flexWrap: "wrap" as const },
  dupGo: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 6,
    backgroundColor: Colors.violet, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
  },
  dupGoTxt: { fontSize: 12, color: "#fff", fontWeight: "700" as const },
  dupNao: { fontSize: 12, color: Colors.ink3, textDecorationLine: "underline" as const },
};

export default SecaoItem;
