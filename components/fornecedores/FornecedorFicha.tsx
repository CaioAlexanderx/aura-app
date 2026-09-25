// ============================================================
// AURA. — Ficha do fornecedor (/fornecedores), 25/09/2026
//
// Tudo de um fornecedor num lugar só:
//   · contato (WhatsApp num toque) e editar;
//   · Matcon ligado: o que falta repor dele, "Montar pedido" e os pedidos
//     (montado, a caminho, recebido) — o que antes era a página Compras;
//   · produtos ligados a ele, com "Vincular produtos" em lote (busca e
//     marca vários de uma vez) e "Tirar" por produto.
// Fornecedor que só existe na nota (sem cadastro) mostra "Cadastrar".
// ============================================================
import { useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { ResponsiveSheet } from "@/components/ResponsiveSheet";
import { companiesApi } from "@/services/companiesApi";
import { suppliersApi, type Supplier } from "@/services/suppliersApi";
import type { PurchaseOrder } from "@/services/matconApi";
import { maskCnpj, maskPhone } from "@/utils/masks";
import { openWhatsApp } from "@/utils/whatsapp";
import { fraseDaSugestao, fraseJaPedido, progressoDoPedido } from "@/components/matcon/comprasUtil";
import { fmtDiaMesDeTimestamp } from "@/components/matcon/quotesUtil";
import { normalizarNome, type LinhaFornecedor } from "@/utils/fornecedoresUtil";

const fmtMoney = (n: number | string | null | undefined) => `R$ ${Math.round(Number(n || 0)).toLocaleString("pt-BR")}`;
const MAX_NA_BUSCA = 60;

type Props = {
  linha: LinhaFornecedor | null;
  companyId: string | null;
  matcon: boolean;
  jaPedidos: Record<string, string>;
  montando: boolean;
  onClose: () => void;
  onEditar: (s: Supplier) => void;
  onCadastrar: (l: LinhaFornecedor) => void;
  onMontarPedido: (l: LinhaFornecedor) => void;
  onAbrirPedido: (o: PurchaseOrder, l: LinhaFornecedor) => void;
  onMudou: () => void;
};

export function FornecedorFicha({ linha, companyId, matcon, jaPedidos, montando, onClose, onEditar, onCadastrar, onMontarPedido, onAbrirPedido, onMudou }: Props) {
  const qc = useQueryClient();
  const sid = linha?.supplier?.id || null;
  const [vinculando, setVinculando] = useState(false);
  const [busca, setBusca] = useState("");
  const [marcados, setMarcados] = useState<Record<string, boolean>>({});
  const [salvando, setSalvando] = useState(false);
  const [confirmaDesativar, setConfirmaDesativar] = useState(false);

  // Troca de fornecedor: volta tudo ao estado inicial.
  const [chave, setChave] = useState("");
  if ((linha?.key || "") !== chave) {
    setChave(linha?.key || "");
    setVinculando(false); setBusca(""); setMarcados({}); setConfirmaDesativar(false);
  }

  const detalhe = useQuery({
    queryKey: ["supplier", sid],
    queryFn: () => suppliersApi.get(companyId!, sid!),
    enabled: !!companyId && !!sid,
    staleTime: 15_000,
  });

  // Mesmo cache do Estoque (hooks/useProducts): não baixa a lista duas vezes.
  const produtos = useQuery({
    queryKey: ["products", companyId],
    queryFn: () => companiesApi.products(companyId!),
    enabled: !!companyId && vinculando,
    staleTime: 30_000,
  });

  const candidatos = useMemo(() => {
    if (!vinculando) return [];
    const arr: any[] = produtos.data?.products || [];
    const q = normalizarNome(busca);
    const lista = arr.filter((p) => p.supplier_id !== sid && (!q
      || normalizarNome(p.name).includes(q)
      || normalizarNome(p.sku).includes(q)
      || String(p.barcode || "").includes(busca.trim())));
    return lista.slice(0, MAX_NA_BUSCA).map((p) => ({ id: String(p.id), name: String(p.name || ""), outro: p.supplier?.name || null, total: lista.length }));
  }, [produtos.data, busca, vinculando, sid]);
  const totalEncontrado = candidatos.length ? candidatos[0].total : 0;
  const nMarcados = Object.values(marcados).filter(Boolean).length;

  function recarregar() {
    qc.invalidateQueries({ queryKey: ["supplier", sid] });
    qc.invalidateQueries({ queryKey: ["suppliers"] });
    qc.invalidateQueries({ queryKey: ["products", companyId] });
    onMudou();
  }

  async function vincular() {
    if (!companyId || !sid || !nMarcados || salvando) return;
    setSalvando(true);
    try {
      const ids = Object.keys(marcados).filter((k) => marcados[k]);
      const r = await suppliersApi.linkProducts(companyId, sid, ids);
      toast.success(`${r.updated} ${r.updated === 1 ? "produto vinculado" : "produtos vinculados"}`);
      setMarcados({}); setBusca(""); setVinculando(false);
      recarregar();
    } catch (e: any) {
      toast.error(e?.data?.error || e?.message || "Não consegui vincular os produtos");
    } finally {
      setSalvando(false);
    }
  }

  async function tirar(productId: string) {
    if (!companyId || !sid) return;
    try {
      await suppliersApi.linkProducts(companyId, sid, [productId], true);
      recarregar();
    } catch (e: any) {
      toast.error(e?.data?.error || e?.message || "Não consegui tirar o produto");
    }
  }

  async function desativar() {
    if (!companyId || !sid) return;
    if (!confirmaDesativar) { setConfirmaDesativar(true); return; }
    try {
      await suppliersApi.remove(companyId, sid);
      toast.success("Fornecedor removido da lista");
      recarregar();
      onClose();
    } catch (e: any) {
      toast.error(e?.data?.error || e?.message || "Não consegui remover o fornecedor");
    }
  }

  if (!linha) return <ResponsiveSheet visible={false} onClose={onClose}><View /></ResponsiveSheet>;

  const rep = linha.reposicao;
  const pedidos = [...linha.rascunhos, ...linha.enviados, ...linha.recebidos];
  const tudoJaPedido = !!rep && rep.items.length > 0 && rep.items.every((it) => !!jaPedidos[it.product_id]);
  const vinculados = detalhe.data?.products || [];

  return (
    <ResponsiveSheet visible={!!linha} onClose={onClose} maxWidth={620}>
      <>
        <View style={st.header}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={st.title} numberOfLines={2}>{linha.nome}</Text>
            <Text style={st.sub} numberOfLines={2}>
              {[linha.cnpj ? maskCnpj(linha.cnpj) : "", linha.contato || "", linha.telefone ? maskPhone(linha.telefone.replace(/\D/g, "")) : ""].filter(Boolean).join(" · ")
                || (linha.origem === "sem" ? "Produtos que nunca chegaram por nota nem têm fornecedor ligado" : "Sem contato cadastrado")}
            </Text>
          </View>
          <Pressable onPress={onClose} style={st.close} testID="fornecedor-ficha-fechar" accessibilityLabel="Fechar">
            <Icon name="x" size={16} color={Colors.ink3} />
          </Pressable>
        </View>

        <ScrollView style={st.body} keyboardShouldPersistTaps="handled">
          {linha.origem !== "sem" && (
            <View style={st.acoes}>
              {!!linha.telefone && (
                <Pressable onPress={() => openWhatsApp(linha.telefone, `Olá${linha.contato ? ", " + linha.contato.split(" ")[0] : ""}!`)} style={[st.btn, st.btnWa]} testID="fornecedor-ficha-whatsapp">
                  <Icon name="whatsapp" size={14} color={Colors.green} />
                  <Text style={[st.btnTexto, { color: Colors.green }]}>WhatsApp</Text>
                </Pressable>
              )}
              {linha.supplier ? (
                <Pressable onPress={() => onEditar(linha.supplier!)} style={st.btn} testID="fornecedor-ficha-editar">
                  <Icon name="edit" size={14} color={Colors.ink} />
                  <Text style={st.btnTexto}>Editar</Text>
                </Pressable>
              ) : (
                <Pressable onPress={() => onCadastrar(linha)} style={[st.btn, st.btnPrimario]} testID="fornecedor-ficha-cadastrar">
                  <Icon name="plus" size={14} color="#fff" />
                  <Text style={[st.btnTexto, { color: "#fff" }]}>Cadastrar fornecedor</Text>
                </Pressable>
              )}
            </View>
          )}
          {linha.origem === "nota" && (
            <Text style={st.nota}>Este fornecedor veio de uma nota de entrada e ainda não está no seu cadastro.</Text>
          )}

          {matcon && rep && (
            <View style={st.secao} testID="fornecedor-ficha-repor">
              <View style={st.secaoTopo}>
                <Text style={st.secaoTitulo}>Para repor · {rep.items.length} {rep.items.length === 1 ? "item" : "itens"}</Text>
                <Text style={st.valor}>{fmtMoney(rep.total_est)}</Text>
              </View>
              {rep.items.map((it) => (
                <Text key={it.product_id} style={[st.item, jaPedidos[it.product_id] && { color: Colors.ink3 }]}>
                  <Text style={st.itemNome}>{it.name}</Text> · {jaPedidos[it.product_id] ? fraseJaPedido(jaPedidos[it.product_id]) : fraseDaSugestao(it)}
                </Text>
              ))}
              <Pressable onPress={() => onMontarPedido(linha)} disabled={montando} style={[st.btn, st.btnPrimario, { alignSelf: "flex-start", marginTop: 10 }]} testID="fornecedor-ficha-montar-pedido">
                {montando ? <ActivityIndicator size="small" color="#fff" /> : (
                  <>
                    <Icon name="clipboard" size={13} color="#fff" />
                    <Text style={[st.btnTexto, { color: "#fff" }]}>{tudoJaPedido ? "Pedir de novo mesmo assim" : "Montar pedido"}</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}

          {matcon && pedidos.length > 0 && (
            <View style={st.secao} testID="fornecedor-ficha-pedidos">
              <Text style={st.secaoTitulo}>Pedidos de compra</Text>
              {pedidos.map((o) => {
                const prog = progressoDoPedido(o);
                const situacao = o.status === "draft" ? "montado, falta enviar"
                  : o.status === "sent" ? (prog.pct > 0 && prog.pct < 100 ? "chegou em parte" : `a caminho${o.sent_at ? " desde " + fmtDiaMesDeTimestamp(o.sent_at) : ""}`)
                  : `recebido em ${fmtDiaMesDeTimestamp(o.received_at)}`;
                return (
                  <Pressable key={o.id} onPress={() => onAbrirPedido(o, linha)} style={st.pedido} testID={`fornecedor-ficha-pedido-${o.id}`}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={st.itemNome}>Pedido #{o.number}</Text>
                      <Text style={st.meta}>{situacao} · {(o.items || []).length} {(o.items || []).length === 1 ? "item" : "itens"}</Text>
                    </View>
                    <Text style={st.valor}>{fmtMoney(o.total_est)}</Text>
                    <Icon name="chevron_right" size={14} color={Colors.ink3} />
                  </Pressable>
                );
              })}
            </View>
          )}

          {linha.supplier && (
            <View style={st.secao} testID="fornecedor-ficha-produtos">
              <View style={st.secaoTopo}>
                <Text style={st.secaoTitulo}>Produtos deste fornecedor{detalhe.data ? ` · ${vinculados.length}` : ""}</Text>
                {!vinculando && (
                  <Pressable onPress={() => setVinculando(true)} style={st.miniBtn} testID="fornecedor-ficha-vincular">
                    <Icon name="plus" size={12} color={Colors.ink} />
                    <Text style={st.miniBtnTexto}>Vincular produtos</Text>
                  </Pressable>
                )}
              </View>

              {vinculando && (
                <View style={st.picker} testID="fornecedor-ficha-picker">
                  <TextInput style={st.input} value={busca} onChangeText={setBusca} autoFocus
                    placeholder="Buscar produto por nome, código ou código de barras" placeholderTextColor={Colors.ink3} testID="fornecedor-ficha-busca" />
                  {produtos.isLoading ? <ActivityIndicator color={Colors.violet3} style={{ marginVertical: 12 }} /> : (
                    <>
                      {candidatos.map((p) => (
                        <Pressable key={p.id} onPress={() => setMarcados((m) => ({ ...m, [p.id]: !m[p.id] }))} style={st.cand} testID={`fornecedor-ficha-cand-${p.id}`}>
                          <View style={[st.check, marcados[p.id] && st.checkOn]}>{marcados[p.id] && <Icon name="check" size={11} color="#fff" />}</View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={st.candNome} numberOfLines={1}>{p.name}</Text>
                            {p.outro && <Text style={st.meta}>hoje ligado a {p.outro}</Text>}
                          </View>
                        </Pressable>
                      ))}
                      {totalEncontrado > MAX_NA_BUSCA && (
                        <Text style={st.meta}>Mostrando {MAX_NA_BUSCA} de {totalEncontrado}. Refine a busca para achar o resto.</Text>
                      )}
                      {!candidatos.length && <Text style={st.meta}>Nenhum produto encontrado.</Text>}
                    </>
                  )}
                  <View style={st.pickerActs}>
                    <Pressable onPress={() => { setVinculando(false); setMarcados({}); setBusca(""); }} style={st.btn}><Text style={st.btnTexto}>Cancelar</Text></Pressable>
                    <Pressable onPress={vincular} disabled={!nMarcados || salvando} style={[st.btn, st.btnPrimario, (!nMarcados || salvando) && { opacity: 0.5 }]} testID="fornecedor-ficha-confirmar-vinculo">
                      {salvando ? <ActivityIndicator size="small" color="#fff" /> : (
                        <Text style={[st.btnTexto, { color: "#fff" }]}>{nMarcados ? `Vincular ${nMarcados} ${nMarcados === 1 ? "produto" : "produtos"}` : "Marque os produtos"}</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              )}

              {detalhe.isLoading ? <ActivityIndicator color={Colors.violet3} style={{ marginVertical: 12 }} /> : vinculados.length === 0 ? (
                !vinculando && <Text style={st.meta}>Nenhum produto ligado ainda. Ligar os produtos faz a reposição deles aparecer aqui.</Text>
              ) : vinculados.map((p) => (
                <View key={p.id} style={st.vinc}>
                  <Text style={st.candNome} numberOfLines={1}>{p.name}</Text>
                  <Text style={st.meta}>{Number(p.stock_qty) || 0} em estoque</Text>
                  <Pressable onPress={() => tirar(p.id)} style={st.tirar} testID={`fornecedor-ficha-tirar-${p.id}`} accessibilityLabel={`Tirar ${p.name} deste fornecedor`}>
                    <Icon name="x" size={12} color={Colors.ink3} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {linha.supplier && (
            <Pressable onPress={desativar} style={st.desativar} testID="fornecedor-ficha-desativar">
              <Text style={[st.desativarTexto, confirmaDesativar && { color: Colors.red }]}>
                {confirmaDesativar ? "Toque de novo para confirmar" : "Remover da lista de fornecedores"}
              </Text>
            </Pressable>
          )}
        </ScrollView>
      </>
    </ResponsiveSheet>
  );
}

const st = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 18, borderBottomWidth: 1, borderBottomColor: Colors.border2 },
  title: { fontSize: 17, fontWeight: "700", color: Colors.ink },
  sub: { fontSize: 12, color: Colors.ink3, marginTop: 3, lineHeight: 17 },
  close: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg2 },
  body: { paddingHorizontal: 18, paddingVertical: 12 },
  acoes: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 6 },
  nota: { fontSize: 12, color: Colors.ink3, marginBottom: 6, lineHeight: 17 },
  secao: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border2, gap: 6 },
  secaoTopo: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  secaoTitulo: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  valor: { fontFamily: Fonts.mono, fontSize: 14, color: Colors.ink },
  item: { fontSize: 12.5, color: Colors.ink2, lineHeight: 18 },
  itemNome: { color: Colors.ink, fontWeight: "600", fontSize: 13 },
  meta: { fontSize: 12, color: Colors.ink3, marginTop: 2 },
  pedido: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: Colors.border2 },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg4, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  btnWa: { borderColor: Colors.green + "73", backgroundColor: Colors.bg3 },
  btnPrimario: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  btnTexto: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  miniBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg4, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  miniBtnTexto: { fontSize: 12, fontWeight: "700", color: Colors.ink },
  picker: { gap: 4, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg2, marginBottom: 6 },
  input: { backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: Colors.ink, marginBottom: 4 },
  cand: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  candNome: { flex: 1, fontSize: 13, color: Colors.ink },
  check: { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: Colors.border2, alignItems: "center", justifyContent: "center" },
  checkOn: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  pickerActs: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 8 },
  vinc: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: Colors.border2 },
  tirar: { width: 26, height: 26, borderRadius: 7, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg4 },
  desativar: { marginTop: 22, marginBottom: 10, alignSelf: "center", paddingVertical: 8, paddingHorizontal: 12 },
  desativarTexto: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
});
