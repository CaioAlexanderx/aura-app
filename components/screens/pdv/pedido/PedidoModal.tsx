// ============================================================
// AURA. — Caixa · Novo pedido (A2, p-63b, 17/11/2026)
//
// Mockup "Pedido separado de venda", partes 2 e 7 (aprovado pelo Caio em
// 17/11). Abre pelo "Guardar > Pedido" do rodapé (A1). Três passos:
//   1. Itens e cliente: as peças vêm do carrinho (para mudar, volta ao
//      carrinho) e a cliente, com a mesma busca da Troca (troca/CreditoPara),
//      "+ Novo cliente" (troca/NovoClienteNaTroca) e "Seguir sem cliente";
//   2. Data: quando ela vem buscar (Amanhã, Sexta, Em 7 dias, Outra data).
//      O sinal é o A3: este card guarda o pedido SEM sinal;
//   3. Pronto: "Pedido P-0012 guardado", Enviar (wa.me) e Nova venda.
//
// DNA do TrocaModal (CLAUDE.md, armadilha 5): cabeçalho com ícone, barra de
// passos numerada, miolo à esquerda, resumo roxo à direita, rodapé com a
// frase do que falta e Voltar / Continuar. O TrocaModal não é tocado: esta é
// uma casca nova com os mesmos estilos.
//
// O que nunca muda (limites do card):
//   - o carrinho só esvazia quando o servidor guardou o pedido (onGuardado);
//     erro de rede deixa carrinho, cliente e data como estavam, e o
//     "Tentar de novo" usa a MESMA Idempotency-Key (não cria dois pedidos);
//   - 409 PEDIDO_SEM_SALDO mostra as peças que faltam; nada foi guardado;
//   - não toca no useCart nem no POST da venda (a conclusão é o A6a).
//
// Web: WebPortal (o z-index do react-native-web prende overlay fixo no
// shell). Abre por cima do Caixa, nunca por cima de outro Modal, então a
// exceção da JanelaEmpilhada não se aplica.
// ============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, Linking, Platform, useWindowDimensions,
} from "react-native";
import { Colors, IS_DARK_MODE } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { WebPortal } from "@/components/WebPortal";
import { CalendarioDoDia } from "@/components/CalendarioDoDia";
import { IS_WEB, webOnly, accentForProduct, productLetter } from "../types";
import { fmtBRL } from "../troca/types";
import { CreditoPara } from "../troca/CreditoPara";
import { NovoClienteNaTroca } from "../troca/NovoClienteNaTroca";
import { pedidosApi, faltasDoErro, type FaltaDoPedido, type PedidoGuardado } from "@/services/pedidosApi";
import { novaChaveDaVenda, chaveDaVendaJaUsada } from "@/utils/chaveDaVenda";
import { TEXTOS_DO_PEDIDO as T } from "./textosDoPedido";
import {
  corpoDoPedido, totalDoPedido, pecasDoPedido, assinaturaDosItens, hojeEmSaoPaulo, atalhosDeData,
  dataCurta, dataLonga, numeroDoPedido, primeiroNome,
  type LinhaDoCarrinho, type ClienteDoPedido,
} from "./corpoDoPedido";

type Props = {
  visible: boolean;
  /** Loja do Caixa (o pedido é dela; no consolidado o botão nem existe). */
  companyId: string;
  /** Carrinho de agora. */
  itens: LinhaDoCarrinho[];
  /** Desconto da venda (cupom + manual), no preço do dinheiro. */
  desconto: number;
  /** Cliente já escolhido no Caixa: vem preenchido. */
  clienteDoCarrinho: { id: string; name: string; phone: string | null } | null;
  /** O servidor guardou: o Caixa esvazia o carrinho para a próxima venda. */
  onGuardado: (pedido: PedidoGuardado) => void;
  onClose: () => void;
  /** Para os testes: o "hoje" de São Paulo. */
  hoje?: string;
};

type Erro =
  | { tipo: "rede" }
  | { tipo: "saldo"; faltas: FaltaDoPedido[] }
  | { tipo: "outro"; mensagem: string };

