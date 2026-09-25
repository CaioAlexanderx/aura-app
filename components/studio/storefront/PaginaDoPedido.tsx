// ============================================================
// components/studio/storefront/PaginaDoPedido.tsx
//
// `/<slug>/pedido/<token>`: a tela do Pix, a volta do cartão e a
// confirmação, lidas do servidor (Fase 2, Telas 5, 6 e 7 do mockup
// studio-vitrine-02-fechar-a-venda; contrato B2).
//
// Antes: a confirmação era `sentOrder` na memória da aba — um F5 apagava
// o pedido da tela, o status do Pix era fixo ("Aguardando produção da
// arte" antes de pagar) e não havia comprovante nem "Já paguei"
// (SentConfirmation.tsx). Agora a MESMA URL mostra sempre o mesmo pedido,
// em qualquer aparelho, e muda sozinha: consulta o servidor a cada 4 s
// enquanto espera pagamento (pix.js da Negócio) e vira "Pagamento
// recebido" quando o Pix entra.
//
// Funciona com a chave desligada (é só um endereço); só a chave ligada
// NAVEGA para cá depois do pedido. "Já paguei" e "Anexar comprovante"
// usam as rotas da loja comum (storefront.js, não filtram por vertical) e
// precisam do `order_id`, guardado na aba no momento do pedido
// (pedidoGuardado.ts) — em outro aparelho os dois somem.
// ============================================================
import { useCallback, useEffect, useRef, useState } from "react";
import { View, Pressable, ScrollView, Image, Linking, Platform, useWindowDimensions } from "react-native";
import { useVitrine } from "./ContextoDaVitrine";
import { usePaletaDaVitrine } from "./TemaDaVitrine";
import { Texto, Numero, useTipografia, estiloNumero } from "./TipografiaVitrine";
import { Icon } from "@/components/Icon";
import { QrCode } from "@/components/QrCode";
import { dinheiro } from "./moeda";
import { wash, tintaSobre, FUNDO_DO_QR } from "./theme";
import { Botao, Nota, BORDA_DE_CAMPO, FUNDO_APAGADO, FUNDO_SUAVE } from "./ui/Formulario";
import { numeroWhatsApp } from "./AncoraWhatsApp";
import { BarraDeCookies } from "./ConsentimentoDaVitrine";
import {
  lerPedidoPublico, situacaoDoPedido, deveConsultar, estaPago, fraseDaValidade, numeroDoPedido,
  dataCompleta, detalheDaEtapa, linkParaGuardar, INTERVALO_DA_CONSULTA_MS,
  type PedidoPublico, type SituacaoDoPedido,
} from "./pedidoPorToken";
import { idDoPedido, lerPedidoPendente, esquecerPedidoPendente } from "./pedidoGuardado";
import { storageDaAba, storageLocal } from "./dadosLembrados";
import { diasUteis } from "./formularioDoCheckout";
import { descontoDoPix } from "./precoDaSacola";
import { enderecoDaApi } from "./enderecoDaApi";

const API_BASE = enderecoDaApi();

/** Depois de tantas consultas sem mudança, a tela para de perguntar (10 min). */
const MAXIMO_DE_CONSULTAS = 150;
/** Comprovante: o mesmo teto da Negócio (pix.js, 5 MB). */
const COMPROVANTE_MAX_BYTES = 5 * 1024 * 1024;

type Retorno = "approved" | "pending" | "failed" | null;

function lerRetorno(v: unknown): Retorno {
  const s = String(Array.isArray(v) ? v[0] : v || "").toLowerCase();
  return s === "approved" ? "approved" : s === "failed" || s === "rejected" ? "failed" : s === "pending" ? "pending" : null;
}

/** O QR do gateway (base64, data: ou URL), ou o gerado do copia-e-cola. */
function QrDoPix({ pix, tamanho }: { pix: NonNullable<PedidoPublico["pix"]>; tamanho: number }) {
  const T = usePaletaDaVitrine();
  const q = pix.qrcode;
  const uri = !q ? null : q.startsWith("data:") || /^https?:\/\//.test(q) ? q : `data:image/png;base64,${q}`;
  return (
    <View style={{ padding: 10, backgroundColor: FUNDO_DO_QR, borderRadius: 14, borderWidth: 1, borderColor: T.border }}>
      {uri
        ? <Image source={{ uri }} style={{ width: tamanho, height: tamanho }} resizeMode="contain" accessibilityLabel="QR Code do Pix" />
        : <QrCode value={pix.copia_e_cola} size={tamanho} />}
    </View>
  );
}

function Circulo({ icone, cor, fundo, tamanho = 76 }: { icone: string; cor: string; fundo: string; tamanho?: number }) {
  return (
    <View style={{ width: tamanho, height: tamanho, borderRadius: tamanho / 2, backgroundColor: fundo, alignItems: "center", justifyContent: "center" }}>
      <Icon name={icone} size={Math.round(tamanho * 0.4)} color={cor} />
    </View>
  );
}

/** "Esta tela confere o pagamento sozinha", com a bolinha verde. */
function ConfereSozinha({ texto = "Esta tela confere o pagamento sozinha" }: { texto?: string }) {
  const T = usePaletaDaVitrine();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }} accessibilityLiveRegion="polite">
      <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: wash(T.green, 0.14), alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: T.green }} />
      </View>
      <Texto style={{ fontSize: 13, color: T.ink2 }}>{texto}</Texto>
    </View>
  );
}

const ICONE_DA_ETAPA: Record<string, string> = { recebido: "check", arte: "edit", producao: "layers", pronto: "box" };

