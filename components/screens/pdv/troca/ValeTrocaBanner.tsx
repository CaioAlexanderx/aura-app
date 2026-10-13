// ============================================================
// AURA. — PDV · Troca · faixa "lido pelo vale-troca" (13/10/2026)
//
// Fica entre a barra de passos e o corpo do wizard, nos 4 passos: o lojista
// sempre vê de onde a venda veio e até quando vale. Prazo vencido AVISA e não
// trava — a decisão de aceitar a troca é dele.
// ============================================================
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { formatarDiaBR } from "@/utils/valeTroca";

export type ValeNoWizard = {
  saleId: string;
  /** "AAAA-MM-DD"; null = venda de fora da campanha (vale o prazo normal da loja). */
  prazoAte: string | null;
  vencido: boolean;
  /** Nome da filial quando a venda é de outra loja do grupo. */
  filial?: string | null;
};

type Props = {
  carregando: boolean;
  aviso: string | null;
  vale: ValeNoWizard | null;
};

export function ValeTrocaBanner({ carregando, aviso, vale }: Props) {
  if (carregando) {
    return (
      <View testID="vale-troca-carregando" style={[s.box, s.boxInfo]}>
        <ActivityIndicator size="small" color="#a78bfa" />
        <Text style={s.txtInfo}>Lendo o vale-troca…</Text>
      </View>
    );
  }
  if (aviso) {
    return (
      <View testID="vale-troca-aviso" style={[s.box, s.boxErro]}>
        <Icon name="alert-circle" size={15} color="#fca5a5" />
        <Text style={s.txtErro}>{aviso}</Text>
      </View>
    );
  }
  if (!vale) return null;

  const numero = "#" + vale.saleId.slice(0, 8).toUpperCase();
  const origem = "Lido pelo vale-troca · venda " + numero + (vale.filial ? " · " + vale.filial : "");
  if (vale.prazoAte && vale.vencido) {
    return (
      <View testID="vale-troca-vencido" style={[s.box, s.boxAlerta]}>
        <Icon name="alert-circle" size={15} color="#fbbf24" />
        <View style={{ flex: 1 }}>
          <Text style={s.txtAlerta}>{origem}</Text>
          <Text style={s.txtAlerta2}>
            O prazo do vale-troca terminou em {formatarDiaBR(vale.prazoAte)}. Você decide se aceita a troca.
          </Text>
        </View>
      </View>
    );
  }
  return (
    <View testID="vale-troca-lido" style={[s.box, s.boxOk]}>
      <Icon name="check" size={15} color="#6ee7b7" />
      <View style={{ flex: 1 }}>
        <Text style={s.txtOk}>{origem}</Text>
        <Text style={s.txtOk2}>
          {vale.prazoAte
            ? "Troca até " + formatarDiaBR(vale.prazoAte)
            : "Venda fora do período do vale-troca de fim de ano: vale o prazo normal da loja."}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  box: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 22, marginTop: 12,
    borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9,
  },
  boxInfo: { backgroundColor: "rgba(124,58,237,0.10)", borderColor: "rgba(124,58,237,0.3)" },
  boxOk: { backgroundColor: "rgba(16,185,129,0.12)", borderColor: "rgba(16,185,129,0.3)" },
  boxAlerta: { backgroundColor: "rgba(245,158,11,0.12)", borderColor: "rgba(245,158,11,0.4)" },
  boxErro: { backgroundColor: "rgba(239,68,68,0.10)", borderColor: "rgba(239,68,68,0.3)" },
  txtInfo: { color: Colors.ink2, fontSize: 12.5, fontWeight: "600" },
  txtOk: { color: "#6ee7b7", fontSize: 12.5, fontWeight: "700" },
  txtOk2: { color: Colors.ink2, fontSize: 12, marginTop: 1 },
  txtAlerta: { color: "#fbbf24", fontSize: 12.5, fontWeight: "700" },
  txtAlerta2: { color: Colors.ink2, fontSize: 12, marginTop: 1 },
  txtErro: { color: "#fca5a5", fontSize: 12.5, flex: 1 },
});

export default ValeTrocaBanner;
