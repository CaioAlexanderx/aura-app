import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, TextInput, Platform, ActivityIndicator } from "react-native";
import { FoodColors } from "@/constants/food-tokens";
import { Icon } from "@/components/Icon";
import { useConfirmDelivery, type DispatchInRouteOrder } from "@/hooks/useFoodDispatch";

// ============================================================
// ConfirmDeliveryModal — input de PIN 4 dígitos.
// PIN errado: shake na linha de inputs + erro vermelho.
// PIN OK: invalida queries + fecha (toast é do parent).
// ============================================================

export function ConfirmDeliveryModal({
  order,
  onClose,
  onConfirmed,
}: {
  order: DispatchInRouteOrder;
  onClose: () => void;
  onConfirmed?: () => void;
}) {
  const confirmMut = useConfirmDelivery();
  const [digits, setDigits] = useState<string[]>(["", "", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const inputs = useRef<Array<TextInput | null>>([null, null, null, null]);

  const pin = digits.join("");
  const canSubmit = pin.length === 4 && !confirmMut.isPending;

  const handleChange = (idx: number, value: string) => {
    const clean = (value || "").replace(/\D/g, "").slice(0, 1);
    setError(null);
    setDigits(prev => {
      const next = [...prev];
      next[idx] = clean;
      return next;
    });
    if (clean && idx < 3) {
      setTimeout(() => inputs.current[idx + 1]?.focus(), 0);
    }
  };

  const handleKey = (idx: number, key: string) => {
    if (key === "Backspace" && !digits[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
    }
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    setError(null);
    confirmMut.mutate(
      { orderId: order.id, pin },
      {
        onSuccess: () => {
          onConfirmed?.();
          onClose();
        },
        onError: (e: any) => {
          const code = e?.code || e?.response?.code;
          const msg = code === "PIN_REQUIRED"
            ? "PIN obrigatório"
            : code === "PIN_INVALID" || code === "PIN_WRONG"
              ? "PIN incorreto. Confirme com o cliente."
              : (e?.message || "Erro ao confirmar entrega");
          setError(msg);
          setShakeKey(k => k + 1);
          setDigits(["", "", "", ""]);
          setTimeout(() => inputs.current[0]?.focus(), 0);
        },
      },
    );
  };

  useEffect(() => {
    const t = setTimeout(() => inputs.current[0]?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <Pressable onPress={onClose} style={{
      position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center",
      padding: 16, zIndex: 200,
    }}>
      <Pressable onPress={(e) => { (e as any)?.stopPropagation?.(); }} style={{
        width: "100%", maxWidth: 420,
        backgroundColor: FoodColors.bg, borderRadius: 16,
        borderWidth: 1, borderColor: FoodColors.border, overflow: "hidden",
      }}>
        {/* Header */}
        <View style={{
          flexDirection: "row", alignItems: "center", gap: 10,
          padding: 14, borderBottomWidth: 1, borderBottomColor: FoodColors.border,
        }}>
          <View style={{
            width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(16,185,129,0.15)",
            alignItems: "center", justifyContent: "center",
          }}>
            <Text style={{ fontSize: 18 }}>✓</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: "800", color: FoodColors.ink }}>
              Confirmar entrega
            </Text>
            <Text style={{ fontSize: 11, color: FoodColors.ink3 }}>
              #{order.external_short} · {order.deliverer_name}
            </Text>
          </View>
          <Pressable onPress={onClose} style={{
            width: 30, height: 30, borderRadius: 8, backgroundColor: FoodColors.surface,
            alignItems: "center", justifyContent: "center",
          }}>
            <Icon name="x" size={13} color={FoodColors.ink2} />
          </Pressable>
        </View>

        {/* Body */}
        <View style={{ padding: 22, alignItems: "center", gap: 14 }}>
          <Text style={{ fontSize: 12, color: FoodColors.ink2, textAlign: "center", maxWidth: 320 }}>
            Digite o PIN de 4 dígitos que o motoboy recebeu no despacho.
          </Text>

          <View
            key={"shake-" + shakeKey}
            style={[
              { flexDirection: "row", gap: 10 },
              Platform.OS === "web" && error
                ? ({ animation: "pin-shake 0.4s" } as any)
                : {},
            ]}
          >
            {digits.map((d, i) => (
              <TextInput
                key={i}
                ref={el => { inputs.current[i] = el; }}
                value={d}
                onChangeText={(v) => handleChange(i, v)}
                onKeyPress={(e: any) => handleKey(i, e?.nativeEvent?.key)}
                keyboardType="number-pad"
                maxLength={1}
                secureTextEntry={false}
                placeholderTextColor={FoodColors.ink4}
                style={{
                  width: 56, height: 72, borderRadius: 10,
                  backgroundColor: FoodColors.surface2,
                  borderWidth: 2,
                  borderColor: error ? FoodColors.red : d ? FoodColors.red : FoodColors.border,
                  color: FoodColors.ink, fontSize: 28, fontWeight: "900",
                  textAlign: "center",
                }}
              />
            ))}
          </View>

          {Platform.OS === "web" && (
            <style
              // @ts-ignore - permitido em web; ignorado em mobile.
              dangerouslySetInnerHTML={{
                __html: "@keyframes pin-shake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-8px); } 40% { transform: translateX(8px); } 60% { transform: translateX(-6px); } 80% { transform: translateX(6px); } }",
              }}
            />
          )}

          {error && (
            <Text style={{ fontSize: 12, color: FoodColors.red, fontWeight: "700" }}>
              {error}
            </Text>
          )}

          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            style={{
              alignSelf: "stretch", paddingVertical: 13, borderRadius: 8,
              backgroundColor: FoodColors.green, alignItems: "center",
              opacity: canSubmit ? 1 : 0.4,
            }}
          >
            {confirmMut.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "800" }}>Confirmar entrega</Text>
            )}
          </Pressable>
        </View>
      </Pressable>
    </Pressable>
  );
}

export default ConfirmDeliveryModal;
