import { useState, useMemo, useEffect } from "react";
import { View, Text, Modal, Pressable, TextInput, ActivityIndicator } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import { Icon } from "@/components/Icon";
import { DentalColors } from "@/constants/dental-tokens";
import { invalidateDentalFinancials } from "@/lib/dentalQueryHelpers";

// ============================================================
// MarkTissGuidePaidModal — reconciliacao manual de guia TISS.
//
// Marca uma guia TISS como paga informando valor recebido +
// valor glosado. Backend (PR13) deduz o status automaticamente:
//   - paid > 0 e glossed === 0 → paga
//   - paid > 0 e glossed > 0   → paga_parcial
//   - paid === 0 e glossed > 0 → negada
//
// Trigger 067 (dental_tiss_guide_to_transaction) dispara em
// paid_at/paid_value e cria transaction (income, receita_tiss)
// automaticamente no DRE generico.
//
// Pra reconciliacao em LOTE via XML retorno, ver POST
// /dental/tiss/batches/:bid/return (UI fica pra outra sprint).
// ============================================================

export interface PendingTissGuide {
  id: string;
  guide_number: string;
  patient_name: string;
  insurance_name: string;
  total_value: number | string;
}

interface Props {
  guide: PendingTissGuide | null;
  onClose: () => void;
}

