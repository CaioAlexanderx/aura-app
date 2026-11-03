// ============================================================
// AURA. — PDV · OpenCloseCashModal
//
// Modal único que cobre Abrir e Fechar Caixa.
//
// 08/05/2026: Fix overlay position fixed (web) + employee/owner role.
// 08/05/2026 hotfix: FK opened_by_employee_id null quando !isOwner.
//
// 15/05/2026 (Davi Calçados): refator pra cobrir monitor 13/14 (1366×768
// @ 125% scale). Antes: stepFooter dentro de ScrollView → em telas
// pequenas com conteúdo grande (lista de funcionários, KPIs de fechamento)
// o botão Confirmar/Avançar saía abaixo da fold e não dava pra scrollar
// até ele de forma intuitiva. Agora: cada step retorna { body, footer } e
// renderizamos body dentro da ScrollView e footer fora (sticky). Paddings
// também foram tighten: header 18→14, body 20→16, gap 10→8.
//
// 30/10/2026 (sangria e suprimento, Aura-backend#944, mockup
// docs/mockups/sangria-no-caixa.html): o passo 1 do fechamento ganha o
// bloco "Dinheiro na gaveta" com "Retirar dinheiro" / "Reforçar troco" e a
// lista do dia (com "desfazer"). Tocar num botão troca o corpo do modal
// pelo formulário (valor + motivo), sem stepper; ao confirmar, volta ao
// passo 1 com o esperado já atualizado. A retirada não passa do que o
// sistema diz estar na gaveta. Backend antigo (sem a rota): as linhas
// novas não aparecem e o esperado é o de sempre.
// ============================================================
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  View, Text, Pressable, StyleSheet, TextInput,
  ActivityIndicator, ScrollView,
} from "react-native";
import { Colors, IS_DARK_MODE } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { caixaApi, type CaixaSessaoAtiva, type CaixaFechamentoFull } from "@/services/caixaApi";
import { employeesApi } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/Toast";
import { IS_WEB, webOnly } from "./types";
import { openCashClosePdf, type CashClosePaymentRow } from "@/utils/cashClosePdf";
import { esperadoNaGaveta, podeRetirar, rotuloDoMovimento, type TipoDeMovimento } from "@/utils/caixaMovimentos";

function toNum(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  const n = parseFloat(String(v));
  return isFinite(n) ? n : 0;
}

const fmt = (v: unknown) => "R$ " + toNum(v).toFixed(2).replace(".", ",");

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
type CloseStep = 1 | 2 | 3 | 4;

type Props = {
  visible: boolean;
  companyId: string;
  companyName: string;
  companyCnpj?: string | null;
  sessaoAtiva: CaixaSessaoAtiva | null;
  onClose: () => void;
  onSuccess?: () => void;
};

