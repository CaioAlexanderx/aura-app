// ============================================================
// NotasArbitros — Onda B · lançamento de kata por 5 notas
//
// Cada árbitro dá UMA nota (5 no padrão WKF; 3 a 7 aceitos). O
// TOTAL é a soma cortando a maior e a menor. A prévia daqui é só
// para o mesário conferir na hora — QUEM COMPUTA É O BACKEND
// (desempate somando de volta a menor e depois a maior, empate
// persistente → novo kata). O servidor é a verdade; a resposta do
// PUT devolve o `nota` computado e é ela que fica na tela.
//
// Componente compartilhado pelas 3 superfícies de lançamento:
//   - app/mesa/index.tsx (mesa pública do mesário)
//   - app/karate/(federation)/competicoes/torneio/koto.tsx (mesário interno)
//   - components/karate/chaves/CategoryBracketPanel.tsx (modal da federação)
//
// Estilos próprios (tokens Shoji), sem depender do botão de
// nenhuma das telas — assim o mesmo bloco encaixa nas três sem
// quebrar o visual de cada uma.
//
// Uso em TABLET no calor do evento: alvos de toque generosos
// (56pt+), teclado decimal, vírgula pt-BR, foco encadeado A1→A5.
// ============================================================
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import {
  KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F,
} from "@/constants/karateTheme";

/** Quantidade padrão de árbitros (WKF). O backend aceita de 3 a 7. */
export const DEFAULT_JUDGE_COUNT = 5;
export const MIN_JUDGE_COUNT = 3;
export const MAX_JUDGE_COUNT = 7;

// ── Helpers de número (pt-BR) ────────────────────────────────

/** "7,5" → 7.5 · "" → null · lixo → NaN (o chamador trata). */
export function parseNotaBR(text: string): number | null {
  const t = (text ?? "").trim();
  if (!t) return null;
  return Number(t.replace(",", "."));
}

/** 21.6 → "21,6" · 7 → "7,0" · 21.55 → "21,55". */
export function fmtNota(n: number): string {
  const r = Math.round(n * 100) / 100;
  const decimals = Math.abs(r * 10 - Math.round(r * 10)) < 1e-9 ? 1 : 2;
  return r.toFixed(decimals).replace(".", ",");
}

/**
 * Índices da MAIOR e da MENOR nota (uma ocorrência de cada) — as
 * descartadas. Com notas todas iguais, corta a primeira e a segunda.
 */
export function trimmedIndexes(notas: number[]): { maxIdx: number; minIdx: number } {
  let maxIdx = 0;
  for (let i = 1; i < notas.length; i++) if (notas[i] > notas[maxIdx]) maxIdx = i;
  let minIdx = -1;
  for (let i = 0; i < notas.length; i++) {
    if (i === maxIdx) continue;
    if (minIdx < 0 || notas[i] < notas[minIdx]) minIdx = i;
  }
  return { maxIdx, minIdx };
}

/**
 * TOTAL de exibição: soma cortando a maior e a menor. MESMO cálculo
 * do backend — mas só para prévia; o valor persistido é o do servidor.
 */
export function computeKataTotal(notas: number[]): number | null {
  if (!notas || notas.length < MIN_JUDGE_COUNT) return null;
  if (notas.some((n) => !Number.isFinite(n))) return null;
  const { maxIdx, minIdx } = trimmedIndexes(notas);
  const total = notas.reduce((acc, n, i) => (i === maxIdx || i === minIdx ? acc : acc + n), 0);
  return Math.round(total * 100) / 100;
}

// ── NotasBreakdown — exibição (total + notas individuais) ────
/**
 * Mostra o TOTAL e, discreto, as 5 individuais quando existirem
 * ("21,6 · 7,0/7,2/7,4/7,6/6,8"), com a maior e a menor esmaecidas
 * e riscadas — são as descartadas.
 */
