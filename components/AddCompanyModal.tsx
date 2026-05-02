// ============================================================
// AURA. — AddCompanyModal (Multi-CNPJ M1-08)
// Modal pra cadastrar empresa adicional. Reusa cnpjApi.lookup
// pra autocompletar dados a partir do CNPJ.
//
// Estados:
// - input: usuário preenche CNPJ + dados básicos
// - loading: criando empresa
// - success: mostra billing_preview + opção "Trocar agora"
// - plan-locked: usuário no Essencial → CTA upgrade
// ============================================================
import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useColors, Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { cnpjApi, ApiError } from "@/services/api";
import {
  maskCnpj,
  planLabel,
  type CreateCompanyResponse,
  type PlanLimitError,
} from "@/services/multicnpj";

type Props = {
  visible: boolean;
  onClose: () => void;
};

type Step = "form" | "success" | "plan-locked";

export function AddCompanyModal({ visible, onClose }: Props) {
  const C = useColors();
  const { addCompany, switchCompany, switching } = useAuthStore();

  const [step, setStep] = useState<Step>("form");
  const [cnpj, setCnpj] = useState("");
  const [legalName, setLegalName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planError, setPlanError] = useState<PlanLimitError | null>(null);
  const [created, setCreated] = useState<CreateCompanyResponse | null>(null);

  function reset() {
    setStep("form");
    setCnpj("");
    setLegalName("");
    setTradeName("");
    setEmail("");
    setPhone("");
    setLoading(false);
    setLookingUp(false);
    setError(null);
    setPlanError(null);
    setCreated(null);
  }

  function handleClose() {
    if (loading || switching) return;
    reset();
    onClose();
  }

  // Lookup CNPJ pra autocompletar
  async function handleLookup() {
    const clean = cnpj.replace(/\D/g, "");
    if (clean.length !== 14) {
      setError("CNPJ deve ter 14 dígitos");
      return;
    }
    setError(null);
    setLookingUp(true);
    try {
      const data: any = await cnpjApi.lookup(clean);
      // O endpoint retorna shape variável (depende do backend). Mapeamos os
      // campos mais comuns sem assumir estrutura rígida.
      const ln =
        data?.legal_name ||
        data?.razao_social ||
        data?.nome_empresarial ||
        data?.company?.legal_name ||
        "";
      const tn =
        data?.trade_name ||
        data?.fantasia ||
        data?.nome_fantasia ||
        data?.company?.trade_name ||
        "";
      const em = data?.email || data?.company?.email || "";
      const ph =
        data?.phone || data?.telefone || data?.company?.phone || "";

      if (ln) setLegalName(ln);
      if (tn) setTradeName(tn);
      if (em && !email) setEmail(em);
      if (ph && !phone) setPhone(ph);

      if (!ln && !tn) {
        setError("Não conseguimos encontrar dados desse CNPJ. Preencha manualmente.");
      }
    } catch (err: any) {
      setError(
        err instanceof ApiError ? err.message : "Erro ao consultar CNPJ. Preencha manualmente."
      );
    } finally {
      setLookingUp(false);
    }
  }

  async function handleSubmit() {
    if (!legalName.trim() || legalName.trim().length < 2) {
      setError("Razão social é obrigatória");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await addCompany({
        legal_name: legalName.trim(),
        trade_name: tradeName.trim() || undefined,
        cnpj: cnpj.replace(/\D/g, "") || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      setCreated(res);
      setStep("success");
    } catch (err: any) {
      const data = err instanceof ApiError ? (err.data as any) : null;
      if (data && data.error === "PLAN_LIMIT_REACHED") {
        setPlanError(data as PlanLimitError);
        setStep("plan-locked");
      } else if (data && data.error === "DUPLICATE_CNPJ") {
        setError(data.message || "Este CNPJ já está cadastrado.");
      } else {
        setError(err?.message || "Erro ao criar empresa. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSwitchToNew() {
    if (!created?.company?.id) return;
    try {
      await switchCompany(created.company.id);
      // No web, switchCompany faz reload (não chega aqui). No mobile, fecha o modal.
      handleClose();
    } catch (err) {
      console.warn("[AddCompanyModal] switch failed:", err);
      handleClose();
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <Pressable
        onPress={handleClose}
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
            maxWidth: 480,
            maxHeight: "92%",
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
              paddingHorizontal: 18,
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderBottomColor: C.border,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  backgroundColor: "#7c3aed20",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon
                  name={
                    step === "success"
                      ? "check"
                      : step === "plan-locked"
                      ? "lock"
                      : "plus"
                  }
                  size={16}
                  color="#7c3aed"
                />
              </View>
              <Text style={{ fontSize: 15, fontWeight: "700", color: C.ink }}>
                {step === "success"
                  ? "Empresa cadastrada"
                  : step === "plan-locked"
                  ? "Upgrade necessário"
                  : "Adicionar empresa"}
              </Text>
            </View>
            <Pressable
              onPress={handleClose}
              disabled={loading || switching}
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                backgroundColor: C.bg4,
                alignItems: "center",
                justifyContent: "center",
                opacity: loading || switching ? 0.4 : 1,
              }}
            >
              <Icon name="x" size={14} color={C.ink3} />
            </Pressable>
          </View>

          <ScrollView
            style={{ maxHeight: 540 }}
            contentContainerStyle={{ padding: 18 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* ─── FORM step ─── */}
            {step === "form" && (
              <View style={{ gap: 14 }}>
                <Text style={{ fontSize: 12, color: C.ink3, lineHeight: 18 }}>
                  Cadastre outro CNPJ que você gerencia. As empresas ficam separadas
                  (estoque, financeiro, NF-e), mas você acessa todas com o mesmo login.
                </Text>

                {/* CNPJ + lookup */}
                <View>
                  <Text style={{ fontSize: 11, color: C.ink3, fontWeight: "600", marginBottom: 6 }}>
                    CNPJ
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TextInput
                      value={cnpj}
                      onChangeText={(v) => {
                        // Aplica máscara conforme digita
                        const nums = v.replace(/\D/g, "").slice(0, 14);
                        setCnpj(maskCnpj(nums) || nums);
                      }}
                      placeholder="00.000.000/0000-00"
                      placeholderTextColor={C.ink3 + "88"}
                      keyboardType="numeric"
                      style={{
                        flex: 1,
                        backgroundColor: C.bg4,
                        borderWidth: 1,
                        borderColor: C.border,
                        borderRadius: 10,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        fontSize: 13,
                        color: C.ink,
                      }}
                    />
                    <Pressable
                      onPress={handleLookup}
                      disabled={lookingUp || cnpj.replace(/\D/g, "").length !== 14}
                      style={{
                        paddingHorizontal: 14,
                        borderRadius: 10,
                        backgroundColor: "#7c3aed",
                        alignItems: "center",
                        justifyContent: "center",
                        opacity:
                          lookingUp || cnpj.replace(/\D/g, "").length !== 14 ? 0.5 : 1,
                      }}
                    >
                      {lookingUp ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>
                          Buscar
                        </Text>
                      )}
                    </Pressable>
                  </View>
                  <Text style={{ fontSize: 10, color: C.ink3, marginTop: 4 }}>
                    Opcional, mas autocompleta os dados
                  </Text>
                </View>

                {/* Razão social */}
                <View>
                  <Text style={{ fontSize: 11, color: C.ink3, fontWeight: "600", marginBottom: 6 }}>
                    Razão social *
                  </Text>
                  <TextInput
                    value={legalName}
                    onChangeText={setLegalName}
                    placeholder="Nome registrado na Receita"
                    placeholderTextColor={C.ink3 + "88"}
                    style={{
                      backgroundColor: C.bg4,
                      borderWidth: 1,
                      borderColor: C.border,
                      borderRadius: 10,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      fontSize: 13,
                      color: C.ink,
                    }}
                  />
                </View>

                {/* Nome fantasia */}
                <View>
                  <Text style={{ fontSize: 11, color: C.ink3, fontWeight: "600", marginBottom: 6 }}>
                    Nome fantasia
                  </Text>
                  <TextInput
                    value={tradeName}
                    onChangeText={setTradeName}
                    placeholder="Como o cliente conhece"
                    placeholderTextColor={C.ink3 + "88"}
                    style={{
                      backgroundColor: C.bg4,
                      borderWidth: 1,
                      borderColor: C.border,
                      borderRadius: 10,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      fontSize: 13,
                      color: C.ink,
                    }}
                  />
                </View>

                {/* Email + telefone (linha) */}
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ fontSize: 11, color: C.ink3, fontWeight: "600", marginBottom: 6 }}
                    >
                      Email
                    </Text>
                    <TextInput
                      value={email}
                      onChangeText={setEmail}
                      placeholder="contato@empresa.com"
                      placeholderTextColor={C.ink3 + "88"}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      style={{
                        backgroundColor: C.bg4,
                        borderWidth: 1,
                        borderColor: C.border,
                        borderRadius: 10,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        fontSize: 13,
                        color: C.ink,
                      }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ fontSize: 11, color: C.ink3, fontWeight: "600", marginBottom: 6 }}
                    >
                      Telefone
                    </Text>
                    <TextInput
                      value={phone}
                      onChangeText={setPhone}
                      placeholder="(11) 99999-0000"
                      placeholderTextColor={C.ink3 + "88"}
                      keyboardType="phone-pad"
                      style={{
                        backgroundColor: C.bg4,
                        borderWidth: 1,
                        borderColor: C.border,
                        borderRadius: 10,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        fontSize: 13,
                        color: C.ink,
                      }}
                    />
                  </View>
                </View>

                {/* Erro */}
                {error && (
                  <View
                    style={{
                      backgroundColor: "#dc262610",
                      borderWidth: 1,
                      borderColor: "#dc262640",
                      borderRadius: 10,
                      padding: 10,
                      flexDirection: "row",
                      gap: 8,
                      alignItems: "flex-start",
                    }}
                  >
                    <Icon name="info" size={14} color="#dc2626" />
                    <Text style={{ fontSize: 11, color: "#dc2626", flex: 1, lineHeight: 16 }}>
                      {error}
                    </Text>
                  </View>
                )}

                {/* Aviso Multi-CNPJ pricing */}
                <View
                  style={{
                    backgroundColor: "#7c3aed10",
                    borderWidth: 1,
                    borderColor: "#7c3aed30",
                    borderRadius: 10,
                    padding: 10,
                    flexDirection: "row",
                    gap: 8,
                    alignItems: "flex-start",
                  }}
                >
                  <Icon name="info" size={14} color="#7c3aed" />
                  <Text style={{ fontSize: 11, color: C.ink, flex: 1, lineHeight: 16 }}>
                    Sua assinatura cobre 2 CNPJs no Negócio/Expansão. CNPJs adicionais têm
                    valor extra que vamos te mostrar antes de confirmar.
                  </Text>
                </View>
              </View>
            )}

            {/* ─── SUCCESS step ─── */}
            {step === "success" && created && (
              <View style={{ gap: 14 }}>
                <View
                  style={{
                    backgroundColor: Colors.green + "15",
                    borderWidth: 1,
                    borderColor: Colors.green + "40",
                    borderRadius: 10,
                    padding: 14,
                    alignItems: "center",
                  }}
                >
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      backgroundColor: Colors.green,
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 10,
                    }}
                  >
                    <Icon name="check" size={22} color="#fff" />
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: C.ink }}>
                    {created.company.name}
                  </Text>
                  <Text style={{ fontSize: 11, color: C.ink3, marginTop: 4 }}>
                    {created.message}
                  </Text>
                </View>

                {/* Billing preview */}
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: C.border,
                    borderRadius: 10,
                    padding: 12,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      color: C.ink3,
                      fontWeight: "700",
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      marginBottom: 8,
                    }}
                  >
                    Sua nova mensalidade
                  </Text>
                  <View style={{ gap: 6 }}>
                    <Row
                      label="Empresas total"
                      value={String(created.billing_preview.total_companies)}
                      C={C}
                    />
                    <Row
                      label="Inclusas no plano"
                      value={String(created.billing_preview.included_in_plan)}
                      C={C}
                    />
                    <Row
                      label={"CNPJs extras × R$ " + created.billing_preview.extra_unit_price}
                      value={"R$ " + created.billing_preview.extras_price.toFixed(2)}
                      C={C}
                    />
                    <View style={{ height: 1, backgroundColor: C.border, marginVertical: 6 }} />
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: "700", color: C.ink }}>Total/mês</Text>
                      <Text style={{ fontSize: 18, fontWeight: "800", color: "#7c3aed" }}>
                        R$ {created.billing_preview.new_total_monthly.toFixed(2)}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 10, color: C.ink3, marginTop: 8, lineHeight: 14 }}>
                    {created.billing_preview.note}
                  </Text>
                </View>

                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable
                    onPress={handleClose}
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
                      Continuar na atual
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleSwitchToNew}
                    disabled={switching}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 10,
                      backgroundColor: "#7c3aed",
                      alignItems: "center",
                      opacity: switching ? 0.6 : 1,
                    }}
                  >
                    {switching ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={{ fontSize: 13, color: "#fff", fontWeight: "700" }}>
                        Abrir essa empresa
                      </Text>
                    )}
                  </Pressable>
                </View>
              </View>
            )}

            {/* ─── PLAN-LOCKED step ─── */}
            {step === "plan-locked" && planError && (
              <View style={{ gap: 14 }}>
                <View
                  style={{
                    backgroundColor: "#7c3aed10",
                    borderWidth: 1,
                    borderColor: "#7c3aed30",
                    borderRadius: 10,
                    padding: 14,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        backgroundColor: "#7c3aed",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon name="lock" size={16} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: C.ink }}>
                        Plano {planLabel(planError.current_plan)}
                      </Text>
                      <Text style={{ fontSize: 11, color: C.ink3, marginTop: 2 }}>
                        Inclui apenas 1 CNPJ
                      </Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 12, color: C.ink, lineHeight: 18 }}>
                    {planError.message}
                  </Text>
                </View>

                <View
                  style={{
                    borderWidth: 2,
                    borderColor: "#7c3aed",
                    borderRadius: 12,
                    padding: 14,
                    backgroundColor: C.bg4,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ fontSize: 11, color: "#7c3aed", fontWeight: "700" }}>
                      RECOMENDADO
                    </Text>
                  </View>
                  <Text
                    style={{ fontSize: 18, fontWeight: "800", color: C.ink, marginTop: 4 }}
                  >
                    Plano {planLabel(planError.suggested_plan)}
                  </Text>
                  <Text
                    style={{ fontSize: 13, color: "#7c3aed", fontWeight: "700", marginTop: 2 }}
                  >
                    R$ {planError.suggested_plan_price.toFixed(2)}/mês
                  </Text>
                  <Text style={{ fontSize: 11, color: C.ink3, marginTop: 8, lineHeight: 16 }}>
                    {planError.upgrade_savings_note}
                  </Text>
                </View>

                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable
                    onPress={handleClose}
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
                      Agora não
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      handleClose();
                      // Redireciona pra Configurações > Faturamento
                      try {
                        // eslint-disable-next-line @typescript-eslint/no-var-requires
                        const { router } = require("expo-router");
                        router.push("/configuracoes");
                      } catch {}
                    }}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 10,
                      backgroundColor: "#7c3aed",
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ fontSize: 13, color: "#fff", fontWeight: "700" }}>
                      Ver planos
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Footer com botão criar (apenas no step form) */}
          {step === "form" && (
            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: C.border,
                padding: 14,
                flexDirection: "row",
                gap: 8,
              }}
            >
              <Pressable
                onPress={handleClose}
                disabled={loading}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: C.border,
                  alignItems: "center",
                  opacity: loading ? 0.5 : 1,
                }}
              >
                <Text style={{ fontSize: 13, color: C.ink, fontWeight: "600" }}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={handleSubmit}
                disabled={loading || !legalName.trim()}
                style={{
                  flex: 2,
                  paddingVertical: 12,
                  borderRadius: 10,
                  backgroundColor: "#7c3aed",
                  alignItems: "center",
                  opacity: loading || !legalName.trim() ? 0.5 : 1,
                }}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ fontSize: 13, color: "#fff", fontWeight: "700" }}>
                    Cadastrar empresa
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

function Row({
  label,
  value,
  C,
}: {
  label: string;
  value: string;
  C: ReturnType<typeof useColors>;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <Text style={{ fontSize: 11, color: C.ink3 }}>{label}</Text>
      <Text style={{ fontSize: 12, color: C.ink, fontWeight: "600" }}>{value}</Text>
    </View>
  );
}
