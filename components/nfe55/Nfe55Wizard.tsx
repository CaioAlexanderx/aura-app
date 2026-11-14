// ============================================================
// AURA. — Assistente da NF-e modelo 55 de VENDA (CP4, 14/11/2026).
// Mockup aprovado: artifact "NF-e de venda" (P9huGndnYF4tSPPXTykpdf).
//
// Casca no DNA do TrocaModal (CLAUDE.md, armadilha 5): cabeçalho com
// ícone, barra de passos 1-2-3-4, corpo que rola, rodapé com "← Voltar" /
// "Continuar →" / confirmar verde. No celular (< 560 px) a barra vira
// "Passo n de 4" + progresso e o rodapé empilha, botões de 44 px.
//
//   Passo 1 · Cliente          GET .../previa (pré-preenchido do cadastro);
//                              faltantes em amarelo, sem bloquear
//   Passo 2 · Itens e imposto  POST .../previa com o corpo (CFOP pela UF)
//   Passo 3 · Revisar          aviso de homologação/produção; Emitir
//   Passo 4 · Pronto           DANFE, XML, e-mail
//
// A NF-e sai da loja DA VENDA (multi-CNPJ): quem abre passa o company_id
// da venda. Ao abrir, /auth/me é revalidado (plano stale no JWT).
// Web: WebPortal (overlay fixo dentro do shell fica preso no z-index).
// ============================================================
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, useWindowDimensions } from "react-native";
import { Colors, IS_DARK_MODE } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { WebPortal } from "@/components/WebPortal";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { nfe55Api, type Faltante, type Previa, type RespostaEmissao } from "@/services/nfe55Api";
import {
  corpoDoForm, faltantesPorCampo, formDaPrevia, lerErroDaEmissao, lerRespostaDaEmissao, resumoDosFaltantes,
  brl, tituloDoBloqueio, type FormNfe55, type ResultadoDaTela,
} from "@/utils/nfe55";
import { PassoCliente } from "./PassoCliente";
import { PassoItens } from "./PassoItens";
import { PassoRevisar } from "./PassoRevisar";
import { PassoPronto } from "./PassoPronto";
import { abrirDanfe } from "./nfe55Acoes";
import { Faixa } from "./partes";

type Passo = 1 | 2 | 3 | 4;
const ROTULOS = ["Cliente", "Itens e imposto", "Revisar", "Pronto"];
const SUB: Record<Passo, string> = {
  1: "Quem está comprando: puxamos do cadastro, confira",
  2: "Os itens da venda e como a nota vai sair",
  3: "Confira e emita",
  4: "NF-e autorizada",
};
export const NARROW_NFE55 = 560;

type Props = {
  visible: boolean;
  /** Loja da venda (no consolidado, o company_id da venda). */
  companyId: string | null | undefined;
  saleId: string | null | undefined;
  saleNumber?: string | number | null;
  onClose: () => void;
  /** Chamado quando a NF-e é autorizada (para atualizar a venda/lista). */
  onEmitida?: (r: RespostaEmissao) => void;
};

/** Junta o que a prévia achou (ex.: cidade pelo CEP) sem apagar o que a pessoa digitou. */
function completarComPrevia(form: FormNfe55, previa: Previa): FormNfe55 {
  const novo = formDaPrevia(previa);
  const out: any = { ...form };
  (["municipio", "uf", "codigoMunicipioIbge", "logradouro", "bairro"] as const).forEach((k) => {
    if (!String(out[k] || "").trim() && novo[k]) out[k] = novo[k];
  });
  return out;
}