function fmtBRL(n: number): string {
  return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function todayISODate(): string {
  const d = new Date();
  return d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0");
}

function parseMoney(s: string): number {
  if (!s) return 0;
  const cleaned = s.replace(/[^0-9,.-]/g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

export function MarkTissGuidePaidModal({ guide, onClose }: Props) {
  const cid = useAuthStore().company?.id;
  const qc = useQueryClient();

  const totalValue = useMemo(() => {
    if (!guide) return 0;
    return typeof guide.total_value === "string" ? parseFloat(guide.total_value) : guide.total_value;
  }, [guide]);

  const [paidValue, setPaidValue] = useState("");
  const [glossedValue, setGlossedValue] = useState("");
  const [paidAt, setPaidAt] = useState(todayISODate());
  const [glossedCodes, setGlossedCodes] = useState("");

  // Quando guia muda, popular defaults
  useEffect(() => {
    if (guide) {
      setPaidValue(totalValue.toFixed(2).replace(".", ","));
      setGlossedValue("0,00");
      setPaidAt(todayISODate());
      setGlossedCodes("");
    }
  }, [guide?.id, totalValue]);

  const paid = parseMoney(paidValue);
  const glossed = parseMoney(glossedValue);
  const sum = paid + glossed;
  const overflow = sum > totalValue + 0.01; // tolerancia 1 centavo
  const inferredStatus =
    paid > 0 && glossed === 0      ? "Paga integral" :
    paid > 0 && glossed > 0        ? "Paga parcial"  :
    paid === 0 && glossed > 0      ? "Negada"        :
                                     "Sem mudança";

  const mut = useMutation({
    mutationFn: () => {
      // Glossed codes: parse linha-a-linha (cada linha vira string).
      // Backend serializa como jsonb (array de strings).
      const codes = glossedCodes
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);

      return request(
        `/companies/${cid}/dental/tiss/guides/${guide!.id}`,
        {
          method: "PATCH",
          body: {
            paid_value: paid,
            glossed_value: glossed,
            paid_at: new Date(paidAt + "T12:00:00").toISOString(),
            glossed_codes: codes.length > 0 ? codes : [],
          },
          retry: 0,
        }
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tiss-guides"] });
      qc.invalidateQueries({ queryKey: ["tiss-guides-pending"] });
      qc.invalidateQueries({ queryKey: ["tiss-batches"] });
      invalidateDentalFinancials(qc);
      toast.success("Guia reconciliada");
      handleClose();
    },
    onError: (err: any) => {
      toast.error(err?.data?.error || err?.message || "Erro ao reconciliar guia");
    },
  });

  function handleClose() {
    setPaidValue("");
    setGlossedValue("");
    setGlossedCodes("");
    onClose();
  }

  if (!guide) return null;

  const canSubmit = paid > 0 || glossed > 0;

  return (
    <Modal visible animationType="fade" transparent onRequestClose={handleClose}>
      <View style={{
        flex: 1, backgroundColor: "rgba(0,0,0,0.7)",
        alignItems: "center", justifyContent: "center", padding: 20,
      }}>
        <View style={{
          width: "100%", maxWidth: 480,
          backgroundColor: DentalColors.bg2,
          borderRadius: 16, padding: 22,
          borderWidth: 1, borderColor: DentalColors.border,
        }}>
          {/* Header */}
          <View style={{ marginBottom: 18 }}>
            <Text style={{
              fontSize: 9, color: DentalColors.cyan, fontWeight: "700",
              letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 4,
              fontFamily: "JetBrains Mono, monospace" as any,
            }}>RECONCILIAÇÃO TISS</Text>
            <Text style={{ fontSize: 18, fontWeight: "700", color: DentalColors.ink, marginBottom: 4, letterSpacing: -0.3 }}>
              {guide.guide_number}
            </Text>
            <Text style={{ fontSize: 13, color: DentalColors.ink2 }}>
              <Text style={{ fontWeight: "600", color: DentalColors.ink }}>{guide.patient_name}</Text>
              {"  ·  "}
              {guide.insurance_name}
            </Text>
            <View style={{
              marginTop: 12, padding: 10,
              backgroundColor: DentalColors.cyanGhost,
              borderRadius: 8, borderWidth: 1, borderColor: DentalColors.cyanBorder,
            }}>
              <Text style={{ fontSize: 10, color: DentalColors.ink3, fontWeight: "600", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 2 }}>
                Valor previsto
              </Text>
              <Text style={{ fontSize: 22, fontWeight: "800", color: DentalColors.cyan, letterSpacing: -0.3 }}>
                {fmtBRL(totalValue)}
              </Text>
            </View>
          </View>

          {/* Inputs valor recebido + glosa */}
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, color: DentalColors.ink3, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 6 }}>
                Valor recebido
              </Text>
              <TextInput
                value={paidValue}
                onChangeText={setPaidValue}
                keyboardType="decimal-pad"
                placeholder="0,00"
                placeholderTextColor={DentalColors.ink3}
                style={{
                  backgroundColor: "rgba(255,255,255,0.04)",
                  borderRadius: 10, padding: 12,
                  fontSize: 15, color: DentalColors.ink, fontWeight: "600",
                  borderWidth: 1, borderColor: DentalColors.border,
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, color: DentalColors.ink3, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 6 }}>
                Valor glosado
              </Text>
              <TextInput
                value={glossedValue}
                onChangeText={setGlossedValue}
                keyboardType="decimal-pad"
                placeholder="0,00"
                placeholderTextColor={DentalColors.ink3}
                style={{
                  backgroundColor: "rgba(255,255,255,0.04)",
                  borderRadius: 10, padding: 12,
                  fontSize: 15, color: DentalColors.ink, fontWeight: "600",
                  borderWidth: 1, borderColor: DentalColors.border,
                }}
              />
            </View>
          </View>

          {/* Data + status inferido */}
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, color: DentalColors.ink3, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 6 }}>
                Data do pagamento
              </Text>
              {/* Web: input type date | Native: text fallback */}
              {/* @ts-ignore: html input type pra web */}
              <TextInput
                value={paidAt}
                onChangeText={setPaidAt}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={DentalColors.ink3}
                {...({ type: "date" } as any)}
                style={{
                  backgroundColor: "rgba(255,255,255,0.04)",
                  borderRadius: 10, padding: 12,
                  fontSize: 13, color: DentalColors.ink,
                  borderWidth: 1, borderColor: DentalColors.border,
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, color: DentalColors.ink3, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 6 }}>
                Status final
              </Text>
              <View style={{
                backgroundColor: "rgba(255,255,255,0.02)",
                borderRadius: 10, padding: 12,
                borderWidth: 1, borderColor: DentalColors.border,
              }}>
                <Text style={{ fontSize: 13, color: canSubmit ? DentalColors.cyan : DentalColors.ink3, fontWeight: "600" }}>
                  {inferredStatus}
                </Text>
              </View>
            </View>
          </View>

          {/* Codigos de glosa (opcional) */}
          {glossed > 0 && (
            <View style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 10, color: DentalColors.ink3, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 6 }}>
                Códigos de glosa (opcional, um por linha)
              </Text>
              <TextInput
                value={glossedCodes}
                onChangeText={setGlossedCodes}
                placeholder={"1234\n5678"}
                placeholderTextColor={DentalColors.ink3}
                multiline
                numberOfLines={3}
                style={{
                  backgroundColor: "rgba(255,255,255,0.04)",
                  borderRadius: 10, padding: 10,
                  fontSize: 12, color: DentalColors.ink,
                  borderWidth: 1, borderColor: DentalColors.border,
                  minHeight: 64, textAlignVertical: "top" as any,
                  fontFamily: "JetBrains Mono, monospace" as any,
                }}
              />
            </View>
          )}

          {/* Aviso de overflow */}
          {overflow && (
            <View style={{
              flexDirection: "row", alignItems: "center", gap: 8,
              backgroundColor: "rgba(239,68,68,0.06)",
              borderRadius: 8, padding: 10, marginBottom: 14,
              borderWidth: 1, borderColor: "rgba(239,68,68,0.25)",
            }}>
              <Icon name="alert" size={13} color={DentalColors.red} />
              <Text style={{ fontSize: 11, color: DentalColors.ink2, flex: 1 }}>
                Soma de recebido + glosa ({fmtBRL(sum)}) excede o total previsto ({fmtBRL(totalValue)}).
                Confira os valores antes de confirmar.
              </Text>
            </View>
          )}

          {/* Acoes */}
          <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
            <Pressable
              onPress={handleClose}
              disabled={mut.isPending}
              style={{
                paddingHorizontal: 14, paddingVertical: 10,
                borderRadius: 8, borderWidth: 1, borderColor: DentalColors.border,
              }}
            >
              <Text style={{ fontSize: 12, color: DentalColors.ink2, fontWeight: "500" }}>Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={() => mut.mutate()}
              disabled={mut.isPending || !canSubmit}
              style={{
                paddingHorizontal: 18, paddingVertical: 10,
                borderRadius: 8, backgroundColor: DentalColors.cyan,
                opacity: (mut.isPending || !canSubmit) ? 0.6 : 1,
                flexDirection: "row", alignItems: "center", gap: 6,
                minWidth: 200, justifyContent: "center",
              }}
            >
              {mut.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Icon name="check" size={13} color="#fff" />
                  <Text style={{ fontSize: 12, color: "#fff", fontWeight: "700" }}>
                    Confirmar reconciliação
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default MarkTissGuidePaidModal;
