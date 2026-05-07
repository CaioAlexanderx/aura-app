// ============================================================
// AURA. — PDV · OpenCloseCashModal
//
// Modal único que cobre Abrir e Fechar Caixa.
//
// Mode é derivado do status atual:
//   - !isAberto -> wizard ABRIR (3 passos: Funcionario, Troco, Confirmar)
//   - isAberto  -> wizard FECHAR (3 passos: Contagem, Observacao, Revisar)
//                  + tela de SUCESSO com botao "Baixar PDF"
//
// Padrao visual: glassmorphism violeta canonico da TrocaModal.
// Stepper centralizado, footer dentro do scroll.
//
// Empregados: hoje nao ha permissao por modulo. Listamos todos os
// empregados retornados por employeesApi (que ja sao filtrados por
// plano no backend - so plano Negocio+ tem empregados). Quando o
// backend ganhar permissoes granulares, basta filtrar aqui.
// ============================================================
import { useEffect, useMemo, useState } from "react";
import {
  View, Text, Pressable, StyleSheet, TextInput,
  ActivityIndicator, ScrollView,
} from "react-native";
import { Colors, IS_DARK_MODE } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { caixaApi, type CaixaSessaoAtiva, type CaixaFechamentoFull } from "@/services/caixaApi";
import { employeesApi } from "@/services/api";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/components/Toast";
import { IS_WEB, webOnly } from "./types";
import { openCashClosePdf, type CashClosePaymentRow } from "@/utils/cashClosePdf";

// ── Helpers ─────────────────────────────────────────────────────────────
const fmt = (v: number) => "R$ " + v.toFixed(2).replace(".", ",");

function parseMoeda(raw: string): number {
  const clean = (raw || "").replace(/[^\d,.-]/g, "").replace(",", ".");
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}

function avatarColor(idx: number): string {
  const palette = [
    "linear-gradient(135deg, #ec4899, #8b5cf6)",
    "linear-gradient(135deg, #34d399, #06b6d4)",
    "linear-gradient(135deg, #fbbf24, #f97316)",
    "linear-gradient(135deg, #a78bfa, #6366f1)",
    "linear-gradient(135deg, #f87171, #c084fc)",
    "linear-gradient(135deg, #60a5fa, #34d399)",
  ];
  return palette[idx % palette.length];
}

