// ============================================================
// AURA. — Comandas do Caixa: os dois modais (09/10/2026)
//
//   · AdicionarAComandaModal — o carrinho vai para a comanda N. O operador
//     digita o número (ou toca numa das abertas) e confirma.
//   · FecharComandaModal — digita o número, vê o consumo listado e somado,
//     decide se entra a taxa de serviço de 10%, imprime a conferência e
//     manda cobrar no Caixa.
//
// Nenhum dos dois faz conta: número, taxa e cupom vêm de utils/comanda.
// A venda em si é a de sempre — o modal só devolve a comanda para o Caixa
// carregar no carrinho (hooks/useComandaNoCaixa).
// ============================================================
import { useEffect, useRef, useState } from "react";
import { Modal, View, Text, StyleSheet, Pressable, TextInput, Platform, ScrollView, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { comandaApi, type ComandaResumo } from "@/services/comandaApi";
import { textoDoErro } from "@/components/screens/pdv/erroNoCaixa";
import {
  numeroDaComanda, taxaDeServico, htmlDoConsumo, TAXA_DE_SERVICO_PCT, type Comanda,
} from "@/utils/comanda";

function fmt(v: number): string {
  return "R$ " + (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtQtd(n: number): string {
  return String(Math.round((Number(n) || 0) * 1000) / 1000).replace(".", ",");
}

/** Chave do react-query das comandas abertas. */
export function chaveDasComandas(companyId: string) {
  return ["comandas-abertas", companyId] as const;
}

function useAbertas(companyId: string, visible: boolean) {
  return useQuery({
    queryKey: chaveDasComandas(companyId),
    queryFn: () => comandaApi.listOpen(companyId),
    enabled: visible && !!companyId,
    staleTime: 0,
  });
}

function focar(ref: React.RefObject<TextInput | null>) {
  return setTimeout(function () {
    try { (ref.current as any)?.focus?.(); } catch {}
  }, 60);
}

function Abertas(props: { lista: ComandaResumo[]; onPick: (n: number) => void; ativa: number | null }) {
  if (props.lista.length === 0) return null;
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={s.label}>Comandas abertas</Text>
      <View style={s.chips}>
        {props.lista.map(function (c) {
          const on = props.ativa === c.number;
          return (
            <Pressable
              key={c.id}
              testID={"comanda-aberta-" + c.number}
              onPress={function () { props.onPick(c.number); }}
              style={[s.chip, on && s.chipOn]}
            >
              <Text style={[s.chipNum, on && { color: "#fff" }]}>{c.number}</Text>
              <Text style={[s.chipVal, on && { color: "rgba(255,255,255,0.85)" }]}>{fmt(c.subtotal)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ── Adicionar à comanda ──────────────────────────────────────

type AdicionarProps = {
  visible: boolean;
  companyId: string;
  /** Quantas linhas e quanto vale o que está no carrinho. */
  itemCount: number;
  total: number;
  saving: boolean;
  onClose: () => void;
  onConfirm: (number: number) => void;
};

export function AdicionarAComandaModal(props: AdicionarProps) {
  const { visible, companyId, itemCount, total, saving, onClose, onConfirm } = props;
  const [texto, setTexto] = useState("");
  const inputRef = useRef<TextInput>(null);
  const abertas = useAbertas(companyId, visible);
  const lista = abertas.data?.comandas || [];

  useEffect(function () {
    if (!visible) return;
    setTexto("");
    const t = focar(inputRef);
    return function () { clearTimeout(t); };
  }, [visible]);

  const numero = numeroDaComanda(texto);
  const jaAberta = numero != null ? lista.find(function (c) { return c.number === numero; }) : undefined;
  const pronto = numero != null && !saving;

  function confirmar() {
    if (numero == null || saving) return;
    onConfirm(numero);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.modal} testID="modal-adicionar-comanda">
          <View style={s.header}>
            <View style={s.headerIcon}><Icon name="clipboard" size={18} color={Colors.violet3} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Adicionar à comanda</Text>
              <Text style={s.sub}>
                {itemCount} {itemCount === 1 ? "item" : "itens"} · {fmt(total)}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}><Icon name="x" size={18} color={Colors.ink3} /></Pressable>
          </View>

          <ScrollView style={s.body} contentContainerStyle={s.bodyContent} keyboardShouldPersistTaps="handled">
            <Text style={s.label}>Número da comanda</Text>
            <TextInput
              ref={inputRef}
              testID="comanda-numero"
              value={texto}
              onChangeText={function (v) { setTexto(v.replace(/\D/g, "").slice(0, 4)); }}
              onSubmitEditing={confirmar}
              keyboardType={Platform.OS === "web" ? "default" : "number-pad"}
              inputMode="numeric"
              placeholder="Ex.: 12"
              placeholderTextColor={Colors.ink3}
              style={s.input}
            />
            {numero != null && (
              <Text style={s.hint}>
                {jaAberta
                  ? "A comanda " + numero + " já tem " + fmt(jaAberta.subtotal) + ". Estes itens somam a ela."
                  : "A comanda " + numero + " será aberta com estes itens."}
              </Text>
            )}
            <Abertas lista={lista} ativa={numero} onPick={function (n) { setTexto(String(n)); }} />
          </ScrollView>

          <View style={s.actions}>
            <Pressable onPress={onClose} style={s.btnSec}><Text style={s.btnSecTxt}>Cancelar</Text></Pressable>
            <Pressable
              testID="comanda-lancar"
              onPress={confirmar}
              disabled={!pronto}
              style={[s.btnPri, !pronto && s.btnPriOff]}
            >
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={[s.btnPriTxt, !pronto && { color: "rgba(255,255,255,0.55)" }]}>
                    {numero != null ? "Lançar na comanda " + numero : "Lançar na comanda"}
                  </Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Fechar comanda ───────────────────────────────────────────

type FecharProps = {
  visible: boolean;
  companyId: string;
  /** Nome da loja no topo do cupom de conferência. */
  loja: string;
  onClose: () => void;
  /** Leva o consumo para o carrinho do Caixa. `taxaPct` é 0 ou 10. */
  onCobrar: (comanda: Comanda, taxaPct: number) => void;
  /** Avisa o Caixa que a lista de abertas mudou (item tirado, cancelada). */
  onMudou?: () => void;
};

export function FecharComandaModal(props: FecharProps) {
  const { visible, companyId, loja, onClose, onCobrar, onMudou } = props;
  const [texto, setTexto] = useState("");
  const [comanda, setComanda] = useState<Comanda | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [comTaxa, setComTaxa] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [confirmaCancelar, setConfirmaCancelar] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const abertas = useAbertas(companyId, visible);
  const lista = abertas.data?.comandas || [];
  // Só a última busca vale: o operador pode digitar outro número antes de a
  // primeira voltar.
  const buscaRef = useRef(0);

  useEffect(function () {
    if (!visible) return;
    setTexto(""); setComanda(null); setErro(null); setComTaxa(false); setConfirmaCancelar(false);
    const t = focar(inputRef);
    return function () { clearTimeout(t); };
  }, [visible]);

  function buscar(n: number | null) {
    if (n == null) { setErro("Digite o número da comanda."); return; }
    const vez = ++buscaRef.current;
    setBuscando(true); setErro(null); setComanda(null); setConfirmaCancelar(false);
    comandaApi.get(companyId, n)
      .then(function (r) {
        if (vez !== buscaRef.current) return;
        setComanda(r.comanda);
      })
      .catch(function (e: any) {
        if (vez !== buscaRef.current) return;
        const code = e?.data?.code;
        setErro(code === "COMANDA_NOT_FOUND" || e?.status === 404
          ? "Não há comanda " + n + " aberta."
          : textoDoErro(e, "Não deu para buscar a comanda. Tente de novo."));
      })
      .finally(function () { if (vez === buscaRef.current) setBuscando(false); });
  }

  function tirar(itemId: string) {
    if (!comanda || ocupado) return;
    setOcupado(true);
    comandaApi.removeItem(companyId, comanda.number, itemId)
      .then(function (r) { setComanda(r.comanda); abertas.refetch(); onMudou?.(); })
      .catch(function (e: any) { toast.error(textoDoErro(e, "Não deu para tirar o item.")); })
      .finally(function () { setOcupado(false); });
  }

  function cancelarComanda() {
    if (!comanda || ocupado) return;
    if (!confirmaCancelar) { setConfirmaCancelar(true); return; }
    setOcupado(true);
    const n = comanda.number;
    comandaApi.cancel(companyId, n)
      .then(function () {
        toast.success("Comanda " + n + " cancelada");
        setComanda(null); setTexto(""); setConfirmaCancelar(false);
        abertas.refetch(); onMudou?.();
      })
      .catch(function (e: any) { toast.error(textoDoErro(e, "Não deu para cancelar a comanda.")); })
      .finally(function () { setOcupado(false); });
  }

  const taxaPct = comTaxa ? TAXA_DE_SERVICO_PCT : 0;
  const taxa = comanda ? taxaDeServico(comanda.subtotal, taxaPct) : 0;
  const totalFinal = comanda ? Math.round((comanda.subtotal + taxa) * 100) / 100 : 0;
  const temConsumo = !!comanda && comanda.items.length > 0;

  function imprimir() {
    if (!comanda) return;
    const html = htmlDoConsumo({ comanda: comanda, loja: loja, taxaPct: taxaPct });
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const win = window.open("", "_blank");
      if (!win) {
        toast.error("O navegador bloqueou a janela de impressão. Permita janelas novas para este site.");
        return;
      }
      win.document.write(html);
      win.document.close();
      return;
    }
    toast.info("A impressão do consumo funciona no navegador do computador.");
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.modal} testID="modal-fechar-comanda">
          <View style={s.header}>
            <View style={s.headerIcon}><Icon name="clipboard" size={18} color={Colors.violet3} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Fechar comanda</Text>
              <Text style={s.sub}>Digite o número para ver o consumo</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}><Icon name="x" size={18} color={Colors.ink3} /></Pressable>
          </View>

          <ScrollView style={s.body} contentContainerStyle={s.bodyContent} keyboardShouldPersistTaps="handled">
            <Text style={s.label}>Número da comanda</Text>
            <View style={s.buscaRow}>
              <TextInput
                ref={inputRef}
                testID="fechar-comanda-numero"
                value={texto}
                onChangeText={function (v) { setTexto(v.replace(/\D/g, "").slice(0, 4)); }}
                onSubmitEditing={function () { buscar(numeroDaComanda(texto)); }}
                keyboardType={Platform.OS === "web" ? "default" : "number-pad"}
                inputMode="numeric"
                placeholder="Ex.: 12"
                placeholderTextColor={Colors.ink3}
                style={[s.input, { flex: 1 }]}
              />
              <Pressable
                testID="fechar-comanda-buscar"
                onPress={function () { buscar(numeroDaComanda(texto)); }}
                style={s.buscaBtn}
              >
                {buscando ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.btnPriTxt}>Buscar</Text>}
              </Pressable>
            </View>
            {erro && <Text style={s.erro} testID="fechar-comanda-erro">{erro}</Text>}

            {!comanda && (
              <Abertas
                lista={lista}
                ativa={null}
                onPick={function (n) { setTexto(String(n)); buscar(n); }}
              />
            )}
            {!comanda && !buscando && !abertas.isLoading && lista.length === 0 && !erro && (
              <Text style={s.hint}>Nenhuma comanda aberta agora.</Text>
            )}

            {comanda && (
              <View style={{ marginTop: 14 }} testID="fechar-comanda-consumo">
                <Text style={s.label}>Consumo da comanda {comanda.number}</Text>
                {comanda.items.length === 0 && <Text style={s.hint}>Esta comanda está sem itens.</Text>}
                {comanda.items.map(function (it) {
                  return (
                    <View key={it.id} style={s.linha}>
                      <Text style={s.linhaQtd}>{fmtQtd(it.quantity)}x</Text>
                      <Text style={s.linhaNome} numberOfLines={2}>{it.name}</Text>
                      <Text style={s.linhaVal}>{fmt(it.total)}</Text>
                      <Pressable
                        onPress={function () { tirar(it.id); }}
                        disabled={ocupado}
                        hitSlop={8}
                        style={s.linhaX}
                        accessibilityLabel={"Tirar " + it.name + " da comanda"}
                      >
                        <Icon name="x" size={13} color={Colors.ink3} />
                      </Pressable>
                    </View>
                  );
                })}

                <View style={s.resumo}>
                  <View style={s.resumoRow}>
                    <Text style={s.resumoLbl}>Consumo</Text>
                    <Text style={s.resumoVal}>{fmt(comanda.subtotal)}</Text>
                  </View>
                  <Pressable
                    testID="fechar-comanda-taxa"
                    onPress={function () { setComTaxa(!comTaxa); }}
                    style={s.resumoRow}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: comTaxa }}
                  >
                    <View style={s.taxaLbl}>
                      <View style={[s.check, comTaxa && s.checkOn]}>
                        {comTaxa && <Icon name="check" size={11} color="#fff" />}
                      </View>
                      <Text style={s.resumoLbl}>Taxa de serviço ({TAXA_DE_SERVICO_PCT}%)</Text>
                    </View>
                    <Text style={s.resumoVal}>{comTaxa ? fmt(taxa) : "—"}</Text>
                  </Pressable>
                  <View style={[s.resumoRow, s.totalRow]}>
                    <Text style={s.totalLbl}>Total</Text>
                    <Text style={s.totalVal} testID="fechar-comanda-total">{fmt(totalFinal)}</Text>
                  </View>
                </View>

                <View style={s.secundarias}>
                  <Pressable testID="fechar-comanda-imprimir" onPress={imprimir} disabled={!temConsumo} style={[s.ghost, !temConsumo && { opacity: 0.5 }]}>
                    <Icon name="file_text" size={13} color={Colors.ink} />
                    <Text style={s.ghostTxt}>Imprimir consumo</Text>
                  </Pressable>
                  <Pressable testID="fechar-comanda-cancelar" onPress={cancelarComanda} disabled={ocupado} style={s.ghost}>
                    <Text style={[s.ghostTxt, { color: Colors.red }]}>
                      {confirmaCancelar ? "Toque de novo para cancelar" : "Cancelar comanda"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </ScrollView>

          <View style={s.actions}>
            <Pressable onPress={onClose} style={s.btnSec}><Text style={s.btnSecTxt}>Voltar</Text></Pressable>
            <Pressable
              testID="fechar-comanda-cobrar"
              onPress={function () { if (comanda && temConsumo) onCobrar(comanda, taxaPct); }}
              disabled={!temConsumo}
              style={[s.btnPri, !temConsumo && s.btnPriOff]}
            >
              <Text style={[s.btnPriTxt, !temConsumo && { color: "rgba(255,255,255,0.55)" }]}>
                {temConsumo ? "Cobrar " + fmt(totalFinal) : "Cobrar no Caixa"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center", padding: 16 },
  // Mesma estrutura do CashChangeModal: cabeçalho e ações fixos, miolo rola
  // (botão de confirmar nunca some em monitor baixo).
  modal: {
    width: "100%", maxWidth: 480, maxHeight: "92vh" as any,
    backgroundColor: Colors.bg2, borderRadius: 20, borderWidth: 1, borderColor: Colors.border2,
    display: "flex" as any, flexDirection: "column" as any, overflow: "hidden" as any,
  },
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 15, fontWeight: "600", color: Colors.ink },
  sub: { fontSize: 11.5, color: Colors.ink3, marginTop: 2 },
  body: { flexShrink: 1, flexGrow: 0 },
  bodyContent: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 14 },
  label: { fontSize: 11, color: Colors.ink3, marginBottom: 6, fontWeight: "600" },
  input: {
    paddingVertical: 12, paddingHorizontal: 16, backgroundColor: Colors.bg, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border2, color: Colors.ink, fontSize: 22, fontWeight: "600",
  },
  hint: { fontSize: 12, color: Colors.ink2, marginTop: 8 },
  erro: { fontSize: 12, color: Colors.red, marginTop: 8, fontWeight: "600" },
  buscaRow: { flexDirection: "row", gap: 8, alignItems: "stretch" },
  buscaBtn: { minWidth: 92, borderRadius: 12, backgroundColor: Colors.violet, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minWidth: 76, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, alignItems: "center",
    backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border,
  },
  chipOn: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  chipNum: { fontSize: 15, fontWeight: "700", color: Colors.ink },
  chipVal: { fontSize: 10.5, color: Colors.ink3, marginTop: 1 },
  linha: {
    flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  linhaQtd: { fontSize: 12.5, color: Colors.ink2, fontWeight: "700", minWidth: 34 },
  linhaNome: { flex: 1, fontSize: 13, color: Colors.ink },
  linhaVal: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  linhaX: { width: 24, height: 24, borderRadius: 6, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg4 },
  resumo: { marginTop: 10, gap: 2 },
  resumoRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 7 },
  resumoLbl: { fontSize: 13, color: Colors.ink2 },
  resumoVal: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  taxaLbl: { flexDirection: "row", alignItems: "center", gap: 8 },
  check: { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: Colors.border2, alignItems: "center", justifyContent: "center" },
  checkOn: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  totalRow: { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 4, paddingTop: 10 },
  totalLbl: { fontSize: 14, color: Colors.ink, fontWeight: "700" },
  totalVal: { fontSize: 20, color: Colors.ink, fontWeight: "700" },
  secundarias: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  ghost: {
    flexGrow: 1, flexBasis: 150, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center",
    height: 36, borderRadius: 9, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border,
  },
  ghostTxt: { fontSize: 12, color: Colors.ink, fontWeight: "600" },
  actions: {
    flexDirection: "row", gap: 10, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 16,
    borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.bg2,
  },
  btnSec: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border2, alignItems: "center" },
  btnSecTxt: { fontSize: 13, fontWeight: "500", color: Colors.ink },
  btnPri: { flex: 1.4, paddingVertical: 12, borderRadius: 10, backgroundColor: Colors.violet, alignItems: "center", justifyContent: "center" },
  btnPriOff: { backgroundColor: Colors.violetD },
  btnPriTxt: { fontSize: 13, fontWeight: "600", color: "#fff" },
});
