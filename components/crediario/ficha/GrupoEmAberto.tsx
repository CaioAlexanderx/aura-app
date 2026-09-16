// ============================================================
// AURA. — Ficha do crediário · saldo da cliente nas outras lojas do grupo
// 16/09/2026 (Davi Calçados / Mary Lucy)
//
// O cadastro é do dono; a dívida é da loja que vendeu. Sem esta faixa o
// lojista abre a ficha na Matriz, não vê o carnê da Villa Branca e acha que
// o sistema sumiu com parcelas. Cada loja recebe a própria dívida, então o
// botão leva até a outra loja em vez de receber daqui.
//
// Folha: a troca de loja chega por prop (o store de auth não carrega no Jest).
// ============================================================
import { View, Text, Pressable } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { fmt } from "./fichaHelpers";
import { nomeCurtoDaLoja, type GroupOpenItem } from "@/utils/creditoOutraLoja";

type Props = {
  name: string;
  lojas: GroupOpenItem[];
  storeName?: string | null;
  /** IDs das lojas que este usuário pode abrir. */
  acessiveis: Set<string>;
  onAbrirNaLoja?: (companyId: string) => void;
  abrindo?: boolean;
};

export function GrupoEmAberto({ name, lojas, storeName, acessiveis, onAbrirNaLoja, abrindo }: Props) {
  if (!lojas.length) return null;
  return (
    <View testID="grupo-em-aberto" style={{
      backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2,
      borderRadius: 11, padding: 12, marginBottom: 13, gap: 10,
    }}>
      {lojas.map((l) => {
        const curto = nomeCurtoDaLoja(l.company_name, storeName);
        const podeAbrir = !!onAbrirNaLoja && acessiveis.has(l.company_id);
        return (
          <View key={l.company_id} style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <Icon name="building" size={16} color={Colors.violet3} />
            <View style={{ flex: 1, minWidth: 180 }}>
              <Text style={{ fontSize: 12.5, color: Colors.ink, lineHeight: 18 }}>
                {name} também deve <Text style={{ fontWeight: "800" }}>{fmt(l.balance)}</Text> na{" "}
                <Text style={{ fontWeight: "700" }}>{l.company_name}</Text>.
              </Text>
              <Text style={{ fontSize: 11.5, color: Colors.ink3, lineHeight: 16, marginTop: 2 }}>
                {podeAbrir
                  ? "Cada loja recebe a própria dívida. Para dar baixa nessa, abra a ficha lá."
                  : "Cada loja recebe a própria dívida. A baixa dessa é feita por quem tem acesso àquela loja."}
              </Text>
            </View>
            {podeAbrir && (
              <Pressable
                testID={`abrir-na-loja-${l.company_id}`}
                onPress={() => onAbrirNaLoja!(l.company_id)}
                disabled={abrindo}
                style={{
                  flexDirection: "row", alignItems: "center", gap: 4,
                  paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9,
                  borderWidth: 1, borderColor: Colors.violet2, opacity: abrindo ? 0.5 : 1,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: Colors.violet3 }}>
                  {abrindo ? "Abrindo…" : `Abrir na ${curto}`}
                </Text>
                <Icon name="chevron_right" size={14} color={Colors.violet3} />
              </Pressable>
            )}
          </View>
        );
      })}
    </View>
  );
}
