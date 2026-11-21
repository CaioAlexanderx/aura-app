// ============================================================
// AURA. — Em quais lojas o lote entra (20/11/2026, A2 · D14, mockup d)
//
//   EscolhaDeLojasDoLote — planilha e lista: as lojas do lote inteiro e
//                          "O estoque da planilha entra em qual loja?".
//   LojasDoChegou        — Chegou mercadoria: a entrada é na loja ativa;
//                          os produtos NOVOS podem nascer também nas outras,
//                          sem estoque.
//
// Os dois somem quando o grupo não tem 2 lojas em que a pessoa mexe no
// estoque (campo "nenhum"): o lote é o de hoje. Estoque único (D12): só o
// aviso. Linhas com 44 px; nada depende de passar o mouse.
// ============================================================
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { CaixaDeLoja, TEXTO_ESTOQUE_UNICO } from "./item-form/SecaoLojas";
import {
  avisoDoChegou, textoDaLojaNoChegou, textoDasOutrasComZero, tituloDoLote, TEXTO_CHEGOU_SEM_ESTOQUE,
} from "./item-form/lojasDoCadastro";
import type { LojasDoLote } from "@/hooks/useLojasDoLote";

function Aviso({ children, testID }: { children: any; testID?: string }) {
  return (
    <View style={st.aviso} testID={testID}>
      <Text style={st.avisoTxt}>{children}</Text>
    </View>
  );
}

export function EscolhaDeLojasDoLote({ lojas, quantos, origem }: {
  lojas: LojasDoLote;
  quantos: number;
  /** De onde vem o estoque: muda só a pergunta. */
  origem: "planilha" | "lista";
}) {
  const { campo } = lojas;
  if (campo.modo === "nenhum") return null;
  if (campo.modo === "aviso") {
    return (
      <View style={st.card} testID="lote-lojas-estoque-unico">
        <Text style={st.titulo}>Lojas</Text>
        <Aviso>{TEXTO_ESTOQUE_UNICO}</Aviso>
      </View>
    );
  }
  const set = new Set(lojas.marcadas);
  const n = lojas.escolhidas.length;
  return (
    <View style={st.card} testID="lote-lojas">
      <Text style={st.titulo}>{tituloDoLote(quantos)}</Text>
      <View style={st.lista}>
        {campo.lojas.map((l, i) => {
          const id = String(l.company_id);
          return (
            <CaixaDeLoja
              key={id}
              testID={"lote-loja-" + id}
              nome={l.nome}
              marcada={set.has(id)}
              fixa={i === 0}
              onPress={() => lojas.alternar(id)}
            />
          );
        })}
      </View>
      {n >= 2 ? (
        <View style={{ marginTop: 12 }} testID="lote-estoque-em">
          <Text style={st.rotulo}>
            {origem === "planilha" ? "O estoque da planilha entra em qual loja?" : "O estoque da lista entra em qual loja?"}
          </Text>
          <View style={st.radios}>
            {lojas.escolhidas.map((l) => {
              const id = String(l.company_id);
              const on = lojas.estoqueEm === id;
              return (
                <Pressable
                  key={id}
                  testID={"lote-estoque-em-" + id}
                  onPress={() => lojas.escolherEstoque(id)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={l.nome}
                  style={[st.rd, on && st.rdOn]}
                >
                  <View style={[st.dot, on && st.dotOn]} />
                  <Text style={st.rdTxt} numberOfLines={2}>{l.nome}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={st.dica}>{textoDasOutrasComZero(n - 1)}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function LojasDoChegou({ lojas, nNovos }: { lojas: LojasDoLote; nNovos: number }) {
  const { campo } = lojas;
  if (campo.modo !== "escolha" || nNovos <= 0) return null;
  const ativa = campo.lojas[0];
  const outras = campo.lojas.slice(1);
  const set = new Set(lojas.marcadas);
  const aviso = avisoDoChegou(ativa.nome, nNovos);
  return (
    <View style={[st.card, { marginBottom: 14 }]} testID="chegou-lojas">
      <Aviso>
        {aviso.antes}
        <Text style={{ fontWeight: "700", color: Colors.ink }}>{aviso.forte}</Text>
        {aviso.depois}
      </Aviso>
      <View style={[st.lista, { marginTop: 8 }]}>
        {outras.map((l) => {
          const id = String(l.company_id);
          return (
            <CaixaDeLoja
              key={id}
              testID={"chegou-loja-" + id}
              nome={textoDaLojaNoChegou(nNovos, l.nome)}
              sub={TEXTO_CHEGOU_SEM_ESTOQUE + ativa.nome + "."}
              marcada={set.has(id)}
              onPress={() => lojas.alternar(id)}
            />
          );
        })}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  card: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
    backgroundColor: Colors.bg4, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14, marginBottom: 12,
  },
  titulo: { fontSize: 13, fontWeight: "700", color: Colors.ink, marginBottom: 10 },
  lista: { gap: 8 },
  rotulo: { fontSize: 11.5, fontWeight: "600", color: Colors.ink3, letterSpacing: 0.2, marginBottom: 6 },
  radios: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  rd: {
    flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44,
    paddingHorizontal: 12, borderRadius: 9, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.bg3,
  },
  rdOn: { borderColor: Colors.violet, backgroundColor: Colors.violetD },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: Colors.border2 },
  dotOn: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  rdTxt: { fontSize: 12.5, color: Colors.ink, fontWeight: "600", flexShrink: 1 },
  dica: { fontSize: 11, color: Colors.ink3, marginTop: 6, lineHeight: 15 },
  aviso: {
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2,
  },
  avisoTxt: { fontSize: 12, color: Colors.ink2, lineHeight: 17 },
});
