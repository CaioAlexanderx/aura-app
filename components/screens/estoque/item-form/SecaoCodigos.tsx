// ============================================================
// AURA. — Cadastro de item (aberto) · seção "Códigos e fiscal"
//
// SKU, código de barras e NCM. O aviso fiscal e o selo "falta NCM" só
// aparecem para quem realmente emite nota (nfce_config.is_active): pra
// todo mundo mais, NCM é campo opcional que não cobra nada.
//
// 22/09/2026 — PERFIL MATCON (docs/mockups/matcon-cadastro-produto.html,
// ponto ⑦). O card se divide em dois:
//
//   - SecaoNotaFiscal: "Nota fiscal", no TOPO da coluna direita (no
//     celular, logo depois do estoque e da entrega), com as três perguntas
//     do Simples numeradas — código do produto na nota (NCM), código do
//     imposto antecipado (CEST) e "o imposto já veio pago na nota do
//     fornecedor?" — e o selo "2 de 3". Mais "Fabricado no Brasil?".
//     Nenhuma sigla sem tradução; nada de CSOSN/CST/CFOP.
//   - SecaoCodigos com o perfil Matcon: "Códigos", só barras e o código
//     interno, cujo exemplo nasce do nome (POR-001, não VES-001).
//
// Sem o perfil, SecaoCodigos é IDÊNTICA à de hoje ("Códigos e fiscal").
// A pergunta do imposto e o CEST (Matcon M2) passaram a morar só na
// SecaoNotaFiscal: o perfil Matcon é a única porta para eles.
// ============================================================
import { View, Text, Pressable } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { BarcodeQRSection } from "@/components/BarcodeQRSection";
import { suggestNcm, formatNcmDisplay, ncmFamilyByCode, getNcmStatus } from "@/utils/ncm";
import { suggestCest, getCestStatus, formatCestDisplay, cestFamilyByCode, isStLikely } from "@/utils/cest";
import { Campo, Entrada, MiniBtn, Nota, Secao, s } from "./ui";
import { gerarSku, nomeDoTipo, statusCodigos, type CorDoItem, type ItemType, type Selo } from "./types";
import { PERFIL_PADRAO, exemploDeCodigo, type PerfilDoCadastro } from "./perfis";

type Props = {
  type: ItemType;
  emiteNota: boolean;
  nome: string;
  preco: number;
  categoriaEscolhida: string | null;
  material: string;
  cores: CorDoItem[];
  tamanhos: string[];
  sku: string; onSku: (v: string) => void;
  barcode: string; onBarcode: (v: string) => void;
  ncm: string; onNcm: (v: string) => void;
  // 22/09/2026 (perfil de cadastro): com `notaFiscalSeparada`, o card vira
  // "Códigos" (barras + interno) e o fiscal vai para SecaoNotaFiscal.
  perfil?: PerfilDoCadastro;
};

// Selo do NCM/CEST dentro do campo: "✓ OK", "5/8", "vazio".
function Selinho({ status, texto }: { status: "empty" | "partial" | "valid"; texto: string }) {
  return (
    <View style={[st.ncmBadge, status === "valid" && st.ncmBadgeOk]} pointerEvents="none">
      <Text style={[
        st.ncmBadgeTxt,
        status === "valid" && { color: Colors.green },
        status === "partial" && { color: Colors.amber },
      ]}>{texto}</Text>
    </View>
  );
}

