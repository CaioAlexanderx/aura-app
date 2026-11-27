// ============================================================
// configUi — peças compartilhadas das telas de cada automática
//
// Passo (linha numerada do vidro), Secao (bloco com título grande),
// Pilulas, PilulaToggle, Interruptor, BolhaExemplo (a mensagem como a
// cliente vê, dentro do celular) e PreviaCorteView ("Cabem N de M", quem
// fica de fora apagado, "Trazer N do Venda+").
// A cara vem de waVidro (artboards aprovados); aqui só estrutura e estilo.
// ============================================================
import React from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import type { Corte } from "./waCorte";
import { useSetas } from "./waTeclado";
import { useWaPacotes } from "@/hooks/useWaPacotes";
import { singularDe } from "./waRotulos";
import {
  Avatar, Celular, Lnk, Meta, Pilula, Selo, Sw, Superficie, Titulo, V, WEB, estiloBolha, t, MONO, SANS,
} from "./waVidro";

/** Linha numerada (.sec): número grande vazado, título 20px, escolhas, nota. */
export function Passo({ n, titulo, sub, children, primeiro }: {
  n?: string; titulo: string; sub?: string; children?: React.ReactNode; primeiro?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row", gap: 18, paddingVertical: 22, minWidth: 0,
        borderTopWidth: primeiro ? 0 : 1, borderTopColor: V.rule,
      }}
    >
      {!!n && (
        <Text
          style={{
            fontFamily: SANS, fontWeight: "800", fontSize: 40, lineHeight: 40, letterSpacing: -1.6,
            color: WEB ? "transparent" : V.numLine, minWidth: 54,
            ...(WEB ? { WebkitTextStroke: `1.5px ${V.numLine}` } : {}),
          } as any}
        >
          {n}
        </Text>
      )}
      <View style={{ flex: 1, minWidth: 0, gap: 12 }}>
        <Text style={t(20, V.ink, "800", { letterSpacing: -0.4, lineHeight: 26 })}>{titulo}</Text>
        {children}
        {!!sub && <Text style={t(13, V.ink3)}>{sub}</Text>}
      </View>
    </View>
  );
}

/** Seção com meta + título grande (Crediário: "01 · Cobrar" / "Avisos de parcela."). */
export function Secao({ meta, titulo, sub, children, variante = "solid", direita, testID }: {
  meta: string; titulo: string; sub?: string; children?: React.ReactNode; variante?: "glass" | "solid"; direita?: React.ReactNode; testID?: string;
}) {
  return (
    <Superficie variante={variante} raio={30} padding={{ h: 30, v: 26 }} gap={22} testID={testID}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <View style={{ gap: 6, flexShrink: 1, flexGrow: 1, flexBasis: 280, maxWidth: 740 }}>
          <Meta>{meta}</Meta>
          <Titulo tamanho={30}>{titulo}</Titulo>
          {!!sub && <Text style={t(15, V.ink2)}>{sub}</Text>}
        </View>
        {direita}
      </View>
      {children}
    </Superficie>
  );
}

export interface Opcao<T extends string> { valor: T; rotulo: string }