export function Nfe55Wizard({ visible, companyId, saleId, saleNumber, onClose, onEmitida }: Props) {
  const { width } = useWindowDimensions();
  const estreito = width < NARROW_NFE55;
  const [passo, setPasso] = useState<Passo>(1);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [form, setForm] = useState<FormNfe55>(() => formDaPrevia(null));
  const [faltantes, setFaltantes] = useState<Faltante[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [emitindo, setEmitindo] = useState(false);
  const [resultado, setResultado] = useState<ResultadoDaTela | null>(null);
  const [resposta, setResposta] = useState<RespostaEmissao | null>(null);
  const [sair, setSair] = useState(false);

  const carregar = useCallback(async () => {
    if (!companyId || !saleId) return;
    setCarregando(true);
    setErroCarga(null);
    try {
      const pr = await nfe55Api.previa(companyId, saleId);
      setPrevia(pr);
      setForm(formDaPrevia(pr));
      setFaltantes(pr.faltantes || []);
    } catch (e: any) {
      setErroCarga((e && e.data && e.data.error) || (e && e.message) || "Não deu para carregar a venda.");
    } finally {
      setCarregando(false);
    }
  }, [companyId, saleId]);

  useEffect(() => {
    if (!visible) return;
    setPasso(1); setResultado(null); setResposta(null); setSair(false);
    // Plano/módulos vêm do JWT e não se revalidam sozinhos (CLAUDE.md, armadilha 1).
    try { const st: any = useAuthStore.getState(); if (typeof st.refreshMe === "function") Promise.resolve(st.refreshMe()).catch(() => {}); } catch (_) { /* segue */ }
    carregar();
  }, [visible, carregar]);

  const falta = useMemo(() => faltantesPorCampo(faltantes), [faltantes]);
  const set = useCallback(<K extends keyof FormNfe55>(k: K, v: FormNfe55[K]) => setForm((f) => ({ ...f, [k]: v })), []);

  if (!visible) return null;

  const bloqueio = previa?.bloqueio || null;
  const existente = previa?.nota_existente || null;

  async function revalidar(): Promise<Previa | null> {
    if (!companyId || !saleId) return null;
    try {
      const pr = await nfe55Api.previa(companyId, saleId, corpoDoForm(form));
      setPrevia(pr);
      setForm((f) => completarComPrevia(f, pr));
      setFaltantes(pr.faltantes || []);
      return pr;
    } catch (_) {
      return null; // sem prévia nova: segue com a de antes
    }
  }

  async function avancar() {
    if (passo >= 3 || carregando) return;
    setCarregando(true);
    await revalidar();
    setCarregando(false);
    setPasso((p) => (p + 1) as Passo);
  }

  async function emitir() {
    if (!companyId || !saleId || emitindo) return;
    setEmitindo(true);
    setResultado(null);
    try {
      const r = await nfe55Api.emitir(companyId, saleId, corpoDoForm(form));
      const tela = lerRespostaDaEmissao(r);
      if (tela.tipo === "pronto") {
        setResposta(r);
        setPasso(4);
        if (r.cadastro && r.cadastro.salvo) toast.success("Dados salvos no cadastro do cliente.");
        onEmitida && onEmitida(r);
      } else {
        setResultado(tela);
      }
    } catch (e: any) {
      const tela = lerErroDaEmissao(e);
      setResultado(tela);
      if (tela.tipo === "faltantes") {
        setFaltantes(tela.faltantes);
        setPasso(tela.passo);
        toast.info("Falta completar: os campos estão em amarelo.");
      }
    } finally {
      setEmitindo(false);
    }
  }

  const fechar = () => {
    if (passo > 1 && passo < 4) setSair(true);
    else onClose();
  };

  const rodapeInfo = passo === 1
    ? (resumoDosFaltantes(faltantes, 1) || `${form.nome || "Cliente"}${form.uf ? " · " + form.uf.toUpperCase() : ""}`)
    : passo === 2
    ? `${(previa?.itens || []).length} itens · ${brl(previa?.totais?.nota)}`
    : passo === 3
    ? (resumoDosFaltantes(faltantes) || "Tudo certo para emitir")
    : `NF-e nº ${resposta?.numero ?? ""} · ${brl(previa?.totais?.nota)}`;

  const tentarDeNovo = resultado && (resultado.tipo === "aguardando" || resultado.tipo === "rejeicao" || resultado.tipo === "erro");
  const podeEmitir = !bloqueio && !existente && !!previa;

  const corpo = (
    <View style={[s.overlay, estreito && { padding: 0 }]} testID="nfe55-wizard">
      <Pressable style={s.backdrop} onPress={passo === 4 ? onClose : fechar} />
      <View style={[s.panel, estreito && s.panelEstreito, panelWeb()]}>
        <View style={[s.header, estreito && { paddingHorizontal: 16 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
            <View style={[s.headerIco, passo === 4 && { backgroundColor: "rgba(5,150,105,0.12)" }]}>
              {passo === 4 ? <Icon name="check" size={16} color={Colors.green} /> : <Text style={s.headerIcoTxt}>55</Text>}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.headerTitle}>{passo === 4 ? "Concluído" : "Emitir NF-e"}</Text>
              <Text style={s.headerSub} numberOfLines={1}>{SUB[passo]}{saleNumber ? ` · venda nº ${saleNumber}` : ""}</Text>
            </View>
          </View>
          <Pressable onPress={passo === 4 ? onClose : fechar} style={s.closeBtn} accessibilityLabel="Fechar" testID="nfe55-fechar">
            <Icon name="x" size={16} color={Colors.ink3} />
          </Pressable>
        </View>

        {passo !== 4 && (estreito ? (
          <View style={s.stepsM} testID="nfe55-passos-celular">
            <Text style={s.stepsMT}>Passo {passo} de 4 · {ROTULOS[passo - 1]}</Text>
            <View style={s.prog}>
              {[1, 2, 3, 4].map((n) => <View key={n} style={[s.progI, n < passo && s.progOk, n === passo && s.progOn]} />)}
            </View>
          </View>
        ) : (
          <View style={s.stepBar} testID="nfe55-passos">
            {[1, 2, 3, 4].map((n, idx) => {
              const feito = passo > n;
              const ativo = passo === n;
              return (
                <View key={n} style={s.stepItem}>
                  <View style={[s.stepDot, feito && s.stepDotDone, ativo && s.stepDotActive]}>
                    {feito ? <Icon name="check" size={10} color="#fff" /> : <Text style={[s.stepDotTxt, ativo && { color: "#fff" }]}>{n}</Text>}
                  </View>
                  <Text style={[s.stepLabel, ativo && { color: Colors.ink, fontWeight: "700" }]}>{ROTULOS[n - 1]}</Text>
                  {idx < 3 && <View style={[s.stepSep, feito && { backgroundColor: "rgba(124,58,237,0.4)" }]} />}
                </View>
              );
            })}
          </View>
        ))}

        <ScrollView style={s.body} contentContainerStyle={[s.bodyContent, estreito && { padding: 16 }]} keyboardShouldPersistTaps="handled">
          {carregando && !previa ? (
            <View style={{ paddingVertical: 40, alignItems: "center", gap: 10 }}>
              <ActivityIndicator color={Colors.violet} />
              <Text style={{ color: Colors.ink3, fontSize: 13 }}>Buscando a venda e o cadastro do cliente…</Text>
            </View>
          ) : erroCarga ? (
            <Faixa tom="vermelho" titulo="Não deu para abrir a venda" texto={erroCarga} testID="nfe55-erro-carga">
              <Pressable onPress={carregar} style={{ marginTop: 8, alignSelf: "flex-start" }} accessibilityRole="button">
                <Text style={{ color: Colors.violet3, fontWeight: "700" }}>Tentar de novo</Text>
              </Pressable>
            </Faixa>
          ) : (
            <>
              {existente && passo !== 4 ? (
                <Faixa tom="violeta" titulo="Esta venda já tem nota fiscal" testID="nfe55-ja-tem-nota"
                  texto={existente.tipo === "nfe"
                    ? `NF-e nº ${existente.numero ?? ""} (${existente.status}). Cada venda tem uma nota de produtos só.`
                    : `Esta venda já tem NFC-e (${existente.status}). Cada venda tem uma nota de produtos só: para trocar por NF-e, cancele a NFC-e antes.`}>
                  {existente.tipo === "nfe" && existente.status === "autorizada" && companyId ? (
                    <Pressable onPress={() => abrirDanfe(companyId, existente.id)} style={{ marginTop: 8, alignSelf: "flex-start" }} accessibilityRole="button">
                      <Text style={{ color: Colors.violet3, fontWeight: "700" }}>Abrir o DANFE</Text>
                    </Pressable>
                  ) : null}
                </Faixa>
              ) : null}
              {bloqueio && passo !== 4 ? <Faixa tom="vermelho" titulo={tituloDoBloqueio(bloqueio.code)} texto={bloqueio.error} testID="nfe55-bloqueio-previa" /> : null}
              {passo === 1 && <PassoCliente form={form} set={set} falta={falta} faltantes={faltantes} previa={previa} estreito={estreito} />}
              {passo === 2 && <PassoItens form={form} set={set} falta={falta} faltantes={faltantes} previa={previa} estreito={estreito} />}
              {passo === 3 && <PassoRevisar form={form} previa={previa} estreito={estreito} resultado={resultado} onMudarCliente={() => setPasso(1)} />}
              {passo === 4 && resposta && companyId && (
                <PassoPronto companyId={companyId} resposta={resposta} emailInicial={form.email} total={previa?.totais?.nota} />
              )}
            </>
          )}
        </ScrollView>

        <View style={[s.footer, estreito && s.footerEstreito]}>
          <Text style={[s.footerInfo, estreito && { textAlign: "center" }]} numberOfLines={2}>{rodapeInfo}</Text>
          <View style={[s.footerActions, estreito && s.footerActionsEstreito]}>
            {passo === 4 ? (
              <Pressable style={[s.btnPri, estreito && s.btnFull]} onPress={onClose} testID="nfe55-concluir"><Text style={s.btnPriTxt}>Fechar</Text></Pressable>
            ) : (
              <>
                {passo > 1 && (
                  <Pressable style={[s.btnSec, estreito && s.btnFull]} onPress={() => setPasso((p) => (p - 1) as Passo)} testID="nfe55-voltar">
                    <Text style={s.btnSecTxt}>← Voltar</Text>
                  </Pressable>
                )}
                {passo < 3 && (
                  <Pressable style={[s.btnPri, estreito && s.btnFull, (!previa || carregando) && { opacity: 0.45 }]} onPress={avancar}
                    disabled={!previa || carregando} testID="nfe55-continuar">
                    {carregando && previa ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.btnPriTxt}>Continuar →</Text>}
                  </Pressable>
                )}
                {passo === 3 && (
                  <Pressable style={[s.btnConfirm, estreito && s.btnFull, (!podeEmitir || emitindo) && { opacity: 0.45 }]} onPress={emitir}
                    disabled={!podeEmitir || emitindo} testID="nfe55-emitir">
                    {emitindo
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <><Icon name="check" size={14} color="#fff" /><Text style={s.btnPriTxt}>{tentarDeNovo ? "Tentar de novo" : "Emitir NF-e"}</Text></>}
                  </Pressable>
                )}
              </>
            )}
          </View>
        </View>
      </View>

      {sair && (
        <View style={s.exitOverlay}>
          <View style={s.exitCard}>
            <Text style={s.exitTitle}>Sair sem emitir a NF-e?</Text>
            <Text style={s.exitMsg}>A venda continua registrada. A nota fica para depois, em Vendas › detalhe da venda › Nota fiscal.</Text>
            <View style={s.exitActions}>
              <Pressable style={s.exitStay} onPress={() => setSair(false)}><Text style={s.exitStayTxt}>Continuar</Text></Pressable>
              <Pressable style={s.exitLeave} onPress={() => { setSair(false); onClose(); }} testID="nfe55-sair"><Text style={s.exitLeaveTxt}>Sair</Text></Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );

  return <WebPortal active>{corpo}</WebPortal>;
}

function panelWeb(): any {
  if (typeof document === "undefined") return { backgroundColor: Colors.bg3 };
  return {
    backgroundColor: IS_DARK_MODE ? "rgba(18,10,35,0.98)" : "rgba(255,255,255,0.98)",
    borderWidth: 1, borderColor: "rgba(124,58,237,0.3)",
  };
}

const s = StyleSheet.create({
  overlay: { position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 },
  backdrop: { position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0 },
  panel: { width: "100%", maxWidth: 960, maxHeight: "94%", borderRadius: 18, overflow: "hidden", flexDirection: "column" },
  panelEstreito: { maxHeight: "100%", height: "100%", borderRadius: 0 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, paddingHorizontal: 22, paddingTop: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: "rgba(124,58,237,0.15)" },
  headerIco: { width: 32, height: 32, borderRadius: 9, backgroundColor: "rgba(124,58,237,0.18)", alignItems: "center", justifyContent: "center" },
  headerIcoTxt: { fontSize: 12, fontWeight: "800", color: "#a78bfa" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: Colors.ink, letterSpacing: -0.2 },
  headerSub: { fontSize: 12, color: Colors.ink3, marginTop: 1 },
  closeBtn: { width: 44, height: 44, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  stepBar: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", paddingHorizontal: 22, paddingVertical: 14, backgroundColor: "rgba(109,40,217,0.05)", borderBottomWidth: 1, borderBottomColor: "rgba(124,58,237,0.1)", gap: 6 },
  stepItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepDot: { width: 24, height: 24, borderRadius: 999, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  stepDotActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  stepDotDone: { backgroundColor: "rgba(52,211,153,0.85)", borderColor: "#34d399" },
  stepDotTxt: { color: Colors.ink3, fontSize: 12, fontWeight: "700" },
  stepLabel: { color: Colors.ink3, fontSize: 12.5 },
  stepSep: { width: 28, height: 1.5, backgroundColor: Colors.border, marginHorizontal: 4 },
  stepsM: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, backgroundColor: "rgba(109,40,217,0.05)", borderBottomWidth: 1, borderBottomColor: Colors.border },
  stepsMT: { fontSize: 12.5, fontWeight: "700", color: Colors.ink },
  prog: { flexDirection: "row", gap: 4, marginTop: 8 },
  progI: { flex: 1, height: 4, borderRadius: 4, backgroundColor: Colors.bg4 },
  progOk: { backgroundColor: "#34d399" },
  progOn: { backgroundColor: Colors.violet },
  body: { flex: 1 },
  bodyContent: { padding: 22, paddingBottom: 8 },
  footer: { paddingHorizontal: 22, paddingVertical: 14, borderTopWidth: 1, borderTopColor: "rgba(124,58,237,0.15)", backgroundColor: "rgba(109,40,217,0.05)", flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  footerEstreito: { flexDirection: "column", alignItems: "stretch", paddingHorizontal: 16, paddingBottom: 16 },
  footerInfo: { flex: 1, fontSize: 12.5, color: Colors.ink2, fontWeight: "500" },
  footerActions: { flexDirection: "row", gap: 8, flexShrink: 0 },
  footerActionsEstreito: { flexDirection: "column-reverse" },
  btnFull: { width: "100%" },
  btnPri: { backgroundColor: Colors.violet, minHeight: 44, paddingHorizontal: 20, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  btnConfirm: { backgroundColor: "#10b981", minHeight: 44, paddingHorizontal: 20, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minWidth: 200 },
  btnPriTxt: { color: "#fff", fontSize: 13.5, fontWeight: "700" },
  btnSec: { backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border, minHeight: 44, paddingHorizontal: 16, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  btnSecTxt: { color: Colors.ink, fontSize: 13, fontWeight: "600" },
  exitOverlay: { position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 24 },
  exitCard: { width: "100%", maxWidth: 380, borderRadius: 16, padding: 22, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: "rgba(124,58,237,0.25)" },
  exitTitle: { fontSize: 16, fontWeight: "700", color: Colors.ink, marginBottom: 8 },
  exitMsg: { fontSize: 13, color: Colors.ink2, lineHeight: 19, marginBottom: 18 },
  exitActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  exitStay: { paddingHorizontal: 16, minHeight: 44, justifyContent: "center", borderRadius: 10, backgroundColor: "rgba(124,58,237,0.18)" },
  exitStayTxt: { fontSize: 13, fontWeight: "700", color: "#a78bfa" },
  exitLeave: { paddingHorizontal: 16, minHeight: 44, justifyContent: "center", borderRadius: 10, backgroundColor: "rgba(239,68,68,0.12)" },
  exitLeaveTxt: { fontSize: 13, fontWeight: "700", color: "#f87171" },
});

export default Nfe55Wizard;
