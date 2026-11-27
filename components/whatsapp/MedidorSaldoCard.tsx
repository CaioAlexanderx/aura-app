// ============================================================
// MedidorSaldoCard — o medidor do topo da aba Configurações
//
// Três saldos (novidades, avisos e cobranças, Aurinha), cada um com o que
// resta do total. Quem decide é o servidor; aqui só se LÊ e se explica:
//   - "Faltam N" quando restam 20% ou menos (uma vez por saldo, sem alarde);
//   - o texto de esgotado, com "Voltam em 1º de <mês>" nas novidades;
//   - Essencial no presente de boas-vindas: "não renova"; a oferta de
//     R$ 29/mês só aparece quando o presente acaba, numa linha ao lado do
//     "WhatsApp do celular";
//   - número em atenção: as novidades param, avisos e cobranças seguem.
// Saldo que não deu para ler = aviso de bloqueio, nunca número inventado.
// ============================================================
import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { tourTarget } from "@/utils/tourTarget";
import { Lnk, Meta, Superficie, V, WEB, t } from "./waVidro";
import { Icon } from "@/components/Icon";
import type { WaStatus } from "@/services/waApi";
import { useWaPacotes } from "@/hooks/useWaPacotes";
import type { WaBucket } from "@/services/waConfigApi";
import {
  TEXTO_NUMERO_EM_ATENCAO, TEXTO_OFERTA_ESSENCIAL, waNumeroEmAtencao,
  type Balde, type SaldoInfo,
} from "./waSaldo";

interface Props {
  /** Sem companyId não há compra de pacote (a tela só lê). */
  companyId?: string | null;
  saldo: SaldoInfo | null;
  carregando: boolean;
  falhou: boolean;
  status: WaStatus | null;
  onRetry: () => void;
}

const DESC_BALDE: Record<Balde["key"], string> = {
  novidades: "Aniversário, Venda+ e oferta do Crediário. Divididas logo abaixo.",
  avisos: "Parcelas do crediário e convites para conversa fechada.",
  aurinha: "Quando acabam, a Aurinha para de responder e a conversa fica com você.",
};

function BaldeView({ b }: { b: Balde }) {
  const fundo = b.esgotado
    ? "linear-gradient(90deg,#f87171,#fca5a5)"
    : b.acabando ? "linear-gradient(90deg,#f59e0b,#fcd34d)" : "linear-gradient(90deg,#a78bfa,#f3efff)";
  const solido = b.esgotado ? V.bad : b.acabando ? V.warn : V.acc;
  return (
    <Superficie variante="dry" raio={22} padding={{ h: 18, v: 14 }} gap={8} style={{ flexGrow: 1, flexShrink: 1, flexBasis: 260 }}>
      <View testID={`wa-saldo-${b.key}`} style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
          <Text style={t(15, V.ink, "700")}>{b.rotulo}</Text>
          <Text style={t(14, V.ink2)} testID={`wa-saldo-${b.key}-livres`}>{b.livres}</Text>
        </View>
        <View style={{ height: 6, borderRadius: 999, backgroundColor: V.track, overflow: "hidden" }} accessibilityLabel={`${b.rotulo}: ${b.livres}`}>
          <View
            style={[{ height: 6, borderRadius: 999, width: `${Math.round((1 - b.gasto) * 100)}%`, backgroundColor: solido } as any,
              WEB ? ({ backgroundImage: fundo } as any) : null]}
          />
        </View>
        {!!b.faltam && <Text style={t(13, V.warn, "700")} testID={`wa-saldo-${b.key}-faltam`}>{b.faltam}</Text>}
        <Text style={t(13, V.ink2)}>{DESC_BALDE[b.key]}</Text>
      </View>
    </Superficie>
  );
}

