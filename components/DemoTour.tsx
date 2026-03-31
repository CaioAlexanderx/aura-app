import { useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, Platform, Dimensions } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";

const TOUR_KEY = "aura_tour_done";

type TourStep = {
  title: string;
  description: string;
  icon: string;
  position: "top" | "center" | "bottom";
};

const STEPS: TourStep[] = [
  {
    title: "Bem-vindo ao modo demonstrativo!",
    description: "Explore todas as funcionalidades da Aura com dados ilustrativos. Nada aqui e real - fique à vontade para clicar em tudo.",
    icon: "star",
    position: "center",
  },
  {
    title: "Seu painel financeiro",
    description: "Aqui voce acompanha faturamento, despesas e lucro do mês. Clique no card para ver detalhes no Financeiro.",
    icon: "wallet",
    position: "top",
  },
  {
    title: "Acesso rápido",
    description: "PDV, Financeiro, Estoque, NF-e e Contabilidade - tudo a um clique. Use tambem a sidebar para navegar.",
    icon: "dashboard",
    position: "center",
  },
  {
    title: "Obrigações contábeis",
    description: "A Aura organiza seus prazos e guia você passo a passo. Veja a tela de Contabilidade para mais detalhes.",
    icon: "calculator",
    position: "bottom",
  },
  {
    title: "Pronto para explorar!",
    description: "Navegue livremente pelas telas usando a sidebar ou os atalhos. Este e o modo demonstrativo - ao adquirir a Aura, seus dados reais serão carregados aqui.",
    icon: "check",
    position: "center",
  },
];

export function DemoTour({ visible }: { visible: boolean }) {
  const [step, setStep] = useState(0);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (Platform.OS === "web") {
      const done = localStorage.getItem(TOUR_KEY);
      if (!done) setShow(true);
    }
  }, [visible]);

  if (!show || !visible) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

  function dismiss() {
    if (Platform.OS === "web") localStorage.setItem(TOUR_KEY, "1");
    setShow(false);
  }

  function next() {
    if (isLast) { dismiss(); return; }
    setStep(s => s + 1);
  }

  function prev() {
    if (!isFirst) setStep(s => s - 1);
  }

  const posStyle = current.position === "top" ? { justifyContent: "flex-start" as const, paddingTop: 120 }
    : current.position === "bottom" ? { justifyContent: "flex-end" as const, paddingBottom: 120 }
    : { justifyContent: "center" as const };

  return (
    <View style={[t.overlay, posStyle]}>
      <View style={t.card}>
        {/* Progress dots */}
        <View style={t.dots}>
          {STEPS.map((_, i) => (
            <View key={i} style={[t.dot, i === step && t.dotActive, i < step && t.dotDone]} />
          ))}
        </View>

        {/* Icon */}
        <View style={t.iconWrap}>
          <Icon name={current.icon as any} size={28} color={Colors.violet3} />
        </View>

        {/* Content */}
        <Text style={t.title}>{current.title}</Text>
        <Text style={t.desc}>{current.description}</Text>

        {/* Step counter */}
        <Text style={t.counter}>{step + 1} de {STEPS.length}</Text>

        {/* Actions */}
        <View style={t.actions}>
          {!isFirst && (
            <Pressable onPress={prev} style={t.prevBtn}>
              <Text style={t.prevText}>Anterior</Text>
            </Pressable>
          )}
          <View style={{ flex: 1 }} />
          <Pressable onPress={dismiss} style={t.skipBtn}>
            <Text style={t.skipText}>Pular tour</Text>
          </Pressable>
          <Pressable onPress={next} style={t.nextBtn}>
            <Text style={t.nextText}>{isLast ? "Comecar" : "Proximo"}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const t = StyleSheet.create({
  overlay: {
    position: "absolute" as any,
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: step === 0 ? "rgba(6,8,22,0.95)" : step === 0 ? "rgba(6,8,22,0.95)" : "rgba(0,0,0,0.35)",
    zIndex: 1000,
    alignItems: "center",
    padding: 20,
  },
  card: {
    backgroundColor: Colors.bg3,
    borderRadius: 24,
    padding: 32,
    maxWidth: 440,
    width: "100%",
    borderWidth: 1,
    borderColor: Colors.border2,
    alignItems: "center",
  },
  dots: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 20,
  },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: Colors.bg4,
  },
  dotActive: { backgroundColor: Colors.violet, width: 24 },
  dotDone: { backgroundColor: Colors.violet3 },
  iconWrap: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: Colors.violetD,
    alignItems: "center", justifyContent: "center",
    marginBottom: 16,
    borderWidth: 1, borderColor: Colors.border2,
  },
  title: {
    fontSize: 18, fontWeight: "700", color: Colors.ink,
    textAlign: "center", marginBottom: 8,
  },
  desc: {
    fontSize: 13, color: Colors.ink3, textAlign: "center",
    lineHeight: 20, marginBottom: 16,
  },
  counter: {
    fontSize: 11, color: Colors.ink3, marginBottom: 16,
  },
  actions: {
    flexDirection: "row", alignItems: "center", width: "100%", gap: 8,
  },
  prevBtn: {
    paddingVertical: 10, paddingHorizontal: 14,
  },
  prevText: { fontSize: 13, color: Colors.violet3, fontWeight: "500" },
  skipBtn: {
    paddingVertical: 10, paddingHorizontal: 14,
  },
  skipText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  nextBtn: {
    backgroundColor: Colors.violet, borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 20,
  },
  nextText: { fontSize: 13, color: "#fff", fontWeight: "700" },
});

export default DemoTour;