export function SecaoCodigos(p: Props) {
  const perfil = p.perfil || PERFIL_PADRAO;
  if (perfil.notaFiscalSeparada) return <CodigosDoProduto {...p} perfil={perfil} />;

  const temVariantes = p.cores.length > 0 || p.tamanhos.length > 0;
  const sugestao = suggestNcm(p.nome, { category: p.categoriaEscolhida, material: p.material });
  const ncmStatus = getNcmStatus(p.ncm);
  const ncmBadge = ncmStatus === "valid" ? "✓ OK" : ncmStatus === "partial" ? p.ncm.length + "/8" : "vazio";
  const ncmFamilia = (sugestao && p.ncm === sugestao.ncm) ? sugestao.family : (ncmFamilyByCode(p.ncm) || "NCM válido");

  return (
    <Secao icon="barcode" titulo="Códigos e fiscal" selo={statusCodigos(p.sku, p.ncm, p.emiteNota)}>
      {p.emiteNota && (
        <View style={{ marginBottom: 12 }}>
          <Nota tom="amber" icon="alert">
            <Text style={s.hint}>
              <Text style={{ color: Colors.ink, fontWeight: "700" }}>Você emite nota fiscal.</Text>
              {" "}Sem NCM a venda deste {nomeDoTipo(p.type)} não gera NFC-e.
            </Text>
          </Nota>
        </View>
      )}

      <Campo label="Código interno (SKU)">
        <View style={s.linha2}>
          <Entrada value={p.sku} onChangeText={p.onSku} placeholder="VES-001" style={{ flex: 1 }} />
          <MiniBtn label="Gerar" onPress={() => p.onSku(gerarSku(p.nome))} />
        </View>
      </Campo>

      <Campo label="Código de barras">
        {temVariantes ? (
          <Nota>
            <Text style={s.hint}>
              Com cores e tamanhos, cada combinação tem o seu.
              {" "}Preencha na grade em <Text style={{ color: Colors.ink, fontWeight: "700" }}>Estoque</Text>.
            </Text>
          </Nota>
        ) : (
          <BarcodeQRSection
            code={p.barcode}
            productName={p.nome}
            price={p.preco}
            onCodeChange={p.onBarcode}
          />
        )}
      </Campo>

      <Campo
        label="NCM"
        optional={p.emiteNota ? "necessário para a nota" : "só para nota fiscal"}
        style={{ marginBottom: 0 }}
      >
        <View style={s.linha2}>
          <View style={{ flex: 1, position: "relative" as any }}>
            <Entrada
              value={p.ncm}
              onChangeText={(v: string) => p.onNcm(v.replace(/\D/g, "").slice(0, 8))}
              placeholder="00000000"
              keyboardType="number-pad"
              maxLength={8}
              style={{ paddingRight: 52 }}
            />
            <Selinho status={ncmStatus} texto={ncmBadge} />
          </View>
          <MiniBtn
            label="Sugerir"
            disabled={!sugestao}
            onPress={() => { if (sugestao) p.onNcm(sugestao.ncm); }}
          />
        </View>
        <Text style={s.hint}>
          {ncmStatus === "empty" && (sugestao
            ? <Text>
                Pelo nome: <Text style={s.link}>{sugestao.label}</Text> ·{" "}
                <Text style={s.link}>{formatNcmDisplay(sugestao.ncm)}</Text>. Toque em Gerar.
              </Text>
            : (p.emiteNota
                ? "8 dígitos. Necessário pra emitir nota fiscal."
                : "Dá para preencher depois."))}
          {ncmStatus === "partial" && (
            <Text style={{ color: Colors.red }}>
              {"Faltam " + (8 - p.ncm.length) + " dígito" + (8 - p.ncm.length > 1 ? "s" : "") + "."}
            </Text>
          )}
          {ncmStatus === "valid" && <Text style={{ color: Colors.green }}>{"✓ " + ncmFamilia}</Text>}
        </Text>
      </Campo>
    </Secao>
  );
}

