// ============================================================
// components/studio/storefront/posCompra/AprovacaoComMarca.tsx
//
// Aprovar a arte com a marca da loja (mockup da Fase 4, Telas 1 a 3).
//
// A LÓGICA é a de app/aprovacao/[token].tsx, que continua valendo: um
// link = um mockup para o pedido; "Aprovar" leva o pedido para produção
// no KDS, "Pedir ajuste" fecha o link com o comentário e a loja manda
// outro com a arte nova; o vídeo turntable do motor 3D; o histórico de
// revisões. O que muda:
//   - a cor, a letra e o logo da lojista no lugar do azul-marinho;
//   - o aviso de revisão inclusa ou paga antes de pedir ajuste;
//   - "Arte aprovada" sem emoji, com o que acontece agora e o caminho
//     para acompanhar o pedido.
//
// Quem busca o pedido e responde é quem monta a tela (a rota nova no
// endereço da loja, ou a rota antiga) — `responder` vem por prop.
// ============================================================
import { useState } from "react";
import { Image, View } from "react-native";
import { router } from "expo-router";
import { Icon } from "@/components/Icon";
import type { PublicApproval } from "@/services/studioApi";
import { useTemaDaVitrine } from "../TemaDaVitrine";
import { Numero, Texto } from "../TipografiaVitrine";
import { dinheiro } from "../moeda";
import { FolhaDeAjuste } from "./FolhaDeAjuste";
import { MockupDaArte } from "./MockupDaArte";
import { Botao, MolduraDaLoja, Nota, Painel, Rotulo, Selo, Titulo, abrirFora } from "./MolduraDaLoja";
import { PedidoNaoEncontrado } from "./PedidoNaoEncontrado";
import {
  avisoDoAjuste, linkDoWhatsAppDoPedido, nomeDaLoja, primeiroNome, telaDaAprovacao,
  textoDasRevisoes, tituloDaAprovacao,
} from "./posCompra";

export type Responder = (
  token: string,
  corpo: { action: "approve" | "request_changes"; note?: string; referencia_url?: string },
) => Promise<{ action: string }>;

/** "2 de outubro" a partir de um timestamp. */
function dataCurta(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
}

export function AprovacaoComMarca({
  token, dados, responder,
}: {
  token: string;
  dados: PublicApproval;
  responder: Responder;
}) {
  const marca = dados.marca || null;
  const loja = nomeDaLoja(marca, dados.shop?.name);
  const [respondido, setRespondido] = useState<"approve" | "request_changes" | null>(null);
  const [notaEnviada, setNotaEnviada] = useState<string | null>(null);
  const [folha, setFolha] = useState(false);
  const [enviando, setEnviando] = useState<"approve" | "request_changes" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [expirou, setExpirou] = useState(false);

  const tela = expirou ? "expirado" : telaDaAprovacao(dados.status, respondido);
  const numero = dados.order?.numero || null;

  async function enviar(action: "approve" | "request_changes", nota?: string, referencia?: string | null) {
    setEnviando(action);
    setErro(null);
    try {
      await responder(token, {
        action,
        note: nota || undefined,
        referencia_url: referencia || undefined,
      });
      setRespondido(action);
      if (action === "request_changes") setNotaEnviada(nota || null);
      setFolha(false);
    } catch (e: any) {
      const status = e?.status;
      if (status === 410) { setFolha(false); setExpirou(true); return; }
      // 409: alguém já respondeu este link (outra aba, outro aparelho).
      setErro(status === 409
        ? "Esta arte já foi respondida. Recarregue a página para ver como ficou."
        : "Não conseguimos enviar agora. Confira a conexão e tente de novo.");
    } finally {
      setEnviando(null);
    }
  }

  if (tela === "expirado") {
    return <PedidoNaoEncontrado marca={marca} motivo="expirado" pedido={numero} titulo={`Aprovação de arte · ${loja}`} />;
  }

  const itens = dados.order?.items || [];
  const nomeDoItem = itens.length === 1 ? itens[0]?.product_name || null : null;
  const irParaAcompanhar = dados.acompanhar_token && marca?.slug
    ? () => router.push(("/" + marca.slug + "/acompanhar/" + dados.acompanhar_token) as any)
    : null;
  const whats = linkDoWhatsAppDoPedido(marca?.whatsapp, numero);

  return (
    <MolduraDaLoja marca={marca} nome={loja} titulo={`Aprovação de arte · ${loja}`} testID="aprovacao-com-marca">
      {tela === "aprovar" ? (
        <TelaAprovar
          dados={dados}
          enviando={enviando}
          erro={folha ? null : erro}
          onAprovar={() => enviar("approve")}
          onPedirAjuste={() => { setErro(null); setFolha(true); }}
        />
      ) : tela === "aprovada" ? (
        <TelaAprovada dados={dados} loja={loja} onAcompanhar={irParaAcompanhar} />
      ) : (
        <TelaAjustePedido
          loja={loja}
          nota={notaEnviada ?? (respondido ? null : dados.response_note)}
          onAcompanhar={irParaAcompanhar}
          whats={whats}
        />
      )}
      <FolhaDeAjuste
        aberta={folha}
        nomeDoItem={nomeDoItem}
        aviso={avisoDoAjuste(dados.revisoes)}
        slug={marca?.slug || null}
        enviando={enviando === "request_changes"}
        erro={folha ? erro : null}
        onCancelar={() => { setFolha(false); setErro(null); }}
        onEnviar={(nota, referencia) => enviar("request_changes", nota, referencia)}
      />
    </MolduraDaLoja>
  );
}