/** A linha do tempo das etapas (a mesma leitura do acompanhamento). */
function LinhaDoTempo({ p, loja, horizontal }: { p: PedidoPublico; loja: string; horizontal?: boolean }) {
  const T = usePaletaDaVitrine();
  const pago = estaPago(p) || p.payment_method === "on_delivery";
  const ctx = { loja, forma: p.payment_method, tipo: p.entrega.tipo, prazo: p.prazo_dias_uteis, pago };
  return (
    <View style={horizontal ? { flexDirection: "row", gap: 8 } : { gap: 0 }} accessibilityRole="list" testID="linha-do-tempo">
      {p.etapas.map((e, i) => {
        const feita = e.estado === "feito" || e.estado === "atual";
        const atual = e.estado === "atual";
        const ultima = i === p.etapas.length - 1;
        const icone = atual && e.chave === "recebido" ? "check" : ICONE_DA_ETAPA[e.chave] || "circle";
        const marca = (
          <View
            style={{
              width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center",
              backgroundColor: feita ? T.ink : T.card, borderWidth: feita ? 0 : 1.5, borderColor: BORDA_DE_CAMPO,
              boxShadow: atual ? `0 0 0 5px ${wash(T.ink, 0.1)}` : undefined,
            } as any}
          >
            <Icon name={icone} size={14} color={feita ? T.bg : T.ink2} />
          </View>
        );
        const texto = (
          <View style={{ flex: horizontal ? undefined : 1, alignItems: horizontal ? "center" : "flex-start", paddingBottom: horizontal || ultima ? 0 : 20 }}>
            <Texto style={{ fontSize: horizontal ? 13 : 15, fontWeight: atual ? "700" : "400", color: T.ink, textAlign: horizontal ? "center" : "left" }}>{e.rotulo}</Texto>
            <Texto style={{ fontSize: horizontal ? 11.5 : 13, lineHeight: horizontal ? 16 : 18, color: T.ink3, textAlign: horizontal ? "center" : "left" }}>
              {detalheDaEtapa(e.chave, ctx)}
            </Texto>
          </View>
        );
        if (horizontal) {
          return (
            <View key={e.chave || i} accessibilityRole={"listitem" as any} style={{ flex: 1, alignItems: "center", gap: 8 }}>
              {marca}
              {texto}
            </View>
          );
        }
        return (
          <View key={e.chave || i} accessibilityRole={"listitem" as any} style={{ flexDirection: "row", gap: 14 }}>
            <View style={{ alignItems: "center" }}>
              {marca}
              {!ultima ? <View style={{ width: 1.5, flex: 1, backgroundColor: BORDA_DE_CAMPO, marginVertical: 2 }} /> : null}
            </View>
            {texto}
          </View>
        );
      })}
    </View>
  );
}

function Cartao({ children, estilo, testID }: { children: React.ReactNode; estilo?: any; testID?: string }) {
  const T = usePaletaDaVitrine();
  return (
    <View testID={testID} style={[{ backgroundColor: T.card, borderRadius: 18, borderWidth: 1, borderColor: T.border, padding: 18, gap: 14 }, estilo]}>
      {children}
    </View>
  );
}

function Rotulo({ children }: { children: React.ReactNode }) {
  const T = usePaletaDaVitrine();
  return <Numero style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: T.ink3 }}>{children}</Numero>;
}