// ── perfil Matcon: "Códigos" (barras + interno) ──────────────
function CodigosDoProduto(p: Props & { perfil: PerfilDoCadastro }) {
  const temVariantes = p.cores.length > 0 || p.tamanhos.length > 0;
  const exemplo = exemploDeCodigo(p.nome);
  return (
    <Secao icon="barcode" titulo="Códigos" selo={(p.sku || "").trim() || (p.barcode || "").trim() ? { tom: "ok", texto: "preenchido" } : null}>
      <Campo label="Código de barras">
        {temVariantes ? (
          <Nota>
            <Text style={s.hint}>
              {"Com cores e " + p.perfil.estoque.rotuloDosTamanhos.toLowerCase() + ", cada combinação tem o seu."}
              {" "}Preencha na grade em <Text style={{ color: Colors.ink, fontWeight: "700" }}>Estoque</Text>.
            </Text>
          </Nota>
        ) : (
          <BarcodeQRSection
            code={p.barcode}
            productName={p.nome}
            price={p.preco}
            onCodeChange={p.onBarcode}
          />
        )}
      </Campo>

      <Campo label="Código interno" optional="o seu código de prateleira" style={{ marginBottom: 0 }}>
        <View style={s.linha2}>
          <Entrada value={p.sku} onChangeText={p.onSku} placeholder={exemplo} style={{ flex: 1 }} />
          <MiniBtn label="Gerar" onPress={() => p.onSku(gerarSku(p.nome))} />
        </View>
        <Text style={s.hint}>O exemplo nasce do nome que você digitou.</Text>
      </Campo>
    </Secao>
  );
}

// ── perfil Matcon: "Nota fiscal" ─────────────────────────────
type PropsDaNota = {
  emiteNota: boolean;
  nome: string;
  categoriaEscolhida: string | null;
  material: string;
  ncm: string; onNcm: (v: string) => void;
  cest: string; onCest: (v: string) => void;
  icmsStPaid: boolean | null; onIcmsStPaid: (v: boolean | null) => void;
  origem: number | null; onOrigem: (v: number | null) => void;
};

/** Quantas das três perguntas estão respondidas: NCM com 8 dígitos, CEST
 *  com 7 e a pergunta do imposto. */
export function respostasDaNota(ncm: string, cest: string, icmsStPaid: boolean | null | undefined): number {
  return (getNcmStatus(ncm) === "valid" ? 1 : 0)
    + (getCestStatus(cest) === "valid" ? 1 : 0)
    + (icmsStPaid === true || icmsStPaid === false ? 1 : 0);
}

/** "3 de 3 ✓" (ok); faltando, "2 de 3" — âmbar só para quem emite nota. */
export function seloDaNota(respondidas: number, emiteNota: boolean): Selo {
  if (respondidas >= 3) return { tom: "ok", texto: "3 de 3 ✓" };
  return { tom: emiteNota ? "rec" : "", texto: respondidas + " de 3" };
}

function Pergunta({ n, titulo, descricao, children }: { n: number; titulo: string; descricao?: string; children: any }) {
  return (
    <View style={[st.perg, n > 1 && st.pergSep]}>
      <View style={st.pergTopo}>
        <View style={st.pergN}><Text style={st.pergNTxt}>{String(n)}</Text></View>
        <Text style={st.pergQ}>{titulo}</Text>
      </View>
      {descricao ? <Text style={st.pergD}>{descricao}</Text> : null}
      {children}
    </View>
  );
}

