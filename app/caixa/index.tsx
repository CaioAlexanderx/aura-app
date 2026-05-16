import { useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  ActivityIndicator, TextInput, KeyboardAvoidingView, Platform,
} from "react-native";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { useCaixa } from "@/hooks/useCaixa";
import { caixaApi, type CaixaTotais } from "@/services/caixaApi";

// ── Helpers ───────────────────────────────────────────────────────────────

function fmt(value: number | null | undefined): string {
  if (value === null || value === undefined) return "R$ 0,00";
  return "R$ " + value.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR") + " às " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function parseMoeda(raw: string): number {
  const clean = raw.replace(/[^\d,]/g, "").replace(",", ".");
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}

// ── Sub-componentes ───────────────────────────────────────────────────────

function TotaisGrid({ totais, label }: { totais: CaixaTotais; label: string }) {
  const rows: [string, number][] = [
    ["Pix",           totais.pix],
    ["Dinheiro",      totais.dinheiro],
    ["Débito",        totais.cartao_debito],
    ["Crédito",       totais.cartao_credito],
    ["Fiado",         totais.fiado],
    ["Outros",        totais.outros],
  ];
  return (
    <View style={tg.card}>
      <Text style={tg.label}>{label}</Text>
      {rows.map(([name, val]) => (
        <View key={name} style={tg.row}>
          <Text style={tg.name}>{name}</Text>
          <Text style={[tg.value, val > 0 && tg.valueActive]}>{fmt(val)}</Text>
        </View>
      ))}
      <View style={tg.divider} />
      <View style={tg.row}>
        <Text style={tg.totalLabel}>Total geral</Text>
        <Text style={tg.totalValue}>{fmt(totais.geral)}</Text>
      </View>
    </View>
  );
}

