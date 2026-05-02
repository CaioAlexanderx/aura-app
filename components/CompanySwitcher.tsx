// ============================================================
// AURA. — CompanySwitcher (Multi-CNPJ M1-06)
// Dropdown na sidebar pra trocar de empresa, ver "Todas" e
// adicionar nova empresa. Renderiza em 3 estados:
//   - 1 empresa: mostra info dela, dropdown com "+ Adicionar"
//   - 2+ empresas: lista todas + opção "Todas as empresas"
//   - 0 (loading): placeholder
// ============================================================
import { useState, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  Platform,
  ActivityIndicator,
  Modal,
  ScrollView,
} from "react-native";
import { useColors, Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { planLabel, maskCnpj, type SwitcherCompany } from "@/services/multicnpj";
import { AddCompanyModal } from "@/components/AddCompanyModal";

type Props = {
  collapsed?: boolean;
  /** Quando true, renderiza otimizado pra MBar mobile (sem chevron, layout horizontal). */
  variant?: "sidebar" | "mobile";
};

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

export function CompanySwitcher({ collapsed = false, variant = "sidebar" }: Props) {
  const C = useColors();
  const {
    company,
    availableCompanies,
    consolidatedView,
    companiesLoading,
    switching,
    switchCompany,
    loadCompanies,
  } = useAuthStore();

  const [open, setOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const currentName = consolidatedView
    ? "Todas as empresas"
    : company?.name || company?.legal_name || (companiesLoading ? "Carregando…" : "Sem empresa");
  const currentPlan = consolidatedView ? "Consolidado" : company?.plan ? planLabel(company.plan) : "—";
  const currentBadgeColor = consolidatedView ? "#7c3aed" : planBadgeColor(company?.plan || "");

  const list = availableCompanies;
  const hasMultiple = list.length >= 2;

  // Quando o dropdown abre, garante que a lista está atualizada
  function handleOpen() {
    setOpen(true);
    if (!companiesLoading && list.length === 0) {
      loadCompanies().catch(() => {});
    }
  }

  async function handlePick(companyId: string | "all") {
    if (switching) return;
    setOpen(false);
    try {
      await switchCompany(companyId);
    } catch (err: any) {
      // No mobile, mostra alerta. No web, o reload já faz o rollback visual.
      if (Platform.OS !== "web") {
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const Alert = require("react-native").Alert;
          Alert.alert("Erro ao trocar empresa", err?.message || "Tente novamente");
        } catch {}
      }
    }
  }

  // ── Renderização: trigger button (visível na sidebar) ────
  if (collapsed) {
    // Modo colapsado: mostra apenas ícone com tooltip
    return (
      <>
        <Pressable
          onPress={handleOpen}
          style={{
            alignSelf: "center",
            width: 34,
            height: 34,
            borderRadius: 10,
            backgroundColor: C.bg4,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 6,
            borderWidth: 1,
            borderColor: C.border,
          }}
          {...(Platform.OS === "web" ? { title: currentName + " · " + currentPlan } : {})}
        >
          <Icon name="building" size={16} color={C.ink3} />
        </Pressable>
        <DropdownModal
          visible={open}
          onClose={() => setOpen(false)}
          list={list}
          currentCompanyId={company?.id || null}
          consolidatedView={consolidatedView}
          hasMultiple={hasMultiple}
          companiesLoading={companiesLoading}
          switching={switching}
          onPick={handlePick}
          onAdd={() => {
            setOpen(false);
            setAddOpen(true);
          }}
          C={C}
        />
        <AddCompanyModal visible={addOpen} onClose={() => setAddOpen(false)} />
      </>
    );
  }

  return (
    <>
      <Pressable
        onPress={handleOpen}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingVertical: 8,
          paddingHorizontal: 10,
          borderRadius: 10,
          backgroundColor: C.bg4,
          borderWidth: 1,
          borderColor: C.border,
          marginBottom: 4,
        }}
      >
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            backgroundColor: C.bg2,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name={consolidatedView ? "globe" : "building"} size={14} color={C.ink3} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{ fontSize: 12, color: C.ink, fontWeight: "600" }}
            numberOfLines={1}
          >
            {currentName}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
            <View
              style={{
                paddingHorizontal: 5,
                paddingVertical: 1,
                borderRadius: 4,
                backgroundColor: currentBadgeColor + "20",
              }}
            >
              <Text style={{ fontSize: 9, color: currentBadgeColor, fontWeight: "600" }}>
                {currentPlan}
              </Text>
            </View>
            {hasMultiple && (
              <Text style={{ fontSize: 9, color: C.ink3 }}>
                {list.length} empresas
              </Text>
            )}
          </View>
        </View>
        {switching ? (
          <ActivityIndicator size="small" color={C.ink3} />
        ) : (
          <Icon name="chevron_down" size={12} color={C.ink3} />
        )}
      </Pressable>

      <DropdownModal
        visible={open}
        onClose={() => setOpen(false)}
        list={list}
        currentCompanyId={company?.id || null}
        consolidatedView={consolidatedView}
        hasMultiple={hasMultiple}
        companiesLoading={companiesLoading}
        switching={switching}
        onPick={handlePick}
        onAdd={() => {
          setOpen(false);
          setAddOpen(true);
        }}
        C={C}
      />
      <AddCompanyModal visible={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}

