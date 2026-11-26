// ============================================================
// AURA. — Nova condicional · passo 2, Peças (C6, 26/11/2026)
//
// Mockup "nova.p2*": bipe ou busca, cor e tamanho com "N livre" / "com
// cliente", uma unidade por linha, aviso âmbar na linha para quem vende sem
// estoque e o bloqueio da loja que controla estoque (409 COND_SEM_SALDO, com
// a condicional que segura a peça).
//
// O seletor de cor e tamanho fica DENTRO do passo (como no mockup), não num
// segundo modal: o VariantPickerModal não mostra livre/com cliente e abriria
// um Modal do RN por cima do portal do wizard.
// ============================================================
import { useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { ScannerInput, type ScannerInputHandle } from "@/components/ScannerInput";
import { accentForProduct, productLetter } from "../../../pdv/types";
import { fmtBRL } from "../../../pdv/troca/types";
import type { FaltaDaCondicional } from "./api";
import { TEXTOS_DA_NOVA as T } from "./textos";
import { e } from "./Casca";
import {
  filtrarProdutos, acharPeloCodigo, livresDoProduto, jaNaLista,
  type ProdutoDaBusca, type VarianteDaBusca, type PecaDaCondicional,
} from "./busca";

export const MAX_PECAS = 60;

/** "2 cores · R$ 189,90" (com variantes) ou "R$ 69,90 · tamanho único". */
function subtitulo(p: ProdutoDaBusca): string {
  if (!p.temVariantes) return fmtBRL(p.preco) + " · " + T.tamanhoUnico;
  const cores = new Set(p.coresDasVariantes.filter(Boolean)).size;
  return (cores > 1 ? T.cores(cores) + " · " : "") + fmtBRL(p.preco);
}

type Props = {
  produtos: ProdutoDaBusca[];
  carregando: boolean;
  variantesDe: (p: ProdutoDaBusca) => Promise<VarianteDaBusca[]>;
  pecas: PecaDaCondicional[];
  onAdicionar: (p: PecaDaCondicional) => void;
  onTirar: (chave: string) => void;
  /** A loja vende sem estoque: a peça sem unidade livre entra com aviso. */
  vendeSemEstoque: boolean;
  /** 409 COND_SEM_SALDO do servidor: as peças que não têm unidade livre. */
  faltas?: FaltaDaCondicional[] | null;
  /** "Ver a C-0029": leva à condicional que segura a peça (o C5/C10 liga). */
  onVerCondicional?: (condicionalId: string) => void;
};

let contador = 0;
const novaChave = () => `peca-${Date.now().toString(36)}-${++contador}`;

type Aberto = { produto: ProdutoDaBusca; variantes: VarianteDaBusca[] | null; cor: string | null; varianteId: string | null };

export function PassoPecas({
  produtos, carregando, variantesDe, pecas, onAdicionar, onTirar, vendeSemEstoque, faltas, onVerCondicional,
}: Props) {
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<Aberto | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const campo = useRef<ScannerInputHandle | null>(null);

  const sugestoes = filtrarProdutos(produtos, busca);
  const noLimite = pecas.length >= MAX_PECAS;

  function entrar(p: ProdutoDaBusca, v: VarianteDaBusca | null, livreAgora: number) {
    if (pecas.length >= MAX_PECAS) { setAviso(T.noLimite); return; }
    if (livreAgora <= 0 && !vendeSemEstoque) { setAviso(T.semLivreNaLoja(p.name)); return; }
    onAdicionar({
      chave: novaChave(),
      productId: p.id,
      variantId: v ? v.id : null,
      nome: p.name,
      cor: v ? v.cor : null,
      tamanho: v ? v.tamanho : null,
      preco: v ? v.preco : p.preco,
      semLivre: livreAgora <= 0,
    });
    setAviso(null);
    setAberto(null);
    setBusca("");
    campo.current?.limpar();
    campo.current?.focar();
  }

  function addSimples(p: ProdutoDaBusca) {
    entrar(p, null, livresDoProduto(p) - jaNaLista(pecas, p.id, null));
  }

  async function abrirVariantes(p: ProdutoDaBusca, preferirCodigo?: string) {
    setAviso(null);
    setAberto({ produto: p, variantes: null, cor: null, varianteId: null });
    const vs = await variantesDe(p);
    const doCodigo = preferirCodigo ? vs.find((v) => v.barcode && v.barcode.toLowerCase() === preferirCodigo.toLowerCase()) : null;
    if (doCodigo) {
      // Bipe de variante: a peça é exata, entra direto.
      entrar(p, doCodigo, doCodigo.livre - jaNaLista(pecas, p.id, doCodigo.id));
      return;
    }
    const cores = Array.from(new Set(vs.map((v) => v.cor).filter((c): c is string => !!c)));
    setAberto({ produto: p, variantes: vs, cor: cores.length === 1 ? cores[0] : null, varianteId: null });
  }

  function tocarSugestao(p: ProdutoDaBusca) {
    if (p.temVariantes) abrirVariantes(p);
    else addSimples(p);
  }

  function aoBipar(codigo: string) {
    const achou = acharPeloCodigo(produtos, codigo);
    if (!achou) { setAviso(T.naoAchouCodigo(codigo)); return; }
    const { produto, codigoDeVariante } = achou;
    if (produto.temVariantes) abrirVariantes(produto, codigoDeVariante ? codigo : undefined);
    else addSimples(produto);
  }

  // ── Seletor de cor e tamanho ────────────────────────────────────────
  let seletor: JSX.Element | null = null;
  if (aberto) {
    const { produto, variantes } = aberto;
    const vs = variantes || [];
    const cores = Array.from(new Set(vs.map((v) => v.cor).filter((c): c is string => !!c)));
    const doTamanho = vs.filter((v) => !cores.length || v.cor === aberto.cor);
    const escolhida = vs.find((v) => v.id === aberto.varianteId) || null;
    const livreDaEscolhida = escolhida ? escolhida.livre - jaNaLista(pecas, produto.id, escolhida.id) : 0;
    const podeColocar = !!escolhida && (livreDaEscolhida > 0 || vendeSemEstoque);
    seletor = (
      <View style={s.varPicker} testID="nova-variantes">
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <View style={[s.thumb, { backgroundColor: accentForProduct(produto.id) }]}><Text style={s.thumbTxt}>{productLetter(produto.name)}</Text></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.nome} numberOfLines={2}>{produto.name}</Text>
            <Text style={s.sub}>{T.escolhaCorETamanho(fmtBRL(produto.preco))}</Text>
          </View>
        </View>
        {variantes === null ? (
          <Text style={s.sub} testID="nova-variantes-carregando">{T.carregandoPecas}</Text>
        ) : (
          <>
            {cores.length > 0 && (
              <View>
                <Text style={s.grupoRot}>{T.cor}</Text>
                <View style={s.opts}>
                  {cores.map((c) => {
                    const on = aberto.cor === c;
                    return (
                      <Pressable key={c} testID={"nova-cor-" + c} onPress={() => setAberto({ ...aberto, cor: c, varianteId: null })}
                        style={[s.opt, on && s.optOn]} accessibilityRole="radio" accessibilityState={{ selected: on }}>
                        <Text style={[s.optTxt, on && s.optTxtOn]}>{c}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
            {(cores.length === 0 || !!aberto.cor) && (
              <View>
                <Text style={s.grupoRot}>{T.tamanho}</Text>
                <View style={s.opts}>
                  {doTamanho.map((v) => {
                    const livre = v.livre - jaNaLista(pecas, produto.id, v.id);
                    const bloqueada = livre <= 0 && !vendeSemEstoque;
                    const on = aberto.varianteId === v.id;
                    const sub = livre > 0 ? T.nLivres(livre) : v.comCliente > 0 ? T.comCliente : T.semEstoque;
                    return (
                      <Pressable key={v.id} testID={"nova-tamanho-" + v.id} disabled={bloqueada}
                        onPress={() => setAberto({ ...aberto, varianteId: v.id })}
                        style={[s.opt, on && s.optOn, bloqueada && s.optOff]}
                        accessibilityRole="radio" accessibilityState={{ selected: on, disabled: bloqueada }}>
                        <Text style={[s.optTxt, on && s.optTxtOn]}>{v.tamanho || v.rotulo}</Text>
                        <Text style={[s.optSub, on && s.optTxtOn]}>{sub}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          </>
        )}
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <Pressable testID="nova-colocar" disabled={!podeColocar}
            onPress={() => { if (escolhida) entrar(produto, escolhida, livreDaEscolhida); }}
            style={[e.btnPri, !podeColocar && e.desligado]} accessibilityRole="button">
            <Icon name="plus" size={14} color="#fff" />
            <Text style={e.btnPriTxt}>{T.colocar}</Text>
          </Pressable>
          <Pressable testID="nova-variantes-cancelar" onPress={() => setAberto(null)} style={e.btnSec} accessibilityRole="button">
            <Text style={e.btnSecTxt}>{T.cancelar}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Lista do que ela vai levar ──────────────────────────────────────
  const faltaDa = (p: PecaDaCondicional) =>
    (faltas || []).find((f) => f.product_id === p.productId && (f.variant_id || null) === (p.variantId || null)) || null;
  const comFalta = pecas.filter((p) => !!faltaDa(p));
  const faltasMostradas: FaltaDaCondicional[] = [];
  for (const p of comFalta) {
    const f = faltaDa(p)!;
    if (!faltasMostradas.includes(f)) faltasMostradas.push(f);
  }

  return (
    <View testID="nova-passo-2">
      <View style={s.busca}>
        <ScannerInput ref={campo} testID="nova-busca-peca" placeholder={T.buscaPeca} onChangeText={setBusca} onScan={(r) => aoBipar(r.code)} />
      </View>

      {!!aviso && (
        <View style={[e.nota, e.notaAmbar, { marginTop: 0, marginBottom: 10 }]} testID="nova-aviso-busca" accessibilityRole="alert">
          <Icon name="alert" size={14} color={Colors.amber} />
          <Text style={e.notaTxt}>{aviso}</Text>
        </View>
      )}

      {seletor}

      {!aberto && !!busca.trim() && (
        <View testID="nova-sugestoes">
          <Text style={[e.qst, { marginTop: 4 }]}>{T.sugestoes}</Text>
          {carregando && produtos.length === 0 ? (
            <Text style={s.sub}>{T.carregandoPecas}</Text>
          ) : sugestoes.length === 0 ? (
            <Text style={s.sub} testID="nova-sem-resultado">{T.semResultadoPeca}</Text>
          ) : sugestoes.map((p) => (
            <Pressable key={p.id} testID={"nova-sugestao-" + p.id} onPress={() => tocarSugestao(p)} style={s.pick} accessibilityRole="button">
              <View style={[s.thumb, { backgroundColor: accentForProduct(p.id) }]}><Text style={s.thumbTxt}>{productLetter(p.name)}</Text></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.nome} numberOfLines={1}>{p.name}</Text>
                <Text style={s.sub}>{subtitulo(p)}</Text>
              </View>
              <Icon name={p.temVariantes ? "chevron_right" : "plus"} size={16} color={Colors.violet3} />
            </Pressable>
          ))}
        </View>
      )}

      {pecas.length === 0 && !aberto && !busca.trim() && (
        <View style={[e.nota, { marginTop: 0 }]} testID="nova-comece">
          <Icon name="tag" size={14} color={Colors.violet3} />
          <Text style={e.notaTxt}><Text style={{ fontWeight: "700" }}>{T.comeceTitulo}</Text>{T.comeceTexto}</Text>
        </View>
      )}

      {pecas.length > 0 && (
        <View testID="nova-lista-pecas">
          <Text style={[e.qst, { marginTop: 14 }]}>{T.oQueElaVaiLevar}</Text>
          {pecas.map((p) => {
            const f = faltaDa(p);
            return (
              <View key={p.chave} style={[s.pz, (p.semLivre || !!f) && s.pzAmbar]} testID={"nova-peca-" + p.chave}>
                <View style={s.pzTopo}>
                  <View style={[s.thumb, { backgroundColor: accentForProduct(p.productId) }]}><Text style={s.thumbTxt}>{productLetter(p.nome)}</Text></View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.nome} numberOfLines={2}>{p.nome}</Text>
                    <Text style={s.sub}>{[p.cor, p.tamanho, T.umaUn].filter(Boolean).join(" · ")}</Text>
                    {!!f && (
                      <View style={s.chipAmbar}><Icon name="alert" size={12} color={Colors.amber} /><Text style={s.chipAmbarTxt}>{T.semUnidadeLivreChip}</Text></View>
                    )}
                  </View>
                  <Text style={s.preco}>{fmtBRL(p.preco)}</Text>
                  <Pressable testID={"nova-tirar-" + p.chave} onPress={() => onTirar(p.chave)} style={s.tirar}
                    accessibilityLabel={T.tirar(p.nome)} accessibilityRole="button">
                    <Icon name="trash" size={15} color={Colors.ink3} />
                  </Pressable>
                </View>
                {p.semLivre && !f && (
                  <View style={s.pzAviso} testID={"nova-peca-aviso-" + p.chave} accessibilityRole="alert">
                    <Icon name="alert" size={13} color={Colors.amber} />
                    <Text style={s.pzAvisoTxt}>{T.semUnidadeLivre}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {faltasMostradas.map((f, i) => {
        const c = f.condicionais && f.condicionais[0];
        return (
          <View key={(f.product_id || "") + (f.variant_id || "") + i} style={[e.nota, e.notaAmbar]} testID="nova-falta" accessibilityRole="alert">
            <Icon name="alert" size={15} color={Colors.amber} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={e.notaTxt}>
                <Text style={{ fontWeight: "700", color: Colors.ink }}>{T.faltaTitulo(f.nome)}</Text>
                {c ? T.faltaComCondicional(c.numero_exibicao, c.customer_name || "cliente") : T.faltaSemCondicional}
              </Text>
              <View style={s.faltaAcoes}>
                {!!c && !!c.id && !!onVerCondicional && (
                  <Pressable testID="nova-falta-ver" onPress={() => onVerCondicional(c.id as string)} style={e.btnSec} accessibilityRole="button">
                    <Text style={e.btnSecTxt}>{"Ver a " + c.numero_exibicao}</Text>
                  </Pressable>
                )}
                <Pressable testID="nova-falta-tirar" style={e.btnSec} accessibilityRole="button"
                  onPress={() => comFalta.filter((p) => faltaDa(p) === f).forEach((p) => onTirar(p.chave))}>
                  <Text style={e.btnSecTxt}>{T.tirarPeca}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        );
      })}
      {noLimite && <Text style={[s.sub, { marginTop: 8 }]}>{T.noLimite}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  busca: { marginBottom: 4 },
  sub: { fontSize: 12, color: Colors.ink3, lineHeight: 17 },
  nome: { fontSize: 13.5, fontWeight: "600", color: Colors.ink },
  preco: { fontSize: 13, fontWeight: "600", color: Colors.violet3 },
  thumb: { width: 36, height: 36, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  thumbTxt: { color: "#fff", fontSize: 12, fontWeight: "700" },
  pick: {
    flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 6,
    borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.04)",
  },
  varPicker: {
    gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "rgba(120,100,240,0.28)",
    backgroundColor: "rgba(255,255,255,0.04)", marginBottom: 8,
  },
  grupoRot: { fontSize: 12, fontWeight: "600", color: Colors.ink2, marginBottom: 6 },
  opts: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  opt: {
    minHeight: 44, minWidth: 56, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(120,100,240,0.28)", backgroundColor: "rgba(255,255,255,0.04)",
  },
  optOn: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  optOff: { opacity: 0.5 },
  optTxt: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  optTxtOn: { color: "#fff" },
  optSub: { fontSize: 12, color: Colors.ink3 },
  pz: { borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.04)", padding: 10, marginBottom: 6 },
  pzAmbar: { borderColor: Colors.amber },
  pzTopo: { flexDirection: "row", alignItems: "center", gap: 10 },
  pzAviso: {
    flexDirection: "row", gap: 6, alignItems: "flex-start", marginTop: 8, padding: 8, borderRadius: 8,
    borderWidth: 1, borderStyle: "dashed", borderColor: Colors.amber, backgroundColor: Colors.amberD,
  },
  pzAvisoTxt: { flex: 1, fontSize: 12, color: Colors.ink, lineHeight: 17 },
  tirar: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  chipAmbar: {
    flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginTop: 4,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99, backgroundColor: Colors.amberD, borderWidth: 1, borderColor: Colors.amber,
  },
  chipAmbarTxt: { fontSize: 12, fontWeight: "600", color: Colors.ink },
  faltaAcoes: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 8 },
});
