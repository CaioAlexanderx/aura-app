import { useState } from "react";
import { View, Text, StyleSheet, Pressable, Switch } from "react-native";
import { Colors } from "@/constants/colors";
import { toast } from "@/components/Toast";

type Props = { isConnected: boolean };

export function TabConfig({ isConnected: initialConnected }: Props) {
  const [connected, setConnected] = useState(initialConnected);

  return (
    <View>
      <View style={[s.statusCard, { borderColor: connected ? Colors.green + "33" : Colors.red + "33" }]}>
        <View style={[s.statusDot, { backgroundColor: connected ? Colors.green : Colors.red }]} />
        <View style={s.statusInfo}>
          <Text style={s.statusTitle}>{connected ? "WhatsApp Business conectado" : "WhatsApp desconectado"}</Text>
          <Text style={s.statusDesc}>{connected ? "Numero: (12) 99999-0000" : "Conecte para habilitar mensagens automaticas"}</Text>
        </View>
        <Pressable onPress={() => { setConnected(!connected); toast.success(connected ? "Desconectado" : "Conectado"); }} style={[s.statusBtn, { borderColor: connected ? Colors.red + "44" : Colors.green + "44" }]}>
          <Text style={[s.statusBtnText, { color: connected ? Colors.red : Colors.green }]}>{connected ? "Desconectar" : "Conectar"}</Text>
        </Pressable>
      </View>

      <View style={s.section}>
        <Text style={s.sectionTitle}>Horario de atendimento</Text>
        <View style={s.card}>
          <View style={s.settingRow}>
            <View style={{ flex: 1 }}><Text style={s.settingLabel}>Respostas automaticas fora do horario</Text><Text style={s.settingHint}>Envia mensagem personalizada fora do expediente</Text></View>
            <Switch value={true} trackColor={{ true: Colors.green, false: Colors.bg4 }} />
          </View>
          <View style={s.msgPreview}>
            <Text style={s.msgPreviewLabel}>Mensagem fora do horario:</Text>
            <View style={s.msgBubble}><Text style={s.msgBubbleText}>Ola! Obrigado pela mensagem. Nosso horario de atendimento e de segunda a sabado, das 8h as 18h. Retornaremos assim que possivel!</Text></View>
            <Pressable onPress={() => toast.info("Editar mensagem")} style={s.editBtn}><Text style={s.editBtnText}>Editar mensagem</Text></Pressable>
          </View>
          <View style={s.settingRow}>
            <View style={{ flex: 1 }}><Text style={s.settingLabel}>Horario de atendimento</Text><Text style={s.settingHint}>Segunda a sabado, 8h as 18h</Text></View>
            <Pressable onPress={() => toast.info("Editar horario")} style={s.editBtn}><Text style={s.editBtnText}>Editar</Text></Pressable>
          </View>
        </View>
      </View>

      <View style={s.section}>
        <Text style={s.sectionTitle}>Notificacoes</Text>
        <View style={s.card}>
          <View style={s.settingRow}><View style={{ flex: 1 }}><Text style={s.settingLabel}>Resumo diario</Text><Text style={s.settingHint}>Receba um resumo das conversas as 20h</Text></View><Switch value={true} trackColor={{ true: Colors.green, false: Colors.bg4 }} /></View>
          <View style={s.settingRow}><View style={{ flex: 1 }}><Text style={s.settingLabel}>Alerta de mensagem nao respondida</Text><Text style={s.settingHint}>Notifica apos 30 min sem resposta</Text></View><Switch value={true} trackColor={{ true: Colors.green, false: Colors.bg4 }} /></View>
        </View>
      </View>

      <View style={s.infoCard}><Text style={s.infoIcon}>!</Text><Text style={s.infoText}>A integracao com WhatsApp Business API requer configuracao no Meta Business Manager. A Aura cuida da conexao no setup do seu plano.</Text></View>
    </View>
  );
}

const s = StyleSheet.create({
  statusCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, borderWidth: 1, marginBottom: 20 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusInfo: { flex: 1, gap: 2 },
  statusTitle: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  statusDesc: { fontSize: 11, color: Colors.ink3 },
  statusBtn: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1 },
  statusBtnText: { fontSize: 12, fontWeight: "600" },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 14, color: Colors.ink, fontWeight: "700", marginBottom: 10 },
  card: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border },
  settingRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  settingLabel: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  settingHint: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  editBtn: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: Colors.violetD },
  editBtnText: { fontSize: 11, color: Colors.violet3, fontWeight: "600" },
  msgPreview: { paddingVertical: 12, paddingHorizontal: 4, gap: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  msgPreviewLabel: { fontSize: 11, color: Colors.ink3, fontWeight: "600" },
  msgBubble: { backgroundColor: Colors.bg4, borderRadius: 14, padding: 14, maxWidth: "85%" },
  msgBubbleText: { fontSize: 12, color: Colors.ink, lineHeight: 18 },
  infoCard: { flexDirection: "row", gap: 8, backgroundColor: Colors.amberD, borderRadius: 12, padding: 14, marginTop: 16 },
  infoIcon: { fontSize: 14, color: Colors.amber, fontWeight: "700" },
  infoText: { fontSize: 11, color: Colors.amber, flex: 1, lineHeight: 16 },
});

export default TabConfig;
