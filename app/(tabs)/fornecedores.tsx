// ============================================================
// AURA. — Fornecedores (25/09/2026)
//
// Primeira tela de fornecedores do app. O backend (src/routes/suppliers.js,
// migration 342) existia desde 16/09 sem nenhuma tela; a GF Amorim
// (materiais de construção, 2.019 produtos) tinha zero fornecedores.
//
// Organizada POR FORNECEDOR (decisão do Caio, 25/09):
//   · para todo varejo: lista, busca, cadastro rápido (CNPJ preenche o
//     resto), ficha com contato e produtos ligados;
//   · com o Matcon ligado, a antiga página "Compras" mora aqui dentro:
//     cada fornecedor mostra o que falta repor dele, o pedido montado ou a
//     caminho, e "Montar pedido" (mesma esteira do backend M4). A rota
//     /matcon/compras redireciona para cá.
// O casamento cadastro × nota × pedido e a ordem da lista ficam em
// utils/fornecedoresUtil.ts (testável sem o Icon).
// ============================================================
import { useMemo, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, TextInput } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { ScreenHero } from "@/components/ScreenHero";
import { RequireCompanyScope } from "@/components/RequireCompanyScope";
import { useAuthStore } from "@/stores/auth";
import { usePdvSettings } from "@/hooks/usePdvSettings";
import { useVisibleModules } from "@/hooks/useVisibleModules";
import { readMatconSettings, type MatconSettings } from "@/constants/matcon";
import { matconApi, type PurchaseOrder, type PurchaseSuggestion } from "@/services/matconApi";
import { suppliersApi, type Supplier } from "@/services/suppliersApi";
import { maskPhone } from "@/utils/masks";
import { openWhatsApp } from "@/utils/whatsapp";
import { agruparPorFornecedor, fraseDaSugestao, fraseJaPedido, produtosJaPedidos, fmtMoneyApprox } from "@/components/matcon/comprasUtil";
import { textoDoErro, RETRY_DA_TELA } from "@/components/matcon/erroMatcon";
import { PedidoCompraSheet } from "@/components/matcon/PedidoCompraSheet";
import { FornecedorFormSheet } from "@/components/fornecedores/FornecedorFormSheet";
import { FornecedorFicha } from "@/components/fornecedores/FornecedorFicha";
import {
  montarLinhas, filtrarLinhas, formDaLinha, type LinhaFornecedor, type FormFornecedor,
} from "@/utils/fornecedoresUtil";

const fmtMoney = (n: number | string | null | undefined) => `R$ ${Math.round(Number(n || 0)).toLocaleString("pt-BR")}`;
const ITENS_VISIVEIS = 2;

type Filtro = "todos" | "repor" | "caminho";

export default function FornecedoresRoute() {
  // Pedido de compra e estoque são de UMA loja: no consolidado, escolhe antes.
  return (
    <RequireCompanyScope context="fornecedores" actionLabel="ver os fornecedores">
      <FornecedoresScreen />
    </RequireCompanyScope>
  );
}