// ── Dropdown modal (renderiza igual em web e mobile) ───────
function DropdownModal({
  visible,
  onClose,
  list,
  currentCompanyId,
  consolidatedView,
  hasMultiple,
  companiesLoading,
  switching,
  onPick,
  onAdd,
  C,
}: {
  visible: boolean;
  onClose: () => void;
  list: SwitcherCompany[];
  currentCompanyId: string | null;
  consolidatedView: boolean;
  hasMultiple: boolean;
  companiesLoading: boolean;
  switching: boolean;
  onPick: (id: string | "all") => void;
  onAdd: () => void;
  C: ReturnType<typeof useColors>;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
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
            maxHeight: "80%",
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
              justifyContent: "space-between",
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderBottomColor: C.border,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "700", color: C.ink }}>
              Suas empresas
            </Text>
            <Pressable
              onPress={onClose}
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                backgroundColor: C.bg4,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="close" size={14} color={C.ink3} />
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: 380 }}>
            {/* Loading */}
            {companiesLoading && list.length === 0 && (
              <View style={{ padding: 24, alignItems: "center" }}>
                <ActivityIndicator color={C.ink3} />
                <Text style={{ fontSize: 12, color: C.ink3, marginTop: 8 }}>
                  Carregando empresas…
                </Text>
              </View>
            )}

            {/* Modo "Todas as empresas" */}
            {hasMultiple && (
              <Pressable
                onPress={() => onPick("all")}
                disabled={switching}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: C.border,
                  backgroundColor: consolidatedView ? C.violetD : "transparent",
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: consolidatedView ? "#7c3aed" : C.bg4,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name="globe" size={16} color={consolidatedView ? "#fff" : C.ink3} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: C.ink }}>
                    Todas as empresas
                  </Text>
                  <Text style={{ fontSize: 11, color: C.ink3, marginTop: 2 }}>
                    Visão consolidada das {list.length} empresas
                  </Text>
                </View>
                {consolidatedView && <Icon name="check" size={16} color="#7c3aed" />}
              </Pressable>
            )}

            {/* Lista de empresas */}
            {list.map((c) => {
              const isCurrent = !consolidatedView && c.id === currentCompanyId;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => onPick(c.id)}
                  disabled={switching}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: C.border,
                    backgroundColor: isCurrent ? C.violetD : "transparent",
                    opacity: switching ? 0.6 : 1,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      backgroundColor: isCurrent ? "#7c3aed" : C.bg4,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "700",
                        color: isCurrent ? "#fff" : C.ink3,
                      }}
                    >
                      {(c.name || "?").charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text
                        style={{ fontSize: 13, fontWeight: "600", color: C.ink, flexShrink: 1 }}
                        numberOfLines={1}
                      >
                        {c.name || c.legal_name}
                      </Text>
                      {c.is_primary && (
                        <View
                          style={{
                            paddingHorizontal: 5,
                            paddingVertical: 1,
                            borderRadius: 4,
                            backgroundColor: "#7c3aed20",
                          }}
                        >
                          <Text style={{ fontSize: 8, color: "#7c3aed", fontWeight: "700" }}>
                            PRINCIPAL
                          </Text>
                        </View>
                      )}
                    </View>
                    <View
                      style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}
                    >
                      {c.cnpj && (
                        <Text style={{ fontSize: 10, color: C.ink3 }}>{maskCnpj(c.cnpj)}</Text>
                      )}
                      <View
                        style={{
                          paddingHorizontal: 4,
                          paddingVertical: 1,
                          borderRadius: 3,
                          backgroundColor: planBadgeColor(c.plan) + "18",
                        }}
                      >
                        <Text
                          style={{ fontSize: 9, color: planBadgeColor(c.plan), fontWeight: "600" }}
                        >
                          {planLabel(c.plan)}
                        </Text>
                      </View>
                    </View>
                  </View>
                  {isCurrent && <Icon name="check" size={16} color="#7c3aed" />}
                </Pressable>
              );
            })}

            {/* Botão Adicionar */}
            <Pressable
              onPress={onAdd}
              disabled={switching}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingHorizontal: 16,
                paddingVertical: 14,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: C.border2,
                  borderStyle: "dashed",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="plus" size={16} color="#7c3aed" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#7c3aed" }}>
                  Adicionar empresa
                </Text>
                <Text style={{ fontSize: 11, color: C.ink3, marginTop: 2 }}>
                  Cadastre outro CNPJ que você gerencia
                </Text>
              </View>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
