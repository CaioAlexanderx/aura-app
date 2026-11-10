// ============================================================
// AURA. — "Pronto para emitir NFS-e?" (configuração da loja, 10/11/2026)
//
// Mockup aprovado: docs/mockups/nfse-configuracao-loja.html. Mora na aba
// "Emitir NFS-e" da tela Notas fiscais (não é tela nova: sem `mod`
// próprio). Os estados vêm do backend (nacional.passos); aqui só agrupamos
// em 4 cartões (direção do dono, 10/11/2026: self-service muito simples):
//   1. Certificado digital A1 → leva à aba "Certificado A1" que já existe;
//   2. Dados da nota → Situação perante o Simples Nacional, Código de
//      Tributação Nacional e "Já emite NFS-e por outro emissor?" (Série e
//      Último Número da DPS de lá; Aura-backend#992) — um formulário só;
//   3. Nota de teste → POST /nfse/teste, sempre em produção restrita. A
//      explicação da prefeitura (Inscrição Municipal, CNC) só aparece quando
//      o teste volta com E0084/E0116/E0120;
//   4. Ligar a NFS-e → % do Simples, Retenção do ISSQN e Alíquota (só ME/EPP,
//      nunca preenchida), as chaves "Emitir NFS-e" e "Emitir automaticamente".
//
// Nomes dos campos iguais aos do Emissor Nacional (gov.br) e do leiaute da
// DPS (Anexo I), com uma ajuda curta em português simples embaixo.
// Tom gentil; nunca "não atendido". Sem hover-reveal (nada some sem toque).
// ============================================================
import { useEffect, useRef, useState, type ReactNode } from "react";
import { View, Text, Pressable, ActivityIndicator, Linking, Platform, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { waAura } from "@/constants/suporteAura";
import { CampoCodigoTributacao } from "@/components/nfse/CampoCodigoTributacao";
import { Campo, Entrada } from "@/components/screens/estoque/item-form/ui";
import { nfseConfigApi, useNfseConfig, type RespostaTeste } from "@/hooks/useNfseConfig";
import { fmtNbs, soDigitos, statusDoCodigo } from "@/utils/nfseServico";
import {
  CARTOES, TITULO_DO_CARTAO, aguardandoAura, avisoDoTeste, contarProntos, emitindo as estaEmitindo, estadosDosCartoes,
  fmtCnpj, fmtDiaMes, fmtPercentual, lerPercentual, prefeituraVisivel, proximoCartao,
  situacaoDe, textoParaPrefeitura, camposDoOutroEmissor, conflitoDeNumeracao, textoDoConflito,
  type Cartao, type ConfigNfse, type EstadoPasso, type JaEmite, type ResultadoTeste, type SituacaoNfse,
} from "@/utils/nfseProntoParaEmitir";

type Props = {
  companyId: string;
  nomeLoja: string;
  /** No grupo, o título leva o nome da loja. */
  noGrupo?: boolean;
  /** A loja aberta é a do login? O envio do A1 acontece na aba dela. */
  ehLojaAtual: boolean;
  onIrParaCertificado: () => void;
  /** Loja de outro CNPJ do grupo: entra nela para enviar o certificado. */
  onEntrarNaLoja?: () => void;
  /** Código padrão de outra loja do grupo, para "Usar o mesmo". */
  codigoDeOutraLoja?: { nome: string; codigo: string } | null;
};

const ROTULO_OP: Record<number, string> = { 1: "Não optante", 2: "Optante - MEI", 3: "Optante - ME/EPP" };

function erroDaApi(e: any, padrao: string): string {
  return (e && e.message) || padrao;
}

function novaChave(): string {
  return "app-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

async function copiar(texto: string) {
  try {
    if (Platform.OS === "web" && typeof navigator !== "undefined" && (navigator as any).clipboard) {
      await (navigator as any).clipboard.writeText(texto);
      toast.success("Texto copiado. Cole no e-mail ou no protocolo da prefeitura.");
      return;
    }
  } catch { /* cai no aviso abaixo */ }
  toast.info("Selecione o texto e copie.");
}

// ── peças ──────────────────────────────────────────────────
function Bolinha({ estado, n }: { estado: EstadoPasso; n: number }) {
  if (estado === "ok") return <View style={[st.st, st.stOk]} accessibilityLabel="Pronto"><Icon name="check" size={14} color="#063b2a" /></View>;
  if (estado === "problema") return <View style={[st.st, st.stPr]} accessibilityLabel="Com problema"><Text style={st.stPrTxt}>!</Text></View>;
  if (estado === "travado") return <View style={[st.st, st.stLk]} accessibilityLabel="Bloqueado"><Icon name="lock" size={12} color={Colors.ink3} /></View>;
  return <View style={[st.st, st.stPe]} accessibilityLabel="Falta"><Text style={st.stPeTxt}>{n}</Text></View>;
}

function Pilula({ estado }: { estado: EstadoPasso }) {
  if (estado === "travado") return null;
  const m = {
    ok: { t: "Pronto", c: Colors.green, b: Colors.greenD },
    problema: { t: "Com problema", c: Colors.red, b: Colors.redD },
    falta: { t: "Falta", c: Colors.amber, b: Colors.amberD },
  }[estado];
  return <View style={[st.pill, { backgroundColor: m.b, borderColor: m.c + "55" }]}><Text style={[st.pillTxt, { color: m.c }]}>{m.t}</Text></View>;
}

function Aviso({ tom = "violet", icon = "info", children, testID }: { tom?: "violet" | "amber" | "red" | "green"; icon?: string; children: ReactNode; testID?: string }) {
  const cor = { violet: Colors.violet3, amber: Colors.amber, red: Colors.red, green: Colors.green }[tom];
  const fundo = { violet: Colors.violetD, amber: Colors.amberD, red: Colors.redD, green: Colors.greenD }[tom];
  return (
    <View style={[st.nota, { backgroundColor: fundo, borderColor: cor + "55" }]} testID={testID}>
      <Icon name={icon as any} size={16} color={cor} />
      <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
    </View>
  );
}

function Botao({ label, onPress, tipo = "pri", disabled, carregando, icon, testID }: {
  label: string; onPress: () => void; tipo?: "pri" | "sec" | "gh"; disabled?: boolean; carregando?: boolean; icon?: string; testID?: string;
}) {
  const off = disabled || carregando;
  return (
    <Pressable
      onPress={off ? undefined : onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off }}
      testID={testID}
      style={[st.btn, tipo === "pri" ? st.btnPri : tipo === "sec" ? st.btnSec : st.btnGh, off && { opacity: 0.5 }]}
    >
      {carregando ? <ActivityIndicator size="small" color={tipo === "pri" ? "#fff" : Colors.violet3} /> : icon ? <Icon name={icon as any} size={14} color={tipo === "pri" ? "#fff" : Colors.violet3} /> : null}
      <Text style={[st.btnTxt, tipo === "pri" ? { color: "#fff" } : { color: tipo === "gh" ? Colors.violet3 : Colors.ink }]}>{label}</Text>
    </Pressable>
  );
}

function Opcao({ titulo, sub, ativo, onPress, tag, testID }: { titulo: string; sub?: string; ativo: boolean; onPress: () => void; tag?: string; testID?: string }) {
  return (
    <Pressable onPress={onPress} style={[st.opc, ativo && st.opcOn]} accessibilityRole="radio" accessibilityState={{ checked: ativo }} testID={testID}>
      <View style={[st.rd, ativo && st.rdOn]}>{ativo ? <View style={st.rdIn} /> : null}</View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={st.opcT}>
          {titulo}
          {tag ? <Text style={st.tagr}>{"  " + tag}</Text> : null}
        </Text>
        {sub ? <Text style={st.opcS}>{sub}</Text> : null}
      </View>
    </Pressable>
  );
}

function Caixa({ marcado, onPress, children, erro, testID }: { marcado: boolean; onPress: () => void; children: ReactNode; erro?: boolean; testID?: string }) {
  return (
    <Pressable onPress={onPress} style={[st.chk, marcado && st.opcOn, erro && { borderColor: Colors.red }]} accessibilityRole="checkbox" accessibilityState={{ checked: marcado }} testID={testID}>
      <View style={[st.chkBox, marcado && { backgroundColor: Colors.violet, borderColor: Colors.violet }]}>
        {marcado ? <Icon name="check" size={12} color="#fff" /> : null}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
    </Pressable>
  );
}

function Chave({ ligada, onPress, disabled, label, testID }: { ligada: boolean; onPress: () => void; disabled?: boolean; label: string; testID?: string }) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: ligada, disabled: !!disabled }}
      testID={testID}
      style={[st.tg, ligada && { backgroundColor: Colors.violet }, disabled && { opacity: 0.45 }]}
    >
      <View style={[st.tgBola, ligada && { left: 21 }]} />
    </Pressable>
  );
}