export function NotasBreakdown({
  nota, notas, align = "right", style,
}: {
  nota: number | null | undefined;
  notas?: number[] | null;
  align?: "left" | "right";
  style?: ViewStyle;
}) {
  const list = Array.isArray(notas) && notas.length >= MIN_JUDGE_COUNT ? notas : null;
  const trimmed = list ? trimmedIndexes(list) : null;
  return (
    <View style={[bd.wrap, align === "left" && bd.wrapLeft, style]}>
      <Text style={bd.total}>{nota != null ? fmtNota(nota) : "—"}</Text>
      {!!list && (
        <View style={[bd.notasRow, align === "left" && bd.wrapLeft]}>
          {list.map((n, i) => {
            const cut = trimmed && (i === trimmed.maxIdx || i === trimmed.minIdx);
            return (
              <React.Fragment key={i}>
                {i > 0 && <Text style={bd.sep}>/</Text>}
                <Text style={[bd.nota, cut && bd.notaCut]}>{fmtNota(n)}</Text>
              </React.Fragment>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ── NotasArbitros — lançamento ───────────────────────────────

export type NotasSubmit = { notas: number[] } | { nota: number };

export function NotasArbitros({
  athleteName,
  phaseLabel,
  initialNotas,
  initialNota,
  judgeCount = DEFAULT_JUDGE_COUNT,
  saving = false,
  autoFocus = true,
  submitLabel = "Salvar notas",
  onSubmit,
  onCancel,
  style,
}: {
  athleteName?: string;
  phaseLabel?: string;
  /** Notas já lançadas (edição). */
  initialNotas?: number[] | null;
  /** Total já lançado — usado só no modo legado de nota única. */
  initialNota?: number | null;
  judgeCount?: number;
  saving?: boolean;
  autoFocus?: boolean;
  submitLabel?: string;
  onSubmit: (payload: NotasSubmit) => void | Promise<void>;
  onCancel?: () => void;
  style?: ViewStyle;
}) {
  const count = Math.min(MAX_JUDGE_COUNT, Math.max(MIN_JUDGE_COUNT, judgeCount));

  const [legacy, setLegacy] = useState(false);
  const [fields, setFields] = useState<string[]>(() => {
    const base = Array.from({ length: count }, () => "");
    if (Array.isArray(initialNotas)) {
      initialNotas.slice(0, count).forEach((n, i) => { base[i] = fmtNota(n); });
    }
    return base;
  });
  const [notaUnica, setNotaUnica] = useState(
    initialNota != null ? fmtNota(initialNota) : ""
  );

  const refs = useRef<Array<TextInput | null>>([]);

  const setField = useCallback((idx: number, value: string) => {
    // Só dígitos, vírgula e ponto — o teclado decimal do web deixa passar letra.
    const clean = value.replace(/[^0-9.,]/g, "").replace(".", ",").slice(0, 5);
    setFields((prev) => prev.map((v, i) => (i === idx ? clean : v)));
  }, []);

  // Validação por campo: vazio = pendente (sem erro visível), fora de 0..10 = erro.
  const parsed = useMemo(() => fields.map((t) => parseNotaBR(t)), [fields]);
  const fieldErrors = useMemo(
    () => parsed.map((n) => {
      if (n === null) return false;
      return !Number.isFinite(n) || n < 0 || n > 10;
    }),
    [parsed]
  );
  const anyError = fieldErrors.some(Boolean);
  const allFilled = parsed.every((n) => n !== null);
  const validNotas = allFilled && !anyError ? (parsed as number[]) : null;
  const preview = validNotas ? computeKataTotal(validNotas) : null;
  const trimmed = validNotas ? trimmedIndexes(validNotas) : null;

  const notaUnicaParsed = parseNotaBR(notaUnica);
  const notaUnicaInvalid =
    notaUnicaParsed !== null && (!Number.isFinite(notaUnicaParsed) || notaUnicaParsed < 0);

  const canSubmit = legacy
    ? notaUnicaParsed !== null && !notaUnicaInvalid && !saving
    : !!validNotas && !saving;

  const handleSubmit = useCallback(() => {
    if (saving) return;
    if (legacy) {
      const n = parseNotaBR(notaUnica);
      if (n === null || !Number.isFinite(n) || n < 0) return;
      onSubmit({ nota: n });
      return;
    }
    if (!validNotas) return;
    onSubmit({ notas: validNotas });
  }, [saving, legacy, notaUnica, validNotas, onSubmit]);

  const focusNext = useCallback((idx: number) => {
    const next = refs.current[idx + 1];
    if (next) next.focus();
    else handleSubmit();
  }, [handleSubmit]);

  return (
    <View style={[st.wrap, style]}>
      <View style={st.head}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={st.title} numberOfLines={1}>
            {legacy ? "Nota única" : `Notas dos ${count} árbitros`}
            {athleteName ? ` · ${athleteName}` : ""}
          </Text>
          {!!phaseLabel && <Text style={st.phase}>{phaseLabel}</Text>}
        </View>
        <TouchableOpacity
          onPress={() => setLegacy((v) => !v)}
          style={st.modeBtn}
          accessibilityRole="button"
          accessibilityLabel={legacy ? "Voltar para notas por árbitro" : "Lançar nota única"}
        >
          <Text style={st.modeBtnTxt}>{legacy ? `${count} árbitros` : "nota única"}</Text>
        </TouchableOpacity>
      </View>

      {legacy ? (
        <>
          <TextInput
            style={[st.legacyInput, notaUnicaInvalid && st.inputError]}
            value={notaUnica}
            onChangeText={(v) => setNotaUnica(v.replace(/[^0-9.,]/g, "").replace(".", ",").slice(0, 6))}
            placeholder="0,0"
            placeholderTextColor={C.ink4}
            keyboardType="decimal-pad"
            inputMode="decimal"
            autoFocus={autoFocus}
            onSubmitEditing={handleSubmit}
            accessibilityLabel="Nota única do atleta"
          />
          <Text style={st.hint}>
            Modo legado (bandeirada convertida): lance o total já apurado pela mesa.
          </Text>
        </>
      ) : (
        <>
          <View style={st.grid}>
            {fields.map((v, i) => (
              <View key={i} style={st.cell}>
                <Text style={[st.cellLabel, trimmed && (i === trimmed.maxIdx || i === trimmed.minIdx) && st.cellLabelCut]}>
                  {`A${i + 1}`}
                </Text>
                <TextInput
                  ref={(el) => { refs.current[i] = el; }}
                  style={[
                    st.input,
                    fieldErrors[i] && st.inputError,
                    !!trimmed && (i === trimmed.maxIdx || i === trimmed.minIdx) && st.inputCut,
                  ]}
                  value={v}
                  onChangeText={(t) => setField(i, t)}
                  placeholder="0,0"
                  placeholderTextColor={C.ink4}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  autoFocus={autoFocus && i === 0}
                  maxLength={5}
                  selectTextOnFocus
                  returnKeyType={i === count - 1 ? "done" : "next"}
                  onSubmitEditing={() => focusNext(i)}
                  accessibilityLabel={`Nota do árbitro ${i + 1}`}
                />
              </View>
            ))}
          </View>

          {anyError && (
            <View style={st.errorRow}>
              <Icon name="alert-circle" size={13} color={P.danger} />
              <Text style={st.errorTxt}>Cada nota vai de 0 a 10 (ex.: 7,4).</Text>
            </View>
          )}

          <View style={st.totalRow}>
            <Text style={st.totalLabel}>Total</Text>
            <Text style={st.totalValue}>{preview != null ? fmtNota(preview) : "—"}</Text>
            <Text style={st.totalHint}>
              {preview != null
                ? "soma cortando a maior e a menor — o servidor recalcula ao salvar"
                : `preencha as ${count} notas para lançar`}
            </Text>
          </View>
        </>
      )}

      <View style={st.actions}>
        {!!onCancel && (
          <TouchableOpacity
            style={st.cancelBtn}
            onPress={onCancel}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Cancelar"
          >
            <Text style={st.cancelTxt}>Cancelar</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[st.saveBtn, !canSubmit && st.saveBtnDisabled]}
          disabled={!canSubmit}
          onPress={handleSubmit}
          accessibilityRole="button"
          accessibilityLabel={legacy ? "Salvar nota única" : "Salvar notas dos árbitros"}
        >
          <Icon name="check" size={16} color={P.paperWarm} />
          <Text style={st.saveTxt}>
            {saving ? "Salvando…" : legacy ? "Salvar nota" : submitLabel}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Estilos ─────────────────────────────────────────────────
const bd = StyleSheet.create({
  wrap: { alignItems: "flex-end", minWidth: 56 } as ViewStyle,
  wrapLeft: { alignItems: "flex-start" } as ViewStyle,
  total: { fontFamily: F.mono, fontSize: 15, color: C.ink, fontVariant: ["tabular-nums"] } as TextStyle,
  notasRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end", marginTop: 1 } as ViewStyle,
  nota: { fontFamily: F.mono, fontSize: 10.5, color: C.ink3, fontVariant: ["tabular-nums"] } as TextStyle,
  notaCut: { color: C.ink4, opacity: 0.6, textDecorationLine: "line-through" } as TextStyle,
  sep: { fontFamily: F.mono, fontSize: 10.5, color: C.ink4, paddingHorizontal: 1 } as TextStyle,
});

const st = StyleSheet.create({
  wrap: {
    backgroundColor: C.glassHi, borderWidth: 1, borderColor: C.border2,
    borderRadius: R.md, padding: 12, gap: 10,
  } as ViewStyle,
  head: { flexDirection: "row", alignItems: "center", gap: 10 } as ViewStyle,
  title: { fontFamily: F.body, fontSize: 12.5, fontWeight: "700", color: C.ink } as TextStyle,
  phase: { fontFamily: F.body, fontSize: 10.5, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", color: C.ink3, marginTop: 1 } as TextStyle,
  modeBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: R.pill, borderWidth: 1, borderColor: C.border2, backgroundColor: P.glass2 } as ViewStyle,
  modeBtnTxt: { fontFamily: F.body, fontSize: 11, fontWeight: "600", color: C.ink3 } as TextStyle,

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 } as ViewStyle,
  cell: { alignItems: "center", gap: 3, minWidth: 76, flexGrow: 1, flexBasis: 76 } as ViewStyle,
  cellLabel: { fontFamily: F.body, fontSize: 10.5, fontWeight: "700", letterSpacing: 0.8, color: C.ink3 } as TextStyle,
  cellLabelCut: { color: C.ink4 } as TextStyle,
  input: {
    width: "100%", minHeight: 56, borderWidth: 1, borderColor: C.border2, borderRadius: R.md,
    backgroundColor: C.surface, paddingHorizontal: 8, paddingVertical: 10,
    fontFamily: F.mono, fontSize: 22, color: C.ink, textAlign: "center",
  } as TextStyle,
  inputError: { borderColor: P.danger, backgroundColor: P.dangerWash } as TextStyle,
  inputCut: { opacity: 0.62 } as TextStyle,
  legacyInput: {
    minHeight: 56, borderWidth: 1, borderColor: C.border2, borderRadius: R.md,
    backgroundColor: C.surface, paddingHorizontal: 12, paddingVertical: 10,
    fontFamily: F.mono, fontSize: 24, color: C.ink, textAlign: "center",
  } as TextStyle,

  errorRow: { flexDirection: "row", alignItems: "center", gap: 6 } as ViewStyle,
  errorTxt: { fontFamily: F.body, fontSize: 11.5, color: P.danger, flex: 1 } as TextStyle,

  totalRow: { flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", gap: 8 } as ViewStyle,
  totalLabel: { fontFamily: F.body, fontSize: 10.5, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", color: C.ink3 } as TextStyle,
  totalValue: { fontFamily: F.mono, fontSize: 26, color: C.ink, fontVariant: ["tabular-nums"] } as TextStyle,
  totalHint: { fontFamily: F.body, fontSize: 11, color: C.ink3, flex: 1, minWidth: 140, lineHeight: 15 } as TextStyle,
  hint: { fontFamily: F.body, fontSize: 11.5, color: C.ink3, lineHeight: 16 } as TextStyle,

  actions: { flexDirection: "row", gap: 8 } as ViewStyle,
  cancelBtn: {
    minHeight: 52, paddingHorizontal: 18, borderRadius: R.md, borderWidth: 1,
    borderColor: C.border2, backgroundColor: P.glass2,
    alignItems: "center", justifyContent: "center",
  } as ViewStyle,
  cancelTxt: { fontFamily: F.body, fontSize: 14, fontWeight: "600", color: C.ink2 } as TextStyle,
  saveBtn: {
    flex: 1, minHeight: 52, borderRadius: R.md, backgroundColor: C.sumi,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  } as ViewStyle,
  saveBtnDisabled: { opacity: 0.45 } as ViewStyle,
  saveTxt: { fontFamily: F.body, fontSize: 15, fontWeight: "700", color: P.paperWarm } as TextStyle,
});