// ── Tela 1 — aprovar ───────────────────────────────────────────

function TelaAprovar({
  dados, enviando, erro, onAprovar, onPedirAjuste,
}: {
  dados: PublicApproval;
  enviando: "approve" | "request_changes" | null;
  erro: string | null;
  onAprovar: () => void;
  onPedirAjuste: () => void;
}) {
  const tema = useTemaDaVitrine();
  const itens = dados.order?.items || [];
  const nome = primeiroNome(dados.order?.customer_name);
  const revisoes = textoDasRevisoes(dados.revisoes);
  const anteriores = (dados.revisions || []).length > 1 ? dados.revisions.slice().reverse() : [];
  const validade = dataCurta(dados.expires_at);

  return (
    <View testID="aprovacao-aprovar">
      <View style={{ alignItems: "center", marginTop: 16 }}>
        <Rotulo>Aprovação de arte</Rotulo>
      </View>
      <View style={{ paddingHorizontal: 22, paddingTop: 6, gap: 6, alignItems: "center" }}>
        <Titulo centro>{tituloDaAprovacao(itens)}</Titulo>
        <Texto style={{ fontSize: 13.5, lineHeight: 20, color: tema.ink2, textAlign: "center" }}>
          {nome ? `Oi, ${nome}! ` : ""}Dá uma olhada e nos diz se pode ir pra produção.
        </Texto>
      </View>

      <View style={{ marginTop: 16, marginHorizontal: 20 }}>
        <MockupDaArte url={dados.mockup_url} descricao="A arte do seu pedido" />
      </View>

      {itens.length ? (
        <Texto style={{ textAlign: "center", marginTop: 12, paddingHorizontal: 26, fontSize: 13, lineHeight: 19, color: tema.ink2 }}>
          {itens.map((it, i) => (
            <Texto key={i}>
              {i > 0 ? " · " : ""}
              <Numero style={{ color: tema.ink2 }}>{it.quantity}×</Numero> <Texto style={{ fontWeight: "700", color: tema.ink }}>{it.product_name}</Texto>
            </Texto>
          ))}
        </Texto>
      ) : null}

      {revisoes ? (
        <Nota tipo="info" icone="info" style={{ marginHorizontal: 20, marginTop: 16 }} testID="aprovacao-revisoes">
          {revisoes}
        </Nota>
      ) : null}
      {erro ? <Nota tipo="erro" icone="alert_circle" style={{ marginHorizontal: 20, marginTop: 12 }}>{erro}</Nota> : null}

      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, gap: 10 }}>
        <Botao
          icone="check"
          rotulo="Aprovar e produzir"
          testID="aprovacao-aprovar-botao"
          carregando={enviando === "approve"}
          desabilitado={!!enviando}
          onPress={onAprovar}
        />
        <Botao tipo="secundario" rotulo="Pedir ajuste" testID="aprovacao-ajuste-botao" desabilitado={!!enviando} onPress={onPedirAjuste} />
      </View>

      {anteriores.length ? (
        <Painel>
          <Rotulo>Histórico</Rotulo>
          <View style={{ gap: 12, marginTop: 12 }}>
            {anteriores.map((r) => (
              <View key={r.revision_number} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                <View
                  style={{
                    width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center",
                    backgroundColor: r.created_by_type === "shop" ? tema.marcaWash : tema.bg3,
                  }}
                >
                  <Numero style={{ fontSize: 11, fontWeight: "700", color: r.created_by_type === "shop" ? tema.marcaTexto : tema.ink2 }}>
                    v{r.revision_number}
                  </Numero>
                </View>
                <View style={{ flex: 1 }}>
                  <Texto style={{ fontSize: 13, fontWeight: "600", color: tema.ink }}>
                    {r.created_by_type === "shop" ? "A loja enviou" : "Você pediu ajuste"}
                  </Texto>
                  {r.note ? <Texto style={{ fontSize: 12.5, color: tema.ink2, marginTop: 2, lineHeight: 18 }}>“{r.note}”</Texto> : null}
                </View>
              </View>
            ))}
          </View>
        </Painel>
      ) : null}

      {validade ? (
        <Texto style={{ textAlign: "center", fontSize: 12, color: tema.ink3, marginTop: 14 }}>
          {`Este link vale até ${validade}.`}
        </Texto>
      ) : null}
    </View>
  );
}

// ── Tela 3 — arte aprovada ─────────────────────────────────────

