// AURA. — CriarLancamentoModal
// Lançar uma dívida manual no crediário: passo 1 escolhe/cria o cliente,
// passo 2 preenche valor, parcelas, vencimento e carnê; no sucesso, a tela
// Pronto oferece imprimir, mandar no WhatsApp ou lançar outro.
//
// Histórico do que continua valendo:
// 05/06/2026: data retroativa + periodicidade.
// F3 (05/06/2026): seletor de carnê (conta geral / carnê existente / novo).
// 10/10/2026 (carnês por compra, Aura-backend#803): o padrão é "Novo carnê" —
//   cada lançamento nasce como um carnê, igual à venda no Caixa. Manda
//   new_account: true; o nome é opcional (vazio, o backend nomeia
//   "Lançamento de DD/MM"). Backend antigo ignora new_account e o lançamento
//   cai na conta geral, que era o padrão de antes.
// feat(unify) (13/06/2026) + confirm-gate (04/08): unificar parcelas dentro de
//   "Carnê existente", com a confirmação vermelha antes de cancelar parcelas.
// Incidente Valen (13/08/2026): Idempotency-Key reaproveitada no retry.
// 12/10/2026 (relato de cliente): fora/Esc/voltar/X COM algo preenchido
//   abrem "Descartar este lançamento?" dentro do próprio modal; sem nada
//   preenchido fecha direto. Conta em utils/crediarioLancamento.ts.
//
// 12/10/2026 — redesenho (docs/mockups/crediario-lancamento-manual.html):
// este arquivo tinha 1.386 linhas e ~25 useState. Virou a casca: o
// ResponsiveSheet (maxWidth 480; no celular continua subindo como folha), o
// cabeçalho que conta a etapa ("Para quem?" → nome do cliente + "trocar"; os
// pontinhos de etapa e o chip do cliente com "x" saíram) e a confirmação de
// descarte. O formulário mora em lancamento/useLancamentoForm.ts (um
// useReducer), e as telas em lancamento/PassoCliente, PassoValores e
// TelaPronto. Os testIDs lancamento-* foram mantidos.
// ============================================================
import { useCallback, useRef, useEffect } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { ResponsiveSheet } from "@/components/ResponsiveSheet";
import { useLancamentoForm } from "@/components/crediario/lancamento/useLancamentoForm";
import { PassoCliente } from "@/components/crediario/lancamento/PassoCliente";
import { PassoValores } from "@/components/crediario/lancamento/PassoValores";
import { TelaPronto } from "@/components/crediario/lancamento/TelaPronto";
import type { RecenteDoLancamento } from "@/components/crediario/lancamento/calculos";

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Clientes da carteira para "Recentes" no passo 1 (até 5; ver
   *  calculos.escolherRecentes). Sem a prop, o passo 1 é só a busca. */
  recentes?: RecenteDoLancamento[];
}

