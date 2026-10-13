// ============================================================
// AURA. — Novo lançamento: passo 2, "Quanto e como" (12/10/2026)
//
// Redesenho aprovado (docs/mockups/crediario-lancamento-manual.html):
//   - valor em destaque, com "3x de R$ 140,00" ao vivo logo abaixo (antes
//     só se via a parcela rolando até o rodapé);
//   - parcelas em chips (1x 2x 3x 4x 6x 10x 12x) + "outro" para o número
//     livre até MAX_INSTALLMENTS_CEILING;
//   - "Primeira parcela em" com atalhos "em 30 dias" e "dia 10" (e "Janeiro",
//     em novembro e dezembro: vende agora, a 1ª parcela cai no ano que vem);
//     ao lado, o Intervalo (a periodicidade que morava em "Mais opções");
//   - o carnê vira UMA linha ("Vai para um carnê novo · alterar"). Desde
//     10/10 todo lançamento nasce como carnê; "alterar" abre as três opções
//     em cartões. Os carnês do cliente só são buscados nesse toque. A
//     unificação e a confirmação vermelha continuam dentro de "Carnê
//     existente", exatamente como antes;
//   - "Mais opções" recolhido, com resumo do que foi mexido. "Descrição"
//     virou "O que foi comprado (sai no carnê)" — é o mesmo `description`;
//   - rodapé fixo com total, parcela, primeira e última data e o CTA, que
//     diz para onde o lançamento vai.
// ============================================================
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { MAX_INSTALLMENTS_CEILING } from "@/services/creditApi";
import { DateInput } from "@/components/inputs/DateInput";
import { Collapsible } from "@/components/anim";
import { ConfirmGate } from "@/components/ConfirmGate";
import { e } from "./estilos";
import {
  fmtCur, fmtCurrency, fmtDateSafe, emDias, proximoDia, faixaDeDatas, PERIODOS, rotuloDoPeriodo,
  hojeIsoSp, mostrarAtalhoJaneiro, janeiroDoProximoAno, avisoDaPrimeiraParcela,
} from "./calculos";
import { parseBrDate } from "@/components/inputs/DateInput";
import { OPCOES_DE_CARNE, type LancamentoForm } from "./useLancamentoForm";

const CHIPS_DE_PARCELAS = [1, 2, 3, 4, 6, 10, 12];

const SUB_DA_OPCAO: Record<string, string> = {
  general: "sem carnê, como era antes",
};

