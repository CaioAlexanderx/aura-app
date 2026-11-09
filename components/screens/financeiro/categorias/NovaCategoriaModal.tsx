// ============================================================
// AURA. — "Nova categoria" do Financeiro (mockup, seção B) — 09/11/2026
//
// Só o nome é obrigatório. Subcategorias opcionais, cor, "Só nesta loja" /
// "Em todas as minhas lojas (N)" para quem tem mais de um CNPJ, e "Onde entra
// no DRE" escondido em "Mais opções", já com a sugestão do backend (despesa
// nova entra como despesa variável).
// ============================================================
import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, ActivityIndicator, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { toast } from "@/components/Toast";
import { CORES_DE_CATEGORIA, normalizarCategoria } from "@/utils/categoriasFinanceiro";
import type { KindDaCategoria, LinhaDoDre, NovaCategoria } from "@/services/financeCategoriesApi";

var DRE_SUGERIDA: Record<KindDaCategoria, string> = { income: "outras_receitas", expense: "despesas_variaveis" };

type Props = {
  visible: boolean;
  kind: KindDaCategoria;
  lojas: number;
  podeTodasAsLojas: boolean;
  linhasDoDre: LinhaDoDre[];
  onClose: () => void;
  onCreate: (body: NovaCategoria) => Promise<any>;
};

