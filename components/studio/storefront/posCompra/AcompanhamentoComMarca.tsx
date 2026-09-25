// ============================================================
// components/studio/storefront/posCompra/AcompanhamentoComMarca.tsx
//
// Acompanhar o pedido com a marca da loja (mockup da Fase 4, Tela 4).
//
// A LÓGICA é a de app/acompanhar/[token].tsx, que continua valendo:
// ETAPAS e nunca horário (previsão furada destrói mais confiança que a
// ausência dela), o Pix do saldo a um toque com a seleção manual quando a
// área de transferência falha, os textos por tipo de utils/acompanharTextos.
// O que muda (JORNADA §2.3 e §4.10):
//   - a marca da loja;
//   - a próxima ação sempre à vista, uma por vez — aprovar a arte, pagar
//     o saldo, buscar, ou "Pedir outro igual" depois de entregue;
//   - itens com foto e o resumo da personalização, e onde retirar.
// ============================================================
import { useEffect, useState } from "react";
import { Image, View } from "react-native";
import { router } from "expo-router";
import { Icon } from "@/components/Icon";
import type { PublicTrack } from "@/services/studioApi";
import { copyToClipboard } from "@/utils/clipboard";
import { rotuloItens, rotuloSaldo, qtdDoItemPublico } from "@/utils/acompanharTextos";
import { useTemaDaVitrine } from "../TemaDaVitrine";
import { Numero, Texto, estiloNumero, useTipografia } from "../TipografiaVitrine";
import { dinheiro } from "../moeda";
import { caminhoDeRepetir, primeiroDisponivel, type ItemDaRepeticao } from "../repeticaoDoPedido";
import { apiDoPosCompra } from "./apiDoPosCompra";
import { Botao, MolduraDaLoja, Nota, Painel, Rotulo, Selo, Titulo, abrirFora } from "./MolduraDaLoja";
import {
  acaoDoAcompanhamento, dataPorExtenso, linkDoWhatsAppDoPedido, nomeDaLoja, rotuloDaEtapa,
  rotuloDoPedido, subtituloDoAcompanhamento, type AcaoDoAcompanhamento,
} from "./posCompra";

export function AcompanhamentoComMarca({ token, dados }: { token: string; dados: PublicTrack }) {
  const marca = dados.marca || null;
  const loja = nomeDaLoja(marca, dados.loja);
  const whats = linkDoWhatsAppDoPedido(marca?.whatsapp, dados.pedido);
  const rodape = `${rotuloDoPedido(dados.pedido)} · Loja desenvolvida com Aura.`;

  if (dados.cancelado) {
    return (
      <MolduraDaLoja marca={marca} nome={loja} titulo={`Seu pedido · ${loja}`} rodape={rodape} testID="acompanhar-com-marca">
        <Cancelado dados={dados} loja={loja} whats={whats} slug={marca?.slug || null} />
      </MolduraDaLoja>
    );
  }

  const acao = acaoDoAcompanhamento(dados);
  return (
    <MolduraDaLoja marca={marca} nome={loja} titulo={`Seu pedido · ${loja}`} rodape={rodape} testID="acompanhar-com-marca">
      <Cabeca dados={dados} loja={loja} acao={acao} />
      <LinhaDoTempo dados={dados} />
      {dados.entrega_combinada ? <EntregaCombinada data={dados.entrega_combinada} /> : null}
      <ProximaAcao dados={dados} acao={acao} token={token} />
      <Itens dados={dados} />
      {dados.retirada_endereco ? <Retirada endereco={dados.retirada_endereco} /> : null}
      {whats ? (
        <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
          <Botao tipo="whatsapp" icone="whatsapp" rotulo={`Falar com ${loja} no WhatsApp`} onPress={() => abrirFora(whats)} testID="acompanhar-whatsapp" />
        </View>
      ) : null}
    </MolduraDaLoja>
  );
}

function Cabeca({ dados, loja, acao }: { dados: PublicTrack; loja: string; acao: AcaoDoAcompanhamento }) {
  const tema = useTemaDaVitrine();
  return (
    <View style={{ paddingTop: 18, paddingHorizontal: 22 }}>
      <Rotulo>{loja}</Rotulo>
      <Titulo style={{ marginTop: 4 }}>{dados.cliente && dados.cliente !== "você" ? `Oi, ${dados.cliente}!` : "Oi!"}</Titulo>
      <Texto style={{ fontSize: 15, lineHeight: 22, color: tema.ink2, marginTop: 4 }}>{subtituloDoAcompanhamento(acao)}</Texto>
    </View>
  );
}

