// ============================================================
// AURA STUDIO · Página pública /acompanhar/[token]  (K3 — Quadro Vivo)
//
// O "pizza tracker" da encomenda. Quem abre é o CLIENTE FINAL, que não tem
// conta, chegou por um link no WhatsApp e provavelmente está no celular,
// no meio de outra coisa.
//
// Isso define tudo aqui:
//   • sem login, sem app, sem instrução — a tela se explica numa olhada
//   • uma coluna, texto grande, nada de densidade de dashboard
//   • ETAPAS, nunca horário. Previsão furada destrói mais confiança do que
//     a ausência dela (lição da própria indústria do pizza tracker)
//   • quando há saldo, o Pix está a um toque — cobrar sem constranger
//
// A rota é pública em app/_layout.tsx (segments[0] === "acompanhar") e a
// chamada usa skipAuth. O token é a credencial.
// ============================================================
import { useEffect, useState } from "react";
import { View, Text, Image, ScrollView, Pressable, ActivityIndicator, Platform } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { studioApi, type PublicTrack } from "@/services/studioApi";
import { copyToClipboard } from "@/utils/clipboard";

const money = (v: number) =>
  "R$ " + (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 'YYYY-MM-DD' → '22 de agosto'. Sem new Date(): data pura viraria UTC. */
function dataPorExtenso(iso?: string | null): string {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "";
  const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
                 "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  return `${d} de ${meses[m - 1]}`;
}

// Paleta local: a página é pública e não deve depender do tema do lojista
// nem do estado de auth. Clara, alto contraste, uma cor de destaque só.
const C = {
  bg: "#F7F6F9",
  card: "#FFFFFF",
  ink: "#1C1A23",
  ink2: "#56525F",
  ink3: "#8B8794",
  line: "#E6E3EC",
  accent: "#26335F",
  ok: "#1E7F4F",
  okBg: "#E4F3EA",
  warn: "#9A6A00",
  warnBg: "#FBF1DA",
};

export default function AcompanharEncomenda() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [dados, setDados] = useState<PublicTrack | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    if (!token) return;
    studioApi
      .getPublicTrack(String(token))
      .then((r) => setDados(r))
      .catch(() => setErro(true))
      .finally(() => setCarregando(false));
  }, [token]);

  // copyToClipboard é web-only e devolve false quando não consegue. Aí, em
  // vez de um botão morto, revelamos o código pra seleção manual — o cliente
  // precisa conseguir pagar de qualquer jeito.
  const [pixVisivel, setPixVisivel] = useState(false);
  async function copiarPix(pix: string) {
    const ok = await copyToClipboard(pix);
    if (ok) toast.success("Código Pix copiado");
    else setPixVisivel(true);
  }

  if (carregando) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={C.accent} />
      </View>
    );
  }

  // Link errado, expirado ou digitado à mão. Sem jargão e sem culpar o
  // cliente — só o caminho de volta.
  if (erro || !dados) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center", padding: 32 }}>
        <Text style={{ fontSize: 44 }}>🔍</Text>
        <Text style={{ fontSize: 19, fontWeight: "800", color: C.ink, marginTop: 12, textAlign: "center" }}>
          Não encontramos esta encomenda
        </Text>
        <Text style={{ fontSize: 15, color: C.ink2, marginTop: 8, textAlign: "center", maxWidth: 320, lineHeight: 21 }}>
          O link pode estar incompleto. Peça um novo para a loja pelo WhatsApp.
        </Text>
      </View>
    );
  }

  if (dados.cancelado) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center", padding: 32 }}>
        <Text style={{ fontSize: 19, fontWeight: "800", color: C.ink, textAlign: "center" }}>
          Pedido #{dados.pedido} cancelado
        </Text>
        <Text style={{ fontSize: 15, color: C.ink2, marginTop: 8, textAlign: "center", maxWidth: 320, lineHeight: 21 }}>
          Esta encomenda em {dados.loja || "a loja"} foi cancelada. Fale com a loja se tiver dúvida.
        </Text>
      </View>
    );
  }

  const etapas = dados.etapas || [];
  const atual = dados.etapa_atual ?? 0;
  const saldo = dados.saldo;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 20, paddingBottom: 48, maxWidth: 560, alignSelf: "center", width: "100%" }}>
      <Text style={{ fontSize: 13, color: C.ink3, fontWeight: "700", letterSpacing: 0.4 }}>
        {(dados.loja || "").toUpperCase()}
      </Text>
      <Text style={{ fontSize: 25, fontWeight: "800", color: C.ink, marginTop: 4 }}>
        Oi, {dados.cliente}!
      </Text>
      <Text style={{ fontSize: 15.5, color: C.ink2, marginTop: 4, lineHeight: 22 }}>
        {atual >= etapas.length - 1
          ? "Sua encomenda está pronta."
          : "Acompanhe sua encomenda por aqui."}
      </Text>

      {dados.imagem ? (
        <Image
          source={{ uri: dados.imagem }}
          style={{ width: "100%", aspectRatio: 16 / 10, borderRadius: 14, marginTop: 18, backgroundColor: C.line }}
          resizeMode="cover"
          accessibilityLabel="Sua encomenda"
        />
      ) : null}

      {/* Etapas — o coração da página. Sem horário, só o percurso. */}
      <View style={{ backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 20, marginTop: 18 }}>
        {etapas.map((e, i) => {
          const feito = i <= atual;
          const agora = i === atual;
          return (
            <View key={e.key} style={{ flexDirection: "row", gap: 14, alignItems: "flex-start" }}>
              <View style={{ alignItems: "center" }}>
                <View
                  style={{
                    width: 26, height: 26, borderRadius: 13,
                    backgroundColor: feito ? C.accent : C.bg,
                    borderWidth: feito ? 0 : 2, borderColor: C.line,
                    alignItems: "center", justifyContent: "center",
                  }}
                >
                  {feito ? <Icon name="checkmark" size={15} color="#fff" /> : null}
                </View>
                {i < etapas.length - 1 ? (
                  <View style={{ width: 2, height: 30, backgroundColor: i < atual ? C.accent : C.line }} />
                ) : null}
              </View>
              <View style={{ flex: 1, paddingBottom: i < etapas.length - 1 ? 8 : 0 }}>
                <Text style={{ fontSize: 16, fontWeight: agora ? "800" : "600", color: feito ? C.ink : C.ink3 }}>
                  {e.label}
                </Text>
                {agora ? (
                  <Text style={{ fontSize: 13.5, color: C.accent, fontWeight: "700", marginTop: 2 }}>
                    é onde estamos agora
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>

      {dados.entrega_combinada ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14, paddingHorizontal: 4 }}>
          <Icon name="calendar-outline" size={16} color={C.ink2} />
          <Text style={{ fontSize: 15, color: C.ink2 }}>
            Entrega combinada para <Text style={{ fontWeight: "800", color: C.ink }}>{dataPorExtenso(dados.entrega_combinada)}</Text>
          </Text>
        </View>
      ) : null}

      {/* Saldo — só aparece quando existe. Cobrança sem constrangimento: o
          valor, a data e o Pix a um toque. */}
      {saldo ? (
        <View style={{ backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 20, marginTop: 18 }}>
          <Text style={{ fontSize: 12.5, color: C.ink3, fontWeight: "700", letterSpacing: 0.4 }}>SALDO DA ENCOMENDA</Text>
          <Text style={{ fontSize: 28, fontWeight: "800", color: C.ink, marginTop: 6 }}>{money(saldo.valor)}</Text>
          <Text style={{ fontSize: 14.5, color: C.ink2, marginTop: 2 }}>
            {saldo.vencimento ? `para ${dataPorExtenso(saldo.vencimento)}` : ""}
          </Text>
          {saldo.pix ? (
            <>
              <Pressable
                onPress={() => copiarPix(saldo.pix as string)}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.accent, borderRadius: 12, paddingVertical: 14, marginTop: 16, ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}) }}
              >
                <Icon name="copy-outline" size={17} color="#fff" />
                <Text style={{ color: "#fff", fontSize: 15.5, fontWeight: "800" }}>Copiar código Pix</Text>
              </Pressable>
              <Text style={{ fontSize: 12.5, color: C.ink3, marginTop: 10, textAlign: "center", lineHeight: 18 }}>
                Cole no app do seu banco, na opção Pix copia e cola.
              </Text>
              {pixVisivel ? (
                <View style={{ marginTop: 12, padding: 12, backgroundColor: C.bg, borderRadius: 10, borderWidth: 1, borderColor: C.line }}>
                  <Text style={{ fontSize: 12, color: C.ink3, marginBottom: 6 }}>
                    Selecione e copie o código:
                  </Text>
                  <Text selectable style={{ fontSize: 12, color: C.ink, lineHeight: 17 }}>
                    {saldo.pix}
                  </Text>
                </View>
              ) : null}
            </>
          ) : (
            <Text style={{ fontSize: 13.5, color: C.ink2, marginTop: 12, lineHeight: 19 }}>
              Combine o pagamento com a loja pelo WhatsApp.
            </Text>
          )}
        </View>
      ) : null}

      {dados.itens && dados.itens.length > 0 ? (
        <View style={{ backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 20, marginTop: 18 }}>
          <Text style={{ fontSize: 12.5, color: C.ink3, fontWeight: "700", letterSpacing: 0.4 }}>SEU PEDIDO</Text>
          {dados.itens.map((it, i) => (
            <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, marginTop: 10 }}>
              <Text style={{ fontSize: 15, color: C.ink, flex: 1 }}>{it.nome}</Text>
              <Text style={{ fontSize: 15, color: C.ink2, fontWeight: "700" }}>{it.qtd}×</Text>
            </View>
          ))}
          {typeof dados.total === "number" ? (
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.line }}>
              <Text style={{ fontSize: 14.5, color: C.ink2 }}>Total</Text>
              <Text style={{ fontSize: 15.5, color: C.ink, fontWeight: "800" }}>{money(dados.total)}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <Text style={{ fontSize: 12, color: C.ink3, textAlign: "center", marginTop: 26 }}>
        Pedido #{dados.pedido} · feito com Aura Studio
      </Text>
    </ScrollView>
  );
}
