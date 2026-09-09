// ============================================================
// AURA. — Cadastro de item (aberto) · seção "Códigos e fiscal"
//
// SKU, código de barras e NCM. O aviso fiscal e o selo "falta NCM" só
// aparecem para quem realmente emite nota (nfce_config.is_active): pra
// todo mundo mais, NCM é campo opcional que não cobra nada.
// ============================================================
import { View, Text } from "react-native";
import { Colors } from "@/constants/colors";
import { BarcodeQRSection } from "@/components/BarcodeQRSection";
import { suggestNcm, formatNcmDisplay, ncmFamilyByCode, getNcmStatus } from "@/utils/ncm";
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
};

export function SecaoCodigos(p: Props) {
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
};

export default SecaoCodigos;
