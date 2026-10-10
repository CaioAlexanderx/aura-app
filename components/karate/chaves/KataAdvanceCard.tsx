// ============================================================
// Chaves — KataAdvanceCard (kata por notas: eliminatória → final)
//
// Bloco "Eliminatória completa → Classificar os N melhores para a
// final". Nasceu só na mesa pública do mesário (app/mesa); o QA de
// 10/10/2026 achou a federação sem como montar a final fora dela. Agora
// o MESMO bloco serve aos três lugares que operam a bateria:
//   - app/mesa/index.tsx (mesa pública, via karateMesaApi)
//   - torneio/koto.tsx (Modo Mesário da federação)
//   - KataScoring.tsx (painel da categoria na tela do campeonato)
// Quem chama só diz COMO avançar (`advance`) — a rota muda entre mesa
// pública e federação, o resto (stepper, padrão de N, toast, aviso de
// empate na linha de corte) é idêntico.
//
// Ausente não trava a final: `elimComplete` ignora quem tem ausência
// confirmada (`no_show === true`) — o backend elimina esses
// automaticamente no advance e devolve quantos (`absent`). Não
// credenciado (checked_in:false, no_show:false) NÃO é ausente.
// ============================================================
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { toast } from "@/components/Toast";
import type { KataScore, KataAdvanceResult } from "@/services/karateBracketsApi";
import { isAbsent } from "./shared";

/**
 * Quantos classificam por padrão. Antes vinha min(8, total) — numa
 * bateria de 6 isso dava "classificar os 6", uma final com todo mundo.
 * Agora: metade (arredondada para cima), no mínimo 2, no máximo 8.
 */
export function defaultAdvanceCount(withScore: number): number {
  return Math.min(8, Math.max(2, Math.ceil(withScore / 2)));
}

/** Eliminatória fechada = todo atleta PRESENTE tem nota. Ausente confirmado não conta. */
export function isKataElimComplete(eliminatoria: KataScore[]): boolean {
  const presentes = eliminatoria.filter((r) => !isAbsent(r));
  return presentes.length > 0 && presentes.every((r) => r.nota != null);
}

function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many;
}

/** Texto do toast de sucesso — inclui os ausentes eliminados automaticamente. */
export function advanceSuccessMessage(result: KataAdvanceResult): string {
  const n = result.advanced ?? 0;
  let msg = `${n} ${plural(n, "atleta classificado", "atletas classificados")} para a final.`;
  const absent = result.absent ?? 0;
  if (absent > 0) {
    msg += ` ${absent} ${plural(absent, "ausente eliminado", "ausentes eliminados")} automaticamente.`;
  }
  return msg;
}

