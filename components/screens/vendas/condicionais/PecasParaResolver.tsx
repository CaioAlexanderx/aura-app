// ============================================================
// AURA. — Vendas › Condicionais › Peças para resolver (C16, 26/11/2026)
//
// Mockup aprovado (condicional/mockup.html, estados resolver, resolverVoltou,
// resolverBaixa e resolverVazio). A peça que voltou com defeito ou sem
// etiqueta não conta como livre até a lojista decidir. Cada linha: a peça
// (cor e tamanho), a cliente e o nº da condicional, quando voltou, o que
// aconteceu (a nota) e as duas ações sempre à vista (nada só no hover):
//   · "Voltar ao estoque": a peça volta a livre; aviso com "Desfazer" curto.
//   · "Dar baixa": abre "Qual o motivo?" (Defeito, Sem etiqueta, Perda,
//     Outro com texto). Vai para o histórico do estoque, no ajuste de sempre.
// Consolidado: a linha leva o selo da loja e a escrita vai à loja dona.
// ============================================================
import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, TextInput } from "react-native";
import { Colors, CondicionalCores as CD, IS_DARK_MODE } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/Button";
import { JanelaEmpilhada } from "@/components/JanelaEmpilhada";
import { toast } from "@/components/Toast";
import { diaEMes } from "@/components/screens/vendas/pedidos/regrasDosPedidos";
import { type PecaParaResolver, type MotivoDaBaixa, useResolverPeca } from "@/hooks/useParaResolver";
import { dataCurtaComPonto, diaEmSaoPaulo } from "./regrasDasCondicionais";
import { SeloDaLoja } from "./AbaCondicionais";

/** Os textos do mockup, sem mudar uma palavra. */
export const TEXTOS_PARA_RESOLVER_DA_ABA = {
  chip: "Peças para resolver",
  subtitulo: "Voltaram com defeito ou sem etiqueta. Não contam como livres até você resolver.",
  voltarAoEstoque: "Voltar ao estoque",
  darBaixa: "Dar baixa",
  voltouTitulo: "Voltou ao estoque, livre para vender.",
  desfazer: "Desfazer",
  vazioTitulo: "Nenhuma peça para resolver",
  vazioTexto: "Tudo certo por aqui. Quando uma peça voltar com defeito ou sem etiqueta, ela aparece nesta lista.",
  verCondicionais: "Ver as condicionais",
  motivoPergunta: "Qual o motivo?",
  cancelar: "Cancelar",
  // FORA DO MOCKUP: o mockup não mostra falha nem o campo do "Outro".
  outroPlaceholder: "Escreva o motivo",
  erroGenerico: "Não deu para salvar agora. Tente de novo.",
  erroLista: "Não deu para abrir as peças para resolver agora.",
  tentarDeNovo: "Tentar de novo",
  desfeito: "Voltou para Peças para resolver.",
  baixaFeita: "Baixa feita.",
} as const;
const T = TEXTOS_PARA_RESOLVER_DA_ABA;

export const MOTIVOS_DA_BAIXA: Array<{ key: MotivoDaBaixa; label: string }> = [
  { key: "defeito", label: "Defeito" },
  { key: "sem_etiqueta", label: "Sem etiqueta" },
  { key: "perda", label: "Perda" },
  { key: "outro", label: "Outro" },
];

/** "Off-white · P" (cor e tamanho; cai no rótulo da variante). */
export function corETamanho(p: Pick<PecaParaResolver, "color_name" | "size_label" | "variant_label">): string {
  const partes = [p.color_name, p.size_label].filter(Boolean) as string[];
  return partes.length ? partes.join(" · ") : (p.variant_label || "");
}

/** "voltou hoje, 25/11" ou "voltou seg., 23/11". */
export function quandoVoltou(voltouEm: string | null, hoje: string): string {
  const dia = diaEmSaoPaulo(voltouEm);
  if (!dia) return "";
  return dia === hoje ? "voltou hoje, " + diaEMes(dia) : "voltou " + dataCurtaComPonto(dia);
}

/** Sub da janela: "Off-white · P · o estoque vai de 4 para 3". */
export function subDaBaixa(p: PecaParaResolver): string {
  const base = corETamanho(p);
  const e = p.estoque;
  const vai = typeof e === "number" && e > 0 ? "o estoque vai de " + e + " para " + (e - 1) : "";
  return [base, vai].filter(Boolean).join(" · ");
}

type Props = {
  pecas: PecaParaResolver[];
  hoje: string;
  carregando?: boolean;
  erro?: boolean;
  mostrarLoja: boolean;
  onTentarDeNovo: () => void;
  onVerCondicionais: () => void;
  /** Quanto o aviso "Voltou ao estoque" fica na tela, em ms. */
  avisoMs?: number;
};