export function Pilulas<T extends string>({
  opcoes, valor, onPick, desabilitado, idBase, comCheck, rotulo,
}: { opcoes: Opcao<T>[]; valor: T | null | undefined; onPick: (v: T) => void; desabilitado?: boolean; idBase: string; comCheck?: boolean; rotulo?: string }) {
  // Escolha única (radiogroup): uma só parada de Tab; as setas movem e escolhem.
  const atual = opcoes.findIndex((o) => o.valor === valor);
  const { propsDoItem } = useSetas({
    qtd: opcoes.length, ativo: atual, ativarAoMover: true, desabilitados: desabilitado ? opcoes.map(() => true) : undefined,
    aoMover: (i) => { if (!desabilitado) onPick(opcoes[i].valor); },
  });
  return (
    <View accessibilityRole="radiogroup" aria-label={rotulo || idBase} style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {opcoes.map((o, i) => {
        const on = o.valor === valor;
        return (
          <Pilula
            key={o.valor} role="radio" ligada={on} desabilitado={desabilitado} onPress={() => onPick(o.valor)}
            estado={{ checked: on, selected: on, disabled: !!desabilitado }} nav={propsDoItem(i)}
            testID={`${idBase}-${o.valor}`}
          >
            {comCheck && <Caixa marcada={on} />}
            <Text style={t(14, on ? V.onTxt : V.ink, "600")}>{o.rotulo}</Text>
          </Pilula>
        );
      })}
    </View>
  );
}
/** O quadradinho .chk das pílulas de "Quando sai". */
function Caixa({ marcada }: { marcada: boolean }) {
  return (
    <View
      style={{
        width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, alignItems: "center", justifyContent: "center",
        borderColor: marcada ? "#e9e3ff" : V.chkLine, backgroundColor: marcada ? "#e9e3ff" : "transparent",
      }}
    >
      {marcada && <Text style={t(13, "#1b1338", "800", { lineHeight: 15 })}>✓</Text>}
    </View>
  );
}

/** Liga/desliga de uma pílula (vários podem estar ligados ao mesmo tempo). */
export function PilulaToggle({
  rotulo, ligada, onToggle, desabilitado, testID,
}: { rotulo: string; ligada: boolean; onToggle: () => void; desabilitado?: boolean; testID: string }) {
  return (
    <Pilula
      role="checkbox" ligada={ligada} onPress={onToggle} desabilitado={desabilitado} testID={testID}
      estado={{ checked: ligada, disabled: !!desabilitado }}
    >
      <Caixa marcada={ligada} />
      <Text style={t(14, ligada ? V.onTxt : V.ink, "600")}>{rotulo}</Text>
    </Pilula>
  );
}

export function Interruptor({
  ligado, onToggle, desabilitado, rotulo, testID,
}: { ligado: boolean; onToggle: () => void; desabilitado?: boolean; rotulo: string; testID: string }) {
  return <Sw ligado={ligado} onToggle={onToggle} desabilitado={desabilitado} rotulo={rotulo} testID={testID} />;
}

/** A mensagem como a cliente vê, dentro do celular do mockup. */
export function BolhaExemplo({ titulo, mensagem, rodape, loja, presente }: {
  titulo: string; mensagem: string | null | undefined; rodape?: boolean; loja?: string;
  /** Aniversário: o presente que vai junto (rótulo já legível). */
  presente?: { de: string; rotulo: string; codigo?: string; validade?: string } | null;
}) {
  // Sem exemplo, não inventa texto.
  if (!mensagem) return null;
  return (
    <Celular loja={loja || ""} legenda={titulo} minAltura={220} testID="wa-config-bolha">
      <View style={estiloBolha()}>
        <Text style={t(15, V.ink, "400", { lineHeight: 22 })}>{mensagem}</Text>
        {rodape !== false && <Text style={t(12, V.ink3, "400", { marginTop: 6 })}>Para não receber mais, responda SAIR.</Text>}
        <Text style={t(12, V.ink3, "400", { marginTop: 4, textAlign: "right" })}>10:00</Text>
      </View>
      {!!presente && (
        <View
          style={[{
            alignSelf: "flex-end", width: "94%", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 14, gap: 4,
            borderWidth: 1, borderStyle: "dashed", borderColor: "rgba(196,181,253,.6)",
          } as any, WEB ? ({ backgroundImage: "linear-gradient(150deg,rgba(255,255,255,.14),rgba(255,255,255,.04))" } as any) : null]}
          testID="wa-config-bolha-presente"
        >
          <Meta style={{ color: "#e9e3ff" }}>Presente da {presente.de}</Meta>
          <Text style={t(22, V.ink, "800", { letterSpacing: -0.4 })}>{presente.rotulo}</Text>
          {!!presente.codigo && <Text style={{ fontFamily: MONO, fontSize: 13, color: V.acc } as any}>{presente.codigo}</Text>}
          <Text style={t(12, V.ink3)}>{presente.validade ? `vale até ${presente.validade}` : "vale 15 dias"} · na loja e no site</Text>
        </View>
      )}
    </Celular>
  );
}

