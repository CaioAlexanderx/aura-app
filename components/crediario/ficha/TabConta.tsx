// ============================================================
// TabConta — Aura · Crediário · "Limite e regras"
//
// 23/11/2026 (F4 do redesenho da ficha, mockup aprovado — celular, "Limite e
// regras (pelo ⋯)"): a antiga aba Conta vira o painel "Limite e regras desta
// cliente", aberto pelo "⋯" do alto da ficha ou pelo "ver" do terceiro fato.
//  - saíram os cartões Situação e Carnês (repetiam o topo e as compras);
//  - Limite: "Usou R$ X de R$ Y. Pode comprar mais R$ Z." (ou "Esta cliente
//    não tem limite definido.");
//  - "Como ela costuma pagar": a frase do score e a nota — o único lugar da
//    ficha com o número (decisão 2 do Caio), com o que ela significa;
//  - "Regras só para esta cliente" e "Vendas a prazo" à vista (era sanfona).
// Estado e handlers continuam no shell (ClienteCrediarioModal).
// ============================================================
import { useEffect } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, Switch, StyleSheet, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import type { CreditAccount } from "@/services/creditApi";
import { fraseDoScore } from "@/utils/crediarioTresFatos";
import { fmt } from "./fichaHelpers";
import { m, CorDaFicha } from "./fichaStyles";

/** Props do bloco de Termos/Bloqueio — estado vive no shell. */
export type AjustesProps = {
  termsMaxInst: string;
  setTermsMaxInst: (v: string) => void;
  termsInterest: string;
  setTermsInterest: (v: string) => void;
  termsDirty: boolean;
  setTermsDirty: (v: boolean) => void;
  savingTerms: boolean;
  saveTerms: () => void;
  /** Erro ao salvar as regras, na tela. */
  erroTermos?: string | null;
  blockReason: string;
  setBlockReason: (v: string) => void;
  blockingAction: "block" | "unblock" | null;
  setBlockingAction: (v: "block" | "unblock" | null) => void;
  handleBlockToggle: () => void;
  confirmBlock: () => void;
  blockPending: boolean;
};

export type TabContaProps = {
  profile: any;
  isBlocked: boolean;
  scoreLabel: string | null;
  availableLimit: number | undefined;
  totalBalance: number;
  openInst: any[];
  nextDueDate: string;
  hasTermsOverride: boolean;
  realCarnes: CreditAccount[];
  ajustes: AjustesProps;
  /** Regra da LOJA (plan-config): o que vale quando o campo fica em branco. */
  regraDaLoja?: { max_installments: number | null; interest_rate: number | null } | null;
};

const pct = (taxa: number) => `${(taxa * 100).toFixed(2).replace(".", ",")}%`;

