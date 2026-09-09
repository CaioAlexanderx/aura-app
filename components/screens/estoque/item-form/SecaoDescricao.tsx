// ============================================================
// AURA. — Cadastro de item (aberto) · seção "Descrição e ficha"
//
// O texto que o cliente lê antes de decidir, a ficha técnica (só aparece
// na loja o que estiver preenchido) e a prévia da página, que atualiza
// enquanto se escreve.
// ============================================================
import { View, Text } from "react-native";
import { Colors } from "@/constants/colors";
import { Campo, Entrada, Secao, StoreNote, s } from "./ui";
import { fmtBRL, nomeDoTipo, statusDescricao, type ItemType } from "./types";

type Props = {
  type: ItemType;
  narrow: boolean;
  nome: string;
  preco: number;
  capaUrl: string | null;
  descricao: string; onDescricao: (v: string) => void;
  material: string; onMaterial: (v: string) => void;
  medidas: string; onMedidas: (v: string) => void;
  cuidados: string; onCuidados: (v: string) => void;
};

export function SecaoDescricao(p: Props) {
  const isProduto = p.type === "product";

  const fichaLinhas: Array<[string, string]> = [];
  if (isProduto) {
    if (p.material.trim()) fichaLinhas.push(["Material", p.material.trim()]);
    if (p.medidas.trim()) fichaLinhas.push(["Medidas", p.medidas.trim()]);
    if (p.cuidados.trim()) fichaLinhas.push(["Cuidados", p.cuidados.trim()]);
  }

  return (
    <Secao
      icon="file_text"
      titulo={isProduto ? "Descrição e ficha" : "Descrição"}
      selo={statusDescricao(p.descricao)}
    >
      <StoreNote texto="É o texto que o cliente lê antes de decidir. A prévia atualiza enquanto você escreve." />

      <Campo label="Descrição" style={{ marginTop: 12 }}>
        <Entrada
          value={p.descricao}
          onChangeText={p.onDescricao}
          placeholder={isProduto
            ? "Do que é feito, como veste, como cuidar."
            : "O que está incluso, para quem é, o que levar."}
          multiline
          numberOfLines={4}
          style={{ minHeight: 72, textAlignVertical: "top" }}
        />
      </Campo>

      {isProduto && (
        <Campo label="Ficha técnica" optional="só aparece o que estiver preenchido">
          <View style={[s.linha2, p.narrow && { flexDirection: "column", gap: 8 }]}>
            <Entrada value={p.material} onChangeText={p.onMaterial} placeholder="Material" style={{ flex: 1 }} />
            <Entrada value={p.medidas} onChangeText={p.onMedidas} placeholder="Medidas" style={{ flex: 1 }} />
            <Entrada value={p.cuidados} onChangeText={p.onCuidados} placeholder="Cuidados" style={{ flex: 1 }} />
          </View>
        </Campo>
      )}

      <View style={st.pv}>
        <Text style={st.pvHead}>Prévia na loja</Text>
        <View style={[st.pvBody, p.narrow && { flexDirection: "column" }]}>
          <View style={[st.pvImg, !!p.capaUrl && st.pvImgTem]} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={st.pvNome}>{p.nome || ("Nome do " + nomeDoTipo(p.type))}</Text>
            <Text style={st.pvPreco}>{fmtBRL(p.preco)}</Text>
            {p.descricao.trim()
              ? <Text style={st.pvDesc}>{p.descricao.trim()}</Text>
              : <Text style={st.pvVazio}>Sem descrição, a página mostra só a foto e o preço.</Text>}
            {fichaLinhas.length > 0 && (
              <View style={st.pvFicha}>
                {fichaLinhas.map(([k, v]) => (
                  <View key={k} style={st.pvLinha}>
                    <Text style={st.pvLinhaK}>{k}</Text>
                    <Text style={st.pvLinhaV}>{v}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </View>
    </Secao>
  );
}

const st = {
  pv: { marginTop: 10, borderWidth: 1, borderStyle: "dashed" as any, borderColor: Colors.border2, borderRadius: 10, overflow: "hidden" as const },
  pvHead: {
    fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase" as const,
    color: Colors.amber, fontWeight: "700" as const,
    paddingHorizontal: 10, paddingVertical: 5, backgroundColor: Colors.amberD,
  },
  pvBody: { flexDirection: "row" as const, gap: 10, padding: 10, backgroundColor: Colors.bg3 },
  pvImg: { width: 60, height: 60, borderRadius: 8, backgroundColor: Colors.bg4, borderWidth: 1, borderStyle: "dashed" as any, borderColor: Colors.border },
  pvImgTem: { backgroundColor: Colors.violet, borderWidth: 0 },
  pvNome: { fontSize: 13.5, color: Colors.ink, fontWeight: "700" as const },
  pvPreco: { fontSize: 12.5, color: Colors.violet3, fontWeight: "700" as const, marginTop: 1, marginBottom: 5 },
  pvDesc: { fontSize: 12, color: Colors.ink2, lineHeight: 17 },
  pvVazio: { fontSize: 12, color: Colors.ink3, fontStyle: "italic" as const, lineHeight: 17 },
  pvFicha: { marginTop: 6, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 5 },
  pvLinha: { flexDirection: "row" as const, gap: 8, paddingVertical: 1 },
  pvLinhaK: { width: 74, fontSize: 11, color: Colors.ink3 },
  pvLinhaV: { flex: 1, fontSize: 11, color: Colors.ink2 },
};

export default SecaoDescricao;
