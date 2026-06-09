// ============================================================
// Painel do Sensei — Praticantes (DESIGN-23)
// Lista dos alunos do dojô (faixa + anuidade), pirâmide de faixas e
// convite para adotar o Aura Karatê Dojô. Tudo somente leitura.
// ============================================================
import React, { useState } from "react";
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, Modal,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { SENSEI_DOJO } from "./_layout";

// [MOCK] alunos do dojô (faixa + anuidade CPF espelhadas da FPKT)
type Belt = { label: string; color: string; text: string };
const B = {
  branca: { label: "Branca", color: "#F4F1FF", text: "#1C1714" },
  amarela: { label: "Amarela", color: "#FBBF24", text: "#1C1714" },
  laranja: { label: "Laranja", color: "#FB923C", text: "#1C1714" },
  verde: { label: "Verde", color: "#34D399", text: "#1C1714" },
  roxa: { label: "Roxa", color: "#8B5CF6", text: "#fff" },
  marrom: { label: "Marrom", color: "#85572F", text: "#fff" },
  preta: { label: "Preta", color: "#15161F", text: "#fff" },
} as const;
type BeltKey = keyof typeof B;

interface Aluno { id: string; nome: string; reg: string; belt: BeltKey; emDia: boolean; trajeto: { belt: BeltKey; ano: string }[] }
const ALUNOS: Aluno[] = [
  { id: "a1", nome: "Bruno Yukio Tanaka", reg: "FPKT-A-00417", belt: "preta", emDia: true, trajeto: [{ belt: "branca", ano: "2014" }, { belt: "amarela", ano: "2015" }, { belt: "verde", ano: "2017" }, { belt: "marrom", ano: "2020" }, { belt: "preta", ano: "2023" }] },
  { id: "a2", nome: "Marina Yoshida", reg: "FPKT-A-05012", belt: "roxa", emDia: true, trajeto: [{ belt: "branca", ano: "2019" }, { belt: "amarela", ano: "2020" }, { belt: "verde", ano: "2022" }, { belt: "roxa", ano: "2024" }] },
  { id: "a3", nome: "Pedro Hamada", reg: "FPKT-A-05130", belt: "verde", emDia: false, trajeto: [{ belt: "branca", ano: "2021" }, { belt: "amarela", ano: "2022" }, { belt: "verde", ano: "2024" }] },
  { id: "a4", nome: "Helena Ozawa", reg: "FPKT-A-05211", belt: "amarela", emDia: true, trajeto: [{ belt: "branca", ano: "2023" }, { belt: "amarela", ano: "2025" }] },
  { id: "a5", nome: "Davi Sasaki", reg: "FPKT-A-05240", belt: "branca", emDia: false, trajeto: [{ belt: "branca", ano: "2025" }] },
];

// distribuição p/ pirâmide
const PIRAMIDE: { belt: BeltKey; n: number }[] = [
  { belt: "preta", n: 6 }, { belt: "marrom", n: 9 }, { belt: "roxa", n: 11 },
  { belt: "verde", n: 14 }, { belt: "laranja", n: 8 }, { belt: "amarela", n: 9 }, { belt: "branca", n: 6 },
];

function Chip({ belt }: { belt: BeltKey }) {
  const b = B[belt];
  return <View style={[styles.chip, { backgroundColor: b.color }]}><Text style={[styles.chipTxt, { color: b.text }]}>{b.label}</Text></View>;
}