export function TabConta({
  profile, isBlocked, scoreLabel, availableLimit, ajustes, regraDaLoja,
}: TabContaProps) {
  const creditLimit = Number(profile?.credit_limit) || 0;
  const creditUsed = Number(profile?.credit_used ?? Math.max(0, creditLimit - (availableLimit ?? 0))) || 0;
  const usedPct = creditLimit > 0 ? Math.max(0, Math.min(1, creditUsed / creditLimit)) : 0;
  const passou = creditLimit > 0 ? +(creditUsed - creditLimit).toFixed(2) : 0;
  const disponivel = Math.max(0, availableLimit ?? (creditLimit - creditUsed));
  const frase = fraseDoScore(scoreLabel);
  const ov = profile?.terms?.overrides || {};
  const ef = profile?.terms?.effective;
  // QA 23/11 (P2): ao pedir o bloqueio, a tela rola até "Motivo / Confirmar
  // bloqueio" (ficava abaixo da dobra e parecia que nada tinha acontecido).
  const pedindoBloqueio = ajustes.blockingAction === "block" && !isBlocked;
  useEffect(() => {
    if (!pedindoBloqueio || Platform.OS !== "web" || typeof document === "undefined") return;
    const t = setTimeout(() => {
      try { (document.getElementById("limite-regras-motivo") as any)?.scrollIntoView?.({ block: "nearest", behavior: "smooth" }); } catch {}
    }, 50);
    return () => clearTimeout(t);
  }, [pedindoBloqueio]);
  // Valor da loja: plan-config; sem ele, o efetivo quando a cliente não tem
  // regra própria naquele campo (aí efetivo = loja).
  const lojaMax = regraDaLoja?.max_installments ?? (ov.max_installments == null ? ef?.max_installments : null);
  const lojaJuros = regraDaLoja?.interest_rate ?? (ov.interest_rate == null ? ef?.interest_rate : null);

  return (
<View>
  {/* ── Limite ── */}
  <View style={c.bloco} testID="limite-regras-limite">
    <Text style={c.rotulo}>Limite de compras a prazo</Text>
    {creditLimit > 0 ? (
      <>
        <View style={c.limitTrack}>
          <View style={[c.limitFill, {
            width: (`${Math.round(usedPct * 100)}%` as any),
            backgroundColor: usedPct >= 1 ? Colors.red : usedPct > 0.75 ? Colors.amber : Colors.violet,
          }]} />
        </View>
        <Text style={c.texto}>
          {`Usou ${fmt(creditUsed)} de ${fmt(creditLimit)}. `}
          {passou > 0.009
            ? <Text style={{ fontWeight: "800", color: Colors.red }}>{`Passou ${fmt(passou)} do limite.`}</Text>
            : <Text style={{ fontWeight: "800", color: Colors.green }}>{`Pode comprar mais ${fmt(disponivel)}.`}</Text>}
        </Text>
      </>
    ) : (
      <Text style={c.texto}>Sem limite definido para este cadastro.</Text>
    )}
  </View>

  {/* ── Score em frase + a nota (só aqui) ── */}
  {!!profile && (
    <View style={c.bloco} testID="limite-regras-score">
      <Text style={c.rotulo}>Como costuma pagar</Text>
      <View style={c.caixa}>
        {!!frase && <Text style={c.frase}>{frase}</Text>}
        <Text style={[c.texto, { marginTop: frase ? 4 : 0 }]}>
          A Aura olha os pagamentos deste cadastro e dá uma nota. A nota só avisa você: nunca impede a venda.
        </Text>
        {profile.credit_score != null && (
          <View style={c.par}>
            <Text style={c.parK}>Nota</Text>
            <Text style={c.parV}>{String(profile.credit_score)}</Text>
          </View>
        )}
      </View>
    </View>
  )}

  {/* ── Regras só para esta cliente (Termos) ── */}
  <View style={c.bloco}>
    <Text style={c.rotulo}>Regras só para este cadastro</Text>
    <View style={c.caixa}>
      {!!ef && (
        <>
          <View style={c.par}>
            <Text style={c.parK}>Máximo de parcelas</Text>
            <Text style={c.parV}>{`${ef.max_installments} ${ov.max_installments != null ? "(só deste cadastro)" : "(regra da loja)"}`}</Text>
          </View>
          <View style={c.par}>
            <Text style={c.parK}>Juros ao mês</Text>
            <Text style={c.parV}>{`${pct(ef.interest_rate)} ${ov.interest_rate != null ? "(só deste cadastro)" : "(regra da loja)"}`}</Text>
          </View>
        </>
      )}
      <Text style={[c.dica, { marginTop: ef ? 6 : 0 }]}>Deixe em branco para usar a regra da loja.</Text>
      <Text style={[m.fieldLabel, { marginTop: 12, fontFamily: Fonts.body }]}>Máximo de parcelas</Text>
      <TextInput
        style={m.termsInput}
        value={ajustes.termsMaxInst}
        placeholder={lojaMax != null ? `${lojaMax} (regra da loja)` : "regra da loja"}
        placeholderTextColor={CorDaFicha.secundario}
        keyboardType="numeric"
        onChangeText={v => { ajustes.setTermsMaxInst(v.replace(/\D/g, "").slice(0, 3)); ajustes.setTermsDirty(true); }}
      />
      <Text style={[m.fieldLabel, { marginTop: 10, fontFamily: Fonts.body }]}>Juros ao mês (%)</Text>
      <TextInput
        style={m.termsInput}
        value={ajustes.termsInterest}
        placeholder={lojaJuros != null ? `${(Number(lojaJuros) * 100).toFixed(2).replace(".", ",")} (regra da loja)` : "regra da loja"}
        placeholderTextColor={CorDaFicha.secundario}
        keyboardType="decimal-pad"
        onChangeText={v => { ajustes.setTermsInterest(v.replace(/[^\d,.]/g, "")); ajustes.setTermsDirty(true); }}
      />
      <Pressable
        style={[m.cta, { marginTop: 14 }, (!ajustes.termsDirty || ajustes.savingTerms) && { opacity: 0.45 }]}
        onPress={ajustes.saveTerms}
        disabled={!ajustes.termsDirty || ajustes.savingTerms}
        accessibilityRole="button"
      >
        {ajustes.savingTerms
          ? <ActivityIndicator color="#fff" />
          : <Text style={[m.ctaTxt, { fontFamily: Fonts.body }]}>Salvar regras</Text>}
      </Pressable>
      {!!ajustes.erroTermos && (
        <Text style={c.erro} testID="limite-regras-erro" accessibilityRole="alert">{ajustes.erroTermos}</Text>
      )}
    </View>
  </View>

  {/* ── Vendas a prazo (bloqueio manual) ── */}
  <View style={c.bloco}>
    <Text style={c.rotulo}>Vendas a prazo</Text>
    <View style={c.caixa}>
      <View style={[c.par, { alignItems: "center" }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={c.parK}>{isBlocked ? "Bloqueadas para este cadastro" : "Liberadas para este cadastro"}</Text>
          {isBlocked && !!profile?.blocked_reason && (
            <Text style={m.blockReason}>Motivo: {profile.blocked_reason}</Text>
          )}
        </View>
        {/* QA 23/11 (P2): ligado = vendas a prazo liberadas (o sentido
            que a frase ao lado diz). Antes ligado era "bloqueada". */}
        <Switch
          value={!isBlocked}
          onValueChange={ajustes.handleBlockToggle}
          trackColor={{ false: Colors.red, true: Colors.green }}
          thumbColor="#fff"
          disabled={ajustes.blockPending}
          accessibilityLabel={isBlocked ? "Vendas a prazo bloqueadas para este cadastro. Toque para liberar" : "Vendas a prazo liberadas para este cadastro. Toque para bloquear"}
          testID="limite-regras-vendas-a-prazo"
        />
      </View>
      <Text style={[c.dica, { marginTop: 6 }]}>
        Ao bloquear, este cadastro não compra mais a prazo até você liberar de novo.
      </Text>
      {pedindoBloqueio && (
        <View nativeID="limite-regras-motivo" testID="limite-regras-motivo">
          <Text style={[m.fieldLabel, { marginTop: 10 }]}>Motivo (opcional)</Text>
          <TextInput
            style={[m.termsInput, { minHeight: 72, textAlignVertical: "top" }]}
            value={ajustes.blockReason}
            onChangeText={ajustes.setBlockReason}
            placeholder="Ex: Inadimplência por 60+ dias"
            placeholderTextColor={CorDaFicha.secundario}
            multiline
          />
          <Pressable
            style={[m.cta, { marginTop: 12, backgroundColor: Colors.red }, ajustes.blockPending && { opacity: 0.5 }]}
            onPress={ajustes.confirmBlock}
            disabled={ajustes.blockPending}
          >
            {ajustes.blockPending
              ? <ActivityIndicator color="#fff" />
              : <Text style={m.ctaTxt}>Confirmar bloqueio</Text>}
          </Pressable>
          <Pressable
            style={[m.cta, { marginTop: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border }]}
            onPress={() => ajustes.setBlockingAction(null)}
          >
            <Text style={[m.ctaTxt, { color: Colors.ink2 }]}>Cancelar</Text>
          </Pressable>
        </View>
      )}
    </View>
  </View>
</View>
  );
}

const c = StyleSheet.create({
  bloco: { marginBottom: 16 },
  rotulo: { fontFamily: Fonts.body, fontSize: 12, fontWeight: "600", color: Colors.ink2, marginBottom: 6 },
  caixa: { borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg3, borderRadius: 11, padding: 12 },
  texto: { fontFamily: Fonts.body, fontSize: 12.5, color: Colors.ink2, lineHeight: 18 },
  frase: { fontFamily: Fonts.body, fontSize: 14, fontWeight: "700", color: Colors.ink },
  dica: { fontFamily: Fonts.body, fontSize: 12, color: CorDaFicha.secundario, lineHeight: 17 },
  erro: { fontFamily: Fonts.body, fontSize: 12.5, fontWeight: "600", color: Colors.red, marginTop: 8, lineHeight: 17 },
  par: { flexDirection: "row", justifyContent: "space-between", gap: 10, marginTop: 6 },
  parK: { fontFamily: Fonts.body, fontSize: 12.5, color: Colors.ink2 },
  parV: { fontFamily: Fonts.mono, fontSize: 12.5, color: Colors.ink, fontVariant: ["tabular-nums"] as any },
  limitTrack: { height: 8, borderRadius: 999, backgroundColor: Colors.bg4, overflow: "hidden", marginBottom: 8 },
  limitFill: { height: "100%", borderRadius: 999 },
});