export function SecaoNotaFiscal(p: PropsDaNota) {
  const sugestao = suggestNcm(p.nome, { category: p.categoriaEscolhida, material: p.material });
  const ncmStatus = getNcmStatus(p.ncm);
  const ncmBadge = ncmStatus === "valid" ? "✓ OK" : ncmStatus === "partial" ? p.ncm.length + "/8" : "vazio";
  const ncmFamilia = (sugestao && p.ncm === sugestao.ncm) ? sugestao.family : (ncmFamilyByCode(p.ncm) || "código preenchido");

  const cestVal = p.cest || "";
  const cestSug = suggestCest(p.ncm);
  const cestStatus = getCestStatus(cestVal);
  const cestBadge = cestStatus === "valid" ? "✓ OK" : cestStatus === "partial" ? cestVal.length + "/7" : "vazio";
  const cestFamilia = (cestSug && cestVal === cestSug.cest) ? cestSug.family : (cestFamilyByCode(cestVal) || "código preenchido");
  const stLikely = isStLikely(p.ncm);

  const respondidas = respostasDaNota(p.ncm, cestVal, p.icmsStPaid);

  return (
    <Secao icon="receipt" titulo="Nota fiscal" selo={seloDaNota(respondidas, p.emiteNota)} style={st.destaque}>
      {p.emiteNota && (
        <View style={{ marginBottom: 12 }}>
          <Nota tom="amber" icon="alert">
            <Text style={s.hint}>
              <Text style={{ color: Colors.ink, fontWeight: "700" }}>Você emite nota.</Text>
              {" "}Sem estas três respostas, a nota da venda deste produto pode ser recusada.
            </Text>
          </Nota>
        </View>
      )}

      <Pergunta n={1} titulo="Código do produto na nota (NCM)" descricao="8 números. Está na nota do fornecedor, ao lado do nome do produto.">
        <View style={s.linha2}>
          <View style={{ flex: 1, position: "relative" as any }}>
            <Entrada
              value={p.ncm}
              onChangeText={(v: string) => p.onNcm(v.replace(/\D/g, "").slice(0, 8))}
              placeholder="00000000"
              keyboardType="number-pad"
              maxLength={8}
              accessibilityLabel="Código do produto na nota (NCM)"
              style={{ paddingRight: 52 }}
            />
            <Selinho status={ncmStatus} texto={ncmBadge} />
          </View>
          <MiniBtn label="Sugerir" disabled={!sugestao} onPress={() => { if (sugestao) p.onNcm(sugestao.ncm); }} />
        </View>
        {ncmStatus === "empty" && sugestao ? (
          <Text style={s.hint}>
            Pelo nome: <Text style={s.link}>{sugestao.label}</Text> ·{" "}
            <Text style={s.link}>{formatNcmDisplay(sugestao.ncm)}</Text>. Toque em Gerar.
          </Text>
        ) : null}
        {ncmStatus === "partial" ? (
          <Text style={[s.hint, { color: Colors.red }]}>
            {"Faltam " + (8 - p.ncm.length) + " número" + (8 - p.ncm.length > 1 ? "s" : "") + "."}
          </Text>
        ) : null}
        {ncmStatus === "valid" ? <Text style={[s.hint, { color: Colors.green }]}>{"✓ " + ncmFamilia}</Text> : null}
      </Pergunta>

      <Pergunta n={2} titulo="Código do imposto antecipado (CEST)" descricao="7 números. Cimento, tinta, fio, cano e piso quase sempre têm.">
        <View style={s.linha2}>
          <View style={{ flex: 1, position: "relative" as any }}>
            <Entrada
              value={cestVal}
              onChangeText={(v: string) => p.onCest(v.replace(/\D/g, "").slice(0, 7))}
              placeholder="0000000"
              keyboardType="number-pad"
              maxLength={7}
              accessibilityLabel="Código do imposto antecipado (CEST)"
              style={{ paddingRight: 52 }}
            />
            <Selinho status={cestStatus} texto={cestBadge} />
          </View>
          <MiniBtn label="Sugerir" disabled={!cestSug} onPress={() => { if (cestSug) p.onCest(cestSug.cest); }} />
        </View>
        {cestStatus === "empty" && cestSug ? (
          <Text style={s.hint}>
            Pelo código do produto: <Text style={s.link}>{cestSug.family}</Text> ·{" "}
            <Text style={s.link}>{formatCestDisplay(cestSug.cest)}</Text>. Toque em Gerar.
          </Text>
        ) : null}
        {cestStatus === "partial" ? (
          <Text style={[s.hint, { color: Colors.red }]}>
            {"Faltam " + (7 - cestVal.length) + " número" + (7 - cestVal.length > 1 ? "s" : "") + "."}
          </Text>
        ) : null}
        {cestStatus === "valid" ? <Text style={[s.hint, { color: Colors.green }]}>{"✓ " + cestFamilia}</Text> : null}
      </Pergunta>

      <Pergunta n={3} titulo="O imposto deste produto já veio pago na nota do fornecedor?">
        <View style={st.pergOpts}>
          <Pressable
            onPress={() => p.onIcmsStPaid(true)}
            style={[st.pergOpt, p.icmsStPaid === true && st.pergOptOn]}
            accessibilityLabel="Sim, já veio"
          >
            <Text style={[st.pergOptT, p.icmsStPaid === true && st.pergOptTOn]}>Sim, já veio</Text>
            <Text style={st.pergOptD}>o distribuidor pagou antes</Text>
          </Pressable>
          <Pressable
            onPress={() => p.onIcmsStPaid(false)}
            style={[st.pergOpt, p.icmsStPaid === false && st.pergOptOn]}
            accessibilityLabel="Não"
          >
            <Text style={[st.pergOptT, p.icmsStPaid === false && st.pergOptTOn]}>Não</Text>
            <Text style={st.pergOptD}>pago na minha venda</Text>
          </Pressable>
        </View>
        {(p.icmsStPaid === null || p.icmsStPaid === undefined) && stLikely && (
          <View style={st.sugest}>
            <Icon name="percent" size={12} color={Colors.violet3} />
            <Text style={st.sugestTxt}>
              Cimento, tinta, piso e ferragem costumam vir com o imposto já pago — sugerimos{" "}
              <Text style={{ fontWeight: "700", color: Colors.ink }}>Sim</Text>.
            </Text>
          </View>
        )}
      </Pergunta>

      <View style={st.divider} />

      <Text style={[s.hint, { marginTop: 0 }]}>
        Fabricado no Brasil?{" "}
        <Text
          onPress={() => p.onOrigem(0)}
          accessibilityRole="button"
          style={[st.origemOpt, (p.origem == null || p.origem === 0) && st.origemOptOn]}
        >
          Sim
        </Text>
        {" · "}
        <Text
          onPress={() => p.onOrigem(1)}
          accessibilityRole="button"
          style={[st.origemOpt, !!p.origem && p.origem > 0 && st.origemOptOn]}
        >
          Não, importado
        </Text>
      </Text>
      <Text style={s.hint}>
        Cadastrando pela nota do fornecedor (Estoque › Importar › Nota do fornecedor), o código do produto já vem preenchido. Na dúvida, mostre esta tela ao seu contador.
      </Text>
    </Secao>
  );
}