function TelaAprovada({
  dados, loja, onAcompanhar,
}: {
  dados: PublicApproval;
  loja: string;
  onAcompanhar: (() => void) | null;
}) {
  const tema = useTemaDaVitrine();
  const itens = dados.order?.items || [];
  const primeiro = itens[0];
  const nomeDoItem = itens.length === 1 ? primeiro?.product_name : null;
  const numero = dados.order?.numero;
  const foto = primeiro?.product_image || null;
  return (
    <View testID="aprovacao-aprovada">
      <View style={{ paddingTop: 34, paddingHorizontal: 26, paddingBottom: 8, alignItems: "center", gap: 12 }}>
        <Selo icone="check" tipo="pix" />
        <Titulo centro>Arte aprovada</Titulo>
        <Texto style={{ fontSize: 15, lineHeight: 23, color: tema.ink2, textAlign: "center", maxWidth: 360 }}>
          {`${nomeDoItem ? `${nomeDoItem} já pode ir pra produção.` : "Seu pedido já pode ir pra produção."} Avisamos ${loja}.`}
        </Texto>
      </View>

      <Painel style={{ flexDirection: "row", gap: 14, alignItems: "center", marginTop: 18 }}>
        <View style={{ width: 66, height: 66 }}>
          {foto ? (
            <Image source={{ uri: foto }} style={{ width: 66, height: 66, borderRadius: 12, backgroundColor: tema.bg3 }} accessibilityLabel={primeiro?.product_name || "Seu pedido"} />
          ) : (
            <MockupDaArte url={dados.mockup_url} descricao="A arte aprovada" tamanho="miniatura" />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Texto style={{ fontSize: 13.5, fontWeight: "700", color: tema.ink }}>
            {nomeDoItem || `${itens.length} ${itens.length === 1 ? "peça" : "peças"} no pedido`}
          </Texto>
          <Texto style={{ fontSize: 13, color: tema.ink2, marginTop: 2 }}>
            {numero ? <>Pedido <Numero>#{numero}</Numero> · </> : null}
            <Numero>{dinheiro(dados.order?.total_amount)}</Numero>
          </Texto>
        </View>
      </Painel>

      <Painel style={{ gap: 14 }}>
        <Rotulo>O que acontece agora</Rotulo>
        <Passo icone="box" texto="A arte vai para a produção." />
        {dados.prazo_dias_uteis ? (
          <Passo icone="calendar" texto={`Prazo de ${dados.prazo_dias_uteis} ${dados.prazo_dias_uteis === 1 ? "dia útil" : "dias úteis"} — sem hora marcada, por etapas.`} />
        ) : null}
        <Passo icone="whatsapp" texto="Te avisamos quando estiver pronto." />
      </Painel>

      {onAcompanhar ? (
        <View style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 6 }}>
          <Botao icone="truck" rotulo="Acompanhar o pedido" onPress={onAcompanhar} testID="aprovacao-acompanhar" />
        </View>
      ) : null}
    </View>
  );
}

function Passo({ icone, texto }: { icone: string; texto: string }) {
  const tema = useTemaDaVitrine();
  return (
    <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
      <View style={{ paddingTop: 2 }}><Icon name={icone as any} size={16} color={tema.marcaTexto} /></View>
      <Texto style={{ flex: 1, fontSize: 13.5, lineHeight: 20, color: tema.ink }}>{texto}</Texto>
    </View>
  );
}

// ── Tela 2 (depois do envio) — ajuste pedido ───────────────────

function TelaAjustePedido({
  loja, nota, onAcompanhar, whats,
}: {
  loja: string;
  nota: string | null | undefined;
  onAcompanhar: (() => void) | null;
  whats: string | null;
}) {
  const tema = useTemaDaVitrine();
  return (
    <View testID="aprovacao-ajuste">
      <View style={{ paddingTop: 34, paddingHorizontal: 26, paddingBottom: 8, alignItems: "center", gap: 12 }}>
        <Selo icone="check" tipo="pix" />
        <Titulo centro tamanho={22}>{`${loja} recebeu seu pedido de ajuste`}</Titulo>
        <Texto style={{ fontSize: 15, lineHeight: 23, color: tema.ink2, textAlign: "center", maxWidth: 380 }}>
          Assim que a nova versão ficar pronta, mandamos um link novo pra você aprovar.
        </Texto>
      </View>
      {nota ? (
        <Painel>
          <Rotulo>O que você pediu</Rotulo>
          <Texto style={{ fontSize: 14, lineHeight: 21, color: tema.ink, marginTop: 8 }}>{nota}</Texto>
        </Painel>
      ) : null}
      <View style={{ paddingHorizontal: 20, paddingTop: 18, gap: 10 }}>
        {onAcompanhar ? <Botao icone="truck" rotulo="Acompanhar o pedido" onPress={onAcompanhar} /> : null}
        {whats ? (
          <Botao tipo={onAcompanhar ? "secundario" : "whatsapp"} icone="whatsapp" rotulo={`Falar com ${loja} no WhatsApp`} onPress={() => abrirFora(whats)} />
        ) : null}
      </View>
    </View>
  );
}
