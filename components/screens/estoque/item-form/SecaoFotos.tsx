// ============================================================
// AURA. — Cadastro de item (aberto) · seção "Fotos"
//
// Até 4 por cor, duas já resolvem. A seção existe nos DOIS modos:
//
//   - EDIÇÃO: cada foto sobe, sai e reordena na hora (o produto existe,
//     e mandar a lojista clicar em Salvar pra ver a foto aparecer seria
//     mentira — ela já subiu).
//   - CADASTRO: não há id ainda. A foto escolhida entra numa fila em
//     memória e sobe logo depois do POST, com o progresso no rodapé.
//     Para quem cadastra, a diferença não existe: são os mesmos
//     quadradinhos, os mesmos rótulos.
//   - COR NOVA NA EDIÇÃO (10/09/2026): a cor ainda não existe no servidor,
//     então a foto dela segue o caminho do cadastro — fila, e sobe no
//     Salvar depois da grade. Sair sem salvar não deixa foto órfã.
// ============================================================
import { View, Text, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { Campo, Secao, StoreNote, s } from "./ui";
import { PERFIL_PADRAO, type PerfilDoCadastro } from "./perfis";
import { LinhaDaGaleria, LinhaDaGaleriaLocal, type useGaleriaDoProduto } from "./GaleriaDeFotos";
import {
  chaveDaCor, fotosDaCor, nomeDoTipo, seloDeFotos,
  type CorDoItem, type FotoPendente, type ItemType,
} from "./types";

type Galeria = ReturnType<typeof useGaleriaDoProduto>;

type Props = {
  type: ItemType;
  narrow: boolean;
  persistido: boolean;
  galeria: Galeria;
  pendentes: FotoPendente[];
  onAdicionarPendente: (corHex: string | null, base64: string, contentType: string) => void;
  onRemoverPendente: (id: string) => void;
  onFotoMudou: () => void;
  cores: CorDoItem[];
  /** Edição: cores que já existem no servidor (chaveDaCor). */
  coresSalvas?: string[];
  // 22/09/2026 (perfil de cadastro): textos neutros no Matcon. Opcional.
  perfil?: PerfilDoCadastro;
};

export function SecaoFotos(p: Props) {
  const isProduto = p.type === "product";
  const perfil = p.perfil || PERFIL_PADRAO;
  const cores = isProduto ? p.cores : [];

  // As contagens saem da galeria do servidor (edição) ou da fila em
  // memória (cadastro) — o selo é o mesmo dos dois lados.
  const pendentesPrincipais = p.pendentes.filter((f) => f.corHex == null);
  const pendentesDaCor = (hex: string) =>
    p.pendentes.filter((f) => f.corHex != null && chaveDaCor(f.corHex) === chaveDaCor(hex));

  // Cor que usa a fila: todas no cadastro; na edição, a cor que ainda não
  // foi gravada e não tem foto nenhuma no servidor.
  const ehLocal = (hex: string) =>
    !p.persistido ||
    ((p.coresSalvas || []).indexOf(chaveDaCor(hex)) < 0 && fotosDaCor(p.galeria.porCor, hex).length === 0);

  const qtdPrincipal = p.persistido ? p.galeria.principal.length : pendentesPrincipais.length;
  const contagens = cores.map((c) =>
    ehLocal(c.hex) ? pendentesDaCor(c.hex).length : fotosDaCor(p.galeria.porCor, c.hex).length
  );

  const carregando = p.persistido && p.galeria.carregando;

  return (
    <Secao icon="camera" titulo="Fotos" selo={seloDeFotos(qtdPrincipal, contagens)}>
      {perfil.fotos.lojaOnline ? (
        <StoreNote
          texto={"Aparece na página " + (isProduto ? "do produto" : "do serviço") +
            " e no catálogo do WhatsApp. Até 4 por cor; duas já resolvem."}
        />
      ) : (
        // Perfil Matcon: texto neutro, sem loja online nem catálogo.
        <StoreNote texto={perfil.fotos.aviso || ""} lojaOnline={false} />
      )}

      <Campo
        label="Fotos principais"
        optional={qtdPrincipal + " de " + p.galeria.maxPorCor}
        style={{ marginTop: 12, marginBottom: cores.length ? 12 : 0 }}
      >
        {carregando ? (
          <View style={st.carregando}><ActivityIndicator size="small" color={Colors.violet3} /></View>
        ) : p.persistido ? (
          <LinhaDaGaleria
            fotos={p.galeria.principal}
            principal
            rotulo="foto principal"
            maxPorCor={p.galeria.maxPorCor}
            onSubir={p.galeria.subir}
            onRemover={p.galeria.remover}
            onReordenar={p.galeria.reordenar}
            onMudou={p.onFotoMudou}
          />
        ) : (
          <LinhaDaGaleriaLocal
            fotos={pendentesPrincipais}
            principal
            rotulo="foto principal"
            onAdicionar={p.onAdicionarPendente}
            onRemover={p.onRemoverPendente}
          />
        )}
        <Text style={s.hint}>
          A primeira é a capa — é ela que aparece na lista, no Caixa e no link que você manda.
        </Text>
      </Campo>

      {isProduto && (cores.length > 0 ? (
        <Campo label="Por cor" optional="a foto troca quando o cliente escolhe a cor" style={{ marginBottom: 0 }}>
          <View style={st.cph}>
            {cores.map((c) => {
              const doServidor = fotosDaCor(p.galeria.porCor, c.hex);
              const daFila = pendentesDaCor(c.hex);
              const local = ehLocal(c.hex);
              const quantas = local ? daFila.length : doServidor.length;
              return (
                <View key={c.hex} style={[st.cphLinha, p.narrow && st.cphLinhaNarrow]}>
                  <View style={[st.cphTopo, p.narrow && { width: "100%" as any, marginBottom: 6 }]}>
                    <View style={[st.swatch, { backgroundColor: c.hex }]} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={st.cphNome} numberOfLines={1}>{c.name || c.hex}</Text>
                      {quantas === 1 && <Text style={st.cphSo}>só 1 foto</Text>}
                      {p.persistido && local && <Text style={st.cphSo}>sobe no Salvar</Text>}
                    </View>
                  </View>
                  {carregando && !local ? (
                    <View style={st.carregando}><ActivityIndicator size="small" color={Colors.violet3} /></View>
                  ) : !local ? (
                    <LinhaDaGaleria
                      fotos={doServidor}
                      principal={false}
                      corHex={c.hex}
                      rotulo={c.name || c.hex}
                      maxPorCor={p.galeria.maxPorCor}
                      onSubir={p.galeria.subir}
                      onRemover={p.galeria.remover}
                      onReordenar={p.galeria.reordenar}
                      onMudou={p.onFotoMudou}
                    />
                  ) : (
                    <LinhaDaGaleriaLocal
                      fotos={daFila}
                      principal={false}
                      corHex={c.hex}
                      rotulo={c.name || c.hex}
                      onAdicionar={p.onAdicionarPendente}
                      onRemover={p.onRemoverPendente}
                    />
                  )}
                </View>
              );
            })}
          </View>
          <Text style={s.hint}>Sem foto própria, a cor usa a foto principal.</Text>
        </Campo>
      ) : perfil.fotos.lojaOnline ? (
        <Text style={s.hint}>
          Tem cores? Marque "por cor e tamanho" em Estoque e cada cor ganha sua fileira aqui.
        </Text>
      ) : perfil.fotos.dica ? (
        <Text style={s.hint}>{perfil.fotos.dica}</Text>
      ) : null)}

      {!p.persistido && (
        <Text style={s.hint}>
          {"As fotos sobem assim que você salvar o " + nomeDoTipo(p.type) + "."}
        </Text>
      )}
    </Secao>
  );
}

const st = {
  swatch: { width: 14, height: 14, borderRadius: 4, borderWidth: 1, borderColor: "rgba(0,0,0,0.15)" },
  cph: { borderWidth: 1, borderColor: Colors.border, borderRadius: 9, backgroundColor: Colors.bg3, overflow: "hidden" as const },
  cphLinha: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 10,
    paddingHorizontal: 12, paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  // Celular: quatro quadradinhos não cabem ao lado do nome da cor.
  cphLinhaNarrow: { flexDirection: "column" as const, alignItems: "flex-start" as const, gap: 0 },
  cphTopo: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8, width: 96 },
  cphNome: { fontSize: 12.5, color: Colors.ink },
  cphSo: { fontSize: 10.5, color: Colors.ink3 },
  carregando: { paddingVertical: 16, alignItems: "center" as const },
};

export default SecaoFotos;
