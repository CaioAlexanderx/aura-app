import { useState, useRef } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Dimensions } from "react-native";
import { Colors } from "@/constants/colors";
import { useWhatsApp } from "@/hooks/useWhatsApp";
import { TabConversas } from "@/components/screens/whatsapp/TabConversas";
import { TabAutomacoes } from "@/components/screens/whatsapp/TabAutomacoes";
import { TabCampanhas } from "@/components/screens/whatsapp/TabCampanhas";
import { TabConfig } from "@/components/screens/whatsapp/TabConfig";
import { TABS } from "@/components/screens/whatsapp/types";

const IS_WIDE = (typeof window !== "undefined" ? window.innerWidth : Dimensions.get("window").width) > 768;

export default function WhatsAppScreen() {
  const [tab, setTab] = useState(0);
  const scrollRef = useRef<any>(null);
  const { conversations, messages, automations, campaigns, activeAutomations, totalSent, isConnected, isDemo, toggleAutomation, sendMessage } = useWhatsApp();

  return (
    <ScrollView ref={scrollRef} style={s.screen} contentContainerStyle={s.content}>
      <Text style={s.pageTitle}>WhatsApp</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 20 }} contentContainerStyle={{ flexDirection: "row", gap: 6 }}>
        {TABS.map((t, i) => <Pressable key={t} onPress={() => { setTab(i); scrollRef.current?.scrollTo?.({ y: 0, animated: true }); }} style={[s.tab, tab === i && s.tabActive]}><Text style={[s.tabText, tab === i && s.tabTextActive]}>{t}</Text></Pressable>)}
      </ScrollView>

      {tab === 0 && <TabConversas conversations={conversations} messages={messages} onSend={sendMessage} />}
      {tab === 1 && <TabAutomacoes automations={automations} activeCount={activeAutomations} totalSent={totalSent} onToggle={toggleAutomation} />}
      {tab === 2 && <TabCampanhas campaigns={campaigns} />}
      {tab === 3 && <TabConfig isConnected={isConnected} />}

      {isDemo && <View style={s.demoBanner}><Text style={s.demoText}>Modo demonstrativo</Text></View>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "transparent" },
  content: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 960, alignSelf: "center", width: "100%" },
  pageTitle: { fontSize: 22, color: Colors.ink, fontWeight: "700", marginBottom: 20 },
  tab: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  tabActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  tabText: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  tabTextActive: { color: "#fff", fontWeight: "600" },
  demoBanner: { alignSelf: "center", backgroundColor: Colors.violetD, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginTop: 16 },
  demoText: { fontSize: 11, color: Colors.violet3, fontWeight: "500" },
});
