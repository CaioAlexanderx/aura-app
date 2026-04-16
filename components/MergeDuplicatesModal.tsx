// ============================================================
// AURA. -- Fase B: Modal de Unificar Duplicatas em Variantes
// Detecta grupos de produtos com mesmo nome e permite convertelos
// em variantes (cor/tamanho/outro atributo) de um produto primary.
// ============================================================
import { useState, useMemo } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Modal, ActivityIndicator } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { companiesApi } from "@/services/api";
import { hexToName } from "@/utils/colorNames";
import { toast } from "@/components/Toast";

export function MergeDuplicatesModal({
  visible, onClose, onComplete,
}: {
  visible: boolean;
  onClose: () => void;
  onComplete?: () => void;
}) {
  const { company } = useAuthStore();
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["duplicateGroups", company?.id],
    queryFn: () => companiesApi.duplicateGroups(company!.id),
    enabled: visible && !!company?.id,
    staleTime: 30000,
  });
  const groups = ((data as any)?.groups || []) as any[];

  const [selectedGroupIdx, setSelectedGroupIdx] = useState<number | null>(null);
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [attributeName, setAttributeName] = useState<"Cor" | "Tamanho" | "Variacao">("Cor");
  const [valueByProduct, setValueByProduct] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const currentGroup = selectedGroupIdx !== null ? groups[selectedGroupIdx] : null;

  // Quando abre um grupo, pre-popular sugestoes
  function openGroup(idx: number) {
    const g = groups[idx];
    if (!g) return;
    setSelectedGroupIdx(idx);
    setPrimaryId(g.products[0]?.id || null);
    // Detectar atributo: se todos tem cor -> Cor. Se todos tem size -> Tamanho.
    const hasColor = g.products.every((p: any) => !!p.color);
    const hasSize = g.products.every((p: any) => !!p.size);
    const attr: "Cor" | "Tamanho" | "Variacao" = hasColor ? "Cor" : (hasSize ? "Tamanho" : "Variacao");
    setAttributeName(attr);
    const mapVals: Record<string, string> = {};
    g.products.forEach((p: any, i: number) => {
      if (attr === "Cor" && p.color) mapVals[p.id] = hexToName(p.color);
      else if (attr === "Tamanho" && p.size) mapVals[p.id] = p.size;
      else mapVals[p.id] = "V" + (i + 1);
    });
    setValueByProduct(mapVals);
  }

  function backToList() {
    setSelectedGroupIdx(null);
    setPrimaryId(null);
    setValueByProduct({});
  }

  // Quando muda o atributo, re-sugerir valores
  function changeAttribute(attr: "Cor" | "Tamanho" | "Variacao") {
    setAttributeName(attr);
    if (!currentGroup) return;
    const mapVals: Record<string, string> = { ...valueByProduct };
    currentGroup.products.forEach((p: any, i: number) => {
      if (attr === "Cor" && p.color) mapVals[p.id] = hexToName(p.color);
      else if (attr === "Tamanho" && p.size) mapVals[p.id] = p.size;
      else if (!mapVals[p.id]) mapVals[p.id] = "V" + (i + 1);
    });
    setValueByProduct(mapVals);
  }

  async function handleMerge() {
    if (!company?.id || !currentGroup || !primaryId) return;

    // Validar: todos tem valor
    const missing = currentGroup.products.filter((p: any) => !valueByProduct[p.id]?.trim());
    if (missing.length > 0) {
      toast.error("Preencha o valor de " + attributeName + " pra todos os produtos");
      return;
    }
    // Validar: valores unicos
    const vals = currentGroup.products.map((p: any) => valueByProduct[p.id].trim().toLowerCase());
    if (new Set(vals).size !== vals.length) {
      toast.error("Os valores de " + attributeName + " nao podem se repetir");
      return;
    }

    setSaving(true);
    try {
      const body = {
        primary_id: primaryId,
        attribute_name: attributeName,
        variants: currentGroup.products.map((p: any) => ({
          product_id: p.id,
          value: valueByProduct[p.id].trim(),
        })),
      };
      const res = await companiesApi.mergeAsVariants(company.id, body);
      toast.success("Produtos unificados! " + (res.variants_created?.length || 0) + " variantes criadas.");
      qc.invalidateQueries({ queryKey: ["products", company.id] });
      qc.invalidateQueries({ queryKey: ["duplicateGroups", company.id] });
      onComplete?.();
      backToList();
      refetch();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao unificar produtos");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <View style={s.header}>
            {currentGroup ? (
              <Pressable onPress={backToList} style={s.backBtn}>
                <Text style={s.backText}>{"\u2190 Voltar"}</Text>
              </Pressable>
            ) : (
              <View style={{ width: 80 }} />
            )}
            <Text style={s.title}>
              {currentGroup ? "Unificar" : "Unificar duplicatas"}
            </Text>
            <Pressable onPress={onClose} style={s.closeBtn}>
              <Text style={s.closeText}>x</Text>
            </Pressable>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
            {isLoading && (
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <ActivityIndicator color={Colors.violet3} />
                <Text style={{ color: Colors.ink3, fontSize: 12, marginTop: 10 }}>Buscando duplicatas...</Text>
              </View>
            )}

            {!isLoading && !currentGroup && (
              <>
                {groups.length === 0 ? (
                  <View style={{ alignItems: "center", paddingVertical: 40 }}>
                    <Text style={s.emptyIcon}>{"\u2713"}</Text>
                    <Text style={s.emptyTitle}>Nenhuma duplicata detectada</Text>
                    <Text style={s.emptyDesc}>Seu estoque esta organizado!</Text>
                  </View>
                ) : (
                  <>
                    <Text style={s.intro}>
                      Encontramos {groups.length} grupo{groups.length > 1 ? "s" : ""} de produtos com mesmo nome.
                      Escolha um grupo pra unificar em variantes.
                    </Text>
                    <View style={{ gap: 10, marginTop: 16 }}>
                      {groups.map((g: any, i: number) => (
                        <Pressable key={g.normalized_name} onPress={() => openGroup(i)} style={s.groupCard}>
                          <View style={{ flex: 1 }}>
                            <Text style={s.groupName} numberOfLines={1}>{g.name}</Text>
                            <Text style={s.groupMeta}>{g.count} versoes cadastradas</Text>
                          </View>
                          <View style={s.groupCount}>
                            <Text style={s.groupCountText}>{g.count}</Text>
                          </View>
                          <Text style={s.groupArrow}>{"\u203a"}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                )}
              </>
            )}

            {!isLoading && currentGroup && (
              <>
                <Text style={s.groupTitle}>{currentGroup.name}</Text>
                <Text style={s.groupSub}>{currentGroup.count} produtos viraram variantes</Text>

                <View style={s.attrBlock}>
                  <Text style={s.sectionLabel}>O que diferencia?</Text>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    {["Cor", "Tamanho", "Variacao"].map((a) => (
                      <Pressable key={a}
                        onPress={() => changeAttribute(a as any)}
                        style={[s.attrChip, attributeName === a && s.attrChipActive]}>
                        <Text style={[s.attrChipText, attributeName === a && s.attrChipTextActive]}>{a}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <Text style={[s.sectionLabel, { marginTop: 20 }]}>
                  Escolha o produto principal e o valor de {attributeName.toLowerCase()} de cada variante
                </Text>
                <Text style={s.sectionHint}>
                  O principal mantem o nome, preco e imagens. Os outros viram variantes.
                </Text>

                <View style={{ gap: 10, marginTop: 12 }}>
                  {currentGroup.products.map((p: any) => (
                    <View key={p.id} style={[s.prodRow, primaryId === p.id && s.prodRowPrimary]}>
                      <Pressable onPress={() => setPrimaryId(p.id)} style={s.radioWrap}>
                        <View style={[s.radio, primaryId === p.id && s.radioActive]}>
                          {primaryId === p.id && <View style={s.radioDot} />}
                        </View>
                      </Pressable>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          {p.color && (
                            <View style={[s.colorDot, { backgroundColor: p.color }]} />
                          )}
                          <Text style={s.prodLabel} numberOfLines={1}>
                            {p.color ? hexToName(p.color) : ""}
                            {p.color && p.size ? " \u00b7 " : ""}
                            {p.size ? "T " + p.size : ""}
                            {!p.color && !p.size ? "Versao" : ""}
                          </Text>
                        </View>
                        <Text style={s.prodMeta}>
                          R$ {Number(p.price).toFixed(2).replace(".", ",")} \u00b7 {p.stock_qty} un
                          {p.barcode ? " \u00b7 " + String(p.barcode).slice(-6) : ""}
                        </Text>
                      </View>
                      <TextInput
                        style={s.valueInput}
                        value={valueByProduct[p.id] || ""}
                        onChangeText={(v) => setValueByProduct((prev) => ({ ...prev, [p.id]: v }))}
                        placeholder={attributeName}
                        placeholderTextColor={Colors.ink3}
                      />
                    </View>
                  ))}
                </View>

                <View style={s.previewBox}>
                  <Text style={s.previewTitle}>Resultado</Text>
                  <Text style={s.previewText}>
                    1 produto {'"' + currentGroup.name + '"'} com {currentGroup.products.length} variantes de {attributeName.toLowerCase()}.
                    Total de estoque: {currentGroup.products.reduce((acc: number, p: any) => acc + (parseInt(p.stock_qty) || 0), 0)} un.
                    O historico de vendas e preservado.
                  </Text>
                </View>
              </>
            )}
          </ScrollView>

          {currentGroup && (
            <View style={s.footer}>
              <Pressable onPress={backToList} style={s.cancelBtn} disabled={saving}>
                <Text style={s.cancelText}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={handleMerge} style={[s.confirmBtn, saving && { opacity: 0.6 }]} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={s.confirmText}>Unificar {currentGroup.count} em 1</Text>
                )}
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  sheet: {
    backgroundColor: Colors.bg2,
    borderRadius: 20,
    width: "100%",
    maxWidth: 680,
    maxHeight: "90%",
    borderWidth: 1,
    borderColor: Colors.border2,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { paddingHorizontal: 10, paddingVertical: 6, width: 80 },
  backText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  title: { fontSize: 17, fontWeight: "700", color: Colors.ink, flex: 1, textAlign: "center" },
  closeBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center",
  },
  closeText: { fontSize: 16, color: Colors.ink3, fontWeight: "600" },

  intro: { fontSize: 13, color: Colors.ink3, lineHeight: 19 },

  groupCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.bg3, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  groupName: { fontSize: 14, fontWeight: "600", color: Colors.ink },
  groupMeta: { fontSize: 11, color: Colors.ink3, marginTop: 3 },
  groupCount: {
    backgroundColor: Colors.amberD, borderRadius: 20, minWidth: 28,
    height: 28, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(245,158,11,0.25)",
  },
  groupCountText: { fontSize: 12, color: Colors.amber, fontWeight: "700" },
  groupArrow: { fontSize: 20, color: Colors.ink3, marginLeft: 4 },

  groupTitle: { fontSize: 17, fontWeight: "700", color: Colors.ink },
  groupSub: { fontSize: 12, color: Colors.ink3, marginTop: 3 },

  attrBlock: { marginTop: 20 },
  sectionLabel: { fontSize: 12, color: Colors.ink3, fontWeight: "700", marginBottom: 8, letterSpacing: 0.3 },
  sectionHint: { fontSize: 11, color: Colors.ink3, marginTop: -4, marginBottom: 4, lineHeight: 16 },
  attrChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
    backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border,
  },
  attrChipActive: { backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  attrChipText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  attrChipTextActive: { color: Colors.violet3, fontWeight: "700" },

  prodRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.bg3, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  prodRowPrimary: { borderColor: Colors.violet, backgroundColor: Colors.violetD },
  radioWrap: { padding: 2 },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: Colors.ink3,
    alignItems: "center", justifyContent: "center",
  },
  radioActive: { borderColor: Colors.violet },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.violet },
  colorDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: "rgba(0,0,0,0.1)" },
  prodLabel: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  prodMeta: { fontSize: 10.5, color: Colors.ink3, marginTop: 2 },
  valueInput: {
    backgroundColor: Colors.bg4, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 10, paddingVertical: 7,
    fontSize: 12, color: Colors.ink,
    minWidth: 90, maxWidth: 130,
  },

  previewBox: {
    marginTop: 20, padding: 14, borderRadius: 12,
    backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2,
  },
  previewTitle: { fontSize: 11, color: Colors.violet3, fontWeight: "700", letterSpacing: 0.4, marginBottom: 6 },
  previewText: { fontSize: 12, color: Colors.ink, lineHeight: 18 },

  footer: {
    flexDirection: "row", gap: 10,
    paddingHorizontal: 20, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: Colors.border,
    backgroundColor: Colors.bg3,
  },
  cancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border, alignItems: "center",
  },
  cancelText: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  confirmBtn: {
    flex: 2, paddingVertical: 12, borderRadius: 10,
    backgroundColor: Colors.violet, alignItems: "center", justifyContent: "center",
  },
  confirmText: { fontSize: 13, color: "#fff", fontWeight: "700" },

  emptyIcon: {
    fontSize: 28, color: Colors.green, fontWeight: "800",
    width: 56, height: 56, borderRadius: 28, textAlign: "center", lineHeight: 56,
    backgroundColor: Colors.greenD || "rgba(34,197,94,0.12)", marginBottom: 12,
  },
  emptyTitle: { fontSize: 14, color: Colors.ink, fontWeight: "700" },
  emptyDesc: { fontSize: 12, color: Colors.ink3, marginTop: 4 },
});

export default MergeDuplicatesModal;