export function KataAdvanceCard({
  scores, advance, onAdvanced, onError, disabledReason, style,
}: {
  /** Todas as linhas da bateria (eliminatória e final). */
  scores: KataScore[];
  /** Chama a rota de avanço (mesa pública ou federação). */
  advance: (advanceCount: number) => Promise<KataAdvanceResult>;
  /** Depois do avanço com sucesso — quem chama recarrega a bateria. */
  onAdvanced?: () => void | Promise<void>;
  /** Tratamento de erro do chamador; devolver true = já tratado (sem toast aqui). */
  onError?: (e: any) => boolean;
  /** Quando presente, o botão fica desabilitado e o texto explica o porquê. */
  disabledReason?: string | null;
  /** Espaçamento do bloco no layout de quem chama (só quando ele aparece). */
  style?: ViewStyle;
}) {
  const eliminatoria = useMemo(() => scores.filter((r) => r.phase === "eliminatoria"), [scores]);
  const hasFinal = useMemo(() => scores.some((r) => r.phase === "final"), [scores]);
  const elimComplete = isKataElimComplete(eliminatoria);
  // Teto do stepper: quem tem nota (ausente sem nota sai no advance).
  const withScore = eliminatoria.filter((r) => r.nota != null).length;
  const minCount = Math.min(2, withScore);

  const [advanceCount, setAdvanceCount] = useState(() => Math.min(defaultAdvanceCount(withScore), withScore));
  const [advancing, setAdvancing] = useState(false);
  /** Empate persistente na linha de corte devolvido pelo advance. */
  const [tieBreakNames, setTieBreakNames] = useState<string[] | null>(null);

  // O total muda conforme as notas entram — o padrão acompanha.
  useEffect(() => {
    setAdvanceCount(Math.min(defaultAdvanceCount(withScore), withScore));
  }, [withScore]);

  const handleAdvance = useCallback(async () => {
    setAdvancing(true);
    try {
      const result = await advance(advanceCount);
      toast.success(advanceSuccessMessage(result));
      const tied = result.tie_break_needed || [];
      setTieBreakNames(
        tied.length
          ? tied.map((id) => scores.find((r) => r.entry_id === id)?.student_name || id)
          : null
      );
      await onAdvanced?.();
    } catch (e: any) {
      if (onError?.(e)) return;
      toast.error(e?.message || "Não foi possível classificar para a final.");
    } finally {
      setAdvancing(false);
    }
  }, [advance, advanceCount, scores, onAdvanced, onError]);

  const showAdvance = elimComplete && !hasFinal;
  if (!showAdvance && !tieBreakNames?.length) return null;

  const blocked = !!disabledReason;

  return (
    <View style={[k.wrap, style]}>
      {!!tieBreakNames?.length && (
        <View style={k.tieBreakBox}>
          <Icon name="alert-circle" size={16} color={P.warn} />
          <View style={{ flex: 1 }}>
            <Text style={k.tieBreakTitle}>Empate na linha de corte</Text>
            <Text style={k.tieBreakTxt}>
              Novo kata para: {tieBreakNames.join(", ")}. A classificação foi aplicada mesmo assim — refaça a apresentação e lance as notas de novo para desempatar.
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setTieBreakNames(null)}
            accessibilityRole="button"
            accessibilityLabel="Dispensar aviso de empate"
            style={{ padding: 6 }}
          >
            <Icon name="close" size={14} color={C.ink3} />
          </TouchableOpacity>
        </View>
      )}

      {showAdvance && (
        <View style={k.advanceCard}>
          <View style={k.head}>
            <Icon name="flag" size={18} color={C.ink} />
            <Text style={k.advanceTitle}>Eliminatória completa</Text>
          </View>
          <Text style={k.txt}>
            {blocked ? disabledReason : "Escolha quantos atletas classificam e monte a final."}
          </Text>
          <View style={k.stepperRow}>
            <TouchableOpacity
              style={[k.stepBtn, (advanceCount <= minCount || blocked) && k.btnDisabled]}
              disabled={advanceCount <= minCount || blocked}
              onPress={() => setAdvanceCount((n) => Math.max(minCount, n - 1))}
              accessibilityRole="button"
              accessibilityLabel="Diminuir quantidade de classificados"
            >
              <Icon name="minus" size={18} color={C.ink} />
            </TouchableOpacity>
            <View style={k.stepValueBox}>
              <Text style={k.stepValue}>{advanceCount}</Text>
              <Text style={k.stepValueSub}>{advanceCount === 1 ? "classifica" : "classificam"}</Text>
            </View>
            <TouchableOpacity
              style={[k.stepBtn, (advanceCount >= withScore || blocked) && k.btnDisabled]}
              disabled={advanceCount >= withScore || blocked}
              onPress={() => setAdvanceCount((n) => Math.min(withScore, n + 1))}
              accessibilityRole="button"
              accessibilityLabel="Aumentar quantidade de classificados"
            >
              <Icon name="plus" size={18} color={C.ink} />
            </TouchableOpacity>
          </View>
          <KarateButton
            label={advancing ? "Classificando..." : `Classificar os ${advanceCount} melhores para a final`}
            variant="sumi"
            size="lg"
            loading={advancing}
            disabled={advancing || blocked || advanceCount < 1}
            onPress={handleAdvance}
          />
        </View>
      )}
    </View>
  );
}

const k = StyleSheet.create({
  wrap: { gap: 10 } as ViewStyle,
  advanceCard: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border2, borderRadius: R.lg, padding: 16, gap: 10 } as ViewStyle,
  head: { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  advanceTitle: { fontFamily: F.heading, fontSize: 18, fontWeight: "600", color: C.ink } as TextStyle,
  txt: { fontFamily: F.body, fontSize: 13, color: C.ink2, lineHeight: 19 } as TextStyle,
  stepperRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 } as ViewStyle,
  stepBtn: { width: 56, height: 56, borderRadius: R.md, borderWidth: 1, borderColor: C.border2, backgroundColor: C.glassHi, alignItems: "center", justifyContent: "center" } as ViewStyle,
  btnDisabled: { opacity: 0.5 } as ViewStyle,
  stepValueBox: { alignItems: "center", minWidth: 90 } as ViewStyle,
  stepValue: { fontFamily: F.mono, fontSize: 34, color: C.ink } as TextStyle,
  stepValueSub: { fontFamily: F.body, fontSize: 11, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", color: C.ink3 } as TextStyle,

  tieBreakBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: P.warnWash, borderWidth: 1, borderColor: C.border2, borderRadius: R.md, padding: 12 } as ViewStyle,
  tieBreakTitle: { fontFamily: F.body, fontSize: 13, fontWeight: "700", color: P.warn } as TextStyle,
  tieBreakTxt: { fontFamily: F.body, fontSize: 12, color: C.ink2, lineHeight: 17, marginTop: 2 } as TextStyle,
});
