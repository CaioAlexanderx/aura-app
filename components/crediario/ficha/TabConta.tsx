// ============================================================
// TabConta — Aura · Crediário (F3 do redesign; spec §2.3)
//
// De tabela uniforme de pares label/valor para 3 grupos com hierarquia:
//   Situação  — saldo HERÓI (24/800 colorido) + status
//   Limite    — barra de progresso usado/disponível (antes era só número)
//   Condições — texto compacto
// + "Ajustes deste cliente" (Collapsible): Termos personalizados e
//   Bloqueio manual migraram das abas próprias para cá (5 abas → 3).
//   Estado e handlers continuam no shell (ClienteCrediarioModal).
// ============================================================
import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, Switch, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { Icon } from "@/components/Icon";
import type { CreditAccount } from "@/services/creditApi";
import { Collapsible } from "@/components/anim";
import { fmt, fmtDate, periodLabel, scoreColor, scoreLabelPt } from "./fichaHelpers";
import { m } from "./fichaStyles";

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
};

export function TabConta({
  profile, isBlocked, scoreLabel, availableLimit, totalBalance,
  openInst, nextDueDate, hasTermsOverride, realCarnes, ajustes,
}: TabContaProps) {
  const [adjOpen, setAdjOpen] = useState(false);

  const creditLimit = profile?.credit_limit ?? 0;
  const creditUsed = profile?.credit_used ?? Math.max(0, creditLimit - (availableLimit ?? 0));
  const usedPct = creditLimit > 0 ? Math.max(0, Math.min(1, creditUsed / creditLimit)) : 0;
  const saldoColor = totalBalance < 0 ? Colors.green : totalBalance > 0 ? Colors.red : Colors.ink3;

  return (
<View>
  {/* ── Situação: saldo herói + status ── */}
  <View style={m.card}>
    <Text style={m.cardTitle}>Situação</Text>
    <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 10 }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[c.heroVal, { color: saldoColor }]} numberOfLines={1}>
          {fmt(Math.abs(totalBalance))}
        </Text>
        <Text style={c.heroSub}>
          {totalBalance < 0 ? "crédito a favor do cliente" : "em aberto"}
          {openInst.length > 0 ? ` · ${openInst.length} parcela${openInst.length !== 1 ? "s" : ""}` : ""}
          {openInst.length > 0 && fmtDate(nextDueDate) ? ` · próx. ${fmtDate(nextDueDate)}` : ""}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 6 }}>
        <View style={[m.pill, { backgroundColor: (isBlocked ? Colors.red : Colors.green) + "22" }]}>
          <Text style={[m.pillTxt, { color: isBlocked ? Colors.red : Colors.green }]}>
            {isBlocked ? "Bloqueado" : "Ativo"}
          </Text>
        </View>
        {!!profile && !!scoreLabel && (
          <View style={[m.scorePill, { backgroundColor: scoreColor(scoreLabel) + "22" }]}>
            <Text style={[m.scorePillTxt, { color: scoreColor(scoreLabel) }]}>
              Score {profile.credit_score} · {scoreLabelPt(scoreLabel)}
            </Text>
          </View>
        )}
      </View>
    </View>
    {isBlocked && !!profile?.blocked_reason && (
      <Text style={[c.heroSub, { marginTop: 8, color: Colors.red }]}>Motivo do bloqueio: {profile.blocked_reason}</Text>
    )}
  </View>

  {/* ── Limite: barra de progresso usado/disponível ── */}
  {!!profile && creditLimit > 0 && (
    <View style={m.card}>
      <Text style={m.cardTitle}>Limite</Text>
      <View style={c.limitTrack}>
        <View style={[c.limitFill, {
          width: (`${Math.round(usedPct * 100)}%` as any),
          backgroundColor: usedPct >= 1 ? Colors.red : usedPct > 0.75 ? Colors.amber : Colors.violet,
        }]} />
      </View>
      <Text style={c.limitTxt}>
        {fmt(creditUsed)} usados de {fmt(creditLimit)} ·{" "}
        <Text style={{ fontWeight: "800", color: (availableLimit ?? 0) >= 0 ? Colors.green : Colors.red }}>
          {fmt(Math.abs(availableLimit ?? 0))} {(availableLimit ?? 0) >= 0 ? "disponível" : "acima do limite"}
        </Text>
      </Text>
    </View>
  )}

  {/* ── Condições: compacto ── */}
  {!!profile?.terms?.effective && (
    <View style={m.card}>
      <View style={m.cardTitleRow}>
        <Text style={m.cardTitle}>Condições</Text>
        {hasTermsOverride && (
          <View style={[m.pill, { backgroundColor: Colors.violet3 + "22" }]}>
            <Text style={[m.pillTxt, { color: Colors.violet3 }]}>Personalizadas</Text>
          </View>
        )}
      </View>
      <Text style={c.condTxt}>
        Até {profile.terms.effective.max_installments}x ·{" "}
        {(profile.terms.effective.interest_rate * 100).toFixed(2).replace(".", ",")}% ao mês
        {profile.terms.effective.due_day != null ? ` · vencimento dia ${profile.terms.effective.due_day}` : ""}
      </Text>
    </View>
  )}

  {/* ── Carnês ── */}
  {realCarnes.length > 0 && (
    <View style={m.card}>
      <Text style={m.cardTitle}>Carnês</Text>
      {realCarnes.map(acc => (
        <View key={acc.id!} style={[m.row, { alignItems: "flex-start" }]}>
          <View>
            <Text style={m.rowK}>{acc.name}</Text>
            <Text style={[m.tlSub, { marginTop: 2 }]}>
              {acc.open_count} parcela{acc.open_count !== 1 ? "s" : ""} · {periodLabel(acc) || "—"}
            </Text>
          </View>
          <Text style={[m.rowV, { color: acc.balance > 0 ? Colors.red : Colors.ink3, fontSize: 15 }]}>
            {fmt(acc.balance)}
          </Text>
        </View>
      ))}
    </View>
  )}

  {/* ── Ajustes deste cliente (Termos + Bloqueio, colapsado) ── */}
  <View style={[m.card, { paddingBottom: adjOpen ? 14 : 8 }]}>
    <Pressable
      style={c.adjHead}
      onPress={() => setAdjOpen(v => !v)}
      accessibilityRole="button"
      accessibilityLabel={`Regras só para esta cliente. Toque para ${adjOpen ? "recolher" : "expandir"}`}
    >
      <View style={{ flex: 1 }}>
        <Text style={[m.cardTitle, { fontFamily: Fonts.body }]}>Regras só para esta cliente</Text>
        <Text style={[m.tlSub, { marginTop: 3, fontFamily: Fonts.body }]}>
          parcelas e juros{hasTermsOverride ? " •" : ""} · vendas a prazo{isBlocked ? " •" : ""}
        </Text>
      </View>
      <View style={adjOpen ? { transform: [{ rotate: "180deg" }] } : undefined}>
        <Icon name="chevron_down" size={15} color={adjOpen ? Colors.violet3 : Colors.ink3} />
      </View>
    </Pressable>

    <Collapsible open={adjOpen}>
      {/* Termos personalizados */}
      <View style={c.adjSection}>
        <Text style={[c.adjTitle, { fontFamily: Fonts.body }]}>Parcelas e juros</Text>
        <Text style={[m.termsHint, { fontFamily: Fonts.body }]}>
          Deixe em branco para usar a regra da loja.
        </Text>
        {!!profile?.terms?.effective && (
          <View style={m.termsEffRow}>
            <Text style={[m.termsEffLbl, { fontFamily: Fonts.body }]}>Valendo agora</Text>
            <Text style={m.termsEffVal}>
              {profile.terms.effective.max_installments}x ·{" "}
              {(profile.terms.effective.interest_rate * 100).toFixed(2).replace(".", ",")}% ao mês
            </Text>
          </View>
        )}
        <Text style={[m.fieldLabel, { marginTop: 14, fontFamily: Fonts.body }]}>Máximo de parcelas</Text>
        <TextInput
          style={m.termsInput}
          value={ajustes.termsMaxInst}
          placeholder={profile?.terms?.effective?.max_installments ? String(profile.terms.effective.max_installments) + " (padrão)" : "padrão"}
          placeholderTextColor={Colors.ink3}
          keyboardType="numeric"
          onChangeText={v => { ajustes.setTermsMaxInst(v.replace(/\D/g, "").slice(0, 3)); ajustes.setTermsDirty(true); }}
        />
        <Text style={[m.fieldLabel, { marginTop: 10 }]}>Juros ao mês (%)</Text>
        <TextInput
          style={m.termsInput}
          value={ajustes.termsInterest}
          placeholder={profile?.terms?.effective ? (profile.terms.effective.interest_rate * 100).toFixed(2).replace(".", ",") + " (padrão)" : "padrão"}
          placeholderTextColor={Colors.ink3}
          keyboardType="decimal-pad"
          onChangeText={v => { ajustes.setTermsInterest(v.replace(/[^\d,.]/g, "")); ajustes.setTermsDirty(true); }}
        />
        <Pressable
          style={[m.cta, { marginTop: 14 }, (!ajustes.termsDirty || ajustes.savingTerms) && { opacity: 0.45 }]}
          onPress={ajustes.saveTerms}
          disabled={!ajustes.termsDirty || ajustes.savingTerms}
        >
          {ajustes.savingTerms
            ? <ActivityIndicator color="#fff" />
            : <Text style={[m.ctaTxt, { fontFamily: Fonts.body }]}>Salvar regras</Text>}
        </Pressable>
      </View>

      {/* Bloqueio manual */}
      <View style={c.adjSection}>
        <Text style={[c.adjTitle, { fontFamily: Fonts.body }]}>Vendas a prazo</Text>
        <Text style={[m.termsHint, { fontFamily: Fonts.body }]}>
          Ao bloquear, ela não compra mais a prazo até você liberar de novo.
        </Text>
        <View style={[m.blockRow, { borderTopWidth: 0, paddingVertical: 4 }]}>
          <View style={{ flex: 1 }}>
            <Text style={[m.blockLabel, { fontFamily: Fonts.body }]}>{isBlocked ? "Bloqueadas para esta cliente" : "Liberadas para esta cliente"}</Text>
            {isBlocked && !!profile?.blocked_reason && (
              <Text style={m.blockReason}>Motivo: {profile.blocked_reason}</Text>
            )}
          </View>
          <Switch
            value={isBlocked}
            onValueChange={ajustes.handleBlockToggle}
            trackColor={{ false: Colors.bg4, true: Colors.red }}
            thumbColor="#fff"
            disabled={ajustes.blockPending}
          />
        </View>
        {ajustes.blockingAction === "block" && !isBlocked && (
          <>
            <Text style={[m.fieldLabel, { marginTop: 10 }]}>Motivo (opcional)</Text>
            <TextInput
              style={[m.termsInput, { minHeight: 72, textAlignVertical: "top" }]}
              value={ajustes.blockReason}
              onChangeText={ajustes.setBlockReason}
              placeholder="Ex: Inadimplência por 60+ dias"
              placeholderTextColor={Colors.ink3}
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
          </>
        )}
      </View>
    </Collapsible>
  </View>
</View>
  );
}

const c = StyleSheet.create({
  heroVal: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  heroSub: { fontSize: 12, color: Colors.ink3, marginTop: 3 },
  limitTrack: { height: 10, borderRadius: 999, backgroundColor: Colors.bg4, overflow: "hidden", marginTop: 2, marginBottom: 8 },
  limitFill: { height: "100%", borderRadius: 999 },
  limitTxt: { fontSize: 12, color: Colors.ink3 },
  condTxt: { fontSize: 13.5, color: Colors.ink2, fontWeight: "600" },
  adjHead: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4, minHeight: 40 },
  adjSection: { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 12, paddingTop: 12 },
  adjTitle: { fontSize: 13, fontWeight: "800", color: Colors.ink, marginBottom: 6 },
});
