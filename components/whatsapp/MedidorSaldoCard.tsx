// ============================================================
// MedidorSaldoCard — o medidor do topo da aba Configurações
//
// Três saldos (novidades, avisos e cobranças, Aurinha), cada um com o que
// resta do total. Quem decide é o servidor; aqui só se LÊ e se explica:
//   - "Faltam N" quando restam 20% ou menos (uma vez por saldo, sem alarde);
//   - o texto de esgotado, com "Voltam em 1º de <mês>" nas novidades;
//   - Essencial no presente de boas-vindas: "não renova"; a oferta de
//     R$ 29/mês só aparece quando o presente acaba, numa linha ao lado do
//     "WhatsApp do celular";
//   - número em atenção: as novidades param, avisos e cobranças seguem.
// Saldo que não deu para ler = aviso de bloqueio, nunca número inventado.
// ============================================================
import React from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import type { WaStatus } from "@/services/waApi";
import {
  TEXTO_NUMERO_EM_ATENCAO, TEXTO_OFERTA_ESSENCIAL, waNumeroEmAtencao,
  type Balde, type SaldoInfo,
} from "./waSaldo";

interface Props {
  saldo: SaldoInfo | null;
  carregando: boolean;
  falhou: boolean;
  status: WaStatus | null;
  onRetry: () => void;
}

const COR_BALDE: Record<Balde["key"], string> = {
  novidades: Colors.violet3,
  avisos: Colors.green,
  aurinha: Colors.amber,
};

function BaldeView({ b }: { b: Balde }) {
  const cor = b.esgotado ? Colors.red : b.acabando ? Colors.amber : COR_BALDE[b.key];
  return (
    <View style={s.balde} testID={`wa-saldo-${b.key}`}>
      <Text style={s.baldeRotulo}>{b.rotulo}</Text>
      <Text style={s.baldeLivres} testID={`wa-saldo-${b.key}-livres`}>{b.livres}</Text>
      <View style={s.barra} accessibilityLabel={`${b.rotulo}: ${b.livres}`}>
        <View style={[s.barraFill, { width: `${Math.round((1 - b.gasto) * 100)}%`, backgroundColor: cor }]} />
      </View>
      {!!b.faltam && <Text style={s.faltam} testID={`wa-saldo-${b.key}-faltam`}>{b.faltam}</Text>}
    </View>
  );
}

export function MedidorSaldoCard({ saldo, carregando, falhou, status, onRetry }: Props) {
  if (carregando && !saldo) {
    return (
      <View style={s.card} testID="wa-saldo-carregando">
        <ActivityIndicator size="small" color={Colors.violet3} />
      </View>
    );
  }

  if (!saldo) {
    // Dúvida bloqueia: sem saldo lido, nada que gasta mensagem fica ativo.
    return (
      <View style={s.card} testID="wa-saldo-indisponivel">
        <View style={s.linhaAviso}>
          <Icon name="alert" size={13} color={Colors.amber} />
          <Text style={s.avisoTxt}>
            Não consegui ler o saldo de mensagens agora. Por segurança, os envios que gastam
            mensagem ficam travados até eu conseguir.
          </Text>
        </View>
        {falhou && (
          <Pressable onPress={onRetry} accessibilityRole="button" style={s.btnLink} testID="wa-saldo-tentar-de-novo">
            <Text style={s.btnLinkTxt}>Tentar de novo</Text>
          </Pressable>
        )}
      </View>
    );
  }

  const esgotados = saldo.baldes.filter((b) => b.esgotado && b.textoEsgotado);
  const atencao = waNumeroEmAtencao(status);

  return (
    <View style={s.card} testID="wa-saldo-medidor">
      <Text style={s.titulo}>Mensagens de {saldo.mesNome}</Text>
      {!!saldo.textoPresente && (
        <Text style={s.presente} testID="wa-saldo-presente">{saldo.textoPresente}</Text>
      )}

      <View style={s.baldes}>
        {saldo.baldes.map((b) => <BaldeView key={b.key} b={b} />)}
      </View>

      {esgotados.map((b) => (
        <View key={b.key} style={s.linhaAviso} testID={`wa-saldo-${b.key}-esgotado`}>
          <Icon name="alert" size={13} color={Colors.red} />
          <Text style={[s.avisoTxt, { color: Colors.red }]}>
            {b.textoEsgotado}
            {b.key === "avisos" ? ' As cobranças viram "Cobrar pelo meu WhatsApp".' : ""}
          </Text>
        </View>
      ))}

      {saldo.mostrarOferta && (
        <Text style={s.oferta} testID="wa-saldo-oferta">{TEXTO_OFERTA_ESSENCIAL}</Text>
      )}

      {atencao && (
        <View style={s.linhaAviso} testID="wa-saldo-numero-em-atencao">
          <Icon name="alert" size={13} color={Colors.amber} />
          <Text style={s.avisoTxt}>{TEXTO_NUMERO_EM_ATENCAO}</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, gap: 10 },
  titulo: { fontSize: 14, fontWeight: "800", color: Colors.ink },
  presente: { fontSize: 12, fontWeight: "600", color: Colors.violet3, lineHeight: 17 },
  baldes: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  balde: {
    flexGrow: 1, flexBasis: 160, backgroundColor: Colors.bg2, borderWidth: 1, borderColor: Colors.border2,
    borderRadius: 11, paddingVertical: 10, paddingHorizontal: 13, gap: 4,
  },
  baldeRotulo: { fontSize: 11.5, fontWeight: "700", color: Colors.ink2 },
  baldeLivres: { fontSize: 15, fontWeight: "800", color: Colors.ink },
  barra: { height: 6, borderRadius: 999, backgroundColor: Colors.bg4, overflow: "hidden" },
  barraFill: { height: 6, borderRadius: 999 },
  faltam: { fontSize: 11.5, fontWeight: "700", color: Colors.amber },
  linhaAviso: { flexDirection: "row", alignItems: "flex-start", gap: 7 },
  avisoTxt: { flex: 1, fontSize: 12, fontWeight: "600", color: Colors.amber, lineHeight: 17 },
  oferta: { fontSize: 12, fontWeight: "600", color: Colors.ink2, lineHeight: 17 },
  btnLink: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
  btnLinkTxt: { fontSize: 12.5, fontWeight: "700", color: Colors.violet3 },
} as any);