function Recolhido({ titulo, sub, aberto, onToggle, children, testID }: { titulo: string; sub?: string; aberto: boolean; onToggle: () => void; children: ReactNode; testID?: string }) {
  return (
    <View style={[st.rf, aberto && { borderColor: Colors.border2 }]}>
      <Pressable onPress={onToggle} style={st.rfH} accessibilityRole="button" accessibilityState={{ expanded: aberto }} testID={testID}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={st.rfT}>{titulo}</Text>
          {sub ? <Text style={st.rfS}>{sub}</Text> : null}
        </View>
        <Icon name={aberto ? "chevron_up" : "chevron_down"} size={16} color={Colors.ink3} />
      </Pressable>
      {aberto ? <View style={st.rfB}>{children}</View> : null}
    </View>
  );
}

export function LinhaDeAjuda() {
  return (
    <View style={st.helpl} testID="nfse-pronto-ajuda">
      <Icon name="info" size={16} color={Colors.violet3} />
      <Text style={st.helplTxt}>
        {"Em caso de dúvidas, acione seu contador ou o suporte Aura · "}
        <Text style={{ fontWeight: "700", color: Colors.ink }}>11 95630-5269</Text>
      </Text>
      <Pressable
        onPress={() => { Linking.openURL(waAura("Oi! Preciso de ajuda para configurar a NFS-e na Aura.")).catch(() => {}); }}
        style={st.btnWa}
        accessibilityRole="link"
        accessibilityLabel="WhatsApp da Aura"
      >
        <Icon name="message_circle" size={14} color={Colors.green} />
        <Text style={st.btnWaTxt}>WhatsApp da Aura</Text>
      </Pressable>
    </View>
  );
}

/** Segmentos de progresso (um por cartão). */
export function Segmentos({ estados, mini }: { estados: Record<Cartao, EstadoPasso>; mini?: boolean }) {
  return (
    <View style={[st.segs, mini && { gap: 3 }]}>
      {CARTOES.map((c) => (
        <View
          key={c}
          style={[
            st.seg, mini && { height: 5 },
            estados[c] === "ok" && { backgroundColor: "#34d399" },
            estados[c] === "problema" && { backgroundColor: "#f87171" },
          ]}
        />
      ))}
    </View>
  );
}

