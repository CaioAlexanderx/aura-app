// ============================================================
// AURA. — Cadastro do item: "Fornecedores deste produto" (03/11/2026)
//
// Mockup: docs/mockups/estoque-entrada-por-fornecedor.html, tela 8.
// Antes não havia campo de fornecedor no cadastro (o backend aceitava um
// supplier_id que nenhuma tela mandava). Agora: vários fornecedores, CADA
// UM COM O SEU CUSTO, código do produto no fornecedor e um principal (★,
// o de recompra). Gravado no Salvar do modal (PUT /products/:pid/suppliers,
// Aura-backend#950) — a lista é estado local, como a grade de cor/tamanho.
//
// Fornecedor novo: cadastrado na hora pelo nome (POST /suppliers); o resto
// se completa na tela Fornecedores. Sem custo visível (podeVerCusto) a
// coluna de custo some e o Salvar não manda custo (o gravado fica).
// ============================================================
import { useMemo, useState } from "react";
import { View, Text, Pressable, TextInput, StyleSheet } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { suppliersApi } from "@/services/suppliersApi";
import { maskCurrency } from "@/utils/masks";
import { comUmPrincipal, faixaDeCusto, type LinhaDeFornecedor } from "@/utils/entradaDeMercadoria";
import { Secao } from "./ui";

type Props = {
  linhas: LinhaDeFornecedor[];
  onLinhas: (l: LinhaDeFornecedor[]) => void;
  semCusto: boolean;
  carregando?: boolean;
};

