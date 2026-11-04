// ============================================================
// AURA. — Estoque: "Entrada de mercadoria" (03/11/2026)
//
// Mockup: docs/mockups/estoque-entrada-por-fornecedor.html, telas 2, 3, 4 e 6.
// Backend: POST /products/:pid/stock-entries (Aura-backend#950).
//
// Um passo só (não é wizard → não usa o padrão TrocaModal):
//   fornecedor (lista com busca, último custo deste produto; ou cadastrado
//   ali mesmo) → quantidade (ou a grade, se tem cor/tamanho) → custo →
//   resumo antes/depois → "Dar entrada em N un".
//
// Custo oculto (podeVerCusto): quem não vê custo dá entrada sem custo —
// o campo, o resumo de custo e a margem somem; o estoque soma igual.
// Multi-CNPJ: sempre a empresa selecionada (company.id). O Estoque não
// oferece o botão no consolidado.
// Contas puras em utils/entradaDeMercadoria.ts (mesma regra do backend).
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, Modal, ScrollView, ActivityIndicator, useWindowDimensions } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { companiesApi } from "@/services/api";
import { suppliersApi, fornecedoresDoProdutoApi, type Supplier } from "@/services/suppliersApi";
import { maskCurrency, maskPhone } from "@/utils/masks";
import { fmtQty } from "@/utils/matconUnits";
import { rotuloDaVariante } from "./VariantesConsulta";
import {
  previaDaEntrada, custoMuitoAcima, corpoDaEntrada, numeroPositivo,
  type FornecedorDaEntrada,
} from "@/utils/entradaDeMercadoria";

export type ProdutoDaEntrada = {
  id: string; name: string; stock: number; cost: number | null; price: number; unit: string; has_variants?: boolean;
};

type Props = {
  visible: boolean;
  /** null + `produtos`: o modal começa pedindo o produto (botão do topo). */
  produto: ProdutoDaEntrada | null;
  produtos?: ProdutoDaEntrada[];
  semCusto: boolean;
  onClose: () => void;
  onFeito?: () => void;
};

