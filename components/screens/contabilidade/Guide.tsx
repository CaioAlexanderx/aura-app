import { useState } from "react";
import { View, Text, StyleSheet, Pressable, Linking, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { StepAction } from "./StepAction";
import type { Obligation } from "./types";

type Props = { obligation: Obligation; onBack: () => void; onComplete: (code: string) => void };

export function Guide({ obligation: o, onBack, onComplete }: Props) {
  const storageKey = `aura_guide_${o.code}`;
  const isDone = o.status === "done";
  const [completed, setCompleted] = useState<number[]>(() => {
    if (isDone && o.steps) return o.steps.map((_, i) => i);
    if (typeof localStorage !== "undefined") {
      try { const s = localStorage.getItem(storageKey); return s ? JSON.parse(s) : []; } catch { return []; }
    }
    return [];
  });

  const steps = o.steps || [];
  const isAutomatic = o.filter_label === "aura_resolve";
  const allCompleted = completed.length === steps.length && steps.length > 0;
  const pct = steps.length > 0 ? Math.round((completed.length / steps.length) * 100) : 0;

  function toggle(i: number) {
    if (isDone) return;
    setCompleted(prev => {
      const next = prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i];
      if (typeof localStorage !== "undefined") { try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {} }
      if (next.length === steps.length) setTimeout(() => onComplete(o.code), 300);
      return next;
    });
  }

  function openPortal() {
    if (!o.portal_url) return;
    if (Platform.OS === "web" && typeof window !== "undefined") window.open(o.portal_url, "_blank");
    else Linking.openURL(o.portal_url);
  }

  return (
    <View>
      <Pressable onPress={onBack} style={{ marginBottom: 16 }}><Text style={{ fontSize: 13, color: Colors.violet3, fontWeight: "600" }}>{'<'} Voltar</Text></Pressable>

      <View style={s.hero}>
        <Text style={s.heroTitle}>{o.name}</Text>
        <View style={[s.actionBadge, { backgroundColor: isAutomatic ? Colors.greenD : Colors.amberD }]}>
          <Text style={[s.actionText, { color: isAutomatic ? Colors.green : Colors.amber }]}>{isAutomatic ? "Automatico — Aura cuida de tudo" : "Voce precisa agir — siga o passo a passo"}</Text>
        </View>
        <Text style={s.heroDesc}>{o.aura_action}</Text>
        {o.user_action && <Text style={s.heroUserAction}>{o.user_action}</Text>}
        {o.portal_url && (
          <Pressable onPress={openPortal} style={s.portalHeroBtn}>
            <Icon name="globe" size={14} color={Colors.violet3} />
            <Text style={s.portalHeroBtnText}>{o.portal_label || "Abrir portal oficial"}</Text>
            <Text style={{ fontSize: 12, color: Colors.violet3 }}>{'\u2197'}</Text>
          </Pressable>
        )}
      </View>

      {!isDone && (
        <View style={s.progressSection}>
          <View style={s.progressTrack}><View style={[s.progressFill, { width: `${pct}%`, backgroundColor: allCompleted ? Colors.green : Colors.violet }]} /></View>
          <Text style={s.progressText}>{completed.length} de {steps.length} passos concluidos</Text>
        </View>
      )}

      {isDone && <View style={s.doneBanner}><View style={s.doneCircle}><Text style={{ fontSize: 14, color: "#fff", fontWeight: "800" }}>OK</Text></View><View><Text style={{ fontSize: 16, color: Colors.green, fontWeight: "700" }}>Concluido!</Text><Text style={{ fontSize: 12, color: Colors.ink3, marginTop: 2 }}>{o.name} esta em dia.</Text></View></View>}

      {!isDone && <View style={s.instruction}><Text style={s.instructionIcon}>i</Text><Text style={s.instructionText}>Clique em cada etapa para marcar como concluida. Progresso salvo automaticamente.</Text></View>}

      <Text style={s.stepsTitle}>{isDone ? "Etapas concluidas:" : isAutomatic ? "A Aura cuida de tudo:" : "Siga os passos:"}</Text>

      <View style={{ gap: 10, marginBottom: 20 }}>
        {steps.map((st, i) => {
          const d = completed.includes(i);
          return (
            <Pressable key={i} onPress={() => toggle(i)} disabled={isDone} style={[s.step, d && s.stepDone, isDone && { opacity: 0.8 }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={[s.stepNum, d && s.stepNumDone]}><Text style={[s.stepNumText, d && { color: "#fff" }]}>{d ? "OK" : i + 1}</Text></View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[s.stepText, d && s.stepTextDone]}>{st.text}</Text>
                  {!d && <View style={[s.stepBadge, { backgroundColor: st.auto ? Colors.greenD : Colors.amberD }]}><Text style={{ fontSize: 9, fontWeight: "600", color: st.auto ? Colors.green : Colors.amber }}>{st.auto ? "Automatico" : "Voce faz"}</Text></View>}
                </View>
              </View>
              {st.hint && !d && <Text style={s.stepHint}>{st.hint}</Text>}
              <StepAction step={st} completed={d} />
            </Pressable>
          );
        })}
      </View>

      {allCompleted && !isDone && <View style={s.doneBanner}><View style={s.doneCircle}><Text style={{ fontSize: 14, color: "#fff", fontWeight: "800" }}>OK</Text></View><View><Text style={{ fontSize: 16, color: Colors.green, fontWeight: "700" }}>Concluido!</Text><Text style={{ fontSize: 12, color: Colors.ink3, marginTop: 2 }}>{o.name} esta em dia.</Text></View></View>}

      <View style={s.disclaimer}><Text style={s.disclaimerIcon}>!</Text><Text style={s.disclaimerText}>Estimativas para apoio contabil informativo. Consulte o portal oficial.</Text></View>
    </View>
  );
}

const s = StyleSheet.create({
  hero: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border2, marginBottom: 20, gap: 8 },
  heroTitle: { fontSize: 22, color: Colors.ink, fontWeight: "800" },
  actionBadge: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, alignSelf: "flex-start" },
  actionText: { fontSize: 11, fontWeight: "600" },
  heroDesc: { fontSize: 13, color: Colors.ink3, lineHeight: 20 },
  heroUserAction: { fontSize: 12, color: Colors.amber, fontWeight: "500" },
  portalHeroBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.violetD, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: Colors.border2, alignSelf: "flex-start", marginTop: 4 },
  portalHeroBtnText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  progressSection: { marginBottom: 20, gap: 6 },
  progressTrack: { height: 8, backgroundColor: Colors.bg4, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: 8, borderRadius: 4 },
  progressText: { fontSize: 11, color: Colors.ink3 },
  instruction: { flexDirection: "row", gap: 8, backgroundColor: Colors.violetD, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: Colors.border2 },
  instructionIcon: { fontSize: 14, color: Colors.violet3, fontWeight: "700" },
  instructionText: { fontSize: 12, color: Colors.ink3, flex: 1, lineHeight: 18 },
  stepsTitle: { fontSize: 16, color: Colors.ink, fontWeight: "700", marginBottom: 14 },
  step: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border },
  stepDone: { borderColor: Colors.green + "44", backgroundColor: Colors.greenD },
  stepNum: { width: 36, height: 36, borderRadius: 12, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: Colors.border },
  stepNumDone: { backgroundColor: Colors.green, borderColor: Colors.green },
  stepNumText: { fontSize: 13, fontWeight: "800", color: Colors.ink3 },
  stepText: { fontSize: 14, color: Colors.ink, fontWeight: "600" },
  stepTextDone: { color: Colors.ink3, textDecorationLine: "line-through" },
  stepBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1, alignSelf: "flex-start" },
  stepHint: { fontSize: 11, color: Colors.ink3, marginTop: 8, marginLeft: 48, lineHeight: 16 },
  doneBanner: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: Colors.greenD, borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: Colors.green + "44" },
  doneCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.green, alignItems: "center", justifyContent: "center" },
  disclaimer: { flexDirection: "row", gap: 8, backgroundColor: Colors.amberD, borderRadius: 12, padding: 14 },
  disclaimerIcon: { fontSize: 14, color: Colors.amber, fontWeight: "700" },
  disclaimerText: { fontSize: 11, color: Colors.amber, flex: 1, lineHeight: 16 },
});

export default Guide;
