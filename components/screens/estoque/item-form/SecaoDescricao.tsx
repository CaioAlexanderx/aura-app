// ============================================================
// AURA. — Cadastro de item (aberto) · seção "Descrição e ficha"
//
// O texto que o cliente lê antes de decidir, a ficha técnica (só aparece
// na loja o que estiver preenchido) e a prévia da página, que atualiza
// enquanto se escreve.
//
// 22/09/2026 — PERFIL MATCON (docs/mockups/matcon-cadastro-produto.html,
// ponto ①). Exemplos de depósito e a ficha Marca · Medidas · Material ·
// Onde usar e rendimento. A 4ª linha grava na coluna `cuidados` com outro
// rótulo (decisão do Caio: sem coluna nova). A prévia mostra sozinha o
// tamanho da embalagem ("Caixa 2,32 m²") e o peso, que saem da frase
// "Compro por" e do card Entrega. Sem o perfil, a seção é a de hoje.
// ============================================================
import { View, Text } from "react-native";
import { Colors } from "@/constants/colors";
import { fmtQty, parseQtyInput } from "@/utils/matconUnits";
import { Campo, Entrada, Secao, StoreNote, s } from "./ui";
import { fmtBRL, nomeDoTipo, statusDescricao, type ItemType } from "./types";
import { PERFIL_PADRAO, nomeDaEmbalagem, type CampoDaFicha, type PerfilDoCadastro } from "./perfis";

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
  // 22/09/2026 (perfil de cadastro) — tudo opcional; só o perfil Matcon lê.
  perfil?: PerfilDoCadastro;
  marca?: string; onMarca?: (v: string) => void;
  unidade?: string;
  purchaseUnit?: string | null;
  purchaseFactor?: string;
  peso?: string;
};

/** As linhas automáticas da prévia no Matcon: embalagem e peso. */
export function fichaAutomatica(o: {
  unidade: string; purchaseUnit?: string | null; purchaseFactor?: string; peso?: string;
}): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const fator = o.purchaseFactor && o.purchaseFactor.trim() ? parseQtyInput(o.purchaseFactor) : null;
  if (fator) {
    const emb = nomeDaEmbalagem(o.purchaseUnit).nome;
    out.push([emb.charAt(0).toUpperCase() + emb.slice(1), fmtQty(fator, o.unidade) + " (automático)"]);
  }
  const peso = o.peso && o.peso.trim() ? parseQtyInput(o.peso) : null;
  if (peso) out.push(["Peso", fmtQty(peso) + " kg por " + o.unidade + " (automático)"]);
  return out;
}

export function SecaoDescricao(p: Props) {
  const isProduto = p.type === "product";
  const perfil = p.perfil || PERFIL_PADRAO;
  const matcon = isProduto && perfil.descricao.subRotulos;

  const valores: Record<CampoDaFicha, { v: string; on: (v: string) => void }> = {
    brand: { v: p.marca || "", on: (v) => p.onMarca?.(v) },
    material: { v: p.material, on: p.onMaterial },
    medidas: { v: p.medidas, on: p.onMedidas },
    cuidados: { v: p.cuidados, on: p.onCuidados },
  };

  const fichaLinhas: Array<[string, string]> = [];
  if (isProduto) {
    perfil.descricao.ficha.forEach((l) => {
      const v = valores[l.campo].v.trim();
      if (v) fichaLinhas.push([l.rotulo, v]);
    });
  }
  const unidade = p.unidade || "un";
  const automaticas = matcon && perfil.descricao.fichaAutomatica
    ? fichaAutomatica({ unidade, purchaseUnit: p.purchaseUnit, purchaseFactor: p.purchaseFactor, peso: p.peso })
    : [];

  // Prévia do preço: "R$ 54,90 / m² · R$ 127,37 a caixa" no Matcon.
  let precoDaPrevia = fmtBRL(p.preco);
  if (matcon) {
    precoDaPrevia += " / " + unidade;
    const fator = p.purchaseFactor && p.purchaseFactor.trim() ? parseQtyInput(p.purchaseFactor) : null;
    if (fator && p.preco > 0) {
      const emb = nomeDaEmbalagem(p.purchaseUnit);
      precoDaPrevia += " · " + fmtBRL(p.preco * fator) + " " + emb.artigo + " " + emb.nome;
    }
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
            ? perfil.descricao.placeholder
            : "O que está incluso, para quem é, o que levar."}
          multiline
          numberOfLines={4}
          style={{ minHeight: 72, textAlignVertical: "top" }}
        />
      </Campo>

      {isProduto && !matcon && (
        <Campo label="Ficha técnica" optional="só aparece o que estiver preenchido">
          <View style={[s.linha2, p.narrow && { flexDirection: "column", gap: 8 }]}>
            <Entrada value={p.material} onChangeText={p.onMaterial} placeholder="Material" style={{ flex: 1 }} />
            <Entrada value={p.medidas} onChangeText={p.onMedidas} placeholder="Medidas" style={{ flex: 1 }} />
            <Entrada value={p.cuidados} onChangeText={p.onCuidados} placeholder="Cuidados" style={{ flex: 1 }} />
          </View>
        </Campo>
      )}

      {matcon && (
        <Campo label="Ficha técnica" optional="só aparece o que estiver preenchido">
          <View style={[st.ficha4, p.narrow && { flexDirection: "column" }]}>
            {perfil.descricao.ficha.map((l) => (
              <View key={l.campo} style={p.narrow ? null : st.fichaCel}>
                <Text style={st.subRotulo}>{l.rotulo}</Text>
                <Entrada
                  value={valores[l.campo].v}
                  onChangeText={valores[l.campo].on}
                  placeholder={l.placeholder}
                  accessibilityLabel={l.rotulo}
                />
              </View>
            ))}
          </View>
          {perfil.descricao.dicaDaFicha ? <Text style={s.hint}>{perfil.descricao.dicaDaFicha}</Text> : null}
        </Campo>
      )}

      <View style={st.pv}>
        <Text style={st.pvHead}>Prévia na loja</Text>
        <View style={[st.pvBody, p.narrow && { flexDirection: "column" }]}>
          <View style={[st.pvImg, !!p.capaUrl && st.pvImgTem]} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={st.pvNome}>{p.nome || ("Nome do " + nomeDoTipo(p.type))}</Text>
            <Text style={st.pvPreco}>{precoDaPrevia}</Text>
            {p.descricao.trim()
              ? <Text style={st.pvDesc}>{p.descricao.trim()}</Text>
              : <Text style={st.pvVazio}>Sem descrição, a página mostra só a foto e o preço.</Text>}
            {fichaLinhas.length + automaticas.length > 0 && (
              <View style={st.pvFicha}>
                {fichaLinhas.map(([k, v]) => (
                  <View key={k} style={st.pvLinha}>
                    <Text style={st.pvLinhaK}>{k}</Text>
                    <Text style={st.pvLinhaV}>{v}</Text>
                  </View>
                ))}
                {automaticas.map(([k, v]) => (
                  <View key={"auto-" + k} style={st.pvLinha}>
                    <Text style={st.pvLinhaK}>{k}</Text>
                    <Text style={[st.pvLinhaV, { color: Colors.violet3 }]}>{v}</Text>
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
  ficha4: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 8 },
  fichaCel: { width: "48%" as any, flexGrow: 1 },
  subRotulo: { fontSize: 10.5, color: Colors.ink3, marginBottom: 4 },
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
