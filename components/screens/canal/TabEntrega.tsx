import { useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, Switch } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { cs } from "./shared";

type Props = { config: any; saveConfig: (data: any) => Promise<void>; isSaving: boolean };

export function TabEntrega({ config, saveConfig, isSaving }: Props) {
  const [pickup, setPickup] = useState(config.pickup_enabled ?? true);
  const [delivery, setDelivery] = useState(config.delivery_enabled ?? false);
  const [fee, setFee] = useState(String(config.delivery_fee || "0"));
  const [changed, setChanged] = useState(false);

  useEffect(() => {
    setPickup(config.pickup_enabled ?? true); setDelivery(config.delivery_enabled ?? false);
    setFee(String(config.delivery_fee || "0")); setChanged(false);
  }, [config.pickup_enabled, config.delivery_enabled, config.delivery_fee]);

  async function handleSave() {
    await saveConfig({ pickup_enabled: pickup, delivery_enabled: delivery, delivery_fee: parseFloat(fee.replace(",", ".")) || 0 }); setChanged(false);
  }

  return (
    <View>
      <Text style={cs.hint}>Configure como o cliente recebe seu pedido.</Text>
      <View style={cs.card}>
        <View style={cs.switchRow}>
          <View style={{ flex: 1 }}><Text style={cs.switchLabel}>Retirada no local</Text><Text style={cs.switchHint}>Cliente busca no estabelecimento</Text></View>
          <Switch value={pickup} onValueChange={(v) => { setPickup(v); setChanged(true); }} trackColor={{ true: Colors.green, false: Colors.bg4 }} thumbColor="#fff" />
        </View>
        <View style={cs.switchRow}>
          <View style={{ flex: 1 }}><Text style={cs.switchLabel}>Entrega a domicilio</Text><Text style={cs.switchHint}>Disponibilize entrega</Text></View>
          <Switch value={delivery} onValueChange={(v) => { setDelivery(v); setChanged(true); }} trackColor={{ true: Colors.green, false: Colors.bg4 }} thumbColor="#fff" />
        </View>
        {delivery && (
          <View style={[cs.field, { marginTop: 8 }]}><Text style={cs.fieldLabel}>Taxa de entrega (R$)</Text>
            <TextInput style={cs.input} value={fee} onChangeText={(v) => { setFee(v); setChanged(true); }} placeholder="0,00" placeholderTextColor={Colors.ink3} keyboardType="decimal-pad" />
          </View>
        )}
      </View>
      <View style={cs.infoCard}><Icon name="alert" size={13} color={Colors.violet3} /><Text style={cs.infoText}>Integracoes avancadas (Uber Flash, Correios) sao configuradas pela equipe Aura.</Text></View>
      {changed && <Pressable onPress={handleSave} disabled={isSaving} style={[cs.saveBtn, isSaving && { opacity: 0.6 }, { marginTop: 16 }]}><Text style={cs.saveBtnText}>{isSaving ? "Salvando..." : "Salvar entrega"}</Text></Pressable>}
    </View>
  );
}