type Aviso = { peca: PecaParaResolver };

export function PecasParaResolver({ pecas, hoje, carregando, erro, mostrarLoja, onTentarDeNovo, onVerCondicionais, avisoMs = 10000 }: Props) {
  const acoes = useResolverPeca();
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [baixa, setBaixa] = useState<PecaParaResolver | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const timer = useRef<any>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function voltar(p: PecaParaResolver) {
    if (ocupada) return;
    setOcupada(p.item_id);
    setErroAcao(null);
    try {
      await acoes.resolver(p, { acao: "voltar_estoque" });
      setAviso({ peca: p });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setAviso(null), avisoMs);
    } catch (err: any) {
      setErroAcao((err && err.message) || T.erroGenerico);
    } finally {
      setOcupada(null);
    }
  }

  async function desfazer() {
    const p = aviso?.peca;
    if (!p || ocupada) return;
    setOcupada(p.item_id);
    try {
      await acoes.desfazer(p);
      setAviso(null);
      toast.info(T.desfeito);
    } catch (err: any) {
      setAviso(null);
      toast.error((err && err.message) || T.erroGenerico);
    } finally {
      setOcupada(null);
    }
  }

  async function darBaixa(p: PecaParaResolver, motivo: MotivoDaBaixa, texto: string) {
    await acoes.resolver(p, { acao: "baixa", motivo, ...(motivo === "outro" ? { motivo_texto: texto.trim() } : {}) });
    toast.success(T.baixaFeita);
  }

  const avisoView = !!aviso && (
    <View style={s.aviso} testID="resolver-aviso" accessibilityRole="alert">
      <Icon name="check" size={16} color={CD.okInk} />
      <Text style={s.avisoTxt}>
        <Text style={s.forte}>{T.voltouTitulo}</Text>{" "}
        {[aviso.peca.product_name, corETamanho(aviso.peca)].filter(Boolean).join(" · ")}
      </Text>
      <Pressable onPress={desfazer} style={s.link} accessibilityRole="button" testID="resolver-desfazer" disabled={!!ocupada}>
        <Text style={s.linkTxt}>{T.desfazer}</Text>
      </Pressable>
    </View>
  );

  if (erro && !pecas.length) {
    return (
      <View testID="resolver-erro">
        {avisoView}
        <View style={s.erroBox} accessibilityRole="alert">
          <Icon name="alert_circle" size={16} color={CD.badInk} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.avisoTxt}>{T.erroLista}</Text>
            <View style={{ marginTop: 8, flexDirection: "row" }}>
              <Button title={T.tentarDeNovo} size="sm" variant="ghost" onPress={onTentarDeNovo} style={s.botao} testID="resolver-tentar" />
            </View>
          </View>
        </View>
      </View>
    );
  }

  if (!pecas.length) {
    return (
      <View testID="resolver-vazio-wrap">
        {avisoView}
        {!carregando && (
          <View style={s.vazio} testID="resolver-vazio">
            <View style={s.vazioIcone}><Icon name="check" size={26} color={CD.okInk} /></View>
            <Text style={s.vazioTitulo}>{T.vazioTitulo}</Text>
            <Text style={s.vazioTexto}>{T.vazioTexto}</Text>
            <Button title={T.verCondicionais} variant="ghost" onPress={onVerCondicionais} style={s.botao} testID="resolver-ver-condicionais" />
          </View>
        )}
      </View>
    );
  }

  return (
    <View testID="resolver-lista">
      {avisoView}
      <Text style={s.sub}>{T.subtitulo}</Text>
      {!!erroAcao && <Text style={s.erroAcao} accessibilityRole="alert" testID="resolver-erro-acao">{erroAcao}</Text>}
      <View style={s.card}>
        {pecas.map((p, i) => (
          <View key={p.item_id} style={[s.linha, i > 0 && s.linhaBorda]} testID={"resolver-peca-" + p.item_id}>
            <View style={s.colPeca}>
              <View style={s.thumb}><Text style={s.thumbTxt}>{iniciais(p.product_name)}</Text></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.nome} numberOfLines={2}>{p.product_name}</Text>
                {!!corETamanho(p) && <Text style={s.mudo}>{corETamanho(p)}</Text>}
              </View>
            </View>
            <View style={s.colCliente}>
              <Text style={s.texto}>
                {p.customer_name || ""}{!!p.customer_name && " · "}<Text style={s.cod}>{p.numero_exibicao}</Text>
              </Text>
              {mostrarLoja && !!p.company_name && <SeloDaLoja nome={p.company_name} testID={"resolver-loja-" + p.item_id} />}
            </View>
            <Text style={[s.mudo, s.colVoltou]}>{quandoVoltou(p.voltou_em, hoje)}</Text>
            <Text style={[s.texto, s.colAconteceu]} numberOfLines={3}>{p.nota ? "“" + p.nota + "”" : ""}</Text>
            <View style={s.acoes}>
              <Button title={T.voltarAoEstoque} icon="rotate_ccw" size="sm" variant="ghost" onPress={() => voltar(p)}
                loading={ocupada === p.item_id} disabled={!!ocupada} style={s.botao} testID={"resolver-voltar-" + p.item_id} />
              <Button title={T.darBaixa} size="sm" variant="ghost" onPress={() => { setErroAcao(null); setBaixa(p); }}
                disabled={!!ocupada} style={s.botao} testID={"resolver-baixa-" + p.item_id} />
            </View>
          </View>
        ))}
      </View>

      {!!baixa && (
        <MotivoDaBaixaModal peca={baixa} onSalvar={(m, t) => darBaixa(baixa, m, t)} onClose={() => setBaixa(null)} />
      )}
    </View>
  );
}