export function MedidorSaldoCard({ companyId, saldo, carregando, falhou, status, onRetry }: Props) {
  const algumEsgotado = !!saldo && saldo.baldes.some((b) => b.esgotado);
  const pac = useWaPacotes(companyId, algumEsgotado);
  if (carregando && !saldo) {
    return (
      <Superficie variante="dry" raio={22} padding={{ h: 18, v: 14 }} testID="wa-saldo-carregando">
        <ActivityIndicator size="small" color={V.acc} />
      </Superficie>
    );
  }

  if (!saldo) {
    // Dúvida bloqueia: sem saldo lido, nada que gasta mensagem fica ativo.
    return (
      <Superficie variante="dry" raio={22} padding={{ h: 18, v: 14 }} gap={8} testID="wa-saldo-indisponivel">
        <View style={s.linhaAviso}>
          <Icon name="alert" size={13} color={V.warn} />
          <Text style={s.avisoTxt}>
            Não consegui ler o saldo de mensagens agora. Por segurança, os envios que gastam
            mensagem ficam travados até eu conseguir.
          </Text>
        </View>
        {falhou && <Lnk onPress={onRetry} testID="wa-saldo-tentar-de-novo">Tentar de novo</Lnk>}
      </Superficie>
    );
  }

  // Trava do servidor desligada (WA_SALDO_ATIVO): os limites novos ainda não valem
  // nesta loja; mostrar "10 de 10" daria a entender que valem.
  if (!saldo.ativo) {
    return (
      <Superficie variante="dry" raio={22} padding={{ h: 18, v: 14 }} testID="wa-saldo-inativo">
        <View style={s.linhaAviso}>
          <Icon name="alert" size={13} color={V.warn} />
          <Text style={s.avisoTxt}>Os limites novos ainda não estão valendo nesta loja.</Text>
        </View>
      </Superficie>
    );
  }

  const esgotados = saldo.baldes.filter((b) => b.esgotado && b.textoEsgotado);
  const atencao = saldo.numeroEmAtencao || waNumeroEmAtencao(status);

  return (
    <View style={{ gap: 12 }} testID="wa-saldo-medidor" {...tourTarget("wa.saldos")}>
      <Meta>Mensagens de {saldo.mesNome}</Meta>
      {!!saldo.textoPresente && (
        <Text style={t(14, V.acc, "600")} testID="wa-saldo-presente">{saldo.textoPresente}</Text>
      )}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {saldo.baldes.map((b) => <BaldeView key={b.key} b={b} />)}
      </View>

      {esgotados.map((b) => (
        <View key={b.key} style={s.linhaAviso} testID={`wa-saldo-${b.key}-esgotado`}>
          <Icon name="alert" size={13} color={V.bad} />
          <Text style={[s.avisoTxt, { color: V.bad }]}>
            {b.textoEsgotado}
            {b.key === "avisos" ? ' As cobranças viram "Cobrar pelo meu WhatsApp".' : ""}
          </Text>
        </View>
      ))}

      {esgotados.some((b) => !!b.pacote) && !!companyId && (
        <View style={{ gap: 4 }} testID="wa-saldo-pacotes">
          {esgotados.filter((b) => !!b.pacote).map((b) => (
            <View key={b.key} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              {pac.comprando === b.key && <ActivityIndicator size="small" color={V.acc} />}
              <Lnk
                onPress={() => pac.comprar(b.key as WaBucket)}
                desabilitado={pac.comprando !== null}
                testID={`wa-saldo-pacote-${b.key}`}
              >
                {b.pacote!.rotulo}
              </Lnk>
            </View>
          ))}
          <Text style={t(13, V.ink3)} testID="wa-saldo-pacote-nota">
            Só passa a valer depois do pagamento. A Aura nunca compra sozinha.
          </Text>
          {!!pac.erro && <Text style={s.erro} testID="wa-saldo-pacote-erro">{pac.erro}</Text>}
          {pac.abaBloqueada && (
            <Text style={t(13, V.ink3)} testID="wa-saldo-pacote-bloqueada">
              Se o pagamento não abriu, toque em abrir o pagamento.
            </Text>
          )}
          {!!pac.manual && (
            <Text style={t(13, V.ink3)} testID="wa-saldo-pacote-manual">
              Pedido registrado. Ainda não gerei o link de pagamento: a Aura vai te chamar para combinar o pagamento
              e soma o pacote depois que for confirmado.
            </Text>
          )}
        </View>
      )}

      {pac.pendentes.length > 0 && (
        <View style={{ gap: 2 }} testID="wa-saldo-pacotes-pendentes">
          {pac.pendentes.map((p) => (
            <Lnk key={p.id} onPress={() => pac.abrir(String(p.payment_url))} testID={`wa-saldo-pacote-pagar-${p.id}`}>
              {`Pacote de ${p.qty} aguardando pagamento: abrir o pagamento`}
            </Lnk>
          ))}
          <Lnk onPress={onRetry} testID="wa-saldo-pacote-atualizar">Já paguei: atualizar o saldo</Lnk>
        </View>
      )}

      {saldo.mostrarOferta && (
        <Text style={t(14, V.ink2, "600")} testID="wa-saldo-oferta">{TEXTO_OFERTA_ESSENCIAL}</Text>
      )}

      {atencao && (
        <View style={s.linhaAviso} testID="wa-saldo-numero-em-atencao">
          <Icon name="alert" size={13} color={V.warn} />
          <Text style={s.avisoTxt}>{TEXTO_NUMERO_EM_ATENCAO}</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  linhaAviso: { flexDirection: "row", alignItems: "flex-start", gap: 7 },
  avisoTxt: { flex: 1, fontSize: 14, fontWeight: "600", color: V.warn, lineHeight: 20 },
  erro: { fontSize: 13, fontWeight: "600", color: V.bad, lineHeight: 18 },
} as any);
/** Número ainda não conectado: os saldos aparecem apagados (artboard GuiaExecucao, guia 1). */
export function SaldosApagados() {
  return (
    <Superficie variante="dry" raio={22} padding={{ h: 20, v: 18 }} gap={8} style={{ opacity: 0.6 }} testID="wa-saldo-apagado">
      <Meta>Saldos do mês</Meta>
      <Text style={t(15, V.ink)}>Avisos · Novidades · Conversas da Aurinha</Text>
      <Text style={t(13, V.ink3)}>Aparecem quando o número estiver ligado.</Text>
    </Superficie>
  );
}
