// ============================================================
// AURA. — Troca · linha "Crédito para" (p-166, 17/11/2026)
//
// Mockup "Caixa e Troca", Parte 4 (aprovado pelo Caio em 17/11). Aparece no
// passo 3 (dentro do bloco "Crédito na conta") e no passo 4 (abaixo dos
// chips, quando o estorno vai como "Crédito conta"). Três estados:
//   • preenchido: nome · telefone · "cliente da venda original" e "Trocar";
//   • vazio: borda âmbar tracejada e "Escolher cliente";
//   • busca aberta: nome ou telefone, na mesma lista do Caixa
//     (useCustomers({ sort: "recent" }) — mesma chave de cache).
// Multi-CNPJ: a lista já vem do dono (todas as lojas); o crédito é da loja
// ativa, e a linha "O crédito vale nesta loja" só aparece com mais de uma.
// Sem hover-reveal: tudo que se toca está sempre na tela.
// ============================================================
import { useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useCustomers } from "@/hooks/useCustomers";
import { useAuthStore } from "@/stores/auth";
import { TEXTOS_DO_CLIENTE as T } from "./textosDoCliente";
import { filtrarClientes, iniciais, type ClienteDoCredito } from "./clienteDoCredito";

type Props = {
  /** Quem vai ficar com o crédito agora (null = ninguém ainda). */
  cliente: ClienteDoCredito | null;
  /** O cliente mostrado é o da venda original (texto e dica do presente). */
  daVendaOriginal: boolean;
  onEscolher: (c: ClienteDoCredito) => void;
  /** Nota azul do passo 3 (some com a busca aberta). */
  nota?: string;
  testID?: string;
};

export function CreditoPara({ cliente, daVendaOriginal, onEscolher, nota, testID = "troca-credito-para" }: Props) {
  const { customers, isLoading } = useCustomers({ sort: "recent" });
  const { company, availableCompanies } = useAuthStore() as any;
  const [buscando, setBuscando] = useState(false);
  const [q, setQ] = useState("");

  const lista = useMemo(
    () => filtrarClientes(customers || [], q, { recentes: 5, resultados: 8 }),
    [customers, q],
  );

  // O telefone do cliente da venda não vem na busca de vendas: completa pela lista.
  const telefone = useMemo(() => {
    if (!cliente) return null;
    if (cliente.phone) return cliente.phone;
    const daLista = (customers || []).find((c: any) => c.id === cliente.id);
    return daLista?.phone || null;
  }, [cliente, customers]);

  const variasLojas = Array.isArray(availableCompanies) && availableCompanies.length > 1;
  const nomeDaLoja = company?.trade_name || company?.name || "";
  const linhaDaLoja = variasLojas && nomeDaLoja ? (
    <View style={s.loja} testID={`${testID}-loja`}>
      <Icon name="info" size={13} color={Colors.violet3} />
      <Text style={s.lojaTxt}>
        {T.lojaDoCredito} <Text style={s.lojaNome}>{nomeDaLoja}</Text>.
      </Text>
    </View>
  ) : null;

  function abrirBusca() { setQ(""); setBuscando(true); }
  function fecharBusca() { setBuscando(false); setQ(""); }
  function escolher(c: any) {
    onEscolher({ id: c.id, name: c.name, phone: c.phone || null });
    fecharBusca();
  }

  if (buscando) {
    return (
      <View style={s.box} testID={`${testID}-busca`}>
        <View style={s.topo}>
          <Text style={s.rotulo}>{T.rotulo}</Text>
          <Pressable onPress={fecharBusca} style={s.lnk} testID={`${testID}-cancelar`} accessibilityRole="button">
            <Text style={s.lnkTxt}>{T.cancelar}</Text>
          </Pressable>
        </View>
        <View style={s.busca}>
          <Icon name="search" size={15} color={Colors.ink3} />
          <TextInput
            testID={`${testID}-q`}
            value={q}
            onChangeText={setQ}
            placeholder={T.buscaPlaceholder}
            placeholderTextColor={Colors.ink3}
            accessibilityLabel={T.buscaRotulo}
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
            style={s.buscaInput}
          />
        </View>
        <Text style={s.secao}>{q.trim() ? T.resultados : T.recentes}</Text>
        {isLoading && (customers || []).length === 0 ? (
          <Text style={s.vazio}>{T.carregando}</Text>
        ) : lista.length === 0 ? (
          <Text style={s.vazio} testID={`${testID}-vazio`}>
            {q.trim() ? T.semResultadoSemCadastro : T.semClientes}
          </Text>
        ) : (
          lista.map((c: any, i: number) => (
            <Pressable
              key={c.id}
              testID={`${testID}-opcao-${c.id}`}
              onPress={() => escolher(c)}
              style={[s.opcao, i > 0 && s.opcaoSep]}
              accessibilityRole="button"
            >
              <View style={[s.av, s.avPeq]}><Text style={s.avTxt}>{iniciais(c.name)}</Text></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.opNome} numberOfLines={1}>{c.name}</Text>
                <Text style={s.opTel} numberOfLines={1}>{c.phone || T.semTelefone}</Text>
              </View>
            </Pressable>
          ))
        )}
      </View>
    );
  }

  if (!cliente) {
    return (
      <View style={{ alignSelf: "stretch" }}>
        <View style={[s.box, s.falta]} testID={`${testID}-vazio-cliente`}>
          <Text style={s.rotulo}>{T.rotulo}</Text>
          <View style={s.linha}>
            <View style={[s.av, s.avFalta]}><Icon name="user" size={16} color={Colors.amber} /></View>
            <View style={s.nomeCol}>
              <Text style={s.nome}>{T.vendaSemCliente}</Text>
              <Text style={s.sub}>{T.vendaSemClienteSub}</Text>
            </View>
            <Pressable onPress={abrirBusca} style={[s.btn, s.btnPri]} testID={`${testID}-escolher`} accessibilityRole="button">
              <Text style={s.btnPriTxt}>{T.escolherCliente}</Text>
            </Pressable>
          </View>
          {linhaDaLoja}
        </View>
        {nota ? <Nota texto={nota} /> : null}
      </View>
    );
  }

  return (
    <View style={{ alignSelf: "stretch" }}>
      <View style={s.box} testID={`${testID}-preenchido`}>
        <Text style={s.rotulo}>{T.rotulo}</Text>
        <View style={s.linha}>
          <View style={s.av}><Text style={s.avTxt}>{iniciais(cliente.name)}</Text></View>
          <View style={s.nomeCol}>
            <Text style={s.nome} numberOfLines={1}>{cliente.name}</Text>
            <Text style={s.sub} numberOfLines={2}>
              {telefone || T.semTelefone}
              {daVendaOriginal ? ` · ${T.daVendaOriginal}` : ""}
            </Text>
          </View>
          <Pressable onPress={abrirBusca} style={s.btn} testID={`${testID}-trocar`} accessibilityRole="button">
            <Text style={s.btnTxt}>{T.trocar}</Text>
          </Pressable>
        </View>
        {daVendaOriginal && <Text style={s.dica}>{T.dicaPresente}</Text>}
        {linhaDaLoja}
      </View>
      {nota ? <Nota texto={nota} /> : null}
    </View>
  );
}

