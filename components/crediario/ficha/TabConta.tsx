import { View, Text } from "react-native";
import { Colors } from "@/constants/colors";
import type { CreditAccount } from "@/services/creditApi";
import { fmt, fmtDate, periodLabel, scoreColor, scoreLabelPt } from "./fichaHelpers";
import { m } from "./fichaStyles";

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
};

export function TabConta({
  profile, isBlocked, scoreLabel, availableLimit, totalBalance,
  openInst, nextDueDate, hasTermsOverride, realCarnes,
}: TabContaProps) {
  return (
<View>
  <View style={m.card}>
    <Text style={m.cardTitle}>Status do crediário</Text>
    <View style={m.row}>
      <Text style={m.rowK}>Status</Text>
      <View style={[m.pill, { backgroundColor: (isBlocked ? Colors.red : Colors.green) + "22" }]}>
        <Text style={[m.pillTxt, { color: isBlocked ? Colors.red : Colors.green }]}>
          {isBlocked ? "Bloqueado" : "Ativo"}
        </Text>
      </View>
    </View>
    {isBlocked && !!profile?.blocked_reason && (
      <View style={m.row}>
        <Text style={m.rowK}>Motivo</Text>
        <Text style={[m.rowV, { fontSize: 13 }]}>{profile.blocked_reason}</Text>
      </View>
    )}
    {!!profile && (
      <>
        <View style={m.row}>
          <Text style={m.rowK}>Score</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={[m.rowV, { color: scoreColor(scoreLabel), fontSize: 15 }]}>
              {profile.credit_score}
            </Text>
            {!!scoreLabel && (
              <View style={[m.scorePill, { backgroundColor: scoreColor(scoreLabel) + "22" }]}>
                <Text style={[m.scorePillTxt, { color: scoreColor(scoreLabel) }]}>
                  {scoreLabelPt(scoreLabel)}
                </Text>
              </View>
            )}
          </View>
        </View>
        <View style={m.row}>
          <Text style={m.rowK}>Limite total</Text>
          <Text style={m.rowV}>{fmt(profile.credit_limit)}</Text>
        </View>
        {availableLimit !== undefined && (
          <View style={m.row}>
            <Text style={m.rowK}>Disponível</Text>
            <Text style={[m.rowV, { color: availableLimit >= 0 ? Colors.green : Colors.red }]}>
              {fmt(availableLimit)}
            </Text>
          </View>
        )}
        <View style={m.row}>
          <Text style={m.rowK}>Em aberto</Text>
          <Text style={[m.rowV, { color: totalBalance > 0 ? Colors.red : Colors.ink3 }]}>
            {fmt(totalBalance)}
          </Text>
        </View>
        <View style={m.row}>
          <Text style={m.rowK}>Parcelas abertas</Text>
          <Text style={m.rowV}>{openInst.length}</Text>
        </View>
        {openInst.length > 0 && (
          <View style={m.row}>
            <Text style={m.rowK}>Próx. vencimento</Text>
            <Text style={m.rowV}>{fmtDate(nextDueDate)}</Text>
          </View>
        )}
      </>
    )}
  </View>

  {!!profile?.terms?.effective && (
    <View style={m.card}>
      <Text style={m.cardTitle}>Termos efetivos</Text>
      <View style={m.row}>
        <Text style={m.rowK}>Máx. parcelas</Text>
        <Text style={m.rowV}>{profile.terms.effective.max_installments}x</Text>
      </View>
      <View style={m.row}>
        <Text style={m.rowK}>Juros a.m.</Text>
        <Text style={m.rowV}>{(profile.terms.effective.interest_rate * 100).toFixed(2).replace(".", ",")}%</Text>
      </View>
      {profile.terms.effective.due_day != null && (
        <View style={m.row}>
          <Text style={m.rowK}>Dia de venc.</Text>
          <Text style={m.rowV}>{profile.terms.effective.due_day}</Text>
        </View>
      )}
      {hasTermsOverride && (
        <View style={[m.pill, { backgroundColor: Colors.violet3 + "22", alignSelf: "flex-start" }]}>
          <Text style={[m.pillTxt, { color: Colors.violet3 }]}>Override ativo</Text>
        </View>
      )}
    </View>
  )}

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
</View>
  );
}
