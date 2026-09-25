// ============================================================
// components/studio/storefront/produto/EntregaNoProduto.tsx
//
// Tela 6 do mockup: quanto custa receber — ou que dá para buscar de
// graça — ANTES do checkout. "Retire na loja · <bairro> · Grátis" fica
// sempre à vista quando a loja tem retirada; "Receber em casa" aparece
// depois do CEP. A cotação é a mesma rota do checkout (cotarFrete, de
// FreteNoProduto.tsx), e o CEP calculado segue para o checkout.
// ============================================================
import { useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, TextInput, View } from "react-native";
import { useTemaDaVitrine } from "../TemaDaVitrine";
import { Texto, Numero, useTipografia, estiloNumero } from "../TipografiaVitrine";
import { Icon } from "@/components/Icon";
import { dinheiro } from "../moeda";
import { cepCompleto, cepLimpo, cotarFrete, mascaraCep } from "../FreteNoProduto";
import { enderecoDeRetirada } from "./regrasDaPagina";
import { Botao, borda2 } from "./kitDaPagina";
import { wash } from "../theme";

const BUSCA_CEP = "https://buscacepinter.correios.com.br/app/endereco/index.php";

export function EntregaNoProduto({
  slug, entrega, endereco, cepInicial, onCep,
}: {
  slug: string;
  entrega: {
    pickup_enabled?: boolean; delivery_enabled?: boolean; courier_pickup_enabled?: boolean;
    pickup_eta_text?: string | null;
  } | null | undefined;
  /** `site.endereco` da loja ("Av Dom Pedro I, 553 - Jardim Colonial"). */
  endereco: string | null | undefined;
  cepInicial?: string;
  /** O CEP que deu certo vai para o checkout (sf.setAddressZip). */
  onCep?: (cep: string) => void;
}) {
  const t = useTemaDaVitrine();
  const par = useTipografia();
  const [cep, setCep] = useState(mascaraCep(cepInicial || ""));
  const [carregando, setCarregando] = useState(false);
  const [resultado, setResultado] = useState<{ fee: number; eta: string | null } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const entrega_ = entrega || {};
  const temEntrega = entrega_.delivery_enabled === true;
  const temRetirada = entrega_.pickup_enabled !== false;
  const temApp = entrega_.courier_pickup_enabled === true;
  const ret = enderecoDeRetirada(endereco);

  async function calcular() {
    if (carregando) return;
    const d = cepLimpo(cep);
    if (!cepCompleto(cep)) {
      setResultado(null);
      setErro(d.length ? "Faltam números no CEP. Confira os 8 dígitos." : "Digite o seu CEP para calcular.");
      return;
    }
    setCarregando(true);
    setErro(null);
    const r = await cotarFrete(slug, cep);
    setCarregando(false);
    if (r.ok) { setResultado({ fee: r.fee, eta: r.eta }); onCep?.(d); }
    else { setResultado(null); setErro(r.erro); }
  }

  const linhas: Array<{ chave: string; icone: string; titulo: string; legenda: string | null; valor: string; gratis: boolean }> = [];
  if (resultado) {
    linhas.push({
      chave: "casa", icone: "truck", titulo: "Receber em casa",
      legenda: resultado.eta ? `${resultado.eta}` : null,
      valor: resultado.fee > 0 ? dinheiro(resultado.fee) : "Grátis", gratis: !(resultado.fee > 0),
    });
  }
  if (temRetirada) {
    linhas.push({
      chave: "loja", icone: "store",
      titulo: ret?.bairro ? `Retire na loja · ${ret.bairro}` : "Retire na loja",
      // O prazo de retirada escrito pela lojista só entra quando é frase
      // ("a partir das 14h"); número solto no campo não diz nada à cliente.
      legenda: [ret?.rua, /[a-zà-ú]/i.test(String(entrega_.pickup_eta_text || "")) ? entrega_.pickup_eta_text : "quando ficar pronta"].filter(Boolean).join(" · "),
      valor: "Grátis", gratis: true,
    });
  }
  if (temApp) {
    linhas.push({
      chave: "app", icone: "location", titulo: "Retirada por aplicativo",
      legenda: "Você chama um Uber ou 99 para buscar na loja", valor: "Você paga o app", gratis: false,
    });
  }

  return (
    <View style={{ gap: 12 }}>
      {temEntrega ? (
        <View style={{ gap: 6 }}>
          <Texto style={{ fontSize: 13, fontWeight: "600", color: t.ink2 }}>Calcular frete</Texto>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              value={cep}
              onChangeText={(v) => { setCep(mascaraCep(v)); setErro(null); }}
              onSubmitEditing={calcular}
              placeholder="Seu CEP"
              placeholderTextColor={t.ink4}
              keyboardType="number-pad"
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={9}
              accessibilityLabel="CEP para calcular o frete"
              style={[{
                flex: 1, height: 48, borderRadius: 12, borderWidth: 1, borderColor: erro ? t.red : borda2(t), backgroundColor: t.bg2,
                paddingHorizontal: 14, fontSize: 15, color: t.ink,
              }, estiloNumero(par) as any, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null,
                erro && Platform.OS === "web" ? ({ boxShadow: `0 0 0 3px ${wash(t.red, 0.12)}` } as any) : null]}
            />
            <Botao
              tipo="secundario"
              rotulo="Calcular"
              rotuloAcessivel="Calcular o frete"
              onPress={calcular}
              conteudo={carregando ? <ActivityIndicator size="small" color={t.ink} /> : undefined}
            />
          </View>
          {erro ? (
            <View accessibilityRole="alert" style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Icon name="alert" size={15} color={t.red} />
              <Texto style={{ fontSize: 12.5, color: t.red, flex: 1 }}>{erro}</Texto>
            </View>
          ) : (
            <Pressable onPress={() => Linking.openURL(BUSCA_CEP)} accessibilityRole="link" style={{ minHeight: 36, justifyContent: "center", alignSelf: "flex-start" }}>
              <Texto style={{ fontSize: 12.5, color: t.ink3, textDecorationLine: "underline" }}>Não sei meu CEP</Texto>
            </Pressable>
          )}
        </View>
      ) : null}

      {linhas.length ? (
        <View style={{ borderWidth: 1, borderColor: t.border, borderRadius: 14, backgroundColor: t.bg2, overflow: "hidden" }}>
          {linhas.map((l, i) => (
            <View key={l.chave} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderTopWidth: i ? 1 : 0, borderTopColor: t.border }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: t.bg3, alignItems: "center", justifyContent: "center" }}>
                <Icon name={l.icone as any} size={18} color={t.ink2} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Texto style={{ fontSize: 14, fontWeight: "600", color: t.ink }}>{l.titulo}</Texto>
                {l.legenda ? <Texto style={{ fontSize: 12.5, lineHeight: 18, color: t.ink3, marginTop: 1 }}>{l.legenda}</Texto> : null}
              </View>
              {l.gratis ? (
                <Texto style={{ fontSize: 13.5, fontWeight: "600", color: t.green }}>{l.valor}</Texto>
              ) : l.chave === "casa" ? (
                <Numero style={{ fontSize: 14, fontWeight: "600", color: t.ink }}>{l.valor}</Numero>
              ) : (
                <Texto style={{ fontSize: 12.5, color: t.ink3 }}>{l.valor}</Texto>
              )}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