const st = {
  ncmBadge: {
    position: "absolute" as any, right: 6, top: 6, bottom: 6,
    paddingHorizontal: 7, borderRadius: 5,
    alignItems: "center" as const, justifyContent: "center" as const,
    backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border,
  },
  ncmBadgeOk: { borderColor: "rgba(52,211,153,0.3)", backgroundColor: Colors.greenD },
  ncmBadgeTxt: { fontSize: 10, fontWeight: "700" as const, color: Colors.ink3 },
  destaque: { borderColor: Colors.violet },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 12 },
  perg: { paddingBottom: 10 },
  pergSep: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10 },
  pergTopo: { flexDirection: "row" as const, alignItems: "flex-start" as const, gap: 8 },
  pergN: {
    borderRadius: 999, borderWidth: 1, borderColor: Colors.border2,
    paddingHorizontal: 6, marginTop: 1,
  },
  pergNTxt: { fontSize: 10, color: Colors.violet3, fontWeight: "700" as const },
  pergQ: { flex: 1, fontSize: 12.5, color: Colors.ink, fontWeight: "700" as const, lineHeight: 17 },
  pergD: { fontSize: 11, color: Colors.ink3, marginTop: 2, marginBottom: 7, lineHeight: 15 },
  pergOpts: { flexDirection: "row" as const, gap: 8, marginTop: 8 },
  pergOpt: {
    flex: 1, borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.bg3, paddingHorizontal: 10, paddingVertical: 9,
  },
  pergOptOn: { backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  pergOptT: { fontSize: 12.5, fontWeight: "700" as const, color: Colors.ink },
  pergOptTOn: { color: Colors.violet3 },
  pergOptD: { fontSize: 10.5, color: Colors.ink3, marginTop: 2 },
  sugest: {
    flexDirection: "row" as const, gap: 6, alignItems: "flex-start" as const,
    marginTop: 8, backgroundColor: Colors.violetD, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8,
  },
  sugestTxt: { flex: 1, fontSize: 11, color: Colors.ink2, lineHeight: 15 },
  origemOpt: { fontSize: 11.5, fontWeight: "700" as const, color: Colors.ink3 },
  origemOptOn: { color: Colors.violet3 },
};

export default SecaoCodigos;