// ── componente ─────────────────────────────────────────────
export function ProntoParaEmitirNfse(p: Props) {
  const { config: q, automatica: qa, recarregar } = useNfseConfig(p.companyId);
  const resposta = q.data || null;
  const cfg: ConfigNfse = (resposta && resposta.config) || {};
  const sit: SituacaoNfse | null = situacaoDe(resposta);
  const est = estadosDosCartoes(sit);
  const ativo = !!cfg.is_active && String(cfg.ambiente || "") === "producao";
  const pronta = estaEmitindo(sit);
  const sug = (sit && sit.sugestao) || {};

  const [aberto, setAberto] = useState<Cartao | "">("");
  const abriuSozinho = useRef(false);
  useEffect(() => {
    if (!sit || abriuSozinho.current) return;
    abriuSozinho.current = true;
    const prox = proximoCartao(est);
    if (prox) setAberto(prox);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sit]);

  // ── formulário "Dados da nota" ───────────────────────────
  const [ibge, setIbge] = useState("");
  const [op, setOp] = useState<number | null>(null);
  const [regAp, setRegAp] = useState<number>(1);
  const [codigo, setCodigo] = useState("");
  const [nbs, setNbs] = useState("");
  const [im, setIm] = useState("");
  const [jaEmite, setJaEmite] = useState<JaEmite>("");
  const [serie, setSerie] = useState("");
  const [ultimo, setUltimo] = useState("");
  const [conferi, setConferi] = useState(false);
  const [maisCampos, setMaisCampos] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  // ── "Ligar" ──────────────────────────────────────────────
  const [ptot, setPtot] = useState("");
  const [retem, setRetem] = useState<"" | "sim" | "nao">("");
  const [aliq, setAliq] = useState("");
  // ── prefeitura ───────────────────────────────────────────
  const [cnc, setCnc] = useState<"" | "sim" | "nao" | "nao_sei">("");
  const [pedidoAberto, setPedidoAberto] = useState(false);

  const semeado = useRef(false);
  useEffect(() => {
    if (!q.data || semeado.current) return;
    semeado.current = true;
    const c = q.data.config || {};
    const sg = (situacaoDe(q.data) || ({} as any)).sugestao || {};
    setIbge(soDigitos(c.municipio_ibge || sg.municipio_ibge || "", 7));
    setOp(c.op_simp_nac != null ? Number(c.op_simp_nac) : (sg.op_simp_nac ?? null));
    setRegAp(c.reg_ap_trib_sn != null ? Number(c.reg_ap_trib_sn) : 1);
    setCodigo(soDigitos(c.ctribnac_padrao || "", 6));
    setNbs(soDigitos(c.cnbs_padrao || "", 9));
    setIm(c.inscricao_municipal || "");
    // "Já emite NFS-e por outro emissor?" (migration 443): sem resposta, fica em branco
    if (c.outro_emissor === true) {
      setJaEmite("sim");
      setSerie(c.outro_emissor_serie != null ? String(c.outro_emissor_serie) : "");
      setUltimo(c.outro_emissor_ultimo_numero != null ? String(c.outro_emissor_ultimo_numero) : "");
    } else if (c.outro_emissor === false) setJaEmite("nao");
    setPtot(fmtPercentual(c.p_tot_trib_sn));
    setRetem(c.cliente_retem_iss === true ? "sim" : c.cliente_retem_iss === false ? "nao" : "");
    setAliq(fmtPercentual(c.aliquota_iss_retencao_sn));
    setCnc((c.prefeitura_cadastro_confirmado as any) || "");
  }, [q.data]);

  // Conflito de numeração (DPS_NUMERO_JA_USADO): abre "Dados da nota" para
  // corrigir, já no "Sim" com a série que o outro emissor usou.
  const conflito = conflitoDeNumeracao(sit);
  const chaveConflito = conflito ? (conflito.serie || "") + "/" + (conflito.numero || "") : "";
  const conflitoVisto = useRef("");
  useEffect(() => {
    if (!chaveConflito || conflitoVisto.current === chaveConflito) return;
    conflitoVisto.current = chaveConflito;
    setAberto("dados");
    setJaEmite("sim");
    setSerie((v) => v || (conflito && conflito.serie) || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveConflito]);

  const [salvando, setSalvando] = useState<string>("");
  const [testando, setTestando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoTeste | null>(null);
  const chaveTeste = useRef<string | null>(null);

  async function salvar(qual: string, body: Record<string, unknown>, ok: string, depois?: Cartao | "") {
    setSalvando(qual);
    try {
      await nfseConfigApi.salvar(p.companyId, { provider: "nacional", ...body });
      toast.success(ok);
      recarregar();
      await q.refetch();
      if (depois !== undefined) setAberto(depois);
      return true;
    } catch (e: any) {
      toast.error(erroDaApi(e, "Não conseguimos salvar agora. Tente de novo em instantes."));
      return false;
    } finally {
      setSalvando("");
    }
  }

  // ── ações ────────────────────────────────────────────────
  function salvarDados() {
    const e: Record<string, string> = {};
    if (!/^\d{7}$/.test(ibge)) e.ibge = "Informe o código IBGE do município, com 7 números.";
    if (!op) e.op = "Escolha a Situação perante o Simples Nacional.";
    if (statusDoCodigo(codigo) !== "ok") e.codigo = "Escolha um Código de Tributação Nacional de 6 números da lista.";
    if (nbs && nbs.length !== 9) e.nbs = "O Código NBS tem 9 números. Complete ou deixe em branco.";
    if (im.trim().length > 15) e.im = "A Inscrição Municipal tem até 15 caracteres.";
    const oe = camposDoOutroEmissor(jaEmite, { serie, ultimo });
    if ("erro" in oe) e.serie = oe.erro;
    if (!conferi) e.conferi = "Marque a confirmação para seguir.";
    setErros(e);
    if (Object.keys(e).length) {
      if (e.nbs || e.im) setMaisCampos(true);
      return;
    }
    const body: Record<string, unknown> = {
      municipio_ibge: ibge,
      op_simp_nac: op,
      reg_ap_trib_sn: op === 3 ? regAp : null,
      ctribnac_padrao: codigo,
      cnbs_padrao: nbs || null,
      inscricao_municipal: im.trim() || null,
      // a série da Aura fica a de hoje (padrão 1); na mesma série do outro
      // emissor, o backend continua do número seguinte
      serie: String(cfg.serie || "1"),
      serie_confirmada: true,
      ...(oe as Record<string, unknown>),
    };
    const prox = est.certificado === "ok" ? "teste" : "certificado";
    salvar("dados", body, "Dados da nota salvos.", prox);
  }

  async function emitirTeste() {
    if (!chaveTeste.current) chaveTeste.current = novaChave();
    setTestando(true);
    setAberto("teste");
    try {
      const r: RespostaTeste = await nfseConfigApi.emitirTeste(p.companyId, chaveTeste.current);
      setResultado(r.resultado);
      // Sem resposta do gov.br: guarda a chave, o próximo clique retoma a
      // MESMA nota. Com resposta (aceita ou com aviso): o próximo é um teste novo.
      if (!(r.resultado && r.resultado.aguardando)) chaveTeste.current = null;
      recarregar();
      await q.refetch();
      if (r.resultado && (r.resultado.status === "ok" || r.resultado.status === "aviso")) setAberto("ligar");
    } catch (e: any) {
      toast.error(erroDaApi(e, "Não conseguimos emitir a nota de teste agora. Tente de novo em instantes."));
    } finally {
      setTestando(false);
    }
  }

  function salvarPrefeitura() {
    if (im.trim().length > 15) { setErros({ im: "A Inscrição Municipal tem até 15 caracteres." }); return; }
    salvar("pref", {
      inscricao_municipal: im.trim() || null,
      prefeitura_cadastro_confirmado: cnc || null,
    }, cnc === "sim" ? "Salvo. Agora emita a nota de teste de novo." : "Salvo.");
  }

  function camposDoSimples(): Record<string, unknown> | null {
    if (op !== 3) return {};
    const e: Record<string, string> = {};
    const pt = lerPercentual(ptot);
    if (pt == null || pt >= 100) e.ptot = "Preencha com um valor entre 0 e 99,99.";
    if (!retem) e.retem = "Responda se algum cliente faz a Retenção do ISSQN.";
    const al = lerPercentual(aliq);
    if (retem === "sim" && (al == null || al < 1.8 || al > 5)) e.aliq = "Preencha a Alíquota que o contador passou, entre 1,80% e 5,00%.";
    setErros(e);
    if (Object.keys(e).length) return null;
    return {
      p_tot_trib_sn: pt,
      cliente_retem_iss: retem === "sim",
      aliquota_iss_retencao_sn: retem === "sim" ? al : null,
    };
  }

  function salvarSimples() {
    const b = camposDoSimples();
    if (!b) return;
    salvar("simples", b, "Salvo.");
  }

  async function alternarAtivo() {
    if (ativo) {
      const ok = await salvar("ativo", { is_active: false }, "NFS-e desligada nesta loja.");
      if (ok && qa.data && qa.data.emissao_automatica) {
        try { await nfseConfigApi.salvarAutomatica(p.companyId, false); recarregar(); } catch { /* segue */ }
      }
      return;
    }
    const b = camposDoSimples();
    if (!b) return;
    await salvar("ativo", { ...b, is_active: true, ambiente: "producao" }, "NFS-e ligada. A seção \"Nota de serviço\" já aparece no cadastro dos serviços.");
  }

  async function alternarAutomatica() {
    const novo = !(qa.data && qa.data.emissao_automatica);
    setSalvando("auto");
    try {
      await nfseConfigApi.salvarAutomatica(p.companyId, novo);
      toast.success(novo ? "Emissão automática ligada." : "Emissão automática desligada.");
      recarregar();
      await qa.refetch();
    } catch (e: any) {
      toast.error(erroDaApi(e, "Não conseguimos mudar agora. Tente de novo em instantes."));
    } finally {
      setSalvando("");
    }
  }

  // ── carregando / erro ────────────────────────────────────
  if (q.isLoading) {
    return (
      <View style={st.ready} testID="nfse-pronto-carregando">
        <ActivityIndicator color={Colors.violet3} />
      </View>
    );
  }
  if (q.isError || !sit) {
    return (
      <View style={st.ready} testID="nfse-pronto-erro">
        <Aviso tom="amber" icon="alert">
          <Text style={st.notaTxt}>Não conseguimos abrir a configuração da NFS-e agora. Tente de novo em instantes.</Text>
        </Aviso>
        <View style={st.acoes}><Botao tipo="sec" icon="refresh" label="Tentar de novo" onPress={() => q.refetch()} /></View>
        <View style={{ marginTop: 14 }}><LinhaDeAjuda /></View>
      </View>
    );
  }

  const ps = sit.passos;
  const prontos = contarProntos(est);
  const aguardando = aguardandoAura(sit);
  const proxNum = (ps.serie && ps.serie.proximo_numero) || String(cfg.next_dps_number || 1);
  const serieAtual = (ps.serie && ps.serie.serie) || String(cfg.serie || "1");
  const cidade = sug.municipio ? sug.municipio + (sug.uf ? " – " + sug.uf : "") : "";
  const prefeitura = prefeituraVisivel(sit);
  const res: ResultadoTeste | null = resultado;
  const codigoAviso = (res && res.codigo) || (ps.teste && ps.teste.codigo) || (ps.prefeitura && ps.prefeitura.codigo) || null;
  const avisoTeste = avisoDoTeste(sit);

  function resumo(c: Cartao): string {
    if (c === "certificado") {
      if (est.certificado === "ok" && ps.certificado.vale_ate) return "Enviado · vale até " + new Date(ps.certificado.vale_ate).toLocaleDateString("pt-BR");
      return ps.certificado.motivo;
    }
    if (c === "dados") {
      if (est.dados === "ok") {
        return [cidade || ("IBGE " + cfg.municipio_ibge), ROTULO_OP[Number(cfg.op_simp_nac)] || "", "Série da DPS " + serieAtual + " · próximo nº " + proxNum].filter(Boolean).join(" · ");
      }
      const pend = (["dados_fiscais", "codigo_padrao", "serie"] as const).find((k) => ps[k] && ps[k].estado !== "ok");
      return pend ? ps[pend].motivo : "Confira os dados da nota.";
    }
    if (c === "teste") {
      if (avisoTeste) return "Pode ligar · com um aviso do ambiente de testes do gov.br";
      if (est.teste === "ok") return "O gov.br aceitou a nota de teste" + (ps.teste.em ? " em " + fmtDiaMes(ps.teste.em) : "");
      if (prefeitura) return ps.prefeitura.motivo;
      return ps.teste.motivo;
    }
    if (est.ligar === "ok") return "Ligada · emissão automática " + (qa.data && qa.data.emissao_automatica ? "ligada" : "desligada");
    return ps.ligar.motivo;
  }

  // ── corpos ───────────────────────────────────────────────
  function corpoCertificado() {
    const pc = ps.certificado;
    const acao = p.ehLojaAtual
      ? <Botao icon="upload" label={est.certificado === "ok" ? "Trocar certificado" : "Enviar certificado"} tipo={est.certificado === "ok" ? "sec" : "pri"} onPress={p.onIrParaCertificado} testID="nfse-pronto-ir-certificado" />
      : <Botao icon="upload" label="Entrar nesta loja para enviar o certificado" onPress={() => p.onEntrarNaLoja && p.onEntrarNaLoja()} testID="nfse-pronto-entrar-loja" />;
    return (
      <View>
        {est.certificado === "ok" ? (
          <View style={st.cert}>
            <View style={st.certIco}><Icon name="shield" size={18} color={Colors.green} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={st.certT} numberOfLines={1}>{(sit && sit.certificado && sit.certificado.subject_cn) || p.nomeLoja}</Text>
              <Text style={st.certS}>{pc.vale_ate ? "Vale até " + new Date(pc.vale_ate).toLocaleDateString("pt-BR") : "Certificado enviado"}</Text>
            </View>
          </View>
        ) : est.certificado === "problema" ? (
          <Aviso tom="red" icon="alert"><Text style={st.notaTxt}><Text style={st.forte}>{pc.motivo}</Text></Text></Aviso>
        ) : (
          <Text style={st.par}>
            O certificado A1 é a "assinatura digital" da empresa: um arquivo <Text style={st.forte}>.pfx</Text> com senha, que o seu contador ou a certificadora entrega. É o <Text style={st.forte}>mesmo</Text> da nota do Caixa (NFC-e): se já enviou lá, não precisa enviar de novo.
          </Text>
        )}
        <Text style={st.hint}>É o mesmo certificado da nota do Caixa (NFC-e): enviou uma vez, serve para as duas notas.</Text>
        <View style={st.acoes}>{acao}</View>
      </View>
    );
  }

  function corpoDados() {
    const tagReceita = sug.op_simp_nac ? "pela Receita" : undefined;
    return (
      <View>
        <Campo label="Município">
          {sug.municipio_ibge || cfg.municipio_ibge ? (
            <View>
              <View style={st.lido}><Text style={st.lidoTxt}>{cidade || "Código IBGE " + ibge}</Text></View>
              <Text style={st.hint}>Veio do cadastro na Receita Federal · código IBGE <Text style={st.mono}>{ibge}</Text>. Se a empresa mudou de endereço, atualize em Configurações › Empresa.</Text>
            </View>
          ) : (
            <View>
              <Entrada value={ibge} onChangeText={(v: string) => setIbge(soDigitos(v, 7))} placeholder="Código IBGE, 7 números" keyboardType="number-pad" accessibilityLabel="Código IBGE do município" testID="nfse-pronto-ibge" style={[{ maxWidth: 220 }, erros.ibge && { borderColor: Colors.red }]} />
              <Text style={st.hint}>{cidade ? "Não achamos o código IBGE de " + cidade + " no cadastro. " : ""}Ele está no cartão CNPJ e no site do IBGE; o seu contador também tem.</Text>
            </View>
          )}
          {erros.ibge ? <Text style={st.hintErro}>{erros.ibge}</Text> : null}
        </Campo>

        <Campo label="Situação perante o Simples Nacional">
          <View style={st.opcoes}>
            <Opcao titulo="Não optante" sub="Lucro Presumido ou Real" ativo={op === 1} onPress={() => setOp(1)} tag={sug.op_simp_nac === 1 ? tagReceita : undefined} testID="nfse-pronto-op-1" />
            <Opcao titulo="Optante - MEI" sub="Microempreendedor individual" ativo={op === 2} onPress={() => setOp(2)} tag={sug.op_simp_nac === 2 ? tagReceita : undefined} testID="nfse-pronto-op-2" />
            <Opcao titulo="Optante - ME/EPP" sub="Microempresa ou empresa de pequeno porte" ativo={op === 3} onPress={() => setOp(3)} tag={sug.op_simp_nac === 3 ? tagReceita : undefined} testID="nfse-pronto-op-3" />
          </View>
          {erros.op ? <Text style={st.hintErro}>{erros.op}</Text> : null}
        </Campo>

        <CampoCodigoTributacao
          codigo={codigo}
          onCodigo={(c) => { setCodigo(c); setErros((x) => ({ ...x, codigo: "" })); }}
          testIDBase="nfse-padrao"
          optional="padrão da loja"
        />
        <Text style={[st.hint, { marginTop: -6, marginBottom: 12 }]}>
          Usado quando o serviço não tem código próprio. Dá para pôr um código diferente em cada serviço, no cadastro dele.
        </Text>
        {p.codigoDeOutraLoja && p.codigoDeOutraLoja.codigo !== codigo ? (
          <Text style={[st.hint, { marginTop: -6, marginBottom: 12 }]}>
            <Text style={st.link} onPress={() => setCodigo(p.codigoDeOutraLoja!.codigo)} accessibilityRole="button" testID="nfse-pronto-copiar-codigo">
              {"Usar o mesmo da loja " + p.codigoDeOutraLoja.nome}
            </Text>
          </Text>
        ) : null}
        {erros.codigo ? <Text style={[st.hintErro, { marginTop: -6, marginBottom: 12 }]}>{erros.codigo}</Text> : null}

        {conflito ? (
          <View style={{ marginBottom: 12 }}>
            <Aviso tom="amber" icon="alert" testID="nfse-pronto-conflito-serie">
              <Text style={st.notaTxt}><Text style={st.forte}>{textoDoConflito(conflito)}</Text></Text>
            </Aviso>
          </View>
        ) : null}
        <Campo label="Já emite NFS-e por outro emissor (site ou aplicativo do gov.br, outro sistema)?">
          <View style={st.opcoes}>
            <Opcao titulo="Sim" ativo={jaEmite === "sim"} onPress={() => { setJaEmite("sim"); setErros((x) => ({ ...x, serie: "" })); }} testID="nfse-pronto-ja-sim" />
            <Opcao titulo="Não" sub="A NFS-e da empresa sai só pela Aura" ativo={jaEmite === "nao"} onPress={() => { setJaEmite("nao"); setErros((x) => ({ ...x, serie: "" })); }} testID="nfse-pronto-ja-nao" />
          </View>
        </Campo>
        {jaEmite === "nao" ? (
          <Aviso tom="green" icon="check" testID="nfse-pronto-serie-padrao">
            <Text style={st.notaTxt}><Text style={st.forte}>{"Tudo certo: a Aura emite na Série da DPS " + String(cfg.serie || "1") + "."}</Text> E conta os próximos números sozinha.</Text>
          </Aviso>
        ) : null}
        {jaEmite === "sim" ? (
          <View>
            <View style={st.l2}>
              <Campo label="Série da DPS" optional="usada lá" style={{ flex: 1, minWidth: 140 }}>
                <Entrada value={serie} onChangeText={(v: string) => setSerie(soDigitos(v, 5))} placeholder="Ex.: 1" keyboardType="number-pad" accessibilityLabel="Série da DPS usada no outro emissor" testID="nfse-pronto-serie" />
              </Campo>
              <Campo label="Último Número da DPS" optional="usado lá" style={{ flex: 1, minWidth: 160 }}>
                <Entrada value={ultimo} onChangeText={(v: string) => setUltimo(soDigitos(v, 15))} placeholder="Ex.: 212" keyboardType="number-pad" accessibilityLabel="Último Número da DPS usado no outro emissor" testID="nfse-pronto-ultimo" />
              </Campo>
            </View>
            <Text style={[st.hint, { marginTop: -6, marginBottom: 12 }]} testID="nfse-pronto-ajuda-outro-emissor">A Aura usa uma série diferente ou continua do número seguinte, para nunca repetir uma nota. Os dois estão no PDF ou no XML da última nota de lá, nos campos "Série da DPS" e "Número da DPS"; o seu contador também ajuda.</Text>
          </View>
        ) : null}
        {erros.serie ? <Text style={st.hintErro} testID="nfse-pronto-erro-serie">{erros.serie}</Text> : null}

        <View style={{ marginTop: 12 }}>
          <Recolhido
            titulo="Mais campos (opcional)"
            sub="Código NBS, Inscrição Municipal e Regime de Apuração Tributária pelo SN. Se o contador não pediu, pode pular."
            aberto={maisCampos}
            onToggle={() => setMaisCampos((v) => !v)}
            testID="nfse-pronto-mais-campos"
          >
            <Campo label="Código NBS" optional="9 números">
              <Entrada value={fmtNbs(nbs)} onChangeText={(v: string) => setNbs(soDigitos(v, 9))} placeholder="0.0000.00.00" keyboardType="number-pad" accessibilityLabel="Código NBS" testID="nfse-pronto-nbs" style={[{ maxWidth: 240 }, erros.nbs && { borderColor: Colors.red }]} />
              <Text style={erros.nbs ? st.hintErro : st.hint}>{erros.nbs || "Nomenclatura Brasileira de Serviços. Usado só quando o serviço não tem NBS próprio."}</Text>
            </Campo>
            <Campo label="Inscrição Municipal">
              <Entrada value={im} onChangeText={(v: string) => setIm(v.slice(0, 15))} placeholder="Número da inscrição" accessibilityLabel="Inscrição Municipal" testID="nfse-pronto-im" style={{ maxWidth: 280 }} />
              <Text style={erros.im ? st.hintErro : st.hint}>{erros.im || "Está no alvará ou no carnê do ISS. Em muitas cidades não é pedida; tudo bem deixar em branco."}</Text>
            </Campo>
            {op === 3 ? (
              <Campo label="Regime de Apuração Tributária pelo SN">
                <View style={st.opcoes}>
                  <Opcao titulo="Tributos federais e municipal pelo SN" sub="O mais comum: tudo no DAS" ativo={regAp === 1} onPress={() => setRegAp(1)} testID="nfse-pronto-regap-1" />
                  <Opcao titulo="Federais pelo SN e ISSQN pela NFS-e" ativo={regAp === 2} onPress={() => setRegAp(2)} testID="nfse-pronto-regap-2" />
                  <Opcao titulo="Federais e municipal pela NFS-e" ativo={regAp === 3} onPress={() => setRegAp(3)} testID="nfse-pronto-regap-3" />
                </View>
                <Text style={st.hint}>Só muda se a loja passou de um limite do Simples. Na dúvida, deixe como está e confirme com o contador.</Text>
              </Campo>
            ) : null}
          </Recolhido>
        </View>

        <View style={{ marginTop: 12 }}>
          <Caixa marcado={conferi} onPress={() => { setConferi((v) => !v); setErros((x) => ({ ...x, conferi: "" })); }} erro={!!erros.conferi} testID="nfse-pronto-conferi">
            <Text style={st.notaTxt}><Text style={st.forte}>Conferi: esses são os dados certos da minha empresa.</Text></Text>
            <Text style={st.hint}>Se algo estiver diferente na Receita, avise o seu contador.</Text>
          </Caixa>
          {erros.conferi ? <Text style={st.hintErro}>{erros.conferi}</Text> : null}
        </View>
        <View style={st.acoes}>
          <Botao label="Salvar dados da nota" onPress={salvarDados} carregando={salvando === "dados"} testID="nfse-pronto-salvar-dados" />
        </View>
      </View>
    );
  }

  function blocoPrefeitura() {
    const cidadeCurta = sug.municipio || "";
    const titulo = res && res.passo === "prefeitura" ? res.titulo : ps.prefeitura.motivo;
    const caminho = res && res.passo === "prefeitura" && res.caminho.length ? res.caminho : [
      "Peça ao setor de tributos (ISS) da prefeitura" + (cidadeCurta ? " de " + cidadeCurta : "") + " para incluir a empresa no Cadastro Nacional de Contribuintes da NFS-e (CNC).",
      "Se a prefeitura passar uma Inscrição Municipal, preencha aqui.",
      "Assim que a prefeitura fizer o cadastro, emita a nota de teste de novo.",
    ];
    const cnpj = fmtCnpj(sug.cnpj || "");
    return (
      <View testID="nfse-pronto-prefeitura">
        <Aviso tom="amber" icon="building">
          <Text style={st.notaTxt}><Text style={st.forte}>{titulo}</Text></Text>
          <Text style={[st.notaTxt, { marginTop: 6 }]}>Não é erro seu nem da Aura. Falta um cadastro que <Text style={st.forte}>só a prefeitura faz</Text>.</Text>
        </Aviso>
        <View style={st.passos}>
          {caminho.map((t, i) => (
            <View key={i} style={st.passo}>
              <View style={st.passoN}><Text style={st.passoNTxt}>{i + 1}</Text></View>
              <Text style={st.passoTxt}>{t}</Text>
            </View>
          ))}
        </View>
        <Recolhido titulo="Texto pronto para mandar à prefeitura" sub="Copie e cole no e-mail, no protocolo do site ou leve impresso" aberto={pedidoAberto} onToggle={() => setPedidoAberto((v) => !v)} testID="nfse-pronto-texto-prefeitura">
          <View style={st.pedido}><Text style={st.pedidoTxt} selectable>{textoParaPrefeitura(sug.nome || p.nomeLoja, cnpj, cidadeCurta)}</Text></View>
          <View style={st.acoes}><Botao tipo="sec" icon="copy" label="Copiar texto" onPress={() => copiar(textoParaPrefeitura(sug.nome || p.nomeLoja, cnpj, cidadeCurta))} /></View>
        </Recolhido>
        <View style={{ height: 12 }} />
        <Campo label="Inscrição Municipal" optional="se a prefeitura já te deu">
          <Entrada value={im} onChangeText={(v: string) => setIm(v.slice(0, 15))} placeholder="Número da inscrição" accessibilityLabel="Inscrição Municipal" testID="nfse-pronto-im-pref" style={{ maxWidth: 280 }} />
          <Text style={erros.im ? st.hintErro : st.hint}>{erros.im || "Está no alvará ou no carnê do ISS."}</Text>
        </Campo>
        <Campo label="A prefeitura já incluiu sua empresa no Cadastro Nacional de Contribuintes da NFS-e?">
          <View style={st.opcoes}>
            <Opcao titulo="Sim, já incluiu" ativo={cnc === "sim"} onPress={() => setCnc("sim")} testID="nfse-pronto-cnc-sim" />
            <Opcao titulo="Ainda não" ativo={cnc === "nao"} onPress={() => setCnc("nao")} testID="nfse-pronto-cnc-nao" />
            <Opcao titulo="Não sei" ativo={cnc === "nao_sei"} onPress={() => setCnc("nao_sei")} testID="nfse-pronto-cnc-nao-sei" />
          </View>
          {cnc === "nao" ? <Text style={st.hint}>Sem problema: mande o texto pronto acima. Quando a prefeitura terminar, a nota de teste mostra.</Text> : null}
          {cnc === "nao_sei" ? <Text style={st.hint}>Normal não saber. Emita a nota de teste de novo daqui a alguns dias: se passar, está tudo certo.</Text> : null}
        </Campo>
        <View style={st.acoes}>
          <Botao label="Salvar" onPress={salvarPrefeitura} carregando={salvando === "pref"} testID="nfse-pronto-salvar-pref" />
        </View>
      </View>
    );
  }

  function corpoTeste() {
    const pt = ps.teste;
    const quando = pt.em ? fmtDiaMes(pt.em) : "";
    let resultadoBox: ReactNode = null;
    if (testando) {
      resultadoBox = (
        <View style={st.teste} testID="nfse-pronto-testando">
          <ActivityIndicator size="small" color={Colors.violet3} />
          <Text style={st.testeTxt}>Falando com o gov.br… leva uns segundos.</Text>
        </View>
      );
    } else if (avisoTeste) {
      resultadoBox = (
        <Aviso tom="amber" icon="alert" testID="nfse-pronto-teste-ok-aviso">
          <Text style={st.notaTxt}><Text style={st.forte}>Pode ligar a NFS-e.</Text></Text>
          <Text style={[st.notaTxt, { marginTop: 6 }]}>{avisoTeste}</Text>
        </Aviso>
      );
    } else if (est.teste === "ok") {
      resultadoBox = (
        <Aviso tom="green" icon="check" testID="nfse-pronto-teste-ok">
          <Text style={st.notaTxt}><Text style={st.forte}>{"Deu certo! O gov.br aceitou a nota de teste" + (quando ? " em " + quando : "") + "."}</Text></Text>
          <Text style={[st.notaTxt, { marginTop: 6 }]}>Certificado, prefeitura e código conferem. Falta só ligar a NFS-e.</Text>
        </Aviso>
      );
    } else if (est.teste === "problema" && !prefeitura) {
      resultadoBox = (
        <Aviso tom="amber" icon="alert" testID="nfse-pronto-teste-aviso">
          <Text style={st.notaTxt}><Text style={st.forte}>{res ? res.titulo : pt.motivo}</Text></Text>
          {res && res.mensagem ? <Text style={[st.notaTxt, { marginTop: 6 }]}>{res.mensagem}</Text> : null}
          {res && res.caminho && res.caminho.length ? res.caminho.map((t, i) => <Text key={i} style={[st.notaTxt, { marginTop: 4 }]}>{(i + 1) + ". " + t}</Text>) : null}
        </Aviso>
      );
    }
    return (
      <View>
        <Text style={st.par}>
          A Aura manda uma nota de serviço para o <Text style={st.forte}>ambiente de testes do gov.br</Text> (produção restrita), com os dados que você preencheu. Ela <Text style={st.forte}>não vale como nota</Text>, não vai para cliente nenhum e não gera imposto. Serve para saber, antes da primeira venda, se o certificado, a prefeitura e o código estão certos.
        </Text>
        {resultadoBox}
        {prefeitura && !testando ? <View style={{ marginTop: 12 }}>{blocoPrefeitura()}</View> : null}
        {est.teste === "travado" ? (
          <Text style={[st.hint, { marginTop: 10 }]}>{pt.motivo}</Text>
        ) : (
          <View style={st.acoes}>
            <Botao
              icon={est.teste === "falta" ? "zap" : "refresh"}
              label={est.teste === "falta" ? "Emitir nota de teste" : prefeitura ? "A prefeitura já fez? Testar de novo" : "Testar de novo"}
              tipo={est.teste === "ok" ? "gh" : "pri"}
              onPress={emitirTeste}
              carregando={testando}
              testID="nfse-pronto-emitir-teste"
            />
            {est.teste === "falta" ? <Text style={st.hint}>Sem valor fiscal · ninguém é cobrado</Text> : null}
          </View>
        )}
        {codigoAviso && (est.teste === "problema" || avisoTeste) && !testando ? (
          <Text style={st.codaviso} testID="nfse-pronto-codigo-aviso">
            {"Aviso do gov.br: " + codigoAviso + (quando ? " · teste de " + quando : "") + " · mostre este código ao contador ou ao suporte, se precisar"}
          </Text>
        ) : null}
      </View>
    );
  }

  function corpoLigar() {
    const automatica = !!(qa.data && qa.data.emissao_automatica);
    const autoNoServidor = !!(qa.data && qa.data.ligada_no_servidor);
    const podeLigar = !!(sit && sit.pronta_para_ligar && sit.producao_liberada);
    const simplesPendente = op === 3 && (lerPercentual(ptot) == null || !retem || (retem === "sim" && lerPercentual(aliq) == null));
    return (
      <View>
        {op === 3 ? (
          <View style={st.simples} testID="nfse-pronto-simples">
            <Text style={st.simplesT}>Só para quem está no Simples (ME ou EPP)</Text>
            <Text style={st.simplesS}>Números que o seu contador tem. Nenhum vem preenchido: eles mudam conforme o faturamento da loja.</Text>
            <Campo label="Alíquota do Simples Nacional" optional="valor aproximado dos tributos">
              <View style={[st.sufixo, erros.ptot && { borderColor: Colors.red }]}>
                <Entrada value={ptot} onChangeText={(v: string) => setPtot(v.replace(/[^\d,]/g, "").slice(0, 5))} placeholder="0,00" keyboardType="decimal-pad" accessibilityLabel="Alíquota do Simples Nacional" testID="nfse-pronto-ptot" style={st.sufixoIn} />
                <Text style={st.sufixoTxt}>%</Text>
              </View>
              <Text style={erros.ptot ? st.hintErro : st.hint}>{erros.ptot || "A nota mostra ao cliente quanto de imposto há no preço, como pede a lei. Use a alíquota efetiva do Simples do mês, que o contador calcula."}</Text>
            </Campo>
            <Campo label="Retenção do ISSQN" optional="algum cliente seu retém o ISSQN?">
              <View style={st.opcoes}>
                <Opcao titulo="Não" ativo={retem === "nao"} onPress={() => setRetem("nao")} testID="nfse-pronto-retem-nao" />
                <Opcao titulo="Sim, alguns retêm" sub="Acontece com empresas e órgãos públicos que contratam o serviço" ativo={retem === "sim"} onPress={() => setRetem("sim")} testID="nfse-pronto-retem-sim" />
              </View>
              {erros.retem ? <Text style={st.hintErro}>{erros.retem}</Text> : null}
            </Campo>
            {retem === "sim" ? (
              <Campo label="Alíquota" optional="do ISSQN no Simples, peça ao seu contador">
                <View style={[st.sufixo, erros.aliq && { borderColor: Colors.red }]}>
                  <Entrada value={aliq} onChangeText={(v: string) => setAliq(v.replace(/[^\d,]/g, "").slice(0, 4))} placeholder="0,00" keyboardType="decimal-pad" accessibilityLabel="Alíquota do ISSQN no Simples Nacional" testID="nfse-pronto-aliq" style={st.sufixoIn} />
                  <Text style={st.sufixoTxt}>%</Text>
                </View>
                <Text style={erros.aliq ? st.hintErro : st.hint}>{erros.aliq || "Vai na nota só quando o cliente faz a Retenção do ISSQN. Fica entre 1,80% e 5,00%. Não preenchemos por você: o número certo depende do faturamento."}</Text>
              </Campo>
            ) : null}
            <View style={[st.acoes, { marginTop: 4 }]}>
              <Botao tipo="sec" label="Salvar" onPress={salvarSimples} carregando={salvando === "simples"} testID="nfse-pronto-salvar-simples" />
            </View>
          </View>
        ) : null}

        {aguardando && !ativo ? (
          <View style={{ marginBottom: 10 }}>
            <Aviso icon="clock" testID="nfse-pronto-aguardando-aura">
              <Text style={st.notaTxt}><Text style={st.forte}>Sua loja está pronta!</Text> A Aura está liberando a emissão em produção e avisa você assim que terminar. Não precisa fazer mais nada.</Text>
            </Aviso>
          </View>
        ) : null}

        <View style={st.sw2}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={st.sw2T}>Emitir NFS-e nesta loja</Text>
            <Text style={st.sw2S}>{"Ligada, as notas passam a valer de verdade (ambiente de produção do gov.br), Série da DPS " + serieAtual + ", a partir do Número da DPS " + proxNum + "."}</Text>
            {!ativo && !podeLigar && !aguardando ? <Text style={st.sw2Motivo}>{ps.ligar.motivo}</Text> : null}
            {!ativo && simplesPendente && podeLigar ? <Text style={st.sw2Motivo}>Preencha os números do Simples acima para ligar.</Text> : null}
          </View>
          <Chave ligada={ativo} onPress={alternarAtivo} disabled={salvando === "ativo" || (!ativo && !podeLigar)} label="Emitir NFS-e" testID="nfse-pronto-chave-ativo" />
        </View>
        <View style={[st.sw2, { marginTop: 10 }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={st.sw2T}>Emitir automaticamente</Text>
            <Text style={st.sw2S}>A nota sai sozinha, sem você clicar em nada: na venda do Caixa que tem serviço, quando a OS é entregue e quando um pagamento é recebido.</Text>
            <Text style={st.sw2S}>Se a nota daquela venda já saiu, o app mostra "Imprimir 2ª via" e nunca emite duas vezes. Desligada, você emite pelo botão "Emitir NFS-e" em cada venda.</Text>
            {!autoNoServidor && qa.data ? <Text style={st.sw2Motivo}>A emissão automática ainda está chegando para todas as lojas.</Text> : null}
          </View>
          <Chave ligada={automatica} onPress={alternarAutomatica} disabled={salvando === "auto" || !ativo || !autoNoServidor} label="Emitir automaticamente" testID="nfse-pronto-chave-auto" />
        </View>
      </View>
    );
  }

  const corpo: Record<Cartao, () => ReactNode> = { certificado: corpoCertificado, dados: corpoDados, teste: corpoTeste, ligar: corpoLigar };

  return (
    <View style={[st.ready, pronta && st.readyDone]} testID="nfse-pronto">
      {pronta ? (
        <View>
          <View style={st.rdHead}>
            <View style={[st.rdIco, { backgroundColor: Colors.greenD }]}><Icon name="check" size={22} color={Colors.green} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={st.rdT}>{p.noGrupo ? p.nomeLoja + " já emite NFS-e" : "Sua loja já emite NFS-e"}</Text>
              <Text style={st.rdS}>
                A seção "Nota de serviço" já aparece no cadastro dos seus serviços.{" "}
                {qa.data && qa.data.emissao_automatica
                  ? "As notas saem sozinhas na venda com serviço, na OS entregue e no pagamento recebido."
                  : "Emissão automática desligada: emita pelo botão \"Emitir NFS-e\" em cada venda."}
              </Text>
            </View>
          </View>
          <View style={st.facts}>
            <View style={[st.pill, { backgroundColor: Colors.greenD, borderColor: Colors.green + "55" }]}><Text style={[st.pillTxt, { color: Colors.green }]}>Emitindo · produção</Text></View>
            {cidade ? <View style={st.pill}><Text style={st.pillTxt}>{cidade}</Text></View> : null}
            <View style={st.pill}><Text style={st.pillTxt}>{"Série da DPS " + serieAtual + " · próxima nº " + proxNum}</Text></View>
          </View>
        </View>
      ) : (
        <View>
          <View style={st.rdHead}>
            <View style={st.rdIco}><Icon name="receipt" size={22} color={Colors.violet3} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={st.rdT}>Pronto para emitir NFS-e?</Text>
              <Text style={st.rdS}>
                {p.noGrupo ? <Text style={st.forte}>{p.nomeLoja + " · "}</Text> : null}
                Siga os passos e a nota de serviço passa a sair pela Aura. A maior parte já veio do seu CNPJ: é só conferir.
              </Text>
            </View>
          </View>
          <View style={st.prog}>
            <Segmentos estados={est} />
            <Text style={st.progTxt} testID="nfse-pronto-progresso">
              {prontos + " de " + CARTOES.length + " prontos"}
              {CARTOES.filter((c) => est[c] === "problema").length ? " · " + CARTOES.filter((c) => est[c] === "problema").length + " com problema" : ""}
            </Text>
          </View>
          {aguardando ? (
            <View style={{ marginTop: 10 }}>
              <Aviso icon="clock" testID="nfse-pronto-banner-aura">
                <Text style={st.notaTxt}><Text style={st.forte}>Sua loja está pronta!</Text> A Aura está liberando a emissão em produção e avisa você assim que terminar.</Text>
              </Aviso>
            </View>
          ) : est.teste === "ok" && est.ligar !== "ok" && prontos === CARTOES.length - 1 ? (
            <View style={{ marginTop: 10 }}>
              <Aviso tom="green" icon="check"><Text style={st.notaTxt}><Text style={st.forte}>{avisoTeste ? "Tudo conferido. Falta só ligar." : "A nota de teste passou. Falta só ligar."}</Text></Text></Aviso>
            </View>
          ) : null}
        </View>
      )}

      <View style={st.ck}>
        {CARTOES.map((c, i) => {
          const e = est[c];
          // "travado" esperando a Aura liberar a produção ainda abre: a lojista
          // confere os números do Simples enquanto espera.
          const trava = e === "travado" && !(c === "ligar" && aguardando);
          const open = aberto === c && !trava;
          const lbl = e === "ok" ? "Editar" : e === "travado" ? "Ver" : "Resolver";
          return (
            <View key={c} style={[st.item, open && st.itemOpen]} testID={"nfse-pronto-cartao-" + c}>
              <Pressable
                onPress={() => { if (trava) return; setAberto(open ? "" : c); setErros({}); }}
                disabled={trava}
                accessibilityRole="button"
                accessibilityState={{ expanded: open, disabled: trava }}
                style={st.itH}
                testID={"nfse-pronto-abrir-" + c}
              >
                <Bolinha estado={e} n={i + 1} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={st.itTRow}>
                    <Text style={[st.itT, e === "travado" && { color: Colors.ink3 }]}>{(i + 1) + ". " + TITULO_DO_CARTAO[c]}</Text>
                    <Pilula estado={e} />
                  </View>
                  <Text style={[st.itD, e === "travado" && { color: Colors.ink3 }]} testID={"nfse-pronto-resumo-" + c}>{resumo(c)}</Text>
                </View>
                {!trava ? (
                  <View style={st.itA}>
                    <Text style={st.itALbl}>{lbl}</Text>
                    <Icon name={open ? "chevron_up" : "chevron_down"} size={16} color={Colors.violet3} />
                  </View>
                ) : null}
              </Pressable>
              {open ? <View style={st.itB}>{corpo[c]()}</View> : null}
            </View>
          );
        })}
      </View>
      <View style={{ marginTop: 14 }}><LinhaDeAjuda /></View>
    </View>
  );
}

const st = StyleSheet.create({
  ready: {
    backgroundColor: Colors.bg3, borderWidth: 1, borderColor: "rgba(124,58,237,0.30)",
    borderRadius: 18, padding: 18, marginBottom: 16,
  },
  readyDone: { borderColor: "rgba(5,150,105,0.40)" },
  rdHead: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  rdIco: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(124,58,237,0.12)" },
  rdT: { fontSize: 17, fontWeight: "800", color: Colors.ink },
  rdS: { fontSize: 13, color: Colors.ink2, marginTop: 3, lineHeight: 19 },
  prog: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16, marginBottom: 4 },
  progTxt: { fontSize: 12.5, fontWeight: "700", color: Colors.ink2 },
  segs: { flex: 1, flexDirection: "row", gap: 4 },
  seg: { flex: 1, height: 7, borderRadius: 4, backgroundColor: "rgba(109,40,217,0.10)" },
  facts: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 14 },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg3 },
  pillTxt: { fontSize: 11.5, fontWeight: "700", color: Colors.ink2 },
  ck: { marginTop: 14 },
  item: { borderTopWidth: 1, borderTopColor: Colors.border },
  itemOpen: { backgroundColor: "rgba(124,58,237,0.025)" },
  itH: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 4, minHeight: 56 },
  itTRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  itT: { fontSize: 13.5, fontWeight: "700", color: Colors.ink },
  itD: { fontSize: 12.5, color: Colors.ink2, marginTop: 2, lineHeight: 17 },
  itA: { flexDirection: "row", alignItems: "center", gap: 6 },
  itALbl: { fontSize: 12.5, fontWeight: "700", color: Colors.violet3 },
  itB: { paddingLeft: IS_ESTREITO() ? 0 : 42, paddingRight: 4, paddingBottom: 18, paddingTop: 2 },
  st: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  stOk: { backgroundColor: "#34d399" },
  stPr: { backgroundColor: Colors.red },
  stPrTxt: { color: "#fff", fontSize: 13, fontWeight: "800" },
  stLk: { backgroundColor: "rgba(109,40,217,0.08)" },
  stPe: { borderWidth: 2, borderColor: Colors.amber },
  stPeTxt: { color: Colors.amber, fontSize: 12, fontWeight: "800" },
  nota: { flexDirection: "row", gap: 10, alignItems: "flex-start", borderWidth: 1, borderRadius: 11, paddingHorizontal: 13, paddingVertical: 11 },
  notaTxt: { fontSize: 12.5, color: Colors.ink2, lineHeight: 18 },
  forte: { fontWeight: "700", color: Colors.ink },
  par: { fontSize: 12.5, color: Colors.ink2, lineHeight: 18, marginBottom: 12 },
  hint: { fontSize: 11.5, color: Colors.ink3, marginTop: 5, lineHeight: 16 },
  hintErro: { fontSize: 11.5, color: Colors.red, marginTop: 5, lineHeight: 16 },
  link: { color: Colors.violet3, fontWeight: "700" },
  mono: { fontWeight: "700", color: Colors.ink },
  acoes: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 14 },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 10, borderWidth: 1, borderColor: "transparent", minHeight: 40, paddingHorizontal: 15 },
  btnPri: { backgroundColor: Colors.violet },
  btnSec: { backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  btnGh: { backgroundColor: "transparent", paddingHorizontal: 8 },
  btnTxt: { fontSize: 13, fontWeight: "700" },
  opcoes: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  opc: { flexDirection: "row", gap: 9, alignItems: "flex-start", backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10, minHeight: 44, flexGrow: 1, flexBasis: 180 },
  opcOn: { borderColor: Colors.violet, backgroundColor: Colors.violetD },
  opcT: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  opcS: { fontSize: 12, color: Colors.ink3, marginTop: 1, lineHeight: 16 },
  tagr: { fontSize: 10, fontWeight: "700", color: Colors.green },
  rd: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: Colors.border2, alignItems: "center", justifyContent: "center", marginTop: 1 },
  rdOn: { borderColor: Colors.violet },
  rdIn: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.violet },
  chk: { flexDirection: "row", gap: 10, alignItems: "flex-start", backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 11 },
  chkBox: { width: 18, height: 18, borderRadius: 5, borderWidth: 2, borderColor: Colors.border2, alignItems: "center", justifyContent: "center", marginTop: 1 },
  lido: { backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, minHeight: 42, justifyContent: "center" },
  lidoTxt: { fontSize: 13.5, color: Colors.ink },
  l2: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  cert: { flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 12 },
  certIco: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.greenD, alignItems: "center", justifyContent: "center" },
  certT: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  certS: { fontSize: 12, color: Colors.ink3 },
  rf: { borderWidth: 1, borderColor: Colors.border, borderRadius: 10, backgroundColor: Colors.bg3 },
  rfH: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, minHeight: 44 },
  rfT: { fontSize: 12.5, fontWeight: "700", color: Colors.ink },
  rfS: { fontSize: 11, color: Colors.ink3, marginTop: 1, lineHeight: 15 },
  rfB: { paddingHorizontal: 12, paddingBottom: 12 },
  passos: { marginTop: 10, marginBottom: 12, gap: 8 },
  passo: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  passoN: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2, alignItems: "center", justifyContent: "center" },
  passoNTxt: { fontSize: 11, fontWeight: "800", color: Colors.violet3 },
  passoTxt: { flex: 1, fontSize: 12.5, color: Colors.ink2, lineHeight: 18 },
  pedido: { backgroundColor: Colors.bg4, borderWidth: 1, borderStyle: "dashed", borderColor: Colors.border2, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  pedidoTxt: { fontSize: 12, color: Colors.ink2, lineHeight: 18 },
  teste: { flexDirection: "row", gap: 10, alignItems: "center", borderWidth: 1, borderColor: Colors.border, borderRadius: 12, backgroundColor: Colors.bg3, padding: 14 },
  testeTxt: { fontSize: 13, fontWeight: "600", color: Colors.violet3 },
  codaviso: { fontSize: 11, color: Colors.ink3, marginTop: 8 },
  simples: { borderWidth: 1, borderColor: Colors.border, borderRadius: 12, backgroundColor: Colors.bg4, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12 },
  simplesT: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  simplesS: { fontSize: 12, color: Colors.ink3, marginTop: 2, marginBottom: 12, lineHeight: 17 },
  sufixo: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 9, paddingRight: 12, maxWidth: 200 },
  sufixoIn: { flex: 1, borderWidth: 0, backgroundColor: "transparent" },
  sufixoTxt: { fontSize: 13, color: Colors.ink3, fontWeight: "600" },
  sw2: { flexDirection: "row", gap: 12, alignItems: "flex-start", backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  sw2T: { fontSize: 13.5, fontWeight: "700", color: Colors.ink },
  sw2S: { fontSize: 12, color: Colors.ink2, marginTop: 2, lineHeight: 17 },
  sw2Motivo: { fontSize: 12, color: Colors.amber, fontWeight: "600", marginTop: 4, lineHeight: 17 },
  tg: { width: 46, height: 28, borderRadius: 14, backgroundColor: "rgba(109,40,217,0.18)", marginTop: 2 },
  tgBola: { position: "absolute", top: 3, left: 3, width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff" },
  helpl: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border },
  helplTxt: { flexGrow: 1, flexBasis: 220, fontSize: 12.5, color: Colors.ink2, lineHeight: 18 },
  btnWa: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 10, borderWidth: 1, borderColor: "rgba(5,150,105,0.45)", backgroundColor: Colors.bg3, minHeight: 36, paddingHorizontal: 12 },
  btnWaTxt: { fontSize: 12.5, fontWeight: "600", color: Colors.green },
});

function IS_ESTREITO(): boolean {
  return typeof window !== "undefined" && typeof window.innerWidth === "number" ? window.innerWidth < 760 : false;
}

export default ProntoParaEmitirNfse;