function Nota({ texto }: { texto: string }) {
  return (
    <View style={s.nota}>
      <Icon name="info" size={12} color="#93c5fd" />
      <Text style={s.notaTxt}>{texto}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  box: {
    alignSelf: "stretch",
    borderWidth: 1, borderColor: Colors.border2,
    borderRadius: 12, padding: 12, marginTop: 10,
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  falta: {
    borderColor: Colors.amber,
    borderStyle: Platform.OS === "web" ? ("dashed" as any) : "dashed",
  },
  topo: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  rotulo: {
    fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase",
    color: Colors.ink3, marginBottom: 8,
  },
  linha: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  av: {
    width: 36, height: 36, borderRadius: 999, backgroundColor: Colors.violet,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  avPeq: { width: 30, height: 30 },
  avFalta: {
    backgroundColor: Colors.amberD, borderWidth: 1, borderColor: Colors.amber,
    borderStyle: Platform.OS === "web" ? ("dashed" as any) : "dashed",
  },
  avTxt: { color: "#fff", fontSize: 12, fontWeight: "700" },
  nomeCol: { flex: 1, minWidth: 150 },
  nome: { color: Colors.ink, fontSize: 14, fontWeight: "700" },
  sub: { color: Colors.ink3, fontSize: 12, marginTop: 1, lineHeight: 17 },
  btn: {
    minHeight: 40, paddingHorizontal: 14, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: Colors.border2, backgroundColor: "rgba(255,255,255,0.05)",
  },
  btnTxt: { color: Colors.ink, fontSize: 13, fontWeight: "600" },
  btnPri: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  btnPriTxt: { color: "#fff", fontSize: 13, fontWeight: "700" },
  dica: { color: Colors.ink2, fontSize: 12, marginTop: 8, lineHeight: 17 },
  loja: {
    flexDirection: "row", alignItems: "flex-start", gap: 7,
    marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  lojaTxt: { color: Colors.ink2, fontSize: 12, flex: 1, lineHeight: 17 },
  lojaNome: { color: Colors.ink, fontWeight: "700" },
  lnk: { minHeight: 36, paddingHorizontal: 8, justifyContent: "center", marginTop: -8 },
  lnkTxt: { color: Colors.violet3, fontSize: 13, fontWeight: "600" },
  busca: {
    flexDirection: "row", alignItems: "center", gap: 8,
    minHeight: 44, paddingHorizontal: 12, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.violet, backgroundColor: "rgba(0,0,0,0.12)",
  },
  buscaInput: { flex: 1, minWidth: 0, color: Colors.ink, fontSize: 14, paddingVertical: 8 },
  secao: {
    fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase",
    color: Colors.violet3, marginTop: 10, marginBottom: 2, marginHorizontal: 2,
  },
  opcao: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, paddingVertical: 7, paddingHorizontal: 8, borderRadius: 9 },
  opcaoSep: { borderTopWidth: 1, borderTopColor: Colors.border },
  opNome: { color: Colors.ink, fontSize: 13, fontWeight: "700" },
  opTel: { color: Colors.ink3, fontSize: 12 },
  vazio: { color: Colors.ink2, fontSize: 12.5, paddingVertical: 10, paddingHorizontal: 4 },
  nota: {
    flexDirection: "row", alignItems: "flex-start", gap: 6,
    backgroundColor: "rgba(37,99,235,0.12)",
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7,
    marginTop: 10,
  },
  notaTxt: { color: "#93c5fd", fontSize: 12, flex: 1, lineHeight: 17 },
});

export default CreditoPara;
