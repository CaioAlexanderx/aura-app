import { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, Platform } from "react-native";
import { Icon } from "@/components/Icon";
import { FoodColors } from "@/constants/food-tokens";
import {
  useDeliverers,
  vehicleIcon,
  vehicleLabel,
  commissionLabel,
  type FoodDeliverer,
} from "@/hooks/useFoodDeliverers";
import { MotoboyDrawer } from "@/components/food/MotoboyDrawer";

// ============================================================
// /food/(salao)/motoboys — Fase 8: CRUD real.
//
// Header + grid de cards (4 col desktop, 1 col mobile).
// Card: nome, telefone, badge veículo, comissão, entregas hoje, status.
// Click no card abre MotoboyDrawer (tabs Detalhes/Relatório/Histórico).
// ============================================================

export default function MotoboysScreen() {
  const { data, isLoading } = useDeliverers();
  const [selected, setSelected] = useState<FoodDeliverer | null>(null);
  const [creating, setCreating] = useState(false);

  const drawerOpen = creating || !!selected;
  const closeDrawer = () => { setSelected(null); setCreating(false); };

  const sorted = useMemo(
    () => (data ? [...data].sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return a.name.localeCompare(b.name, "pt-BR");
    }) : []),
    [data],
  );

  return (
    <View style={{ flex: 1, position: "relative" }}>
      {/* Header */}
      <View style={{
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        marginBottom: 14, flexWrap: "wrap", gap: 8,
      }}>
        <View>
          <Text style={{ fontSize: 22, fontWeight: "800", color: FoodColors.ink }}>Motoboys</Text>
          <Text style={{ fontSize: 12, color: FoodColors.ink3, marginTop: 2 }}>
            Entregadores do delivery próprio com comissão e histórico.
          </Text>
        </View>
        <Pressable onPress={() => setCreating(true)} style={{
          flexDirection: "row", alignItems: "center", gap: 6,
          paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8,
          backgroundColor: FoodColors.red,
        }}>
          <Icon name="plus" size={14} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>Novo motoboy</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={{ paddingVertical: 40, alignItems: "center" }}>
          <ActivityIndicator color={FoodColors.red} />
        </View>
      ) : sorted.length === 0 ? (
        <View style={{
          backgroundColor: FoodColors.surface, borderRadius: 12, padding: 32,
          alignItems: "center", borderWidth: 1, borderColor: FoodColors.border, borderStyle: "dashed",
          gap: 10,
        }}>
          <Text style={{ fontSize: 48 }}>🏍️</Text>
          <Text style={{ fontSize: 14, color: FoodColors.ink, fontWeight: "700" }}>
            Nenhum motoboy cadastrado
          </Text>
          <Text style={{ fontSize: 12, color: FoodColors.ink3, textAlign: "center", maxWidth: 360 }}>
            Cadastre seu primeiro entregador para usar o delivery próprio e o board de despacho.
          </Text>
          <Pressable onPress={() => setCreating(true)} style={{
            marginTop: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8,
            backgroundColor: FoodColors.red,
          }}>
            <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>+ Cadastrar motoboy</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {sorted.map(d => (
              <DelivererCard key={d.id} d={d} onPress={() => setSelected(d)} />
            ))}
          </View>
        </ScrollView>
      )}

      {drawerOpen && (
        <>
          <Pressable onPress={closeDrawer} style={{
            position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.4)", zIndex: 99,
          }} />
          <MotoboyDrawer
            deliverer={selected}
            isCreating={creating}
            onClose={closeDrawer}
          />
        </>
      )}
    </View>
  );
}

function DelivererCard({ d, onPress }: { d: FoodDeliverer; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        {
          backgroundColor: FoodColors.surface, borderRadius: 12, padding: 14,
          borderWidth: 1, borderColor: FoodColors.border, gap: 8,
          width: Platform.OS === "web" ? "calc(25% - 8px)" as any : "100%",
          minWidth: 220,
        },
        !d.active ? { opacity: 0.55 } : {},
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{
          width: 42, height: 42, borderRadius: 12,
          backgroundColor: d.active ? FoodColors.redDim : FoodColors.surface2,
          alignItems: "center", justifyContent: "center",
        }}>
          <Text style={{ fontSize: 22 }}>{vehicleIcon(d.vehicle)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, color: FoodColors.ink, fontWeight: "700" }} numberOfLines={1}>
            {d.name}
          </Text>
          <Text style={{ fontSize: 11, color: FoodColors.ink3 }} numberOfLines={1}>
            {d.phone || "sem telefone"}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
        <Badge label={vehicleLabel(d.vehicle)} color={FoodColors.cyan} />
        <Badge label={commissionLabel(d)} color={FoodColors.green} />
      </View>

      <View style={{
        flexDirection: "row", justifyContent: "space-between",
        paddingTop: 8, borderTopWidth: 1, borderTopColor: FoodColors.border,
      }}>
        <View>
          <Text style={{ fontSize: 9, color: FoodColors.ink3, textTransform: "uppercase", fontWeight: "600", letterSpacing: 0.5 }}>
            Hoje
          </Text>
          <Text style={{ fontSize: 14, color: FoodColors.ink, fontWeight: "800" }}>
            {Number(d.deliveries_today || 0)} entregas
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontSize: 9, color: FoodColors.ink3, textTransform: "uppercase", fontWeight: "600", letterSpacing: 0.5 }}>
            Em rota
          </Text>
          <Text style={{ fontSize: 14, color: FoodColors.amber, fontWeight: "800" }}>
            {Number(d.current_orders_count || 0)}
          </Text>
        </View>
      </View>

      {!d.active && (
        <View style={{
          position: "absolute", top: 10, right: 10,
          backgroundColor: FoodColors.surface2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
        }}>
          <Text style={{ fontSize: 9, color: FoodColors.ink3, fontWeight: "700", textTransform: "uppercase" }}>Inativo</Text>
        </View>
      )}
    </Pressable>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={{
      backgroundColor: color + "22", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    }}>
      <Text style={{ color, fontSize: 10, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}