export default function SenseiPraticantes() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Aluno | null>(null);
  const maxP = Math.max(...PIRAMIDE.map((p) => p.n));
  const list = ALUNOS.filter((a) => a.nome.toLowerCase().includes(q.toLowerCase()) || a.reg.includes(q));

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View>
        <Text style={styles.eyebrow}>{SENSEI_DOJO.name} · {SENSEI_DOJO.total} praticantes</Text>
        <Text style={styles.title}>Praticantes</Text>
        <Text style={styles.lead}>Os alunos do seu dojô. A faixa e a anuidade vêm da federação — aqui você só acompanha.</Text>
      </View>

      {/* Pirâmide de faixas */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Faixas do dojô</Text>
        <Text style={styles.cardSub}>Como estão distribuídos os {SENSEI_DOJO.total} alunos</Text>
        <View style={{ gap: 7, marginTop: 8 }}>
          {PIRAMIDE.map((p) => (
            <View key={p.belt} style={styles.pyRow}>
              <Text style={styles.pyLabel}>{B[p.belt].label}</Text>
              <View style={styles.pyTrack}>
                <View style={[styles.pyBar, { width: `${(p.n / maxP) * 100}%`, backgroundColor: B[p.belt].color }]} />
              </View>
              <Text style={styles.pyNum}>{p.n}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Busca + lista */}
      <View style={styles.search}>
        <Ionicons name="search" size={16} color={KarateColors.ink3} />
        <TextInput style={styles.searchInput} value={q} onChangeText={setQ} placeholder="Buscar aluno por nome ou registro" placeholderTextColor={KarateColors.ink4} />
      </View>

      {list.map((a) => (
        <TouchableOpacity key={a.id} style={styles.row} onPress={() => setSel(a)} accessibilityRole="button" accessibilityLabel={`Ver trajetória de ${a.nome}`}>
          <View style={{ flex: 1 }}>
            <Text style={styles.nome}>{a.nome}</Text>
            <Text style={styles.reg}>{a.reg}</Text>
          </View>
          <Chip belt={a.belt} />
          <View style={[styles.anuidade, a.emDia ? styles.anuOk : styles.anuPend]}>
            <Ionicons name={a.emDia ? "checkmark-circle" : "time"} size={13} color={a.emDia ? KarateColors.ok : KarateColors.warn} />
            <Text style={[styles.anuTxt, { color: a.emDia ? KarateColors.ok : KarateColors.warn }]}>{a.emDia ? "Em dia" : "Pendente"}</Text>
          </View>
        </TouchableOpacity>
      ))}

      {/* Banner de aquisição */}
      <View style={styles.acq}>
        <View style={{ flex: 1 }}>
          <Text style={styles.acqTitle}>Quer cuidar do seu dojô por inteiro?</Text>
          <Text style={styles.acqSub}>Com o Aura Karatê Dojô você controla mensalidades, presença e caixa — e tudo se atualiza sozinho com a federação.</Text>
        </View>
        <TouchableOpacity style={styles.acqBtn} accessibilityRole="button">
          <Text style={styles.acqBtnTxt}>Conhecer</Text>
          <Ionicons name="arrow-forward" size={14} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Trajetória de faixas (somente leitura) */}
      <Modal visible={!!sel} transparent animationType="fade" onRequestClose={() => setSel(null)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <View>
                <Text style={styles.sheetName}>{sel?.nome}</Text>
                <Text style={styles.sheetReg}>{sel?.reg}</Text>
              </View>
              <TouchableOpacity onPress={() => setSel(null)} accessibilityLabel="Fechar"><Ionicons name="close" size={22} color={KarateColors.ink} /></TouchableOpacity>
            </View>
            <Text style={styles.sheetTitle}>Trajetória de faixas</Text>
            <View style={{ gap: 8, marginTop: 8 }}>
              {sel?.trajeto.slice().reverse().map((t, i) => (
                <View key={i} style={styles.trajRow}>
                  <View style={[styles.dot, { backgroundColor: B[t.belt].color }]} />
                  <Text style={styles.trajBelt}>{B[t.belt].label}</Text>
                  <Text style={styles.trajAno}>{t.ano}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.sheetFoot}>Histórico mantido pela federação · somente leitura</Text>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content: { padding: 16, gap: 14, paddingBottom: 40 } as ViewStyle,
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, color: KarateColors.ink3, fontFamily: "monospace" } as TextStyle,
  title: { fontSize: 24, fontWeight: "800", color: KarateColors.ink, marginTop: 2 } as TextStyle,
  lead: { fontSize: 13, color: KarateColors.ink3, marginTop: 4, lineHeight: 18, maxWidth: 460 } as TextStyle,
  card: { backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14 } as ViewStyle,
  cardTitle: { fontSize: 14, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  cardSub: { fontSize: 12, color: KarateColors.ink3, marginTop: 2 } as TextStyle,
  pyRow: { flexDirection: "row", alignItems: "center", gap: 10 } as ViewStyle,
  pyLabel: { width: 64, fontSize: 12, color: KarateColors.ink2 } as TextStyle,
  pyTrack: { flex: 1, height: 14, borderRadius: 7, backgroundColor: KarateColors.bg2, overflow: "hidden" } as ViewStyle,
  pyBar: { height: 14, borderRadius: 7, borderWidth: 1, borderColor: "rgba(0,0,0,0.08)" } as ViewStyle,
  pyNum: { width: 24, textAlign: "right", fontSize: 12, fontWeight: "800", color: KarateColors.ink, fontFamily: "monospace" } as TextStyle,
  search: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: KarateColors.surface, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.sm, paddingHorizontal: 12 } as ViewStyle,
  searchInput: { flex: 1, fontSize: 14, color: KarateColors.ink, paddingVertical: 11 } as TextStyle,
  row: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 12 } as ViewStyle,
  nome: { fontSize: 14, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  reg: { fontSize: 11, color: KarateColors.ink3, marginTop: 1, fontFamily: "monospace" } as TextStyle,
  chip: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: "rgba(0,0,0,0.08)" } as ViewStyle,
  chipTxt: { fontSize: 11, fontWeight: "800" } as TextStyle,
  anuidade: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999 } as ViewStyle,
  anuOk: { backgroundColor: KarateColors.okSoft } as ViewStyle,
  anuPend: { backgroundColor: KarateColors.warnSoft } as ViewStyle,
  anuTxt: { fontSize: 11, fontWeight: "700" } as TextStyle,
  acq: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: KarateColors.primarySoft, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.primaryLine, padding: 16, marginTop: 6 } as ViewStyle,
  acqTitle: { fontSize: 14, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  acqSub: { fontSize: 12.5, color: KarateColors.ink2, marginTop: 3, lineHeight: 18 } as TextStyle,
  acqBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: KarateColors.primary, borderRadius: KarateRadius.sm, paddingVertical: 9, paddingHorizontal: 14 } as ViewStyle,
  acqBtnTxt: { color: "#fff", fontSize: 13, fontWeight: "700" } as TextStyle,
  overlay: { flex: 1, backgroundColor: "rgba(28,23,20,0.45)", alignItems: "center", justifyContent: "center", padding: 24 } as ViewStyle,
  sheet: { width: "100%", maxWidth: 380, backgroundColor: KarateColors.bg, borderRadius: KarateRadius.lg, padding: 20 } as ViewStyle,
  sheetHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" } as ViewStyle,
  sheetName: { fontSize: 16, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  sheetReg: { fontSize: 12, color: KarateColors.ink3, fontFamily: "monospace", marginTop: 1 } as TextStyle,
  sheetTitle: { fontSize: 13, fontWeight: "700", color: KarateColors.ink2, marginTop: 14 } as TextStyle,
  trajRow: { flexDirection: "row", alignItems: "center", gap: 10 } as ViewStyle,
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: "rgba(0,0,0,0.1)" } as ViewStyle,
  trajBelt: { flex: 1, fontSize: 13, color: KarateColors.ink } as TextStyle,
  trajAno: { fontSize: 12, color: KarateColors.ink3, fontFamily: "monospace" } as TextStyle,
  sheetFoot: { fontSize: 11, color: KarateColors.ink4, marginTop: 16, textAlign: "center" } as TextStyle,
});