const brl = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : "R$ " + Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function semAcento(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function EntradaMercadoriaModal({ visible, produto: produtoInicial, produtos, semCusto, onClose, onFeito }: Props) {
  const [produtoEscolhido, setProdutoEscolhido] = useState<ProdutoDaEntrada | null>(null);
  const [buscaProduto, setBuscaProduto] = useState("");
  const produto = produtoInicial || produtoEscolhido;
  const cid = useAuthStore().company?.id;
  const qc = useQueryClient();
  const { width } = useWindowDimensions();
  const estreito = width < 640;

  const [busca, setBusca] = useState("");
  const [escolhido, setEscolhido] = useState<Supplier | null>(null);
  const [novo, setNovo] = useState<{ name: string; phone: string; cnpj: string } | null>(null);
  const [qtd, setQtd] = useState("");
  const [grade, setGrade] = useState<Record<string, string>>({});
  const [custo, setCusto] = useState("");
  const [nota, setNota] = useState("");
  const [usarMedio, setUsarMedio] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [confirmarCusto, setConfirmarCusto] = useState(false);

  useEffect(() => {
    if (!visible) { setProdutoEscolhido(null); setBuscaProduto(""); }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    setBusca(""); setEscolhido(null); setNovo(null); setQtd(""); setGrade({});
    setCusto(""); setNota(""); setUsarMedio(true); setSalvando(false); setConfirmarCusto(false);
  }, [visible, produto?.id]);

  const ativo = visible && !!cid && !!produto;
  const { data: fornecedores } = useQuery({
    queryKey: ["suppliers", cid],
    queryFn: () => suppliersApi.list(cid!),
    enabled: ativo,
    staleTime: 60_000,
  });
  const { data: doProduto } = useQuery({
    queryKey: ["product-suppliers", cid, produto?.id],
    queryFn: () => fornecedoresDoProdutoApi.list(cid!, produto!.id),
    enabled: ativo,
    staleTime: 30_000,
  });
  const { data: varData, isLoading: carregandoGrade } = useQuery({
    queryKey: ["estoque-consulta-variantes", cid, produto?.id],
    queryFn: () => companiesApi.variants(cid!, produto!.id),
    enabled: ativo && !!produto?.has_variants,
    staleTime: 30_000,
  });
  const variantes: any[] = Array.isArray((varData as any)?.variants) ? (varData as any).variants : [];
  const temGrade = !!produto?.has_variants && variantes.length > 0;

  // Último custo de cada fornecedor PARA ESTE produto (some sem custo visível).
  const custoDoFornecedor = useMemo(() => {
    const m: Record<string, number | null> = {};
    (doProduto?.suppliers || []).forEach((f) => { m[f.supplier_id] = f.cost ?? null; });
    return m;
  }, [doProduto]);

  const lista = useMemo(() => {
    const todos = fornecedores?.suppliers || [];
    const q = semAcento(busca.trim());
    const filtrados = q ? todos.filter((f) => semAcento(f.name).includes(q)) : todos;
    // Os já ligados a este produto primeiro.
    return [...filtrados].sort((a, b) => Number(b.id in custoDoFornecedor) - Number(a.id in custoDoFornecedor)).slice(0, 6);
  }, [fornecedores, busca, custoDoFornecedor]);

  if (!visible) return null;
  if (!produto) {
    if (!produtos) return null;
    const q = semAcento(buscaProduto.trim());
    const achados = (q ? produtos.filter((p) => semAcento(p.name).includes(q)) : produtos).slice(0, 8);
    return (
      <Modal visible transparent animationType="fade" onRequestClose={onClose}>
        <Pressable style={[s.scrim, estreito && s.scrimEstreito]} onPress={onClose}>
          <Pressable style={[s.card, estreito && s.cardEstreito]} onPress={() => {}} testID="entrada-escolher-produto">
            <View style={s.head}>
              <View style={s.ico}><Text style={s.icoTxt}>↓</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.title}>Entrada de mercadoria</Text>
                <Text style={s.sub}>Qual produto chegou?</Text>
              </View>
              <Pressable onPress={onClose} accessibilityLabel="Fechar"><Icon name="x" size={16} color={Colors.ink3} /></Pressable>
            </View>
            <TextInput value={buscaProduto} onChangeText={setBuscaProduto} autoFocus placeholder="Buscar produto…"
              placeholderTextColor={Colors.ink3} style={[s.input, { marginTop: 10 }] as any} testID="entrada-busca-produto" />
            <View style={s.drop}>
              {achados.length === 0 ? <Text style={[s.hint, { padding: 12 }]}>Nenhum produto com esse nome.</Text> : null}
              {achados.map((p, i) => (
                <Pressable key={p.id} onPress={() => setProdutoEscolhido(p)} style={[s.dropItem, i > 0 && s.dropSep]}>
                  <Text style={s.dropNome} numberOfLines={1}>{p.name}</Text>
                  <Text style={s.dropSub}>{fmtQty(Number(p.stock) || 0)} {p.unit && p.unit !== "un" ? p.unit : "un"}</Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  const estoqueAntes = temGrade
    ? variantes.reduce((s, v) => s + (parseFloat(v.stock_qty) || 0), 0)
    : Number(produto.stock) || 0;
  const quantidade = temGrade
    ? Object.values(grade).reduce((s, v) => s + (numeroPositivo(v) || 0), 0)
    : numeroPositivo(qtd) || 0;
  const custoNum = semCusto ? null : numeroPositivo(custo);
  // O backend usa weighted_avg_cost (ou cost_price, sem média ainda): a
  // prévia usa o mesmo número que o GET dos fornecedores devolve.
  const custoMedio = numeroPositivo((doProduto as any)?.product?.avg_cost)
    ?? (produto.cost && produto.cost > 0 ? produto.cost : null);
  const previa = previaDaEntrada({ estoqueAntes, custoAtual: custoMedio, quantidade, custoUnitario: custoNum, preco: produto.price });
  const acima = !semCusto && custoMuitoAcima(custoMedio, custoNum);

  const fornecedor: FornecedorDaEntrada | null = novo
    ? { tipo: "novo", name: novo.name, phone: novo.phone, cnpj: novo.cnpj }
    : escolhido ? { tipo: "existente", id: escolhido.id, name: escolhido.name } : null;
  const montado = corpoDaEntrada({
    fornecedor,
    quantidade: qtd,
    grade: temGrade ? variantes.map((v) => ({ variant_id: v.id, quantidade: grade[v.id] || "" })) : undefined,
    custo, nota, usarCustoMedio: usarMedio, semCusto,
  });
  const pronto = !("erro" in montado);
  const unidade = produto.unit && produto.unit !== "un" ? produto.unit : "un";

  async function confirmar() {
    if (!cid || !produto || salvando || "erro" in montado) return;
    if (acima && !confirmarCusto) { setConfirmarCusto(true); return; }
    setSalvando(true);
    try {
      const r = await fornecedoresDoProdutoApi.darEntrada(cid, produto.id, montado.corpo);
      toast.success(`Entrada de ${fmtQty(r.quantity)} ${unidade} em ${produto.name}`);
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["product-suppliers", cid, produto.id] });
      qc.invalidateQueries({ queryKey: ["product-purchases", cid, produto.id] });
      qc.invalidateQueries({ queryKey: ["estoque-consulta-variantes", cid, produto.id] });
      if (r.supplier?.created) qc.invalidateQueries({ queryKey: ["suppliers", cid] });
      onFeito?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Não conseguimos dar entrada. Nada foi gravado; tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[s.scrim, estreito && s.scrimEstreito]} onPress={onClose}>
        <Pressable style={[s.card, estreito && s.cardEstreito]} onPress={() => {}} testID="entrada-mercadoria-modal">
          {estreito ? <View style={s.puxador} /> : null}
          <View style={s.head}>
            <View style={s.ico}><Text style={s.icoTxt}>↓</Text></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.title}>Entrada de mercadoria</Text>
              <Text style={s.sub} numberOfLines={1}>{produto.name} · estoque atual {fmtQty(estoqueAntes)} {unidade}</Text>
            </View>
            <Pressable onPress={onClose} accessibilityLabel="Fechar"><Icon name="x" size={16} color={Colors.ink3} /></Pressable>
          </View>

          <ScrollView style={{ maxHeight: estreito ? 520 : 600 }} contentContainerStyle={{ paddingBottom: 6 }} keyboardShouldPersistTaps="handled">
            {/* Fornecedor */}
            <Text style={s.label}>De qual fornecedor você comprou?</Text>
            {novo ? (
              <View style={s.novo} testID="entrada-fornecedor-novo">
                <Text style={s.label}>Nome do fornecedor</Text>
                <TextInput value={novo.name} onChangeText={(v) => setNovo({ ...novo, name: v })} autoFocus
                  placeholder="Ex.: Distribuidora Centro" placeholderTextColor={Colors.ink3} style={s.input as any} />
                <View style={[s.linha2, estreito && { flexDirection: "column" }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.label}>WhatsApp <Text style={s.opc}>(opcional)</Text></Text>
                    <TextInput value={novo.phone} onChangeText={(v) => setNovo({ ...novo, phone: maskPhone(v) })}
                      placeholder="(11) 9…" placeholderTextColor={Colors.ink3} keyboardType="phone-pad" style={s.input as any} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.label}>CNPJ <Text style={s.opc}>(opcional)</Text></Text>
                    <TextInput value={novo.cnpj} onChangeText={(v) => setNovo({ ...novo, cnpj: v })}
                      placeholder="00.000.000/0000-00" placeholderTextColor={Colors.ink3} keyboardType="number-pad" style={s.input as any} />
                  </View>
                </View>
                <Text style={s.hint}>
                  O fornecedor é salvo junto com a entrada.{" "}
                  <Text style={s.link} onPress={() => setNovo(null)}>Voltar para a lista</Text>
                </Text>
              </View>
            ) : escolhido ? (
              <Pressable style={[s.input, s.escolhido]} onPress={() => setEscolhido(null)} testID="entrada-fornecedor-escolhido">
                <Text style={{ color: Colors.ink, flex: 1 }} numberOfLines={1}>{escolhido.name}</Text>
                <Text style={s.trocar}>trocar</Text>
              </Pressable>
            ) : (
              <>
                <TextInput value={busca} onChangeText={setBusca} placeholder="Buscar fornecedor…" placeholderTextColor={Colors.ink3}
                  style={s.input as any} testID="entrada-busca-fornecedor" />
                <View style={s.drop}>
                  {lista.map((f, i) => (
                    <Pressable key={f.id} onPress={() => setEscolhido(f)} style={[s.dropItem, i > 0 && s.dropSep]}>
                      <Text style={s.dropNome} numberOfLines={1}>{f.name}</Text>
                      {!semCusto && custoDoFornecedor[f.id] ? (
                        <Text style={s.dropSub}>últ. custo {brl(custoDoFornecedor[f.id])}</Text>
                      ) : null}
                    </Pressable>
                  ))}
                  <Pressable onPress={() => setNovo({ name: busca.trim(), phone: "", cnpj: "" })}
                    style={[s.dropItem, lista.length > 0 && s.dropSep]} testID="entrada-cadastrar-fornecedor">
                    <Text style={s.dropAdd}>＋ {busca.trim() ? `Cadastrar "${busca.trim()}" como novo fornecedor` : "Cadastrar novo fornecedor"}</Text>
                  </Pressable>
                </View>
                <Text style={s.hint}>Sem fornecedor, a entrada soma o estoque do mesmo jeito.</Text>
              </>
            )}

            {/* Quantidade (ou grade) e custo */}
            {produto.has_variants && carregandoGrade ? (
              <Text style={s.hint}>Carregando cores e tamanhos…</Text>
            ) : temGrade ? (
              <>
                <Text style={s.label}>Quantas chegaram de cada?</Text>
                <View style={s.grade}>
                  {variantes.map((v) => (
                    <View key={v.id} style={s.gradeLinha}>
                      <Text style={s.gradeNome} numberOfLines={1}>{rotuloDaVariante(v)}</Text>
                      <Text style={s.gradeTem}>tem {fmtQty(parseFloat(v.stock_qty) || 0)}</Text>
                      <TextInput value={grade[v.id] || ""} onChangeText={(t) => setGrade({ ...grade, [v.id]: t.replace(/[^\d,]/g, "") })}
                        placeholder="0" placeholderTextColor={Colors.ink3} keyboardType="number-pad"
                        style={[s.input, s.gradeInput, numeroPositivo(grade[v.id]) ? s.gradeOn : null] as any} />
                    </View>
                  ))}
                </View>
              </>
            ) : null}

            <View style={[s.linha2, estreito && { flexDirection: "column" }]}>
              {!temGrade ? (
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Quantidade que chegou</Text>
                  <View style={s.comSufixo}>
                    <TextInput value={qtd} onChangeText={(t) => setQtd(t.replace(/[^\d,]/g, ""))} placeholder="0"
                      placeholderTextColor={Colors.ink3} keyboardType="number-pad" style={[s.input, { flex: 1 }] as any}
                      testID="entrada-quantidade" />
                    <Text style={s.sufixo}>{unidade}</Text>
                  </View>
                </View>
              ) : null}
              {!semCusto ? (
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Custo de cada {temGrade ? "peça" : "unidade"}</Text>
                  <View style={s.comSufixo}>
                    <Text style={s.prefixo}>R$</Text>
                    <TextInput value={custo} onChangeText={(t) => { setCusto(maskCurrency(t)); setConfirmarCusto(false); }}
                      placeholder="0,00" placeholderTextColor={Colors.ink3} keyboardType="number-pad"
                      style={[s.input, { flex: 1, paddingLeft: 34 }] as any} testID="entrada-custo" />
                  </View>
                  {previa.total ? <Text style={s.hint}>Total da compra: {brl(previa.total)}</Text> : null}
                </View>
              ) : null}
            </View>
            {acima ? (
              <Text style={s.aviso} testID="entrada-aviso-custo">
                Confere? {brl(custoNum)} está bem acima do que você costuma pagar ({brl(custoMedio)}).
                {confirmarCusto ? " Toque de novo para confirmar." : ""}
              </Text>
            ) : null}

            <Text style={s.label}>Nº da nota <Text style={s.opc}>(opcional)</Text></Text>
            <TextInput value={nota} onChangeText={setNota} placeholder="Ex.: 004512" placeholderTextColor={Colors.ink3} style={s.input as any} />

            {/* Resumo antes → depois */}
            {quantidade > 0 ? (
              <View style={s.resumo} testID="entrada-resumo">
                <Text style={s.rk}>Estoque</Text>
                <Text style={s.rv}><Text style={s.rde}>{fmtQty(previa.estoqueAntes)} → </Text>{fmtQty(previa.estoqueDepois)} {unidade}</Text>
                {!semCusto && previa.custoDepois !== null ? (
                  <>
                    <Text style={s.rk}>Custo médio</Text>
                    <Text style={s.rv}><Text style={s.rde}>{brl(previa.custoAntes)} → </Text>{brl(previa.custoDepois)}</Text>
                  </>
                ) : null}
                {!semCusto && previa.margemDepois !== null ? (
                  <>
                    <Text style={s.rk}>Margem no preço de {brl(produto.price)}</Text>
                    <Text style={s.rv}>{previa.margemAntes !== null ? <Text style={s.rde}>{previa.margemAntes}% → </Text> : null}{previa.margemDepois}%</Text>
                  </>
                ) : null}
              </View>
            ) : null}

            {!semCusto && custoNum ? (
              <Pressable style={s.check} onPress={() => setUsarMedio(!usarMedio)} accessibilityRole="checkbox" accessibilityState={{ checked: usarMedio }}>
                <View style={[s.box, !usarMedio && s.boxOff]}>{usarMedio ? <Text style={s.boxTxt}>✓</Text> : null}</View>
                <View style={{ flex: 1 }}>
                  <Text style={s.checkTxt}>Usar o custo médio como custo do produto</Text>
                  <Text style={s.hint}>É o custo que entra na margem e nos relatórios.</Text>
                </View>
              </Pressable>
            ) : null}
          </ScrollView>

          <View style={s.foot}>
            <Pressable onPress={onClose} style={s.btnSec}><Text style={s.btnSecTxt}>Cancelar</Text></Pressable>
            <Pressable onPress={confirmar} disabled={!pronto || salvando}
              style={[s.btnPri, estreito && { flex: 1 }, (!pronto || salvando) && { opacity: 0.5 }]} testID="entrada-confirmar">
              {salvando ? <ActivityIndicator size="small" color="#fff" /> : (
                <Text style={s.btnPriTxt}>
                  {pronto ? `Dar entrada em ${fmtQty(quantidade)} ${temGrade ? "peças" : unidade}` : "Dar entrada"}
                </Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "rgba(10,8,30,0.45)", alignItems: "center", justifyContent: "center", padding: 16 },
  scrimEstreito: { justifyContent: "flex-end", padding: 0 },
  card: { width: "100%", maxWidth: 520, backgroundColor: Colors.bg3, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: Colors.border },
  cardEstreito: { maxWidth: undefined, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, paddingBottom: 22 },
  puxador: { width: 40, height: 5, borderRadius: 3, backgroundColor: Colors.border2, alignSelf: "center", marginBottom: 10 },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 4 },
  ico: { width: 38, height: 38, borderRadius: 11, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center" },
  icoTxt: { color: Colors.violet3, fontSize: 18, fontWeight: "800" },
  title: { fontSize: 16, fontWeight: "700", color: Colors.ink },
  sub: { fontSize: 12.5, color: Colors.ink3, marginTop: 2 },
  label: { fontSize: 12, fontWeight: "600", color: Colors.ink2, marginTop: 12, marginBottom: 5 },
  opc: { fontWeight: "400", color: Colors.ink3 },
  input: { borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.ink, backgroundColor: Colors.bg2, minHeight: 42 },
  escolhido: { flexDirection: "row", alignItems: "center", gap: 8 },
  trocar: { color: Colors.violet3, fontSize: 12, fontWeight: "600" },
  drop: { borderWidth: 1, borderColor: Colors.border2, borderRadius: 12, marginTop: 6, overflow: "hidden" },
  dropItem: { paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", justifyContent: "space-between", gap: 8 },
  dropSep: { borderTopWidth: 1, borderTopColor: Colors.border },
  dropNome: { color: Colors.ink, fontSize: 13, flex: 1 },
  dropSub: { color: Colors.ink3, fontSize: 11.5 },
  dropAdd: { color: Colors.violet3, fontSize: 13, fontWeight: "600" },
  novo: { borderWidth: 1, borderStyle: "dashed", borderColor: Colors.violet, borderRadius: 12, paddingHorizontal: 12, paddingBottom: 12, backgroundColor: Colors.violetD },
  link: { color: Colors.violet3, fontWeight: "600" },
  linha2: { flexDirection: "row", gap: 12 },
  comSufixo: { flexDirection: "row", alignItems: "center", gap: 8, position: "relative" },
  sufixo: { color: Colors.ink3, fontSize: 13 },
  prefixo: { position: "absolute", left: 12, zIndex: 1, color: Colors.ink3, fontSize: 14 },
  grade: { gap: 6 },
  gradeLinha: { flexDirection: "row", alignItems: "center", gap: 10 },
  gradeNome: { flex: 1, minWidth: 0, color: Colors.ink, fontWeight: "600", fontSize: 13 },
  gradeTem: { color: Colors.ink3, fontSize: 11.5, width: 56, textAlign: "right" },
  gradeInput: { width: 70, textAlign: "center", paddingHorizontal: 6 },
  gradeOn: { borderColor: Colors.violet, backgroundColor: Colors.violetD },
  aviso: { marginTop: 8, fontSize: 12.5, color: Colors.amber, backgroundColor: Colors.amberD, borderRadius: 10, padding: 10 },
  resumo: { marginTop: 14, backgroundColor: Colors.bg4, borderRadius: 12, padding: 12, flexDirection: "row", flexWrap: "wrap", rowGap: 6 },
  rk: { width: "55%", color: Colors.ink3, fontSize: 13 },
  rv: { width: "45%", textAlign: "right", color: Colors.ink, fontWeight: "700", fontSize: 13 },
  rde: { color: Colors.ink3, fontWeight: "400" },
  check: { flexDirection: "row", gap: 10, alignItems: "flex-start", marginTop: 12 },
  box: { width: 18, height: 18, borderRadius: 5, backgroundColor: Colors.violet, alignItems: "center", justifyContent: "center", marginTop: 1 },
  boxOff: { backgroundColor: "transparent", borderWidth: 1, borderColor: Colors.border2 },
  boxTxt: { color: "#fff", fontSize: 12, fontWeight: "800" },
  checkTxt: { color: Colors.ink2, fontSize: 13 },
  hint: { fontSize: 12, color: Colors.ink3, marginTop: 4 },
  foot: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  btnSec: { paddingHorizontal: 14, paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2 },
  btnSecTxt: { color: Colors.ink2, fontWeight: "600", fontSize: 13 },
  btnPri: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 10, backgroundColor: Colors.violet, minWidth: 150, alignItems: "center" },
  btnPriTxt: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