/** "Adicionar 100 novidades por R$ 69": pede o link de pagamento do pacote (nada é cobrado sozinho). */
export function LinkPacote({ companyId }: { companyId?: string | null }) {
  const pac = useWaPacotes(companyId, false);
  if (!companyId) return null;
  return (
    <View style={{ gap: 4 }} testID="wa-pacote-novidades-bloco">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {pac.comprando === "novidades" && <ActivityIndicator size="small" color={V.acc} />}
        <Lnk onPress={() => pac.comprar("novidades")} desabilitado={pac.comprando !== null} testID="wa-pacote-novidades">
          Adicionar 100 novidades por R$ 69
        </Lnk>
      </View>
      {!!pac.erro && <Text style={t(13, V.bad, "600")} testID="wa-pacote-novidades-erro">{pac.erro}</Text>}
      {pac.abaBloqueada && <Text style={t(13, V.ink3)}>Se o pagamento não abriu, toque de novo.</Text>}
      {!!pac.manual && (
        <Text style={t(13, V.ink3)}>Pedido registrado. A Aura vai te chamar para combinar o pagamento e soma o pacote depois que for confirmado.</Text>
      )}
    </View>
  );
}

interface PreviaProps {
  /** Com a loja, aparece o link para adicionar novidades quando não cabe todo mundo. */
  companyId?: string | null;
  corte: Corte | null;
  /** "aniversariantes", "clientes"... */
  substantivo: string;
  /** Nome da reserva: "Aniversário", "Venda+", "Crediário". */
  dono: string;
  /** Novidades que sobram para o dono (para "Usa N das M guardadas"). */
  reserva: number | null | undefined;
  trazer: number;
  onTrazer?: () => void;
  trazendo?: boolean;
  idBase: string;
  /** avatares: círculos com iniciais (Aniversário); linhas: um cartão por pessoa (Crediário). */
  estilo?: "avatares" | "linhas";
}

