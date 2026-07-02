// ============================================================
// Stepper — Aura Karatê
//
// Indicador de progresso para wizards multi-passo.
// Padrão TrocaModal (canônico do repo: CLAUDE.md item 5).
//
// Anim (Fase 4/LOTE 2): quando um passo passa a "done", o check
// (✓) entra com scale+fade discreto. Animated.Value + useNativeDriver:false
// (web-safe). Timer do Animated é limpo no unmount via .stop().
// ============================================================
import React, { useEffect, useRef } from "react";
import { View, Text, Animated, StyleSheet, ViewStyle } from "react-native";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";

interface StepperProps {
  steps:       string[];
  currentStep: number;   // 0-based
  style?:      ViewStyle;
}

function StepCircle({ done, active, index }: { done: boolean; active: boolean; index: number }) {
  const pop = useRef(new Animated.Value(done ? 1 : 0)).current;
  const wasDone = useRef(done);

  useEffect(() => {
    if (done && !wasDone.current) {
      pop.setValue(0);
      const anim = Animated.spring(pop, { toValue: 1, useNativeDriver: false, friction: 5, tension: 140 });
      anim.start();
      wasDone.current = true;
      return () => anim.stop();
    }
    if (!done) {
      wasDone.current = false;
      pop.setValue(0);
    }
  }, [done, pop]);

  const checkScale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });

  return (
    <View style={[
      styles.circle,
      done    && styles.circleDone,
      active  && styles.circleActive,
      !done && !active && styles.circlePending,
    ]}>
      {done ? (
        <Animated.Text style={[styles.circleNum, styles.circleNumDone, { opacity: pop, transform: [{ scale: checkScale }] }]}>
          ✓
        </Animated.Text>
      ) : (
        <Text style={[styles.circleNum, active && styles.circleNumActive]}>
          {String(index + 1)}
        </Text>
      )}
    </View>
  );
}

export function Stepper({ steps, currentStep, style }: StepperProps) {
  return (
    <View style={[styles.row, style]} accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: steps.length - 1, now: currentStep }}
    >
      {steps.map((step, i) => {
        const done    = i < currentStep;
        const active  = i === currentStep;
        return (
          <React.Fragment key={i}>
            <View style={styles.stepCol}>
              <StepCircle done={done} active={active} index={i} />
              <Text style={[
                styles.stepLabel,
                active && styles.stepLabelActive,
              ]} numberOfLines={1}>
                {step}
              </Text>
            </View>
            {i < steps.length - 1 && (
              <View style={[styles.connector, done && styles.connectorDone]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 0,
  } as ViewStyle,
  stepCol: {
    alignItems: "center",
    flex: 1,
    gap: 4,
  } as ViewStyle,
  connector: {
    height: 2,
    flex: 1,
    backgroundColor: KarateColors.border,
    marginTop: 16,
    alignSelf: "flex-start",
  } as ViewStyle,
  connectorDone: {
    backgroundColor: KarateColors.primary,
  } as ViewStyle,
  circle: {
    width: 32, height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: KarateColors.border,
    backgroundColor: KarateColors.bg2,
  } as ViewStyle,
  circleDone: {
    backgroundColor: KarateColors.primary,
    borderColor:     KarateColors.primary,
  } as ViewStyle,
  circleActive: {
    borderColor:     KarateColors.primary,
    backgroundColor: KarateColors.primarySoft,
  } as ViewStyle,
  circlePending: {} as ViewStyle,
  circleNum:     { fontSize: 13, fontWeight: "700", color: KarateColors.ink3 },
  circleNumDone: { color: "#fff" },
  circleNumActive:{ color: KarateColors.primary },
  stepLabel:      { fontSize: 10, color: KarateColors.ink3, textAlign: "center", fontWeight: "600" },
  stepLabelActive:{ color: KarateColors.primary },
});
