// ============================================================
// AURA. — LinkProductModal (Multi-CNPJ M-STOCKLINK MSL-05)
//
// Modal pra vincular um produto da empresa atual a "o mesmo
// produto" em outras empresas do owner. Mostra sugestões via
// barcode/sku/similarity e permite escolher um master_sku
// (auto ou manual).
//
// Uso típico:
//   <LinkProductModal
//     visible={open}
//     productId={productId}
//     companyId={currentCompany.id}
//     onClose={() => setOpen(false)}
//     onLinked={() => refetchProducts()}
//   />
//
// Fluxo:
//   1. Abre → busca match-suggestions
//   2. Sugestões aparecem com scores e botão "Usar este código"
//      (que pega o master_sku da sugestão se tiver, ou propõe um)
//   3. Usuário pode também digitar um master_sku manual
//   4. Confirma → POST /master-sku
//   5. Toast com resultado + onLinked() callback
// ============================================================
import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useColors, Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import {
  productLinksApi,
  matchTypeLabel,
  matchScoreColor,
  type MatchSuggestion,
  type MatchSuggestionsResponse,
} from "@/services/productLinks";
import { formatBRL } from "@/services/multicnpj";

type Props = {
  visible: boolean;
  companyId: string;
  productId: string;
  onClose: () => void;
  onLinked?: (masterSku: string) => void;
};