/** As etapas — o coração da página. Sem horário, só o percurso. */
function LinhaDoTempo({ dados }: { dados: PublicTrack }) {
  const tema = useTemaDaVitrine();
  const etapas = dados.etapas || [];
  const atual = dados.etapa_atual ?? 0;
  const entregue = dados.entregue === true;
  const retirada = !!dados.retirada_endereco;
  return (
    <Painel testID="acompanhar-etapas">
      {etapas.map((e, i) => {
        const feito = entregue || i < atual;
        const agora = !entregue && i === atual;
        const ultima = i === etapas.length - 1;
        return (
          <View key={e.key} style={{ flexDirection: "row", gap: 14 }}>
            <View style={{ alignItems: "center" }}>
              <View
                style={{
                  width: 26, height: 26, borderRadius: 13, borderWidth: 2,
                  alignItems: "center", justifyContent: "center",
                  backgroundColor: feito ? tema.marcaFill : agora ? tema.bg2 : tema.bg3,
                  borderColor: feito ? tema.marcaFill : agora ? tema.marcaTexto : tema.border,
                }}
              >
                {feito ? <Icon name="check" size={14} color={tema.sobreMarca} /> : null}
              </View>
              {!ultima ? (
                <View style={{ width: 2, flex: 1, minHeight: 24, backgroundColor: feito ? tema.marcaFill : tema.border }} />
              ) : null}
            </View>
            <View style={{ flex: 1, paddingBottom: ultima ? 0 : 14, paddingTop: 2 }}>
              <Texto
                style={{
                  fontSize: 15.5, fontWeight: agora ? "700" : "600",
                  color: feito || agora ? tema.ink : tema.ink3,
                }}
                accessibilityLabel={`${rotuloDaEtapa(e.label, i, etapas.length, { retirada, entregue })}${feito ? ", concluída" : agora ? ", etapa atual" : ""}`}
              >
                {rotuloDaEtapa(e.label, i, etapas.length, { retirada, entregue })}
              </Texto>
              {agora ? (
                <Texto style={{ fontSize: 12.5, fontWeight: "700", color: tema.marcaTexto, marginTop: 2 }}>é onde estamos agora</Texto>
              ) : null}
            </View>
          </View>
        );
      })}
    </Painel>
  );
}

function EntregaCombinada({ data }: { data: string }) {
  const tema = useTemaDaVitrine();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14, paddingHorizontal: 24 }}>
      <Icon name="calendar" size={16} color={tema.ink2} />
      <Texto style={{ fontSize: 14.5, color: tema.ink2 }}>
        Entrega combinada para <Texto style={{ fontWeight: "700", color: tema.ink }}>{dataPorExtenso(data)}</Texto>
      </Texto>
    </View>
  );
}

// ── A próxima ação ─────────────────────────────────────────────

function ProximaAcao({ dados, acao, token }: { dados: PublicTrack; acao: AcaoDoAcompanhamento; token: string }) {
  const tema = useTemaDaVitrine();
  const slug = dados.marca?.slug || null;
  const nomeDoItem = (dados.itens || []).length === 1 ? dados.itens![0].nome : null;

  if (acao === "aprovar" && dados.aprovacao?.token) {
    const aprovar = () => {
      const t = dados.aprovacao!.token;
      router.push((slug ? `/${slug}/aprovacao/${t}` : `/aprovacao/${t}`) as any);
    };
    return (
      <Painel style={{ gap: 12 }} testID="acompanhar-acao-aprovar">
        <Linha icone="eye" titulo={`A arte ${nomeDoItem ? "de " + nomeDoItem : "do seu pedido"} está pronta.`} texto="Dá uma olhada e diz se pode seguir pra produção." />
        <Botao icone="check" rotulo="Aprovar a arte" onPress={aprovar} />
      </Painel>
    );
  }

  if (acao === "saldo" && dados.saldo) return <Saldo saldo={dados.saldo} tipo={dados.tipo} />;

  if (acao === "pronto") {
    const retirada = !!dados.retirada_endereco;
    return (
      <Painel testID="acompanhar-acao-pronto">
        <Linha
          icone="store"
          titulo={retirada ? "Pronto para retirar." : "Sua encomenda está pronta."}
          texto={retirada
            ? `Qualquer pessoa pode buscar mostrando o número do pedido #${dados.pedido}.`
            : "A loja fala com você para combinar a entrega."}
        />
      </Painel>
    );
  }

  if (acao === "entregue") {
    return (
      <>
        <Painel testID="acompanhar-acao-entregue">
          <Linha icone="check" corDoIcone={tema.green} titulo="Entregue com carinho." texto="Esperamos que você ame." />
        </Painel>
        {dados.origem === "vitrine" && slug ? <PedirOutroIgual slug={slug} token={token} dados={dados} /> : null}
      </>
    );
  }
  return null;
}

