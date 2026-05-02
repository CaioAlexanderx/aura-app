// ============================================================
// AURA. — Tela "Minhas Empresas" (Multi-CNPJ M1-07 + M2-03)
// Rota /empresas — gestão completa de CNPJs do owner.
// Acessível via Configurações > Empresas.
//
// Funcionalidades:
//   - Lista todas as empresas do user (primary + extras)
//   - Cobrança consolidada (R$ X/mês total) no topo
//   - Trocar pra qualquer uma (mesmo fluxo do switcher)
//   - Tornar principal (M2-03 transfer-primary, recarrega após)
//   - Remover empresa secundária (não a primary)
//   - Adicionar nova empresa (abre AddCompanyModal)
// ============================================================
import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Alert,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { useColors, Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import {
  userCompaniesApi,
  planLabel,
  maskCnpj,
  formatBRL,
  type FullCompany,
  type BillingPreviewResponse,
} from "@/services/multicnpj";
import { AddCompanyModal } from "@/components/AddCompanyModal";

function planBadgeColor(plan: string) {
  switch ((plan || "").toLowerCase()) {
    case "expansao":
      return Colors.green;
    case "negocio":
      return Colors.violet3;
    case "personalizado":
      return "#f59e0b";
    default:
      return "#94a3b8";
  }
}

export default function MinhasEmpresasScreen() {
  const C = useColors();
  const router = useRouter();
  const { company: currentCompany, switchCompany, switching, loadCompanies, logout } = useAuthStore();

  const [companies, setCompanies] = useState<FullCompany[]>([]);
  const [billing, setBilling] = useState<BillingPreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<FullCompany | null>(null);
  // M2-03 transfer-primary
  const [transferringId, setTransferringId] = useState<string | null>(null);
  const [confirmTransfer, setConfirmTransfer] = useState<FullCompany | null>(null);

  const fetchData = useCallback(async () => {
    try {
      // Busca empresas e preview em paralelo. Preview pode dar 404 se
      // por algum motivo não tem primary (improvável depois de logado).
      const [listRes, billingRes] = await Promise.all([
        userCompaniesApi.list(),
        userCompaniesApi.billingPreview().catch(() => null),
      ]);
      setCompanies(listRes.companies || []);
      setBilling(billingRes);
    } catch (err: any) {
      console.warn("[MinhasEmpresas] fetch error:", err?.message);
      toast.error("Erro ao carregar empresas");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function onRefresh() {
    setRefreshing(true);
    fetchData();
  }

  async function handleSwitchTo(c: FullCompany) {
    if (switching) return;
    if (c.id === currentCompany?.id) {
      toast.success("Você já está nesta empresa");
      return;
    }
    try {
      await switchCompany(c.id);
      // No web faz reload, no mobile o estado já atualizou
    } catch (err: any) {
      toast.error(err?.message || "Erro ao trocar empresa");
    }
  }

  async function handleRemove(c: FullCompany) {
    if (removingId) return;
    setRemovingId(c.id);
    try {
      const res = await userCompaniesApi.remove(c.id);
      toast.success(res.note || "Empresa removida");
      setConfirmRemove(null);
      // Atualiza lista local + recarrega switcher do auth store
      await fetchData();
      loadCompanies().catch(() => {});
    } catch (err: any) {
      const data = err?.data;
      if (data?.error === "HAS_SALES") {
        Alert.alert(
          "Não foi possível remover",
          data.message + "\n\nVendas registradas: " + data.sales_count,
        );
      } else if (data?.error === "CANNOT_REMOVE_PRIMARY") {
        Alert.alert("Empresa principal", data.message);
      } else {
        toast.error(err?.message || "Erro ao remover empresa");
      }
    } finally {
      setRemovingId(null);
    }
  }

  // M2-03: transfer-primary precisa que o user re-autentique pra que
  // o JWT venha com o novo company_id como primary. No web fazemos
  // reload pra forçar refetch de tudo; no mobile fazemos logout
  // (mais seguro do que tentar re-issue de token).
  async function handleTransferPrimary(c: FullCompany) {
    if (transferringId) return;
    setTransferringId(c.id);
    try {
      const res = await userCompaniesApi.transferPrimary(c.id);
      toast.success(res.message || `${res.new_primary.name} agora é a principal`);
      setConfirmTransfer(null);

      // Pequeno delay pra usuário ver o toast antes do reload/logout
      setTimeout(() => {
        if (Platform.OS === "web" && typeof window !== "undefined") {
          window.location.reload();
        } else {
          // Mobile: logout pra forçar novo JWT na próxima sessão
          logout();
        }
      }, 1500);
    } catch (err: any) {
      const data = err?.data;
      if (data?.error === "ALREADY_PRIMARY") {
        toast.info("Esta empresa já é a principal");
      } else if (data?.error === "NOT_ENOUGH_COMPANIES") {
        toast.error("Você precisa de pelo menos 2 empresas pra fazer isso");
      } else {
        toast.error(err?.message || "Erro ao tornar principal");
      }
      setTransferringId(null);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.bg }}>
        <ActivityIndicator color={C.violet} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
        <Pressable
          onPress={() => router.back()}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: C.bg2,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          <Icon name="chevron_left" size={16} color={C.ink} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 22, fontWeight: "800", color: C.ink, letterSpacing: -0.3 }}>
            Minhas empresas
          </Text>
          <Text style={{ fontSize: 12, color: C.ink3, marginTop: 2 }}>
            Gerencie todos os seus CNPJs em um só lugar
          </Text>
        </View>
      </View>

      {/* Card de cobrança consolidada */}
      {billing && (
        <View
          style={{
            backgroundColor: C.bg2,
            borderRadius: 16,
            padding: 18,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: C.border,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
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
              <Icon name="wallet" size={18} color="#7c3aed" />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 10,
                  color: C.ink3,
                  fontWeight: "700",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                Mensalidade total
              </Text>
              <Text
                style={{
                  fontSize: 28,
                  fontWeight: "800",
                  color: C.ink,
                  marginTop: 4,
                  letterSpacing: -0.5,
                }}
              >
                {formatBRL(billing.current.total_monthly)}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                <Tag label={planLabel(billing.current.plan)} color="#7c3aed" C={C} />
                <Tag
                  label={billing.current.total_companies + " empresa" + (billing.current.total_companies !== 1 ? "s" : "")}
                  color={C.ink3}
                  C={C}
                />
                {billing.current.extra_cnpjs > 0 && (
                  <Tag
                    label={billing.current.extra_cnpjs + " extra" + (billing.current.extra_cnpjs !== 1 ? "s" : "")}
                    color="#f59e0b"
                    C={C}
                  />
                )}
              </View>
              {billing.current.extra_cnpjs > 0 && (
                <Text style={{ fontSize: 11, color: C.ink3, marginTop: 8, lineHeight: 16 }}>
                  {formatBRL(billing.current.base_price)} (plano) + {billing.current.extra_cnpjs} × {formatBRL(billing.current.extra_unit_price)} = {formatBRL(billing.current.total_monthly)}
                </Text>
              )}
            </View>
          </View>
        </View>
      )}

      {/* Lista de empresas */}
      <Text
        style={{
          fontSize: 11,
          color: C.ink3,
          fontWeight: "700",
          textTransform: "uppercase",
          letterSpacing: 1,
          marginBottom: 8,
          paddingHorizontal: 4,
        }}
      >
        {companies.length} {companies.length === 1 ? "empresa cadastrada" : "empresas cadastradas"}
      </Text>

      {companies.map((c) => {
        const isCurrent = c.id === currentCompany?.id;
        const isRemoving = removingId === c.id;
        const isTransferring = transferringId === c.id;
        const hasMultipleCompanies = companies.length >= 2;
        return (
          <View
            key={c.id}
            style={{
              backgroundColor: C.bg2,
              borderRadius: 14,
              padding: 14,
              marginBottom: 10,
              borderWidth: 1,
              borderColor: isCurrent ? "#7c3aed" : C.border,
              opacity: isRemoving || isTransferring ? 0.5 : 1,
            }}
          >
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: isCurrent ? "#7c3aed" : C.bg4,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "700",
                    color: isCurrent ? "#fff" : C.ink3,
                  }}
                >
                  {(c.name || "?").charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <Text
                    style={{ fontSize: 14, fontWeight: "700", color: C.ink, flexShrink: 1 }}
                    numberOfLines={1}
                  >
                    {c.name || c.legal_name}
                  </Text>
                  {c.is_primary && (
                    <View
                      style={{
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 4,
                        backgroundColor: "#7c3aed20",
                      }}
                    >
                      <Text style={{ fontSize: 9, color: "#7c3aed", fontWeight: "700" }}>
                        PRINCIPAL
                      </Text>
                    </View>
                  )}
                  {isCurrent && (
                    <View
                      style={{
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 4,
                        backgroundColor: Colors.green + "20",
                      }}
                    >
                      <Text style={{ fontSize: 9, color: Colors.green, fontWeight: "700" }}>
                        ABERTA
                      </Text>
                    </View>
                  )}
                </View>
                {c.cnpj && (
                  <Text style={{ fontSize: 11, color: C.ink3, marginTop: 4 }}>
                    {maskCnpj(c.cnpj)}
                  </Text>
                )}
                <View style={{ flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                  <View
                    style={{
                      paddingHorizontal: 5,
                      paddingVertical: 1,
                      borderRadius: 3,
                      backgroundColor: planBadgeColor(c.plan) + "18",
                    }}
                  >
                    <Text style={{ fontSize: 9, color: planBadgeColor(c.plan), fontWeight: "600" }}>
                      {planLabel(c.plan)}
                    </Text>
                  </View>
                  {c.vertical && (
                    <View
                      style={{
                        paddingHorizontal: 5,
                        paddingVertical: 1,
                        borderRadius: 3,
                        backgroundColor: C.bg4,
                      }}
                    >
                      <Text style={{ fontSize: 9, color: C.ink3, fontWeight: "600" }}>
                        {c.vertical.toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Ações */}
            <View
              style={{
                flexDirection: "row",
                gap: 8,
                marginTop: 12,
                paddingTop: 12,
                borderTopWidth: 1,
                borderTopColor: C.border,
                flexWrap: "wrap",
              }}
            >
              {!isCurrent && (
                <Pressable
                  onPress={() => handleSwitchTo(c)}
                  disabled={switching || isRemoving || isTransferring}
                  style={{
                    flex: 1,
                    minWidth: 100,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    paddingVertical: 9,
                    borderRadius: 8,
                    backgroundColor: "#7c3aed",
                    opacity: switching ? 0.5 : 1,
                  }}
                >
                  {switching ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Icon name="chevron_right" size={12} color="#fff" />
                      <Text style={{ fontSize: 12, color: "#fff", fontWeight: "700" }}>
                        Abrir
                      </Text>
                    </>
                  )}
                </Pressable>
              )}
              {/* M2-03: botão "Tornar principal" — só aparece em não-primárias */}
              {!c.is_primary && hasMultipleCompanies && (
                <Pressable
                  onPress={() => setConfirmTransfer(c)}
                  disabled={isTransferring || isRemoving || switching}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    paddingVertical: 9,
                    paddingHorizontal: 14,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: "#7c3aed40",
                    backgroundColor: "#7c3aed10",
                  }}
                >
                  {isTransferring ? (
                    <ActivityIndicator size="small" color="#7c3aed" />
                  ) : (
                    <>
                      <Icon name="star" size={12} color="#7c3aed" />
                      <Text style={{ fontSize: 12, color: "#7c3aed", fontWeight: "700" }}>
                        Tornar principal
                      </Text>
                    </>
                  )}
                </Pressable>
              )}
              {!c.is_primary && (
                <Pressable
                  onPress={() => setConfirmRemove(c)}
                  disabled={isRemoving || switching || isTransferring}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    paddingVertical: 9,
                    paddingHorizontal: 14,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: "#dc262640",
                    backgroundColor: "#dc262610",
                  }}
                >
                  {isRemoving ? (
                    <ActivityIndicator size="small" color="#dc2626" />
                  ) : (
                    <>
                      <Icon name="trash" size={12} color="#dc2626" />
                      <Text style={{ fontSize: 12, color: "#dc2626", fontWeight: "700" }}>
                        Remover
                      </Text>
                    </>
                  )}
                </Pressable>
              )}
            </View>
          </View>
        );
      })}

      {/* CTA adicionar */}
      <Pressable
        onPress={() => setAddOpen(true)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          paddingVertical: 14,
          borderRadius: 12,
          borderWidth: 2,
          borderColor: "#7c3aed",
          borderStyle: "dashed",
          backgroundColor: "#7c3aed10",
          marginTop: 12,
        }}
      >
        <Icon name="plus" size={16} color="#7c3aed" />
        <Text style={{ fontSize: 14, color: "#7c3aed", fontWeight: "700" }}>
          Adicionar nova empresa
        </Text>
      </Pressable>

      {/* Hint sobre mensalidade ao adicionar */}
      {billing && billing.can_add && billing.if_add_one.delta_monthly > 0 && (
        <Text
          style={{
            fontSize: 11,
            color: C.ink3,
            textAlign: "center",
            marginTop: 8,
            lineHeight: 16,
          }}
        >
          Próxima empresa adicionará {formatBRL(billing.if_add_one.delta_monthly)} à sua mensalidade
        </Text>
      )}
      {billing && !billing.can_add && billing.block_reason && (
        <Text
          style={{
            fontSize: 11,
            color: "#f59e0b",
            textAlign: "center",
            marginTop: 8,
            lineHeight: 16,
          }}
        >
          {billing.block_reason}
        </Text>
      )}

      {/* Modal de confirmação de TRANSFER PRIMARY (M2-03) */}
      <Modal
        visible={!!confirmTransfer}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmTransfer(null)}
      >
        <Pressable
          onPress={() => setConfirmTransfer(null)}
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
              maxWidth: 460,
              backgroundColor: C.bg2,
              borderRadius: 16,
              padding: 20,
              borderWidth: 1,
              borderColor: C.border,
            }}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                backgroundColor: "#7c3aed20",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 12,
              }}
            >
              <Icon name="star" size={20} color="#7c3aed" />
            </View>
            <Text style={{ fontSize: 16, fontWeight: "700", color: C.ink, marginBottom: 8 }}>
              Tornar {confirmTransfer?.name || confirmTransfer?.legal_name} principal?
            </Text>
            <Text style={{ fontSize: 13, color: C.ink3, lineHeight: 19, marginBottom: 8 }}>
              Esta empresa passará a ser sua "principal". A empresa principal atual continuará ativa, mas vira secundária.
            </Text>
            <View
              style={{
                backgroundColor: "#f59e0b15",
                borderRadius: 10,
                padding: 12,
                borderWidth: 1,
                borderColor: "#f59e0b40",
                marginBottom: 16,
                flexDirection: "row",
                gap: 8,
              }}
            >
              <Icon name="alert" size={14} color="#f59e0b" />
              <Text style={{ fontSize: 12, color: "#f59e0b", flex: 1, lineHeight: 17 }}>
                {Platform.OS === "web"
                  ? "A página será recarregada para aplicar a mudança."
                  : "Você precisará fazer login novamente."}
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={() => setConfirmTransfer(null)}
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
                onPress={() => confirmTransfer && handleTransferPrimary(confirmTransfer)}
                disabled={!!transferringId}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 10,
                  backgroundColor: "#7c3aed",
                  alignItems: "center",
                  opacity: transferringId ? 0.5 : 1,
                }}
              >
                {transferringId ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ fontSize: 13, color: "#fff", fontWeight: "700" }}>
                    Sim, tornar principal
                  </Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal de confirmação de remoção */}
      <Modal
        visible={!!confirmRemove}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmRemove(null)}
      >
        <Pressable
          onPress={() => setConfirmRemove(null)}
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
              maxWidth: 420,
              backgroundColor: C.bg2,
              borderRadius: 16,
              padding: 20,
              borderWidth: 1,
              borderColor: C.border,
            }}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                backgroundColor: "#dc262620",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 12,
              }}
            >
              <Icon name="trash" size={20} color="#dc2626" />
            </View>
            <Text style={{ fontSize: 16, fontWeight: "700", color: C.ink, marginBottom: 8 }}>
              Remover {confirmRemove?.name || confirmRemove?.legal_name}?
            </Text>
            <Text style={{ fontSize: 13, color: C.ink3, lineHeight: 19, marginBottom: 16 }}>
              A empresa será desativada. O histórico de notas fiscais e dados cadastrais ficam preservados, mas você não poderá mais operá-la. Sua mensalidade será reduzida no próximo ciclo.
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={() => setConfirmRemove(null)}
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
                onPress={() => confirmRemove && handleRemove(confirmRemove)}
                disabled={!!removingId}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 10,
                  backgroundColor: "#dc2626",
                  alignItems: "center",
                  opacity: removingId ? 0.5 : 1,
                }}
              >
                {removingId ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ fontSize: 13, color: "#fff", fontWeight: "700" }}>
                    Sim, remover
                  </Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal de adicionar */}
      <AddCompanyModal
        visible={addOpen}
        onClose={() => {
          setAddOpen(false);
          // Refresh ao fechar (caso tenha criado)
          fetchData();
        }}
      />
    </ScrollView>
  );
}

function Tag({ label, color, C }: { label: string; color: string; C: ReturnType<typeof useColors> }) {
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 5,
        backgroundColor: color + "18",
      }}
    >
      <Text style={{ fontSize: 10, color, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}
