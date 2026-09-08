// ============================================================
// AURA. — Cadastro de item · passo 3 "Complementos"
//
// Sanfona com estado: cada cartão diz o que falta, então a lojista vê
// sem abrir tudo. Nada aqui é obrigatório e nada tem botão de salvar —
// cada campo salva sozinho ao sair dele (ver ItemWizardModal).
//
// O conteúdo dos cartões NUNCA desmonta (ver AccordionCard): abrir e
// fechar não pode remontar a ScrollView nem recarregar a grade de
// variações.
// ============================================================
import { useEffect, useRef } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { ProductVariationsSection } from "@/components/ProductVariationsSection";
import { BarcodeQRSection } from "@/components/BarcodeQRSection";
import { suggestNcm, formatNcmDisplay, ncmFamilyByCode, getNcmStatus } from "@/utils/ncm";
import { AccordionCard, Campo, Entrada, MiniBtn, Nota, StoreNote, s } from "./ui";
import { LinhaDaGaleria, useGaleriaDoProduto } from "./GaleriaDeFotos";
import {
  capaDa, faltaNcm, fmtBRL, fotosDaCor, gerarSku, nomeDoTipo, statusCodigos, statusDescricao,
  statusGaleria, statusVariacoes, valorDaMascara,
  type CardKey, type ItemType, type SaveState, type StockMode, type WizardColor,
} from "./types";

type Props = {
  type: ItemType;
  narrow: boolean;
  productId: string;
  recemCriado: boolean;
  emiteNota: boolean;

  aberto: Record<string, boolean>;
  onToggle: (k: CardKey) => void;
  cardSave: Record<string, SaveState>;

  nome: string;
  preco: string;
  imagemUrl: string | null;
  /** A capa da galeria principal — alimenta a prévia da loja, sem acender "Salvo". */
  onCapaPrincipal: (url: string | null) => void;
  /** Depois de subir, apagar ou reordenar uma foto: acende "Salvo" no cartão. */
  onFotoMudou: () => void;

  cores: WizardColor[];
  tamanhos: string[];
  stockMode: StockMode;
  corPai: string | null;
  tamanhoPai: string | null;
  estoquePai: number | null;

  descricao: string; onDescricao: (v: string) => void;
  material: string; onMaterial: (v: string) => void;
  medidas: string; onMedidas: (v: string) => void;
  cuidados: string; onCuidados: (v: string) => void;

  sku: string; onSku: (v: string) => void;
  barcode: string; onBarcode: (v: string) => void;
  ncm: string; onNcm: (v: string) => void;

  categoriaEscolhida: string | null;
  onIrParaPasso2: () => void;
  onBlur: (card?: CardKey) => void;
};