function Linha({ icone, titulo, texto, corDoIcone }: { icone: string; titulo: string; texto: string; corDoIcone?: string }) {
  const tema = useTemaDaVitrine();
  return (
    <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
      <View style={{ paddingTop: 2 }}><Icon name={icone as any} size={20} color={corDoIcone || tema.marcaTexto} /></View>
      <View style={{ flex: 1 }}>
        <Texto style={{ fontSize: 15, lineHeight: 22, fontWeight: "600", color: tema.ink }}>{titulo}</Texto>
        <Texto style={{ fontSize: 13, lineHeight: 19, color: tema.ink2, marginTop: 2 }}>{texto}</Texto>
      </View>
    </View>
  );
}

/** Saldo com Pix a um toque. Cobrar sem constranger: valor, data e o código. */
function Saldo({ saldo, tipo }: { saldo: NonNullable<PublicTrack["saldo"]>; tipo?: string }) {
  const tema = useTemaDaVitrine();
  const par = useTipografia();
  const [copiado, setCopiado] = useState(false);
  const [manual, setManual] = useState(false);
  async function copiar() {
    // Web-only e devolve false quando não consegue: aí o código aparece
    // para seleção manual — a cliente precisa conseguir pagar de qualquer jeito.
    const ok = await copyToClipboard(saldo.pix as string);
    if (ok) setCopiado(true);
    else setManual(true);
  }
  return (
    <Painel style={{ gap: 10 }} testID="acompanhar-acao-saldo">
      <Rotulo>{rotuloSaldo(tipo)}</Rotulo>
      <Numero style={{ fontSize: 28, fontWeight: "700", color: tema.ink, letterSpacing: -0.6 }}>{dinheiro(saldo.valor)}</Numero>
      {saldo.vencimento ? (
        <Texto style={{ fontSize: 13, color: tema.ink2, marginTop: -4 }}>{`para ${dataPorExtenso(saldo.vencimento)}`}</Texto>
      ) : null}
      {saldo.pix ? (
        <>
          <Botao tipo="pix" icone="copy" rotulo="Copiar código Pix" onPress={copiar} testID="acompanhar-copiar-pix" />
          <Texto style={{ fontSize: 13, color: tema.ink2, lineHeight: 19 }}>
            {copiado ? "Copiado! Cole no app do seu banco, na opção Pix copia e cola." : "Cole no app do seu banco, na opção Pix copia e cola."}
          </Texto>
          {manual ? (
            <View style={{ padding: 12, backgroundColor: tema.bg3, borderRadius: 10, borderWidth: 1, borderColor: tema.border }}>
              <Texto style={{ fontSize: 12.5, color: tema.ink3, marginBottom: 6 }}>Selecione e copie o código:</Texto>
              <Texto selectable style={[estiloNumero(par), { fontSize: 11.5, lineHeight: 17, color: tema.ink }]}>{saldo.pix}</Texto>
            </View>
          ) : null}
        </>
      ) : (
        <Texto style={{ fontSize: 13.5, color: tema.ink2, lineHeight: 19 }}>Combine o pagamento com a loja pelo WhatsApp.</Texto>
      )}
    </Painel>
  );
}

/**
 * "Gostou? Peça outra igual" (mockup, Tela 4-D → Tela 5). Pergunta ao
 * servidor o que do pedido ainda está na loja antes de oferecer o botão:
 * um botão que leva a "essa peça não existe mais" é pior que um aviso.
 */
function PedirOutroIgual({ slug, token, dados }: { slug: string; token: string; dados: PublicTrack }) {
  const tema = useTemaDaVitrine();
  const [item, setItem] = useState<ItemDaRepeticao | null | undefined>(undefined);
  useEffect(() => {
    let vivo = true;
    apiDoPosCompra.repetir(slug, token)
      .then((r) => { if (vivo) setItem(primeiroDisponivel(r)); })
      .catch(() => { if (vivo) setItem(null); });
    return () => { vivo = false; };
  }, [slug, token]);

  if (item === null) {
    return (
      <Nota tipo="ambar" icone="alert_circle" style={{ marginHorizontal: 20, marginTop: 16 }} testID="acompanhar-repetir-indisponivel">
        A peça deste pedido não está mais na loja. Fale com a loja pelo WhatsApp para pedir uma parecida.
      </Nota>
    );
  }
  const foto = (dados.itens || []).find((i) => i.nome === item?.nome)?.imagem || dados.imagem || null;
  const nome = item?.nome || "a peça";
  return (
    <>
      <Painel style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
        <View style={{ width: 68, height: 68, borderRadius: 12, overflow: "hidden", backgroundColor: tema.bg3, borderWidth: 1, borderColor: tema.border }}>
          {foto ? <Image source={{ uri: foto }} style={{ width: 68, height: 68 }} accessibilityLabel={nome} /> : null}
        </View>
        <View style={{ flex: 1 }}>
          <Texto style={{ fontSize: 15, fontWeight: "700", color: tema.ink }}>Gostou? Peça outra igual</Texto>
          <Texto style={{ fontSize: 13, lineHeight: 19, color: tema.ink2, marginTop: 2 }}>
            Abrimos {nome} com a mesma arte, pronta pra você conferir e ajustar.
          </Texto>
        </View>
      </Painel>
      <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
        <Botao
          icone="refresh"
          rotulo="Pedir outro igual"
          testID="acompanhar-repetir"
          carregando={item === undefined}
          onPress={item ? () => router.push(caminhoDeRepetir(slug, String(item.product_id), token) as any) : undefined}
        />
      </View>
    </>
  );
}