export function PreviaCorteView({ corte, substantivo, dono, reserva, trazer, onTrazer, trazendo, idBase, estilo = "linhas", companyId }: PreviaProps) {
  if (!corte) {
    return (
      <Text style={t(14, V.warn, "600")} testID={`${idBase}-previa-indisponivel`}>
        Não consegui calcular quem cabe agora. Por segurança, nada é enviado até eu conseguir.
      </Text>
    );
  }
  const fica = corte.total - corte.cabem;
  return (
    <View style={{ gap: 12 }} testID={`${idBase}-previa`}>
      <Text style={t(15, corte.cabeTodos ? V.ok : V.warn, "700")} testID={`${idBase}-cabem`}>
        {corte.cabeTodos ? "Cabe todo mundo." : `${corte.cabem === 1 ? "Cabe" : "Cabem"} ${corte.cabem} de ${corte.total}.`}
      </Text>
      <Text style={t(15, V.ink2)}>
        {corte.cabeTodos
          ? `Usa ${corte.precisa} ${(reserva ?? 0) === 1 ? "da" : "das"} ${(reserva ?? 0) === 1 ? "1 novidade guardada" : `${reserva ?? 0} novidades guardadas`} para ${dono}.`
          : `${fica === 1 ? `1 ${singularDe(substantivo)} fica` : `${fica} ${substantivo} ficam`} sem a mensagem${corte.ordem ? ` (${corte.ordem})` : ""}. Ninguém recebe além do que cabe.`}
      </Text>

      {estilo === "avatares" ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
          {corte.recebem.map((p) => (
            <View key={`r-${p.nome}`} testID={`${idBase}-recebe`} accessibilityLabel={p.nome} style={{ alignItems: "center", gap: 2 }}>
              <Avatar nome={p.nome} />
              <Text style={t(11, V.ink2, "600", { lineHeight: 14 })}>{p.nome}</Text>
              {!!p.detalhe && <Text style={t(11, V.ink3, "400", { lineHeight: 14 })}>{p.detalhe}</Text>}
            </View>
          ))}
          {corte.ficam.map((p) => (
            <View key={`f-${p.nome}`} testID={`${idBase}-fora`} accessibilityLabel={`${p.nome} · fica de fora`} style={{ alignItems: "center", gap: 2, opacity: 0.35 }}>
              <Avatar nome={p.nome} />
              <Text style={t(11, V.ink2, "600", { lineHeight: 14 })}>{p.nome} · fica de fora</Text>
              {!!p.detalhe && <Text style={t(11, V.ink3, "400", { lineHeight: 14 })}>{p.detalhe}</Text>}
            </View>
          ))}
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {corte.recebem.map((p) => (
            <View
              key={`r-${p.nome}`} testID={`${idBase}-recebe`}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 18, borderWidth: 1, borderColor: V.tokLine, backgroundColor: V.tokBg }}
            >
              <Avatar nome={p.nome} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={t(15, V.ink, "700")}>{p.nome}</Text>
                {!!p.detalhe && <Text style={t(13, V.ink2)}>{p.detalhe}</Text>}
              </View>
              {typeof p.limiteLivre === "number" && (
                <Selo texto={`R$ ${String(Math.round(p.limiteLivre)).replace(/\B(?=(\d{3})+(?!\d))/g, ".")} livres`} tom="ok" testID={`${idBase}-limite`} />
              )}
            </View>
          ))}
          {corte.ficam.map((p) => (
            <View
              key={`f-${p.nome}`} testID={`${idBase}-fora`}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 18, opacity: 0.45 }}
            >
              <Avatar nome={p.nome} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={t(15, V.ink, "700")}>{p.nome} · fica de fora</Text>
                {!!p.detalhe && <Text style={t(13, V.ink2)}>{p.detalhe}</Text>}
              </View>
            </View>
          ))}
        </View>
      )}
      {corte.alemDaLista > 0 && <Text style={t(14, V.ink2)}>e mais {corte.alemDaLista === 1 ? `1 ${singularDe(substantivo)}` : `${corte.alemDaLista} ${substantivo}`}</Text>}

      {!corte.cabeTodos && !!companyId && <LinkPacote companyId={companyId} />}

      {trazer > 0 && !!onTrazer && (
        <Pilula ligada onPress={onTrazer} desabilitado={trazendo} testID={`${idBase}-trazer`} style={{ alignSelf: "flex-start" }}>
          {trazendo && <ActivityIndicator size="small" color={V.acc} />}
          <Text style={t(14, V.onTxt, "600")}>{trazer === 1 ? "Trazer 1 do Venda+" : `Trazer ${trazer} do Venda+`}</Text>
        </Pilula>
      )}
    </View>
  );
}

/** Caixa "dry" com o mês em meta (cabeçalho da prévia do Aniversário). */
export function CaixaPrevia({ meta, direita, children }: { meta?: string; direita?: string; children?: React.ReactNode }) {
  return (
    <Superficie variante="dry" raio={24} padding={{ h: 20, v: 18 }} gap={12}>
      {(!!meta || !!direita) && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          {!!meta && <Text style={{ fontFamily: MONO, fontSize: 12, letterSpacing: 1.7, textTransform: "uppercase", color: V.ink3 } as any}>{meta}</Text>}
          {!!direita && <Text style={t(14, V.ink2)}>{direita}</Text>}
        </View>
      )}
      {children}
    </Superficie>
  );
}
