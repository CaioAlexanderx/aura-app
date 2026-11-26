// ============================================================
// AURA. — Nova condicional · passo 3 (Prazo e conferência) e Pronto (C7)
//
// Mockup "nova.p3" e "nova.p4":
//   3. "Até quando ela devolve?" (1, 2, 3, 7 dias ou outra data), vendedora,
//      observação e o texto da loja no comprovante (editável, um por loja).
//      "Guardar condicional" manda o POST com Idempotency-Key estável.
//   4. "Condicional C-0031 guardada", com Imprimir na bobina, Imprimir em A4
//      e Enviar pelo WhatsApp (as funções do C8, chamadas direto no clique).
//
// Guardar não é venda: nada foi cobrado.
// ============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { CalendarioDoDia } from "@/components/CalendarioDoDia";
import { usePdvSettings } from "@/hooks/usePdvSettings";
import { pdvSettingsApi, companiesApi } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { maskPhone } from "@/utils/masks";
import { normalizarTelefone, TELEFONE_MAX_CARACTERES } from "@/utils/telefone";
import { employeesApi } from "@/services/employeesApi";
import { novaChaveDaVenda, chaveDaVendaJaUsada } from "@/utils/chaveDaVenda";
import { telefoneParaEnviar } from "@/utils/telefone";
import { imprimirComprovanteDaCondicional, type FormatoDoComprovante } from "@/services/imprimirCondicional";
import { abrirWhatsappDaCondicional } from "@/utils/condicionalWhatsapp";
import { fmtBRL } from "../../../pdv/troca/types";
import { hojeEmSaoPaulo, dataLonga } from "../../../pdv/pedido/corpoDoPedido";
import { TEXTOS_DA_NOVA as T } from "./textos";
import { e } from "./Casca";
import { condicionaisApi, faltasDoErro, frasePronta, type CondicionalGuardada, type CorpoDaCondicional, type FaltaDaCondicional } from "./api";
import type { ClienteDaCondicional, PecaDaCondicional } from "./busca";
import { DIAS_DO_PRAZO, diaCurto, dataDentroDoPrazo, prazoInicial, somarDias, type PrazoEscolhido } from "./prazos";

export type EstadoDaNova = {
  lojaId: string | null;
  cliente: ClienteDaCondicional | null;
  telefoneAvulso: string;
  pecas: PecaDaCondicional[];
  faltas: FaltaDaCondicional[] | null;
  hoje?: string;
};

type Erro = { tipo: "rede" } | { tipo: "outro"; mensagem: string };
export type ResultadoDoGuardar = { tipo: "ok" } | { tipo: "faltas"; faltas: FaltaDaCondicional[] } | { tipo: "erro" };

export type Guardar = {
  hoje: string;
  prazo: PrazoEscolhido;
  escolherDias: (d: 1 | 2 | 3 | 7) => void;
  escolherData: (iso: string) => void;
  outraDataAberta: boolean;
  setOutraDataAberta: (v: boolean) => void;
  vendedoras: Array<{ id: string; name: string }>;
  vendedoraId: string | null;
  setVendedoraId: (id: string | null) => void;
  obs: string;
  setObs: (v: string) => void;
  termos: string;
  editandoTermos: boolean;
  setEditandoTermos: (v: boolean) => void;
  rascunhoDosTermos: string;
  setRascunhoDosTermos: (v: string) => void;
  salvarTermos: () => Promise<void>;
  salvandoTermos: boolean;
  erroDosTermos: boolean;
  enviando: boolean;
  erro: Erro | null;
  guardada: CondicionalGuardada | null;
  guardar: () => Promise<ResultadoDoGuardar>;
  recomecar: () => void;
};

