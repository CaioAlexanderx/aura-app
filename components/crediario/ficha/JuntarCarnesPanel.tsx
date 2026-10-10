// ============================================================
// JuntarCarnesPanel — Aura · Crediário (10/10/2026)
//
// Vários carnês de uma cliente viram UM, com parcelas novas (mockup
// docs/mockups/crediario-juntar-carnes.html). Painel da ficha, no mesmo
// padrão de Renegociar/Receber: uma tela só, com os dois passos visíveis —
// (1) quais carnês juntar, (2) parcelas novas. Não é wizard de várias
// páginas (regra 5: se um dia virar multi-passo, o molde é o TrocaModal).
//
// O CRONOGRAMA ("Como fica") vem SEMPRE do preview do backend, com debounce:
// centavos da última parcela e vencimento em mês curto são decididos lá, e o
// que a lojista vê tem que ser o que vai ser gravado. Por isso o botão só
// habilita com o preview do plano ATUAL na tela.
//
// Idempotency-Key estável por tentativa (mesmo padrão do recebimento e da
// renegociação): nasce no primeiro Confirmar, sobrevive a erro/timeout — o
// retry do MESMO plano é replay no backend, não uma segunda junção — e só é
// descartada no sucesso ou quando o plano muda.
//
// Backend anterior ao #803 responde 404 na rota: o painel avisa que a função
// ainda não está disponível, sem quebrar.
// ============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, TextInput, ActivityIndicator, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { ModalPop } from "@/components/anim";
import { DateInput, parseBrDate, formatIsoToBr } from "@/components/inputs/DateInput";
import { MAX_INSTALLMENTS_CEILING } from "@/services/creditApi";
import { mergeApi, type MergeOpts, type MergePlan } from "@/services/creditMerge";
import { todaySP } from "@/utils/creditOverdue";
import {
  planoDaSelecao, rotuloDoBotaoDeJuntar, mensagemErroJuncao, umMesDepois,
  INTERVALOS_DA_JUNCAO, type CarneDerivado, type IntervaloDaJuncao,
} from "@/utils/crediarioCarne";
import { fmt, parseAmount } from "./fichaHelpers";
import { m } from "./fichaStyles";

/** Espera depois da última mudança antes de pedir o preview. */
export const DEBOUNCE_DO_PREVIEW_MS = 450;

export type JuntarCarnesPanelProps = {
  companyId: string;
  customerId: string;
  customerName: string;
  /** Carnês em aberto com saldo (utils/crediarioCarne.carnesParaJuntar). */
  carnes: CarneDerivado<any>[];
  /** Chaves já marcadas ao abrir (o carnê de onde veio o "Juntar com outros"). */
  preselecionados?: string[];
  onBack: () => void;
  onClose: () => void;
  /** Juntou: o shell avisa, recarrega a ficha e abre o carnê novo. */
  onDone: (res: MergePlan) => void;
};

