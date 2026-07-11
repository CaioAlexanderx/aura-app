// ============================================================
// AURA. — Botão "Ressincronizar assinatura" (Gestão Aura → Clientes)
//
// 11/07/2026: chama POST /admin/clients/:cid/resync-subscription
// (Aura-backend#358) — recalcula plano + R$19 × extra_seats_granted e faz o
// PUT na assinatura do Asaas, SEM alterar o count de seats.
//
// Por que existe: o sync do valor só rodava dentro do PATCH /extra-seats, que
// faz no-op quando o count não muda. Quando o sync falhava por motivo
// transitório (empresa 'cancelled', Asaas fora do ar), a única saída era salvar
// 0 e depois 1 de novo — o que dispara um PUT intermediário REMOVENDO o seat da
// assinatura. Caso real: Encanto Presentes, 11/07.
//
// Idempotente: se o valor no Asaas já bate, o backend responde
// skipped='value_unchanged' e nenhum PUT é feito.
// ============================================================

import { useMutation } from "@tanstack/react-query";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { adminApi } from "@/services/adminApi";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";

function fmtBrl(v: number) {
  return "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Traduz o billing_sync (contrato de services/seatSubscription.js) em texto humano.
// O service NUNCA lança: sempre volta { updated } ou { skipped: <motivo> }.
function describeSync(sync: any): { ok: boolean; msg: string } {
  if (!sync) return { ok: false, msg: "Backend não retornou billing_sync." };

  if (sync.updated) {
    var from = typeof sync.previousValue === "number" ? fmtBrl(sync.previousValue) + " → " : "";
    return { ok: true, msg: "Assinatura atualizada: " + from + fmtBrl(sync.value) + "/mês" };
  }

  switch (sync.skipped) {
    case "value_unchanged":
      return { ok: true, msg: "Assinatura já está no valor correto (" + fmtBrl(sync.value) + "/mês)." };
    case "cancelled":
      return { ok: false, msg: "Empresa está com billing cancelado — reative o billing antes de ressincronizar." };
    case "no_subscription":
      return { ok: false, msg: "Empresa não tem assinatura no Asaas (nunca fez checkout)." };
    case "invalid_plan":
      return { ok: false, msg: "Plano da empresa não tem preço definido." };
    case "fetch_failed":
      return { ok: false, msg: "Falha ao ler a assinatura no Asaas: " + (sync.error || "erro desconhecido") };
    case "error":
      return { ok: false, msg: "Erro ao sincronizar: " + (sync.error || "erro desconhecido") };
    default:
      if (typeof sync.skipped === "string" && sync.skipped.indexOf("subscription_") === 0) {
        return { ok: false, msg: "Assinatura no Asaas está " + sync.skipped.replace("subscription_", "").toUpperCase() + " — só ACTIVE aceita atualização de valor." };
      }
      return { ok: false, msg: "Sync não aplicado (" + String(sync.skipped) + ")." };
  }
}

type Props = {
  companyId: string;
  onDone?: () => void;
};

export function ResyncSubscriptionButton(props: Props) {
  var mutation = useMutation({
    mutationFn: function () {
      return adminApi.resyncSubscription(props.companyId, "resync manual via Gestão Aura");
    },
    onSuccess: function (res) {
      var d = describeSync(res.billing_sync);
      if (d.ok) toast.success(d.msg);
      else toast.error(d.msg);
      if (props.onDone) props.onDone();
    },
    onError: function () {
      toast.error("Falha ao ressincronizar assinatura.");
    },
  });

  var sync = mutation.data?.billing_sync as any;
  var result = mutation.isSuccess ? describeSync(sync) : null;

  return (
    <View style={s.wrap}>
      <Pressable
        onPress={function () { mutation.mutate(); }}
        disabled={mutation.isPending}
        style={[s.btn, mutation.isPending && { opacity: 0.6 }]}
      >
        {mutation.isPending
          ? <ActivityIndicator size="small" color={Colors.violet3} />
          : <Icon name="refresh" size={14} color={Colors.violet3} />}
        <Text style={s.btnTxt}>Ressincronizar assinatura</Text>
      </Pressable>

      <Text style={s.hint}>
        Recalcula plano + R$19 × acessos extras e atualiza a assinatura no Asaas.
        Não altera o número de acessos.
      </Text>

      {result && (
        <Text style={[s.result, result.ok ? s.resultOk : s.resultErr]}>{result.msg}</Text>
      )}
    </View>
  );
}

var s = StyleSheet.create({
  wrap: { marginTop: 12, gap: 6 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: Colors.violetD,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  btnTxt: { fontSize: 13, fontWeight: "600", color: Colors.violet3 },
  hint: { fontSize: 11, color: Colors.ink3, lineHeight: 15 },
  result: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  resultOk: { color: Colors.green },
  resultErr: { color: Colors.red },
});

export default ResyncSubscriptionButton;
