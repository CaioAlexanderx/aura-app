// ============================================================
// AURA. — Cadastro do item · "Sai em" (10/11/2026, migration 442)
//
// Decisão do dono (aprovada sem mockup): a NOTA é separada do TIPO do
// item. Uma gráfica vende carimbo sob encomenda: é ISS (NFS-e), mas a
// mecânica do carimbo é peça que precisa de estoque. Duas opções:
//   "Cupom fiscal (NFC-e)" e "Nota de serviço (NFS-e)".
// A opção marcada de partida vem do tipo (produto → NFC-e, serviço →
// NFS-e). Produto com NFS-e mostra a seção "Nota de serviço (NFS-e)" e o
// estoque continua normal.
//
// Só aparece para quem emite NFS-e (hooks/useEmiteNfse.ts, o mesmo critério
// da seção NFS-e). Loja que não emite não vê o seletor, e nada muda.
// Regra da nota: utils/notaDoItem.ts.
// ============================================================
import { View, Text } from "react-native";
import { AJUDA_SAI_EM, ROTULO_NOTA, type NotaFiscal } from "@/utils/notaDoItem";
import { Nota, Radio, Secao, fr, s } from "./ui";

type Props = {
  /** A nota em que o item sai hoje (a escolha, ou o padrão do tipo). */
  nota: NotaFiscal;
  onNota: (n: NotaFiscal) => void;
};

export function SecaoSaiEm(p: Props) {
  return (
    <View testID="secao-sai-em">
      <Secao icon="receipt" titulo="Sai em">
        <View style={fr.radios}>
          <Radio
            testID="sai-em-nfce"
            ativo={p.nota === "nfce"}
            titulo={ROTULO_NOTA.nfce}
            onPress={() => p.onNota("nfce")}
          />
          <Radio
            testID="sai-em-nfse"
            ativo={p.nota === "nfse"}
            titulo={ROTULO_NOTA.nfse}
            onPress={() => p.onNota("nfse")}
          />
        </View>
        <View style={{ marginTop: 10 }}>
          <Nota icon="info">
            <Text style={s.notaTxt}>{AJUDA_SAI_EM}</Text>
          </Nota>
        </View>
      </Secao>
    </View>
  );
}
