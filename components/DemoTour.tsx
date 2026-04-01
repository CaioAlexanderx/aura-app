import { useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, Platform, ScrollView } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";

const TOUR_KEY = "aura_tour_done";

type TourStep = {
  title: string;
  description: string;
  icon: string;
};

const STEPS: TourStep[] = [
  {
    title: "Bem-vindo ao modo demonstrativo!",
    description: "Explore todas as funcionalidades da Aura com dados ilustrativos. Nada aqui é real \u2014 fique à vontade para clicar em tudo.",
    icon: "star",
  },
  {
    title: "Seu painel financeiro",
    description: "Aqui você acompanha faturamento, despesas e lucro do mês. Clique no card para ver detalhes no Financeiro.",
    icon: "wallet",
  },
  {
    title: "Acesso rápido",
    description: "PDV, Financeiro, Estoque, NF-e e Contabilidade \u2014 tudo a um clique. Use também a sidebar para navegar.",
    icon: "dashboard",
  },
  {
    title: "Obrigações contábeis",
    description: "A Aura organiza seus prazos e guia você passo a passo. Veja a tela de Contabilidade para mais detalhes.",
    icon: "calculator",
  },
  {
    title: "Pronto para explorar!",
    description: "Navegue livremente pelas telas. Este é o modo demonstrativo \u2014 ao adquirir a Aura, seus dados reais serão carregados aqui.",
    icon: "check",
  },
];

function useScreenWidth() {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const h = () => setW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return w;
}

export function DemoTour({ visible }: { visible: boolean }) {
  const [step, setStep] = useState(0);
  const [show, setShow] = useState(false);
  const screenW = useScreenWidth();
  const isMobile = screenW <= 768;

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

  const overlayBg = step === 0 ? "rgba(6,8,22,0.92)" : "rgba(0,0,0,0.65)";

  if (Platform.OS === "web") {
    return (
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: overlayBg, padding: isMobile ? 16 : 20,
        overflowY: "auto",
      } as any}>
        <div style={{
          background: Colors.bg3, borderRadius: 24,
          padding: isMobile ? 20 : 32,
          maxWidth: isMobile ? "100%" : 440, width: "100%",
          border: "1px solid " + Colors.border2,
          display: "flex", flexDirection: "column", alignItems: "center",
          maxHeight: isMobile ? "90vh" : "auto",
          overflowY: isMobile ? "auto" : "visible",
        } as any}>
          {/* Progress dots */}
          <div style={{ display: "flex", gap: 6, marginBottom: 16 } as any}>
            {STEPS.map((_, i) => (
              <div key={i} style={{
                width: i === step ? 24 : 8, height: 8, borderRadius: 4,
                background: i === step ? Colors.violet : i < step ? Colors.violet3 : Colors.bg4,
                transition: "width 0.3s ease, background 0.3s ease",
              } as any} />
            ))}
          </div>

          {/* Icon */}
          <div style={{
            width: isMobile ? 48 : 56, height: isMobile ? 48 : 56, borderRadius: 16,
            background: Colors.violetD, display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 16, border: "1px solid " + Colors.border2,
          } as any}>
            <Icon name={current.icon as any} size={isMobile ? 22 : 28} color={Colors.violet3} />
          </div>

          {/* Title */}
          <div style={{
            fontSize: isMobile ? 16 : 18, fontWeight: 700, color: Colors.ink,
            textAlign: "center", marginBottom: 8, lineHeight: 1.3,
          } as any}>{current.title}</div>

          {/* Description */}
          <div style={{
            fontSize: isMobile ? 12 : 13, color: Colors.ink3, textAlign: "center",
            lineHeight: 1.6, marginBottom: 16, maxWidth: 360,
          } as any}>{current.description}</div>

          {/* Counter */}
          <div style={{ fontSize: 11, color: Colors.ink3, marginBottom: 16 } as any}>
            {step + 1} de {STEPS.length}
          </div>

          {/* Swipe hint on mobile */}
          {isMobile && step === 0 && (
            <div style={{
              fontSize: 10, color: Colors.violet3, fontStyle: "italic",
              marginBottom: 12, textAlign: "center",
            } as any}>
              Deslize ou use os botões para navegar
            </div>
          )}

          {/* Actions */}
          <div style={{
            display: "flex", flexDirection: isMobile ? "column" : "row",
            alignItems: "center", width: "100%", gap: 8,
          } as any}>
            {/* Main action row */}
            <div style={{
              display: "flex", flexDirection: "row", alignItems: "center",
              width: "100%", gap: 8, justifyContent: "space-between",
            } as any}>
              {!isFirst ? (
                <button onClick={prev} style={{
                  background: "transparent", border: "none", cursor: "pointer",
                  fontSize: 13, color: Colors.violet3, fontWeight: 500,
                  padding: "10px 14px",
                } as any}>Anterior</button>
              ) : <div />}

              <div style={{ display: "flex", gap: 8, alignItems: "center" } as any}>
                <button onClick={dismiss} style={{
                  background: "transparent", border: "none", cursor: "pointer",
                  fontSize: 12, color: Colors.ink3, fontWeight: 500, padding: "10px 14px",
                } as any}>Pular tour</button>

                <button onClick={next} style={{
                  background: Colors.violet, border: "none", cursor: "pointer",
                  fontSize: 13, color: "#fff", fontWeight: 700,
                  borderRadius: 10, padding: isMobile ? "12px 20px" : "10px 20px",
                  minWidth: isMobile ? 120 : "auto",
                } as any}>{isLast ? "Começar" : "Próximo"}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Native fallback
  return (
    <View style={[t.overlay, { backgroundColor: overlayBg }]}>
      <ScrollView contentContainerStyle={t.scrollContent}>
        <View style={t.card}>
          <View style={t.dots}>
            {STEPS.map((_, i) => (
              <View key={i} style={[t.dot, i === step && t.dotActive, i < step && t.dotDone]} />
            ))}
          </View>
          <View style={t.iconWrap}>
            <Icon name={current.icon as any} size={28} color={Colors.violet3} />
          </View>
          <Text style={t.title}>{current.title}</Text>
          <Text style={t.desc}>{current.description}</Text>
          <Text style={t.counter}>{step + 1} de {STEPS.length}</Text>
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
      </ScrollView>
    </View>
  );
}

