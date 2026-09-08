// ============================================================
// AURA. — Cadastro de item · passo 1 "O básico"
//
// Tipo (produto/serviço, travado na edição), nome e categoria. O nome
// é a estrela: recebe foco sozinho no desktop e é o único obrigatório
// pra seguir. A checagem de duplicata agora vem com AÇÃO — o aviso
// leva pra edição do produto que já existe, na grade de variações.
// ============================================================
import { useEffect, useRef } from "react";
import { View, Text, Pressable } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { hexToName } from "@/utils/colorNames";
import { Campo, Entrada, IS_WEB, s } from "./ui";
import { CategoriaSeletor } from "./CategorySelector";
import { nomeDoTipo, type ItemType } from "./types";

export type DuplicataRow = {
  id: string; name: string; sku?: string; barcode?: string;
  color?: string; size?: string; price?: number; stock_qty?: number;
};

type Props = {
  type: ItemType;
  travado: boolean;
  nome: string;
  onNome: (v: string) => void;
  onTipo: (t: ItemType) => void;
  duplicatas: DuplicataRow[];
  onDupMerge: (d: DuplicataRow) => void;
  onDupNao: () => void;
  categoriaRotulo: string;
  categoriaUltimaUsada: boolean;
  onAbrirCategoria: () => void;
  onSubmit: () => void;
  onBlur: () => void;
  autoFocus: boolean;
  narrow: boolean;
};

function CartaoTipo({
  ativo, desabilitado, icon, titulo, texto, onPress, narrow,
}: {
  ativo: boolean; desabilitado: boolean; icon: string; titulo: string;
  texto: string; onPress: () => void; narrow: boolean;
}) {
  return (
    <Pressable
      onPress={desabilitado ? undefined : onPress}
      disabled={desabilitado}
      accessibilityLabel={titulo}
      style={[
        st.tipo,
        narrow ? { flexDirection: "column", gap: 8 } : null,
        ativo && st.tipoAtivo,
        desabilitado && { opacity: 0.45 },
      ]}
    >
      <View style={[st.tipoIco, ativo && st.tipoIcoAtivo]}>
        <Icon name={icon as any} size={16} color={ativo ? "#fff" : Colors.ink3} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={st.tipoTitulo}>{titulo}</Text>
        <Text style={st.tipoTexto}>{texto}</Text>
      </View>
    </Pressable>
  );
}

export function Step1Basico({
  type, travado, nome, onNome, onTipo, duplicatas, onDupMerge, onDupNao,
  categoriaRotulo, categoriaUltimaUsada, onAbrirCategoria,
  onSubmit, onBlur, autoFocus, narrow,
}: Props) {
  const isProduto = type === "product";
  const nomeRef = useRef<any>(null);

  // Foco automático só no desktop/web — no celular abriria o teclado por
  // cima do modal antes da pessoa decidir o tipo. preventScroll evita o
  // salto do painel inteiro.
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
    <View>
      <View style={[st.tipos, narrow && { flexDirection: "column" }]}>
        <CartaoTipo
          ativo={isProduto}
          desabilitado={travado && !isProduto}
          icon="package"
          titulo="Produto"
          texto="Fica no estoque. Pode ter código de barras, cores e tamanhos."
          onPress={() => onTipo("product")}
          narrow={narrow}
        />
        <CartaoTipo
          ativo={!isProduto}
          desabilitado={travado && isProduto}
          icon="star"
          titulo="Serviço"
          texto="Não tem estoque. Vendido direto no Caixa, com duração."
          onPress={() => onTipo("service")}
          narrow={narrow}
        />
      </View>

      {travado && (
        <View style={st.lockNote}>
          <Icon name="lock" size={12} color={Colors.ink3} />
          <Text style={st.lockTxt}>O tipo não muda depois de criado.</Text>
        </View>
      )}

      <Campo label={"Nome do " + nomeDoTipo(type)} required>
        <Entrada
          ref={nomeRef}
          value={nome}
          onChangeText={onNome}
          onBlur={onBlur}
          onSubmitEditing={onSubmit}
          returnKeyType="next"
          placeholder={isProduto ? "Ex.: Vestido midi floral" : "Ex.: Corte feminino, Manicure, Consultoria"}
          autoComplete="off"
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

      <Campo label="Categoria" optional="opcional">
        <CategoriaSeletor
          rotulo={categoriaRotulo}
          ultimaUsada={categoriaUltimaUsada}
          onAbrir={onAbrirCategoria}
        />
      </Campo>
    </View>
  );
}

const st = {
  tipos: { flexDirection: "row" as const, gap: 10, marginBottom: 18 },
  tipo: {
    flex: 1, flexDirection: "row" as const, gap: 11, alignItems: "flex-start" as const,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: Colors.bg4, borderWidth: 1.5, borderColor: Colors.border,
  },
  tipoAtivo: { backgroundColor: Colors.violetD, borderColor: Colors.violet },
  tipoIco: {
    width: 34, height: 34, borderRadius: 9, backgroundColor: Colors.bg3,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: "center" as const, justifyContent: "center" as const,
  },
  tipoIcoAtivo: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  tipoTitulo: { fontSize: 13.5, color: Colors.ink, fontWeight: "700" as const },
  tipoTexto: { fontSize: 11.5, color: Colors.ink3, lineHeight: 16, marginTop: 2 },
  lockNote: { flexDirection: "row" as const, alignItems: "center" as const, gap: 6, marginTop: -10, marginBottom: 16 },
  lockTxt: { fontSize: 11, color: Colors.ink3 },
  dup: {
    backgroundColor: Colors.amberD, borderWidth: 1, borderColor: "rgba(251,191,36,0.35)",
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: -6, marginBottom: 14,
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

export default Step1Basico;