function iniciais(nome: string): string {
  const p = String(nome || "").trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] || "") + (p[1]?.[0] || "")).toUpperCase();
}

type ModalProps = {
  peca: PecaParaResolver;
  onSalvar: (motivo: MotivoDaBaixa, texto: string) => Promise<unknown>;
  onClose: () => void;
};

export function MotivoDaBaixaModal({ peca, onSalvar, onClose }: ModalProps) {
  const [motivo, setMotivo] = useState<MotivoDaBaixa>("defeito");
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const podeSalvar = !salvando && (motivo !== "outro" || texto.trim().length > 0);

  async function salvar() {
    if (!podeSalvar) return;
    setErro(null);
    setSalvando(true);
    try {
      await onSalvar(motivo, texto);
      setSalvando(false);
      onClose();
    } catch (err: any) {
      setSalvando(false);
      setErro((err && err.message) || T.erroGenerico);
    }
  }
  const fechar = () => { if (!salvando) onClose(); };

  return (
    <JanelaEmpilhada onRequestClose={fechar}>
      <View style={s.overlay}>
        <Pressable style={s.fundo} onPress={fechar} accessibilityLabel={T.cancelar} testID="resolver-modal-fundo" />
        <View style={[s.painel, painelWeb()]} testID="resolver-modal" accessibilityViewIsModal>
          <View style={s.cab}>
            <View style={s.cabIcone}><Icon name="box" size={16} color={Colors.violet3} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.titulo}>{"Dar baixa na " + peca.product_name + "?"}</Text>
              <Text style={s.subModal} numberOfLines={2} testID="resolver-modal-sub">{subDaBaixa(peca)}</Text>
            </View>
            <Pressable onPress={fechar} style={s.fechar} accessibilityRole="button" accessibilityLabel={T.cancelar} testID="resolver-modal-fechar">
              <Icon name="x" size={16} color={Colors.ink3} />
            </Pressable>
          </View>
          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={s.corpo} keyboardShouldPersistTaps="handled">
            <Text style={s.pergunta}>{T.motivoPergunta}</Text>
            <View style={s.opcoes} accessibilityRole="radiogroup">
              {MOTIVOS_DA_BAIXA.map((o) => (
                <Pressable key={o.key} onPress={() => { setMotivo(o.key); setErro(null); }}
                  style={[s.opcao, motivo === o.key && s.opcaoOn]} accessibilityRole="radio"
                  accessibilityState={{ selected: motivo === o.key }} testID={"resolver-motivo-" + o.key}>
                  <Text style={[s.opcaoTxt, motivo === o.key && s.opcaoTxtOn]}>{o.label}</Text>
                </Pressable>
              ))}
            </View>
            {motivo === "outro" && (
              <TextInput value={texto} onChangeText={(v) => { setTexto(v); setErro(null); }} placeholder={T.outroPlaceholder}
                placeholderTextColor={Colors.ink3} style={s.input} maxLength={200} autoFocus
                accessibilityLabel={T.outroPlaceholder} testID="resolver-motivo-texto" onSubmitEditing={salvar} />
            )}
            <Text style={s.nota} testID="resolver-modal-nota">
              {"Fica no histórico do estoque com o motivo" + (peca.nota ? " e a anotação “" + peca.nota + "”" : "") + ". É o mesmo ajuste de estoque de sempre."}
            </Text>
            {!!erro && <Text style={s.erroAcao} testID="resolver-modal-erro">{erro}</Text>}
          </ScrollView>
          <View style={s.rodape}>
            <Button title={T.cancelar} variant="ghost" onPress={fechar} disabled={salvando} testID="resolver-modal-cancelar" />
            <Button title={T.darBaixa} variant="primary" onPress={salvar} loading={salvando} disabled={!podeSalvar} testID="resolver-modal-salvar" />
          </View>
        </View>
      </View>
    </JanelaEmpilhada>
  );
}