export function Step3Complementos(p: Props) {
  const isProduto = p.type === "product";
  const temVariantes = p.cores.length > 0 || p.tamanhos.length > 0;

  const sugestao = suggestNcm(p.nome, { category: p.categoriaEscolhida, material: p.material });
  const ncmStatus = getNcmStatus(p.ncm);
  const ncmBadge = ncmStatus === "valid" ? "✓ OK" : ncmStatus === "partial" ? p.ncm.length + "/8" : "vazio";
  const ncmFamilia = (sugestao && p.ncm === sugestao.ncm) ? sugestao.family : (ncmFamilyByCode(p.ncm) || "NCM válido");

  // ── Foto ────────────────────────────────────────────────
  //
  // Migration 323: deixou de ser UMA foto principal + UMA por cor. Agora
  // são até quatro de cada, com capa reordenável. A capa (posição 0) é o
  // que a vitrine, o PDV e o catálogo do WhatsApp continuam lendo, então
  // "Tornar capa" muda o que o cliente vê primeiro.
  const g = useGaleriaDoProduto(p.productId);
  const capaPrincipal = capaDa(g.principal)?.url || null;

  // A prévia da loja (mais abaixo neste passo) desenha a capa. Ela vem da
  // galeria, não de um estado próprio — sem isso a prévia mentiria depois
  // de um "Tornar capa".
  const capaVista = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (g.carregando) return;
    if (capaVista.current === capaPrincipal) return;
    capaVista.current = capaPrincipal;
    if (capaPrincipal !== p.imagemUrl) p.onCapaPrincipal(capaPrincipal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capaPrincipal, g.carregando]);

  const semFoto = p.cores.filter((c) => fotosDaCor(g.porCor, c.hex).length === 0).length;

  const corpoFoto = (
    <View>
      <View style={{ marginTop: 12 }}>
        <StoreNote texto={
          "Aparece na página " + (isProduto ? "do produto" : "do serviço") +
          " e no catálogo do WhatsApp. Quadrada fica melhor."
        } />
      </View>

      <Campo
        label="Fotos principais"
        optional={g.principal.length ? g.principal.length + " de " + g.maxPorCor : "até " + g.maxPorCor}
        style={{ marginTop: 12, marginBottom: isProduto ? 14 : 0 }}
      >
        {g.carregando ? (
          <View style={st.carregando}><ActivityIndicator size="small" color={Colors.violet3} /></View>
        ) : (
          <LinhaDaGaleria
            fotos={g.principal}
            principal
            rotulo="foto principal"
            maxPorCor={g.maxPorCor}
            onSubir={g.subir}
            onRemover={g.remover}
            onReordenar={g.reordenar}
            onMudou={p.onFotoMudou}
          />
        )}
        <Text style={s.hint}>
          A primeira é a capa — é ela que aparece na lista, no Caixa e no link que você manda.
          Duas já contam a peça: a capa e uma no corpo.
        </Text>
      </Campo>

      {isProduto && (
        p.cores.length > 0 ? (
          <Campo
            label="Fotos por cor"
            optional={semFoto ? semFoto + " de " + p.cores.length + " sem foto" : "todas com foto"}
            style={{ marginBottom: 0 }}
          >
            <View style={st.cph}>
              {p.cores.map((c) => (
                <View key={c.hex} style={[st.cphLinha, p.narrow && st.cphLinhaNarrow]}>
                  <View style={[st.cphTopo, p.narrow && { width: "100%" as any, marginBottom: 6 }]}>
                    <View style={[st.swatch, { backgroundColor: c.hex }]} />
                    <Text style={st.cphNome} numberOfLines={1}>{c.name || c.hex}</Text>
                  </View>
                  {g.carregando ? (
                    <View style={st.carregando}><ActivityIndicator size="small" color={Colors.violet3} /></View>
                  ) : (
                    <LinhaDaGaleria
                      fotos={fotosDaCor(g.porCor, c.hex)}
                      principal={false}
                      corHex={c.hex}
                      rotulo={c.name || c.hex}
                      maxPorCor={g.maxPorCor}
                      onSubir={g.subir}
                      onRemover={g.remover}
                      onReordenar={g.reordenar}
                      onMudou={p.onFotoMudou}
                    />
                  )}
                </View>
              ))}
            </View>
            <Text style={s.hint}>
              Quando o cliente escolhe a cor na loja, a foto muda para a dela.
              Sem foto própria, a cor usa a foto principal.
            </Text>
          </Campo>
        ) : (
          <Text style={s.hint}>
            Tem cores?{" "}
            <Text style={s.link} onPress={p.onIrParaPasso2}>Cadastre no passo 2</Text>
            {" "}e cada cor ganha as próprias fotos aqui.
          </Text>
        )
      )}
    </View>
  );

  // ── Cores e tamanhos ────────────────────────────────────
  const corpoVariacoes = (
    <View style={{ marginTop: 8 }}>
      <ProductVariationsSection
        productId={p.productId}
        productName={p.nome}
        parentColor={p.corPai}
        parentSize={p.tamanhoPai}
        parentStock={p.estoquePai}
      />
      <Text style={s.hint}>
        <Text style={s.link} onPress={p.onIrParaPasso2}>Alterar cores e tamanhos no passo 2 →</Text>
      </Text>
    </View>
  );

  // ── Descrição e ficha ───────────────────────────────────
  const precoNum = valorDaMascara(p.preco);
  const fichaLinhas: Array<[string, string]> = [];
  if (isProduto) {
    if (p.material.trim()) fichaLinhas.push(["Material", p.material.trim()]);
    if (p.medidas.trim()) fichaLinhas.push(["Medidas", p.medidas.trim()]);
    if (p.cuidados.trim()) fichaLinhas.push(["Cuidados", p.cuidados.trim()]);
  }

  const corpoDescricao = (
    <View>
      <View style={{ marginTop: 12 }}>
        <StoreNote texto="É o texto que o cliente lê na página antes de decidir. A prévia abaixo atualiza enquanto você escreve." />
      </View>
      <Campo label="Descrição" style={{ marginTop: 12 }}>
        <Entrada
          value={p.descricao}
          onChangeText={p.onDescricao}
          onBlur={() => p.onBlur("desc")}
          placeholder={isProduto
            ? "Do que é feito, como veste, como cuidar."
            : "O que está incluso, para quem é, o que levar."}
          multiline
          numberOfLines={4}
          style={{ minHeight: 76, textAlignVertical: "top" }}
        />
      </Campo>

      {isProduto && (
        <Campo label="Ficha técnica" optional="só aparece o que estiver preenchido">
          <Entrada
            value={p.material}
            onChangeText={p.onMaterial}
            onBlur={() => p.onBlur("desc")}
            placeholder="Material · ex.: Viscose com elastano"
            style={{ marginBottom: 8 }}
          />
          <View style={[s.linha2, p.narrow && { flexDirection: "column", gap: 8 }]}>
            <Entrada
              value={p.medidas}
              onChangeText={p.onMedidas}
              onBlur={() => p.onBlur("desc")}
              placeholder="Medidas · ex.: Busto 92cm"
              style={{ flex: 1 }}
            />
            <Entrada
              value={p.cuidados}
              onChangeText={p.onCuidados}
              onBlur={() => p.onBlur("desc")}
              placeholder="Cuidados · ex.: Lavar à mão"
              style={{ flex: 1 }}
            />
          </View>
        </Campo>
      )}

      <View style={st.pv}>
        <Text style={st.pvHead}>Prévia na loja</Text>
        <View style={[st.pvBody, p.narrow && { flexDirection: "column" }]}>
          <View style={[st.pvImg, !!p.imagemUrl && st.pvImgTem]} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={st.pvNome}>{p.nome || ("Nome do " + nomeDoTipo(p.type))}</Text>
            <Text style={st.pvPreco}>{fmtBRL(precoNum)}</Text>
            {p.descricao.trim()
              ? <Text style={st.pvDesc}>{p.descricao.trim()}</Text>
              : <Text style={st.pvVazio}>Sem descrição, a página mostra só a foto e o preço.</Text>}
            {fichaLinhas.length > 0 && (
              <View style={st.pvFicha}>
                {fichaLinhas.map(([k, v]) => (
                  <View key={k} style={st.pvLinha}>
                    <Text style={st.pvLinhaK}>{k}</Text>
                    <Text style={st.pvLinhaV}>{v}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );

  // ── Códigos e fiscal ────────────────────────────────────
  const corpoCodigos = (
    <View>
      {p.emiteNota && (
        <View style={{ marginTop: 12 }}>
          <Nota tom="amber" icon="alert">
            <Text style={s.hint}>
              <Text style={{ color: Colors.ink, fontWeight: "700" }}>Você emite nota fiscal.</Text>
              {" "}Sem NCM a venda deste {nomeDoTipo(p.type)} não gera NFC-e.
            </Text>
          </Nota>
        </View>
      )}

      <Campo label="Código interno (SKU)" style={{ marginTop: 12 }}>
        <View style={s.linha2}>
          <Entrada
            value={p.sku}
            onChangeText={p.onSku}
            onBlur={() => p.onBlur("codes")}
            placeholder="VES-001"
            style={{ flex: 1 }}
          />
          <MiniBtn label="Gerar" onPress={() => { p.onSku(gerarSku(p.nome)); p.onBlur("codes"); }} />
        </View>
      </Campo>

      <Campo label="Código de barras">
        {temVariantes ? (
          <Nota>
            <Text style={s.hint}>
              Com cores e tamanhos, cada combinação tem o seu. Preencha na grade em{" "}
              <Text style={{ color: Colors.ink, fontWeight: "700" }}>Cores e tamanhos</Text>.
            </Text>
          </Nota>
        ) : (
          <BarcodeQRSection
            code={p.barcode}
            productName={p.nome}
            price={precoNum}
            onCodeChange={(v: string) => { p.onBarcode(v); p.onBlur("codes"); }}
          />
        )}
      </Campo>

      <Campo label="NCM" optional={p.emiteNota ? "necessário para a nota" : "fiscal · 8 dígitos"} style={{ marginBottom: 0 }}>
        <View style={s.linha2}>
          <View style={{ flex: 1, position: "relative" as any }}>
            <Entrada
              value={p.ncm}
              onChangeText={(v: string) => p.onNcm(v.replace(/\D/g, "").slice(0, 8))}
              onBlur={() => p.onBlur("codes")}
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
            onPress={() => { if (sugestao) { p.onNcm(sugestao.ncm); p.onBlur("codes"); } }}
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
                : "Necessário só para emitir nota fiscal. Dá para preencher depois."))}
          {ncmStatus === "partial" && (
            <Text style={{ color: Colors.red }}>
              {"Faltam " + (8 - p.ncm.length) + " dígito" + (8 - p.ncm.length > 1 ? "s" : "") + "."}
            </Text>
          )}
          {ncmStatus === "valid" && <Text style={{ color: Colors.green }}>{"✓ " + ncmFamilia}</Text>}
        </Text>
      </Campo>
    </View>
  );

  return (
    <View>
      {p.recemCriado && (
        <View style={st.sucesso}>
          <View style={st.sucessoCk}><Icon name="check" size={14} color="#fff" /></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={st.sucessoTitulo}>{(p.nome || ("Novo " + nomeDoTipo(p.type))) + " criado"}</Text>
            <Text style={st.sucessoTxt}>
              Já aparece no estoque e no Caixa. O que você preencher abaixo vai para a página{" "}
              {isProduto ? "do produto" : "do serviço"} na sua loja online e salva sozinho.
            </Text>
            {isProduto && faltaNcm(p.ncm, p.emiteNota) && (
              <Text style={st.sucessoAviso}>Falta o NCM para emitir nota. Está em Códigos e fiscal.</Text>
            )}
          </View>
        </View>
      )}

      <AccordionCard
        icon="camera"
        titulo="Fotos"
        subtitulo="É o que o cliente vê primeiro na loja"
        status={statusGaleria(g.principal, p.cores, g.porCor)}
        aberto={!!p.aberto.photo}
        onToggle={() => p.onToggle("photo")}
        saveState={p.cardSave.photo}
        narrow={p.narrow}
      >
        {corpoFoto}
      </AccordionCard>

      {isProduto && (
        <AccordionCard
          icon="layers"
          titulo="Cores e tamanhos"
          subtitulo="Estoque e código por combinação"
          status={statusVariacoes(p.cores, p.tamanhos, p.stockMode)}
          aberto={!!p.aberto.var}
          onToggle={() => p.onToggle("var")}
          saveState={p.cardSave.var}
          narrow={p.narrow}
        >
          {corpoVariacoes}
        </AccordionCard>
      )}

      <AccordionCard
        icon="file_text"
        titulo={isProduto ? "Descrição e ficha" : "Descrição"}
        subtitulo="Texto da página na sua loja"
        status={statusDescricao(p.descricao)}
        aberto={!!p.aberto.desc}
        onToggle={() => p.onToggle("desc")}
        saveState={p.cardSave.desc}
        narrow={p.narrow}
      >
        {corpoDescricao}
      </AccordionCard>

      {isProduto && (
        <AccordionCard
          icon="barcode"
          titulo="Códigos e fiscal"
          subtitulo={p.emiteNota ? "NCM obrigatório para a nota" : "SKU, código de barras e NCM"}
          status={statusCodigos(p.sku, p.ncm, p.emiteNota)}
          aberto={!!p.aberto.codes}
          onToggle={() => p.onToggle("codes")}
          saveState={p.cardSave.codes}
          narrow={p.narrow}
        >
          {corpoCodigos}
        </AccordionCard>
      )}
    </View>
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
  cphTopo: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8, width: 108 },
  cphNome: { flex: 1, fontSize: 12.5, color: Colors.ink },
  carregando: { paddingVertical: 16, alignItems: "center" as const },
  pv: { marginTop: 14, borderWidth: 1, borderStyle: "dashed" as any, borderColor: Colors.border2, borderRadius: 10, overflow: "hidden" as const },
  pvHead: {
    fontSize: 10.5, letterSpacing: 0.4, textTransform: "uppercase" as const,
    color: Colors.amber, fontWeight: "700" as const,
    paddingHorizontal: 12, paddingVertical: 6, backgroundColor: Colors.amberD,
  },
  pvBody: { flexDirection: "row" as const, gap: 12, padding: 12, backgroundColor: Colors.bg3 },
  pvImg: { width: 72, height: 72, borderRadius: 8, backgroundColor: Colors.bg4, borderWidth: 1, borderStyle: "dashed" as any, borderColor: Colors.border },
  pvImgTem: { backgroundColor: Colors.violet, borderWidth: 0 },
  pvNome: { fontSize: 14, color: Colors.ink, fontWeight: "700" as const },
  pvPreco: { fontSize: 13, color: Colors.violet3, fontWeight: "700" as const, marginTop: 2, marginBottom: 6 },
  pvDesc: { fontSize: 12, color: Colors.ink2, lineHeight: 17 },
  pvVazio: { fontSize: 12, color: Colors.ink3, fontStyle: "italic" as const, lineHeight: 17 },
  pvFicha: { marginTop: 8, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 6 },
  pvLinha: { flexDirection: "row" as const, gap: 8, paddingVertical: 2 },
  pvLinhaK: { width: 80, fontSize: 11.5, color: Colors.ink3 },
  pvLinhaV: { flex: 1, fontSize: 11.5, color: Colors.ink2 },
  ncmBadge: {
    position: "absolute" as any, right: 6, top: 6, bottom: 6,
    paddingHorizontal: 7, borderRadius: 5,
    alignItems: "center" as const, justifyContent: "center" as const,
    backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border,
  },
  ncmBadgeOk: { borderColor: "rgba(52,211,153,0.3)", backgroundColor: Colors.greenD },
  ncmBadgeTxt: { fontSize: 10, fontWeight: "700" as const, color: Colors.ink3 },
  sucesso: {
    flexDirection: "row" as const, gap: 11, alignItems: "flex-start" as const,
    backgroundColor: Colors.greenD, borderWidth: 1, borderColor: "rgba(52,211,153,0.35)",
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16,
  },
  sucessoCk: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: "#10b981",
    alignItems: "center" as const, justifyContent: "center" as const,
  },
  sucessoTitulo: { fontSize: 13.5, color: Colors.ink, fontWeight: "700" as const },
  sucessoTxt: { fontSize: 12, color: Colors.ink2, marginTop: 2, lineHeight: 17 },
  sucessoAviso: { fontSize: 12, color: Colors.amber, fontWeight: "700" as const, marginTop: 4 },
};

export default Step3Complementos;
