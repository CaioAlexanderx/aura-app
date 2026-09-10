// ============================================================
// AURA. — Cadastro de item (aberto) · seção "Preço" / "Preço e duração"
//
// Preço, custo e a margem ao vivo. Serviço ganha os chips de duração
// aqui mesmo (e não tem estoque nenhum depois desta seção).
// ============================================================
import { useState } from "react";
import { View, Text } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { maskCurrency } from "@/utils/masks";
import { Campo, Chip, Entrada, Secao, s } from "./ui";
import {
  calcMargem, valorDaMascara, fmtBRL, duracaoParaMinutos, minutosParaRotulo,
  statusPreco, DURATION_PRESET_MIN, DURATION_OTHER, type ItemType,
} from "./types";

type Props = {
  type: ItemType;
  narrow: boolean;
  preco: string; onPreco: (v: string) => void;
  custo: string; onCusto: (v: string) => void;
  duracao: string; onDuracao: (v: string) => void;
  onSubmit: () => void;
};

function CaixaDeMargem({ preco, custo, isProduto }: { preco: number; custo: number; isProduto: boolean }) {
  const m = calcMargem(preco, custo);
  if (m.estado === "off") {
    return (
      <View style={[st.margem, st.margemOff]}>
        <Icon name="info" size={14} color={Colors.ink3} />
        <Text style={st.margemTxtOff}>
          {m.motivo === "sem-preco"
            ? "Preencha o preço para ver a margem."
            : "Com o custo, mostramos a margem."}
        </Text>
      </View>
    );
  }
  if (m.estado === "neg") {
    return (
      <View style={[st.margem, st.margemNeg]}>
        <Icon name="alert" size={14} color={Colors.red} />
        <Text style={st.margemTxt}>
          Custo acima do preço: <Text style={{ color: Colors.red, fontWeight: "700" }}>
            {"prejuízo de " + fmtBRL(-m.lucro)}
          </Text>
        </Text>
      </View>
    );
  }
  return (
    <View style={st.margem}>
      <Icon name="check" size={14} color={Colors.green} />
      <Text style={st.margemTxt}>
        Margem <Text style={st.margemForte}>{m.pct + "%"}</Text> · lucro{" "}
        <Text style={st.margemForte}>{fmtBRL(m.lucro)}</Text> por {isProduto ? "un." : "atendimento"}
      </Text>
    </View>
  );
}

export function SecaoPreco({ type, narrow, preco, onPreco, custo, onCusto, duracao, onDuracao, onSubmit }: Props) {
  const isProduto = type === "product";
  const [mostrarOutra, setMostrarOutra] = useState(false);

  // A duração vira NÚMERO (migration 323). O chip acende pelos minutos,
  // não pelo texto: quem digita "1 hora" no campo livre vê o chip "1h"
  // acender, porque é a mesma coisa. Texto que não vira número mantém
  // todos apagados e ganha uma dica — nada é gravado torto.
  const minutos = duracaoParaMinutos(duracao);
  const ehPreset = minutos != null && DURATION_PRESET_MIN.indexOf(minutos) >= 0;
  const outraAtiva = mostrarOutra || (!!duracao.trim() && !ehPreset);
  const naoEntendi = !!duracao.trim() && minutos == null;

  return (
    <Secao icon="dollar" titulo={isProduto ? "Preço" : "Preço e duração"} selo={statusPreco(valorDaMascara(preco))}>
      <View style={[s.linha2, narrow && { flexDirection: "column", gap: 0 }]}>
        <Campo label="Preço de venda" required style={{ flex: 1 }}>
          <View style={st.prefixo}>
            <Text style={st.prefixoTxt}>R$</Text>
            <Entrada
              value={preco}
              onChangeText={(v: string) => onPreco(maskCurrency(v))}
              onSubmitEditing={onSubmit}
              placeholder="0,00"
              keyboardType="number-pad"
              style={{ paddingLeft: 34 }}
            />
          </View>
        </Campo>
        <Campo label="Custo" optional="opcional" style={{ flex: 1 }}>
          <View style={st.prefixo}>
            <Text style={st.prefixoTxt}>R$</Text>
            <Entrada
              value={custo}
              onChangeText={(v: string) => onCusto(maskCurrency(v))}
              onSubmitEditing={onSubmit}
              placeholder="0,00"
              keyboardType="number-pad"
              style={{ paddingLeft: 34 }}
            />
          </View>
        </Campo>
      </View>

      <CaixaDeMargem preco={valorDaMascara(preco)} custo={valorDaMascara(custo)} isProduto={isProduto} />

      {!isProduto && (
        <Campo label="Duração estimada" optional="opcional" style={{ marginTop: 10, marginBottom: 0 }}>
          <View style={s.chips}>
            {DURATION_PRESET_MIN.map((m) => (
              <Chip
                key={m}
                label={minutosParaRotulo(m)}
                active={minutos === m}
                onPress={() => {
                  setMostrarOutra(false);
                  onDuracao(minutos === m ? "" : minutosParaRotulo(m));
                }}
              />
            ))}
            <Chip
              label={DURATION_OTHER}
              active={outraAtiva}
              onPress={() => { setMostrarOutra(true); if (ehPreset) onDuracao(""); }}
            />
          </View>
          {outraAtiva && (
            <Entrada
              value={mostrarOutra || !ehPreset ? duracao : ""}
              onChangeText={onDuracao}
              onSubmitEditing={onSubmit}
              placeholder="Ex.: 20 min, 3h, 1h30"
              style={{ marginTop: 8 }}
            />
          )}
          <Text style={s.hint}>
            {naoEntendi ? (
              <Text style={{ color: Colors.amber, fontWeight: "700" }}>
                Não entendi essa duração. Escreva como 20 min, 1h ou 1h30 — a agenda precisa do número.
              </Text>
            ) : (
              "Ajuda na agenda e aparece na página do serviço. Serviços não têm estoque."
            )}
          </Text>
        </Campo>
      )}
    </Secao>
  );
}

const st = {
  prefixo: { position: "relative" as any, justifyContent: "center" as const },
  prefixoTxt: {
    position: "absolute" as any, left: 12, zIndex: 2,
    fontSize: 12.5, color: Colors.ink3, fontWeight: "700" as const,
  },
  margem: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 10,
    backgroundColor: Colors.greenD, borderWidth: 1, borderColor: "rgba(52,211,153,0.3)",
    borderRadius: 9, paddingHorizontal: 11, paddingVertical: 8, marginTop: -2,
  },
  margemOff: { backgroundColor: Colors.bg3, borderColor: Colors.border },
  margemNeg: { backgroundColor: Colors.redD, borderColor: "rgba(248,113,113,0.35)" },
  margemTxt: { fontSize: 12, color: Colors.ink2, flex: 1, lineHeight: 17 },
  margemTxtOff: { fontSize: 12, color: Colors.ink3, flex: 1, lineHeight: 17 },
  margemForte: { color: Colors.green, fontWeight: "700" as const },
};

export default SecaoPreco;