export function LinkProductModal({
  visible,
  companyId,
  productId,
  onClose,
  onLinked,
}: Props) {
  const C = useColors();
  const [data, setData] = useState<MatchSuggestionsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [manualSku, setManualSku] = useState("");

  const fetchSuggestions = useCallback(async () => {
    if (!companyId || !productId) return;
    setLoading(true);
    try {
      const res = await productLinksApi.matchSuggestions(companyId, productId);
      setData(res);
      // Pre-popula manualSku com o master_sku atual se já houver
      if (res.product.master_sku) {
        setManualSku(res.product.master_sku);
      }
    } catch (err: any) {
      console.warn("[LinkProductModal] fetch error:", err?.message);
      toast.error("Erro ao buscar sugestões");
    } finally {
      setLoading(false);
    }
  }, [companyId, productId]);

  useEffect(() => {
    if (visible) {
      fetchSuggestions();
    } else {
      // Reset state ao fechar
      setData(null);
      setManualSku("");
    }
  }, [visible, fetchSuggestions]);

  async function handleLink(sku: string) {
    const cleanSku = sku.trim().toUpperCase();
    if (cleanSku.length < 2) {
      toast.error("Código deve ter pelo menos 2 caracteres");
      return;
    }
    if (/\s/.test(cleanSku)) {
      toast.error("Código não pode ter espaços");
      return;
    }
    if (linking) return;
    setLinking(true);
    try {
      const res = await productLinksApi.linkProduct(companyId, productId, cleanSku);
      toast.success(res.message);
      onLinked?.(cleanSku);
      onClose();
    } catch (err: any) {
      const data = err?.data;
      if (data?.error === "DUPLICATE_IN_COMPANY") {
        toast.error(data.message);
      } else {
        toast.error(err?.message || "Erro ao vincular produto");
      }
    } finally {
      setLinking(false);
    }
  }

  // Suggestion → propõe usar o master_sku existente OU o sku/barcode
  // do candidato como semente para o novo grupo.
  function applySuggestion(s: MatchSuggestion) {
    const seed = s.master_sku || s.barcode || s.sku || "";
    if (seed) {
      setManualSku(seed.trim().toUpperCase());
    } else {
      toast.info("Esta sugestão não tem código pronto. Digite um manualmente.");
    }
  }

  async function handleUnlink() {
    if (unlinking) return;
    setUnlinking(true);
    try {
      const res = await productLinksApi.unlinkProduct(companyId, productId);
      toast.success(res.message);
      onLinked?.("");  // sinaliza mudança de estado
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao desvincular");
    } finally {
      setUnlinking(false);
    }
  }

  const currentMasterSku = data?.product.master_sku || null;
  const isAlreadyLinked = !!currentMasterSku;

  return (
    <Modal
      visible={visible}
      transparent
      animationType={Platform.OS === "web" ? "fade" : "slide"}
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.6)",
          justifyContent: "center",
          alignItems: "center",
          padding: 16,
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            width: "100%",
            maxWidth: 560,
            maxHeight: "90%",
            backgroundColor: C.bg2,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: C.border,
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: 18,
              gap: 12,
              borderBottomWidth: 1,
              borderBottomColor: C.border,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                backgroundColor: "#7c3aed20",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="bag" size={18} color="#7c3aed" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: C.ink }}>
                Vincular entre empresas
              </Text>
              <Text style={{ fontSize: 11, color: C.ink3, marginTop: 2 }}>
                Mesmo produto em CNPJs diferentes = estoque consolidado
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="x" size={14} color={C.ink3} />
            </Pressable>
          </View>

          <ScrollView
            style={{ maxHeight: 600 }}
            contentContainerStyle={{ padding: 18 }}
          >
            {loading && (
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <ActivityIndicator color={C.violet} />
                <Text style={{ fontSize: 12, color: C.ink3, marginTop: 12 }}>
                  Buscando sugestões...
                </Text>
              </View>
            )}

            {!loading && data && (
              <>
                {/* Produto atual */}
                <View
                  style={{
                    backgroundColor: C.bg3,
                    borderRadius: 10,
                    padding: 12,
                    marginBottom: 16,
                  }}
                >
                  <Text style={{ fontSize: 10, color: C.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 }}>
                    Produto atual
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: C.ink, marginTop: 4 }}>
                    {data.product.name}
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                    {data.product.barcode && (
                      <Text style={{ fontSize: 11, color: C.ink3 }}>
                        EAN: {data.product.barcode}
                      </Text>
                    )}
                    {data.product.sku && (
                      <Text style={{ fontSize: 11, color: C.ink3 }}>
                        SKU: {data.product.sku}
                      </Text>
                    )}
                  </View>
                  {currentMasterSku && (
                    <View
                      style={{
                        marginTop: 10,
                        paddingTop: 10,
                        borderTopWidth: 1,
                        borderTopColor: C.border,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Icon name="check" size={12} color="#16a34a" />
                      <Text style={{ fontSize: 12, color: C.ink, flex: 1 }}>
                        Vinculado como{" "}
                        <Text style={{ fontWeight: "700", color: "#7c3aed" }}>
                          {currentMasterSku}
                        </Text>
                      </Text>
                      <Pressable
                        onPress={handleUnlink}
                        disabled={unlinking}
                        style={{
                          paddingVertical: 4,
                          paddingHorizontal: 10,
                          borderRadius: 6,
                          backgroundColor: "#dc262610",
                          borderWidth: 1,
                          borderColor: "#dc262640",
                        }}
                      >
                        {unlinking ? (
                          <ActivityIndicator size="small" color="#dc2626" />
                        ) : (
                          <Text style={{ fontSize: 11, color: "#dc2626", fontWeight: "700" }}>
                            Desvincular
                          </Text>
                        )}
                      </Pressable>
                    </View>
                  )}
                </View>

                {/* Caso edge: usuário só tem 1 empresa */}
                {data.note && data.suggestions.length === 0 && (
                  <View
                    style={{
                      backgroundColor: "#f59e0b15",
                      borderRadius: 10,
                      padding: 14,
                      borderWidth: 1,
                      borderColor: "#f59e0b40",
                      marginBottom: 16,
                      flexDirection: "row",
                      gap: 8,
                    }}
                  >
                    <Icon name="info" size={14} color="#f59e0b" />
                    <Text style={{ fontSize: 12, color: "#f59e0b", flex: 1, lineHeight: 18 }}>
                      {data.note}
                    </Text>
                  </View>
                )}

                {/* Sugestões */}
                {data.suggestions.length > 0 && (
                  <>
                    <Text
                      style={{
                        fontSize: 11,
                        color: C.ink3,
                        fontWeight: "700",
                        textTransform: "uppercase",
                        letterSpacing: 1,
                        marginBottom: 8,
                      }}
                    >
                      {data.suggestions.length} sugestão(ões) em outras empresas
                    </Text>
                    {data.suggestions.map((s) => (
                      <View
                        key={s.id}
                        style={{
                          backgroundColor: C.bg3,
                          borderRadius: 10,
                          padding: 12,
                          marginBottom: 8,
                          borderWidth: 1,
                          borderColor: s.already_in_a_group ? "#7c3aed40" : C.border,
                        }}
                      >
                        <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text
                              style={{ fontSize: 13, fontWeight: "700", color: C.ink }}
                              numberOfLines={2}
                            >
                              {s.name}
                            </Text>
                            <Text style={{ fontSize: 11, color: C.ink3, marginTop: 2 }}>
                              em {s.company_name}
                            </Text>
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                              <View
                                style={{
                                  paddingHorizontal: 6,
                                  paddingVertical: 2,
                                  borderRadius: 4,
                                  backgroundColor: matchScoreColor(s.match_score) + "20",
                                }}
                              >
                                <Text style={{ fontSize: 9, color: matchScoreColor(s.match_score), fontWeight: "700" }}>
                                  {matchTypeLabel(s.match_type)} · {Math.round(s.match_score * 100)}%
                                </Text>
                              </View>
                              {s.already_in_a_group && (
                                <View
                                  style={{
                                    paddingHorizontal: 6,
                                    paddingVertical: 2,
                                    borderRadius: 4,
                                    backgroundColor: "#7c3aed20",
                                  }}
                                >
                                  <Text style={{ fontSize: 9, color: "#7c3aed", fontWeight: "700" }}>
                                    JÁ VINCULADO
                                  </Text>
                                </View>
                              )}
                            </View>
                            <Text style={{ fontSize: 11, color: C.ink3, marginTop: 6 }}>
                              Estoque: {s.stock_qty} · {formatBRL(s.price)}
                            </Text>
                          </View>
                          <Pressable
                            onPress={() => applySuggestion(s)}
                            style={{
                              paddingVertical: 6,
                              paddingHorizontal: 10,
                              borderRadius: 6,
                              backgroundColor: "#7c3aed10",
                              borderWidth: 1,
                              borderColor: "#7c3aed40",
                            }}
                          >
                            <Text style={{ fontSize: 11, color: "#7c3aed", fontWeight: "700" }}>
                              Usar
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </>
                )}

                {/* Input manual */}
                <View style={{ marginTop: 16 }}>
                  <Text
                    style={{
                      fontSize: 11,
                      color: C.ink3,
                      fontWeight: "700",
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      marginBottom: 8,
                    }}
                  >
                    {data.suggestions.length > 0 ? "Ou digite o código" : "Digite o código de vínculo"}
                  </Text>
                  <TextInput
                    value={manualSku}
                    onChangeText={(v) => setManualSku(v.toUpperCase().replace(/\s/g, ""))}
                    placeholder="EX: CAM-AZ-M"
                    placeholderTextColor={C.ink3}
                    autoCapitalize="characters"
                    style={{
                      backgroundColor: C.bg3,
                      borderRadius: 10,
                      padding: 12,
                      fontSize: 14,
                      color: C.ink,
                      borderWidth: 1,
                      borderColor: C.border,
                      fontFamily: Platform.OS === "web" ? "monospace" : undefined,
                    }}
                  />
                  <Text style={{ fontSize: 11, color: C.ink3, marginTop: 6, lineHeight: 16 }}>
                    Use o mesmo código nos produtos das outras empresas para agrupá-los.
                  </Text>
                </View>
              </>
            )}
          </ScrollView>

          {/* Footer com botão Vincular */}
          {!loading && data && (
            <View
              style={{
                flexDirection: "row",
                gap: 8,
                padding: 14,
                borderTopWidth: 1,
                borderTopColor: C.border,
                backgroundColor: C.bg2,
              }}
            >
              <Pressable
                onPress={onClose}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: C.border,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 13, color: C.ink, fontWeight: "600" }}>
                  Cancelar
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleLink(manualSku)}
                disabled={linking || manualSku.trim().length < 2 || manualSku === currentMasterSku}
                style={{
                  flex: 1.5,
                  paddingVertical: 12,
                  borderRadius: 10,
                  backgroundColor: "#7c3aed",
                  alignItems: "center",
                  opacity: linking || manualSku.trim().length < 2 || manualSku === currentMasterSku ? 0.4 : 1,
                }}
              >
                {linking ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ fontSize: 13, color: "#fff", fontWeight: "700" }}>
                    {isAlreadyLinked && manualSku !== currentMasterSku ? "Atualizar vínculo" : "Vincular"}
                  </Text>
                )}
              </Pressable>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default LinkProductModal;
