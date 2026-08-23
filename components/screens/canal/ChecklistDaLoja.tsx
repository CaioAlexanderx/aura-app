// ============================================================
// Canal digital · o que falta para a loja ficar bonita
//
// A aba Design tinha os controles mas nenhuma ORDEM: a lojista via cor,
// fonte, cartão, banner, avisos — todos no mesmo peso — e não tinha como
// saber que a foto do produto muda dez vezes mais a loja que a escolha
// da serifada.
//
// Este bloco põe os cinco itens em ordem de impacto, com estado e uma
// medida real ("12 de 30 com foto"). É a resposta à pergunta "o que o
// cliente precisa fazer para deixar a loja bonita".
// ============================================================
import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Icon } from "@/components/Icon";
import { useAccent } from "@/contexts/AccentTheme";
import { Colors } from "@/constants/colors";
import { montarChecklist, progresso, type EstadoDaLoja } from "./specsDeImagem";

export function ChecklistDaLoja({ estado }: { estado: EstadoDaLoja }) {
  const t = useAccent();
  const itens = montarChecklist(estado);
  const p = progresso(itens);
  const [aberto, setAberto] = useState<string | null>(
    // Abre no primeiro item pendente: é onde ela deve olhar.
    itens.find((i) => !i.feito)?.chave || null,
  );

  return (
    <View
      style={{
        borderRadius: 14,
        borderWidth: 1,
        borderColor: p.pct === 100 ? Colors.border : Colors.border2,
        backgroundColor: Colors.bg3,
        overflow: "hidden",
      }}
    >
      <View style={{ padding: 16, gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
          <Text style={{ fontSize: 14.5, fontWeight: "800", color: Colors.ink, flex: 1 }}>
            {p.pct === 100 ? "Sua loja está completa" : "Deixe sua loja pronta"}
          </Text>
          <Text
            style={{
              fontSize: 12, fontWeight: "700", color: t.primary,
              fontVariant: ["tabular-nums"],
            }}
          >
            {p.feitos} de {p.total}
          </Text>
        </View>

        {/* Barra de progresso: uma linha, sem número redundante. */}
        <View style={{ height: 5, borderRadius: 3, backgroundColor: Colors.bg4, overflow: "hidden" }}>
          <View style={{ width: `${p.pct}%`, height: "100%", backgroundColor: t.primary, borderRadius: 3 }} />
        </View>
      </View>

      <View style={{ borderTopWidth: 1, borderTopColor: Colors.border }}>
        {itens.map((item, i) => {
          const expandido = aberto === item.chave;
          return (
            <View
              key={item.chave}
              style={{ borderTopWidth: i === 0 ? 0 : 1, borderTopColor: Colors.border }}
            >
              <Pressable
                onPress={() => setAberto(expandido ? null : item.chave)}
                accessibilityRole="button"
                accessibilityState={{ expanded: expandido }}
                accessibilityLabel={`${item.titulo}. ${item.feito ? "Pronto" : "Pendente"}. ${item.acao}`}
                style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14 }}
              >
                {/* Estado em FORMA, não só em cor: círculo vazio contra
                    marca cheia lê no preto e branco e para quem não
                    distingue verde de cinza. */}
                <View
                  style={{
                    width: 18, height: 18, borderRadius: 9, marginTop: 1,
                    borderWidth: item.feito ? 0 : 1.5,
                    borderColor: Colors.ink3,
                    backgroundColor: item.feito ? Colors.green : "transparent",
                    alignItems: "center", justifyContent: "center",
                  }}
                >
                  {item.feito ? <Icon name="check" size={11} color="#fff" /> : null}
                </View>

                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                    <Text style={{ fontSize: 13.5, fontWeight: "700", color: Colors.ink }}>
                      {item.titulo}
                    </Text>
                    {item.medida ? (
                      <Text
                        style={{
                          fontSize: 11, color: item.feito ? Colors.ink3 : t.primary,
                          fontWeight: "700", fontVariant: ["tabular-nums"],
                        }}
                      >
                        {item.medida}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={{ fontSize: 12, color: Colors.ink3, lineHeight: 17 }}>
                    {item.acao}
                  </Text>
                </View>

                {item.spec ? (
                  <Icon name={expandido ? "chevron-up" : "chevron-down"} size={14} color={Colors.ink3} />
                ) : null}
              </Pressable>

              {expandido && item.spec ? (
                <View style={{ paddingHorizontal: 14, paddingBottom: 14, paddingLeft: 42, gap: 5 }}>
                  {item.spec.detalhes.map((linha, n) => (
                    <View key={n} style={{ flexDirection: "row", gap: 7 }}>
                      <Text style={{ color: t.primary, fontSize: 12, lineHeight: 17 }}>·</Text>
                      <Text style={{ flex: 1, fontSize: 12, color: Colors.ink2, lineHeight: 17 }}>
                        {linha}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}
