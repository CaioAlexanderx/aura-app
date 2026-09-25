// ============================================================
// AURA. — Estoque compartilhado entre as empresas do grupo
//
// Cartão da tela "Minhas empresas". Some para quem tem uma empresa só,
// para quem não é o dono e em backend sem a migration 355: tudo isso
// chega como available=false de GET /me/companies/stock-sharing.
//
// Ligado (padrão, caso Davi): produto de uma empresa aparece no Estoque
// e no Caixa das outras. Desligado (caso Luis Henrique, adega + loja de
// roupas): cada empresa vê só o que cadastrou. A troca mexe nos produtos
// já cadastrados, por isso passa por confirmação.
// ============================================================
import { useEffect, useState } from "react";
import { View, Text, Pressable, Switch, Modal, ActivityIndicator } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useColors, Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { userCompaniesApi, type StockSharingResponse } from "@/services/multicnpj";

export function StockSharingCard() {
  const C = useColors();
  const queryClient = useQueryClient();
  const [state, setState] = useState<StockSharingResponse | null>(null);
  const [confirm, setConfirm] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    userCompaniesApi.stockSharing().then(setState).catch(() => setState(null));
  }, []);

  if (!state || !state.available) return null;

  async function apply(shared: boolean) {
    setSaving(true);
    try {
      const res = await userCompaniesApi.setStockSharing(shared);
      setState(res);
      setConfirm(null);
      // Estoque, Caixa e vitrine leem ["products", ...] e variações.
      queryClient.invalidateQueries({
        predicate: (q) => typeof q.queryKey[0] === "string" && q.queryKey[0].startsWith("products"),
      });
      toast.success(shared ? "Estoque compartilhado entre as empresas" : "Cada empresa agora vê só o próprio estoque");
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Não foi possível alterar o estoque");
    } finally {
      setSaving(false);
    }
  }

  const n = state.companies.length;

  return (
    <View
      testID="stock-sharing-card"
      style={{
        backgroundColor: C.bg2,
        borderRadius: 14,
        padding: 14,
        marginTop: 6,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: C.border,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
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
          <Icon name="package" size={18} color="#7c3aed" />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: C.ink }}>Estoque compartilhado</Text>
          <Text testID="stock-sharing-state" style={{ fontSize: 12, color: C.ink3, marginTop: 3, lineHeight: 17 }}>
            {state.shared
              ? "Os produtos de uma empresa aparecem no Estoque e no Caixa das outras."
              : "Cada empresa vê só o próprio estoque."}
          </Text>
        </View>
        <Switch
          testID="stock-sharing-switch"
          value={state.shared}
          disabled={saving}
          onValueChange={(v) => setConfirm(v)}
          trackColor={{ false: Colors.bg4, true: Colors.violet + "66" }}
          thumbColor={state.shared ? Colors.violet : Colors.ink3}
        />
      </View>

      <Modal visible={confirm !== null} transparent animationType="fade" onRequestClose={() => setConfirm(null)}>
        <Pressable
          onPress={() => !saving && setConfirm(null)}
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
              maxWidth: 440,
              backgroundColor: C.bg2,
              borderRadius: 16,
              padding: 20,
              borderWidth: 1,
              borderColor: C.border,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "700", color: C.ink, marginBottom: 8 }}>
              {confirm ? "Compartilhar o estoque entre as empresas?" : "Separar o estoque das empresas?"}
            </Text>
            <Text style={{ fontSize: 13, color: C.ink3, lineHeight: 19, marginBottom: 16 }}>
              {confirm
                ? `Todos os produtos das suas ${n} empresas passam a aparecer no Estoque e no Caixa de todas elas, e os produtos novos também.`
                : "Cada empresa passa a ver só os produtos que ela cadastrou, no Estoque e no Caixa. Nenhum produto é apagado: cada um continua na empresa onde foi cadastrado."}
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={() => setConfirm(null)}
                disabled={saving}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: C.border,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 13, color: C.ink, fontWeight: "600" }}>Cancelar</Text>
              </Pressable>
              <Pressable
                testID="stock-sharing-confirm"
                onPress={() => confirm !== null && apply(confirm)}
                disabled={saving}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 10,
                  backgroundColor: "#7c3aed",
                  alignItems: "center",
                  opacity: saving ? 0.5 : 1,
                }}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ fontSize: 13, color: "#fff", fontWeight: "700" }}>
                    {confirm ? "Compartilhar" : "Separar estoque"}
                  </Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