/** Tudo do passo 3 e o POST. A chave de idempotência é a mesma em toda nova tentativa do mesmo corpo. */
export function useGuardarCondicional(estado: EstadoDaNova, opts: { onCriada: (c: CondicionalGuardada) => void }): Guardar {
  const hoje = estado.hoje || hojeEmSaoPaulo();
  const { settings } = usePdvSettings(estado.lojaId);
  const qc = useQueryClient();
  const padrao = (settings as any)?.condicional_prazo_padrao;
  const termosDaLoja = String((settings as any)?.condicional_termos || "");

  const [prazo, setPrazo] = useState<PrazoEscolhido>(() => prazoInicial(hoje, padrao));
  const [prazoMexido, setPrazoMexido] = useState(false);
  const [outraDataAberta, setOutraDataAberta] = useState(false);
  const [vendedoraEscolhida, setVendedoraEscolhida] = useState<string | null | undefined>(undefined);
  const usuarioId = String((useAuthStore() as any)?.user?.id || "");
  const [obs, setObs] = useState("");
  const [editandoTermos, setEditandoTermos] = useState(false);
  const [rascunho, setRascunho] = useState("");
  const [salvandoTermos, setSalvandoTermos] = useState(false);
  const [erroDosTermos, setErroDosTermos] = useState(false);
  const [termosSalvos, setTermosSalvos] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<Erro | null>(null);
  const [guardada, setGuardada] = useState<CondicionalGuardada | null>(null);
  const chaveRef = useRef<{ chave: string; assinatura: string } | null>(null);

  // O prazo padrão da loja chega depois das configurações: vale enquanto ela não mexeu.
  useEffect(() => {
    if (!prazoMexido) setPrazo(prazoInicial(hoje, padrao));
  }, [padrao, hoje, prazoMexido]);

  const { data: dadosDeEquipe } = useQuery({
    queryKey: ["condicional-vendedoras", estado.lojaId],
    queryFn: () => employeesApi.list(estado.lojaId as string),
    enabled: !!estado.lojaId,
    staleTime: 60000,
  });
  const vendedoras = useMemo(
    () => ((dadosDeEquipe as any)?.employees || [])
      .filter((x: any) => x && x.id && x.is_active !== false && (x.status || "active") === "active")
      .map((x: any) => ({ id: String(x.id), name: String(x.name || ""), userId: x.user_id ? String(x.user_id) : "" }))
      .filter((x: { name: string }) => !!x.name),
    [dadosDeEquipe],
  );
  // Quem está logada é funcionária cadastrada (employee ligado ao usuário): já vem marcada. Senão, nenhuma.
  const vendedoraDaSessao = usuarioId ? (vendedoras.find((v: { userId: string }) => v.userId === usuarioId)?.id ?? null) : null;
  const vendedoraId = vendedoraEscolhida !== undefined ? vendedoraEscolhida : vendedoraDaSessao;
  const setVendedoraId = (id: string | null) => setVendedoraEscolhida(id);

  const termos = termosSalvos !== null ? termosSalvos : termosDaLoja;

  async function salvarTermos() {
    if (!estado.lojaId || salvandoTermos) return;
    setSalvandoTermos(true);
    setErroDosTermos(false);
    const texto = rascunho.trim();
    try {
      const res = await pdvSettingsApi.save(estado.lojaId, { condicional_termos: texto } as any);
      setTermosSalvos(texto);
      setEditandoTermos(false);
      qc.setQueryData(["pdv-settings", estado.lojaId], (old: any) => ({
        ...(old || {}), settings: { ...((old && old.settings) || {}), ...((res && res.settings) || {}), condicional_termos: texto },
      }));
    } catch {
      setErroDosTermos(true);
    } finally {
      setSalvandoTermos(false);
    }
  }

  function corpo(): CorpoDaCondicional | null {
    const c = estado.cliente;
    if (!c) return null;
    const vend = vendedoras.find((v: { id: string }) => v.id === vendedoraId) || null;
    const c1: CorpoDaCondicional = {
      customer_id: c.id,
      items: estado.pecas.map((p) => ({ product_id: p.productId, ...(p.variantId ? { variant_id: p.variantId } : {}) })),
      due_date: prazo.data,
    };
    if (!c.phone && estado.telefoneAvulso) c1.customer_phone = telefoneParaEnviar(estado.telefoneAvulso);
    if (vend) { c1.employee_id = vend.id; c1.seller_name = vend.name; }
    if (obs.trim()) c1.notes = obs.trim();
    return c1;
  }

  async function guardar(): Promise<ResultadoDoGuardar> {
    const body = corpo();
    if (enviando || !body || !estado.lojaId || estado.pecas.length === 0) return { tipo: "erro" };
    if (!dataDentroDoPrazo(prazo.data, hoje)) { setErro({ tipo: "outro", mensagem: T.dataFora }); return { tipo: "erro" }; }
    // Mesma chave enquanto o corpo é o mesmo (Tentar de novo); corpo diferente, chave nova.
    const assinatura = JSON.stringify(body);
    if (!chaveRef.current || chaveRef.current.assinatura !== assinatura) chaveRef.current = { chave: novaChaveDaVenda(), assinatura };
    setEnviando(true);
    setErro(null);
    try {
      const r = await condicionaisApi.guardar(estado.lojaId, body, chaveRef.current.chave);
      chaveRef.current = null;
      // O backend usa o telefone só nesta condicional (não altera o cadastro): quem digitou aqui grava no cadastro.
      if (!estado.cliente?.phone && estado.telefoneAvulso) {
        companiesApi.updateCustomer(estado.lojaId, estado.cliente!.id, { phone: telefoneParaEnviar(estado.telefoneAvulso) })
          .then(() => qc.invalidateQueries({ queryKey: ["customers"] }))
          .catch(() => { /* a condicional já está guardada; o cadastro se completa depois na ficha */ });
      }
      setGuardada(r.condicional);
      opts.onCriada(r.condicional);
      return { tipo: "ok" };
    } catch (err: any) {
      const faltas = faltasDoErro(err);
      if (faltas) return { tipo: "faltas", faltas };
      if (chaveDaVendaJaUsada(err)) {
        chaveRef.current = null;
        setErro({ tipo: "outro", mensagem: T.chaveUsada });
      } else {
        const frase = frasePronta(err);
        if (frase) setErro({ tipo: "outro", mensagem: frase });
        else if (err?.isNetworkError || !err?.status || err.status >= 500) setErro({ tipo: "rede" });
        else setErro({ tipo: "outro", mensagem: err?.data?.error || err?.message || T.erroDeRedeTitulo });
      }
      return { tipo: "erro" };
    } finally {
      setEnviando(false);
    }
  }

  function recomecar() {
    setPrazo(prazoInicial(hoje, padrao));
    setPrazoMexido(false);
    setOutraDataAberta(false);
    setVendedoraEscolhida(undefined);
    setObs("");
    setEditandoTermos(false);
    setErro(null);
    setGuardada(null);
    chaveRef.current = null;
  }

  return {
    hoje, prazo,
    escolherDias: (d) => { setPrazoMexido(true); setOutraDataAberta(false); setPrazo({ dias: d, data: somarDias(hoje, d) }); },
    escolherData: (iso) => { setPrazoMexido(true); setPrazo({ dias: 0, data: iso }); },
    outraDataAberta, setOutraDataAberta,
    vendedoras, vendedoraId, setVendedoraId,
    obs, setObs,
    termos, editandoTermos,
    setEditandoTermos: (v) => { if (v) setRascunho(termos); setEditandoTermos(v); setErroDosTermos(false); },
    rascunhoDosTermos: rascunho, setRascunhoDosTermos: setRascunho,
    salvarTermos, salvandoTermos, erroDosTermos,
    enviando, erro, guardada, guardar, recomecar,
  };
}

