// ============================================================
// AURA. — Cadastro de item (aberto) · seção "Códigos e fiscal"
//
// SKU, código de barras e NCM. O aviso fiscal e o selo "falta NCM" só
// aparecem para quem realmente emite nota (nfce_config.is_active): pra
// todo mundo mais, NCM é campo opcional que não cobra nada.
//
// 22/09/2026 (Matcon M2, docs/CONTRACT_MATCON.md §M2): com `matconOn`, a
// seção ganha o código fiscal do produto (CEST — no mesmo desenho do NCM:
// selo, botão Gerar, frase de sugestão), a pergunta "o imposto já veio
// recolhido na nota do fornecedor?" e "Fabricado no Brasil?". Sem
// `matconOn` a seção é IDÊNTICA à de hoje — nenhuma prop nova é
// obrigatória (regra 3 do CLAUDE.md). Zero jargão: CSOSN/CST/ST/CFOP
// nunca aparecem aqui, só "código fiscal (CEST)" e "imposto recolhido".
// ============================================================
import { View, Text, Pressable } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { BarcodeQRSection } from "@/components/BarcodeQRSection";
import { suggestNcm, formatNcmDisplay, ncmFamilyByCode, getNcmStatus } from "@/utils/ncm";
import { suggestCest, getCestStatus, formatCestDisplay, cestFamilyByCode, isStLikely } from "@/utils/cest";
import { Campo, Entrada, MiniBtn, Nota, Secao, s } from "./ui";
import { gerarSku, nomeDoTipo, statusCodigos, type CorDoItem, type ItemType } from "./types";

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
  // 22/09/2026 (Matcon M2) — todas opcionais: sem matconOn nada disto é lido.
  matconOn?: boolean;
  cest?: string; onCest?: (v: string) => void;
  icmsStPaid?: boolean | null; onIcmsStPaid?: (v: boolean | null) => void;
  origem?: number | null; onOrigem?: (v: number | null) => void;
};

export function SecaoCodigos(p: Props) {
  const temVariantes = p.cores.length > 0 || p.tamanhos.length > 0;
  const sugestao = suggestNcm(p.nome, { category: p.categoriaEscolhida, material: p.material });
  const ncmStatus = getNcmStatus(p.ncm);
  const ncmBadge = ncmStatus === "valid" ? "✓ OK" : ncmStatus === "partial" ? p.ncm.length + "/8" : "vazio";
  const ncmFamilia = (sugestao && p.ncm === sugestao.ncm) ? sugestao.family : (ncmFamilyByCode(p.ncm) || "NCM válido");

  // 22/09/2026 (Matcon M2) — CEST no mesmo desenho do NCM acima.
  const cestVal = p.cest || "";
  const cestSug = p.matconOn ? suggestCest(p.ncm) : null;
  const cestStatus = getCestStatus(cestVal);
  const cestBadge = cestStatus === "valid" ? "✓ OK" : cestStatus === "partial" ? cestVal.length + "/7" : "vazio";
  const cestFamilia = (cestSug && cestVal === cestSug.cest) ? cestSug.family : (cestFamilyByCode(cestVal) || "código fiscal preenchido");
  const stLikely = p.matconOn ? isStLikely(p.ncm) : false;

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
        style={p.matconOn ? undefined : { marginBottom: 0 }}
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
            <View style={[st.ncmBadge, ncmStatus === "valid" && st.ncmBadgeOk]} pointerEvents="none">
              <Text style={[
                st.ncmBadgeTxt,
                ncmStatus === "valid" && { color: Colors.green },
                ncmStatus === "partial" && { color: Colors.amber },
              ]}>{ncmBadge}</Text>
            </View>
          </View>
          <MiniBtn
            label="Gerar"
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

      {p.matconOn && (
        <>
          <Campo label="Código fiscal do produto (CEST)" optional="7 dígitos">
            <View style={s.linha2}>
              <View style={{ flex: 1, position: "relative" as any }}>
                <Entrada
                  value={cestVal}
                  onChangeText={(v: string) => p.onCest && p.onCest(v.replace(/\D/g, "").slice(0, 7))}
                  placeholder="0000000"
                  keyboardType="number-pad"
                  maxLength={7}
                  style={{ paddingRight: 52 }}
                />
                <View style={[st.ncmBadge, cestStatus === "valid" && st.ncmBadgeOk]} pointerEvents="none">
                  <Text style={[
                    st.ncmBadgeTxt,
                    cestStatus === "valid" && { color: Colors.green },
                    cestStatus === "partial" && { color: Colors.amber },
                  ]}>{cestBadge}</Text>
                </View>
              </View>
              <MiniBtn
                label="Gerar"
                disabled={!cestSug}
                onPress={() => { if (cestSug && p.onCest) p.onCest(cestSug.cest); }}
              />
            </View>
            <Text style={s.hint}>
              {cestStatus === "empty" && (cestSug
                ? <Text>
                    Pelo NCM {formatNcmDisplay(p.ncm)}: <Text style={s.link}>{cestSug.family}</Text> ·{" "}
                    <Text style={s.link}>{formatCestDisplay(cestSug.cest)}</Text>. Toque em Gerar.
                  </Text>
                : "7 dígitos. Necessário quando o produto tem imposto recolhido antecipado.")}
              {cestStatus === "partial" && (
                <Text style={{ color: Colors.red }}>
                  {"Faltam " + (7 - cestVal.length) + " dígito" + (7 - cestVal.length > 1 ? "s" : "") + "."}
                </Text>
              )}
              {cestStatus === "valid" && <Text style={{ color: Colors.green }}>{"✓ " + cestFamilia}</Text>}
            </Text>
          </Campo>

          <View style={st.divider} />

          <View>
            <Text style={st.pergQ}>O imposto deste produto já veio recolhido na nota do fornecedor?</Text>
            <View style={st.pergOpts}>
              <Pressable
                onPress={() => p.onIcmsStPaid && p.onIcmsStPaid(true)}
                style={[st.pergOpt, p.icmsStPaid === true && st.pergOptOn]}
                accessibilityLabel="Sim, já veio"
              >
                <Text style={[st.pergOptT, p.icmsStPaid === true && st.pergOptTOn]}>Sim, já veio</Text>
                <Text style={st.pergOptD}>o distribuidor pagou antes</Text>
              </Pressable>
              <Pressable
                onPress={() => p.onIcmsStPaid && p.onIcmsStPaid(false)}
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
                  Cimento, tinta e ferragem costumam vir com o imposto recolhido — sugerimos{" "}
                  <Text style={{ fontWeight: "700", color: Colors.ink }}>Sim</Text>.
                </Text>
              </View>
            )}
          </View>

          <View style={st.divider} />

          <Text style={[s.hint, { marginTop: 0 }]}>
            Fabricado no Brasil?{" "}
            <Text
              onPress={() => p.onOrigem && p.onOrigem(0)}
              style={[st.origemOpt, (p.origem == null || p.origem === 0) && st.origemOptOn]}
            >
              Sim
            </Text>
            {" "}ou{" "}
            <Text
              onPress={() => p.onOrigem && p.onOrigem(1)}
              style={[st.origemOpt, !!p.origem && p.origem > 0 && st.origemOptOn]}
            >
              Importado
            </Text>
          </Text>
        </>
      )}
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
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 12 },
  pergQ: { fontSize: 12.5, color: Colors.ink, fontWeight: "700" as const, marginBottom: 8, lineHeight: 17 },
  pergOpts: { flexDirection: "row" as const, gap: 8 },
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
