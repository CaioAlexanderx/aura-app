// ============================================================
// AURA STUDIO · vitrine — frete estimado na página do produto
//
// O cliente só descobria o frete depois de configurar a peça, preencher
// nome, telefone e endereço. Quem vende personalizado para fora da cidade
// perde a venda exatamente aí: o cliente investe cinco minutos e desiste
// no número que aparece no fim.
//
// A rota de cotação já existe e é a MESMA que o checkout usa
// (/storefront/:slug/studio/shipping-quote). Aqui ela é só chamada mais
// cedo — que é onde a informação importa.
// ============================================================
import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, Platform } from "react-native";
import { T } from "./types";
import { wash, AURA } from "./theme";
import { BASE_URL } from "@/services/api";

/** Só os dígitos, no formato que a rota espera. */
export function cepLimpo(v: string): string {
  return String(v || "").replace(/\D/g, "").slice(0, 8);
}

/** 00000-000 enquanto a pessoa digita. */
export function mascaraCep(v: string): string {
  const d = cepLimpo(v);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export function cepCompleto(v: string): boolean {
  return cepLimpo(v).length === 8;
}

type Resultado = { fee: number; etaText?: string | null } | null;

export function FreteNoProduto({
  slug, corDaLoja,
}: {
  slug: string;
  corDaLoja?: string | null;
}) {
  const cor = corDaLoja || AURA.violet;
  const [cep, setCep] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [resultado, setResultado] = useState<Resultado>(null);
  const [erro, setErro] = useState<string | null>(null);

  const pronto = cepCompleto(cep);

  async function consultar() {
    if (!pronto || carregando) return;
    setCarregando(true);
    setErro(null);
    setResultado(null);
    try {
      const r = await fetch(
        `${BASE_URL}/storefront/${encodeURIComponent(slug)}/studio/shipping-quote?cep=${cepLimpo(cep)}`,
      );
      const j = await r.json();
      // A rota devolve 200 COM `error` no corpo para CEP inválido e fora
      // de área — checar só `r.ok` faria a tela anunciar "Entrega grátis"
      // para um CEP que ela recusou.
      if (!r.ok || j?.error || j?.fee == null) {
        // A mensagem da rota é escrita para o cliente ("Loja nao faz
        // entregas", "CEP invalido"), então vale mais que um genérico.
        setErro(j?.error || "Não consegui calcular agora.");
        return;
      }
      setResultado({ fee: Number(j.fee) || 0, etaText: j?.eta || null });
    } catch {
      setErro("Não consegui calcular agora. Tente de novo em instantes.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <View
      style={{
        borderWidth: 1, borderColor: wash(cor, 0.18), borderRadius: 12,
        padding: 12, gap: 9, backgroundColor: wash(cor, 0.04),
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase", color: T.ink3 }}>
        Quanto custa a entrega
      </Text>

      <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput
          value={cep}
          onChangeText={(v) => { setCep(mascaraCep(v)); setResultado(null); setErro(null); }}
          placeholder="Seu CEP"
          placeholderTextColor={T.ink3}
          keyboardType="numeric"
          inputMode="numeric"
          maxLength={9}
          accessibilityLabel="CEP para calcular a entrega"
          onSubmitEditing={consultar}
          style={{
            flex: 1, borderWidth: 1, borderColor: T.border, borderRadius: 9,
            paddingHorizontal: 11, paddingVertical: 9, fontSize: 14, color: T.ink,
            backgroundColor: T.card,
            ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
          }}
        />
        <Pressable
          onPress={consultar}
          disabled={!pronto || carregando}
          accessibilityRole="button"
          accessibilityLabel="Calcular a entrega"
          style={{
            paddingHorizontal: 16, justifyContent: "center", borderRadius: 9,
            backgroundColor: pronto ? cor : T.border,
            opacity: carregando ? 0.7 : 1,
          }}
        >
          {carregando
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={{ color: pronto ? "#fff" : T.ink3, fontWeight: "800", fontSize: 13 }}>Calcular</Text>}
        </Pressable>
      </View>

      {resultado ? (
        <Text style={{ fontSize: 13.5, color: T.ink }}>
          <Text style={{ fontWeight: "800", color: cor }}>
            {resultado.fee > 0 ? `R$ ${resultado.fee.toFixed(2).replace(".", ",")}` : "Entrega grátis"}
          </Text>
          {resultado.etaText ? <Text style={{ color: T.ink3 }}>{` · ${resultado.etaText}`}</Text> : null}
        </Text>
      ) : null}

      {erro ? <Text style={{ fontSize: 12.5, color: T.ink3 }}>{erro}</Text> : null}
    </View>
  );
}