type Guardado = {
  pedido: PedidoGuardado;
  pecas: number;
  nome: string | null;
  telefone: string | null;
  data: string;
  falta: number;
};

export function PedidoModal({ visible, companyId, itens, desconto, clienteDoCarrinho, onGuardado, onClose, hoje: hojeProp }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  // undefined = ainda não escolheu (o do Caixa entra ao abrir).
  const [clienteEscolhido, setCliente] = useState<ClienteDoPedido | null | undefined>(undefined);
  const [clienteSalvoId, setClienteSalvoId] = useState<string | null>(null);
  const [novoCliente, setNovoCliente] = useState<{ busca: string } | null>(null);
  const [data, setData] = useState<string | null>(null);
  const [outraData, setOutraData] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<Erro | null>(null);
  const [guardado, setGuardado] = useState<Guardado | null>(null);
  // Uma chave por pedido: a mesma em toda nova tentativa com os mesmos itens.
  const chaveRef = useRef<{ chave: string; assinatura: string } | null>(null);
  const { width } = useWindowDimensions();
  const largo = width >= 760;

  const hoje = hojeProp || hojeEmSaoPaulo();
  const atalhos = useMemo(() => atalhosDeData(hoje), [hoje]);
  const total = totalDoPedido(itens, desconto);
  const pecas = pecasDoPedido(itens);

  // Abriu: começa do passo 1. Depois de um pedido guardado, começa do zero.
  const abertoAntes = useRef(false);
  useEffect(() => {
    if (visible && !abertoAntes.current) {
      setStep(1);
      setErro(null);
      setNovoCliente(null);
      setOutraData(false);
      if (guardado) {
        setGuardado(null);
        setCliente(undefined);
        setClienteSalvoId(null);
        setData(null);
      }
    }
    abertoAntes.current = visible;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const novoClienteAberto = !!novoCliente && step === 1;
  function fechar() {
    if (enviando) return;
    onClose();
  }

  const escRef = useRef({ fechar, novoClienteAberto });
  escRef.current = { fechar, novoClienteAberto };
  useEffect(() => {
    if (!visible || !IS_WEB || typeof window === "undefined") return;
    function aoTecla(e: KeyboardEvent) {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      e.preventDefault();
      if (escRef.current.novoClienteAberto) setNovoCliente(null);
      else escRef.current.fechar();
    }
    window.addEventListener("keydown", aoTecla);
    return () => window.removeEventListener("keydown", aoTecla);
  }, [visible]);

  if (!visible) return null;

  // Enquanto ela não mexe, vale a cliente escolhida no Caixa.
  const cliente: ClienteDoPedido | null = clienteEscolhido !== undefined
    ? clienteEscolhido
    : (clienteDoCarrinho ? { tipo: "cadastro", ...clienteDoCarrinho } : null);

  const nomeDoCliente = cliente ? (cliente.name.trim() || null) : null;
  const telefoneDoCliente = cliente?.tipo === "cadastro" ? cliente.phone : null;

  async function guardar() {
    if (enviando || !data || !cliente || itens.length === 0) return;
    const assinatura = assinaturaDosItens(itens, desconto);
    if (!chaveRef.current || chaveRef.current.assinatura !== assinatura) {
      chaveRef.current = { chave: novaChaveDaVenda(), assinatura };
    }
    const retrato = { pecas, nome: primeiroNome(nomeDoCliente), telefone: telefoneDoCliente, data, falta: total };
    setEnviando(true);
    setErro(null);
    try {
      const r = await pedidosApi.guardar(companyId, corpoDoPedido({ itens, desconto, data, cliente }), chaveRef.current.chave);
      chaveRef.current = null;
      setGuardado({ pedido: r.order, ...retrato, falta: Number(r.order?.total ?? total) });
      setStep(3);
      onGuardado(r.order);
    } catch (e: any) {
      const faltas = faltasDoErro(e);
      if (faltas) setErro({ tipo: "saldo", faltas });
      else if (chaveDaVendaJaUsada(e)) {
        // A chave já guardou um pedido com outros itens: o próximo toque é pedido novo.
        chaveRef.current = null;
        setErro({ tipo: "outro", mensagem: e?.message || T.erroDeRede });
      } else if (e?.isNetworkError || !e?.status || e.status >= 500) setErro({ tipo: "rede" });
      else setErro({ tipo: "outro", mensagem: e?.message || T.erroDeRede });
    } finally {
      setEnviando(false);
    }
  }

  function enviarWhatsApp() {
    if (!guardado?.telefone) return;
    const d = guardado.telefone.replace(/\D/g, "");
    const num = d.startsWith("55") ? d : "55" + d;
    const msg = T.textoDoWhatsApp(guardado.nome || "", numeroDoPedido(guardado.pedido.order_number), dataLonga(guardado.data));
    Linking.openURL(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`);
  }

  const panelWeb = webOnly({
    background: IS_DARK_MODE ? "rgba(18,10,35,0.98)" : "rgba(255,255,255,0.98)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(124,58,237,0.3)",
    boxShadow: IS_DARK_MODE ? "0 24px 60px -10px rgba(0,0,0,0.7)" : "0 24px 60px -10px rgba(124,58,237,0.22)",
  });
  const dialogo = IS_WEB ? ({ role: "dialog", "aria-modal": true, "aria-label": T.titulo } as any) : {};

  // ── Passo 1: cliente ──────────────────────────────────────────────────
  const blocoCliente = cliente?.tipo === "sem-cadastro" ? (
    <View style={s.semCliente} testID="pedido-sem-cliente">
      <Text style={s.semClienteRot}>{T.cliente.rotulo}</Text>
      <View style={s.semClienteLinha}>
        <View style={s.avSem}><Icon name="user" size={15} color={Colors.amber} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.semClienteNome} numberOfLines={1}>{cliente.name.trim() || T.semClienteSemNome}</Text>
          <Text style={s.semClienteSub}>{T.seguirSemClienteSub}</Text>
        </View>
        <Pressable onPress={() => setCliente(null)} style={s.btnTrocar} testID="pedido-sem-cliente-trocar" accessibilityRole="button">
          <Text style={s.btnTrocarTxt}>Trocar</Text>
        </Pressable>
      </View>
    </View>
  ) : (
    <CreditoPara
      testID="pedido-cliente"
      textos={T.cliente}
      cliente={cliente?.tipo === "cadastro" ? { id: cliente.id, name: cliente.name, phone: cliente.phone } : null}
      daVendaOriginal={false}
      buscaInicial={!cliente}
      onEscolher={(c) => { setCliente({ tipo: "cadastro", id: c.id, name: c.name, phone: c.phone || null }); setClienteSalvoId(null); }}
      onNovoCliente={(busca) => setNovoCliente({ busca })}
      onSemCliente={(busca) => setCliente({ tipo: "sem-cadastro", name: busca })}
      textoSemCliente={{ nome: T.seguirSemCliente, sub: T.seguirSemClienteSub }}
      salvoAgora={cliente?.tipo === "cadastro" && cliente.id === clienteSalvoId}
    />
  );

  const passo1 = (
    <View testID="pedido-passo-1">
      <Text style={s.qst}>{T.oQueFicaSeparado}</Text>
      <View style={s.lista}>
        {itens.map((l, i) => (
          <View key={l.productId} style={[s.item, i > 0 && s.itemSep]} testID={"pedido-item-" + l.productId}>
            <View style={[s.av, { backgroundColor: accentForProduct(l.productId) }]}>
              <Text style={s.avTxt}>{productLetter(l.name)}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.itemNome} numberOfLines={1}>{l.name}</Text>
              <Text style={s.itemSub}>{l.qty} {T.un}</Text>
            </View>
            <Text style={s.itemPreco}>{fmtBRL(l.price * l.qty)}</Text>
          </View>
        ))}
      </View>
      <Text style={[s.qst, { marginTop: 18 }]}>{T.paraQuemE}</Text>
      {blocoCliente}
      {cliente?.tipo === "cadastro" && (
        <View style={s.avisoAz}>
          <Icon name="info" size={14} color={Colors.violet3} />
          <Text style={s.avisoAzTxt}>{T.avisoTelefone}</Text>
        </View>
      )}
    </View>
  );

  // ── Passo 2: data ────────────────────────────────────────────────────
  const rotuloDoAtalho = { amanha: T.amanha, sexta: T.sexta, "7dias": T.em7Dias } as const;
  const dataEhAtalho = !!data && atalhos.some((a) => a.data === data);
  const passo2 = (
    <View testID="pedido-passo-2">
      {erro?.tipo === "saldo" && (
        <View style={s.avisoVm} testID="pedido-sem-saldo" accessibilityRole="alert">
          <Icon name="alert" size={16} color={Colors.red} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.avisoVmTit}>{T.semSaldoTitulo}</Text>
            {erro.faltas.map((f, i) => (
              <Text key={(f.product_id || "") + (f.variant_id || "") + i} style={s.avisoVmTxt} testID="pedido-falta">
                {f.reservado > 0 ? T.faltaComReserva(f.nome, f.livre, f.reservado) : T.faltaSemReserva(f.nome, f.livre)}
              </Text>
            ))}
            <Text style={s.avisoVmTxt}>{T.semSaldoDica}</Text>
          </View>
        </View>
      )}
      <Text style={s.qst}>{T.quandoVemBuscar}</Text>
      <View style={s.chips}>
        {atalhos.map((a) => {
          const on = data === a.data;
          return (
            <Pressable
              key={a.chave}
              testID={"pedido-data-" + a.chave}
              onPress={() => { setData(a.data); setOutraData(false); }}
              style={[s.chip, on && s.chipOn]}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
            >
              <Text style={[s.chipTxt, on && s.chipTxtOn]}>{rotuloDoAtalho[a.chave]}</Text>
              <Text style={[s.chipSub, on && s.chipSubOn]}>{a.chave === "amanha" ? dataCurta(a.data) : a.data.slice(8, 10) + "/" + a.data.slice(5, 7)}</Text>
            </Pressable>
          );
        })}
        <Pressable
          testID="pedido-data-outra"
          onPress={() => setOutraData((v) => !v)}
          style={[s.chip, (outraData || (!!data && !dataEhAtalho)) && s.chipOn]}
          accessibilityRole="radio"
          accessibilityState={{ selected: !!data && !dataEhAtalho }}
        >
          <Icon name="calendar" size={14} color={(outraData || (!!data && !dataEhAtalho)) ? "#fff" : Colors.violet3} />
          <Text style={[s.chipTxt, (outraData || (!!data && !dataEhAtalho)) && s.chipTxtOn]}>{T.outraData}</Text>
          {!!data && !dataEhAtalho && <Text style={[s.chipSub, s.chipSubOn]}>{dataCurta(data)}</Text>}
        </Pressable>
      </View>
      {outraData && (
        <View style={{ marginTop: 12, maxWidth: 360 }}>
          <CalendarioDoDia
            testID="pedido-calendario"
            value={data}
            minDate={hoje}
            marcas={data ? { [data]: { selected: true, selectedColor: Colors.violet } } : {}}
            onEscolher={(iso) => { if (iso >= hoje) { setData(iso); setOutraData(false); } }}
          />
        </View>
      )}
    </View>
  );

  // ── Passo 3: pronto ──────────────────────────────────────────────────
  const passo3 = guardado ? (
    <View style={s.s5} testID="pedido-pronto">
      <View style={s.ok}><Icon name="check" size={26} color="#fff" /></View>
      <Text style={s.s5Tit}>{T.pedidoGuardado(numeroDoPedido(guardado.pedido.order_number))}</Text>
      <Text style={s.s5Txt}>{T.reservadasPara(guardado.pecas, guardado.nome, dataLonga(guardado.data))}</Text>
      <View style={s.s5Box}>
        <View style={s.s5Linha}>
          <Text style={s.s5LinhaTxt}>{T.faltaNaRetirada}</Text>
          <Text style={s.s5LinhaVal}>{fmtBRL(guardado.falta)}</Text>
        </View>
      </View>
      <View style={s.s5Acoes}>
        {!!guardado.telefone && (
          <Pressable onPress={enviarWhatsApp} style={[s.btnSec, s.s5Btn]} testID="pedido-enviar" accessibilityRole="button">
            <Icon name="whatsapp" size={14} color={Colors.ink} />
            <Text style={s.btnSecTxt}>{T.enviar}</Text>
          </Pressable>
        )}
        <Pressable onPress={onClose} style={[s.btnPri, s.s5Btn]} testID="pedido-nova-venda" accessibilityRole="button">
          <Text style={s.btnPriTxt}>{T.novaVenda}</Text>
        </Pressable>
      </View>
    </View>
  ) : null;

  // ── Trilho (resumo roxo) ─────────────────────────────────────────────
  const trilho = step !== 3 ? (
    <View style={[s.trilho, !largo && s.trilhoEstreito]} testID="pedido-resumo">
      <Text style={s.credRot}>{T.resumo}</Text>
      <Text style={s.credValor}>{fmtBRL(total)}</Text>
      <Text style={s.credSub}>{T.pecas(pecas)}{step === 2 && nomeDoCliente ? " · " + nomeDoCliente : ""}</Text>
      <View style={s.credHr} />
      {step === 2 ? (
        <>
          <View style={s.credLinha}>
            <Text style={s.credBal}>{T.faltaNaRetirada}</Text>
            <Text style={s.credBalV}>{fmtBRL(total)}</Text>
          </View>
          {!!data && (
            <View style={s.credNota}>
              <Icon name="calendar" size={14} color="#ddd6fe" />
              <Text style={s.credNotaTxt}>{T.vemBuscar(dataLonga(data))}</Text>
            </View>
          )}
        </>
      ) : (
        <View style={s.credNota}>
          <Icon name="box" size={14} color="#ddd6fe" />
          <Text style={s.credNotaTxt}>{T.reservadas(pecas)}</Text>
        </View>
      )}
    </View>
  ) : null;

  // ── Rodapé ───────────────────────────────────────────────────────────
  let info: string;
  if (step === 1) info = cliente ? T.rodapePasso1(pecas, nomeDoCliente) : T.rodapeEscolherCliente;
  else info = data ? T.rodapePasso2(fmtBRL(total)) : T.rodapeEscolherData;
  const erroDoRodape = erro?.tipo === "rede" ? T.erroDeRede : erro?.tipo === "outro" ? erro.mensagem : null;
  const podeGuardar = !!data && !!cliente && itens.length > 0 && !enviando;

  const rodape = step !== 3 && !novoClienteAberto ? (
    <View style={s.footer}>
      {erroDoRodape ? (
        <View style={s.footerErro} testID="pedido-erro" accessibilityRole="alert">
          <Icon name="alert" size={15} color={Colors.red} />
          <Text style={s.footerErroTxt}>{erroDoRodape}</Text>
        </View>
      ) : (
        <Text style={s.footerInfo} numberOfLines={2} testID="pedido-rodape-info">{info}</Text>
      )}
      <View style={s.footerActions}>
        {step === 1 ? (
          <>
            <Pressable style={s.btnSec} onPress={fechar} testID="pedido-voltar-carrinho" accessibilityRole="button">
              <Text style={s.btnSecTxt}>{T.voltarAoCarrinho}</Text>
            </Pressable>
            <Pressable
              style={[s.btnPri, !cliente && { opacity: 0.45 }]}
              onPress={() => { if (cliente) setStep(2); }}
              disabled={!cliente}
              testID="pedido-continuar"
              accessibilityRole="button"
            >
              <Text style={s.btnPriTxt}>{T.continuar}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable style={s.btnSec} onPress={() => { if (!enviando) { setStep(1); setErro(null); } }} testID="pedido-voltar" accessibilityRole="button">
              <Text style={s.btnSecTxt}>{T.voltar}</Text>
            </Pressable>
            <Pressable
              style={[s.btnConfirm, !podeGuardar && { opacity: 0.45 }]}
              onPress={podeGuardar ? guardar : undefined}
              disabled={!podeGuardar}
              testID="pedido-guardar"
              accessibilityRole="button"
            >
              {enviando ? <ActivityIndicator size="small" color="#fff" /> : (
                <>
                  <Icon name="check" size={14} color="#fff" />
                  <Text style={s.btnPriTxt}>{erro?.tipo === "rede" ? T.tentarDeNovo : T.guardarPedido}</Text>
                </>
              )}
            </Pressable>
          </>
        )}
      </View>
    </View>
  ) : null;

  const PASSOS = [T.passos.itensECliente, T.passos.data, T.passos.pronto];

  const conteudo = (
    <View style={s.overlay} testID="pedido-modal">
      <Pressable style={s.backdrop} onPress={step === 3 ? undefined : fechar} accessibilityLabel={T.fechar} />
      <View style={[s.panel, IS_WEB ? (panelWeb as any) : { backgroundColor: Colors.bg3 }]} {...dialogo}>
        <View style={s.header}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
            <View style={s.headerIco}><Icon name="bag" size={16} color="#a78bfa" /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.headerTitle}>{step === 3 ? T.tituloPronto : T.titulo}</Text>
              {step !== 3 && largo && <Text style={s.headerSub}>{T.subtitulo}</Text>}
            </View>
          </View>
          <Pressable onPress={fechar} style={s.closeBtn} accessibilityLabel={T.fechar} testID="pedido-fechar">
            <Icon name="x" size={16} color={Colors.ink3} />
          </Pressable>
        </View>

        {step !== 3 && (
          <View style={s.stepBar}>
            {PASSOS.map((rotulo, idx) => {
              const n = idx + 1;
              const done = step > n;
              const active = step === n;
              return (
                <View key={rotulo} style={s.stepItem}>
                  <View style={[s.stepDot, done && s.stepDotDone, active && s.stepDotActive]}>
                    {done ? <Icon name="check" size={10} color="#fff" /> : <Text style={[s.stepDotTxt, active && { color: "#fff" }]}>{n}</Text>}
                  </View>
                  {(largo || active) && (
                    <Text style={[s.stepLabel, (active || done) && { color: active ? "#a78bfa" : Colors.ink2, fontWeight: active ? "700" : "500" }]} numberOfLines={1}>
                      {rotulo}
                    </Text>
                  )}
                  {idx < PASSOS.length - 1 && <View style={[s.stepSep, done && { backgroundColor: "rgba(124,58,237,0.4)" }, !largo && { width: 14 }]} />}
                </View>
              );
            })}
          </View>
        )}

        {novoClienteAberto && (
          <NovoClienteNaTroca
            companyId={companyId}
            valorDoCredito={0}
            busca={novoCliente!.busca}
            textos={T.cliente}
            onCancelar={() => setNovoCliente(null)}
            onPronto={(c, criado) => {
              setCliente({ tipo: "cadastro", id: c.id, name: c.name, phone: c.phone || null });
              setClienteSalvoId(criado ? c.id : null);
              setNovoCliente(null);
            }}
          />
        )}

        <ScrollView
          style={[s.body, novoClienteAberto && s.escondido]}
          contentContainerStyle={s.bodyContent}
          keyboardShouldPersistTaps="handled"
        >
          {step === 3 ? passo3 : (
            <View style={[s.grade, !largo && s.gradeEstreita]}>
              <View style={{ flex: largo ? 1 : undefined, minWidth: 0, alignSelf: "stretch" }}>
                {step === 1 ? passo1 : passo2}
              </View>
              {trilho}
            </View>
          )}
        </ScrollView>

        {rodape}
      </View>
    </View>
  );

  return Platform.OS === "web" ? <WebPortal active>{conteudo}</WebPortal> : conteudo;
}

const s = StyleSheet.create({
  overlay: {
    position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center",
    zIndex: 100, padding: 16,
  },
  backdrop: { position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0 },
  panel: { width: "100%", maxWidth: 900, maxHeight: "94%", borderRadius: 18, overflow: "hidden", flexDirection: "column" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10,
    paddingHorizontal: 22, paddingTop: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: "rgba(124,58,237,0.15)",
  },
  headerIco: { width: 32, height: 32, borderRadius: 9, backgroundColor: "rgba(124,58,237,0.18)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: Colors.ink, letterSpacing: -0.2 },
  headerSub: { fontSize: 12, color: Colors.ink3, marginTop: 1 },
  closeBtn: {
    width: 44, height: 44, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center",
  },
  stepBar: {
    flexDirection: "row", alignItems: "center", flexWrap: "wrap",
    paddingHorizontal: 22, paddingVertical: 12, backgroundColor: "rgba(0,0,0,0.18)",
    borderBottomWidth: 1, borderBottomColor: "rgba(124,58,237,0.1)", gap: 6,
  },
  stepItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepDot: {
    width: 24, height: 24, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  stepDotActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  stepDotDone: { backgroundColor: "rgba(52,211,153,0.85)", borderColor: "#34d399" },
  stepDotTxt: { color: Colors.ink3, fontSize: 12, fontWeight: "700" },
  stepLabel: { color: Colors.ink3, fontSize: 12.5, fontWeight: "500" },
  stepSep: { width: 28, height: 1.5, backgroundColor: "rgba(255,255,255,0.1)", marginHorizontal: 4 },
  body: { flexGrow: 0, flexShrink: 1 },
  escondido: { display: "none" },
  bodyContent: { padding: 20, paddingBottom: 12 },
  grade: { flexDirection: "row", gap: 18, alignItems: "flex-start" },
  gradeEstreita: { flexDirection: "column", alignItems: "stretch" },
  qst: { fontSize: 12, color: Colors.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  lista: { borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", borderRadius: 12, paddingHorizontal: 12, backgroundColor: "rgba(255,255,255,0.04)" },
  item: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
  itemSep: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.04)" },
  av: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  avTxt: { color: "#fff", fontSize: 12, fontWeight: "700" },
  itemNome: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  itemSub: { fontSize: 12, color: Colors.ink3 },
  itemPreco: { fontSize: 13, fontWeight: "500", color: Colors.violet3 },
  avisoAz: { flexDirection: "row", gap: 8, alignItems: "flex-start", padding: 10, borderRadius: 10, backgroundColor: "rgba(37,99,235,0.16)", marginTop: 12 },
  avisoAzTxt: { flex: 1, fontSize: 12.5, color: Colors.ink2, lineHeight: 18 },
  semCliente: { borderWidth: 1, borderColor: "rgba(120,100,240,0.28)", borderRadius: 12, padding: 12 },
  semClienteRot: { fontSize: 11, fontWeight: "700", letterSpacing: 0.9, textTransform: "uppercase", color: Colors.ink3, marginBottom: 8 },
  semClienteLinha: { flexDirection: "row", alignItems: "center", gap: 10 },
  avSem: {
    width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(251,191,36,0.12)", borderWidth: 1, borderStyle: "dashed", borderColor: Colors.amber,
  },
  semClienteNome: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  semClienteSub: { fontSize: 12, color: Colors.ink3 },
  btnTrocar: {
    minHeight: 40, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: "rgba(120,100,240,0.28)",
    backgroundColor: "rgba(255,255,255,0.055)", alignItems: "center", justifyContent: "center",
  },
  btnTrocarTxt: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: 44, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 14, borderRadius: 10,
    borderWidth: 1, borderColor: "rgba(120,100,240,0.28)", backgroundColor: "rgba(255,255,255,0.04)",
  },
  chipOn: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  chipTxt: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  chipTxtOn: { color: "#fff" },
  chipSub: { fontSize: 12, color: Colors.ink3 },
  chipSubOn: { color: "#ede9fe" },
  avisoVm: {
    flexDirection: "row", gap: 8, alignItems: "flex-start", padding: 12, borderRadius: 10, marginBottom: 16,
    backgroundColor: "rgba(248,113,113,0.12)", borderWidth: 1, borderColor: Colors.red,
  },
  avisoVmTit: { fontSize: 13, fontWeight: "700", color: Colors.ink, marginBottom: 4 },
  avisoVmTxt: { fontSize: 12.5, color: Colors.ink, lineHeight: 18 },
  trilho: { width: 270, flexShrink: 0, backgroundColor: "#251347", borderWidth: 1, borderColor: "rgba(167,139,250,0.38)", borderRadius: 14, padding: 16 },
  trilhoEstreito: { width: "100%" as any, marginTop: 4 },
  credRot: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, color: "#ddd6fe", textTransform: "uppercase" },
  credValor: { fontSize: 28, fontWeight: "800", letterSpacing: -0.4, marginTop: 4, color: "#fff" },
  credSub: { fontSize: 12, color: "#ddd6fe" },
  credHr: { height: 1, backgroundColor: "rgba(255,255,255,0.22)", marginVertical: 12 },
  credLinha: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8 },
  credBal: { fontSize: 13, fontWeight: "700", color: "#bbf7d0" },
  credBalV: { fontSize: 16, fontWeight: "800", color: "#bbf7d0" },
  credNota: { flexDirection: "row", gap: 6, marginTop: 12, alignItems: "flex-start" },
  credNotaTxt: { flex: 1, fontSize: 12, color: "#ddd6fe", lineHeight: 17 },
  footer: {
    paddingHorizontal: 22, paddingVertical: 14, borderTopWidth: 1, borderTopColor: "rgba(124,58,237,0.15)",
    backgroundColor: "rgba(0,0,0,0.18)", flexDirection: "row", flexWrap: "wrap",
    justifyContent: "space-between", alignItems: "center", gap: 12,
  },
  footerInfo: { flex: 1, minWidth: 180, fontSize: 12.5, color: Colors.ink2, fontWeight: "500" },
  footerErro: { flex: 1, minWidth: 180, flexDirection: "row", alignItems: "flex-start", gap: 8 },
  footerErroTxt: { flex: 1, fontSize: 13, color: Colors.red, fontWeight: "700", lineHeight: 18 },
  footerActions: { flexDirection: "row", gap: 8, flexShrink: 0, flexWrap: "wrap" },
  btnPri: {
    backgroundColor: Colors.violet, minHeight: 44, paddingHorizontal: 20, borderRadius: 10,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
  },
  btnConfirm: {
    backgroundColor: "#0b7a5a", minHeight: 44, paddingHorizontal: 20, borderRadius: 10,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minWidth: 180,
  },
  btnPriTxt: { color: "#fff", fontSize: 13.5, fontWeight: "700" },
  btnSec: {
    backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    minHeight: 44, paddingHorizontal: 16, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
  },
  btnSecTxt: { color: Colors.ink, fontSize: 13, fontWeight: "500" },
  s5: { alignItems: "center", gap: 8, paddingVertical: 6 },
  ok: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#0b7a5a", alignItems: "center", justifyContent: "center" },
  s5Tit: { fontSize: 19, fontWeight: "700", color: Colors.ink, textAlign: "center" },
  s5Txt: { fontSize: 13, color: Colors.ink2, textAlign: "center", maxWidth: 460 },
  s5Box: { alignSelf: "stretch", maxWidth: 440, width: "100%", marginHorizontal: "auto" as any, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, marginVertical: 6 },
  s5Linha: { flexDirection: "row", justifyContent: "space-between", gap: 10, paddingVertical: 4 },
  s5LinhaTxt: { fontSize: 13, color: Colors.ink2 },
  s5LinhaVal: { fontSize: 13, color: Colors.ink, fontWeight: "500" },
  s5Acoes: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center", alignSelf: "stretch", maxWidth: 440, width: "100%", marginHorizontal: "auto" as any },
  s5Btn: { flex: 1 },
});

export default PedidoModal;