export function CriarLancamentoModal({ visible, onClose, recentes }: Props) {
  const { company } = useAuthStore();
  const form = useLancamentoForm();
  const { st, set, reset, preenchido, trocarCliente } = form;
  const continuarRef = useRef<any>(null);

  // Fecha de verdade: zera o formulário e avisa o pai. Só o "Descartar", o
  // fechar sem nada preenchido e a tela Pronto chamam isto direto.
  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  // Fora, Esc/voltar e o X passam por aqui. Salvando, ignora: fechar no meio
  // do envio zeraria a Idempotency-Key e o retry duplicaria o lançamento.
  // Com a pergunta já aberta, novo fora/Esc vale como "continuar preenchendo".
  // Na tela Pronto já está tudo salvo: fecha direto.
  const pedirFechar = useCallback(() => {
    if (st.loading) return;
    if (st.step === "pronto") { handleClose(); return; }
    if (st.confirmarDescarte) { set({ confirmarDescarte: false }); return; }
    if (preenchido) { set({ confirmarDescarte: true }); return; }
    handleClose();
  }, [st.loading, st.step, st.confirmarDescarte, preenchido, handleClose, set]);

  // Foco padrão na opção segura (web): Enter/espaço não descarta por engano.
  useEffect(() => {
    if (!st.confirmarDescarte) return;
    try { continuarRef.current?.focus?.(); } catch { /* sem foco programático: ok */ }
  }, [st.confirmarDescarte]);

  const nomeDoCliente = st.selectedCustomer?.name || st.newName.trim() || "Novo cliente";

  return (
    <ResponsiveSheet visible={visible} onClose={pedirFechar} maxWidth={480} sheetStyle={{ backgroundColor: Colors.bg3 }}>
      <>
        {/* Cabeçalho: a etapa é o subtítulo */}
        <View style={s.header}>
          <View style={s.headerIcon}>
            <Icon name="receipt" size={18} color={Colors.violet3} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.headerTitle}>Novo lançamento</Text>
            {st.step === "customer" ? (
              <Text style={s.headerSub}>Para quem?</Text>
            ) : st.step === "pronto" ? (
              <Text style={s.headerSub} numberOfLines={1}>{st.resultado?.customerName || nomeDoCliente}</Text>
            ) : (
              <View style={s.headerSubRow}>
                <Text style={[s.headerSub, { flexShrink: 1 }]} numberOfLines={1}>{nomeDoCliente} · </Text>
                <Pressable
                  onPress={trocarCliente}
                  hitSlop={8}
                  testID="lancamento-trocar"
                  accessibilityRole="button"
                  accessibilityLabel="Trocar o cliente"
                >
                  <Text style={s.headerLnk}>trocar</Text>
                </Pressable>
              </View>
            )}
          </View>
          <Pressable onPress={pedirFechar} style={s.closeBtn} hitSlop={8} testID="lancamento-fechar" accessibilityRole="button" accessibilityLabel="Fechar">
            <Icon name="x" size={18} color={Colors.ink3} />
          </Pressable>
        </View>

        {st.step === "customer" && <PassoCliente form={form} recentes={recentes} />}
        {st.step === "details" && <PassoValores form={form} />}
        {st.step === "pronto" && st.resultado && (
          <TelaPronto
            companyId={company?.id}
            resumo={st.resultado}
            onLancarOutro={reset}
            onFechar={handleClose}
          />
        )}

        {/* Confirmação de descarte — dentro do próprio sheet (sem window.confirm).
            Desenho e tokens da saída do ItemFormModal (exitOverlay/exitCard). */}
        {st.confirmarDescarte && (
          <View style={s.exitOverlay} testID="lancamento-confirmar-descarte" accessibilityViewIsModal>
            <View style={s.exitCard}>
              <Text style={s.exitTitle}>Descartar este lançamento?</Text>
              <Text style={s.exitMsg}>
                Você já começou a preencher. Se fechar agora, o que foi digitado será perdido.
              </Text>
              <View style={s.exitActions}>
                <Pressable
                  ref={continuarRef}
                  testID="lancamento-continuar"
                  style={s.exitStay}
                  onPress={() => set({ confirmarDescarte: false })}
                  accessibilityRole="button"
                >
                  <Text style={s.exitStayTxt}>Continuar preenchendo</Text>
                </Pressable>
                <Pressable
                  testID="lancamento-descartar"
                  style={s.exitLeave}
                  onPress={handleClose}
                  accessibilityRole="button"
                >
                  <Text style={s.exitLeaveTxt}>Descartar</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </>
    </ResponsiveSheet>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: Colors.bg3,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.violetD,
    borderWidth: 1,
    borderColor: Colors.border2,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 16, fontWeight: "700", color: Colors.ink },
  headerSub:   { fontSize: 12.5, color: Colors.ink3, marginTop: 1 },
  headerSubRow: { flexDirection: "row", alignItems: "center", minWidth: 0 },
  headerLnk:   { fontSize: 12.5, fontWeight: "600", color: Colors.violet3, marginTop: 1 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.bg4,
    alignItems: "center",
    justifyContent: "center",
  },
  // ── Confirmação de descarte (12/10/2026) — mesmos tokens do exitCard do
  // ItemFormModal; botões empilhados e com 44px de altura mínima para caber
  // em 360px e ter alvo de toque decente (lá ficam lado a lado).
  exitOverlay: {
    position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center", justifyContent: "center", zIndex: 200, padding: 24,
  },
  exitCard: {
    width: "100%", maxWidth: 380, borderRadius: 16, padding: 22,
    backgroundColor: Colors.bg3, borderWidth: 1, borderColor: "rgba(124,58,237,0.25)",
  },
  exitTitle: { fontSize: 16, fontWeight: "700", color: Colors.ink, marginBottom: 8 },
  exitMsg: { fontSize: 13, color: Colors.ink2, lineHeight: 19, marginBottom: 18 },
  exitActions: { flexDirection: "column", gap: 10 },
  exitStay: {
    minHeight: 44, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
    backgroundColor: "rgba(124,58,237,0.18)", borderWidth: 1, borderColor: "rgba(124,58,237,0.4)",
  },
  exitStayTxt: { fontSize: 13, fontWeight: "700", color: Colors.violet3 },
  exitLeave: {
    minHeight: 44, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
    backgroundColor: "rgba(239,68,68,0.12)", borderWidth: 1, borderColor: "rgba(239,68,68,0.35)",
  },
  exitLeaveTxt: { fontSize: 13, fontWeight: "700", color: Colors.red },
});