function FornecedoresScreen() {
  const { company } = useAuthStore();
  const cid = company?.id || null;
  const qc = useQueryClient();
  const { settings } = usePdvSettings();
  const modulos = useVisibleModules();
  const matconCfg = useMemo(() => readMatconSettings(settings as Partial<MatconSettings>), [settings]);
  const matcon = matconCfg.matcon_enabled && modulos.has("matcon.compras");

  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [form, setForm] = useState<{ supplier: Supplier | null; inicial: FormFornecedor | null } | null>(null);
  const [fichaKey, setFichaKey] = useState<string | null>(null);
  const [pedido, setPedido] = useState<{ order: PurchaseOrder; telefone: string | null } | null>(null);
  const [montandoKey, setMontandoKey] = useState<string | null>(null);

  const suppliersQ = useQuery({
    queryKey: ["suppliers", cid],
    queryFn: () => suppliersApi.list(cid!),
    enabled: !!cid,
    staleTime: 30_000,
    // O client já tenta de novo (services/api); tentar por cima só atrasa o
    // erro na tela (mesma regra da antiga Compras, QA 23/09).
    retry: RETRY_DA_TELA,
  });
  const sugestoesQ = useQuery({
    queryKey: ["matcon-purchase-suggestions", cid],
    queryFn: () => matconApi.purchaseSuggestions(cid!),
    enabled: !!cid && matcon,
    staleTime: 30_000,
    retry: RETRY_DA_TELA,
  });
  const pedidosQ = useQuery({
    queryKey: ["matcon-purchase-orders", cid],
    queryFn: () => matconApi.listPurchaseOrders(cid!, {}),
    enabled: !!cid && matcon,
    staleTime: 15_000,
    retry: RETRY_DA_TELA,
  });

  const pedidos = (pedidosQ.data?.orders || []) as PurchaseOrder[];
  const jaPedidos = useMemo(() => produtosJaPedidos(pedidos), [pedidosQ.data]);
  const linhas = useMemo(() => montarLinhas({
    suppliers: suppliersQ.data?.suppliers || [],
    reposicao: matcon ? agruparPorFornecedor(sugestoesQ.data?.suggestions || []) : [],
    pedidos: matcon ? pedidos : [],
  }), [suppliersQ.data, sugestoesQ.data, pedidosQ.data, matcon]);

  const filtradas = useMemo(() => {
    const base = filtrarLinhas(linhas, busca);
    if (filtro === "repor") return base.filter((l) => !!l.reposicao || l.rascunhos.length > 0);
    if (filtro === "caminho") return base.filter((l) => l.enviados.length > 0);
    return base;
  }, [linhas, busca, filtro]);

  const ficha = fichaKey ? linhas.find((l) => l.key === fichaKey) || null : null;
  const nCadastrados = (suppliersQ.data?.suppliers || []).length;
  const nRepor = linhas.filter((l) => !!l.reposicao || l.rascunhos.length > 0).length;
  const nCaminho = linhas.filter((l) => l.enviados.length > 0).length;

  function invalidar() {
    qc.invalidateQueries({ queryKey: ["suppliers"] });
    qc.invalidateQueries({ queryKey: ["matcon-purchase-suggestions"] });
    qc.invalidateQueries({ queryKey: ["matcon-purchase-orders"] });
  }

  async function montarPedido(l: LinhaFornecedor) {
    if (!cid || !l.reposicao || montandoKey) return;
    // O que já está num pedido enviado fica de fora; se TUDO já foi pedido,
    // é o "Pedir de novo mesmo assim" e vai tudo (regra da antiga Compras).
    const naoPedidos = l.reposicao.items.filter((it: PurchaseSuggestion) => !jaPedidos[it.product_id]);
    const itens = naoPedidos.length > 0 ? naoPedidos : l.reposicao.items;
    setMontandoKey(l.key);
    try {
      const res = await matconApi.createPurchaseOrder(cid, {
        supplier_name: l.origem === "sem" ? null : l.nome,
        supplier_cnpj: l.cnpj,
        supplier_phone: l.telefone,
        items: itens.map((s: PurchaseSuggestion) => ({ product_id: s.product_id, quantity: s.suggested_qty })),
      });
      invalidar();
      setPedido({ order: res.order, telefone: l.telefone });
    } catch (e: any) {
      toast.error(textoDoErro(e, "Não consegui montar o pedido. Tente de novo em instantes."));
    } finally {
      setMontandoKey(null);
    }
  }

  const carregando = suppliersQ.isLoading || (matcon && (sugestoesQ.isLoading || pedidosQ.isLoading));
  const falhou = suppliersQ.isError && !suppliersQ.data;

  const subtitulo = carregando ? "Carregando…" : (
    <Text>
      {nCadastrados} {nCadastrados === 1 ? "fornecedor cadastrado" : "fornecedores cadastrados"}
      {matcon && sugestoesQ.data ? ` · ${fmtMoney(sugestoesQ.data.summary.total_est_cost)} para repor` : ""}
      {matcon && pedidosQ.data ? ` · ${pedidosQ.data.summary.sent.count} ${pedidosQ.data.summary.sent.count === 1 ? "pedido a caminho" : "pedidos a caminho"}` : ""}
    </Text>
  );

  return (
    <ScrollView style={st.screen} contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">
      <ScreenHero
        eyebrow="Estoque"
        title="Fornecedores"
        subtitle={subtitulo}
        actions={
          <Pressable onPress={() => setForm({ supplier: null, inicial: null })} style={st.primaryBtn} testID="fornecedores-novo">
            <Icon name="plus" size={14} color="#fff" />
            <Text style={st.primaryBtnText}>Novo fornecedor</Text>
          </Pressable>
        }
      />

      <View style={st.busca}>
        <Icon name="search" size={14} color={Colors.ink3} />
        <TextInput style={st.buscaInput} value={busca} onChangeText={setBusca}
          placeholder="Buscar por nome, CNPJ, vendedor ou telefone" placeholderTextColor={Colors.ink3} testID="fornecedores-busca" />
      </View>

      {matcon && (nRepor > 0 || nCaminho > 0) && (
        <View style={st.chips}>
          {([["todos", "Todos"], ["repor", `Para repor · ${nRepor}`], ["caminho", `A caminho · ${nCaminho}`]] as [Filtro, string][]).map(([k, label]) => (
            <Pressable key={k} onPress={() => setFiltro(k)} style={[st.chip, filtro === k && st.chipOn]} testID={`fornecedores-filtro-${k}`}>
              <Text style={[st.chipText, filtro === k && st.chipTextOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {matcon && (sugestoesQ.isError || pedidosQ.isError) && (
        <View style={st.avisoLinha} testID="fornecedores-aviso-matcon">
          <Text style={st.avisoCarga}>
            Não consegui carregar {sugestoesQ.isError && pedidosQ.isError ? "a reposição nem os pedidos de compra" : sugestoesQ.isError ? "a reposição" : "os pedidos de compra"} agora. Os fornecedores aparecem normalmente.
          </Text>
          <Pressable
            onPress={() => { if (sugestoesQ.isError) sugestoesQ.refetch(); if (pedidosQ.isError) pedidosQ.refetch(); }}
            style={st.ghostBtn}
            testID="fornecedores-aviso-matcon-tentar"
          >
            <Text style={st.ghostBtnText}>Tentar de novo</Text>
          </Pressable>
        </View>
      )}

      {carregando ? (
        <View style={st.loading}><ActivityIndicator color={Colors.violet3} /></View>
      ) : falhou ? (
        <View style={st.vazio} testID="fornecedores-erro">
          <Text style={st.vazioTitulo}>Não consegui carregar os fornecedores.</Text>
          <Pressable onPress={() => suppliersQ.refetch()} style={st.ghostBtn} testID="fornecedores-erro-tentar"><Text style={st.ghostBtnText}>Tentar de novo</Text></Pressable>
        </View>
      ) : linhas.length === 0 ? (
        <View style={st.vazio} testID="fornecedores-vazio">
          <View style={st.vazioIcone}><Icon name="truck" size={20} color={Colors.violet3} /></View>
          <Text style={st.vazioTitulo}>Cadastre seus fornecedores</Text>
          <Text style={st.vazioFrase}>
            Com o CNPJ, nome, WhatsApp e e-mail se preenchem sozinhos. Depois é só ligar os produtos de cada um{matcon ? " e mandar o pedido de reposição pelo WhatsApp" : ""}.
          </Text>
          <Pressable onPress={() => setForm({ supplier: null, inicial: null })} style={st.primaryBtn} testID="fornecedores-vazio-novo">
            <Icon name="plus" size={14} color="#fff" />
            <Text style={st.primaryBtnText}>Cadastrar o primeiro</Text>
          </Pressable>
        </View>
      ) : filtradas.length === 0 ? (
        <Text style={st.nada} testID="fornecedores-busca-vazia">Nenhum fornecedor encontrado.</Text>
      ) : (
        <View style={{ gap: 8 }} testID="fornecedores-lista">
          {filtradas.map((l) => (
            <LinhaCard
              key={l.key}
              linha={l}
              matcon={matcon}
              jaPedidos={jaPedidos}
              montando={montandoKey === l.key}
              onAbrir={() => setFichaKey(l.key)}
              onCadastrar={() => setForm({ supplier: null, inicial: formDaLinha(l) })}
              onMontarPedido={() => montarPedido(l)}
              onContinuarPedido={(o) => setPedido({ order: o, telefone: l.telefone })}
            />
          ))}
        </View>
      )}

      <FornecedorFormSheet
        visible={!!form}
        companyId={cid}
        supplier={form?.supplier || null}
        inicial={form?.inicial || null}
        onClose={() => setForm(null)}
        onSalvo={() => invalidar()}
        onAbrirExistente={(id) => { setForm(null); setFichaKey(id); }}
      />

      <FornecedorFicha
        linha={form || pedido ? null : ficha}
        companyId={cid}
        matcon={matcon}
        jaPedidos={jaPedidos}
        montando={!!ficha && montandoKey === ficha.key}
        onClose={() => setFichaKey(null)}
        onEditar={(s) => setForm({ supplier: s, inicial: null })}
        onCadastrar={(l) => setForm({ supplier: null, inicial: formDaLinha(l) })}
        onMontarPedido={(l) => montarPedido(l)}
        onAbrirPedido={(o, l) => setPedido({ order: o, telefone: l.telefone })}
        onMudou={invalidar}
      />

      <PedidoCompraSheet
        order={pedido?.order || null}
        companyId={cid}
        nomeDaLoja={company?.name || ""}
        telefoneDoCadastro={pedido?.telefone || null}
        onClose={() => setPedido(null)}
        onSalvo={invalidar}
      />
    </ScrollView>
  );
}

function LinhaCard({ linha: l, matcon, jaPedidos, montando, onAbrir, onCadastrar, onMontarPedido, onContinuarPedido }: {
  linha: LinhaFornecedor;
  matcon: boolean;
  jaPedidos: Record<string, string>;
  montando: boolean;
  onAbrir: () => void;
  onCadastrar: () => void;
  onMontarPedido: () => void;
  onContinuarPedido: (o: PurchaseOrder) => void;
}) {
  const rep = matcon ? l.reposicao : null;
  const itens = rep ? rep.items.slice(0, ITENS_VISIVEIS) : [];
  const ocultos = rep ? rep.items.slice(ITENS_VISIVEIS) : [];
  const rascunho = matcon ? l.rascunhos[0] : undefined;
  const acabando = !!rep && rep.min_days_to_stockout !== null && rep.min_days_to_stockout <= 3;
  const tudoJaPedido = !!rep && rep.items.length > 0 && rep.items.every((it) => !!jaPedidos[it.product_id]);
  const meta = [
    l.contato,
    l.telefone ? maskPhone(l.telefone.replace(/\D/g, "")) : null,
    l.produtos !== null ? `${l.produtos} ${l.produtos === 1 ? "produto" : "produtos"}` : null,
  ].filter(Boolean).join(" · ");
  const total = (rep ? rep.total_est : 0) + (rascunho ? Number(rascunho.total_est) || 0 : 0);

  return (
    <View style={[st.card, acabando && { borderColor: Colors.amber + "88" }]} testID={`fornecedor-${l.key}`}>
      <Pressable onPress={onAbrir} style={st.cardTopo} testID={`fornecedor-abrir-${l.key}`}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={st.nomeLinha}>
            <Text style={st.nome} numberOfLines={1}>{l.nome}</Text>
            {l.origem === "nota" && <View style={st.tag}><Text style={st.tagText}>da nota, sem cadastro</Text></View>}
          </View>
          {!!meta && <Text style={st.meta} numberOfLines={1}>{meta}</Text>}
          {l.origem === "sem" && <Text style={st.meta}>Produtos sem fornecedor ligado nem nota de entrada</Text>}
        </View>
        {matcon && total > 0 && <Text style={st.total}>{fmtMoney(total)}</Text>}
        <Icon name="chevron_right" size={14} color={Colors.ink3} />
      </Pressable>

      {rep && (
        <View style={{ gap: 3, marginTop: 8 }}>
          {itens.map((it) => (
            <Text key={it.product_id} style={[st.item, jaPedidos[it.product_id] && { color: Colors.ink3 }]} numberOfLines={2}>
              <Text style={st.itemNome}>{it.name}</Text> · {jaPedidos[it.product_id] ? fraseJaPedido(jaPedidos[it.product_id]) : fraseDaSugestao(it)}
            </Text>
          ))}
          {ocultos.length > 0 && (
            <Text style={st.meta}>mais {ocultos.length} {ocultos.length === 1 ? "item" : "itens"} para repor · {fmtMoneyApprox(ocultos.reduce((a, s) => a + (Number(s.est_cost) || 0), 0))}</Text>
          )}
        </View>
      )}

      {matcon && (l.enviados.length > 0 || rascunho) && (
        <View style={st.status}>
          {rascunho && <Text style={[st.statusText, { color: Colors.violet3 }]}>Pedido #{rascunho.number} montado, falta enviar</Text>}
          {l.enviados.map((o) => (
            <Text key={o.id} style={[st.statusText, { color: Colors.amber }]}>Pedido #{o.number} a caminho</Text>
          ))}
        </View>
      )}

      <View style={st.acts}>
        {!!l.telefone && (
          <Pressable onPress={() => openWhatsApp(l.telefone, "")} style={[st.miniBtn, st.miniBtnWa]} testID={`fornecedor-whatsapp-${l.key}`}>
            <Icon name="whatsapp" size={13} color={Colors.green} />
            <Text style={[st.miniBtnText, { color: Colors.green }]}>WhatsApp</Text>
          </Pressable>
        )}
        {l.origem === "nota" && (
          <Pressable onPress={onCadastrar} style={st.miniBtn} testID={`fornecedor-cadastrar-${l.key}`}>
            <Icon name="plus" size={13} color={Colors.ink} />
            <Text style={st.miniBtnText}>Cadastrar</Text>
          </Pressable>
        )}
        {rascunho ? (
          <Pressable onPress={() => onContinuarPedido(rascunho)} style={[st.miniBtn, st.miniBtnPrimary]} testID={`fornecedor-continuar-${l.key}`}>
            <Text style={[st.miniBtnText, { color: "#fff" }]}>Continuar pedido</Text>
          </Pressable>
        ) : rep ? (
          <Pressable onPress={onMontarPedido} disabled={montando} style={[st.miniBtn, st.miniBtnPrimary]} testID={`fornecedor-montar-${l.key}`}>
            {montando ? <ActivityIndicator size="small" color="#fff" /> : (
              <>
                <Icon name="clipboard" size={13} color="#fff" />
                <Text style={[st.miniBtnText, { color: "#fff" }]}>{tudoJaPedido ? "Pedir de novo mesmo assim" : "Montar pedido"}</Text>
              </>
            )}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 20, paddingBottom: 56, maxWidth: 980, alignSelf: "center", width: "100%" },
  primaryBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.violet, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  primaryBtnText: { fontSize: 13, color: "#fff", fontWeight: "700" },
  ghostBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  ghostBtnText: { fontSize: 13, color: Colors.ink, fontWeight: "700" },
  busca: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, paddingHorizontal: 12, marginBottom: 12 },
  buscaInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: Colors.ink },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg2 },
  chipOn: { backgroundColor: Colors.violet + "22", borderColor: Colors.violet },
  chipText: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
  chipTextOn: { color: Colors.violet3 },
  avisoLinha: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  avisoCarga: { flex: 1, minWidth: 220, fontSize: 12, color: Colors.amber, lineHeight: 17 },
  loading: { paddingVertical: 40, alignItems: "center" },
  nada: { fontSize: 13, color: Colors.ink3, textAlign: "center", paddingVertical: 30 },
  vazio: { alignItems: "center", gap: 10, paddingVertical: 36, paddingHorizontal: 18 },
  vazioIcone: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2 },
  vazioTitulo: { fontSize: 15, fontWeight: "700", color: Colors.ink, textAlign: "center" },
  vazioFrase: { fontSize: 12.5, color: Colors.ink3, textAlign: "center", maxWidth: 420, lineHeight: 18 },
  card: { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border2, borderRadius: 14, padding: 14 },
  cardTopo: { flexDirection: "row", alignItems: "center", gap: 10 },
  nomeLinha: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  nome: { fontSize: 15, fontWeight: "700", color: Colors.ink, flexShrink: 1 },
  tag: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: Colors.amber + "88" },
  tagText: { fontSize: 10, fontWeight: "700", color: Colors.amber },
  meta: { fontSize: 12, color: Colors.ink3, marginTop: 3 },
  total: { fontFamily: Fonts.mono, fontSize: 16, color: Colors.ink },
  item: { fontSize: 12.5, color: Colors.ink2, lineHeight: 18 },
  itemNome: { color: Colors.ink, fontWeight: "600" },
  status: { marginTop: 8, gap: 2 },
  statusText: { fontSize: 12, fontWeight: "700" },
  acts: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  miniBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg4, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  miniBtnWa: { borderColor: Colors.green + "73", backgroundColor: Colors.bg3 },
  miniBtnPrimary: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  miniBtnText: { fontSize: 12, fontWeight: "700", color: Colors.ink },
});