export function PassoValores({ form }: { form: LancamentoForm }) {
  const { st, set, valores, selectableAccounts, selectedAccount, canUnify, alternarCarne, pedirCriar, enviar } = form;
  const { amountNum, nParcelas, rateNum, totalComJuros, valorParcela, datas } = valores;
  const unify = st.unifyEnabled;
  const preview = st.unifyPreview;

  // Nome que o carnê novo vai ter: o digitado ou o que o backend dá sozinho
  // ("Lançamento de DD/MM", pela data da compra).
  const nomeDoCarneNovo = st.newAccountName.trim() || `Lançamento de ${st.entryDate.slice(0, 5)}`;
  const clienteNovo = !st.selectedCustomer;

  // ── Primeira parcela: atalho "Janeiro" e aviso ──
  const hojeIso = hojeIsoSp();
  const comAtalhoJaneiro = mostrarAtalhoJaneiro(hojeIso);
  // "Janeiro" é o dia 10; se a lojista já escolheu outro dia para o 1º
  // vencimento (diferente do que o formulário trouxe), mantém o dia dela.
  const diaEscolhido = st.firstDueDate !== st.padroes.vencimento
    ? parseInt((parseBrDate(st.firstDueDate) || "").slice(8, 10), 10)
    : NaN;
  const aviso = avisoDaPrimeiraParcela(st.firstDueDate, {
    maxDias: st.janelaDias, hojeIso, compraBr: st.entryDate,
  });
  const textoDoAviso = st.erroPrimeiraParcela || aviso?.texto || null;
  const avisoEhErro = !!st.erroPrimeiraParcela || !!aviso?.bloqueia;

  const parcelaNosChips = !st.parcelasLivre && CHIPS_DE_PARCELAS.includes(parseInt(st.installments, 10)) && String(parseInt(st.installments, 10)) === st.installments;

  const porParcela = unify
    ? (preview
        ? `${preview.schedule.length}x de ${fmtCur(preview.schedule[0]?.amount_due ?? 0)} no carnê unificado`
        : "soma ao saldo do carnê e redivide")
    : amountNum > 0
      ? `${nParcelas}x de ${fmtCur(valorParcela)}${rateNum > 0 ? " com juros" : ""}`
      : "digite o valor da compra";

  // ── Linha do carnê ──
  const tituloCarne = st.accountMode === "new"
    ? "Vai para um carnê novo"
    : st.accountMode === "existing"
      ? (selectedAccount ? `Vai para ${selectedAccount.name}` : "Vai para um carnê existente")
      : "Vai para a conta geral";
  const subCarne = st.accountMode === "new"
    ? `${nomeDoCarneNovo} · o cliente recebe o carnê impresso`
    : st.accountMode === "existing"
      ? (selectedAccount
          ? `${fmtCur(selectedAccount.balance || 0)} em aberto${unify ? " · unificar parcelas" : ""}`
          : "escolha o carnê")
      : SUB_DA_OPCAO.general;

  const subDaOpcao = (k: string) => {
    if (k === "new") return nomeDoCarneNovo;
    if (k === "existing") {
      if (clienteNovo) return "cliente novo, ainda sem carnê";
      if (st.loadingAccounts) return "carregando os carnês…";
      const n = selectableAccounts.length;
      return n === 0 ? "nenhum carnê aberto" : `${n} carnê${n > 1 ? "s" : ""} aberto${n > 1 ? "s" : ""} · unificar parcelas`;
    }
    return SUB_DA_OPCAO.general;
  };

  // ── Mais opções: resumo do que foi mexido ──
  const resumoMais = [
    st.entryDate !== st.padroes.hoje ? "retroativo" : null,
    st.interestRate.trim() ? `juros ${st.interestRate.trim()}%` : null,
    st.description.trim() ? `comprado: ${st.description.trim()}` : null,
  ].filter(Boolean).join(" · ") || "data da compra, juros, o que foi comprado";

  const ctaLabel = unify
    ? "Criar e unificar"
    : st.accountMode === "new"
      ? "Lançar e criar carnê"
      : st.accountMode === "existing" ? "Lançar no carnê" : "Lançar na conta";

  return (
    <>
      <ScrollView style={[e.body, { flexGrow: 0, flexShrink: 1 }]} contentContainerStyle={e.gap} keyboardShouldPersistTaps="handled">
        {/* ── Valor em destaque ── */}
        <View style={s.hero}>
          <Text style={[e.label, { marginBottom: 2 }]}>Valor da compra</Text>
          <View style={s.amt}>
            <Text style={s.amtPrefix}>R$</Text>
            <TextInput
              style={s.amtInput}
              placeholder="0,00"
              placeholderTextColor={Colors.ink3}
              value={st.amountRaw}
              onChangeText={(v) => {
                const digits = v.replace(/\D/g, "");
                set({ amountRaw: digits ? fmtCurrency(digits) : "" });
              }}
              keyboardType="numeric"
              testID="lancamento-valor"
              accessibilityLabel="Valor da compra"
              autoFocus
            />
          </View>
          <Text style={[s.per, amountNum <= 0 && !unify && { color: Colors.ink3 }]} testID="lancamento-por-parcela">
            {porParcela}
          </Text>
        </View>

        {!unify && (
          <>
            {/* ── Parcelas ── */}
            <View>
              <Text style={e.label}>Parcelas</Text>
              <View style={e.chips}>
                {CHIPS_DE_PARCELAS.map((n) => {
                  const on = parcelaNosChips && parseInt(st.installments, 10) === n;
                  return (
                    <Pressable
                      key={n}
                      style={[e.chip, on && e.chipOn]}
                      onPress={() => set({ installments: String(n), parcelasLivre: false })}
                      testID={`lancamento-parcelas-${n}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                    >
                      <Text style={[e.chipTxt, on && e.chipTxtOn]}>{n}x</Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  style={[e.chip, parcelaNosChips ? e.chipGhost : e.chipOn]}
                  onPress={() => set({ parcelasLivre: true })}
                  testID="lancamento-parcelas-outro"
                  accessibilityRole="button"
                  accessibilityState={{ selected: !parcelaNosChips }}
                >
                  <Text style={[e.chipTxt, parcelaNosChips ? e.chipTxtGhost : e.chipTxtOn]}>outro</Text>
                </Pressable>
              </View>
              {(st.parcelasLivre || !parcelaNosChips) && (
                <View style={[e.inputRow, { marginTop: 8 }]}>
                  <TextInput
                    style={e.inputRowText}
                    placeholder={`1 a ${MAX_INSTALLMENTS_CEILING}`}
                    placeholderTextColor={Colors.ink3}
                    value={st.installments}
                    onChangeText={(v) => set({ installments: v.replace(/\D/g, "").slice(0, 3) })}
                    keyboardType="numeric"
                    testID="lancamento-parcelas-numero"
                    accessibilityLabel="Número de parcelas"
                    autoFocus={st.parcelasLivre}
                  />
                  <Text style={s.suffix}>parcelas</Text>
                </View>
              )}
            </View>

            {/* ── 1º vencimento + Intervalo ── */}
            <View style={e.two}>
              <View style={e.col}>
                <Text style={e.label}>Primeira parcela em</Text>
                <DateInput
                  style={e.input}
                  value={st.firstDueDate}
                  onChangeText={(v) => set({ firstDueDate: v })}
                  placeholder="dd/mm/aaaa"
                  testID="lancamento-vencimento"
                  accessibilityLabel="Primeira parcela em"
                />
                <View style={e.quick}>
                  <Pressable style={e.quickBtn} onPress={() => set({ firstDueDate: emDias(30) })} testID="lancamento-venc-30d" accessibilityRole="button">
                    <Text style={e.quickTxt}>em 30 dias</Text>
                  </Pressable>
                  <Pressable style={e.quickBtn} onPress={() => set({ firstDueDate: proximoDia(10) })} testID="lancamento-venc-dia10" accessibilityRole="button">
                    <Text style={e.quickTxt}>dia 10</Text>
                  </Pressable>
                  {comAtalhoJaneiro && (
                    <Pressable
                      style={e.quickBtn}
                      onPress={() => set({ firstDueDate: janeiroDoProximoAno(hojeIso, diaEscolhido) })}
                      testID="lancamento-venc-janeiro"
                      accessibilityRole="button"
                      accessibilityLabel="Primeira parcela em janeiro"
                    >
                      <Text style={e.quickTxt}>Janeiro</Text>
                    </Pressable>
                  )}
                </View>
                {textoDoAviso && (
                  <Text
                    style={[e.hint, { color: avisoEhErro ? Colors.red : Colors.amber }]}
                    testID="lancamento-vencimento-aviso"
                    accessibilityRole={avisoEhErro ? "alert" : undefined}
                  >
                    {textoDoAviso}
                  </Text>
                )}
              </View>
              <View style={e.col}>
                <Text style={e.label}>Intervalo</Text>
                <Pressable
                  style={[e.inputRow, st.intervaloOpen && { borderColor: Colors.violet3 }]}
                  onPress={() => set({ intervaloOpen: !st.intervaloOpen })}
                  testID="lancamento-intervalo"
                  accessibilityRole="button"
                  accessibilityLabel={`Intervalo: ${rotuloDoPeriodo(st.periodKind, st.periodDays)}. Toque para alterar`}
                >
                  <Text style={[e.inputRowText, { flex: 1 }]} numberOfLines={1}>{rotuloDoPeriodo(st.periodKind, st.periodDays)}</Text>
                  <View style={st.intervaloOpen ? { transform: [{ rotate: "180deg" }] } : undefined}>
                    <Icon name="chevron-down" size={14} color={Colors.ink3} />
                  </View>
                </Pressable>
              </View>
            </View>
            <Collapsible open={st.intervaloOpen}>
              <View style={e.chips}>
                {PERIODOS.map(([k, lbl]) => {
                  const on = st.periodKind === k;
                  return (
                    <Pressable
                      key={k}
                      onPress={() => set({ periodKind: k, intervaloOpen: k === "custom" })}
                      style={[e.chip, on && e.chipOn]}
                      testID={`lancamento-intervalo-${k}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                    >
                      <Text style={[e.chipTxt, on && e.chipTxtOn]}>{lbl}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {st.periodKind === "custom" && (
                <View style={s.customDaysRow}>
                  <Text style={s.customDaysLbl}>A cada</Text>
                  <TextInput
                    style={s.customDaysNum}
                    value={st.periodDays}
                    keyboardType="numeric"
                    onChangeText={(v) => set({ periodDays: v.replace(/\D/g, "").slice(0, 3) })}
                    accessibilityLabel="Dias entre as parcelas"
                  />
                  <Text style={s.customDaysLbl}>dias</Text>
                </View>
              )}
            </Collapsible>
          </>
        )}

        {/* ── Carnê: uma linha; "alterar" abre as opções ── */}
        <View style={[s.line, st.carneOpen && s.lineOpen]}>
          <View style={s.lineTop}>
            <Icon name="file-text" size={18} color={Colors.violet3} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.lineTitle} numberOfLines={1}>{st.carneOpen ? "Onde este lançamento entra" : tituloCarne}</Text>
              <Text style={s.lineSub} numberOfLines={2}>{st.carneOpen ? tituloCarne : subCarne}</Text>
            </View>
            <Pressable
              onPress={alternarCarne}
              hitSlop={8}
              testID="lancamento-carne-alterar"
              accessibilityRole="button"
              accessibilityLabel={st.carneOpen ? "Recolher opções de carnê" : "Alterar o carnê"}
            >
              <Text style={s.lnk}>{st.carneOpen ? "pronto" : "alterar"}</Text>
            </Pressable>
          </View>

          <Collapsible open={st.carneOpen}>
            <View style={s.opts}>
              {OPCOES_DE_CARNE.map(([k, lbl]) => {
                const sel = st.accountMode === k;
                return (
                  <View key={k} style={[s.opt, sel && s.optSel]}>
                    <Pressable
                      style={s.optHead}
                      onPress={() => set({ accountMode: k })}
                      testID={`lancamento-carne-${k}`}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: sel }}
                    >
                      <View style={[s.dot, sel && s.dotSel]} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={s.optTitle}>{lbl}</Text>
                        <Text style={s.optSub} numberOfLines={2}>{subDaOpcao(k)}</Text>
                      </View>
                    </Pressable>

                    {sel && k === "new" && (
                      <TextInput
                        style={[e.input, { marginTop: 8 }]}
                        placeholder="Nome (opcional)"
                        placeholderTextColor={Colors.ink3}
                        value={st.newAccountName}
                        onChangeText={(v) => set({ newAccountName: v })}
                        testID="lancamento-carne-nome"
                        accessibilityLabel="Nome do carnê"
                      />
                    )}

                    {sel && k === "existing" && (
                      st.loadingAccounts ? (
                        <ActivityIndicator size="small" color={Colors.violet3} style={{ marginTop: 8 }} />
                      ) : selectableAccounts.length === 0 ? (
                        <Text style={e.hint}>Nenhum carnê aberto. Escolha "Carnê novo" para criar.</Text>
                      ) : (
                        <View style={s.accountList}>
                          {selectableAccounts.map((acc) => {
                            const on = st.selectedAccountId === acc.id;
                            return (
                              <Pressable
                                key={acc.id}
                                style={[s.accountRow, on && s.accountRowOn]}
                                onPress={() => set({ selectedAccountId: acc.id })}
                                testID={`lancamento-carne-conta-${acc.id}`}
                                accessibilityRole="radio"
                                accessibilityState={{ checked: on }}
                              >
                                <View style={{ flex: 1, minWidth: 0 }}>
                                  <Text style={[s.accountRowName, on && { color: Colors.violet3 }]} numberOfLines={1}>{acc.name}</Text>
                                  <Text style={s.accountRowSub}>
                                    {fmtCur(acc.balance || 0)} em aberto{acc.overdue ? " · Em atraso" : ""}
                                  </Text>
                                </View>
                                {on && <Icon name="check" size={14} color={Colors.violet3} />}
                              </Pressable>
                            );
                          })}
                        </View>
                      )
                    )}

                    {/* feat(unify): toggle Unificar parcelas */}
                    {sel && k === "existing" && canUnify && (
                      <View style={s.unifyCard}>
                        <View style={s.unifyToggleRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={s.unifyToggleTitle}>Unificar parcelas</Text>
                            <Text style={s.unifyToggleSub}>
                              Soma o saldo aberto + este lançamento e redivide em um novo cronograma
                            </Text>
                          </View>
                          <Pressable
                            onPress={() => set({ unifyEnabled: !st.unifyEnabled })}
                            style={[s.toggleSwitch, unify && s.toggleSwitchOn]}
                            testID="lancamento-unificar"
                            accessibilityRole="switch"
                            accessibilityState={{ checked: unify }}
                          >
                            <View style={[s.toggleThumb, unify && s.toggleThumbOn]} />
                          </Pressable>
                        </View>

                        {unify && (
                          <>
                            <Text style={[e.label, { marginTop: 10 }]}>Nº de parcelas unificadas</Text>
                            <TextInput
                              style={e.input}
                              placeholder="2"
                              placeholderTextColor={Colors.ink3}
                              value={st.unifyInstallments}
                              onChangeText={(v) => set({ unifyInstallments: v.replace(/\D/g, "").slice(0, 3) })}
                              keyboardType="numeric"
                            />

                            <Text style={[e.label, { marginTop: 10 }]}>1ª parcela unificada</Text>
                            <DateInput
                              style={e.input}
                              value={st.unifyFirstDue}
                              onChangeText={(v) => set({ unifyFirstDue: v })}
                              placeholder="dd/mm/aaaa"
                            />

                            {st.unifyPreviewLoading && (
                              <ActivityIndicator size="small" color={Colors.violet3} style={{ marginTop: 10 }} />
                            )}
                            {st.unifyPreviewError && (
                              <Text style={[e.hint, { color: Colors.red }]}>{st.unifyPreviewError}</Text>
                            )}
                            {preview && !st.unifyPreviewLoading && (
                              <View style={s.unifyPreviewBox}>
                                <Text style={s.unifyPreviewTitle}>PRÉVIA DO CRONOGRAMA UNIFICADO</Text>
                                <View style={s.unifyPreviewRow}>
                                  <Text style={s.unifyPreviewLabel}>Saldo em aberto</Text>
                                  <Text style={s.unifyPreviewValue}>{fmtCur(preview.open_remaining)}</Text>
                                </View>
                                <View style={s.unifyPreviewRow}>
                                  <Text style={s.unifyPreviewLabel}>Novo lançamento</Text>
                                  <Text style={s.unifyPreviewValue}>{fmtCur(preview.new_amount)}</Text>
                                </View>
                                {preview.interest_added > 0 && (
                                  <View style={s.unifyPreviewRow}>
                                    <Text style={s.unifyPreviewLabel}>Juros</Text>
                                    <Text style={[s.unifyPreviewValue, { color: Colors.amber }]}>
                                      {fmtCur(preview.interest_added)}
                                    </Text>
                                  </View>
                                )}
                                <View style={[s.unifyPreviewRow, s.unifyPreviewTotal]}>
                                  <Text style={[s.unifyPreviewLabel, { fontWeight: "800" }]}>Total</Text>
                                  <Text style={[s.unifyPreviewValue, { color: Colors.green }]}>{fmtCur(preview.total)}</Text>
                                </View>
                                {preview.schedule.map((sl) => (
                                  <View key={sl.number} style={s.unifyPreviewRow}>
                                    <Text style={s.unifyPreviewLabel}>{sl.number}ª parcela</Text>
                                    <Text style={s.unifyPreviewValue}>
                                      {fmtCur(sl.amount_due)} · {fmtDateSafe(sl.due_date)}
                                    </Text>
                                  </View>
                                ))}
                              </View>
                            )}
                          </>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </Collapsible>
        </View>

        {/* ── Mais opções (recolhido, com resumo) ── */}
        <View>
          <Pressable
            style={s.more}
            onPress={() => set({ advOpen: !st.advOpen })}
            testID="lancamento-mais-opcoes"
            accessibilityRole="button"
            accessibilityLabel={`Mais opções. Toque para ${st.advOpen ? "recolher" : "expandir"}`}
          >
            <Text style={s.moreTitle}>Mais opções</Text>
            <Text style={s.moreSum} numberOfLines={1}>{resumoMais}</Text>
            <View style={st.advOpen ? { transform: [{ rotate: "180deg" }] } : undefined}>
              <Icon name="chevron-down" size={14} color={st.advOpen ? Colors.violet3 : Colors.ink3} />
            </View>
          </Pressable>
          <Collapsible open={st.advOpen}>
            <View style={[e.gap, { paddingTop: 6 }]}>
              <View style={e.two}>
                <View style={e.col}>
                  <Text style={e.label}>Data da compra</Text>
                  <DateInput
                    style={e.input}
                    value={st.entryDate}
                    onChangeText={(v) => set({ entryDate: v })}
                    placeholder="dd/mm/aaaa"
                    testID="lancamento-data-compra"
                    accessibilityLabel="Data da compra"
                  />
                  <Text style={e.hint}>Mude para lançar uma compra antiga.</Text>
                </View>
                <View style={e.col}>
                  <Text style={e.label}>
                    Juros total <Text style={e.labelOptional}>(opcional)</Text>
                  </Text>
                  <View style={e.inputRow}>
                    <TextInput
                      style={e.inputRowText}
                      placeholder="0"
                      placeholderTextColor={Colors.ink3}
                      value={st.interestRate}
                      onChangeText={(v) => set({ interestRate: v })}
                      keyboardType="decimal-pad"
                      testID="lancamento-juros"
                      accessibilityLabel="Juros total em porcentagem"
                    />
                    <Text style={s.suffix}>%</Text>
                  </View>
                </View>
              </View>
              <View>
                <Text style={e.label}>
                  O que foi comprado <Text style={e.labelOptional}>(sai no carnê)</Text>
                </Text>
                <TextInput
                  style={[e.input, { minHeight: 64, textAlignVertical: "top" }]}
                  placeholder="Ex.: Vans Hylane 40/41, 2× Slide Alta 40/41"
                  placeholderTextColor={Colors.ink3}
                  value={st.description}
                  onChangeText={(v) => set({ description: v })}
                  multiline
                  testID="lancamento-comprado"
                  accessibilityLabel="O que foi comprado"
                />
              </View>
            </View>
          </Collapsible>
        </View>
      </ScrollView>

      {/* ── Rodapé fixo: resumo + CTA ── */}
      <View style={s.foot}>
        {amountNum > 0 && !unify && (
          <View style={s.summ}>
            <Text style={s.summLbl}>
              Total {rateNum > 0 ? "com juros " : ""}<Text style={s.summStrong}>{fmtCur(totalComJuros)}</Text>
            </Text>
            <Text style={[s.summLbl, s.summV]}>{nParcelas}x de {fmtCur(valorParcela)}</Text>
            {datas.length > 0 && <Text style={s.summLbl}>{faixaDeDatas(datas)}</Text>}
          </View>
        )}
        {unify && preview && (
          <View style={s.summ}>
            <Text style={s.summLbl}>
              Unificado <Text style={s.summStrong}>{fmtCur(preview.total)}</Text>
            </Text>
            <Text style={[s.summLbl, s.summV]}>{preview.schedule.length}x</Text>
            {preview.schedule.length > 0 && (
              <Text style={s.summLbl}>{faixaDeDatas(preview.schedule.map((p) => String(p.due_date).slice(0, 10)))}</Text>
            )}
          </View>
        )}
        <Pressable
          style={({ pressed }) => [e.cta, pressed && { opacity: 0.85 }, st.loading && { opacity: 0.6 }]}
          testID="lancamento-criar"
          onPress={pedirCriar}
          disabled={st.loading || (unify && (!preview || st.unifyGateOpen))}
          accessibilityRole="button"
        >
          {st.loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Icon name="check" size={16} color="#fff" />
              <Text style={e.ctaTxt}>{ctaLabel}</Text>
            </>
          )}
        </Pressable>

        {unify && preview && selectedAccount && (
          <ConfirmGate
            visible={st.unifyGateOpen}
            tone="red"
            message={
              `Isso vai CANCELAR ${selectedAccount.open_count ?? "as"} parcela(s) em aberto ` +
              `de "${selectedAccount.name}" (saldo de ${fmtCur(preview.open_remaining)}) e ` +
              `substituir por um novo cronograma de ${preview.schedule.length}x. ` +
              `Essa ação não pode ser desfeita.`
            }
            confirmLabel="Sim, cancelar e unificar"
            cancelLabel="Cancelar"
            loading={st.loading}
            onConfirm={enviar}
            onCancel={() => set({ unifyGateOpen: false })}
          />
        )}
      </View>
    </>
  );
}

const s = StyleSheet.create({
  hero: {
    backgroundColor: Colors.bg2, borderWidth: 1, borderColor: Colors.border2, borderRadius: 14,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12,
  },
  amt: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  amtPrefix: { fontSize: 16, fontWeight: "600", color: Colors.ink3 },
  amtInput: {
    flex: 1, minWidth: 0, fontSize: 34, fontWeight: "800", letterSpacing: -0.5,
    color: Colors.ink, paddingVertical: 2,
  },
  per: { fontSize: 13, fontWeight: "700", color: Colors.violet3, marginTop: 2 },
  suffix: { fontSize: 13, color: Colors.ink3 },
  customDaysRow: {
    flexDirection: "row", alignItems: "center", gap: 9, marginTop: 10, padding: 10,
    backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2, borderRadius: 10,
  },
  customDaysLbl: { fontSize: 13, color: Colors.ink2, fontWeight: "600" },
  customDaysNum: {
    width: 60, backgroundColor: Colors.bg2, borderWidth: 1, borderColor: Colors.border2, borderRadius: 8,
    paddingVertical: 7, textAlign: "center", color: Colors.ink, fontWeight: "800", fontSize: 14,
  },
  // Carnê
  line: {
    backgroundColor: Colors.bg2, borderWidth: 1, borderColor: Colors.border2, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11,
  },
  lineOpen: { borderColor: Colors.violet3 },
  lineTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  lineTitle: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  lineSub: { fontSize: 12, color: Colors.ink3, marginTop: 1 },
  lnk: { fontSize: 12.5, fontWeight: "600", color: Colors.violet3 },
  opts: { gap: 8, marginTop: 10 },
  opt: { borderWidth: 1.5, borderColor: Colors.border2, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10 },
  optSel: { borderColor: Colors.violet3, backgroundColor: Colors.violetD },
  optHead: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 26 },
  optTitle: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  optSub: { fontSize: 11.5, color: Colors.ink3, marginTop: 1 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: Colors.border2 },
  dotSel: { borderColor: Colors.violet3, backgroundColor: Colors.violet3 },
  accountList: { marginTop: 8, borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, overflow: "hidden" },
  accountRow: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, minHeight: 44,
    borderBottomWidth: 1, borderBottomColor: Colors.border2, backgroundColor: Colors.bg2,
  },
  accountRowOn: { backgroundColor: Colors.violetD },
  accountRowName: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  accountRowSub: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  // feat(unify)
  unifyCard: { marginTop: 12, backgroundColor: Colors.bg3, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.violet + "33", gap: 4 },
  unifyToggleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  unifyToggleTitle: { fontSize: 13, fontWeight: "700", color: Colors.violet3 },
  unifyToggleSub: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  toggleSwitch: { width: 44, height: 24, borderRadius: 12, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border, justifyContent: "center", paddingHorizontal: 2 },
  toggleSwitchOn: { backgroundColor: Colors.violet, borderColor: Colors.violet2 },
  toggleThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.ink3 },
  toggleThumbOn: { backgroundColor: "#fff", alignSelf: "flex-end" },
  unifyPreviewBox: { marginTop: 12, backgroundColor: Colors.bg2, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.border2, gap: 6 },
  unifyPreviewTitle: { fontSize: 9, fontWeight: "800", letterSpacing: 1, color: Colors.ink3, textTransform: "uppercase", marginBottom: 4 },
  unifyPreviewRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  unifyPreviewTotal: { borderTopWidth: 1, borderTopColor: Colors.border2, paddingTop: 8, marginTop: 4 },
  unifyPreviewLabel: { fontSize: 12, color: Colors.ink2 },
  unifyPreviewValue: { fontSize: 12, fontWeight: "700", color: Colors.ink },
  // Mais opções
  more: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6, paddingHorizontal: 2, minHeight: 36 },
  moreTitle: { fontSize: 13, fontWeight: "600", color: Colors.ink2 },
  moreSum: { flex: 1, minWidth: 0, fontSize: 12, color: Colors.ink3 },
  // Rodapé
  foot: {
    borderTopWidth: 1, borderTopColor: Colors.border2, backgroundColor: Colors.bg2,
    paddingHorizontal: 18, paddingTop: 12, paddingBottom: 16, gap: 10,
  },
  summ: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "baseline", gap: 12 },
  summLbl: { fontSize: 12.5, color: Colors.ink3 },
  summStrong: { fontSize: 14, fontWeight: "800", color: Colors.ink },
  summV: { color: Colors.violet3, fontWeight: "700" },
});