const brl = (n: number) => "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function SecaoFornecedores({ linhas, onLinhas, semCusto, carregando }: Props) {
  const cid = useAuthStore().company?.id;
  const qc = useQueryClient();
  const [buscando, setBuscando] = useState(false);
  const [busca, setBusca] = useState("");
  const [criando, setCriando] = useState(false);
  const { data } = useQuery({
    queryKey: ["suppliers", cid],
    queryFn: () => suppliersApi.list(cid!),
    enabled: !!cid && buscando,
    staleTime: 60_000,
  });

  const jaNaLista = useMemo(() => new Set(linhas.map((l) => l.supplier_id)), [linhas]);
  const opcoes = useMemo(() => {
    const q = semAcento(busca.trim());
    return (data?.suppliers || [])
      .filter((f) => !jaNaLista.has(f.id) && (!q || semAcento(f.name).includes(q)))
      .slice(0, 6);
  }, [data, busca, jaNaLista]);
  const faixa = semCusto ? null : faixaDeCusto(linhas);

  function adicionar(id: string, name: string) {
    onLinhas(comUmPrincipal([...linhas, { supplier_id: id, name, custo: "", codigo: "", principal: linhas.length === 0 }]));
    setBusca(""); setBuscando(false);
  }

  async function criar() {
    const nome = busca.trim();
    if (!cid || !nome || criando) return;
    setCriando(true);
    try {
      const f = await suppliersApi.create(cid, { name: nome });
      qc.invalidateQueries({ queryKey: ["suppliers", cid] });
      adicionar(f.id, f.name);
    } catch (err: any) {
      toast.error(err?.message || "Não conseguimos cadastrar o fornecedor.");
    } finally {
      setCriando(false);
    }
  }

  const mudar = (i: number, parcial: Partial<LinhaDeFornecedor>) =>
    onLinhas(linhas.map((l, k) => (k === i ? { ...l, ...parcial } : l)));

  return (
    <Secao icon="truck" titulo="Fornecedores deste produto">
      {carregando ? <Text style={st.hint}>Carregando fornecedores…</Text> : null}
      {faixa ? (
        <Text style={st.hint} testID="fornecedores-faixa">Custo varia de {brl(faixa.min)} a {brl(faixa.max)} conforme o fornecedor.</Text>
      ) : null}

      {linhas.map((l, i) => (
        <View key={l.supplier_id} style={st.linha} testID={"fornecedor-linha-" + i}>
          <Pressable onPress={() => onLinhas(linhas.map((x, k) => ({ ...x, principal: k === i })))}
            accessibilityLabel={l.principal ? "Fornecedor principal" : "Tornar principal"} hitSlop={8}>
            <Text style={[st.estrela, l.principal && st.estrelaOn]}>{l.principal ? "★" : "☆"}</Text>
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={st.nome} numberOfLines={1}>{l.name}</Text>
            {l.principal ? <Text style={st.principal}>principal (recompra)</Text> : null}
          </View>
          {!semCusto ? (
            <View style={st.campoCusto}>
              <Text style={st.prefixo}>R$</Text>
              <TextInput value={l.custo} onChangeText={(v) => mudar(i, { custo: v ? maskCurrency(v) : "" })}
                placeholder="custo" placeholderTextColor={Colors.ink3} keyboardType="number-pad"
                style={[st.input, { paddingLeft: 28, width: 104 }] as any} />
            </View>
          ) : null}
          <TextInput value={l.codigo} onChangeText={(v) => mudar(i, { codigo: v })}
            placeholder="cód. no fornecedor" placeholderTextColor={Colors.ink3}
            style={[st.input, { width: 130 }] as any} />
          <Pressable onPress={() => onLinhas(comUmPrincipal(linhas.filter((_, k) => k !== i)))}
            accessibilityLabel={"Tirar " + l.name} hitSlop={8}>
            <Text style={st.x}>×</Text>
          </Pressable>
        </View>
      ))}

      {buscando ? (
        <View style={{ marginTop: 8 }}>
          <TextInput value={busca} onChangeText={setBusca} autoFocus placeholder="Buscar ou digitar o nome do fornecedor…"
            placeholderTextColor={Colors.ink3} style={st.input as any} testID="fornecedores-busca" />
          <View style={st.drop}>
            {opcoes.map((f, i) => (
              <Pressable key={f.id} onPress={() => adicionar(f.id, f.name)} style={[st.dropItem, i > 0 && st.sep]}>
                <Text style={st.dropNome} numberOfLines={1}>{f.name}</Text>
              </Pressable>
            ))}
            {busca.trim() ? (
              <Pressable onPress={criar} style={[st.dropItem, opcoes.length > 0 && st.sep]} testID="fornecedores-criar">
                <Text style={st.add}>{criando ? "Cadastrando…" : `＋ Cadastrar "${busca.trim()}" como fornecedor`}</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => { setBuscando(false); setBusca(""); }} style={[st.dropItem, st.sep]}>
              <Text style={st.hint}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable onPress={() => setBuscando(true)} style={st.addBtn} testID="fornecedores-adicionar">
          <Text style={st.add}>＋ Adicionar fornecedor</Text>
        </Pressable>
      )}
      {!linhas.length && !buscando ? (
        <Text style={st.hint}>Ligue de quem você compra este produto. Cada fornecedor pode ter o seu custo.</Text>
      ) : null}
    </Secao>
  );
}

const st = StyleSheet.create({
  linha: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.border, flexWrap: "wrap" },
  estrela: { fontSize: 18, color: Colors.ink3, width: 20, textAlign: "center" },
  estrelaOn: { color: Colors.violet },
  nome: { fontSize: 13.5, fontWeight: "600", color: Colors.ink },
  principal: { fontSize: 11, color: Colors.violet3 },
  campoCusto: { position: "relative", justifyContent: "center" },
  prefixo: { position: "absolute", left: 10, zIndex: 1, color: Colors.ink3, fontSize: 13 },
  input: { borderWidth: 1, borderColor: Colors.border2, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: Colors.ink, backgroundColor: Colors.bg2 },
  x: { fontSize: 18, color: Colors.ink3, paddingHorizontal: 4 },
  drop: { borderWidth: 1, borderColor: Colors.border2, borderRadius: 12, marginTop: 6, overflow: "hidden" },
  dropItem: { paddingHorizontal: 12, paddingVertical: 10 },
  sep: { borderTopWidth: 1, borderTopColor: Colors.border },
  dropNome: { color: Colors.ink, fontSize: 13 },
  add: { color: Colors.violet3, fontSize: 13, fontWeight: "600" },
  addBtn: { marginTop: 8, alignSelf: "flex-start", paddingVertical: 6 },
  hint: { fontSize: 12, color: Colors.ink3, marginTop: 4 },
});
