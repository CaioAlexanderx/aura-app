// ============================================================
// AURA. — "Chegou mercadoria" · Passo 1: quem mandou a mercadoria (A1)
//
// Mockup estoque-portas-mockup-17-11.html, parte 4, "Passo 1 · Escolher o
// fornecedor". Reaproveita a lista com busca do EntradaMercadoriaModal
// (suppliersApi.list); a lista vem do shell, que também a usa no passo 2
// para achar o fornecedor pelo CNPJ da nota.
//
// Pendência 1 (Caio, 17/11): o fornecedor é perguntado antes, mesmo com a
// nota na mão. O cartão "Tem o arquivo da nota?" é o atalho: escolhe o
// arquivo, a Aura acha o fornecedor pelo CNPJ e pula para o passo 2.
// ============================================================
import { useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { TEXTOS_CHEGOU as T } from "./textosChegou";
import {
  fornecedoresDoPasso1, iniciais, cnpjComMascara, diaMesLocal,
  type EscolhaDoFornecedor, type FornecedorDaLista,
} from "./chegouRegras";

type Props = {
  fornecedores: FornecedorDaLista[] | undefined;
  carregando: boolean;
  erro: boolean;
  escolha: EscolhaDoFornecedor;
  estreito: boolean;
  lendoNota: boolean;
  onEscolher: (f: FornecedorDaLista) => void;
  onSemFornecedor: () => void;
  onNovoFornecedor: () => void;
  onTenhoANota: () => void;
};

export function Passo1Fornecedor({
  fornecedores, carregando, erro, escolha, estreito, lendoNota,
  onEscolher, onSemFornecedor, onNovoFornecedor, onTenhoANota,
}: Props) {
  const [busca, setBusca] = useState("");
  const { maisUsados, itens } = useMemo(() => fornecedoresDoPasso1(fornecedores, busca), [fornecedores, busca]);
  const escolhidoId = escolha && escolha.tipo === "existente" ? escolha.fornecedor.id : null;

  const lista = (
    <View style={{ gap: 10 }}>
      <Text style={s.pergunta}>{T.pergunta1}</Text>
      <View style={s.buscaBox}>
        <Icon name="search" size={15} color={Colors.ink3} />
        <TextInput
          value={busca}
          onChangeText={setBusca}
          placeholder={T.busca}
          placeholderTextColor={Colors.ink3}
          style={s.buscaInput as any}
          accessibilityLabel={T.busca}
          testID="chegou-busca-fornecedor"
        />
      </View>

      {carregando ? (
        <ActivityIndicator size="small" color={Colors.violet3} style={{ marginVertical: 12 }} />
      ) : erro ? (
        <Text style={s.vazio} testID="chegou-fornecedores-erro">{T.listaComErro}</Text>
      ) : (
        <View style={{ gap: 6 }}>
          {maisUsados && !busca.trim() ? <Text style={s.secao}>{T.maisUsados}</Text> : null}
          {busca.trim() && itens.length === 0 ? <Text style={s.vazio}>{T.buscaVazia}</Text> : null}
          {itens.map((f) => {
            const on = f.id === escolhidoId;
            const ultima = diaMesLocal(f.last_delivery_at);
            const sub = [f.cnpj ? cnpjComMascara(f.cnpj) : null, f.contact_name || null].filter(Boolean).join(" · ");
            return (
              <Pressable
                key={f.id}
                onPress={() => onEscolher(f)}
                style={[s.linha, on && s.linhaOn]}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                testID={"chegou-fornecedor-" + f.id}
              >
                <View style={[s.sigla, on && s.siglaOn]}>
                  <Text style={[s.siglaTxt, on && { color: "#fff" }]}>{iniciais(f.name)}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.nome} numberOfLines={1}>{f.name}</Text>
                  {sub ? <Text style={s.sub} numberOfLines={1}>{sub}</Text> : null}
                </View>
                <View style={s.direita}>
                  {typeof f.product_count === "number" ? <Text style={s.qtd}>{T.linhaProdutos(f.product_count)}</Text> : null}
                  {ultima ? <Text style={s.sub}>{T.linhaUltimaEntrega(ultima)}</Text> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      <Pressable onPress={onNovoFornecedor} style={[s.linha, s.linhaTracejada]} accessibilityRole="button" testID="chegou-novo-fornecedor">
        <View style={[s.sigla, s.siglaMais]}><Icon name="plus" size={14} color={Colors.violet3} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[s.nome, { color: Colors.violet3 }]}>{T.novoTitulo}</Text>
          <Text style={s.sub}>{T.novoApoio}</Text>
        </View>
      </Pressable>

      <Pressable
        onPress={onSemFornecedor}
        style={[s.linha, escolha && escolha.tipo === "sem" && s.linhaOn]}
        accessibilityRole="button"
        testID="chegou-sem-fornecedor"
      >
        <View style={s.sigla}><Icon name="arrow_right" size={14} color={Colors.ink3} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.nome}>{T.semTitulo}</Text>
          <Text style={s.sub}>{T.semApoio}</Text>
        </View>
      </Pressable>
    </View>
  );

  const lateral = (
    <View style={[s.lateral, estreito && s.lateralEstreita]}>
      <View style={s.cartaoNota} testID="chegou-cartao-nota">
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <Icon name="file_text" size={16} color={Colors.green} />
          <Text style={s.cartaoTitulo}>{T.notaCartaoTitulo}</Text>
        </View>
        <Text style={s.cartaoTxt}>{T.notaCartaoApoio}</Text>
        <Pressable
          onPress={lendoNota ? undefined : onTenhoANota}
          disabled={lendoNota}
          style={[s.cartaoBtn, lendoNota && { opacity: 0.6 }]}
          accessibilityRole="button"
          testID="chegou-cartao-nota-botao"
        >
          {lendoNota
            ? <ActivityIndicator size="small" color={Colors.violet3} />
            : <Text style={s.cartaoBtnTxt}>{T.notaCartaoBotao}</Text>}
        </Pressable>
      </View>
      <View style={s.porque}>
        <Text style={s.porqueTitulo}>{T.porqueTitulo}</Text>
        <Text style={s.cartaoTxt}>{T.porqueTexto}</Text>
      </View>
    </View>
  );

  return (
    <View style={[s.wrap, estreito && { flexDirection: "column" }]} testID="chegou-passo-1">
      <View style={{ flex: 1, minWidth: 0 }}>{lista}</View>
      {lateral}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: "row", gap: 18, alignItems: "flex-start" },
  pergunta: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", color: Colors.ink3 },
  buscaBox: {
    flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44,
    borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, paddingHorizontal: 12, backgroundColor: Colors.bg2,
  },
  buscaInput: { flex: 1, fontSize: 14, color: Colors.ink, paddingVertical: 10, outlineStyle: "none" } as any,
  secao: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", color: Colors.violet3, marginTop: 4 },
  vazio: { fontSize: 13, color: Colors.ink3, paddingVertical: 8 },
  linha: {
    flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg2,
  },
  linhaOn: { borderColor: Colors.violet, backgroundColor: Colors.violetD },
  linhaTracejada: { borderStyle: "dashed", borderColor: Colors.border2 },
  sigla: { width: 32, height: 32, borderRadius: 9, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  siglaOn: { backgroundColor: Colors.violet },
  siglaMais: { backgroundColor: Colors.violetD },
  siglaTxt: { fontSize: 11.5, fontWeight: "800", color: Colors.ink2 },
  nome: { fontSize: 13.5, fontWeight: "700", color: Colors.ink },
  sub: { fontSize: 11.5, color: Colors.ink3, marginTop: 1 },
  direita: { alignItems: "flex-end", flexShrink: 0 },
  qtd: { fontSize: 12, fontWeight: "600", color: Colors.ink2 },
  lateral: { width: 280, gap: 12 },
  lateralEstreita: { width: "100%" },
  cartaoNota: {
    borderWidth: 1, borderStyle: "dashed", borderColor: Colors.green, borderRadius: 12,
    padding: 14, gap: 8, backgroundColor: Colors.greenD,
  },
  cartaoTitulo: { fontSize: 13.5, fontWeight: "700", color: Colors.ink },
  cartaoTxt: { fontSize: 12.5, color: Colors.ink2, lineHeight: 18 },
  cartaoBtn: {
    minHeight: 44, borderRadius: 10, paddingHorizontal: 12, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: Colors.violet, backgroundColor: Colors.violetD,
  },
  cartaoBtnTxt: { fontSize: 13, fontWeight: "700", color: Colors.violet3 },
  porque: { borderRadius: 12, padding: 14, gap: 6, backgroundColor: Colors.bg4 },
  porqueTitulo: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", color: Colors.ink3 },
});
