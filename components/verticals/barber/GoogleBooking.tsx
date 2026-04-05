import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

// B-21: GoogleBooking — Reserve with Google Business Profile config

export interface GoogleBookingConfig { is_active: boolean; google_place_id?: string; business_name?: string; business_url?: string; sync_services: boolean; sync_availability: boolean; auto_accept: boolean; last_sync?: string; }

interface Props { config: GoogleBookingConfig | null; onConfigure?: () => void; onSync?: () => void; onToggle?: (active: boolean) => void; }

export function GoogleBooking({ config, onConfigure, onSync, onToggle }: Props) {
  return (
    <View style={s.container}>
      <View style={s.card}>
        <View style={s.cardHeader}>
          <Text style={s.googleIcon}>G</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Reserve with Google</Text>
            <Text style={s.subtitle}>Permita que clientes agendem diretamente pelo Google Maps e Busca</Text>
          </View>
          {config && onToggle && (
            <Pressable onPress={() => onToggle(!config.is_active)} style={[s.toggleBtn, { borderColor: config.is_active ? "#EF4444" : "#10B981" }]}>
              <Text style={{ fontSize: 11, fontWeight: "600", color: config.is_active ? "#EF4444" : "#10B981" }}>{config.is_active ? "Desativar" : "Ativar"}</Text>
            </Pressable>
          )}
        </View>
        {!config && (
          <View style={s.setupSection}>
            <Text style={s.setupText}>Conecte seu Google Business Profile para que seus clientes possam agendar diretamente pela Busca do Google e Google Maps.</Text>
            <View style={s.steps}>
              <Text style={s.step}>1. Tenha um perfil verificado no Google Meu Negocio</Text>
              <Text style={s.step}>2. Copie seu Place ID do Google</Text>
              <Text style={s.step}>3. Configure aqui e ative a sincronizacao</Text>
            </View>
            {onConfigure && <Pressable onPress={onConfigure} style={s.configBtn}><Text style={s.configBtnT}>Configurar conexao</Text></Pressable>}
          </View>
        )}
        {config && (
          <View style={s.configSection}>
            <View style={s.statusRow}>
              <View style={[s.statusDot, { backgroundColor: config.is_active ? "#10B981" : "#EF4444" }]} />
              <Text style={s.statusText}>{config.is_active ? "Ativo" : "Desativado"}</Text>
            </View>
            {config.business_name && <Text style={s.bizName}>{config.business_name}</Text>}
            {config.google_place_id && <Text style={s.placeId}>Place ID: {config.google_place_id}</Text>}
            <View style={s.syncRow}>
              <Text style={s.syncItem}>Servicos: {config.sync_services ? "Sincronizado" : "Nao"}</Text>
              <Text style={s.syncItem}>Disponibilidade: {config.sync_availability ? "Sincronizado" : "Nao"}</Text>
              <Text style={s.syncItem}>Auto-aceitar: {config.auto_accept ? "Sim" : "Nao"}</Text>
            </View>
            {config.last_sync && <Text style={s.lastSync}>Ultima sincronizacao: {new Date(config.last_sync).toLocaleString("pt-BR")}</Text>}
            <View style={s.actionsRow}>
              {onSync && <Pressable onPress={onSync} style={s.syncBtn}><Text style={s.syncBtnT}>Sincronizar agora</Text></Pressable>}
              {onConfigure && <Pressable onPress={onConfigure} style={s.editBtn}><Text style={s.editBtnT}>Editar</Text></Pressable>}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 12 },
  card: { padding: 18, borderRadius: 14, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, gap: 14 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  googleIcon: { width: 36, height: 36, borderRadius: 8, backgroundColor: "#4285F4", color: "#fff", fontSize: 18, fontWeight: "800", textAlign: "center", lineHeight: 36, overflow: "hidden" },
  title: { fontSize: 16, fontWeight: "700", color: Colors.ink }, subtitle: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 0.5 },
  setupSection: { gap: 10 }, setupText: { fontSize: 12, color: Colors.ink2, lineHeight: 18 },
  steps: { gap: 4 }, step: { fontSize: 11, color: Colors.ink3, paddingLeft: 8 },
  configBtn: { backgroundColor: "#4285F4", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10, alignSelf: "flex-start" }, configBtnT: { color: "#fff", fontSize: 13, fontWeight: "600" },
  configSection: { gap: 8 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6 }, statusDot: { width: 8, height: 8, borderRadius: 4 }, statusText: { fontSize: 12, fontWeight: "600", color: Colors.ink },
  bizName: { fontSize: 14, fontWeight: "600", color: Colors.ink }, placeId: { fontSize: 10, color: Colors.ink3, fontFamily: "monospace" },
  syncRow: { flexDirection: "row", gap: 12, flexWrap: "wrap" }, syncItem: { fontSize: 11, color: Colors.ink2 },
  lastSync: { fontSize: 10, color: Colors.ink3 },
  actionsRow: { flexDirection: "row", gap: 8 },
  syncBtn: { backgroundColor: "#4285F4", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 }, syncBtnT: { color: "#fff", fontSize: 12, fontWeight: "600" },
  editBtn: { borderWidth: 0.5, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 }, editBtnT: { fontSize: 12, color: Colors.ink3 },
});

export default GoogleBooking;