/** Os itens do pedido, com a miniatura, e a conta. */
function ItensDoPedido({ p }: { p: PedidoPublico }) {
  const T = usePaletaDaVitrine();
  const tipo = useTipografia();
  const retirada = p.entrega.tipo !== "delivery";
  const pago = estaPago(p);
  const linha = (rotulo: string, valor: React.ReactNode, cor?: string) => (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
      <Texto style={{ fontSize: 14, color: cor || T.ink2 }}>{rotulo}</Texto>
      {valor}
    </View>
  );
  return (
    <Cartao testID="itens-do-pedido">
      <Rotulo>Seus itens</Rotulo>
      {p.itens.map((i, k) => (
        <View key={k} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ width: 52, height: 52 }}>
            <View style={{ width: 52, height: 52, borderRadius: 10, borderWidth: 1, borderColor: T.border, backgroundColor: T.bg, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
              {i.imagem_url
                ? <Image source={{ uri: i.imagem_url }} style={{ width: 52, height: 52 }} resizeMode="cover" accessibilityIgnoresInvertColors />
                : <Texto style={{ fontFamily: tipo.display, fontSize: 18, color: T.ink3 }}>{i.nome.charAt(0)}</Texto>}
            </View>
            <View style={{ position: "absolute", top: -6, right: -6, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: T.ink, alignItems: "center", justifyContent: "center" }}>
              <Numero style={{ color: T.bg, fontSize: 10.5, fontWeight: "700" }}>{i.quantidade}</Numero>
            </View>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Texto style={{ fontSize: 14.5, fontWeight: "700", color: T.ink }} numberOfLines={2}>{i.nome}</Texto>
            {i.resumo.length ? <Texto style={{ fontSize: 12.5, color: T.ink3 }} numberOfLines={2}>{i.resumo.join(" · ")}</Texto> : null}
          </View>
          <Numero style={{ fontSize: 14, fontWeight: "700", color: T.ink }}>{dinheiro(i.total)}</Numero>
        </View>
      ))}
      <View style={{ height: 1, backgroundColor: T.border }} />
      {linha("Subtotal", <Numero style={{ fontSize: 14, color: T.ink }}>{dinheiro(p.subtotal)}</Numero>)}
      {linha(
        p.entrega.tipo === "delivery" ? "Entrega" : p.entrega.tipo === "courier" ? "Retirada por app" : "Retirada na loja",
        p.frete > 0
          ? <Numero style={{ fontSize: 14, color: T.ink }}>{dinheiro(p.frete)}</Numero>
          : <Texto style={{ fontSize: 14, fontWeight: "700", color: T.green }}>{p.entrega.tipo === "courier" ? "pago no app" : "Grátis"}</Texto>,
      )}
      {p.desconto_pix > 0 ? linha("Desconto no Pix", <Numero style={{ fontSize: 14, color: T.green }}>− {dinheiro(p.desconto_pix)}</Numero>, T.green) : null}
      <View style={{ height: 1, backgroundColor: T.border }} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
        <Texto style={{ fontSize: 16, fontWeight: "700", color: T.ink }}>
          {pago && p.payment_method === "pix" ? "Pago no Pix" : pago && p.payment_method === "card" ? "Pago no cartão" : "Total"}
        </Texto>
        <Numero style={{ fontSize: 20, color: T.ink }}>{dinheiro(p.total)}</Numero>
      </View>
      <View style={{ flexDirection: "row", gap: 10, backgroundColor: FUNDO_SUAVE, borderRadius: 12, padding: 12 }}>
        <Icon name={p.entrega.tipo === "delivery" ? "truck" : p.entrega.tipo === "courier" ? "moto" : "store"} size={16} color={T.ink} />
        <View style={{ flex: 1 }}>
          <Texto style={{ fontSize: 14, fontWeight: "700", color: T.ink }}>
            {p.entrega.tipo === "delivery" ? "Receber em casa" : p.entrega.tipo === "courier" ? "Retirada por app" : "Retirar na loja"}
          </Texto>
          <Texto style={{ fontSize: 13.5, lineHeight: 19, color: T.ink2 }}>
            {retirada
              ? [p.entrega.retirada_endereco, p.entrega.prazo_texto].filter(Boolean).join(" · ") || "Combine com a loja."
              : [p.entrega.bairro_cidade, p.entrega.prazo_texto].filter(Boolean).join(" · ")}
          </Texto>
          {p.entrega.courier_a_informar ? (
            <Texto style={{ fontSize: 13, lineHeight: 18, color: T.amber, marginTop: 4 }}>
              Falta dizer quem vai buscar: mande o nome e a placa para a loja pelo WhatsApp.
            </Texto>
          ) : null}
        </View>
      </View>
    </Cartao>
  );
}

