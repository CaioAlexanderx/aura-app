// ============================================================
// Painel do Sensei — Eventos (DESIGN-23)
// Próximos exames e cursos da federação. A inscrição passa pela
// federação (o sensei envia a lista). Linguagem simples.
// ============================================================
import React, { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, Modal,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";

const EVENTOS = [
  { id: "e1", tipo: "Exame de Faixa (Kyu)", local: "Ginásio Municipal — Jacareí/SP", data: "28 de junho de 2026", taxa: "R$ 80" },
  { id: "e2", tipo: "Curso de Kata com Sensei Onishi", local: "Centro Esportivo — São José dos Campos/SP", data: "12 de julho de 2026", taxa: "R$ 60" },
  { id: "e3", tipo: "Exame de Faixa (Dan)", local: "Arena Ibirapuera — São Paulo/SP", data: "9 de agosto de 2026", taxa: "R$ 150" },
];

export default function SenseiEventos() {
  const [showHow, setShowHow] = useState(false);
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View>
        <Text style={styles.eyebrow}>Temporada 2026 · abertos ao seu dojô</Text>
        <Text style={styles.title}>Próximos eventos</Text>
        <Text style={styles.lead}>Exames e cursos da federação. Para inscrever seus alunos, envie a lista para a federação — ela cuida do resto.</Text>
      </View>

      {EVENTOS.map((e) => (
        <View key={e.id} style={styles.card}>
          <Text style={styles.evTipo}>{e.tipo}</Text>
          <View style={styles.metaRow}><Icon name="calendar-outline" size={13} color={KarateColors.ink3} /><Text style={styles.meta}>{e.data}</Text></View>
          <View style={styles.metaRow}><Icon name="location-outline" size={13} color={KarateColors.ink3} /><Text style={styles.meta} numberOfLines={1}>{e.local}</Text></View>
          <View style={styles.metaRow}><Icon name="pricetag-outline" size={13} color={KarateColors.ink3} /><Text style={styles.meta}>Taxa: {e.taxa} por aluno</Text></View>
          <TouchableOpacity style={styles.askBtn} onPress={() => setShowHow(true)} accessibilityRole="button">
            <Icon name="paper-plane-outline" size={14} color={KarateColors.primary} />
            <Text style={styles.askTxt}>Solicitar inscrição</Text>
          </TouchableOpacity>
        </View>
      ))}

      <Modal visible={showHow} transparent animationType="fade" onRequestClose={() => setShowHow(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Como inscrever seus alunos</Text>
              <TouchableOpacity onPress={() => setShowHow(false)} accessibilityLabel="Fechar"><Icon name="close" size={22} color={KarateColors.ink} /></TouchableOpacity>
            </View>
            <Text style={styles.sheetBody}>Envie a lista de alunos que vão participar para a federação. Ela confirma as vagas e a taxa, e faz a inscrição para você.</Text>
            <View style={styles.contactRow}><Icon name="mail-outline" size={16} color={KarateColors.primary} /><Text style={styles.contact}>eventos@fpkt.org.br</Text></View>
            <View style={styles.contactRow}><Icon name="logo-whatsapp" size={16} color={KarateColors.ok} /><Text style={styles.contact}>(12) 99000-0000</Text></View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content: { padding: 16, gap: 12, paddingBottom: 40 } as ViewStyle,
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, color: KarateColors.primary, textTransform: "uppercase" } as TextStyle,
  title: { fontSize: 24, fontWeight: "800", color: KarateColors.ink, marginTop: 2 } as TextStyle,
  lead: { fontSize: 13, color: KarateColors.ink3, marginTop: 4, lineHeight: 18, maxWidth: 460 } as TextStyle,
  card: { backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14, gap: 5 } as ViewStyle,
  evTipo: { fontSize: 15, fontWeight: "700", color: KarateColors.ink, marginBottom: 2 } as TextStyle,
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 } as ViewStyle,
  meta: { fontSize: 12, color: KarateColors.ink3 } as TextStyle,
  askBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginTop: 8, backgroundColor: KarateColors.primarySoft, borderRadius: KarateRadius.sm, paddingVertical: 8, paddingHorizontal: 12 } as ViewStyle,
  askTxt: { fontSize: 13, fontWeight: "700", color: KarateColors.primary } as TextStyle,
  overlay: { flex: 1, backgroundColor: "rgba(28,23,20,0.45)", alignItems: "center", justifyContent: "center", padding: 24 } as ViewStyle,
  sheet: { width: "100%", maxWidth: 380, backgroundColor: KarateColors.bg, borderRadius: KarateRadius.lg, padding: 20, gap: 10 } as ViewStyle,
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" } as ViewStyle,
  sheetTitle: { fontSize: 16, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  sheetBody: { fontSize: 13, color: KarateColors.ink2, lineHeight: 19 } as TextStyle,
  contactRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: KarateColors.surface, borderRadius: KarateRadius.sm, borderWidth: 1, borderColor: KarateColors.border, padding: 11 } as ViewStyle,
  contact: { fontSize: 13, fontWeight: "600", color: KarateColors.ink } as TextStyle,
});