export function OpenCloseCashModal({
  visible, companyId, companyName, companyCnpj,
  sessaoAtiva, onClose, onSuccess,
}: Props) {
  const { user, isStaff, company: authCompany } = useAuthStore();
  const isOwner = isStaff || authCompany?.member_role === "owner";

  const [openStep, setOpenStep] = useState<OpenStep>(1);
  const [selectedEmployee, setSelectedEmployee] = useState<{ id: string; name: string; role?: string | null } | null>(null);
  const [trocoInput, setTrocoInput] = useState("0,00");
  const [submittingOpen, setSubmittingOpen] = useState(false);

  const [closeStep, setCloseStep] = useState<CloseStep>(1);
  const [dinheiroInput, setDinheiroInput] = useState("");
  const [obsInput, setObsInput] = useState("");
  const [submittingClose, setSubmittingClose] = useState(false);
  const [closeResult, setCloseResult] = useState<CaixaFechamentoFull | null>(null);
  const [sessaoSnapshot, setSessaoSnapshot] = useState<CaixaSessaoAtiva | null>(null);

  // 30/10/2026 — retirada/reforço: qual formulário está aberto (null = nenhum).
  const [movimento, setMovimento] = useState<TipoDeMovimento | null>(null);
  const [movValorInput, setMovValorInput] = useState("");
  const [movMotivoInput, setMovMotivoInput] = useState("");
  const [submittingMov, setSubmittingMov] = useState(false);
  const [removendoMov, setRemovendoMov] = useState<string | null>(null);
  const qc = useQueryClient();

  useEffect(() => {
    if (!visible) {
      setOpenStep(1); setSelectedEmployee(null); setTrocoInput("0,00");
      setSubmittingOpen(false);
      setCloseStep(1); setDinheiroInput(""); setObsInput("");
      setSubmittingClose(false); setCloseResult(null); setSessaoSnapshot(null);
      setMovimento(null); setMovValorInput(""); setMovMotivoInput(""); setSubmittingMov(false); setRemovendoMov(null);
    }
  }, [visible]);

  useEffect(() => {
    if (sessaoAtiva) setSessaoSnapshot(sessaoAtiva);
  }, [sessaoAtiva]);

  useEffect(() => {
    if (!visible || isOwner) return;
    if (user) {
      setSelectedEmployee({
        id: user.id,
        name: (user as any).name || (user as any).email || "Eu",
        role: null,
      });
    }
  }, [visible, isOwner, user]);

  const isAberto = !!sessaoAtiva;
  const mode: "abrir" | "fechar" = (closeResult || isAberto) ? "fechar" : "abrir";
  const sessaoEff: CaixaSessaoAtiva | null = sessaoAtiva || sessaoSnapshot;

  const { data: empData, isFetching: loadingEmployees } = useQuery({
    queryKey: ["employees", companyId],
    queryFn: () => employeesApi.list(companyId),
    enabled: !!companyId && visible && mode === "abrir" && isOwner,
    staleTime: 60_000,
  });
  const employees = useMemo(() => {
    return ((empData?.employees || []) as any[]).map((e) => ({
      id: e.id as string,
      name: (e.name || "") as string,
      role: (e.role || null) as string | null,
    }));
  }, [empData]);

  // 30/10/2026 — as movimentações da sessão aberta. Backend antigo (rota
  // inexistente): a consulta falha, fica undefined e tudo abaixo cai nos
  // campos do status (também ausentes) = zeros, o esperado de sempre.
  const { data: movData } = useQuery({
    queryKey: ["caixa-movimentos", companyId],
    queryFn: () => caixaApi.movimentos.list(companyId),
    enabled: !!companyId && visible && mode === "fechar" && isAberto,
    staleTime: 15_000,
    retry: 0,
  });
  const movimentosDaSessao = movData?.movimentos || [];
  const sangrias = toNum(movData?.sangrias ?? sessaoEff?.sangrias);
  const suprimentos = toNum(movData?.suprimentos ?? sessaoEff?.suprimentos);

  const trocoInicial = toNum(sessaoEff?.troco_inicial);
  const vendasEmDinheiro = toNum(sessaoEff?.totais_ao_vivo?.dinheiro);
  const dinheiroEsperado = esperadoNaGaveta({ troco: trocoInicial, dinheiro: vendasEmDinheiro, suprimentos, sangrias });
  const movValor = parseMoeda(movValorInput);
  const movForaDoCaixa = movimento === "sangria" && movValor > 0 && !podeRetirar(movValor, dinheiroEsperado);
  const podeConfirmarMov = movValor > 0 && !movForaDoCaixa;
  const dinheiroContado = parseMoeda(dinheiroInput);
  const diferenca = dinheiroInput ? Math.round((dinheiroContado - dinheiroEsperado) * 100) / 100 : 0;
  const hasDigitedClose = dinheiroInput.length > 0;

  function handleCloseModal() {
    if (closeResult || mode === "abrir") onSuccess?.();
    onClose();
  }

  async function handleAbrir() {
    if (submittingOpen) return;
    if (!selectedEmployee) { toast.error("Selecione o funcionario responsável"); return; }
    const troco = parseMoeda(trocoInput);
    if (troco < 0) { toast.error("Troco inválido"); return; }
    setSubmittingOpen(true);
    try {
      await caixaApi.abrir(companyId, troco, isOwner ? selectedEmployee.id : null);
      toast.success("Caixa aberto!");
      onSuccess?.(); onClose();
    } catch (err: any) {
      toast.error(err?.data?.error || err?.message || "Erro ao abrir o caixa");
    } finally { setSubmittingOpen(false); }
  }

  async function handleFechar() {
    if (submittingClose) return;
    if (!hasDigitedClose) { toast.error("Digite o valor contado"); return; }
    if (sessaoAtiva && !sessaoSnapshot) setSessaoSnapshot(sessaoAtiva);
    setSubmittingClose(true);
    try {
      const res = await caixaApi.fechar(companyId, dinheiroContado, obsInput.trim() || undefined);
      setCloseResult(res.fechamento); setCloseStep(4);
    } catch (err: any) {
      toast.error(err?.data?.error || err?.message || "Erro ao fechar o caixa");
    } finally { setSubmittingClose(false); }
  }

  function abrirMovimento(tipo: TipoDeMovimento) {
    setMovimento(tipo); setMovValorInput(""); setMovMotivoInput("");
  }

  async function handleRegistrarMovimento() {
    if (!movimento || submittingMov) return;
    if (!(movValor > 0)) { toast.error("Digite o valor"); return; }
    if (movForaDoCaixa) { toast.error("O caixa só tem " + fmt(dinheiroEsperado) + " em dinheiro"); return; }
    setSubmittingMov(true);
    try {
      await caixaApi.movimentos.registrar(companyId, { tipo: movimento, valor: movValor, motivo: movMotivoInput.trim() || null });
      toast.success(movimento === "sangria" ? "Retirada registrada" : "Reforço registrado");
      setMovimento(null); setMovValorInput(""); setMovMotivoInput("");
      qc.invalidateQueries({ queryKey: ["caixa-movimentos", companyId] });
      onSuccess?.(); // o status do caixa (dinheiro_em_caixa) muda junto
    } catch (err: any) {
      toast.error(err?.data?.error || err?.message || "Não deu para registrar");
    } finally { setSubmittingMov(false); }
  }

  async function handleDesfazerMovimento(id: string) {
    if (removendoMov) return;
    setRemovendoMov(id);
    try {
      await caixaApi.movimentos.remover(companyId, id);
      toast.success("Desfeito");
      qc.invalidateQueries({ queryKey: ["caixa-movimentos", companyId] });
      onSuccess?.();
    } catch (err: any) {
      toast.error(err?.data?.error || err?.message || "Não deu para desfazer");
    } finally { setRemovendoMov(null); }
  }

  function handleDownloadPdf() {
    if (!closeResult) return;
    const operatorName = sessaoEff?.opened_by?.name || "Operador";
    const openedAtIso = sessaoEff?.opened_at || closeResult.closed_at || new Date().toISOString();
    const paymentMix: CashClosePaymentRow[] = [
      { label: "Pix", amount: toNum(closeResult.total_pix) },
      { label: "Crédito", amount: toNum(closeResult.total_cartao_credito) },
      { label: "Débito", amount: toNum(closeResult.total_cartao_debito) },
      { label: "Dinheiro", amount: toNum(closeResult.total_dinheiro) },
      { label: "Fiado", amount: toNum(closeResult.total_fiado) },
      { label: "Outros", amount: toNum(closeResult.total_outros) },
    ].filter((p) => p.amount > 0);

    openCashClosePdf({
      companyName, companyCnpj: companyCnpj || null,
      operatorName, openedAtIso,
      closedAtIso: closeResult.closed_at || new Date().toISOString(),
      sessaoLabel: closeResult.sessao_label || undefined,
      salesCount: toNum(closeResult.sales_count),
      newCustomersCount: toNum(closeResult.new_customers_count),
      // 12/08/2026 — grossRevenue = VENDAS do período (fonte única
      // sales.total_amount), não as entradas no caixa. Fallback pro
      // total_geral quando o backend ainda não envia total_vendas.
      grossRevenue: closeResult.total_vendas != null ? toNum(closeResult.total_vendas) : toNum(closeResult.total_geral),
      entradasTotal: toNum(closeResult.total_geral),
      devolucoes: toNum(closeResult.total_devolucoes),
      trocoInicial, vendasEmDinheiro,
      suprimentos: closeResult.total_suprimentos != null ? toNum(closeResult.total_suprimentos) : suprimentos,
      sangrias: closeResult.total_sangrias != null ? toNum(closeResult.total_sangrias) : sangrias,
      dinheiroEsperado: closeResult.dinheiro_esperado != null ? toNum(closeResult.dinheiro_esperado) : dinheiroEsperado,
      dinheiroContado: closeResult.dinheiro_contado != null ? toNum(closeResult.dinheiro_contado) : dinheiroContado,
      diferenca: closeResult.diferenca != null ? toNum(closeResult.diferenca) : diferenca,
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

  const headerIcon = mode === "abrir" ? "unlock" : movimento ? (movimento === "sangria" ? "arrow_up" : "arrow_down") : "lock";
  const headerColor = mode === "abrir" ? "#a78bfa" : movimento === "suprimento" ? Colors.green : "#fbbf24";
  const headerBg = mode === "abrir" ? "rgba(124,58,237,0.15)" : movimento === "suprimento" ? "rgba(52,211,153,0.15)" : "rgba(251,191,36,0.15)";
  const headerTitle = mode === "abrir" ? "Abrir caixa" : movimento ? (movimento === "sangria" ? "Retirar dinheiro" : "Reforçar troco") : "Fechar caixa";

  const openLabels = ["FUNCIONARIO", "TROCO", "CONFIRMAR"];
  const closeLabels = ["CONTAGEM", "OBSERVAÇÃO", "REVISAR"];

  const resultDiferenca = closeResult ? toNum(closeResult.diferenca) : 0;
  const resultGeral     = closeResult ? toNum(closeResult.total_geral) : 0;
  // 12/08/2026 — "Vendas do período" (fonte única) ≠ "Entradas no caixa"
  // (total_geral). Fallback pro total_geral quando o backend antigo ainda
  // não envia total_vendas.
  const resultVendas    = closeResult
    ? (closeResult.total_vendas != null ? toNum(closeResult.total_vendas) : toNum(closeResult.total_geral))
    : 0;
  const resultSales     = closeResult ? toNum(closeResult.sales_count) : 0;
  // Clientes novos saiu do KPI grid (deu lugar a Vendas do período ×
  // Entradas no caixa) mas segue no PDF via new_customers_count.

  // ── Build current step body + footer (footer renderiza FORA do ScrollView) ──
  let bodyNode: ReactNode = null;
  let footerNode: ReactNode = null;

  if (mode === "abrir" && openStep === 1) {
    bodyNode = (
      <>
        <Text style={s.sectionTitle}>Quem esta abrindo o caixa?</Text>
        {!isOwner ? (
          <View style={[s.pickerItem, s.pickerItemSelected, { borderStyle: "solid" as any }]}>
            <View style={[s.avatar, IS_WEB && webOnly({ background: avatarColor(0) } as any)]}>
              <Text style={s.avatarTxt}>{initials((user as any)?.name || "")}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.pickerName} numberOfLines={1}>{(user as any)?.name || "Você"}</Text>
              <Text style={s.pickerRole}>Abertura registrada em seu nome</Text>
            </View>
            <View style={[s.permTag, { backgroundColor: "rgba(52,211,153,0.10)", borderColor: "rgba(52,211,153,0.35)" }]}>
              <Text style={[s.permTagTxt, { color: "#34d399" }]}>VOCÊ</Text>
            </View>
          </View>
        ) : loadingEmployees ? (
          <View style={s.centered}><ActivityIndicator color={Colors.violet} /></View>
        ) : employees.length === 0 ? (
          <Text style={s.emptyTxt}>Nenhum funcionario cadastrado. Cadastre em Equipe.</Text>
        ) : (
          <View style={{ gap: 4 }}>
            {employees.map((e, idx) => {
              const sel = selectedEmployee?.id === e.id;
              return (
                <Pressable key={e.id} style={[s.pickerItem, sel && s.pickerItemSelected]}
                  onPress={() => setSelectedEmployee(e)}>
                  <View style={[s.avatar, IS_WEB && webOnly({ background: avatarColor(idx) } as any)]}>
                    <Text style={s.avatarTxt}>{initials(e.name)}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.pickerName} numberOfLines={1}>{e.name || "Sem nome"}</Text>
                    {e.role && <Text style={s.pickerRole} numberOfLines={1}>{e.role}</Text>}
                  </View>
                  <View style={s.permTag}><Text style={s.permTagTxt}>ACESSO PDV</Text></View>
                </Pressable>
              );
            })}
          </View>
        )}
        <Text style={s.helpTxt}>
          {isOwner
            ? "Lista filtrada por permissão de acessar o PDV (plano Negócio+)."
            : "Funcionarios abrem o caixa apenas em nome próprio. Proprietarios podem abrir como qualquer operador."}
        </Text>
      </>
    );
    footerNode = (
      <>
        <Text style={s.footerTxt}>PASSO 1 DE 3</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable style={s.btnSec} onPress={handleCloseModal}>
            <Text style={s.btnSecTxt}>Cancelar</Text>
          </Pressable>
          <Pressable style={[s.btnPri, !selectedEmployee && { opacity: 0.45 }]}
            onPress={() => selectedEmployee && setOpenStep(2)} disabled={!selectedEmployee}>
            <Text style={s.btnPriTxt}>Avancar -&gt;</Text>
          </Pressable>
        </View>
      </>
    );
  }

  if (mode === "abrir" && openStep === 2) {
    bodyNode = (
      <>
        {selectedEmployee && (
          <View style={s.infoStrip}>
            <Text style={s.infoStripTitle}>{selectedEmployee.name}</Text>
            {selectedEmployee.role && <Text style={s.infoStripSub}>{selectedEmployee.role}</Text>}
          </View>
        )}
        <Text style={[s.sectionTitle, { marginTop: 12 }]}>Valor em dinheiro de abertura</Text>
        <View style={s.moneyInput}>
          <Text style={s.moneyPrefix}>R$</Text>
          <TextInput style={s.moneyField as any} value={trocoInput} onChangeText={setTrocoInput}
            keyboardType="decimal-pad" placeholder="0,00" placeholderTextColor={Colors.ink3}
            autoFocus selectTextOnFocus />
        </View>
        <Text style={s.helpTxt}>
          Conte cedulas + moedas separadas para troco. Esse valor e o ponto de partida do
          fechamento — não inclui vendas posteriores.
        </Text>
      </>
    );
    footerNode = (
      <>
        <Text style={s.footerTxt}>PASSO 2 DE 3</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable style={s.btnSec} onPress={() => setOpenStep(1)}>
            <Text style={s.btnSecTxt}>&lt;- Voltar</Text>
          </Pressable>
          <Pressable style={s.btnPri} onPress={() => setOpenStep(3)}>
            <Text style={s.btnPriTxt}>Avancar -&gt;</Text>
          </Pressable>
        </View>
      </>
    );
  }

  if (mode === "abrir" && openStep === 3) {
    bodyNode = (
      <>
        <Text style={s.sectionTitle}>Revise antes de abrir</Text>
        <View style={s.summaryBox}>
          <View style={s.summaryRow}><Text style={s.summaryLab}>Operador</Text><Text style={s.summaryVal}>{selectedEmployee?.name || "-"}</Text></View>
          <View style={s.summaryRow}><Text style={s.summaryLab}>Empresa</Text><Text style={s.summaryVal}>{companyName}</Text></View>
          <View style={s.summaryRow}>
            <Text style={s.summaryLab}>Abertura</Text>
            <Text style={s.summaryVal}>{new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</Text>
          </View>
          <View style={s.summaryRow}><Text style={s.summaryLab}>Troco inicial</Text><Text style={[s.summaryVal, s.summaryValBold]}>{fmt(parseMoeda(trocoInput))}</Text></View>
        </View>
        <View style={s.netBox}>
          <Text style={s.netLab}>Caixa abrira com</Text>
          <Text style={[s.netVal, { color: "#a78bfa" }]}>{fmt(parseMoeda(trocoInput))}</Text>
        </View>
      </>
    );
    footerNode = (
      <>
        <Pressable style={s.btnSec} onPress={() => setOpenStep(2)}>
          <Text style={s.btnSecTxt}>&lt;- Voltar</Text>
        </Pressable>
        <Pressable style={[s.btnPri, submittingOpen && { opacity: 0.6 }, { minWidth: 160 }]}
          onPress={handleAbrir} disabled={submittingOpen}>
          {submittingOpen ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.btnPriTxt}>Abrir caixa</Text>}
        </Pressable>
      </>
    );
  }

  if (mode === "fechar" && closeStep === 1 && sessaoEff) {
    bodyNode = (
      <>
        <View style={s.infoStrip}>
          <Text style={s.infoStripTitle}>
            Caixa aberto em {new Date(sessaoEff.opened_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </Text>
          <Text style={s.infoStripSub}>{sessaoEff.opened_by.name} · troco {fmt(trocoInicial)}</Text>
        </View>
        <Text style={[s.sectionTitle, { marginTop: 12 }]}>Dinheiro na gaveta</Text>
        <View style={s.summaryBox}>
          <View style={s.summaryRow}><Text style={s.summaryLab}>Troco de abertura</Text><Text style={s.summaryVal}>{fmt(trocoInicial)}</Text></View>
          <View style={s.summaryRow}><Text style={s.summaryLab}>Vendas em dinheiro</Text><Text style={s.summaryVal}>{fmt(vendasEmDinheiro)}</Text></View>
          {suprimentos > 0 && (
            <View style={s.summaryRow} testID="caixa-reforcos"><Text style={s.summaryLab}>Reforços de troco</Text><Text style={[s.summaryVal, { color: Colors.green }]}>+ {fmt(suprimentos)}</Text></View>
          )}
          {sangrias > 0 && (
            <View style={s.summaryRow} testID="caixa-retiradas"><Text style={s.summaryLab}>Retiradas</Text><Text style={[s.summaryVal, { color: Colors.red }]}>− {fmt(sangrias)}</Text></View>
          )}
          <View style={s.summaryRow}><Text style={s.summaryLab}>Esperado em caixa</Text><Text style={[s.summaryVal, s.summaryValBold]} testID="caixa-esperado">{fmt(dinheiroEsperado)}</Text></View>
        </View>
        {/* 30/10/2026: retirada e reforço com o caixa aberto. */}
        <View style={s.movAcoes}>
          <Pressable testID="caixa-retirar" style={s.movBtn} onPress={() => abrirMovimento("sangria")} accessibilityRole="button">
            <Icon name="arrow_up" size={12} color="#fbbf24" />
            <Text style={s.movBtnTxt}>Retirar dinheiro</Text>
          </Pressable>
          <Pressable testID="caixa-reforcar" style={s.movBtn} onPress={() => abrirMovimento("suprimento")} accessibilityRole="button">
            <Icon name="arrow_down" size={12} color={Colors.green} />
            <Text style={s.movBtnTxt}>Reforçar troco</Text>
          </Pressable>
        </View>
        {movimentosDaSessao.length > 0 && (
          <View style={s.movLista} testID="caixa-movimentos">
            {movimentosDaSessao.map((m) => (
              <View key={m.id} style={s.movItem}>
                <Text style={s.movItemTxt} numberOfLines={1}>{rotuloDoMovimento(m)}</Text>
                <Text style={[s.movItemVal, { color: m.tipo === "sangria" ? Colors.red : Colors.green }]}>
                  {(m.tipo === "sangria" ? "− " : "+ ") + fmt(m.valor)}
                </Text>
                <Pressable onPress={() => handleDesfazerMovimento(m.id)} hitSlop={8} disabled={removendoMov === m.id} testID={"caixa-mov-desfazer-" + m.id}>
                  <Text style={[s.movDesfazer, removendoMov === m.id && { opacity: 0.5 }]}>desfazer</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
        <Text style={[s.sectionTitle, { marginTop: 12 }]}>Quanto contou no caixa físico?</Text>
        <View style={s.moneyInput}>
          <Text style={s.moneyPrefix}>R$</Text>
          <TextInput style={s.moneyField as any} value={dinheiroInput} onChangeText={setDinheiroInput}
            keyboardType="decimal-pad" placeholder="0,00" placeholderTextColor={Colors.ink3}
            autoFocus selectTextOnFocus />
        </View>
        {hasDigitedClose && (
          <View style={[s.diff, diferenca === 0 ? s.diffOk : diferenca > 0 ? s.diffUp : s.diffDown]}>
            <Icon name={diferenca === 0 ? "check" : diferenca > 0 ? "arrow_up" : "arrow_down"} size={12}
              color={diferenca === 0 ? Colors.green : diferenca > 0 ? "#a78bfa" : Colors.red} />
            <Text style={[s.diffTxt, { color: diferenca === 0 ? Colors.green : diferenca > 0 ? "#a78bfa" : Colors.red }]}>
              {diferenca === 0 ? "Caixa fechado exato"
                : diferenca > 0 ? "Sobra de " + fmt(diferenca)
                : "Falta de " + fmt(Math.abs(diferenca))}
            </Text>
          </View>
        )}
      </>
    );
    footerNode = (
      <>
        <Text style={s.footerTxt}>PASSO 1 DE 3</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable style={s.btnSec} onPress={handleCloseModal}>
            <Text style={s.btnSecTxt}>Cancelar</Text>
          </Pressable>
          <Pressable style={[s.btnPri, !hasDigitedClose && { opacity: 0.45 }]}
            onPress={() => hasDigitedClose && setCloseStep(2)} disabled={!hasDigitedClose}>
            <Text style={s.btnPriTxt}>Avancar -&gt;</Text>
          </Pressable>
        </View>
      </>
    );
  }

  if (mode === "fechar" && closeStep === 2) {
    bodyNode = (
      <>
        {diferenca !== 0 ? (
          <View style={[s.diff, diferenca > 0 ? s.diffUp : s.diffDown]}>
            <Icon name="alert" size={12} color={diferenca > 0 ? "#a78bfa" : Colors.red} />
            <Text style={[s.diffTxt, { color: diferenca > 0 ? "#a78bfa" : Colors.red }]}>
              Detectamos divergencia de {fmt(Math.abs(diferenca))} ({diferenca > 0 ? "sobra" : "falta"})
            </Text>
          </View>
        ) : null}
        <Text style={[s.sectionTitle, { marginTop: diferenca !== 0 ? 12 : 0 }]}>Quer registrar uma observação?</Text>
        <TextInput style={s.textArea as any} value={obsInput} onChangeText={setObsInput}
          placeholder="Ex: troco dado a mais na venda #00009" placeholderTextColor={Colors.ink3}
          multiline numberOfLines={3} />
        <Text style={s.helpTxt}>Quando ha divergencia, anotar o motivo ajuda a auditoria. Fica gravado no histórico e no PDF.</Text>
      </>
    );
    footerNode = (
      <>
        <Text style={s.footerTxt}>PASSO 2 DE 3 · opcional</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable style={s.btnSec} onPress={() => setCloseStep(1)}>
            <Text style={s.btnSecTxt}>&lt;- Voltar</Text>
          </Pressable>
          <Pressable style={s.btnPri} onPress={() => setCloseStep(3)}>
            <Text style={s.btnPriTxt}>Avancar -&gt;</Text>
          </Pressable>
        </View>
      </>
    );
  }

  if (mode === "fechar" && closeStep === 3 && sessaoEff) {
    bodyNode = (
      <>
        <Text style={s.sectionTitle}>Conferência de caixa</Text>
        <View style={s.summaryBox}>
          {suprimentos > 0 && (
            <View style={s.summaryRow}><Text style={s.summaryLab}>Reforços de troco</Text><Text style={[s.summaryVal, { color: Colors.green }]}>+ {fmt(suprimentos)}</Text></View>
          )}
          {sangrias > 0 && (
            <View style={s.summaryRow}><Text style={s.summaryLab}>Retiradas</Text><Text style={[s.summaryVal, { color: Colors.red }]}>− {fmt(sangrias)}</Text></View>
          )}
          <View style={s.summaryRow}><Text style={s.summaryLab}>Esperado em caixa</Text><Text style={s.summaryVal}>{fmt(dinheiroEsperado)}</Text></View>
          <View style={s.summaryRow}><Text style={s.summaryLab}>Contado em caixa</Text><Text style={s.summaryVal}>{fmt(dinheiroContado)}</Text></View>
          {obsInput.trim() ? (
            <View style={s.summaryRow}>
              <Text style={s.summaryLab}>Observação</Text>
              <Text style={[s.summaryVal, { fontStyle: "italic", color: Colors.ink3 }]} numberOfLines={1}>{obsInput.trim()}</Text>
            </View>
          ) : null}
        </View>
        <View style={[s.netBox,
          diferenca < 0 && { backgroundColor: "rgba(248,113,113,0.08)", borderColor: "rgba(248,113,113,0.25)" },
          diferenca > 0 && { backgroundColor: "rgba(124,58,237,0.07)", borderColor: "rgba(124,58,237,0.20)" },
          diferenca === 0 && { backgroundColor: "rgba(52,211,153,0.08)", borderColor: "rgba(52,211,153,0.25)" }]}>
          <Text style={s.netLab}>Diferenca</Text>
          <Text style={[s.netVal, { color: diferenca === 0 ? Colors.green : diferenca > 0 ? "#a78bfa" : Colors.red }]}>
            {diferenca === 0 ? "Exato" : (diferenca > 0 ? "+ " : "- ") + fmt(Math.abs(diferenca))}
          </Text>
        </View>
      </>
    );
    footerNode = (
      <>
        <Pressable style={s.btnSec} onPress={() => setCloseStep(2)}>
          <Text style={s.btnSecTxt}>&lt;- Voltar e recontar</Text>
        </Pressable>
        <Pressable style={[diferenca === 0 ? s.btnPri : s.btnDanger, submittingClose && { opacity: 0.6 }, { minWidth: 160 }]}
          onPress={handleFechar} disabled={submittingClose}>
          {submittingClose ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.btnPriTxt}>{diferenca === 0 ? "Fechar caixa" : "Selar caixa"}</Text>}
        </Pressable>
      </>
    );
  }

  if (mode === "fechar" && closeStep === 4 && closeResult) {
    bodyNode = (
      <>
        <View style={s.successHero}>
          <View style={s.successCheck}><Icon name="check" size={26} color={Colors.green} /></View>
          <Text style={s.successTitle}>Caixa fechado com sucesso</Text>
          <Text style={s.successSub}>
            {companyName} · {new Date(closeResult.closed_at || Date.now()).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </Text>
        </View>
        <View style={s.kpiGrid}>
          <View style={s.kpi}><Text style={s.kpiL}>Vendas</Text><Text style={[s.kpiV, { color: "#a78bfa" }]}>{resultSales}</Text></View>
          <View style={s.kpi}><Text style={s.kpiL}>Vendas do período</Text><Text style={[s.kpiV, { color: "#a78bfa" }]}>{fmt(resultVendas)}</Text></View>
          <View style={s.kpi}><Text style={s.kpiL}>Entradas no caixa</Text><Text style={[s.kpiV, { color: Colors.green }]}>{fmt(resultGeral)}</Text></View>
          <View style={s.kpi}>
            <Text style={s.kpiL}>Diferenca</Text>
            <Text style={[s.kpiV, { color: resultDiferenca === 0 ? Colors.green : resultDiferenca > 0 ? "#a78bfa" : Colors.red }]}>
              {resultDiferenca === 0 ? "Exato" : (resultDiferenca > 0 ? "+ " : "- ") + fmt(Math.abs(resultDiferenca))}
            </Text>
          </View>
        </View>
      </>
    );
    footerNode = (
      <>
        <Pressable style={s.btnSec} onPress={handleCloseModal}>
          <Text style={s.btnSecTxt}>Fechar</Text>
        </Pressable>
        <Pressable style={[s.btnPri, { minWidth: 200 }]} onPress={handleDownloadPdf}>
          <Icon name="download" size={13} color="#fff" />
          <Text style={[s.btnPriTxt, { marginLeft: 6 }]}>Baixar PDF de fechamento</Text>
        </Pressable>
      </>
    );
  }

  // 30/10/2026: o formulário de retirada/reforço toma o lugar do passo,
  // com o próprio rodapé. Vale só com o caixa aberto (mode fechar).
  if (mode === "fechar" && movimento && sessaoEff && !closeResult) {
    const ehSangria = movimento === "sangria";
    bodyNode = (
      <>
        <View style={s.infoStrip}>
          <Text style={s.infoStripTitle} testID="caixa-mov-em-caixa">{fmt(dinheiroEsperado)} em dinheiro na gaveta agora</Text>
          <Text style={s.infoStripSub}>
            {ehSangria
              ? "Retirada para depósito, pagamento ou troco de outro caixa. Sai do esperado do fechamento."
              : "Dinheiro que entra sem venda, como troco a mais. Soma no esperado do fechamento."}
          </Text>
        </View>
        <Text style={[s.sectionTitle, { marginTop: 12 }]}>{ehSangria ? "Quanto sai?" : "Quanto entra?"}</Text>
        <View style={s.moneyInput}>
          <Text style={s.moneyPrefix}>R$</Text>
          <TextInput testID="caixa-mov-valor" style={s.moneyField as any} value={movValorInput} onChangeText={setMovValorInput}
            keyboardType="decimal-pad" placeholder="0,00" placeholderTextColor={Colors.ink3}
            autoFocus selectTextOnFocus />
        </View>
        {movForaDoCaixa && (
          <Text style={s.movAviso} testID="caixa-mov-aviso">O caixa só tem {fmt(dinheiroEsperado)} em dinheiro.</Text>
        )}
        <Text style={[s.sectionTitle, { marginTop: 12 }]}>Motivo (opcional)</Text>
        <TextInput testID="caixa-mov-motivo" style={s.textArea as any} value={movMotivoInput} onChangeText={setMovMotivoInput}
          placeholder={ehSangria ? "ex: depósito no banco" : "ex: troco a mais"} placeholderTextColor={Colors.ink3} maxLength={200} />
      </>
    );
    footerNode = (
      <>
        <Pressable style={s.btnSec} onPress={() => setMovimento(null)} testID="caixa-mov-cancelar">
          <Text style={s.btnSecTxt}>Cancelar</Text>
        </Pressable>
        <Pressable testID="caixa-mov-confirmar" style={[s.btnPri, (!podeConfirmarMov || submittingMov) && { opacity: 0.45 }, { minWidth: 160 }]}
          onPress={handleRegistrarMovimento} disabled={!podeConfirmarMov || submittingMov}>
          {submittingMov ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.btnPriTxt}>{ehSangria ? "Confirmar retirada" : "Confirmar reforço"}</Text>}
        </Pressable>
      </>
    );
  }

  return (
    <View style={s.overlay}>
      <Pressable style={s.backdrop} onPress={handleCloseModal} />
      <View style={[s.panel, IS_WEB ? (panelWeb as any) : { backgroundColor: Colors.bg3 }]}>
        {/* Header */}
        <View style={s.header}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={[s.headerIco, { backgroundColor: headerBg }]}>
              <Icon name={headerIcon} size={15} color={headerColor} />
            </View>
            <Text style={s.headerTitle}>{headerTitle}</Text>
          </View>
          <Pressable onPress={handleCloseModal} style={s.closeBtn}>
            <Icon name="x" size={14} color={Colors.ink3} />
          </Pressable>
        </View>

        {/* Stepper — some no formulário de retirada/reforço: é ação, não passo. */}
        {!(mode === "fechar" && closeStep === 4) && !(mode === "fechar" && movimento) && (
          <View style={s.stepBar}>
            {(mode === "abrir" ? openLabels : closeLabels).map((label, idx) => {
              const n = idx + 1;
              const cur = mode === "abrir" ? openStep : closeStep;
              const done = cur > n;
              const active = cur === n;
              return (
                <View key={n} style={s.stepItem}>
                  <View style={[s.stepDot, done && s.stepDotDone, active && s.stepDotActive]}>
                    {done ? <Icon name="check" size={9} color="#fff" /> : <Text style={[s.stepDotTxt, active && { color: "#fff" }]}>{n}</Text>}
                  </View>
                  <Text style={[s.stepLabel, (active || done) && { color: active ? "#a78bfa" : Colors.ink3 }]}>{label}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Body — só conteúdo do step, rola se necessário */}
        <ScrollView
          style={s.body}
          contentContainerStyle={s.bodyContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {bodyNode}
        </ScrollView>

        {/* Footer sticky — botões Cancelar/Avançar/Confirmar/Fechar sempre visíveis */}
        {footerNode && (
          <View style={s.stickyFooter}>
            {footerNode}
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: {
    position: (IS_WEB ? "fixed" : "absolute") as any,
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 1000,
    alignItems: "center", justifyContent: "center",
    padding: 12,
  },
  backdrop: {
    position: "absolute" as any,
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  // maxHeight 92vh + flex column → body ScrollView ocupa o resto, footer sticky.
  panel: {
    width: "100%" as any,
    maxWidth: 580,
    maxHeight: "92vh" as any,
    borderRadius: 16,
    overflow: "hidden" as any,
    zIndex: 1,
    display: "flex" as any, flexDirection: "column" as any,
  },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: "rgba(124,58,237,0.15)",
  },
  headerIco: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  closeBtn: {
    width: 30, height: 30, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  stepBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingHorizontal: 16, paddingVertical: 10, gap: 14,
    borderBottomWidth: 1, borderBottomColor: "rgba(124,58,237,0.10)",
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

  body: { flexShrink: 1, flexGrow: 0 },
  bodyContent: { padding: 16, paddingBottom: 18, gap: 8 },

  // Footer sticky com borda superior — separa visualmente do body scrollável
  stickyFooter: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: "rgba(124,58,237,0.12)",
    backgroundColor: "rgba(124,58,237,0.04)",
  },

  sectionTitle: {
    fontSize: 11, fontWeight: "700", color: Colors.ink3,
    textTransform: "uppercase", letterSpacing: 1.1, marginBottom: 4,
  },
  helpTxt: { fontSize: 11, color: Colors.ink3, lineHeight: 15, marginTop: 4 },
  centered: { alignItems: "center", padding: 20 },
  emptyTxt: { fontSize: 12, color: Colors.ink3, textAlign: "center", paddingVertical: 14 },
  pickerItem: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 10, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
  },
  pickerItemSelected: {
    backgroundColor: "rgba(124,58,237,0.10)",
    borderColor: Colors.violet, borderLeftWidth: 3,
  },
  avatar: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: Colors.violet },
  avatarTxt: { fontSize: 11, fontWeight: "700", color: "#fff" },
  pickerName: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  pickerRole: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  permTag: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4,
    backgroundColor: "rgba(124,58,237,0.10)",
    borderWidth: 1, borderColor: "rgba(124,58,237,0.25)",
  },
  permTagTxt: { fontSize: 9, color: "#a78bfa", fontWeight: "700", letterSpacing: 0.4 },
  moneyInput: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "rgba(5,6,15,0.6)",
    borderWidth: 1, borderColor: "rgba(124,58,237,0.20)",
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10,
  },
  moneyPrefix: { fontSize: 16, color: Colors.ink3, fontWeight: "500" },
  moneyField: { flex: 1, color: Colors.ink, fontSize: 22, fontWeight: "700", letterSpacing: -0.3, outlineStyle: "none" } as any,
  textArea: {
    backgroundColor: "rgba(5,6,15,0.6)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10,
    color: Colors.ink, fontSize: 13, minHeight: 56, outlineStyle: "none",
  } as any,
  infoStrip: {
    padding: 10, borderRadius: 8,
    backgroundColor: "rgba(124,58,237,0.08)",
    borderLeftWidth: 3, borderLeftColor: Colors.violet,
  },
  infoStripTitle: { fontSize: 12, fontWeight: "600", color: Colors.ink },
  infoStripSub: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  summaryBox: {
    backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
  },
  summaryRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: "rgba(124,58,237,0.08)",
  },
  summaryLab: { fontSize: 12, color: Colors.ink3 },
  summaryVal: { fontSize: 12, color: Colors.ink, fontWeight: "600" },
  summaryValBold: { fontWeight: "700", color: "#a78bfa", fontSize: 13 },
  // 30/10/2026 — retirada/reforço (mockup docs/mockups/sangria-no-caixa.html)
  movAcoes: { flexDirection: "row", gap: 8, marginTop: 8 },
  movBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    height: 36, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.03)", borderWidth: 1, borderColor: "rgba(124,58,237,0.22)",
  },
  movBtnTxt: { fontSize: 12, fontWeight: "600", color: Colors.ink },
  movLista: { gap: 4, marginTop: 6 },
  movItem: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  movItemTxt: { flex: 1, fontSize: 11.5, color: Colors.ink2 },
  movItemVal: { fontSize: 11.5, fontWeight: "600" },
  movDesfazer: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.4, fontWeight: "700" },
  movAviso: { fontSize: 11, color: Colors.red, marginTop: 6 },
  netBox: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 12, borderRadius: 10,
    backgroundColor: "rgba(124,58,237,0.07)", borderWidth: 1, borderColor: "rgba(124,58,237,0.20)",
  },
  netLab: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  netVal: { fontSize: 17, fontWeight: "800" },
  diff: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9, borderWidth: 1,
  },
  diffOk: { backgroundColor: "rgba(52,211,153,0.10)", borderColor: "rgba(52,211,153,0.25)" },
  diffUp: { backgroundColor: "rgba(124,58,237,0.10)", borderColor: "rgba(124,58,237,0.25)" },
  diffDown: { backgroundColor: "rgba(248,113,113,0.10)", borderColor: "rgba(248,113,113,0.25)" },
  diffTxt: { fontSize: 12, fontWeight: "600" },

  footerTxt: { fontSize: 11, fontWeight: "600", color: Colors.ink3, letterSpacing: 0.3 },
  btnSec: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
  },
  btnSecTxt: { fontSize: 12, fontWeight: "600", color: Colors.ink },
  btnPri: {
    paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8,
    backgroundColor: Colors.violet,
    flexDirection: "row", alignItems: "center", justifyContent: "center", minWidth: 110,
  },
  btnPriTxt: { fontSize: 12, fontWeight: "700", color: "#fff" },
  btnDanger: {
    paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8,
    backgroundColor: Colors.red || "#ef4444",
    flexDirection: "row", alignItems: "center", justifyContent: "center", minWidth: 110,
  },
  successHero: {
    alignItems: "center", paddingVertical: 16, borderRadius: 12,
    backgroundColor: "rgba(52,211,153,0.06)", borderWidth: 1, borderColor: "rgba(52,211,153,0.18)",
  },
  successCheck: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: "rgba(52,211,153,0.14)",
    borderWidth: 2, borderColor: Colors.green,
    alignItems: "center", justifyContent: "center", marginBottom: 10,
  },
  successTitle: { fontSize: 16, fontWeight: "700", color: Colors.ink },
  successSub: { fontSize: 11, color: Colors.ink3, marginTop: 4 },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  kpi: {
    flexBasis: "48%" as any, flexGrow: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
    borderRadius: 10, padding: 10,
  },
  kpiL: { fontSize: 10, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  kpiV: { fontSize: 17, fontWeight: "700", color: Colors.ink, marginTop: 4, letterSpacing: -0.3 },
});

export default OpenCloseCashModal;