export function PaginaDoPedido({ token, consulta }: { token: string; consulta?: Record<string, unknown> }) {
  const v = useVitrine();
  const sf = v?.sf;
  const slug = v?.slug || "";
  const T = usePaletaDaVitrine();
  const tipo = useTipografia();
  const { width } = useWindowDimensions();
  const larga = width >= 900;

  const retorno = lerRetorno(consulta?.retorno);
  const [pedido, setPedido] = useState<PedidoPublico | null>(null);
  const [estado, setEstado] = useState<"carregando" | "ok" | "nao_achado" | "erro">("carregando");
  const [celebrar, setCelebrar] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [verQr, setVerQr] = useState(false);
  const [verCodigoDeNovo, setVerCodigoDeNovo] = useState(false);
  const [marcando, setMarcando] = useState(false);
  const [comprovante, setComprovante] = useState<{ estado: "enviando" | "enviado" | "erro"; nome: string } | null>(null);
  const ultimoPix = useRef<PedidoPublico["pix"]>(null);
  const anterior = useRef<SituacaoDoPedido | null>(null);
  const consultas = useRef(0);

  // O id do pedido: da aba (feito aqui) ou do pedido em andamento da loja
  // (a volta do cartão). Sem ele, "Já paguei" e o comprovante somem.
  const [oid] = useState<string | null>(() => {
    const daAba = idDoPedido(token, storageDaAba());
    if (daAba) return daAba;
    const p = lerPedidoPendente(slug, storageLocal());
    return p && p.token === token ? p.id : null;
  });
  const [initPoint] = useState<string | null>(() => {
    const p = lerPedidoPendente(slug, storageLocal());
    return p && p.token === token ? p.card_init_point : null;
  });

  const buscar = useCallback(async () => {
    if (!slug || !token) return;
    try {
      const r = await fetch(`${API_BASE}/storefront/${slug}/studio/pedido/${encodeURIComponent(token)}`);
      if (r.status === 404) { setEstado("nao_achado"); return; }
      const j = await r.json().catch(() => null);
      const p = r.ok ? lerPedidoPublico(j) : null;
      if (!p) { setEstado((e) => (e === "ok" ? "ok" : "erro")); return; }
      if (p.pix) ultimoPix.current = p.pix;
      setPedido(p);
      setEstado("ok");
    } catch {
      setEstado((e) => (e === "ok" ? "ok" : "erro"));
    }
  }, [slug, token]);

  useEffect(() => { buscar(); }, [buscar]);

  const situacao: SituacaoDoPedido | null = pedido ? situacaoDoPedido(pedido, retorno) : null;

  // A mudança acontece sozinha: pagamento que entra enquanto a tela está
  // aberta vira "Pagamento recebido"; a volta do cartão aprovado também.
  useEffect(() => {
    if (!situacao) return;
    const antes = anterior.current;
    if (situacao === "confirmado" && pedido?.payment_method !== "on_delivery") {
      if ((antes && antes !== "confirmado") || (antes == null && retorno === "approved")) setCelebrar(true);
    }
    if (situacao === "confirmado" || situacao === "cancelado") {
      // Pago ou cancelado: não há pedido em andamento para a Tela 8.
      const pend = lerPedidoPendente(slug, storageLocal());
      if (pend && pend.token === token) esquecerPedidoPendente(slug, storageLocal());
    }
    anterior.current = situacao;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [situacao]);

  // Consulta a cada 4 s enquanto espera pagamento (pix.js da Negócio).
  useEffect(() => {
    if (!situacao || !deveConsultar(situacao)) return;
    if (consultas.current >= MAXIMO_DE_CONSULTAS) return;
    const t = setTimeout(() => { consultas.current += 1; buscar(); }, INTERVALO_DA_CONSULTA_MS);
    return () => clearTimeout(t);
  }, [situacao, pedido, buscar]);

  const nomeDaLoja = pedido?.loja?.nome || (sf?.store as any)?.site?.name || "A loja";
  const numero = numeroDoPedido(pedido?.numero);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    document.title = `${numero ? "Pedido " + numero : "Seu pedido"} · ${nomeDaLoja}`;
  }, [numero, nomeDaLoja]);

  const whatsDaLoja = numeroWhatsApp(pedido?.loja?.whatsapp || (sf?.store?.site as any)?.whatsapp);

  function copiar() {
    const code = pedido?.pix?.copia_e_cola || ultimoPix.current?.copia_e_cola;
    if (!code) return;
    const nav: any = typeof navigator !== "undefined" ? navigator : null;
    const feito = () => {
      setCopiado(true);
      v?.avisar("Código Pix copiado");
      setTimeout(() => setCopiado(false), 2000);
    };
    if (nav?.clipboard?.writeText) nav.clipboard.writeText(code).then(feito).catch(feito);
    else feito();
  }

  async function jaPaguei() {
    if (!oid || marcando) return;
    setMarcando(true);
    try {
      const r = await fetch(`${API_BASE}/storefront/${slug}/order/${encodeURIComponent(oid)}/mark-as-paid`, {
        method: "POST", headers: { "Content-Type": "application/json" },
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) v?.avisar(j?.error || "Não deu para avisar a loja agora. Tente de novo.", "info");
      await buscar();
    } catch {
      v?.avisar("Sem conexão. Tente de novo.", "info");
    } finally {
      setMarcando(false);
    }
  }

  function anexar() {
    if (!oid || Platform.OS !== "web" || typeof document === "undefined") return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,application/pdf";
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return;
      if (file.size > COMPROVANTE_MAX_BYTES) { v?.avisar("Arquivo grande demais (máximo 5 MB)", "info"); return; }
      setComprovante({ estado: "enviando", nome: file.name });
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = String(reader.result || "").split(",")[1];
        if (!base64) { setComprovante({ estado: "erro", nome: file.name }); return; }
        try {
          const r = await fetch(`${API_BASE}/storefront/${slug}/order/${encodeURIComponent(oid)}/upload-proof`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: base64, content_type: file.type || "image/jpeg" }),
          });
          setComprovante({ estado: r.ok ? "enviado" : "erro", nome: file.name });
          if (r.ok) buscar();
        } catch {
          setComprovante({ estado: "erro", nome: file.name });
        }
      };
      reader.onerror = () => setComprovante({ estado: "erro", nome: file.name });
      reader.readAsDataURL(file);
    };
    input.click();
  }

  const urlDaPagina = Platform.OS === "web" && typeof window !== "undefined"
    ? window.location.origin + window.location.pathname
    : `https://loja.getaura.com.br/${slug}/pedido/${token}`;

  // ── Cabeçalho ───────────────────────────────────────────────
  const cabecalho = (
    <View style={{ height: 60, borderBottomWidth: 1, borderBottomColor: T.border, flexDirection: "row", alignItems: "center", paddingHorizontal: 12 }}>
      <View style={{ width: 44 }} />
      <View style={{ flex: 1, alignItems: "center" }}>
        <Texto numberOfLines={1} style={{ fontFamily: tipo.display, fontSize: 20, color: T.ink }}>{nomeDaLoja}</Texto>
      </View>
      {whatsDaLoja ? (
        <Pressable
          onPress={() => Linking.openURL(`https://wa.me/${whatsDaLoja}`)}
          accessibilityRole="link"
          accessibilityLabel={`Falar com a ${nomeDaLoja} no WhatsApp`}
          style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
        >
          <Icon name="whatsapp" size={20} color={T.ink} />
        </Pressable>
      ) : <View style={{ width: 44 }} />}
    </View>
  );

  const casca = (conteudo: React.ReactNode, testID?: string) => (
    <View style={{ flex: 1, backgroundColor: T.bg }} testID={testID}>
      {cabecalho}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 22, paddingBottom: 40 }}>
        <View style={{ width: "100%", maxWidth: larga ? 1040 : 560, alignSelf: "center", gap: 16 }}>
          {conteudo}
          <View style={{ borderTopWidth: 1, borderTopColor: T.border, paddingTop: 16, marginTop: 10, alignItems: "center", gap: 4 }}>
            <Texto style={{ fontSize: 12.5, color: T.ink3 }}>{nomeDaLoja}</Texto>
            <Texto style={{ fontSize: 12.5, color: T.ink3 }}>Loja desenvolvida com Aura.</Texto>
          </View>
        </View>
      </ScrollView>
      <BarraDeCookies />
    </View>
  );

  const centro = (children: React.ReactNode) => (
    <View style={{ alignItems: "center", gap: 10, paddingTop: 10 }}>{children}</View>
  );
  const titulo = (t: string) => (
    <Texto accessibilityRole="header" style={{ fontFamily: tipo.display, fontSize: 27, lineHeight: 33, color: T.ink, textAlign: "center" }}>{t}</Texto>
  );
  const texto = (t: string) => (
    <Texto style={{ fontSize: 15, lineHeight: 23, color: T.ink2, textAlign: "center", maxWidth: 440 }}>{t}</Texto>
  );
  const rotuloDoNumero = numero ? <Numero style={{ fontSize: 12, letterSpacing: 1.8, textTransform: "uppercase", color: T.ink3 }}>Pedido {numero}</Numero> : null;

  if (estado === "carregando") {
    return casca(
      centro(<Texto style={{ fontSize: 15, color: T.ink3, paddingVertical: 60 }} accessibilityLiveRegion="polite">Abrindo seu pedido…</Texto>),
      "pedido-carregando",
    );
  }
  if (estado === "nao_achado" || (estado === "erro" && !pedido)) {
    const achou = estado === "erro";
    return casca(centro(
      <>
        <Circulo icone={achou ? "alert" : "search"} cor={achou ? T.red : T.ink3} fundo={achou ? wash(T.red, 0.1) : FUNDO_APAGADO} />
        {titulo(achou ? "O pedido não carregou" : "Não achamos esse pedido")}
        {texto(achou ? "Pode ser a conexão. Tente de novo em instantes — o pedido continua guardado." : "Confira o link que você recebeu, ou fale com a loja pelo WhatsApp.")}
        <View style={{ minWidth: 220, marginTop: 8 }}>
          {achou
            ? <Botao titulo="Tentar de novo" icone="refresh" onPress={() => { setEstado("carregando"); buscar(); }} />
            : <Botao titulo="Ir para a loja" onPress={() => sf?.goTo("list")} />}
        </View>
      </>,
    ), achou ? "pedido-erro" : "pedido-nao-achado");
  }
  if (!pedido || !situacao) return null;
  const p = pedido;
  const pixPct = Number((sf?.store as any)?.payment?.pix_discount_pct) || 0;

  // ── Pagamento recebido / aprovado (a tela muda sozinha) ─────
  if (celebrar) {
    const cartao = p.payment_method === "card";
    return casca(
      <View style={{ gap: 18 }}>
        {centro(
          <>
            <Circulo icone="check" cor={T.green} fundo={wash(T.green, 0.12)} />
            {rotuloDoNumero}
            {titulo(cartao ? "Pagamento aprovado" : "Pagamento recebido")}
            {texto(`${cartao ? dinheiro(p.total) + " no cartão. " : ""}A ${nomeDaLoja} já está com o seu pedido e manda o mockup no seu WhatsApp para você aprovar.`)}
          </>,
        )}
        <Cartao estilo={{ maxWidth: larga ? 720 : undefined, alignSelf: larga ? "center" : undefined, width: "100%" }}>
          <LinhaDoTempo p={p} loja={nomeDaLoja} horizontal={larga} />
        </Cartao>
        <View style={{ width: "100%", maxWidth: 360, alignSelf: "center" }}>
          <Botao testID="ver-meu-pedido" titulo="Ver meu pedido" iconeDepois="arrow_right" variante="escuro" onPress={() => setCelebrar(false)} />
        </View>
      </View>,
      "pagamento-recebido",
    );
  }

  // ── Cancelado ───────────────────────────────────────────────
  if (situacao === "cancelado") {
    return casca(centro(
      <>
        <Circulo icone="x_circle" cor={T.ink3} fundo={FUNDO_APAGADO} />
        {rotuloDoNumero}
        {titulo("Este pedido foi cancelado")}
        {texto(p.payment_method === "pix"
          ? "O Pix não foi pago em 72 horas e o pedido cancelou sozinho. Se ainda quiser a peça, é só montar de novo."
          : `O pedido foi cancelado. Qualquer dúvida, fale com a ${nomeDaLoja} pelo WhatsApp.`)}
        <View style={{ minWidth: 220, marginTop: 8 }}>
          <Botao titulo="Voltar para a loja" onPress={() => sf?.goTo("list")} />
        </View>
      </>,
    ), "pedido-cancelado");
  }

  // ── Cartão (Tela 6) ─────────────────────────────────────────
  if (situacao === "cartao_recusado" || situacao === "cartao_analise" || situacao === "cartao_pendente") {
    const recusado = situacao === "cartao_recusado";
    const analise = situacao === "cartao_analise";
    const descPix = descontoDoPix(p.subtotal, pixPct);
    const msgPix = whatsDaLoja
      ? `https://wa.me/${whatsDaLoja}?text=${encodeURIComponent(`Olá! O cartão do pedido ${numero} não foi aprovado. Posso pagar com Pix?`)}`
      : null;
    return casca(centro(
      <>
        <Circulo icone={recusado ? "alert" : analise ? "clock" : "credit_card"} cor={recusado ? T.red : T.amber} fundo={recusado ? wash(T.red, 0.1) : wash(T.amber, 0.12)} />
        {rotuloDoNumero}
        {titulo(recusado ? "O pagamento não foi aprovado" : analise && retorno === "approved" ? "Confirmando o pagamento" : analise ? "Pagamento em análise" : "Falta pagar no cartão")}
        {texto(recusado
          ? "Nada foi cobrado. Costuma ser limite do cartão ou um número digitado diferente. Seu pedido continua guardado por 72 horas."
          : analise && retorno === "approved"
            // O back_url chega antes do aviso do Mercado Pago (webhook): a
            // tela confere até ele chegar, como o bootstrap.js da Negócio.
            ? `O Mercado Pago aprovou ${dinheiro(p.total)} e a confirmação está chegando na loja. Costuma levar alguns segundos; se demorar, o aviso chega no seu WhatsApp.`
          : analise
            ? `O Mercado Pago está conferindo o pagamento de ${dinheiro(p.total)}. Costuma levar poucos minutos. Seu pedido está guardado: você pode fechar esta página e o aviso chega no WhatsApp.`
            : `Você paga ${dinheiro(p.total)} no Mercado Pago e volta pra cá. O pedido fica guardado enquanto isso.`)}
        {analise ? <ConfereSozinha texto="Conferindo de novo em alguns segundos" /> : null}
        <View style={{ width: "100%", maxWidth: 360, gap: 10, marginTop: 6 }}>
          {recusado || situacao === "cartao_pendente" ? (
            initPoint || p.cartao?.init_point ? (
              <Botao
                testID="tentar-outro-cartao" titulo={recusado ? "Tentar outro cartão" : "Pagar no cartão"} icone="credit_card" variante="escuro"
                onPress={() => { const u = p.cartao?.init_point || initPoint; if (u) Linking.openURL(u); }}
              />
            ) : null
          ) : null}
          {recusado && msgPix ? (
            <>
              <Botao testID="pagar-com-pix" titulo={`Pagar com Pix · ${dinheiro(p.total - descPix)}`} icone="pix" variante="pix" onPress={() => Linking.openURL(msgPix)} />
              {descPix > 0 ? (
                <Texto style={{ fontSize: 13, fontWeight: "600", color: T.green, textAlign: "center" }}>{`No Pix você ainda economiza ${dinheiro(descPix)}`}</Texto>
              ) : null}
            </>
          ) : null}
          {analise && p.acompanhar_url ? (
            <Botao titulo="Acompanhar pedido" icone="eye" variante="secundario" onPress={() => Linking.openURL(p.acompanhar_url!)} />
          ) : null}
        </View>
      </>,
    ), "pedido-cartao");
  }

  // ── Pix pendente e "aguardando a loja" (Tela 5) ─────────────
  const pecas = p.itens.reduce((n, i) => n + i.quantidade, 0);
  const rodapeDoPix = (
    <Texto style={{ fontSize: 13, lineHeight: 19, color: T.ink3, textAlign: "center" }}>
      {`${pecas} ${pecas === 1 ? "peça" : "peças"} · ${p.entrega.tipo === "delivery" ? "Receber em casa" : p.entrega.tipo === "courier" ? "Retirada por app" : "Retirar na loja"}${p.prazo_dias_uteis ? ` · pronto em ${diasUteis(p.prazo_dias_uteis)} após aprovação da arte` : ""}`}
    </Texto>
  );
  const blocoDoComprovante = oid ? (
    comprovante?.estado === "enviado" || p.comprovante_enviado ? (
      <View testID="comprovante-enviado" style={{ flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: wash(T.green, 0.1), borderWidth: 1, borderColor: T.green, borderRadius: 16, padding: 14 }}>
        <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: T.green, alignItems: "center", justifyContent: "center" }}>
          <Icon name="check" size={18} color={tintaSobre(T.green)} />
        </View>
        <View style={{ flex: 1 }}>
          <Texto style={{ fontSize: 14.5, fontWeight: "700", color: T.ink }}>Comprovante enviado</Texto>
          <Texto style={{ fontSize: 13, color: T.ink2 }}>{`${comprovante?.nome ? comprovante.nome + " · " : ""}a ${nomeDaLoja} já pode conferir`}</Texto>
        </View>
      </View>
    ) : (
      <Pressable
        testID="anexar-comprovante"
        onPress={anexar}
        disabled={comprovante?.estado === "enviando"}
        accessibilityRole="button"
        accessibilityLabel="Anexar comprovante, opcional. Anexar agiliza a confirmação da loja."
        style={{ flexDirection: "row", gap: 12, alignItems: "center", borderWidth: 1, borderStyle: "dashed", borderColor: BORDA_DE_CAMPO, borderRadius: 16, padding: 14 }}
      >
        <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: FUNDO_APAGADO, alignItems: "center", justifyContent: "center" }}>
          <Icon name="upload" size={18} color={T.ink} />
        </View>
        <View style={{ flex: 1 }}>
          <Texto style={{ fontSize: 14.5, fontWeight: "700", color: T.ink }}>
            {comprovante?.estado === "enviando" ? "Enviando o comprovante…" : comprovante?.estado === "erro" ? "Não foi. Tentar de novo" : "Anexar comprovante"}
            {!comprovante ? <Texto style={{ fontWeight: "400", color: T.ink3, fontSize: 13 }}> (opcional)</Texto> : null}
          </Texto>
          <Texto style={{ fontSize: 13, color: T.ink3 }}>Anexar agiliza a confirmação da loja.</Texto>
        </View>
      </Pressable>
    )
  ) : null;

  if (situacao === "pix" || situacao === "aguardando") {
    const pix = p.pix || (verCodigoDeNovo ? ultimoPix.current : null);
    const aguardando = situacao === "aguardando";
    const blocoDoCodigo = pix ? (
      <Cartao testID="codigo-pix">
        <Rotulo>Pix copia e cola</Rotulo>
        <View style={{ backgroundColor: FUNDO_SUAVE, borderRadius: 12, padding: 12, maxHeight: 84, overflow: "hidden" }}>
          <Texto selectable numberOfLines={3} style={[estiloNumero(tipo), { fontSize: 13, lineHeight: 19, color: T.ink2 }]}>{pix.copia_e_cola}</Texto>
        </View>
        <Botao
          testID="copiar-pix" titulo={copiado ? "Copiado" : "Copiar código Pix"} icone={copiado ? "check" : "copy"} variante="pix"
          onPress={copiar} acessivel={copiado ? "Código Pix copiado" : "Copiar código Pix"}
        />
      </Cartao>
    ) : null;
    const passos = (
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Icon name="clock" size={16} color={T.amber} />
          <Texto style={{ flex: 1, fontSize: 14, lineHeight: 20, color: T.ink2 }}>{fraseDaValidade(pix?.expira_em)}</Texto>
        </View>
        {[
          <>Toque em <Texto style={{ fontWeight: "700", color: T.ink }}>Copiar código Pix</Texto>.</>,
          <>No app do banco, escolha <Texto style={{ fontWeight: "700", color: T.ink }}>Pix Copia e Cola</Texto> e cole.</>,
          <>Volte aqui: esta tela muda sozinha quando o pagamento entrar.</>,
        ].map((t, i) => (
          <View key={i} style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: FUNDO_APAGADO, alignItems: "center", justifyContent: "center" }}>
              <Numero style={{ fontSize: 12.5, fontWeight: "700", color: T.ink }}>{i + 1}</Numero>
            </View>
            <Texto style={{ flex: 1, fontSize: 14.5, lineHeight: 21, color: T.ink2 }}>{t}</Texto>
          </View>
        ))}
      </View>
    );

    if (aguardando) {
      return casca(
        <View style={{ gap: 16, width: "100%", maxWidth: 560, alignSelf: "center" }}>
          <Cartao testID="aguardando-loja" estilo={{ alignItems: "center", paddingVertical: 24 }}>
            <Circulo icone="clock" cor={T.amber} fundo={wash(T.amber, 0.12)} tamanho={56} />
            <Texto accessibilityRole="header" style={{ fontFamily: tipo.display, fontSize: 22, color: T.ink, textAlign: "center" }}>Aguardando a loja confirmar</Texto>
            <Texto style={{ fontSize: 14.5, lineHeight: 22, color: T.ink2, textAlign: "center" }}>
              {`Avisamos a ${nomeDaLoja} que você pagou ${dinheiro(p.total)}. Assim que o Pix aparecer para ela, esta tela muda sozinha e você recebe a confirmação no WhatsApp.`}
            </Texto>
            <ConfereSozinha />
          </Cartao>
          {!pix && ultimoPix.current ? (
            <Pressable onPress={() => setVerCodigoDeNovo(true)} accessibilityRole="button" style={{ flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", minHeight: 44 }}>
              <Icon name="copy" size={15} color={T.ink} />
              <Texto style={{ fontSize: 14, fontWeight: "700", color: T.ink, textDecorationLine: "underline" }}>Ainda não pagou? Ver o código de novo</Texto>
            </Pressable>
          ) : null}
          {blocoDoCodigo}
          {blocoDoComprovante}
          {rodapeDoPix}
        </View>,
        "pedido-aguardando",
      );
    }

    const acoes = (
      <View style={{ gap: 12 }}>
        {blocoDoComprovante}
        {oid ? (
          <Botao testID="ja-paguei" titulo={marcando ? "Avisando a loja…" : "Já paguei"} icone="check" variante="secundario" desativado={marcando} onPress={jaPaguei} />
        ) : null}
        <ConfereSozinha />
      </View>
    );
    const topo = (
      <View style={{ alignItems: "center", gap: 6 }}>
        {rotuloDoNumero}
        <Texto accessibilityRole="header" style={{ fontFamily: tipo.display, fontSize: 27, color: T.ink, textAlign: "center" }}>Falta só o Pix</Texto>
        <Numero testID="valor-do-pix" style={{ fontSize: 38, fontWeight: "600", color: T.ink, letterSpacing: -0.5 }}>{dinheiro(p.total)}</Numero>
        {p.desconto_pix > 0 ? (
          <Texto style={{ fontSize: 14, fontWeight: "700", color: T.green }}>{`Você economiza ${dinheiro(p.desconto_pix)} pagando no Pix`}</Texto>
        ) : null}
      </View>
    );

    if (larga && pix) {
      return casca(
        <View style={{ flexDirection: "row", width: "100%", maxWidth: 900, alignSelf: "center", backgroundColor: T.card, borderRadius: 22, borderWidth: 1, borderColor: T.border, overflow: "hidden" }} testID="tela-do-pix">
          <View style={{ width: 340, backgroundColor: FUNDO_SUAVE, padding: 26, alignItems: "center", gap: 14 }}>
            <Rotulo>Aponte a câmera do banco</Rotulo>
            <QrDoPix pix={pix} tamanho={220} />
            <Texto selectable numberOfLines={3} style={[estiloNumero(tipo), { fontSize: 11.5, color: T.ink3, textAlign: "center" }]}>{pix.copia_e_cola}</Texto>
            <Botao titulo={copiado ? "Copiado" : "Copiar código Pix"} icone={copiado ? "check" : "copy"} variante="secundario" onPress={copiar} />
          </View>
          <View style={{ flex: 1, padding: 28, gap: 18 }}>
            <View style={{ gap: 6 }}>
              {rotuloDoNumero}
              <Texto accessibilityRole="header" style={{ fontFamily: tipo.display, fontSize: 26, color: T.ink }}>Falta só o Pix</Texto>
              <Numero style={{ fontSize: 34, color: T.ink }}>{dinheiro(p.total)}</Numero>
              {p.desconto_pix > 0 ? <Texto style={{ fontSize: 13.5, fontWeight: "700", color: T.green }}>{`Você economiza ${dinheiro(p.desconto_pix)} pagando no Pix`}</Texto> : null}
            </View>
            {passos}
            {acoes}
            {rodapeDoPix}
          </View>
        </View>,
        "tela-do-pix",
      );
    }

    return casca(
      <View style={{ gap: 18 }} testID="tela-do-pix">
        {topo}
        {blocoDoCodigo}
        {passos}
        {pix ? (
          verQr ? (
            <View style={{ alignItems: "center", gap: 10 }}>
              <QrDoPix pix={pix} tamanho={200} />
              <Pressable onPress={() => setVerQr(false)} accessibilityRole="button" style={{ minHeight: 44, justifyContent: "center" }}>
                <Texto style={{ fontSize: 13.5, fontWeight: "700", color: T.ink, textDecorationLine: "underline" }}>Esconder o QR Code</Texto>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => setVerQr(true)} accessibilityRole="button" style={{ flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center", minHeight: 44 }}>
              <Icon name="qr_code" size={16} color={T.ink} />
              <Texto style={{ fontSize: 14, fontWeight: "700", color: T.ink, textDecorationLine: "underline", textAlign: "center", flexShrink: 1 }}>
                Mostrar o QR Code (para pagar com outro celular)
              </Texto>
            </Pressable>
          )
        ) : null}
        <View style={{ height: 1, backgroundColor: T.border }} />
        {acoes}
        {rodapeDoPix}
      </View>,
      "tela-do-pix",
    );
  }

  // ── Confirmação (Tela 7) ────────────────────────────────────
  const pago = estaPago(p);
  const chip = p.payment_method === "on_delivery"
    ? { texto: p.entrega.tipo === "delivery" ? "Pagar na entrega" : "Pagar na retirada", cor: T.amber }
    : { texto: p.payment_method === "card" ? "Pago no cartão" : "Pago no Pix", cor: T.green };
  const rev = p.revisoes;
  const fraseRev = rev && rev.max_included > 0
    ? `Nada vai para a produção sem o seu ok. ${rev.max_included} ${rev.max_included === 1 ? "revisão inclusa" : "revisões inclusas"}${rev.extra_price > 0 ? `; a partir da ${rev.max_included + 1}ª, ${dinheiro(rev.extra_price)} cada` : ""}.`
    : "Nada vai para a produção sem o seu ok.";
  const colunaPrincipal = (
    <View style={{ gap: 16, flex: larga ? 1 : undefined }}>
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", alignSelf: "flex-start", alignItems: "center", gap: 6, backgroundColor: wash(chip.cor, 0.12), borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}>
          <Icon name={pago ? "check" : "cash"} size={13} color={chip.cor} />
          <Numero style={{ fontSize: 11.5, letterSpacing: 1.3, textTransform: "uppercase", fontWeight: "600", color: chip.cor }}>{chip.texto}</Numero>
        </View>
        <Texto accessibilityRole="header" style={{ fontFamily: tipo.display, fontSize: 28, lineHeight: 34, color: T.ink }}>
          {p.cliente_primeiro_nome ? `Pedido recebido, ${p.cliente_primeiro_nome}.` : "Pedido recebido."}
        </Texto>
        <Texto style={{ fontSize: 14, color: T.ink2 }}>
          {`Pedido ${numero}${p.criado_em ? " · feito em " + dataCompleta(p.criado_em) : ""}`}
        </Texto>
      </View>
      <Cartao>
        <Rotulo>Onde está o seu pedido</Rotulo>
        <LinhaDoTempo p={p} loja={nomeDaLoja} horizontal={larga} />
      </Cartao>
      <View style={{ backgroundColor: FUNDO_APAGADO, borderRadius: 18, padding: 18, gap: 10, borderWidth: 1, borderColor: T.border }}>
        <Rotulo>O que acontece agora</Rotulo>
        <Texto style={{ fontFamily: tipo.display, fontSize: 20, lineHeight: 26, color: T.ink }}>
          {`A ${nomeDaLoja} prepara o mockup e manda no seu WhatsApp para você aprovar.`}
        </Texto>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Icon name="eye" size={15} color={T.ink2} />
          <Texto style={{ flex: 1, fontSize: 13.5, lineHeight: 20, color: T.ink2 }}>{fraseRev}</Texto>
        </View>
        {rev?.policy_text ? <Texto style={{ fontSize: 13, lineHeight: 19, color: T.ink3 }}>{rev.policy_text}</Texto> : null}
      </View>
      <View style={{ gap: 10 }}>
        {p.acompanhar_url ? (
          <Botao testID="acompanhar-pedido" titulo="Acompanhar pedido" icone="eye" variante="escuro" onPress={() => Linking.openURL(p.acompanhar_url!)} />
        ) : null}
        <Botao
          testID="guardar-link" titulo="Guardar este link no WhatsApp" icone="whatsapp" variante="whatsapp"
          onPress={() => Linking.openURL(linkParaGuardar(urlDaPagina, nomeDaLoja))}
        />
        <Pressable onPress={() => sf?.goTo("list")} accessibilityRole="button" style={{ flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", minHeight: 48 }}>
          <Icon name="edit" size={15} color={T.ink} />
          <Texto style={{ fontSize: 15, fontWeight: "700", color: T.ink }}>Personalizar outra peça</Texto>
        </Pressable>
      </View>
    </View>
  );
  return casca(
    larga ? (
      <View style={{ flexDirection: "row", gap: 24, alignItems: "flex-start" }}>
        {colunaPrincipal}
        <View style={{ width: 380 }}><ItensDoPedido p={p} /></View>
      </View>
    ) : (
      <View style={{ gap: 16 }}>
        {colunaPrincipal}
        <ItensDoPedido p={p} />
      </View>
    ),
    "confirmacao-do-pedido",
  );
}
