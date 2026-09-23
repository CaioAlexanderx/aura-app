// ============================================================
// AURA. — Matcon: "Emitir NF-e" a partir da entrega (M2 — fiscal do Simples)
//
// 22/09/2026. Mockup aprovado: docs/mockups/matcon-m2-fiscal.html#nfe.
// A nota nasce da entrega: destinatário, itens e peso já vêm preenchidos
// (regra 4 do CLAUDE.md — mockup validado antes deste código). Segue o
// padrão de folha do ResponsiveSheet, igual à "Entrega parcial" de
// app/(tabs)/matcon/entregas.tsx.
//
// Montado SÓ quando há uma entrega selecionada (entregas.tsx faz
// `{emitirDe && <EmitirNfeEntregaSheet ... />}`), de propósito: este
// componente chama useProducts() (que usa useMutation internamente) e
// isso não pode rodar em toda renderização da esteira — só quando o
// vendedor realmente tocou em "Emitir NF-e".
//
// Zero jargão (regra do CONTRACT_MATCON §M2): nada de CSOSN/CST/ST/CFOP
// na tela. "Modalidade do frete" é a frase "Entrego com meu caminhão".
//
// Casamento item×produto por NOME, não product_id — deliveries.items[]
// não carrega isso (ver nota em components/matcon/nfeEntregaUtil.ts).
// ============================================================
import { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, Switch, ActivityIndicator, ScrollView, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { ResponsiveSheet } from "@/components/ResponsiveSheet";
import { useProducts } from "@/hooks/useProducts";
import { nfceApi } from "@/services/nfceApi";
import type { Delivery } from "@/services/matconApi";
import {
  formInicialNfeEntrega, itensSemCest, montarEmitBody, type NfeEntregaForm,
} from "@/components/matcon/nfeEntregaUtil";
import { textoDoErro } from "@/components/matcon/erroMatcon";

const fmtMoney = (n: number | string | null | undefined) =>
  `R$ ${Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function hojeCurto(): string {
  return new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function EmitirNfeEntregaSheet({ delivery, companyId, onClose }: {
  delivery: Delivery;
  companyId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { products, isLoading: carregandoProdutos } = useProducts();

  const [form, setForm] = useState<NfeEntregaForm>(() => formInicialNfeEntrega(delivery, []));
  const pesoTocado = useRef(false);
  const pesoPreenchido = useRef(false);

  // Peso vem da soma dos itens com peso cadastrado (pesoDaEntrega) — só dá
  // pra calcular depois que os produtos chegam. Preenche uma vez; se o
  // vendedor já editou o campo com a mão, não sobrescreve.
  useEffect(() => {
    if (carregandoProdutos || pesoPreenchido.current || pesoTocado.current) return;
    pesoPreenchido.current = true;
    setForm((f) => ({ ...f, pesoKg: formInicialNfeEntrega(delivery, products).pesoKg }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregandoProdutos]);

  const faltandoCest = itensSemCest(delivery.items, products);
  const idsSemCest = new Set(faltandoCest.map((i) => i.sale_item_id));

  const [emitindo, setEmitindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function irResolver() {
    onClose();
    router.push("/estoque" as any);
  }

  async function emitir() {
    if (emitindo) return;
    setErro(null);
    setEmitindo(true);
    try {
      const body = montarEmitBody(delivery, products, form);
      const res = await nfceApi.emit(companyId, body);
      qc.invalidateQueries({ queryKey: ["matcon-deliveries"] });
      const labelStatus = res.nfce.status === "autorizada" ? "autorizada!" : res.nfce.status;
      toast.success(`Nota fiscal #${res.nfce.numero} ${labelStatus}`);
      onClose();
    } catch (e: any) {
      // QA 23/09/2026: texto de sistema ("Rota nao encontrada", rede) vira
      // frase simples; a frase da SEFAZ/backend para o lojista passa.
      const msg = textoDoErro(e, "Não consegui emitir a nota fiscal. Tente de novo em instantes.");
      setErro(msg);
      toast.error(msg);
    } finally {
      setEmitindo(false);
    }
  }

  const lede = [delivery.customer_name || "Cliente do balcão", delivery.address, `hoje, ${hojeCurto()}`]
    .filter(Boolean).join(" · ");

  return (
    <ResponsiveSheet visible onClose={onClose} maxWidth={420}>
      <>
        <View style={st.header}>
          <View style={{ flex: 1 }}>
            <Text style={st.title}>{delivery.sale_number != null ? `Nota fiscal do pedido #${delivery.sale_number}` : "Nota fiscal da entrega"}</Text>
            <Text style={st.lede} numberOfLines={2}>{lede}</Text>
          </View>
          <Pressable onPress={onClose} style={st.closeBtn} testID="matcon-nfe-fechar">
            <Icon name="x" size={16} color={Colors.ink3} />
          </Pressable>
        </View>

        <ScrollView style={st.body} keyboardShouldPersistTaps="handled" testID="matcon-nfe-folha">
          {faltandoCest.length > 0 && (
            <View style={st.aviso}>
              <Text style={st.avisoTexto}>
                <Text style={{ fontWeight: "800" }}>
                  {faltandoCest.length} {faltandoCest.length === 1 ? "item sem código fiscal" : "itens sem código fiscal"}
                </Text>
                {" "}— a nota pode ser recusada.
              </Text>
              <Pressable onPress={irResolver} style={st.resolverBtn} testID="matcon-nfe-resolver">
                <Text style={st.resolverBtnText}>Resolver</Text>
              </Pressable>
            </View>
          )}

          <Text style={st.section}>Itens da entrega</Text>
          <View style={{ gap: 6, marginBottom: 14 }}>
            {(delivery.items || []).map((item) => (
              <View key={item.sale_item_id} style={st.itemRow}>
                <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <Text style={st.itemNome} numberOfLines={1}>{item.name}</Text>
                  {idsSemCest.has(item.sale_item_id) && (
                    <View style={st.badgeSemCodigo}>
                      <Text style={st.badgeSemCodigoText}>SEM CÓDIGO</Text>
                    </View>
                  )}
                </View>
                <Text style={st.itemQtd}>{item.quantity} {item.unit || ""}</Text>
              </View>
            ))}
          </View>

          <Text style={st.section}>Para quem</Text>
          <View style={st.box}>
            <Text style={st.fLabel}>Nome</Text>
            <TextInput
              style={st.input}
              value={form.customerName}
              onChangeText={(v) => setForm((f) => ({ ...f, customerName: v }))}
              placeholder="Nome do destinatário"
              placeholderTextColor={Colors.ink3}
              testID="matcon-nfe-nome"
            />
            <Text style={[st.fLabel, { marginTop: 10 }]}>CPF ou CNPJ</Text>
            <TextInput
              style={st.input}
              value={form.customerDoc}
              onChangeText={(v) => setForm((f) => ({ ...f, customerDoc: v }))}
              placeholder="000.000.000-00"
              placeholderTextColor={Colors.ink3}
              keyboardType="number-pad"
              testID="matcon-nfe-doc"
            />
            {!!delivery.address && (
              <Text style={st.hint}>{delivery.address}{delivery.customer_phone ? ` · ${delivery.customer_phone}` : ""}</Text>
            )}
          </View>

          <Text style={st.section}>Como vai o material</Text>
          <View style={st.box}>
            <View style={st.fraseRow}>
              <Text style={st.frase}>Entrego com meu caminhão</Text>
              <Switch
                value={form.fretePropio}
                onValueChange={(v) => setForm((f) => ({ ...f, fretePropio: v }))}
                trackColor={{ false: Colors.bg4, true: Colors.violet + "66" }}
                thumbColor={form.fretePropio ? Colors.violet : Colors.ink3}
                testID="matcon-nfe-frete-proprio"
              />
            </View>

            {!form.fretePropio && (
              <View style={{ marginTop: 8 }}>
                <Text style={st.hint}>Quem leva?</Text>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                  <Pressable
                    onPress={() => setForm((f) => ({ ...f, quemRetira: "cliente" }))}
                    style={[st.chip, form.quemRetira === "cliente" && st.chipOn]}
                    testID="matcon-nfe-quem-cliente"
                  >
                    <Text style={[st.chipText, form.quemRetira === "cliente" && st.chipTextOn]}>Cliente retira</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setForm((f) => ({ ...f, quemRetira: "transportadora" }))}
                    style={[st.chip, form.quemRetira === "transportadora" && st.chipOn]}
                    testID="matcon-nfe-quem-transportadora"
                  >
                    <Text style={[st.chipText, form.quemRetira === "transportadora" && st.chipTextOn]}>Transportadora</Text>
                  </Pressable>
                </View>
                {form.quemRetira === "transportadora" && (
                  <TextInput
                    style={[st.input, { marginTop: 8 }]}
                    value={form.transportadoraNome}
                    onChangeText={(v) => setForm((f) => ({ ...f, transportadoraNome: v }))}
                    placeholder="Nome da transportadora"
                    placeholderTextColor={Colors.ink3}
                    testID="matcon-nfe-transportadora-nome"
                  />
                )}
              </View>
            )}

            <View style={[st.fraseRow, { marginTop: 12 }]}>
              <Text style={st.frase}>
                São{" "}
                <TextInput
                  style={st.edit}
                  value={form.volumes}
                  onChangeText={(v) => setForm((f) => ({ ...f, volumes: v.replace(/[^0-9]/g, "") }))}
                  keyboardType="number-pad"
                  testID="matcon-nfe-volumes"
                />
                {" "}volumes com{" "}
                <TextInput
                  style={st.edit}
                  value={form.pesoKg}
                  onChangeText={(v) => { pesoTocado.current = true; setForm((f) => ({ ...f, pesoKg: v.replace(",", ".") })); }}
                  keyboardType="decimal-pad"
                  testID="matcon-nfe-peso"
                />
                {" "}kg.
              </Text>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 }}>
              <Text style={st.frase}>Placa</Text>
              <TextInput
                style={[st.edit, { minWidth: 90 }]}
                value={form.placa}
                onChangeText={(v) => setForm((f) => ({ ...f, placa: v.toUpperCase() }))}
                placeholder="ABC-1D23"
                placeholderTextColor={Colors.ink3}
                autoCapitalize="characters"
                testID="matcon-nfe-placa"
              />
              <Text style={st.frase}>·</Text>
              <TextInput
                style={[st.edit, { minWidth: 44 }]}
                value={form.ufPlaca}
                onChangeText={(v) => setForm((f) => ({ ...f, ufPlaca: v.toUpperCase().slice(0, 2) }))}
                placeholder="SP"
                placeholderTextColor={Colors.ink3}
                autoCapitalize="characters"
                maxLength={2}
                testID="matcon-nfe-uf-placa"
              />
              <Text style={st.hint}>(opcional)</Text>
            </View>
          </View>

          {!!erro && (
            <View style={st.erroBox}>
              <Icon name="alert" size={14} color={Colors.red} />
              <Text style={st.erroTexto}>{erro}</Text>
            </View>
          )}

          <View style={st.tot}>
            <Text style={st.totLabel}>Total da nota</Text>
            <Text style={st.totValor}>{fmtMoney(delivery.total)}</Text>
          </View>

          <Pressable
            onPress={emitir}
            disabled={emitindo}
            style={[st.emitBtn, emitindo && { opacity: 0.6 }]}
            testID="matcon-nfe-emitir"
          >
            {emitindo ? <ActivityIndicator size="small" color="#fff" /> : (
              <>
                <Icon name="file_text" size={15} color="#fff" />
                <Text style={st.emitBtnText}>{erro ? "Tentar de novo" : "Emitir nota fiscal"}</Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      </>
    </ResponsiveSheet>
  );
}