export function JuntarCarnesPanel({
  companyId, customerId, customerName, carnes, preselecionados, onBack, onClose, onDone,
}: JuntarCarnesPanelProps) {
  const [marcados, setMarcados] = useState<Set<string>>(() => {
    const validos = new Set(carnes.map(c => c.key));
    const pre = (preselecionados || []).filter(k => validos.has(k));
    // Com exatamente dois carnês só existe uma junção possível.
    if (pre.length === 0 && carnes.length === 2) return validos;
    return new Set(pre);
  });
  // Começa no maior número de parcelas a pagar entre os carnês: é o prazo
  // que a cliente já tinha combinado.
  const [parcelas, setParcelas] = useState(() =>
    Math.max(1, Math.min(MAX_INSTALLMENTS_CEILING, Math.max(0, ...carnes.map(c => c.parcelasAbertas.length)))));
  const [primeiroVenc, setPrimeiroVenc] = useState(() => formatIsoToBr(umMesDepois(todaySP())));
  const [intervalo, setIntervalo] = useState<IntervaloDaJuncao>(INTERVALOS_DA_JUNCAO[0]);
  const [ajustando, setAjustando] = useState(false);
  const [totalStr, setTotalStr] = useState("");

  const [preview, setPreview] = useState<MergePlan | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const plano = useMemo(() => planoDaSelecao(carnes, marcados), [carnes, marcados]);
  const vencIso = parseBrDate(primeiroVenc);
  const totalAjustado = ajustando ? parseAmount(totalStr) : 0;
  const totalInvalido = ajustando && totalStr.trim() !== "" && totalAjustado <= 0;

  // O pedido, se o plano estiver completo. null = ainda não dá para pedir.
  const opts: MergeOpts | null = useMemo(() => {
    if (!plano.podeJuntar || !vencIso || totalInvalido) return null;
    return {
      account_ids: plano.accountIds,
      installments: parcelas,
      first_due_date: vencIso,
      period_unit: intervalo.period_unit,
      period_count: intervalo.period_count,
      total: ajustando && totalAjustado > 0 ? totalAjustado : undefined,
    };
  }, [plano, vencIso, totalInvalido, parcelas, intervalo, ajustando, totalAjustado]);
  // Impressão digital do plano: muda ⇒ preview novo e chave de idempotência nova.
  const assinatura = opts ? JSON.stringify(opts) : "";

  const keyRef = useRef<string | null>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    keyRef.current = null;
    setPreview(null);
    setErro(null);
    const seq = ++seqRef.current;
    if (!opts) { setPreviewLoading(false); return; }
    setPreviewLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await mergeApi.preview(companyId, customerId, opts);
        if (seqRef.current !== seq) return; // chegou resposta de um plano que já mudou
        setPreview(res);
      } catch (err: any) {
        if (seqRef.current !== seq) return;
        setErro(mensagemErroJuncao(err));
      } finally {
        if (seqRef.current === seq) setPreviewLoading(false);
      }
    }, DEBOUNCE_DO_PREVIEW_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinatura, companyId, customerId]);

  function alternar(key: string) {
    setMarcados(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function confirmar() {
    if (!opts || !preview || submitting) return;
    if (!keyRef.current) {
      keyRef.current = "merge-" + companyId + "-" + customerId + "-" + Date.now()
        + "-" + Math.random().toString(36).slice(2, 8);
    }
    setSubmitting(true);
    setErro(null);
    try {
      const res = await mergeApi.apply(companyId, customerId, opts, keyRef.current);
      keyRef.current = null;
      onDone(res);
    } catch (err: any) {
      // A chave fica: tentar de novo o MESMO plano é replay, não outra junção.
      setErro(mensagemErroJuncao(err));
    } finally {
      setSubmitting(false);
    }
  }

  const valorDaParcela = preview?.schedule?.[0]?.amount_due ?? null;
  const totalMostrado = preview?.target_total ?? (ajustando && totalAjustado > 0 ? totalAjustado : plano.total);
  const delta = preview?.delta ?? 0;
  const pronto = !!opts && !!preview && !previewLoading && !submitting;

  return (
    <View style={m.panel} testID="juntar-carnes-painel">
      <ModalPop visible style={{ flex: 1 }}>
        <View style={m.panelHead}>
          <Pressable onPress={onBack} style={m.panelBack} accessibilityRole="button">
            <View style={{ transform: [{ rotate: "180deg" }] }}>
              <Icon name="chevron_right" size={15} color={Colors.violet3} />
            </View>
            <Text style={m.panelBackTxt}>Voltar</Text>
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[m.panelTitle, { flex: 0 }]}>Juntar carnês</Text>
            <Text style={s.headSub}>{customerName}</Text>
          </View>
          <Pressable onPress={onClose} style={m.xBtn}>
            <Icon name="x" size={13} color={Colors.ink3} />
          </Pressable>
        </View>

        <ScrollView style={m.panelBody} contentContainerStyle={{ padding: 14, paddingTop: 12 }} showsVerticalScrollIndicator={true}>
          {/* ── 1 · Quais carnês juntar ── */}
          <View style={s.step}>
            <View style={s.stepN}><Text style={s.stepNT}>1</Text></View>
            <Text style={s.stepT}>Quais carnês juntar</Text>
          </View>

          {carnes.map(c => {
            const on = marcados.has(c.key);
            return (
              <Pressable
                key={c.key}
                testID={`juntar-carne-${c.key}`}
                style={[s.pick, on && s.pickOn]}
                onPress={() => alternar(c.key)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${c.nome}, falta pagar ${fmt(c.falta)}`}
              >
                <View style={[s.box, on && s.boxOn]}>
                  {on && <Icon name="check" size={13} color="#fff" />}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={s.l1}>
                    <Text style={s.nome}>{c.nome}</Text>
                    <Text style={s.valor}>{fmt(c.falta)}</Text>
                  </View>
                  <Text style={s.meta}>
                    {c.resumo ? c.resumo + " · " : ""}
                    <Text style={c.atrasado ? { color: Colors.red } : undefined}>falta pagar</Text>
                  </Text>
                  {c.compras.length > 0 && (
                    <View style={s.prods}>
                      {c.compras.map((l, i) => (
                        <View key={i} style={s.prod}>
                          <Text style={s.prodK}>{l.rotulo}</Text>
                          <Text style={s.prodV}>{fmt(l.valor)}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </Pressable>
            );
          })}

          {/* ── 2 · Parcelas novas ── */}
          <View style={[s.step, { marginTop: 18 }]}>
            <View style={s.stepN}><Text style={s.stepNT}>2</Text></View>
            <Text style={s.stepT}>Parcelas novas</Text>
          </View>

          <View style={s.card}>
            <View style={s.tot}>
              <Text style={s.totLbl}>
                {plano.quantidade > 0
                  ? `Falta pagar em ${plano.quantidade} carnê${plano.quantidade > 1 ? "s" : ""}`
                  : "Total a parcelar"}
              </Text>
              <Text style={s.totVal} testID="juntar-total">{fmt(ajustando ? plano.total : totalMostrado)}</Text>
            </View>

            {!ajustando ? (
              <Pressable style={s.link} onPress={() => { setAjustando(true); setTotalStr(plano.total > 0 ? plano.total.toFixed(2).replace(".", ",") : ""); }} accessibilityRole="button" testID="juntar-ajustar-total">
                <Text style={s.linkT}>Ajustar o total (desconto ou acréscimo)</Text>
              </Pressable>
            ) : (
              <View style={{ marginTop: 10 }}>
                <Text style={m.fieldLabel}>Novo total</Text>
                <View style={m.amountIn}>
                  <Text style={m.amountPrefix}>R$</Text>
                  <TextInput
                    style={m.amountInput}
                    value={totalStr}
                    onChangeText={(v) => setTotalStr(v.replace(/[^\d,.]/g, ""))}
                    placeholder="0,00"
                    placeholderTextColor={Colors.ink3}
                    keyboardType="decimal-pad"
                    testID="juntar-total-input"
                  />
                </View>
                {totalInvalido && <Text style={s.erroCampo}>Informe um total maior que zero.</Text>}
                {!!preview && Math.abs(delta) > 0.005 && (
                  <View style={m.renegDeltaRow}>
                    <Text style={m.renegDeltaLbl}>{delta < 0 ? "Desconto no saldo" : "Acréscimo no saldo"}</Text>
                    <Text style={[m.renegDeltaVal, { color: delta < 0 ? Colors.green : Colors.red }]}>
                      {delta < 0 ? "−" : "+"}{fmt(Math.abs(delta))}
                    </Text>
                  </View>
                )}
                <Pressable style={s.link} onPress={() => { setAjustando(false); setTotalStr(""); }} accessibilityRole="button">
                  <Text style={s.linkT}>Voltar ao total que falta</Text>
                </Pressable>
              </View>
            )}

            <Text style={s.fl}>Número de parcelas</Text>
            <View style={s.stepper}>
              <Pressable
                style={[s.stepBtn, parcelas <= 1 && m.renegStepBtnDisabled]}
                disabled={parcelas <= 1}
                onPress={() => setParcelas(n => Math.max(1, n - 1))}
                accessibilityRole="button"
                accessibilityLabel="Menos uma parcela"
                testID="juntar-menos"
              >
                <Icon name="minus" size={18} color={Colors.ink} />
              </Pressable>
              <View style={{ flex: 1, alignItems: "center" }}>
                <Text style={s.stepVal} testID="juntar-parcelas">{parcelas}×</Text>
                <Text style={s.stepEach}>
                  {valorDaParcela != null ? `de ${fmt(valorDaParcela)}` : previewLoading ? "calculando…" : " "}
                </Text>
              </View>
              <Pressable
                style={[s.stepBtn, parcelas >= MAX_INSTALLMENTS_CEILING && m.renegStepBtnDisabled]}
                disabled={parcelas >= MAX_INSTALLMENTS_CEILING}
                onPress={() => setParcelas(n => Math.min(MAX_INSTALLMENTS_CEILING, n + 1))}
                accessibilityRole="button"
                accessibilityLabel="Mais uma parcela"
                testID="juntar-mais"
              >
                <Icon name="plus" size={18} color={Colors.ink} />
              </Pressable>
            </View>

            <Text style={s.fl}>Primeiro vencimento</Text>
            <DateInput
              value={primeiroVenc}
              onChangeText={setPrimeiroVenc}
              placeholder="dd/mm/aaaa"
              style={[m.dateInput, { minHeight: 48 }]}
            />

            <Text style={s.fl}>Intervalo</Text>
            <View style={s.chips}>
              {INTERVALOS_DA_JUNCAO.map(iv => {
                const on = intervalo.key === iv.key;
                return (
                  <Pressable
                    key={iv.key}
                    style={[s.chip, on && s.chipOn]}
                    onPress={() => setIntervalo(iv)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    testID={`juntar-intervalo-${iv.key}`}
                  >
                    <Text style={[s.chipT, on && { color: Colors.ink }]}>{iv.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ── Como fica (preview do backend) ── */}
          {plano.podeJuntar && (
            <View style={s.card} testID="juntar-como-fica">
              <Text style={[s.fl, { marginTop: 0 }]}>Como fica</Text>
              {previewLoading && (
                <View style={{ alignItems: "center", paddingVertical: 10 }}>
                  <ActivityIndicator size="small" color={Colors.violet3} />
                  <Text style={[m.termsHint, { marginTop: 4, marginBottom: 0 }]}>Calculando as parcelas…</Text>
                </View>
              )}
              {!previewLoading && !!preview && (
                <>
                  {!!preview.name && <Text style={s.nomeNovo}>{preview.name}</Text>}
                  {preview.schedule.map((l, i) => (
                    <View key={l.number} style={[s.sched, i === preview.schedule.length - 1 && { borderBottomWidth: 0 }]}>
                      <Text style={s.schedK}>Parcela {l.number}/{preview.installments_count} · {formatIsoToBr(l.due_date)}</Text>
                      <Text style={s.schedV}>{fmt(l.amount_due)}</Text>
                    </View>
                  ))}
                </>
              )}
              {!previewLoading && !preview && !erro && (
                <Text style={[m.termsHint, { marginBottom: 0 }]}>
                  {!vencIso ? "Informe a data do primeiro vencimento para ver as parcelas." : "Confira o total para ver as parcelas."}
                </Text>
              )}
            </View>
          )}

          {!!erro && (
            <View style={s.erroBox} testID="juntar-erro">
              <Text style={s.erroT}>{erro}</Text>
            </View>
          )}

          <View style={s.warn}>
            <Text style={s.warnT} testID="juntar-aviso">
              {plano.podeJuntar
                ? <>
                    Os {plano.quantidade} carnês viram <Text style={s.warnB}>um só</Text>
                    {plano.produtos > 0 ? `, com ${plano.produtos} produto${plano.produtos > 1 ? "s" : ""}` : ""}
                    . As parcelas em aberto antigas somem; o que já foi pago continua no histórico.
                  </>
                : "Para mudar as parcelas de um carnê só, use o Renegociar dele."}
            </Text>
          </View>
        </ScrollView>

        <View style={m.panelFoot}>
          <Pressable
            style={[m.cta, s.cta, !pronto && { opacity: 0.4 }]}
            disabled={!pronto}
            onPress={confirmar}
            accessibilityRole="button"
            accessibilityState={{ disabled: !pronto }}
            testID="juntar-confirmar"
          >
            {submitting
              ? <ActivityIndicator color="#fff" />
              : (
                <Text style={[m.ctaTxt, { textAlign: "center" }]}>
                  {rotuloDoBotaoDeJuntar(plano.quantidade, parcelas, valorDaParcela, fmt)}
                </Text>
              )}
          </Pressable>
        </View>
      </ModalPop>
    </View>
  );
}

const s = StyleSheet.create({
  headSub: { fontSize: 12, color: Colors.ink3, marginTop: 1 },
  step: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 2, marginBottom: 9, marginTop: 4 },
  stepN: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.violet, alignItems: "center", justifyContent: "center" },
  stepNT: { fontSize: 11, fontWeight: "800", color: "#fff" },
  stepT: { fontSize: 11, fontWeight: "700", letterSpacing: 0.7, textTransform: "uppercase", color: Colors.ink3 },

  pick: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    backgroundColor: Colors.bg3, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 14, padding: 12, marginBottom: 9, minHeight: 48,
  },
  pickOn: { borderColor: Colors.violet3, backgroundColor: Colors.violetD },
  box: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: Colors.border2, marginTop: 1, alignItems: "center", justifyContent: "center" },
  boxOn: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  l1: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 10 },
  nome: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: "700", color: Colors.ink },
  valor: { fontSize: 14, fontWeight: "800", color: Colors.ink, fontVariant: ["tabular-nums"] as any },
  meta: { fontSize: 11.5, color: Colors.ink3, marginTop: 1 },
  prods: { marginTop: 7, paddingTop: 6, borderTopWidth: 1, borderTopColor: Colors.border, borderStyle: "dashed" as any },
  prod: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10, paddingVertical: 1.5 },
  prodK: { flex: 1, minWidth: 0, fontSize: 12.5, color: Colors.ink2 },
  prodV: { fontSize: 12.5, color: Colors.ink3, fontVariant: ["tabular-nums"] as any },

  card: { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 14, marginBottom: 10 },
  tot: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" },
  totLbl: { fontSize: 12, color: Colors.ink3 },
  totVal: { fontSize: 20, fontWeight: "800", color: Colors.ink, fontVariant: ["tabular-nums"] as any },
  // Link de texto com alvo de toque de 44px.
  link: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  linkT: { fontSize: 12.5, fontWeight: "600", color: Colors.violet3 },
  fl: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", color: Colors.ink3, marginTop: 14, marginBottom: 6 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepBtn: { width: 48, height: 48, borderRadius: 12, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  stepVal: { fontSize: 22, fontWeight: "800", color: Colors.ink, fontVariant: ["tabular-nums"] as any },
  stepEach: { fontSize: 12.5, color: Colors.ink2 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 44, paddingHorizontal: 14, borderRadius: 11, borderWidth: 1, borderColor: Colors.border2, alignItems: "center", justifyContent: "center" },
  chipOn: { backgroundColor: Colors.violetD, borderColor: Colors.violet3 },
  chipT: { fontSize: 13, fontWeight: "600", color: Colors.ink2 },

  nomeNovo: { fontSize: 13, fontWeight: "700", color: Colors.ink, marginBottom: 4 },
  sched: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border },
  schedK: { flex: 1, minWidth: 0, fontSize: 13, color: Colors.ink },
  schedV: { fontSize: 13, fontWeight: "700", color: Colors.ink, fontVariant: ["tabular-nums"] as any },

  erroCampo: { fontSize: 12, color: Colors.red, marginTop: 4 },
  erroBox: { backgroundColor: Colors.redD, borderWidth: 1, borderColor: Colors.red + "55", borderRadius: 11, padding: 11, marginBottom: 10 },
  erroT: { fontSize: 12.5, color: Colors.red, lineHeight: 18 },
  warn: { backgroundColor: Colors.bg2, borderWidth: 1, borderStyle: "dashed", borderColor: Colors.border2, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 6 },
  warnT: { fontSize: 12, color: Colors.ink2, lineHeight: 17 },
  warnB: { fontWeight: "800", color: Colors.ink },
  cta: { minHeight: 50, justifyContent: "center", paddingHorizontal: 12 },
});

export default JuntarCarnesPanel;
