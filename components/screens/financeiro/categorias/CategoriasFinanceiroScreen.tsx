// ============================================================
// AURA. — Financeiro › Categorias (mockup, seção A) — 09/11/2026
//
// Despesas e receitas em abas. Cada categoria mostra a cor, o nome, quantos
// lançamentos teve no ano e as subcategorias em chips. As "usadas pela Aura"
// (Vendas, Crediário, Trocas e devoluções, Taxas de cartão, Fornecedores,
// Outros) não trocam de nome nem saem — o Caixa, o Crediário e o resultado
// do período contam com o nome delas —, mas ganham subcategorias.
//
// Menu ⋯ (sempre visível, sem hover — toque): Renomear, Mudar cor, Juntar
// com outra (move os lançamentos) e Arquivar (some da escolha; os lançamentos
// antigos ficam onde estão). Tocar numa subcategoria abre o mesmo menu dela.
//
// Subtela do Financeiro, como /financeiro/produtos: sem item de menu nem
// `mod` próprio — a barra lateral marca Financeiro pelo prefixo da rota.
// Categorias são por loja: no consolidado a tela pede para escolher uma.
// ============================================================
import { useMemo, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, ActivityIndicator, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { WebPortal } from "@/components/WebPortal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useAuthStore } from "@/stores/auth";
import { useFinanceCategories } from "@/hooks/useFinanceCategories";
import { financeCategoriesApi, type CategoriaFinanceira, type KindDaCategoria, type Subcategoria } from "@/services/financeCategoriesApi";
import { CORES_DE_CATEGORIA, destinosDaJuncao, linhaDeBaixo } from "@/utils/categoriasFinanceiro";
import { NovaCategoriaModal, estilosDeCategoria as m } from "./NovaCategoriaModal";

type Alvo = { tipo: "categoria"; cat: CategoriaFinanceira } | { tipo: "sub"; cat: CategoriaFinanceira; sub: Subcategoria };
type Acao = null | "menu" | "renomear" | "cor" | "juntar" | "arquivar";

type Props = { hrefFinanceiro: string };

export function CategoriasFinanceiroScreen({ hrefFinanceiro }: Props) {
  var { width } = useWindowDimensions();
  var celular = width < 560;
  var { consolidatedView } = useAuthStore();
  var [aba, setAba] = useState<KindDaCategoria>("expense");
  var [verArquivadas, setVerArquivadas] = useState(false);
  var { lista, carregando, erro, refetch, invalidar, criar, companyId } = useFinanceCategories({ incluirArquivadas: verArquivadas });
  var [novaAberta, setNovaAberta] = useState(false);
  var [alvo, setAlvo] = useState<Alvo | null>(null);
  var [acao, setAcao] = useState<Acao>(null);
  var [texto, setTexto] = useState("");
  var [ocupado, setOcupado] = useState(false);
  var [novaSubDe, setNovaSubDe] = useState<string | null>(null);
  var [novaSubNome, setNovaSubNome] = useState("");

  var cats = useMemo(function() {
    return (lista?.categories || []).filter(function(c) { return c.kind === aba; });
  }, [lista, aba]);

  function voltar() {
    if (router.canGoBack()) router.back();
    else router.replace((hrefFinanceiro + "?tab=lancamentos") as any);
  }

  function abrirMenu(a: Alvo) { setAlvo(a); setAcao("menu"); }
  function fechar() { setAlvo(null); setAcao(null); setTexto(""); setOcupado(false); }

  var alvoId = alvo ? (alvo.tipo === "sub" ? alvo.sub.id : alvo.cat.id) : null;
  var alvoNome = alvo ? (alvo.tipo === "sub" ? alvo.sub.name : alvo.cat.name) : "";
  var alvoSistema = !!alvo && alvo.tipo === "categoria" && alvo.cat.is_system;
  var alvoArquivado = !!alvo && !!(alvo.tipo === "sub" ? alvo.sub.archived_at : alvo.cat.archived_at);

  async function executar(fn: () => Promise<any>, ok: string | ((r: any) => string)) {
    if (!companyId) return;
    setOcupado(true);
    try {
      var r = await fn();
      toast.success(typeof ok === "function" ? ok(r) : ok);
      invalidar();
      fechar();
    } catch (e: any) {
      toast.error(e?.message || "Não deu certo. Tente de novo.");
      setOcupado(false);
    }
  }

  function renomear() {
    var n = texto.trim();
    if (!n || !alvoId) return;
    executar(function() { return financeCategoriesApi.atualizar(companyId!, alvoId!, { name: n }); }, function(r) {
      var k = r && r.lancamentos_renomeados ? r.lancamentos_renomeados : 0;
      return k > 0 ? "Nome trocado em " + k + (k === 1 ? " lançamento." : " lançamentos.") : "Nome trocado.";
    });
  }

  function mudarCor(c: string) {
    if (!alvoId) return;
    executar(function() { return financeCategoriesApi.atualizar(companyId!, alvoId!, { color: c }); }, "Cor trocada.");
  }

  function juntar(destino: { id: string; label: string }) {
    if (!alvoId) return;
    executar(function() { return financeCategoriesApi.juntar(companyId!, alvoId!, destino.id); },
      "Juntou com " + destino.label + ". Os lançamentos foram junto.");
  }

  function arquivar(arquivada: boolean) {
    if (!alvoId) return;
    executar(function() { return financeCategoriesApi.atualizar(companyId!, alvoId!, { archived: arquivada }); },
      arquivada ? "Arquivada. Os lançamentos antigos continuam onde estão." : "Voltou para a lista.");
  }

  async function criarSub(cat: CategoriaFinanceira) {
    var n = novaSubNome.trim();
    if (!n) { setNovaSubDe(null); return; }
    setOcupado(true);
    try {
      await criar({ parent_id: cat.id, name: n });
      toast.success("Subcategoria criada.");
      setNovaSubDe(null); setNovaSubNome("");
    } catch (e: any) { toast.error(e?.message || "Não deu para criar a subcategoria."); }
    finally { setOcupado(false); }
  }

  if (consolidatedView) {
    return (
      <View style={[s.screen, s.content]}>
        <Pressable onPress={voltar} style={s.backBtn} accessibilityRole="button"><Icon name="chevron_left" size={14} color={Colors.violet3} /><Text style={s.backText}>Voltar</Text></Pressable>
        <Text style={s.pageTitle}>Categorias</Text>
        <Text style={s.vazio}>As categorias são de cada loja. Escolha uma empresa no seletor para organizar as dela.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={s.screen} contentContainerStyle={[s.content, celular && { padding: 14 }]} testID="categorias-financeiro">
        <View style={s.topo}>
          <Pressable onPress={voltar} style={s.backBtn} accessibilityRole="button" accessibilityLabel="Voltar para o Financeiro" hitSlop={8} testID="categorias-voltar">
            <Icon name="chevron_left" size={14} color={Colors.violet3} />
            {!celular && <Text style={s.backText}>Financeiro ›</Text>}
          </Pressable>
          <Text style={s.pageTitle}>Categorias</Text>
          <View style={{ flex: 1 }} />
          <Pressable testID="categorias-nova" onPress={function() { setNovaAberta(true); }} style={[m.btn, m.btnPri, celular && m.btnSm]} disabled={!lista}>
            <Text style={m.btnPriText}>{celular ? "+ Nova" : "+ Nova categoria"}</Text>
          </Pressable>
        </View>

        <View style={s.tabs}>
          {(["expense", "income"] as const).map(function(k) {
            var on = aba === k;
            return (
              <Pressable key={k} testID={"categorias-aba-" + k} onPress={function() { setAba(k); }} style={[s.tab, on && s.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: on }}>
                <Text style={[s.tabText, on && s.tabTextOn]}>{k === "expense" ? "Despesas" : "Receitas"}</Text>
              </Pressable>
            );
          })}
        </View>

        {carregando && <ActivityIndicator color={Colors.violet3} style={{ marginVertical: 24 }} />}
        {!carregando && (erro || !lista) && (
          <View style={s.hint}>
            <Text style={s.hintText}>Não conseguimos carregar as categorias agora.</Text>
            <Pressable onPress={function() { refetch(); }} style={{ marginTop: 8 }}><Text style={s.link}>Tentar de novo</Text></Pressable>
          </View>
        )}

        {cats.map(function(cat) {
          var arquivada = !!cat.archived_at;
          var temSubs = cat.subcategories.length > 0;
          return (
            <View key={cat.id} style={[s.cat, arquivada && { opacity: 0.6 }]} testID={"categoria-" + cat.name}>
              <View style={s.catH}>
                <View style={[s.dot, { backgroundColor: cat.color || "#a1a1aa" }]} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.catN} numberOfLines={1}>{cat.name}</Text>
                  <Text style={s.catM} numberOfLines={2}>{arquivada ? "Arquivada" : linhaDeBaixo(cat, lista?.ano)}</Text>
                </View>
                {cat.is_system && <Text style={s.lock}>{celular ? "Aura" : "usada pela Aura"}</Text>}
                <Pressable testID={"categoria-menu-" + cat.name} onPress={function() { abrirMenu({ tipo: "categoria", cat: cat }); }} style={s.kebab} hitSlop={8} accessibilityRole="button" accessibilityLabel={"Opções de " + cat.name}>
                  <Text style={s.kebabText}>⋯</Text>
                </Pressable>
              </View>
              {(temSubs || !arquivada) && (
                <View style={[s.subs, celular && { paddingLeft: 14 }]}>
                  {cat.subcategories.map(function(sub) {
                    return (
                      <Pressable key={sub.id} onPress={function() { abrirMenu({ tipo: "sub", cat: cat, sub: sub }); }} style={[m.chip, !!sub.archived_at && { opacity: 0.55 }]} accessibilityLabel={"Opções de " + sub.name}>
                        <Text style={m.chipText}>{sub.name}</Text>
                        {!celular && <Text style={s.n}>{sub.count}</Text>}
                      </Pressable>
                    );
                  })}
                  {temSubs && cat.count_direct > 0 && !celular && (
                    <View style={m.chip}><Text style={[m.chipText, { color: Colors.ink3 }]}>Sem subcategoria</Text><Text style={s.n}>{cat.count_direct}</Text></View>
                  )}
                  {!arquivada && novaSubDe !== cat.id && (
                    <Pressable testID={"categoria-add-sub-" + cat.name} onPress={function() { setNovaSubDe(cat.id); setNovaSubNome(""); }} style={[m.chip, m.chipAdd]}>
                      <Text style={[m.chipText, m.chipAddText]}>{celular ? "+ sub" : "+ subcategoria"}</Text>
                    </Pressable>
                  )}
                </View>
              )}
              {novaSubDe === cat.id && (
                <View style={[m.inlineNew, { paddingHorizontal: 14, paddingBottom: 12, marginTop: 0 }]}>
                  <TextInput testID="categoria-sub-input" style={[m.input, { flex: 1, paddingVertical: 8 }]} value={novaSubNome} onChangeText={setNovaSubNome} onSubmitEditing={function() { criarSub(cat); }} placeholder="Nome da subcategoria" placeholderTextColor={Colors.ink3} maxLength={60} autoFocus />
                  <Pressable onPress={function() { criarSub(cat); }} disabled={ocupado} style={[m.btn, m.btnPri, m.btnSm]}><Text style={m.btnPriText}>Criar</Text></Pressable>
                  <Pressable onPress={function() { setNovaSubDe(null); }} style={[m.btn, m.btnSm]}><Text style={m.btnText}>✕</Text></Pressable>
                </View>
              )}
            </View>
          );
        })}

        {lista && (
          <>
            <View style={s.hint}>
              <Text style={s.hintText}>
                No menu ⋯: <Text style={s.b}>Renomear</Text>, <Text style={s.b}>Mudar cor</Text>, <Text style={s.b}>Juntar com outra</Text> (move os lançamentos) e <Text style={s.b}>Arquivar</Text> (some da escolha, os lançamentos antigos ficam onde estão). Nada é apagado.
              </Text>
            </View>
            <Pressable onPress={function() { setVerArquivadas(!verArquivadas); }} style={{ marginTop: 12, alignSelf: "flex-start" }} testID="categorias-ver-arquivadas">
              <Text style={s.link}>{verArquivadas ? "Esconder as arquivadas" : "Ver as arquivadas"}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      <WebPortal active={novaAberta}>
        <NovaCategoriaModal
          visible={novaAberta}
          kind={aba}
          lojas={lista?.lojas || 1}
          podeTodasAsLojas={!!lista?.pode_todas_as_lojas}
          linhasDoDre={(lista?.dre_lines || ({} as any))[aba] || []}
          onClose={function() { setNovaAberta(false); }}
          onCreate={async function(body) {
            var r = await criar(body);
            var outras = (r.criadas_em || []).length - 1;
            toast.success(outras > 0 ? "Categoria criada nesta loja e em mais " + outras + "." : "Categoria criada.");
            return r;
          }}
        />
      </WebPortal>

      <WebPortal active={!!alvo && acao !== null && acao !== "arquivar"}>
        <View style={m.overlay} testID="categoria-folha">
          <Pressable style={m.backdrop} onPress={fechar} accessibilityLabel="Fechar" />
          <View style={m.modal}>
            <View style={m.header}>
              <Text style={m.title} numberOfLines={1}>{alvo && alvo.tipo === "sub" ? alvo.cat.name + " › " + alvoNome : alvoNome}</Text>
              <Pressable onPress={fechar} style={m.closeBtn} hitSlop={8}><Text style={m.closeText}>✕</Text></Pressable>
            </View>

            {acao === "menu" && (
              <View style={{ gap: 8, marginTop: 8 }}>
                {alvoSistema && <Text style={s.catM}>Usada pela Aura: o Caixa, o Crediário e o resultado do período contam com este nome. Dá para mudar a cor e criar subcategorias.</Text>}
                {!alvoSistema && !alvoArquivado && <MenuItem testID="menu-renomear" label="Renomear" onPress={function() { setTexto(alvoNome); setAcao("renomear"); }} />}
                {alvo && alvo.tipo === "categoria" && !alvoArquivado && <MenuItem testID="menu-cor" label="Mudar cor" onPress={function() { setAcao("cor"); }} />}
                {!alvoSistema && !alvoArquivado && <MenuItem testID="menu-juntar" label="Juntar com outra" onPress={function() { setAcao("juntar"); }} />}
                {!alvoSistema && !alvoArquivado && <MenuItem testID="menu-arquivar" label="Arquivar" destrutivo onPress={function() { setAcao("arquivar"); }} />}
                {alvoArquivado && <MenuItem testID="menu-desarquivar" label="Voltar para a lista" onPress={function() { arquivar(false); }} />}
              </View>
            )}

            {acao === "renomear" && (
              <View>
                <Text style={m.label}>Nome novo</Text>
                <TextInput testID="renomear-input" style={m.input} value={texto} onChangeText={setTexto} maxLength={60} autoFocus onSubmitEditing={renomear} />
                {alvo && alvo.tipo === "categoria" && <Text style={[s.catM, { marginTop: 8 }]}>Os lançamentos antigos desta categoria passam a mostrar o nome novo.</Text>}
                <View style={m.footer}>
                  <Pressable onPress={fechar} style={m.btn}><Text style={m.btnText}>Cancelar</Text></Pressable>
                  <Pressable testID="renomear-salvar" onPress={renomear} disabled={ocupado} style={[m.btn, m.btnPri]}><Text style={m.btnPriText}>Salvar</Text></Pressable>
                </View>
              </View>
            )}

            {acao === "cor" && (
              <View style={[m.grid, { marginTop: 12 }]}>
                {CORES_DE_CATEGORIA.concat(["#64748b", "#a1a1aa"]).map(function(c) {
                  return <Pressable key={c} onPress={function() { mudarCor(c); }} style={[m.cor, { backgroundColor: c }]} accessibilityLabel={"Cor " + c} />;
                })}
              </View>
            )}

            {acao === "juntar" && alvo && (
              <ScrollView style={{ maxHeight: 360, marginTop: 8 }}>
                <Text style={[s.catM, { marginBottom: 8 }]}>Os lançamentos de “{alvoNome}” vão para a categoria escolhida, e “{alvoNome}” é arquivada.</Text>
                {destinosDaJuncao(lista, { id: alvoId!, kind: alvo.cat.kind, parent_id: alvo.tipo === "sub" ? alvo.cat.id : null }).map(function(d) {
                  return <MenuItem key={d.id} label={d.label} onPress={function() { juntar(d); }} />;
                })}
              </ScrollView>
            )}
            {ocupado && <ActivityIndicator color={Colors.violet3} style={{ marginTop: 10 }} />}
          </View>
        </View>
      </WebPortal>

      <WebPortal active={acao === "arquivar"}>
        <ConfirmDialog
          visible={acao === "arquivar"}
          title={"Arquivar “" + alvoNome + "”?"}
          message="Ela some da escolha nos lançamentos novos. Os lançamentos antigos continuam onde estão e nada é apagado."
          confirmLabel="Arquivar"
          onConfirm={function() { arquivar(true); }}
          onCancel={fechar}
        />
      </WebPortal>
    </View>
  );
}

function MenuItem({ label, onPress, destrutivo, testID }: { label: string; onPress: () => void; destrutivo?: boolean; testID?: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} style={s.menuItem} accessibilityRole="button">
      <Text style={[s.menuText, destrutivo && { color: Colors.red }]}>{label}</Text>
    </Pressable>
  );
}

var s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 20, paddingBottom: 56, maxWidth: 900, alignSelf: "center", width: "100%" },
  topo: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 36 },
  backText: { fontSize: 13, color: Colors.ink3, fontWeight: "600" },
  pageTitle: { fontSize: 20, fontWeight: "800", color: Colors.ink, letterSpacing: -0.3 },
  vazio: { fontSize: 13, color: Colors.ink3, marginTop: 10, lineHeight: 19 },
  tabs: { flexDirection: "row", gap: 6, marginBottom: 14 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg3, minHeight: 36, justifyContent: "center" },
  tabOn: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  tabText: { fontSize: 13, fontWeight: "600", color: Colors.ink2 },
  tabTextOn: { color: "#fff" },
  cat: { borderWidth: 1, borderColor: Colors.border, borderRadius: 12, marginBottom: 10, backgroundColor: Colors.bg3, width: "100%" },
  catH: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  catN: { fontWeight: "700", fontSize: 14.5, color: Colors.ink },
  catM: { color: Colors.ink3, fontSize: 12, lineHeight: 17 },
  lock: { fontSize: 11, fontWeight: "700", color: Colors.ink3, backgroundColor: Colors.bg4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, overflow: "hidden" },
  kebab: { minWidth: 36, minHeight: 36, alignItems: "center", justifyContent: "center" },
  kebabText: { color: Colors.ink3, fontSize: 18, fontWeight: "700" },
  subs: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingRight: 14, paddingBottom: 12, paddingLeft: 34 },
  n: { color: Colors.ink3, fontSize: 11 },
  hint: { backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 12, marginTop: 4 },
  hintText: { color: Colors.ink2, fontSize: 12.5, lineHeight: 18 },
  b: { fontWeight: "700" },
  link: { color: Colors.violet3, fontWeight: "700", fontSize: 12.5 },
  menuItem: { paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg2, marginBottom: 6, minHeight: 44, justifyContent: "center" },
  menuText: { fontSize: 14, fontWeight: "600", color: Colors.ink },
});