function painelWeb(): any {
  if (typeof document === "undefined") return { backgroundColor: Colors.bg3 };
  return {
    backgroundColor: IS_DARK_MODE ? "rgba(18,10,35,0.98)" : "rgba(255,255,255,0.98)",
    borderWidth: 1, borderColor: "rgba(124,58,237,0.3)",
  };
}

const s = StyleSheet.create({
  forte: { fontWeight: "700", color: Colors.ink },
  sub: { fontSize: 13, color: Colors.ink3, marginBottom: 10 },
  card: { borderWidth: 1, borderColor: Colors.border, borderRadius: 14, overflow: "hidden", backgroundColor: Colors.bg3 },
  linha: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  linhaBorda: { borderTopWidth: 1, borderTopColor: Colors.border },
  colPeca: { flexDirection: "row", alignItems: "center", gap: 10, flexGrow: 1, flexBasis: 200, minWidth: 0 },
  colCliente: { flexGrow: 1, flexBasis: 160, minWidth: 0, gap: 4 },
  colVoltou: { flexBasis: 120 },
  colAconteceu: { flexGrow: 1, flexBasis: 160, minWidth: 0 },
  acoes: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  thumb: { width: 40, height: 40, borderRadius: 10, backgroundColor: CD.warnBg, borderWidth: 1, borderColor: CD.warnLine, alignItems: "center", justifyContent: "center" },
  thumbTxt: { fontSize: 12, fontWeight: "700", color: CD.warnInk },
  nome: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  mudo: { fontSize: 12.5, color: Colors.ink3 },
  texto: { fontSize: 13, color: Colors.ink2 },
  cod: { fontFamily: Fonts.mono as any, color: Colors.ink2, fontSize: 12.5 },
  botao: { minHeight: 44 },
  aviso: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 9, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: CD.okLine, backgroundColor: CD.okBg, marginBottom: 12 },
  avisoTxt: { flex: 1, minWidth: 180, fontSize: 13, lineHeight: 19, color: Colors.ink },
  link: { minHeight: 44, paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
  linkTxt: { fontSize: 13, fontWeight: "700", color: Colors.violet3, textDecorationLine: "underline" },
  erroAcao: { fontSize: 12.5, color: Colors.red, fontWeight: "600", marginBottom: 8, marginTop: 6 },
  erroBox: { flexDirection: "row", alignItems: "flex-start", gap: 9, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: CD.badLine, backgroundColor: CD.badBg },
  vazio: { alignItems: "center", gap: 10, paddingVertical: 44, paddingHorizontal: 24, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, backgroundColor: Colors.bg3 },
  vazioIcone: { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: CD.okBg, borderWidth: 1, borderColor: CD.okLine },
  vazioTitulo: { fontSize: 18, fontWeight: "700", color: Colors.ink, textAlign: "center" },
  vazioTexto: { fontSize: 13.5, lineHeight: 20, color: Colors.ink2, textAlign: "center", maxWidth: 460 },
  // Janela
  overlay: { position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 16 },
  fundo: { position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0 },
  painel: { width: "100%", maxWidth: 480, maxHeight: "94%", borderRadius: 18, overflow: "hidden", flexDirection: "column" },
  cab: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  cabIcone: { width: 32, height: 32, borderRadius: 9, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center" },
  titulo: { fontSize: 17, color: Colors.ink, fontWeight: "700" },
  subModal: { fontSize: 12, color: Colors.ink3, marginTop: 2 },
  fechar: { width: 44, height: 44, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  corpo: { paddingHorizontal: 18, paddingVertical: 16 },
  pergunta: { fontSize: 12, color: Colors.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  opcoes: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  opcao: { minHeight: 44, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  opcaoOn: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  opcaoTxt: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  opcaoTxtOn: { color: "#fff" },
  input: { marginTop: 12, minHeight: 44, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg3, color: Colors.ink, fontSize: 14 },
  nota: { marginTop: 14, fontSize: 12.5, lineHeight: 18, color: Colors.ink3 },
  rodape: { flexDirection: "row", justifyContent: "flex-end", gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.bg2 },
});

export default PecasParaResolver;