const tg = StyleSheet.create({
  // 15/05/2026 (Davi): padding 16->12, gap 6->4 → economiza ~30px verticais
  // numa screen onde 6 linhas + total empilham. Em monitor 13/14 (1366×768)
  // a screen + fechamentoCard ultrapassava o fold mesmo com ScrollView.
  card:        { backgroundColor: Colors.bg3, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: Colors.border, gap: 4 },
  label:       { fontSize: 11, fontWeight: "700", color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 },
  row:         { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name:        { fontSize: 13, color: Colors.ink3 },
  value:       { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  valueActive: { color: Colors.ink },
  divider:     { height: 1, backgroundColor: Colors.border, marginVertical: 4 },
  totalLabel:  { fontSize: 14, color: Colors.ink, fontWeight: "700" },
  totalValue:  { fontSize: 14, color: Colors.violet3, fontWeight: "700" },
});

// ── Tela principal ────────────────────────────────────────────────────────

export default function CaixaScreen() {
  const { company } = useAuthStore();
  const { sessaoAtiva, isAberto, isLoading, isFetching, invalidate } = useCaixa();

  const [trocoInput, setTrocoInput] = useState("0,00");
  const [abrindo,    setAbrindo]    = useState(false);

  const [mostrando,       setMostrando]       = useState(false);
  const [dinheiroInput,   setDinheiroInput]   = useState("");
  const [obsInput,        setObsInput]        = useState("");
  const [fechando,        setFechando]        = useState(false);

  const handleAbrir = useCallback(async () => {
    if (!company?.id || abrindo) return;
    const troco = parseMoeda(trocoInput);
    setAbrindo(true);
    try {
      await caixaApi.abrir(company.id, troco);
      invalidate();
      toast.success("Caixa aberto!");
    } catch (err: any) {
      toast.error(err?.data?.error || "Erro ao abrir o caixa");
    } finally {
      setAbrindo(false);
    }
  }, [company?.id, trocoInput, abrindo, invalidate]);

  const handleFechar = useCallback(async () => {
    if (!company?.id || fechando) return;
    const dinheiro = parseMoeda(dinheiroInput);
    setFechando(true);
    try {
      await caixaApi.fechar(company.id, dinheiro, obsInput.trim() || undefined);
      invalidate();
      setMostrando(false);
      setDinheiroInput("");
      setObsInput("");
      toast.success("Caixa fechado com sucesso!");
    } catch (err: any) {
      toast.error(err?.data?.error || "Erro ao fechar o caixa");
    } finally {
      setFechando(false);
    }
  }, [company?.id, dinheiroInput, obsInput, fechando, invalidate]);

  if (isLoading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator color={Colors.violet3} size="large" />
        <Text style={s.loadingText}>Carregando...</Text>
      </View>
    );
  }

  const dinheiroContado = parseMoeda(dinheiroInput);
  const dinheiroEsperado = sessaoAtiva
    ? sessaoAtiva.troco_inicial + (sessaoAtiva.totais_ao_vivo?.dinheiro || 0)
    : 0;
  const diferenca = dinheiroInput ? dinheiroContado - dinheiroEsperado : null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView style={s.screen} contentContainerStyle={s.content}>

        {/* Header */}
        <View style={s.header}>
          <Pressable onPress={function() { router.back(); }} style={s.backBtn}>
            <Icon name="chevron_left" size={20} color={Colors.ink} />
          </Pressable>
          <Text style={s.headerTitle}>Caixa</Text>
          {isFetching && <ActivityIndicator color={Colors.violet3} size="small" />}
        </View>

        {/* ─── CAIXA FECHADO ─────────────────────────────── */}
        {!isAberto && (
          <>
            <View style={[s.statusCard, s.statusFechado]}>
              <View style={[s.statusDot, s.dotFechado]} />
              <View style={{ flex: 1 }}>
                <Text style={s.statusTitle}>Caixa fechado</Text>
                <Text style={s.statusDesc}>Informe o troco inicial para abrir</Text>
              </View>
            </View>

            <Text style={s.sectionLabel}>Troco inicial</Text>
            <View style={s.inputCard}>
              <Text style={s.inputPrefix}>R$</Text>
              <TextInput
                style={s.input}
                value={trocoInput}
                onChangeText={setTrocoInput}
                keyboardType="decimal-pad"
                placeholder="0,00"
                placeholderTextColor={Colors.ink3}
                selectTextOnFocus
              />
            </View>

            <Pressable
              onPress={handleAbrir}
              disabled={abrindo}
              style={[s.primaryBtn, abrindo && s.btnDisabled]}
            >
              {abrindo
                ? <ActivityIndicator color="#fff" size="small" />
                : <><Icon name="unlock" size={16} color="#fff" /><Text style={s.primaryBtnText}>Abrir Caixa</Text></>
              }
            </Pressable>
          </>
        )}

        {/* ─── CAIXA ABERTO ──────────────────────────────── */}
        {isAberto && sessaoAtiva && (
          <>
            <View style={[s.statusCard, s.statusAberto]}>
              <View style={[s.statusDot, s.dotAberto]} />
              <View style={{ flex: 1 }}>
                <Text style={[s.statusTitle, { color: Colors.green }]}>Caixa aberto</Text>
                <Text style={s.statusDesc}>
                  {fmtDate(sessaoAtiva.opened_at)} por {sessaoAtiva.opened_by.name}
                </Text>
                <Text style={s.statusDesc}>
                  Troco inicial: {fmt(sessaoAtiva.troco_inicial)}
                </Text>
              </View>
            </View>

            <TotaisGrid totais={sessaoAtiva.totais_ao_vivo} label="Totais ao vivo" />

            {!mostrando && (
              <Pressable onPress={function() { setMostrando(true); }} style={s.dangerBtn}>
                <Icon name="lock" size={16} color="#fff" />
                <Text style={s.primaryBtnText}>Fechar Caixa</Text>
              </Pressable>
            )}

            {mostrando && (
              <View style={s.fechamentoCard}>
                <Text style={s.fechamentoTitle}>Fechamento do caixa</Text>
                <Text style={s.fechamentoDesc}>
                  Conte o dinheiro físico e confirme o valor abaixo.
                </Text>

                <View style={s.confRow}>
                  <Text style={s.confLabel}>Esperado em dinheiro</Text>
                  <Text style={s.confValue}>{fmt(dinheiroEsperado)}</Text>
                </View>

                <Text style={s.inputLabel}>Dinheiro contado</Text>
                <View style={s.inputCard}>
                  <Text style={s.inputPrefix}>R$</Text>
                  <TextInput
                    style={s.input}
                    value={dinheiroInput}
                    onChangeText={setDinheiroInput}
                    keyboardType="decimal-pad"
                    placeholder="0,00"
                    placeholderTextColor={Colors.ink3}
                    autoFocus
                    selectTextOnFocus
                  />
                </View>

                {diferenca !== null && (
                  <View style={[s.diffBanner, diferenca === 0 && s.diffOk, diferenca < 0 && s.diffNeg]}>
                    <Icon
                      name={diferenca === 0 ? "check" : diferenca > 0 ? "arrow_up" : "arrow_down"}
                      size={14}
                      color={diferenca === 0 ? Colors.green : diferenca > 0 ? Colors.violet3 : Colors.red}
                    />
                    <Text style={[s.diffText,
                      diferenca === 0 && { color: Colors.green },
                      diferenca < 0 && { color: Colors.red },
                    ]}>
                      {diferenca === 0
                        ? "Caixa fechado exato"
                        : diferenca > 0
                          ? "Sobra de " + fmt(diferenca)
                          : "Falta de " + fmt(Math.abs(diferenca))}
                    </Text>
                  </View>
                )}

                <Text style={s.inputLabel}>Observação (opcional)</Text>
                <TextInput
                  style={s.obsInput}
                  value={obsInput}
                  onChangeText={setObsInput}
                  placeholder="Ex: Falta de R$ 5 — troco dado errado"
                  placeholderTextColor={Colors.ink3}
                  multiline
                  numberOfLines={2}
                />

                <View style={s.fechamentoBtns}>
                  <Pressable
                    onPress={function() { setMostrando(false); }}
                    style={s.cancelBtn}
                    disabled={fechando}
                  >
                    <Text style={s.cancelBtnText}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleFechar}
                    disabled={fechando || !dinheiroInput}
                    style={[s.dangerBtn, s.fecharConfirmBtn, (fechando || !dinheiroInput) && s.btnDisabled]}
                  >
                    {fechando
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={s.primaryBtnText}>Confirmar fechamento</Text>
                    }
                  </Pressable>
                </View>
              </View>
            )}
          </>
        )}

        {/* Link para histórico */}
        <Pressable onPress={function() { router.push("/caixa/historico"); }} style={s.histLink}>
          <Icon name="list" size={16} color={Colors.violet3} />
          <Text style={s.histLinkText}>Ver histórico de sessões</Text>
          <Icon name="chevron_right" size={14} color={Colors.ink3} />
        </Pressable>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen:    { flex: 1 },
  // 15/05/2026 (Davi 13/14"): paddingBottom 48 -> 100 pra limpar bottom
  // tab bar do Expo Router (que sobrepõe a ScrollView). Sem isso, o
  // histLink e o botão "Confirmar fechamento" sumiam embaixo da tab bar.
  // padding lateral 20 -> 16 + gap 12 -> 10 economizam espaço sem
  // prejudicar legibilidade.
  content:   { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100, maxWidth: 600, alignSelf: "center", width: "100%", gap: 10 },
  centered:  { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 13, color: Colors.ink3 },

  // Header
  header:      { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  backBtn:     { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: "700", color: Colors.ink, flex: 1 },

  // Status card — padding 16 -> 12
  statusCard:   { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: Colors.border },
  statusFechado:{ backgroundColor: Colors.bg3 },
  statusAberto: { backgroundColor: Colors.greenD + "22", borderColor: Colors.green + "44" },
  statusDot:    { width: 10, height: 10, borderRadius: 5 },
  dotFechado:   { backgroundColor: Colors.ink3 },
  dotAberto:    { backgroundColor: Colors.green },
  statusTitle:  { fontSize: 15, fontWeight: "700", color: Colors.ink },
  statusDesc:   { fontSize: 12, color: Colors.ink3, marginTop: 2 },

  sectionLabel: { fontSize: 12, fontWeight: "700", color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.8, marginTop: 4 },
  inputLabel:   { fontSize: 12, color: Colors.ink3, marginBottom: 4 },

  // Input — paddingVertical 12 -> 10
  inputCard:   { flexDirection: "row", alignItems: "center", backgroundColor: Colors.bg3, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 10, gap: 6 },
  inputPrefix: { fontSize: 16, color: Colors.ink3, fontWeight: "500" },
  input:       { flex: 1, fontSize: 20, color: Colors.ink, fontWeight: "700" },

  // Botões — paddingVertical 14 -> 12
  primaryBtn:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 12 },
  primaryBtnText:  { fontSize: 15, color: "#fff", fontWeight: "700" },
  dangerBtn:       { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.red || "#ef4444", borderRadius: 12, paddingVertical: 12 },
  cancelBtn:       { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg4, borderRadius: 12, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border },
  cancelBtnText:   { fontSize: 14, color: Colors.ink3, fontWeight: "600" },
  btnDisabled:     { opacity: 0.5 },

  // Fechamento — padding 16 -> 12, gap 10 -> 8
  fechamentoCard:  { backgroundColor: Colors.bg3, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: Colors.border, gap: 8 },
  fechamentoTitle: { fontSize: 15, fontWeight: "700", color: Colors.ink },
  fechamentoDesc:  { fontSize: 12, color: Colors.ink3, lineHeight: 17 },
  confRow:         { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  confLabel:       { fontSize: 13, color: Colors.ink3 },
  confValue:       { fontSize: 14, color: Colors.ink, fontWeight: "600" },
  diffBanner:      { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.violetD, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  diffOk:          { backgroundColor: Colors.greenD },
  diffNeg:         { backgroundColor: "#ef44440f" },
  diffText:        { fontSize: 13, fontWeight: "600", color: Colors.violet3 },
  obsInput:        { backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: Colors.ink, minHeight: 48 },
  fechamentoBtns:  { flexDirection: "row", gap: 10, marginTop: 4 },
  fecharConfirmBtn:{ flex: 2 },

  // Histórico — padding 14 -> 12
  histLink:     { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.bg3, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border, marginTop: 4 },
  histLinkText: { flex: 1, fontSize: 14, color: Colors.violet3, fontWeight: "600" },
});