// ── Passo 3 ──────────────────────────────────────────────────────────
function Passo3({ guardar: g }: { estado: EstadoDaNova; guardar: Guardar }) {
  const rotulos: Record<number, string> = { 1: T.umDia, 2: T.doisDias, 3: T.tresDias, 7: T.seteDias };
  return (
    <View testID="nova-passo-3">
      {g.erro && (
        <View style={[e.nota, e.notaVm, { marginTop: 0, marginBottom: 14 }]} testID="nova-erro" accessibilityRole="alert">
          <Icon name="alert" size={15} color={Colors.red} />
          <Text style={e.notaTxt}>
            {g.erro.tipo === "rede"
              ? <><Text style={{ fontWeight: "700", color: Colors.ink }}>{T.erroDeRedeTitulo}</Text>{T.erroDeRedeTexto}</>
              : g.erro.mensagem}
          </Text>
        </View>
      )}

      <Text style={e.qst}>{T.ateQuandoDevolve}</Text>
      <View style={s.chips}>
        {DIAS_DO_PRAZO.map((d) => {
          const on = g.prazo.dias === d;
          return (
            <Pressable key={d} testID={"nova-prazo-" + d} onPress={() => g.escolherDias(d)} style={[s.chip, on && s.chipOn]}
              accessibilityRole="radio" accessibilityState={{ selected: on }}>
              <Text style={[s.chipTxt, on && s.chipTxtOn]}>{rotulos[d]}</Text>
              <Text style={[s.chipSub, on && s.chipSubOn]}>{diaCurto(somarDias(g.hoje, d))}</Text>
            </Pressable>
          );
        })}
        {(() => {
          const on = g.prazo.dias === 0 || g.outraDataAberta;
          return (
            <Pressable testID="nova-prazo-outra" onPress={() => g.setOutraDataAberta(!g.outraDataAberta)} style={[s.chip, on && s.chipOn]}
              accessibilityRole="radio" accessibilityState={{ selected: g.prazo.dias === 0 }}>
              <Icon name="calendar" size={14} color={on ? "#fff" : Colors.violet3} />
              <Text style={[s.chipSub, on && s.chipSubOn]}>{g.prazo.dias === 0 ? diaCurto(g.prazo.data) : T.outraData}</Text>
            </Pressable>
          );
        })()}
      </View>
      {g.outraDataAberta && (
        <View style={{ marginTop: 12, maxWidth: 360 }} testID="nova-calendario">
          <Text style={e.rotulo}>{T.dataDaDevolucao}</Text>
          <CalendarioDoDia
            value={g.prazo.data}
            minDate={g.hoje}
            maxDate={somarDias(g.hoje, 30)}
            marcas={{ [g.prazo.data]: { selected: true, selectedColor: Colors.violet } }}
            onEscolher={(iso) => { if (dataDentroDoPrazo(iso, g.hoje)) { g.escolherData(iso); g.setOutraDataAberta(false); } }}
          />
        </View>
      )}

      {g.vendedoras.length > 0 && (
        <View style={{ marginTop: 18 }} testID="nova-vendedoras">
          <Text style={e.rotulo}>{T.vendedora}</Text>
          <View style={s.chips}>
            {g.vendedoras.map((v) => {
              const on = g.vendedoraId === v.id;
              return (
                <Pressable key={v.id} testID={"nova-vendedora-" + v.id} onPress={() => g.setVendedoraId(on ? null : v.id)} style={[s.chip, on && s.chipOn]}
                  accessibilityRole="radio" accessibilityState={{ selected: on }}>
                  <Text style={[s.chipTxt, on && s.chipTxtOn]}>{v.name}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={e.dica}>{T.vendedoraDica}</Text>
        </View>
      )}

      <View style={[e.campo, { marginTop: 18 }]}>
        <Text style={e.rotulo}>{T.observacao}</Text>
        <TextInput testID="nova-obs" value={g.obs} onChangeText={g.setObs} maxLength={500} style={e.input}
          placeholderTextColor={Colors.ink3} accessibilityLabel={T.observacao} />
      </View>

      <View style={s.termos} testID="nova-termos">
        <View style={s.termosTopo}>
          <Icon name="file_text" size={14} color={Colors.violet3} />
          <Text style={s.termosTit}>{T.textoDaLoja}</Text>
          {!g.editandoTermos && !!g.termos && (
            <Pressable testID="nova-termos-editar" onPress={() => g.setEditandoTermos(true)} style={s.lk} accessibilityRole="button">
              <Icon name="edit" size={13} color={Colors.violet3} />
              <Text style={s.lkTxt}>{T.editar}</Text>
            </Pressable>
          )}
        </View>
        {g.editandoTermos ? (
          <>
            <TextInput testID="nova-termos-texto" value={g.rascunhoDosTermos} onChangeText={g.setRascunhoDosTermos} multiline numberOfLines={4}
              maxLength={3000} style={[e.input, { minHeight: 96, textAlignVertical: "top", paddingTop: 10 }]}
              placeholderTextColor={Colors.ink3} accessibilityLabel={T.textoDaLoja} />
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              <Pressable testID="nova-termos-salvar" onPress={g.salvarTermos} disabled={g.salvandoTermos} style={[e.btnPri, g.salvandoTermos && e.desligado]} accessibilityRole="button">
                {g.salvandoTermos ? <ActivityIndicator size="small" color="#fff" /> : <Text style={e.btnPriTxt}>{T.salvarParaALoja}</Text>}
              </Pressable>
              <Pressable testID="nova-termos-cancelar" onPress={() => g.setEditandoTermos(false)} style={e.btnSec} accessibilityRole="button">
                <Text style={e.btnSecTxt}>{T.cancelar}</Text>
              </Pressable>
            </View>
            {g.erroDosTermos && <Text style={e.erro} testID="nova-termos-erro">{T.erroTermos}</Text>}
            <Text style={[e.dica, { marginTop: 6 }]}>{T.textoDaLojaDica}</Text>
          </>
        ) : g.termos ? (
          <Text style={s.termosTxt} testID="nova-termos-lido">{g.termos}</Text>
        ) : (
          <>
            <Text style={s.termosTxt}>{T.semTermos}</Text>
            <Pressable testID="nova-termos-escrever" onPress={() => g.setEditandoTermos(true)} style={[e.btnSec, { alignSelf: "flex-start", marginTop: 8 }]} accessibilityRole="button">
              <Icon name="edit" size={13} color={Colors.ink} />
              <Text style={e.btnSecTxt}>{T.escreverTexto}</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

// ── Rodapé do passo 3 ────────────────────────────────────────────────
function RodapeDoPasso3({ estado, guardar: g, total, onVoltar, onGuardada, onFaltas }: {
  estado: EstadoDaNova; guardar: Guardar; total: number;
  onVoltar: () => void; onGuardada: () => void; onFaltas: (f: FaltaDaCondicional[]) => void;
}) {
  async function aoGuardar() {
    const r = await g.guardar();
    if (r.tipo === "ok") onGuardada();
    else if (r.tipo === "faltas") onFaltas(r.faltas);
  }
  return (
    <>
      <Text style={e.footerInfo} numberOfLines={2} testID="nova-rodape-info">
        {T.rodapePasso3(estado.pecas.length, fmtBRL(total), diaCurto(g.prazo.data))}
      </Text>
      <View style={e.footerActions}>
        <Pressable style={[e.btnSec, g.enviando && e.desligado]} onPress={g.enviando ? undefined : onVoltar} disabled={g.enviando} testID="nova-voltar" accessibilityRole="button">
          <Icon name="arrow_left" size={14} color={Colors.ink} /><Text style={e.btnSecTxt}>{T.voltar}</Text>
        </Pressable>
        <Pressable style={[e.btnPri, { minWidth: 180 }, g.enviando && e.desligado]} onPress={aoGuardar} disabled={g.enviando} testID="nova-guardar" accessibilityRole="button">
          {g.enviando ? (
            <><ActivityIndicator size="small" color="#fff" /><Text style={e.btnPriTxt}>{T.guardando}</Text></>
          ) : (
            <Text style={e.btnPriTxt}>{g.erro?.tipo === "rede" ? T.tentarDeNovo : T.guardar}</Text>
          )}
        </Pressable>
      </View>
    </>
  );
}

// ── Linhas extras do Resumo ──────────────────────────────────────────
function LinhasDoResumo({ estado, guardar: g }: { estado: EstadoDaNova; guardar: Guardar }) {
  const vend = g.vendedoras.find((v) => v.id === g.vendedoraId);
  return (
    <>
      <View style={e.rLinha}><Text style={e.rRot}>{T.rVoltaAte}</Text><Text style={e.rVal} testID="nova-resumo-volta">{diaCurto(g.prazo.data)}</Text></View>
      {!!vend && <View style={e.rLinha}><Text style={e.rRot}>{T.rVendedora}</Text><Text style={e.rVal}>{vend.name}</Text></View>}
    </>
  );
}

// ── Pronto ───────────────────────────────────────────────────────────
function Pronto({ guardada, lojaId, lojaNome }: { guardada: CondicionalGuardada; lojaId: string | null; lojaNome: string }) {
  const [aviso, setAviso] = useState<string | null>(null);
  const [tentarFormato, setTentarFormato] = useState<FormatoDoComprovante | null>(null);
  const [corrigindo, setCorrigindo] = useState(false);
  const [semTelefone, setSemTelefone] = useState(false);
  const [telefone, setTelefone] = useState("");
  const qc = useQueryClient();
  const n = guardada.items?.length || guardada.resumo?.pecas || 0;
  const quando = guardada.due_date ? dataLonga(String(guardada.due_date).slice(0, 10)) : "";

  // Direto no clique, antes de qualquer await (a janela precisa abrir dentro do gesto).
  function imprimir(formato: FormatoDoComprovante) {
    if (!lojaId) return;
    setAviso(null);
    setTentarFormato(null);
    imprimirComprovanteDaCondicional(lojaId, guardada.id, formato).then((r) => {
      if (r === "blocked") { setAviso(T.impressaoBloqueada); setTentarFormato(formato); }
      else if (r === "error") setAviso(T.impressaoFalhou);
    }).catch(() => setAviso(T.impressaoFalhou));
  }
  function whatsapp() {
    setAviso(null);
    setTentarFormato(null);
    if (!abrirWhatsappDaCondicional(guardada as any, lojaNome)) { setAviso(T.semWhatsapp); setCorrigindo(false); setSemTelefone(true); }
  }
  // Abre o WhatsApp no clique (antes de qualquer await) com o telefone corrigido e grava no cadastro em segundo plano.
  function salvarEEnviar() {
    const digitos = normalizarTelefone(telefone).digitos;
    if (digitos.length < 10 || digitos.length > 11) { setAviso(T.erroTelefone); return; }
    const abriu = abrirWhatsappDaCondicional({ ...(guardada as any), customer_phone: digitos }, lojaNome);
    if (!abriu) { setAviso(T.semWhatsapp); return; }
    setAviso(null);
    setCorrigindo(false);
    setSemTelefone(false);
    if (guardada.customer_id && lojaId) {
      companiesApi.updateCustomer(lojaId, guardada.customer_id, { phone: digitos })
        .then(() => qc.invalidateQueries({ queryKey: ["customers"] })).catch(() => {});
    }
  }

  const nome = guardada.customer_name || "";
  return (
      <View style={s.fim} testID="nova-pronto">
        <View style={s.ok}><Icon name="check" size={26} color="#fff" /></View>
        <Text style={s.fimTit}>{T.guardadaTitulo(guardada.numero_exibicao)}</Text>
        <Text style={s.fimTxt}>
          {T.guardadaTexto(n)}{T.comAte}<Text style={{ fontWeight: "700" }}>{nome}</Text>{T.ate2}<Text style={{ fontWeight: "700" }}>{quando}</Text>
          {n === 1 ? T.nadaCobradoLongaUma : T.nadaCobradoLonga}
        </Text>
        <View style={s.acoes}>
          <Pressable testID="nova-imprimir-bobina" onPress={() => imprimir("bobina")} style={[e.btnPri, s.acao]} accessibilityRole="button">
            <Icon name="print" size={14} color="#fff" /><Text style={e.btnPriTxt}>{T.imprimirBobina}</Text>
          </Pressable>
          <Pressable testID="nova-imprimir-a4" onPress={() => imprimir("a4")} style={[e.btnSec, s.acao]} accessibilityRole="button">
            <Icon name="print" size={14} color={Colors.ink} /><Text style={e.btnSecTxt}>{T.imprimirA4}</Text>
          </Pressable>
          <Pressable testID="nova-whatsapp" onPress={whatsapp} style={[e.btnSec, s.acao]} accessibilityRole="button">
            <Icon name="whatsapp" size={14} color={Colors.ink} /><Text style={e.btnSecTxt}>{T.enviarWhatsapp}</Text>
          </Pressable>
        </View>
        {!!aviso && (
          <View style={[e.nota, e.notaAmbar, { alignSelf: "stretch", maxWidth: 520 }]} testID="nova-pronto-aviso" accessibilityRole="alert">
            <Icon name="alert" size={14} color={Colors.amber} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={e.notaTxt}>{aviso}</Text>
              {!!tentarFormato && (
                <Pressable testID="nova-imprimir-tentar" onPress={() => imprimir(tentarFormato)} style={[e.btnSec, { alignSelf: "flex-start", marginTop: 8 }]} accessibilityRole="button">
                  <Text style={e.btnSecTxt}>{T.tentarDeNovo}</Text>
                </Pressable>
              )}
              {semTelefone && !corrigindo && (
                <Pressable testID="nova-corrigir-telefone" onPress={() => setCorrigindo(true)} style={[e.btnSec, { alignSelf: "flex-start", marginTop: 8 }]} accessibilityRole="button">
                  <Text style={e.btnSecTxt}>{T.corrigirTelefone}</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}
        {corrigindo && (
          <View style={{ alignSelf: "stretch", maxWidth: 520 }} testID="nova-corrigir">
            <Text style={e.rotulo}>{T.campoTelefone}</Text>
            <TextInput testID="nova-corrigir-tel" value={telefone} onChangeText={(v) => setTelefone(maskPhone(v))} keyboardType="phone-pad"
              maxLength={TELEFONE_MAX_CARACTERES} placeholder="(11) 98888-0142" placeholderTextColor={Colors.ink3} style={e.input} accessibilityLabel={T.campoTelefone} autoFocus />
            <Pressable testID="nova-corrigir-enviar" onPress={salvarEEnviar} style={[e.btnPri, { marginTop: 8 }]} accessibilityRole="button">
              <Icon name="whatsapp" size={14} color="#fff" /><Text style={e.btnPriTxt}>{T.salvarEEnviar}</Text>
            </Pressable>
          </View>
        )}
      </View>
  );
}

function RodapeDoPronto({ onNova, onVerNaLista }: { onNova: () => void; onVerNaLista: () => void }) {
  return (
    <>
      <Text style={e.footerInfo}>{T.nadaFoiCobrado}</Text>
      <View style={e.footerActions}>
        <Pressable testID="nova-nova-condicional" onPress={onNova} style={e.btnSec} accessibilityRole="button">
          <Icon name="plus" size={14} color={Colors.ink} /><Text style={e.btnSecTxt}>{T.novaCondicional}</Text>
        </Pressable>
        <Pressable testID="nova-ver-na-lista" onPress={onVerNaLista} style={e.btnSec} accessibilityRole="button">
          <Text style={e.btnSecTxt}>{T.verNaLista}</Text>
        </Pressable>
      </View>
    </>
  );
}

export const PassosDoFim = { Passo3, RodapeDoPasso3, LinhasDoResumo, Pronto, RodapeDoPronto };

const s = StyleSheet.create({
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
  termos: { borderRadius: 12, borderWidth: 1, borderColor: "rgba(120,100,240,0.28)", backgroundColor: "rgba(255,255,255,0.04)", padding: 12, marginTop: 4 },
  termosTopo: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  termosTit: { flex: 1, fontSize: 13, fontWeight: "700", color: Colors.ink },
  termosTxt: { fontSize: 13, color: Colors.ink2, lineHeight: 19 },
  lk: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 44, paddingHorizontal: 8 },
  lkTxt: { fontSize: 13, fontWeight: "600", color: Colors.violet3 },
  fim: { alignItems: "center", gap: 10, padding: 24 },
  ok: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#0b7a5a", alignItems: "center", justifyContent: "center" },
  fimTit: { fontSize: 19, fontWeight: "700", color: Colors.ink, textAlign: "center" },
  fimTxt: { fontSize: 13.5, color: Colors.ink2, textAlign: "center", maxWidth: 480, lineHeight: 20 },
  acoes: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center", alignSelf: "stretch", marginTop: 6 },
  acao: { flexGrow: 1, flexBasis: 160, maxWidth: 240 },
});
