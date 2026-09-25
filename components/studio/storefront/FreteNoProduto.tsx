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
import { View, TextInput, Pressable, ActivityIndicator, Platform } from "react-native";
import { usePaletaDaVitrine, useTemaDaVitrine } from "./TemaDaVitrine";
import { wash, AURA } from "./theme";
import { enderecoDaApi } from "./enderecoDaApi";

import { Texto, Numero, useTipografia, estiloNumero } from "./TipografiaVitrine";
import { dinheiro } from "./moeda";
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

/**
 * A cotação pela MESMA rota do checkout, sem estado de tela. Separada do
 * componente para a página do produto nova (Fase 3) desenhar a entrega
 * do jeito dela — CEP, "Receber em casa" e "Retire na loja" na mesma
 * lista — sem uma segunda cópia da chamada.
 */
export async function cotarFrete(
  slug: string,
  cep: string,
): Promise<{ ok: true; fee: number; eta: string | null } | { ok: false; erro: string }> {
  try {
    const r = await fetch(
      `${enderecoDaApi()}/storefront/${encodeURIComponent(slug)}/studio/shipping-quote?cep=${cepLimpo(cep)}`,
    );
    const j = await r.json();
    // A rota devolve 200 COM `error` no corpo para CEP inválido e fora
    // de área — checar só `r.ok` faria a tela anunciar "Entrega grátis"
    // para um CEP que ela recusou.
    if (!r.ok || j?.error || j?.fee == null) {
      // A mensagem da rota é escrita para o cliente ("Loja nao faz
      // entregas", "CEP invalido"), então vale mais que um genérico.
      return { ok: false, erro: j?.error || "Não consegui calcular agora." };
    }
    return { ok: true, fee: Number(j.fee) || 0, eta: j?.eta || null };
  } catch {
    return { ok: false, erro: "Não consegui calcular agora. Tente de novo em instantes." };
  }
}

export function FreteNoProduto({
  slug, corDaLoja,
}: {
  slug: string;
  corDaLoja?: string | null;
}) {
  const T = usePaletaDaVitrine();
  const tipo = useTipografia();
  const tema = useTemaDaVitrine();
  // A cor crua so tinge o fundo e a borda do bloco (wash). O botao e o
  // valor usam o par legivel do tema: branco cravado sobre a cor da loja
  // sumia no "Calcular" de uma loja amarela.
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
    const r = await cotarFrete(slug, cep);
    if (r.ok) setResultado({ fee: r.fee, etaText: r.eta });
    else setErro(r.erro);
    setCarregando(false);
  }

  return (
    <View
      style={{
        borderWidth: 1, borderColor: wash(cor, 0.18), borderRadius: 12,
        padding: 12, gap: 9, backgroundColor: wash(cor, 0.04),
      }}
    >
      <Numero style={{ fontSize: 10.5, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase", color: T.ink3 }}>
        Quanto custa a entrega
      </Numero>

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
            ...estiloNumero(tipo),
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
            backgroundColor: pronto ? tema.marcaFill : T.border,
            minHeight: 44,
            opacity: carregando ? 0.7 : 1,
          }}
        >
          {carregando
            ? <ActivityIndicator size="small" color={tema.sobreMarca} />
            : <Texto style={{ color: pronto ? tema.sobreMarca : T.ink3, fontWeight: "800", fontSize: 13 }}>Calcular</Texto>}
        </Pressable>
      </View>

      {resultado ? (
        <Texto style={{ fontSize: 13.5, color: T.ink }}>
          <Numero style={{ fontWeight: "700", color: tema.marcaTexto }}>
            {resultado.fee > 0 ? `${dinheiro(resultado.fee)}` : "Entrega grátis"}
          </Numero>
          {resultado.etaText ? <Texto style={{ color: T.ink3 }}>{` · ${resultado.etaText}`}</Texto> : null}
        </Texto>
      ) : null}

      {erro ? <Texto style={{ fontSize: 12.5, color: T.ink3 }}>{erro}</Texto> : null}
    </View>
  );
}