const t = StyleSheet.create({
  overlay: {
    position: "absolute" as any,
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 1000,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    flexGrow: 1, justifyContent: "center", alignItems: "center", padding: 20,
  },
  card: {
    backgroundColor: Colors.bg3,
    borderRadius: 24,
    padding: 24,
    maxWidth: 440,
    width: "100%",
    borderWidth: 1,
    borderColor: Colors.border2,
    alignItems: "center",
  },
  dots: { flexDirection: "row", gap: 6, marginBottom: 20 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.bg4 },
  dotActive: { backgroundColor: Colors.violet, width: 24 },
  dotDone: { backgroundColor: Colors.violet3 },
  iconWrap: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: Colors.violetD,
    alignItems: "center", justifyContent: "center",
    marginBottom: 16, borderWidth: 1, borderColor: Colors.border2,
  },
  title: { fontSize: 18, fontWeight: "700", color: Colors.ink, textAlign: "center", marginBottom: 8 },
  desc: { fontSize: 13, color: Colors.ink3, textAlign: "center", lineHeight: 20, marginBottom: 16 },
  counter: { fontSize: 11, color: Colors.ink3, marginBottom: 16 },
  actions: { flexDirection: "row", alignItems: "center", width: "100%", gap: 8 },
  prevBtn: { paddingVertical: 10, paddingHorizontal: 14 },
  prevText: { fontSize: 13, color: Colors.violet3, fontWeight: "500" },
  skipBtn: { paddingVertical: 10, paddingHorizontal: 14 },
  skipText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  nextBtn: { backgroundColor: Colors.violet, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20 },
  nextText: { fontSize: 13, color: "#fff", fontWeight: "700" },
});

export default DemoTour;