const st = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 18, paddingBottom: 10 },
  title: { fontSize: 18, fontWeight: "700", color: Colors.ink },
  lede: { fontSize: 12, color: Colors.ink3, marginTop: 2 },
  closeBtn: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg2 },
  body: { paddingHorizontal: 18, paddingBottom: 18 },

  aviso: {
    flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap",
    backgroundColor: Colors.amberD, borderWidth: 1, borderColor: "rgba(251,191,36,0.35)",
    borderRadius: 12, padding: 12, marginBottom: 14,
  },
  avisoTexto: { flex: 1, fontSize: 12.5, color: Colors.ink2, lineHeight: 17, minWidth: 160 },
  resolverBtn: { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.amber, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  resolverBtnText: { fontSize: 12, fontWeight: "700", color: Colors.amber },

  section: { fontSize: 10, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase", color: Colors.ink3, marginBottom: 8 },

  itemRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  itemNome: { fontSize: 12.5, color: Colors.ink, fontWeight: "600", flexShrink: 1 },
  itemQtd: { fontFamily: Fonts.mono, fontSize: 12, color: Colors.ink2 },
  badgeSemCodigo: { borderWidth: 1, borderColor: Colors.amber, backgroundColor: Colors.amberD, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 },
  badgeSemCodigoText: { fontSize: 9, fontWeight: "800", color: Colors.amber, letterSpacing: 0.4 },

  box: { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 12, marginBottom: 14 },
  fLabel: { fontSize: 10.5, fontWeight: "700", color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 },
  input: { backgroundColor: Colors.bg2, borderWidth: 1, borderColor: Colors.border2, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, fontSize: 13, color: Colors.ink },
  hint: { fontSize: 11.5, color: Colors.ink3, marginTop: 6, lineHeight: 16 },

  fraseRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  frase: { fontSize: 14, color: Colors.ink2 },
  edit: {
    fontFamily: Fonts.mono, fontWeight: "600", color: Colors.ink,
    backgroundColor: Colors.bg2, borderWidth: 1, borderBottomWidth: 2, borderColor: Colors.border2, borderBottomColor: Colors.violet,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, minWidth: 40, textAlign: "center",
  },

  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg2 },
  chipOn: { backgroundColor: Colors.violet + "22", borderColor: Colors.violet },
  chipText: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
  chipTextOn: { color: Colors.violet3 },

  erroBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: Colors.redD, borderWidth: 1, borderColor: "rgba(248,113,113,0.35)", borderRadius: 10, padding: 10, marginBottom: 12 },
  erroTexto: { flex: 1, fontSize: 12, color: Colors.red, lineHeight: 16 },

  tot: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 4, paddingTop: 12 },
  totLabel: { fontSize: 12, color: Colors.ink3 },
  totValor: { fontFamily: Fonts.mono, fontSize: 20, fontWeight: "700", color: Colors.ink },

  emitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.violet, borderRadius: 10, paddingVertical: 13, marginTop: 14 },
  emitBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
});