export function NovaCategoriaModal({ visible, kind, lojas, podeTodasAsLojas, linhasDoDre, onClose, onCreate }: Props) {
  var [nome, setNome] = useState("");
  var [subs, setSubs] = useState<string[]>([]);
  var [novaSub, setNovaSub] = useState("");
  var [addSub, setAddSub] = useState(false);
  var [cor, setCor] = useState(CORES_DE_CATEGORIA[0]);
  var [todas, setTodas] = useState(false);
  var [maisOpcoes, setMaisOpcoes] = useState(false);
  var [dre, setDre] = useState(DRE_SUGERIDA[kind]);
  var [salvando, setSalvando] = useState(false);

  useEffect(function() {
    if (!visible) return;
    setNome(""); setSubs([]); setNovaSub(""); setAddSub(false); setCor(CORES_DE_CATEGORIA[0]);
    setTodas(false); setMaisOpcoes(false); setDre(DRE_SUGERIDA[kind]); setSalvando(false);
  }, [visible, kind]);

  if (!visible) return null;

  var rotuloDre = (linhasDoDre.find(function(l) { return l.key === dre; }) || { label: "" }).label;
  var titulo = kind === "expense" ? "Nova categoria de despesa" : "Nova categoria de receita";

  function incluirSub() {
    var n = novaSub.trim().replace(/\s+/g, " ");
    if (!n) { setAddSub(false); return; }
    if (subs.some(function(s) { return normalizarCategoria(s) === normalizarCategoria(n); })) { setNovaSub(""); return; }
    setSubs(subs.concat([n])); setNovaSub("");
  }

  async function criar() {
    var n = nome.trim();
    if (!n) { toast.error("Dê um nome para a categoria."); return; }
    var pendente = novaSub.trim();
    var lista = pendente && !subs.some(function(s) { return normalizarCategoria(s) === normalizarCategoria(pendente); }) ? subs.concat([pendente]) : subs;
    setSalvando(true);
    try {
      await onCreate({ kind: kind, name: n, color: cor, dre_line: dre, subcategories: lista, todas_as_lojas: podeTodasAsLojas && todas });
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Não deu para criar a categoria.");
    } finally { setSalvando(false); }
  }

  return (
    <View style={s.overlay} testID="nova-categoria-modal">
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Fechar" />
      <View style={s.modal}>
        <View style={s.header}>
          <Text style={s.title}>{titulo}</Text>
          <Pressable onPress={onClose} style={s.closeBtn} hitSlop={8} accessibilityLabel="Fechar"><Text style={s.closeText}>✕</Text></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: 4 }} keyboardShouldPersistTaps="handled">
          <Text style={s.label}>Nome</Text>
          <TextInput testID="nova-categoria-nome" style={s.input} value={nome} onChangeText={setNome} placeholder={kind === "expense" ? "Ex.: Veículo" : "Ex.: Aluguel de espaço"} placeholderTextColor={Colors.ink3} maxLength={60} autoFocus={Platform.OS === "web"} />

          <Text style={s.label}>Subcategorias (opcional)</Text>
          <View style={s.grid}>
            {subs.map(function(sub) {
              return (
                <Pressable key={sub} onPress={function() { setSubs(subs.filter(function(x) { return x !== sub; })); }} style={s.chip} accessibilityLabel={"Tirar " + sub}>
                  <Text style={s.chipText}>{sub} ✕</Text>
                </Pressable>
              );
            })}
            {!addSub && (
              <Pressable testID="nova-categoria-add-sub" onPress={function() { setAddSub(true); }} style={[s.chip, s.chipAdd]}>
                <Text style={[s.chipText, s.chipAddText]}>+ adicionar</Text>
              </Pressable>
            )}
          </View>
          {addSub && (
            <View style={s.inlineNew}>
              <TextInput testID="nova-categoria-sub-input" style={[s.input, { flex: 1, paddingVertical: 8 }]} value={novaSub} onChangeText={setNovaSub} onSubmitEditing={incluirSub} placeholder="Ex.: Combustível" placeholderTextColor={Colors.ink3} maxLength={60} autoFocus />
              <Pressable onPress={incluirSub} style={[s.btn, s.btnPri, s.btnSm]}><Text style={s.btnPriText}>Incluir</Text></Pressable>
            </View>
          )}

          <Text style={s.label}>Cor</Text>
          <View style={s.grid}>
            {CORES_DE_CATEGORIA.map(function(c) {
              var on = c === cor;
              return (
                <Pressable key={c} onPress={function() { setCor(c); }} accessibilityLabel={"Cor " + c} accessibilityState={{ selected: on }}
                  style={[s.cor, { backgroundColor: c }, on && { borderColor: c, borderWidth: 2 }]}>
                  {on ? <View style={s.corMiolo} /> : null}
                </Pressable>
              );
            })}
          </View>

          {podeTodasAsLojas && lojas > 1 && (
            <>
              <Text style={s.label}>Lojas</Text>
              <View style={s.grid}>
                <Pressable onPress={function() { setTodas(false); }} style={[s.chip, !todas && s.chipOn]}><Text style={[s.chipText, !todas && s.chipOnText]}>Só nesta loja</Text></Pressable>
                <Pressable testID="nova-categoria-todas" onPress={function() { setTodas(true); }} style={[s.chip, todas && s.chipOn]}><Text style={[s.chipText, todas && s.chipOnText]}>Em todas as minhas lojas ({lojas})</Text></Pressable>
              </View>
            </>
          )}

          <Pressable onPress={function() { setMaisOpcoes(!maisOpcoes); }} style={{ marginTop: 14 }} accessibilityRole="button">
            <Text style={[s.label, { color: Colors.violet3, marginTop: 0 }]}>{maisOpcoes ? "▾" : "▸"} Mais opções · Onde entra no DRE: {rotuloDre}</Text>
          </Pressable>
          {maisOpcoes && (
            <View style={[s.grid, { marginTop: 6 }]}>
              {linhasDoDre.filter(function(l) { return l.key !== "deducoes"; }).map(function(l) {
                var on = l.key === dre;
                return <Pressable key={l.key} onPress={function() { setDre(l.key); }} style={[s.chip, on && s.chipOn]}><Text style={[s.chipText, on && s.chipOnText]}>{l.label}</Text></Pressable>;
              })}
            </View>
          )}
        </ScrollView>
        <View style={s.footer}>
          <Pressable onPress={onClose} style={s.btn}><Text style={s.btnText}>Cancelar</Text></Pressable>
          <Pressable testID="nova-categoria-criar" onPress={criar} disabled={salvando} style={[s.btn, s.btnPri, salvando && { opacity: 0.6 }]}>
            {salvando ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.btnPriText}>Criar categoria</Text>}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export var estilosDeCategoria = StyleSheet.create({
  overlay: { position: (Platform.OS === "web" ? "fixed" : "absolute") as any, top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center", zIndex: 120, padding: 12 },
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(24,23,43,0.45)" },
  modal: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, width: "100%", maxWidth: 520, maxHeight: "92%", borderWidth: 1, borderColor: Colors.border2 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  title: { fontSize: 17, fontWeight: "800", color: Colors.ink, flex: 1 },
  closeBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  closeText: { fontSize: 14, color: Colors.ink3, fontWeight: "700" },
  label: { fontSize: 11.5, fontWeight: "700", letterSpacing: 0.6, color: Colors.ink3, textTransform: "uppercase", marginTop: 14, marginBottom: 7 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: Colors.bg2, color: Colors.ink, fontSize: 14 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 99, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg2 },
  chipText: { fontSize: 12.5, color: Colors.ink2 },
  chipOn: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  chipOnText: { color: "#fff", fontWeight: "600" },
  chipAdd: { borderStyle: "dashed", backgroundColor: "transparent" },
  chipAddText: { color: Colors.violet3, fontWeight: "700" },
  inlineNew: { flexDirection: "row", gap: 6, marginTop: 8, alignItems: "center" },
  cor: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "transparent" },
  corMiolo: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#fff" },
  footer: { flexDirection: "row", gap: 8, justifyContent: "flex-end", marginTop: 16 },
  btn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg3, minHeight: 40, alignItems: "center", justifyContent: "center" },
  btnText: { fontSize: 13, fontWeight: "700", color: Colors.violet3 },
  btnPri: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  btnPriText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  btnSm: { paddingHorizontal: 10, paddingVertical: 7, minHeight: 34 },
});
var s = estilosDeCategoria;