function initials(name: string): string {
  const parts = (name || "").trim().split(/\s+/);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type OpenStep = 1 | 2 | 3;
type CloseStep = 1 | 2 | 3 | 4; // 4 = sucesso

type Props = {
  visible: boolean;
  companyId: string;
  companyName: string;
  companyCnpj?: string | null;
  /** Sessao ativa atual (vem do useCaixa do PDV) */
  sessaoAtiva: CaixaSessaoAtiva | null;
  onClose: () => void;
  /** Chamado apos abrir ou fechar com sucesso pra invalidar caches */
  onSuccess?: () => void;
};

export function OpenCloseCashModal({
  visible,
  companyId,
  companyName,
  companyCnpj,
  sessaoAtiva,
  onClose,
  onSuccess,
}: Props) {
  const isAberto = !!sessaoAtiva;
  const mode: "abrir" | "fechar" = isAberto ? "fechar" : "abrir";

  // ── ABRIR state ──
  const [openStep, setOpenStep] = useState<OpenStep>(1);
  const [selectedEmployee, setSelectedEmployee] = useState<{ id: string; name: string; role?: string | null } | null>(null);
  const [trocoInput, setTrocoInput] = useState("0,00");
  const [submittingOpen, setSubmittingOpen] = useState(false);

  // ── FECHAR state ──
  const [closeStep, setCloseStep] = useState<CloseStep>(1);
  const [dinheiroInput, setDinheiroInput] = useState("");
  const [obsInput, setObsInput] = useState("");
  const [submittingClose, setSubmittingClose] = useState(false);
  const [closeResult, setCloseResult] = useState<CaixaFechamentoFull | null>(null);

  // ── Reset ao abrir/fechar ──
  useEffect(() => {
    if (!visible) {
      setOpenStep(1);
      setSelectedEmployee(null);
      setTrocoInput("0,00");
      setSubmittingOpen(false);
      setCloseStep(1);
      setDinheiroInput("");
      setObsInput("");
      setSubmittingClose(false);
      setCloseResult(null);
    }
  }, [visible]);

  // ── Funcionarios (so plano Negocio+; useQuery cacheado) ──
  const { data: empData, isFetching: loadingEmployees } = useQuery({
    queryKey: ["employees", companyId],
    queryFn: () => employeesApi.list(companyId),
    enabled: !!companyId && visible && mode === "abrir",
    staleTime: 60_000,
  });
  const employees = useMemo(() => {
    return ((empData?.employees || []) as any[]).map((e) => ({
      id: e.id as string,
      name: (e.name || "") as string,
      role: (e.role || null) as string | null,
    }));
  }, [empData]);

  // ── Calculos do fechamento (ao vivo, baseado no sessaoAtiva) ──
  const trocoInicial = sessaoAtiva?.troco_inicial || 0;
  const vendasEmDinheiro = sessaoAtiva?.totais_ao_vivo?.dinheiro || 0;
  const dinheiroEsperado = Math.round((trocoInicial + vendasEmDinheiro) * 100) / 100;
  const dinheiroContado = parseMoeda(dinheiroInput);
  const diferenca = dinheiroInput ? Math.round((dinheiroContado - dinheiroEsperado) * 100) / 100 : 0;
  const hasDigitedClose = dinheiroInput.length > 0;

  // ── Submit Abrir ──
  async function handleAbrir() {
    if (submittingOpen) return;
    if (!selectedEmployee) {
      toast.error("Selecione o funcionario responsavel");
      return;
    }
    const troco = parseMoeda(trocoInput);
    if (troco < 0) {
      toast.error("Troco invalido");
      return;
    }
    setSubmittingOpen(true);
    try {
      await caixaApi.abrir(companyId, troco, selectedEmployee.id);
      toast.success("Caixa aberto!");
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.error || err?.message || "Erro ao abrir o caixa");
    } finally {
      setSubmittingOpen(false);
    }
  }

  // ── Submit Fechar ──
  async function handleFechar() {
    if (submittingClose) return;
    if (!hasDigitedClose) {
      toast.error("Digite o valor contado");
      return;
    }
    setSubmittingClose(true);
    try {
      const res = await caixaApi.fechar(
        companyId,
        dinheiroContado,
        obsInput.trim() || undefined
      );
      setCloseResult(res.fechamento);
      setCloseStep(4); // tela de sucesso
      onSuccess?.();
    } catch (err: any) {
      toast.error(err?.data?.error || err?.message || "Erro ao fechar o caixa");
    } finally {
      setSubmittingClose(false);
    }
  }

  // ── Gerar PDF a partir do closeResult ──
  function handleDownloadPdf() {
    if (!closeResult || !sessaoAtiva) return;
    const paymentMix: CashClosePaymentRow[] = [
      { label: "Pix", amount: closeResult.total_pix || 0 },
      { label: "Credito", amount: closeResult.total_cartao_credito || 0 },
      { label: "Debito", amount: closeResult.total_cartao_debito || 0 },
      { label: "Dinheiro", amount: closeResult.total_dinheiro || 0 },
      { label: "Fiado", amount: closeResult.total_fiado || 0 },
      { label: "Outros", amount: closeResult.total_outros || 0 },
    ].filter((p) => p.amount > 0);

    openCashClosePdf({
      companyName,
      companyCnpj: companyCnpj || null,
      operatorName: sessaoAtiva.opened_by.name,
      openedAtIso: sessaoAtiva.opened_at,
      closedAtIso: closeResult.closed_at || new Date().toISOString(),
      sessaoLabel: closeResult.sessao_label || undefined,
      salesCount: closeResult.sales_count || 0,
      newCustomersCount: closeResult.new_customers_count || 0,
      grossRevenue: closeResult.total_geral || 0,
      trocoInicial,
      vendasEmDinheiro,
      dinheiroEsperado: closeResult.dinheiro_esperado || dinheiroEsperado,
      dinheiroContado: closeResult.dinheiro_contado || dinheiroContado,
      diferenca: closeResult.diferenca != null ? closeResult.diferenca : diferenca,
      observacao: closeResult.observacao || obsInput.trim() || null,
      paymentMix,
    });
  }

  if (!visible) return null;

  const panelWeb = webOnly({
    background: IS_DARK_MODE ? "rgba(18,10,35,0.97)" : "rgba(255,255,255,0.97)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(124,58,237,0.30)",
    boxShadow: IS_DARK_MODE
      ? "0 24px 60px -10px rgba(0,0,0,0.70)"
      : "0 24px 60px -10px rgba(124,58,237,0.22)",
  });

  // ── Header dinamico (icone + titulo + close) ──
  const headerIcon = mode === "abrir" ? "unlock" : "lock";
  const headerColor = mode === "abrir" ? "#a78bfa" : "#fbbf24";
  const headerBg = mode === "abrir" ? "rgba(124,58,237,0.15)" : "rgba(251,191,36,0.15)";
  const headerTitle = mode === "abrir" ? "Abrir caixa" : "Fechar caixa";

  // ── Stepper labels ──
  const openLabels = ["FUNCIONARIO", "TROCO", "CONFIRMAR"];
  const closeLabels = ["CONTAGEM", "OBSERVACAO", "REVISAR"];

  return (
    <View style={s.overlay}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={[s.panel, IS_WEB ? (panelWeb as any) : { backgroundColor: Colors.bg3 }]}>

        {/* Header */}
        <View style={s.header}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={[s.headerIco, { backgroundColor: headerBg }]}>
              <Icon name={headerIcon} size={15} color={headerColor} />
            </View>
            <Text style={s.headerTitle}>{headerTitle}</Text>
          </View>
          <Pressable onPress={onClose} style={s.closeBtn}>
            <Icon name="x" size={14} color={Colors.ink3} />
          </Pressable>
        </View>

        {/* Stepper — esconde quando estamos na tela de sucesso */}
        {!(mode === "fechar" && closeStep === 4) && (
          <View style={s.stepBar}>
            {(mode === "abrir" ? openLabels : closeLabels).map((label, idx) => {
              const n = idx + 1;
              const cur = mode === "abrir" ? openStep : closeStep;
              const done = cur > n;
              const active = cur === n;
              return (
                <View key={n} style={s.stepItem}>
                  <View style={[s.stepDot, done && s.stepDotDone, active && s.stepDotActive]}>
                    {done ? (
                      <Icon name="check" size={9} color="#fff" />
                    ) : (
                      <Text style={[s.stepDotTxt, active && { color: "#fff" }]}>{n}</Text>
                    )}
                  </View>
                  <Text style={[s.stepLabel, (active || done) && { color: active ? "#a78bfa" : Colors.ink3 }]}>
                    {label}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Body */}
        <ScrollView
          style={s.body}
          contentContainerStyle={s.bodyContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* ═══ ABRIR ═══ */}
          {mode === "abrir" && openStep === 1 && (
            <>
              <Text style={s.sectionTitle}>Quem esta abrindo o caixa?</Text>
              {loadingEmployees ? (
                <View style={s.centered}><ActivityIndicator color={Colors.violet} /></View>
              ) : employees.length === 0 ? (
                <Text style={s.emptyTxt}>
                  Nenhum funcionario cadastrado. Cadastre em Equipe para escolher o responsavel.
                </Text>
              ) : (
                <View style={{ gap: 4 }}>
                  {employees.map((e, idx) => {
                    const sel = selectedEmployee?.id === e.id;
                    return (
                      <Pressable
                        key={e.id}
                        style={[s.pickerItem, sel && s.pickerItemSelected]}
                        onPress={() => setSelectedEmployee(e)}
                      >
                        <View
                          style={[
                            s.avatar,
                            IS_WEB && webOnly({ background: avatarColor(idx) } as any),
                          ]}
                        >
                          <Text style={s.avatarTxt}>{initials(e.name)}</Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={s.pickerName} numberOfLines={1}>{e.name || "Sem nome"}</Text>
                          {e.role && <Text style={s.pickerRole} numberOfLines={1}>{e.role}</Text>}
                        </View>
                        <View style={s.permTag}>
                          <Text style={s.permTagTxt}>ACESSO PDV</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}
              <Text style={s.helpTxt}>
                Lista filtrada por permissao de acessar o PDV (plano Negocio+).
              </Text>
              <View style={s.stepFooter}>
                <Text style={s.footerTxt}>PASSO 1 DE 3</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable style={s.btnSec} onPress={onClose}>
                    <Text style={s.btnSecTxt}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    style={[s.btnPri, !selectedEmployee && { opacity: 0.45 }]}
                    onPress={() => selectedEmployee && setOpenStep(2)}
                    disabled={!selectedEmployee}
                  >
                    <Text style={s.btnPriTxt}>Avancar -&gt;</Text>
                  </Pressable>
                </View>
              </View>
            </>
          )}

          {mode === "abrir" && openStep === 2 && (
            <>
              {selectedEmployee && (
                <View style={s.infoStrip}>
                  <Text style={s.infoStripTitle}>{selectedEmployee.name}</Text>
                  {selectedEmployee.role && (
                    <Text style={s.infoStripSub}>{selectedEmployee.role}</Text>
                  )}
                </View>
              )}
              <Text style={[s.sectionTitle, { marginTop: 14 }]}>Valor em dinheiro de abertura</Text>
              <View style={s.moneyInput}>
                <Text style={s.moneyPrefix}>R$</Text>
                <TextInput
                  style={s.moneyField as any}
                  value={trocoInput}
                  onChangeText={setTrocoInput}
                  keyboardType="decimal-pad"
                  placeholder="0,00"
                  placeholderTextColor={Colors.ink3}
                  autoFocus
                  selectTextOnFocus
                />
              </View>
              <Text style={s.helpTxt}>
                Conte cedulas + moedas separadas para troco. Esse valor e o ponto de partida do
                fechamento — nao inclui vendas posteriores.
              </Text>
              <View style={s.stepFooter}>
                <Text style={s.footerTxt}>PASSO 2 DE 3</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable style={s.btnSec} onPress={() => setOpenStep(1)}>
                    <Text style={s.btnSecTxt}>&lt;- Voltar</Text>
                  </Pressable>
                  <Pressable style={s.btnPri} onPress={() => setOpenStep(3)}>
                    <Text style={s.btnPriTxt}>Avancar -&gt;</Text>
                  </Pressable>
                </View>
              </View>
            </>
          )}

          {mode === "abrir" && openStep === 3 && (
            <>
              <Text style={s.sectionTitle}>Revise antes de abrir</Text>
              <View style={s.summaryBox}>
                <View style={s.summaryRow}>
                  <Text style={s.summaryLab}>Operador</Text>
                  <Text style={s.summaryVal}>{selectedEmployee?.name || "-"}</Text>
                </View>
                <View style={s.summaryRow}>
                  <Text style={s.summaryLab}>Empresa</Text>
                  <Text style={s.summaryVal}>{companyName}</Text>
                </View>
                <View style={s.summaryRow}>
                  <Text style={s.summaryLab}>Abertura</Text>
                  <Text style={s.summaryVal}>
                    {new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </View>
                <View style={s.summaryRow}>
                  <Text style={s.summaryLab}>Troco inicial</Text>
                  <Text style={[s.summaryVal, s.summaryValBold]}>{fmt(parseMoeda(trocoInput))}</Text>
                </View>
              </View>
              <View style={s.netBox}>
                <Text style={s.netLab}>Caixa abrira com</Text>
                <Text style={[s.netVal, { color: "#a78bfa" }]}>{fmt(parseMoeda(trocoInput))}</Text>
              </View>
              <View style={s.stepFooter}>
                <Pressable style={s.btnSec} onPress={() => setOpenStep(2)}>
                  <Text style={s.btnSecTxt}>&lt;- Voltar</Text>
                </Pressable>
                <Pressable
                  style={[s.btnPri, submittingOpen && { opacity: 0.6 }, { minWidth: 160 }]}
                  onPress={handleAbrir}
                  disabled={submittingOpen}
                >
                  {submittingOpen ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={s.btnPriTxt}>Abrir caixa</Text>
                  )}
                </Pressable>
              </View>
            </>
          )}

          {/* ═══ FECHAR ═══ */}
          {mode === "fechar" && closeStep === 1 && sessaoAtiva && (
            <>
              <View style={s.infoStrip}>
                <Text style={s.infoStripTitle}>
                  Caixa aberto em {new Date(sessaoAtiva.opened_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </Text>
                <Text style={s.infoStripSub}>
                  {sessaoAtiva.opened_by.name} · troco {fmt(trocoInicial)}
                </Text>
              </View>
              <Text style={[s.sectionTitle, { marginTop: 14 }]}>O que e esperado em caixa</Text>
              <View style={s.summaryBox}>
                <View style={s.summaryRow}>
                  <Text style={s.summaryLab}>Troco de abertura</Text>
                  <Text style={s.summaryVal}>{fmt(trocoInicial)}</Text>
                </View>
                <View style={s.summaryRow}>
                  <Text style={s.summaryLab}>Vendas em dinheiro</Text>
                  <Text style={s.summaryVal}>{fmt(vendasEmDinheiro)}</Text>
                </View>
                <View style={s.summaryRow}>
                  <Text style={s.summaryLab}>Esperado em caixa</Text>
                  <Text style={[s.summaryVal, s.summaryValBold]}>{fmt(dinheiroEsperado)}</Text>
                </View>
              </View>
              <Text style={[s.sectionTitle, { marginTop: 14 }]}>Quanto contou no caixa fisico?</Text>
              <View style={s.moneyInput}>
                <Text style={s.moneyPrefix}>R$</Text>
                <TextInput
                  style={s.moneyField as any}
                  value={dinheiroInput}
                  onChangeText={setDinheiroInput}
                  keyboardType="decimal-pad"
                  placeholder="0,00"
                  placeholderTextColor={Colors.ink3}
                  autoFocus
                  selectTextOnFocus
                />
              </View>
              {hasDigitedClose && (
                <View
                  style={[
                    s.diff,
                    diferenca === 0 ? s.diffOk : diferenca > 0 ? s.diffUp : s.diffDown,
                  ]}
                >
                  <Icon
                    name={diferenca === 0 ? "check" : diferenca > 0 ? "arrow_up" : "arrow_down"}
                    size={12}
                    color={diferenca === 0 ? Colors.green : diferenca > 0 ? "#a78bfa" : Colors.red}
                  />
                  <Text
                    style={[
                      s.diffTxt,
                      { color: diferenca === 0 ? Colors.green : diferenca > 0 ? "#a78bfa" : Colors.red },
                    ]}
                  >
                    {diferenca === 0
                      ? "Caixa fechado exato"
                      : diferenca > 0
                        ? "Sobra de " + fmt(diferenca)
                        : "Falta de " + fmt(Math.abs(diferenca))}
                  </Text>
                </View>
              )}
              <View style={s.stepFooter}>
                <Text style={s.footerTxt}>PASSO 1 DE 3</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable style={s.btnSec} onPress={onClose}>
                    <Text style={s.btnSecTxt}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    style={[s.btnPri, !hasDigitedClose && { opacity: 0.45 }]}
                    onPress={() => hasDigitedClose && setCloseStep(2)}
                    disabled={!hasDigitedClose}
                  >
                    <Text style={s.btnPriTxt}>Avancar -&gt;</Text>
                  </Pressable>
                </View>
              </View>
            </>
          )}

          {mode === "fechar" && closeStep === 2 && (
            <>
              {diferenca !== 0 ? (
                <View
                  style={[
                    s.diff,
                    diferenca > 0 ? s.diffUp : s.diffDown,
                  ]}
                >
                  <Icon name="alert" size={12} color={diferenca > 0 ? "#a78bfa" : Colors.red} />
                  <Text
                    style={[
                      s.diffTxt,
                      { color: diferenca > 0 ? "#a78bfa" : Colors.red },
                    ]}
                  >
                    Detectamos divergencia de {fmt(Math.abs(diferenca))} ({diferenca > 0 ? "sobra" : "falta"})
                  </Text>
                </View>
              ) : null}
              <Text style={[s.sectionTitle, { marginTop: diferenca !== 0 ? 14 : 0 }]}>
                Quer registrar uma observacao?
              </Text>
              <TextInput
                style={s.textArea as any}
                value={obsInput}
                onChangeText={setObsInput}
                placeholder="Ex: troco dado a mais na venda #00009"
                placeholderTextColor={Colors.ink3}
                multiline
                numberOfLines={3}
              />
              <Text style={s.helpTxt}>
                Quando ha divergencia, anotar o motivo ajuda a auditoria.
                Fica gravado no historico e no PDF.
              </Text>
              <View style={s.stepFooter}>
                <Text style={s.footerTxt}>PASSO 2 DE 3 · opcional</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable style={s.btnSec} onPress={() => setCloseStep(1)}>
                    <Text style={s.btnSecTxt}>&lt;- Voltar</Text>
                  </Pressable>
                  <Pressable style={s.btnPri} onPress={() => setCloseStep(3)}>
                    <Text style={s.btnPriTxt}>Avancar -&gt;</Text>
                  </Pressable>
                </View>
              </View>
            </>
          )}

          {mode === "fechar" && closeStep === 3 && sessaoAtiva && (
            <>
              <Text style={s.sectionTitle}>Conferencia de caixa</Text>
              <View style={s.summaryBox}>
                <View style={s.summaryRow}>
                  <Text style={s.summaryLab}>Esperado em caixa</Text>
                  <Text style={s.summaryVal}>{fmt(dinheiroEsperado)}</Text>
                </View>
                <View style={s.summaryRow}>
                  <Text style={s.summaryLab}>Contado em caixa</Text>
                  <Text style={s.summaryVal}>{fmt(dinheiroContado)}</Text>
                </View>
                {obsInput.trim() ? (
                  <View style={s.summaryRow}>
                    <Text style={s.summaryLab}>Observacao</Text>
                    <Text style={[s.summaryVal, { fontStyle: "italic", color: Colors.ink3 }]} numberOfLines={1}>
                      {obsInput.trim()}
                    </Text>
                  </View>
                ) : null}
              </View>
              <View
                style={[
                  s.netBox,
                  diferenca < 0 && { backgroundColor: "rgba(248,113,113,0.08)", borderColor: "rgba(248,113,113,0.25)" },
                  diferenca > 0 && { backgroundColor: "rgba(124,58,237,0.07)", borderColor: "rgba(124,58,237,0.20)" },
                  diferenca === 0 && { backgroundColor: "rgba(52,211,153,0.08)", borderColor: "rgba(52,211,153,0.25)" },
                ]}
              >
                <Text style={s.netLab}>Diferenca</Text>
                <Text
                  style={[
                    s.netVal,
                    { color: diferenca === 0 ? Colors.green : diferenca > 0 ? "#a78bfa" : Colors.red },
                  ]}
                >
                  {diferenca === 0
                    ? "Exato"
                    : (diferenca > 0 ? "+ " : "- ") + fmt(Math.abs(diferenca))}
                </Text>
              </View>
              <View style={s.stepFooter}>
                <Pressable style={s.btnSec} onPress={() => setCloseStep(2)}>
                  <Text style={s.btnSecTxt}>&lt;- Voltar e recontar</Text>
                </Pressable>
                <Pressable
                  style={[
                    diferenca === 0 ? s.btnPri : s.btnDanger,
                    submittingClose && { opacity: 0.6 },
                    { minWidth: 160 },
                  ]}
                  onPress={handleFechar}
                  disabled={submittingClose}
                >
                  {submittingClose ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={s.btnPriTxt}>{diferenca === 0 ? "Fechar caixa" : "Selar caixa"}</Text>
                  )}
                </Pressable>
              </View>
            </>
          )}

          {/* ═══ TELA DE SUCESSO POS-FECHAMENTO ═══ */}
          {mode === "fechar" && closeStep === 4 && closeResult && sessaoAtiva && (
            <>
              <View style={s.successHero}>
                <View style={s.successCheck}>
                  <Icon name="check" size={26} color={Colors.green} />
                </View>
                <Text style={s.successTitle}>Caixa fechado com sucesso</Text>
                <Text style={s.successSub}>
                  {companyName} · {new Date(closeResult.closed_at || Date.now()).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>

              <View style={s.kpiGrid}>
                <View style={s.kpi}>
                  <Text style={s.kpiL}>Vendas</Text>
                  <Text style={[s.kpiV, { color: "#a78bfa" }]}>{closeResult.sales_count || 0}</Text>
                </View>
                <View style={s.kpi}>
                  <Text style={s.kpiL}>Clientes novos</Text>
                  <Text style={[s.kpiV, { color: "#a78bfa" }]}>{closeResult.new_customers_count || 0}</Text>
                </View>
                <View style={s.kpi}>
                  <Text style={s.kpiL}>Faturamento</Text>
                  <Text style={[s.kpiV, { color: Colors.green }]}>{fmt(closeResult.total_geral || 0)}</Text>
                </View>
                <View style={s.kpi}>
                  <Text style={s.kpiL}>Diferenca</Text>
                  <Text
                    style={[
                      s.kpiV,
                      { color: (closeResult.diferenca || 0) === 0 ? Colors.green : (closeResult.diferenca || 0) > 0 ? "#a78bfa" : Colors.red },
                    ]}
                  >
                    {(closeResult.diferenca || 0) === 0
                      ? "Exato"
                      : ((closeResult.diferenca || 0) > 0 ? "+ " : "- ") + fmt(Math.abs(closeResult.diferenca || 0))}
                  </Text>
                </View>
              </View>

              <View style={s.stepFooter}>
                <Pressable style={s.btnSec} onPress={onClose}>
                  <Text style={s.btnSecTxt}>Fechar</Text>
                </Pressable>
                <Pressable style={[s.btnPri, { minWidth: 200 }]} onPress={handleDownloadPdf}>
                  <Icon name="download" size={13} color="#fff" />
                  <Text style={[s.btnPriTxt, { marginLeft: 6 }]}>Baixar PDF de fechamento</Text>
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

// ── Styles (DNA TrocaModal) ───────────────────────────────────────────
const s = StyleSheet.create({
  overlay: {
    position: "absolute" as any,
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 1000,
    alignItems: "center",
    justifyContent: "center",
  },
  backdrop: {
    position: "absolute" as any,
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  panel: {
    width: "100%" as any,
    maxWidth: 580,
    maxHeight: "90vh" as any,
    borderRadius: 16,
    overflow: "hidden" as any,
    zIndex: 1,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(124,58,237,0.15)",
  },
  headerIco: {
    width: 30, height: 30, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 15, fontWeight: "700", color: Colors.ink },
  closeBtn: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  // Stepper
  stepBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(124,58,237,0.10)",
  },
  stepItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  stepDot: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center", justifyContent: "center",
  },
  stepDotActive: { backgroundColor: Colors.violet },
  stepDotDone: { backgroundColor: "#34d399" },
  stepDotTxt: { fontSize: 10, fontWeight: "700", color: Colors.ink3 },
  stepLabel: { fontSize: 10, fontWeight: "600", color: Colors.ink3, letterSpacing: 0.3 },

  // Body
  body: { flex: 1 },
  bodyContent: { padding: 20, paddingBottom: 28, gap: 10 },
  sectionTitle: {
    fontSize: 11, fontWeight: "700", color: Colors.ink3,
    textTransform: "uppercase", letterSpacing: 1.1, marginBottom: 4,
  },
  helpTxt: { fontSize: 11, color: Colors.ink3, lineHeight: 15, marginTop: 6 },
  centered: { alignItems: "center", padding: 24 },
  emptyTxt: { fontSize: 12, color: Colors.ink3, textAlign: "center", paddingVertical: 16 },

  // Picker
  pickerItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 12, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
  },
  pickerItemSelected: {
    backgroundColor: "rgba(124,58,237,0.10)",
    borderColor: Colors.violet,
    borderLeftWidth: 3,
  },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.violet,
  },
  avatarTxt: { fontSize: 11, fontWeight: "700", color: "#fff" },
  pickerName: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  pickerRole: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  permTag: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4,
    backgroundColor: "rgba(124,58,237,0.10)",
    borderWidth: 1, borderColor: "rgba(124,58,237,0.25)",
  },
  permTagTxt: { fontSize: 9, color: "#a78bfa", fontWeight: "700", letterSpacing: 0.4 },

  // Money input
  moneyInput: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "rgba(5,6,15,0.6)",
    borderWidth: 1, borderColor: "rgba(124,58,237,0.20)",
    borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12,
  },
  moneyPrefix: { fontSize: 17, color: Colors.ink3, fontWeight: "500" },
  moneyField: {
    flex: 1, color: Colors.ink, fontSize: 26, fontWeight: "700",
    letterSpacing: -0.3, outlineStyle: "none",
  } as any,

  // Generic input
  textArea: {
    backgroundColor: "rgba(5,6,15,0.6)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10,
    color: Colors.ink, fontSize: 13, minHeight: 64, outlineStyle: "none",
  } as any,

  // Info strip
  infoStrip: {
    padding: 10, borderRadius: 8,
    backgroundColor: "rgba(124,58,237,0.08)",
    borderLeftWidth: 3, borderLeftColor: Colors.violet,
  },
  infoStripTitle: { fontSize: 12, fontWeight: "600", color: Colors.ink },
  infoStripSub: { fontSize: 11, color: Colors.ink3, marginTop: 2 },

  // Summary
  summaryBox: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
  },
  summaryRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: "rgba(124,58,237,0.08)",
  },
  summaryLab: { fontSize: 12, color: Colors.ink3 },
  summaryVal: { fontSize: 12, color: Colors.ink, fontWeight: "600" },
  summaryValBold: { fontWeight: "700", color: "#a78bfa", fontSize: 13 },

  // Net box
  netBox: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 14, borderRadius: 10,
    backgroundColor: "rgba(124,58,237,0.07)",
    borderWidth: 1, borderColor: "rgba(124,58,237,0.20)",
  },
  netLab: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  netVal: { fontSize: 18, fontWeight: "800" },

  // Diff banner
  diff: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 9,
    borderWidth: 1,
  },
  diffOk: { backgroundColor: "rgba(52,211,153,0.10)", borderColor: "rgba(52,211,153,0.25)" },
  diffUp: { backgroundColor: "rgba(124,58,237,0.10)", borderColor: "rgba(124,58,237,0.25)" },
  diffDown: { backgroundColor: "rgba(248,113,113,0.10)", borderColor: "rgba(248,113,113,0.25)" },
  diffTxt: { fontSize: 12, fontWeight: "600" },

  // Step footer
  stepFooter: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginTop: 16, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: "rgba(124,58,237,0.12)",
  },
  footerTxt: { fontSize: 11, fontWeight: "600", color: Colors.ink3, letterSpacing: 0.3 },

  // Buttons
  btnSec: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
  },
  btnSecTxt: { fontSize: 12, fontWeight: "600", color: Colors.ink },
  btnPri: {
    paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8,
    backgroundColor: Colors.violet,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    minWidth: 110,
  },
  btnPriTxt: { fontSize: 12, fontWeight: "700", color: "#fff" },
  btnDanger: {
    paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8,
    backgroundColor: Colors.red || "#ef4444",
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    minWidth: 110,
  },

  // Sucesso
  successHero: {
    alignItems: "center",
    paddingVertical: 18,
    borderRadius: 12,
    backgroundColor: "rgba(52,211,153,0.06)",
    borderWidth: 1, borderColor: "rgba(52,211,153,0.18)",
  },
  successCheck: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "rgba(52,211,153,0.14)",
    borderWidth: 2, borderColor: Colors.green,
    alignItems: "center", justifyContent: "center",
    marginBottom: 12,
  },
  successTitle: { fontSize: 17, fontWeight: "700", color: Colors.ink },
  successSub: { fontSize: 11, color: Colors.ink3, marginTop: 4 },

  // KPI grid
  kpiGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 8,
  },
  kpi: {
    flexBasis: "48%" as any,
    flexGrow: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
    borderRadius: 10, padding: 12,
  },
  kpiL: {
    fontSize: 10, color: Colors.ink3, fontWeight: "600",
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  kpiV: {
    fontSize: 18, fontWeight: "700", color: Colors.ink, marginTop: 4, letterSpacing: -0.3,
  },
});

export default OpenCloseCashModal;