// ── Itens e retirada ───────────────────────────────────────────

function Itens({ dados }: { dados: PublicTrack }) {
  const tema = useTemaDaVitrine();
  const itens = dados.itens || [];
  if (!itens.length) return null;
  return (
    <Painel testID="acompanhar-itens">
      <Rotulo>{rotuloItens(dados.tipo)}</Rotulo>
      {itens.map((it, i) => (
        <View
          key={i}
          style={{
            flexDirection: "row", gap: 12, alignItems: "center", paddingVertical: 11,
            borderTopWidth: i > 0 ? 1 : 0, borderTopColor: tema.border,
          }}
        >
          <View style={{ width: 52, height: 52, borderRadius: 10, overflow: "hidden", backgroundColor: tema.bg3, borderWidth: 1, borderColor: tema.border }}>
            {it.imagem ? <Image source={{ uri: it.imagem }} style={{ width: 52, height: 52 }} accessibilityLabel={it.nome} /> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Texto style={{ fontSize: 13.5, color: tema.ink }}>{it.nome}</Texto>
            {it.resumo && it.resumo.length ? (
              <Texto style={{ fontSize: 12.5, lineHeight: 18, color: tema.ink2, marginTop: 1 }}>{it.resumo.join(" · ")}</Texto>
            ) : null}
          </View>
          <Numero style={{ fontSize: 13.5, fontWeight: "700", color: tema.ink }}>{qtdDoItemPublico(it)}</Numero>
        </View>
      ))}
      {typeof dados.total === "number" ? (
        <View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: 12, marginTop: 6, borderTopWidth: 1, borderTopColor: tema.border }}>
          <Texto style={{ fontSize: 13, color: tema.ink2 }}>Total</Texto>
          <Numero style={{ fontSize: 13.5, fontWeight: "700", color: tema.ink }}>{dinheiro(dados.total)}</Numero>
        </View>
      ) : null}
    </Painel>
  );
}

function Retirada({ endereco }: { endereco: string }) {
  const tema = useTemaDaVitrine();
  return (
    <Painel testID="acompanhar-retirada">
      <Rotulo>Retirada</Rotulo>
      <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start", marginTop: 8 }}>
        <View style={{ paddingTop: 2 }}><Icon name="location" size={16} color={tema.marcaTexto} /></View>
        <Texto style={{ flex: 1, fontSize: 13.5, lineHeight: 20, color: tema.ink }}>{endereco}</Texto>
      </View>
    </Painel>
  );
}

function Cancelado({ dados, loja, whats, slug }: { dados: PublicTrack; loja: string; whats: string | null; slug: string | null }) {
  const tema = useTemaDaVitrine();
  return (
    <View testID="acompanhar-cancelado" style={{ flexGrow: 1, minHeight: 420, alignItems: "center", justifyContent: "center", paddingVertical: 40, paddingHorizontal: 30, gap: 14 }}>
      <Selo icone="alert_circle" tipo="erro" />
      <Titulo tamanho={20} centro>{`Pedido #${dados.pedido} cancelado`}</Titulo>
      <Texto style={{ textAlign: "center", color: tema.ink2, fontSize: 15, lineHeight: 23, maxWidth: 380 }}>
        {`Esta encomenda em ${loja} foi cancelada. Fale com a loja se tiver dúvida.`}
      </Texto>
      <View style={{ width: "100%", maxWidth: 360, gap: 10, marginTop: 6 }}>
        {whats ? <Botao tipo="whatsapp" icone="whatsapp" rotulo={`Falar com ${loja} no WhatsApp`} onPress={() => abrirFora(whats)} /> : null}
        {slug ? <Botao tipo="secundario" rotulo="Ir para a loja" onPress={() => router.replace(("/" + slug) as any)} /> : null}
      </View>
    </View>
  );
}
