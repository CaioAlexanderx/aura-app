// ============================================================
// AURA. — Conferir estoque: contar (p-108, entrega B)
//
// Bipe pelo ScannerInput do Caixa (leitor USB/bluetooth ou digitação; a
// câmera só aparece onde o navegador tem BarcodeDetector), busca pelo nome
// no mesmo campo, modo "somar 1 a cada bipe" ou "digitar a quantidade".
// Cada mudança aparece na hora e vai para o rascunho no servidor pela fila
// (hooks/useConferenciaEstoque.ts); sem rede, fica guardada e reenvia.
//
// Código que a Aura não conhece vai para "Sem cadastro" (só neste aparelho,
// não cria produto) e não trava a contagem.
//
// Às cegas: a tela nunca mostra o estoque do sistema (nem na escolha da
// variante). Sem às cegas, mostra o que o sistema tinha ao bipar.
// ============================================================
import { useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, TextInput, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { useProducts } from "@/hooks/useProducts";
import { useProductCategories } from "@/hooks/useProductCategories";
import { useConferenciaEstoque } from "@/hooks/useConferenciaEstoque";
import { ScannerInput, type ScannerInputHandle } from "@/components/ScannerInput";
import { toast } from "@/components/Toast";
import { companiesApi } from "@/services/api";
import { pdvApi } from "@/services/pdvApi";
import { rotuloDaVariante } from "@/components/screens/estoque/VariantesConsulta";
import {
  buscarPorNome,
  lerQuantidadeDigitada,
  mostrarQuantidade,
  pareceCodigo,
  plural,
  resolverCodigo,
  textoDoEscopo,
  type AlvoDaContagem,
  type ProdutoContavel,
} from "@/utils/conferenciaContagem";
import { ROTA_CONFERENCIA, rotaDaContagem } from "../ComecarConferencia";
import { LinhaDaContagem } from "./LinhaDaContagem";
import { ce } from "../estilos";
import { NavDaConferencia, type VoltarDaConferencia } from "../NavDaConferencia";

type Variante = { id: string; barcode?: string | null; stock_qty?: any; [k: string]: any };
type Escolha = { produto: ProdutoContavel; variantes: Variante[] | null; erro: string | null };

function num(v: any): number | null {
  const n = parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : null;
}

export function ContarConferencia({ countId }: { countId: string }) {
  const companyId = useAuthStore((s) => s.company?.id) || null;
  const qc = useQueryClient();
  const { products } = useProducts();
  const { categories } = useProductCategories("product");
  const c = useConferenciaEstoque(companyId, countId);

  const [modo, setModo] = useState<"somar" | "definir">("somar");
  const [digitado, setDigitado] = useState("");
  const [sugestoesDe, setSugestoesDe] = useState<string | null>(null);
  const [escolha, setEscolha] = useState<Escolha | null>(null);
  const [pedindo, setPedindo] = useState<AlvoDaContagem | null>(null);
  const [qtdTexto, setQtdTexto] = useState("");
  const [nadaCom, setNadaCom] = useState<string | null>(null);
  // O campo do bipe: esvazia e volta o foco depois de escolher da busca.
  const campo = useRef<ScannerInputHandle>(null);

  const conf = c.conferencia;
  const voltarDaContagem: VoltarDaConferencia = { rotulo: "Voltar às conferências", destino: ROTA_CONFERENCIA, testID: "contar-voltar" };
  const asCegas = conf ? conf.as_cegas !== false : true;
  const produtos = products as unknown as ProdutoContavel[];

  const consulta = digitado.trim() || sugestoesDe || "";
  const sugestoes = useMemo(
    () => (consulta && !pareceCodigo(consulta) ? buscarPorNome(consulta, produtos) : []),
    [consulta, produtos],
  );

  function variantesDe(productId: string): Promise<Variante[]> {
    return qc.fetchQuery({
      queryKey: ["conferencia-variantes", companyId, productId],
      queryFn: () => companiesApi.variants(companyId!, productId),
      staleTime: 60000,
    }).then((r: any) => (Array.isArray(r?.variants) ? r.variants : []));
  }

  function alvoDe(p: ProdutoContavel, v: Variante | null): AlvoDaContagem {
    const sku = p.code && p.code !== "---" ? p.code : null;
    return {
      product_id: p.id,
      variant_id: v ? v.id : null,
      nome: p.name,
      variante: v ? rotuloDaVariante(v) : null,
      codigo: (v && v.barcode) || p.barcode || sku || null,
      // Às cegas, o número do sistema nem entra na linha.
      sistema: asCegas ? undefined : (v ? num(v.stock_qty) : (typeof p.stock === "number" ? p.stock : null)),
    };
  }

  function contarAlvo(alvo: AlvoDaContagem) {
    setEscolha(null);
    setSugestoesDe(null);
    setNadaCom(null);
    if (modo === "definir") {
      setPedindo(alvo);
      setQtdTexto("");
      return;
    }
    c.contar(alvo, "somar", 1);
    // Pronto para o próximo, como depois de um bipe. (No modo "digitar a
    // quantidade" o foco fica no campo da quantidade.)
    campo.current?.focar();
  }

  function escolherProduto(p: ProdutoContavel) {
    setSugestoesDe(null);
    setDigitado("");
    // Escolheu da lista: o texto da busca ("bon") sai do campo, como depois
    // de um bipe.
    campo.current?.limpar();
    if (!p.has_variants) { contarAlvo(alvoDe(p, null)); return; }
    abrirVariantes(p, null);
  }

  function abrirVariantes(p: ProdutoContavel, codigo: string | null) {
    setEscolha({ produto: p, variantes: null, erro: null });
    variantesDe(p.id).then((vs) => {
      const doCodigo = codigo ? vs.find((v) => v.barcode === codigo) : null;
      if (doCodigo) { contarAlvo(alvoDe(p, doCodigo)); return; }
      if (vs.length === 0) { contarAlvo(alvoDe(p, null)); return; }
      setEscolha({ produto: p, variantes: vs, erro: null });
    }, () => {
      setEscolha({ produto: p, variantes: null, erro: "Não deu para carregar as cores e tamanhos. Confira a conexão e tente de novo." });
    });
  }

  async function tratarTexto(texto: string) {
    const t = (texto || "").trim();
    if (!t) return;
    setNadaCom(null);
    const r = resolverCodigo(t, produtos);
    if (r.tipo === "produto") { contarAlvo(alvoDe(r.produto, null)); return; }
    if (r.tipo === "escolher_variante") { abrirVariantes(r.produto, null); return; }
    if (r.tipo === "variante") { abrirVariantes(r.produto, r.codigo); return; }

    if (!pareceCodigo(t)) {
      const achados = buscarPorNome(t, produtos);
      if (achados.length === 1) { escolherProduto(achados[0]); return; }
      if (achados.length > 1) { setSugestoesDe(t); return; }
    }

    // A lista do aparelho pode estar velha (produto cadastrado agora há
    // pouco): pergunta ao servidor, como o Caixa.
    if (companyId) {
      try {
        const s: any = await pdvApi.scan(companyId, t);
        if (s && s.match === "exact" && s.product) {
          const p: ProdutoContavel = {
            id: s.product.id, name: s.product.name || "Produto", code: s.product.sku || null,
            barcode: s.product.barcode || null, unit: s.product.unit || "un",
            stock: num(s.product.stock_qty),
            has_variants: Array.isArray(s.product.variants) ? s.product.variants.length > 0 : !!s.variant_id,
          };
          if (s.source === "variant_barcode") { abrirVariantes(p, t); return; }
          if (p.has_variants) { abrirVariantes(p, null); return; }
          contarAlvo(alvoDe(p, null));
          return;
        }
      } catch (e: any) {
        const rede = !e || e.isNetworkError || e.status === 0 || e.status >= 500;
        if (rede) {
          toast.error("Não deu para consultar o código " + t + ". Confira a conexão e bipe de novo.");
          return;
        }
      }
    }
    // Parece código (tem número, sem espaço): vai para "Sem cadastro".
    // Palavra que não achou nada só avisa.
    if (pareceCodigo(t) || (/\d/.test(t) && !/\s/.test(t))) {
      c.anotarCodigo(t);
      return;
    }
    setNadaCom(t);
  }

  function confirmarQuantidade() {
    if (!pedindo) return;
    const n = lerQuantidadeDigitada(qtdTexto);
    if (n === null) return;
    c.contar(pedindo, "definir", n);
    setPedindo(null);
    setQtdTexto("");
    campo.current?.focar();
  }

  // ── Estados de carga ──────────────────────────────────
  if (c.carregando) {
    return (
      <View style={[ce.conteudo, { alignItems: "center", paddingTop: 48 }]}>
        <ActivityIndicator color={Colors.violet3} />
      </View>
    );
  }
  if (c.erro || !conf) {
    return (
      <ScrollView style={ce.tela} contentContainerStyle={ce.conteudo}>
        <NavDaConferencia voltar={voltarDaContagem} testIDEstoque="contar-ir-estoque" />
        <Text style={ce.titulo}>Conferir estoque</Text>
        <View style={ce.aviso} testID="contar-erro">
          <Text style={ce.avisoTexto}>{c.erro ? c.erro.mensagem : "Não achei esta conferência."}</Text>
        </View>
        <View style={ce.linha}>
          <Pressable onPress={() => router.push(ROTA_CONFERENCIA as any)} style={ce.btnFantasma}>
            <Text style={ce.btnFantasmaTexto}>Voltar</Text>
          </Pressable>
          {c.erro && c.erro.tipo === "rede" && (
            <Pressable onPress={() => c.recarregar()} style={ce.btn} testID="contar-tentar">
              <Text style={ce.btnTexto}>Tentar de novo</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    );
  }

  const titulo = textoDoEscopo(conf.escopo, categories);
  if (conf.status !== "rascunho") {
    const texto = conf.status === "aplicada" ? "Esta conferência já foi ajustada."
      : conf.status === "desfeita" ? "Esta conferência foi desfeita."
        : "Esta conferência foi descartada.";
    return (
      <ScrollView style={ce.tela} contentContainerStyle={ce.conteudo}>
        <NavDaConferencia voltar={voltarDaContagem} testIDEstoque="contar-ir-estoque" />
        <Text style={ce.titulo}>{titulo}</Text>
        <View style={ce.card} testID="contar-encerrada">
          <Text style={ce.avisoTexto}>{texto} Para contar de novo, comece uma nova conferência.</Text>
          <View style={ce.linha}>
            <Pressable onPress={() => router.push(ROTA_CONFERENCIA as any)} style={ce.btnFantasma}>
              <Text style={ce.btnFantasmaTexto}>Nova conferência</Text>
            </Pressable>
            {conf.status !== "descartada" && (
              <Pressable onPress={() => router.push((rotaDaContagem(countId) + "/diferencas") as any)} style={ce.btn}>
                <Text style={ce.btnTexto}>Ver diferenças</Text>
              </Pressable>
            )}
          </View>
        </View>
      </ScrollView>
    );
  }

  // ── Contando ──────────────────────────────────────────
  const fila = c.estadoFila;
  const contados = c.linhas.length;
  const total = typeof c.escopoTotal === "number" && c.escopoTotal > 0 ? c.escopoTotal : null;
  const pct = total ? Math.min(100, Math.round((contados / total) * 100)) : null;

  let chip = { texto: "Rascunho salvo", verde: true };
  if (fila.emPreparo) chip = { texto: "Guardado neste aparelho", verde: false };
  else if (fila.semConexao) chip = { texto: "Sem conexão · " + plural(fila.pendentes, "item esperando", "itens esperando"), verde: false };
  else if (fila.pendentes > 0) chip = { texto: "Salvando…", verde: false };

  return (
    <ScrollView style={ce.tela} contentContainerStyle={ce.conteudo} keyboardShouldPersistTaps="handled">
      <NavDaConferencia voltar={voltarDaContagem} testIDEstoque="contar-ir-estoque" />
      <View style={ce.linha}>
        <View style={ce.espaco}>
          <Text style={ce.titulo} numberOfLines={2}>{titulo}</Text>
          <Text style={ce.nota}>{"Conferência nº " + conf.numero}{conf.motivo ? " · " + conf.motivo : ""}{asCegas ? " · às cegas" : ""}</Text>
        </View>
        <View style={[ce.chip, chip.verde ? ce.chipVerde : ce.chipAmbar]} testID="chip-rascunho">
          <Text style={[ce.chipTexto, chip.verde ? ce.chipVerdeTexto : ce.chipAmbarTexto]}>{chip.texto}</Text>
        </View>
      </View>

      {(fila.semConexao || fila.emPreparo) && (
        <View style={ce.aviso} testID="aviso-fila">
          <Text style={ce.avisoTexto}>
            {fila.emPreparo
              ? "A conferência ainda está chegando ao servidor. O que você contar fica guardado neste aparelho e vai sozinho assim que ela estiver pronta."
              : "Sem conexão agora. O que você contar fica guardado aqui e vai sozinho quando a internet voltar."}
          </Text>
          <View style={ce.linha}>
            <Pressable onPress={c.reenviar} style={[ce.btnFantasma, ce.btnPequeno]} testID="reenviar">
              <Text style={ce.btnFantasmaTexto}>Tentar agora</Text>
            </Pressable>
          </View>
        </View>
      )}

      <View style={ce.card}>
        <View style={ce.linha}>
          <Text style={[ce.cardTitulo, ce.espaco]} testID="progresso">
            {total ? contados + " de " + plural(total, "item contado", "itens contados") : plural(contados, "item contado", "itens contados")}
          </Text>
          {pct !== null && <Text style={ce.nota}>{pct}%</Text>}
        </View>
        {pct !== null && (
          <View style={{ height: 8, borderRadius: 99, backgroundColor: Colors.bg4, overflow: "hidden" }}>
            <View style={{ height: 8, width: (pct + "%") as any, backgroundColor: Colors.violet, borderRadius: 99 }} />
          </View>
        )}
      </View>

      <View style={ce.card}>
        <Text style={ce.rotulo}>Bipe, digite o código ou busque pelo nome</Text>
        <ScannerInput
          ref={campo}
          onScan={(r) => { tratarTexto(r.code); }}
          onChangeText={(t) => { setDigitado(t); if (t) setSugestoesDe(null); setNadaCom(null); }}
          placeholder="789… ou o nome do produto"
          cameraSoComDetector
          testID="contar-campo"
        />
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {([["somar", "Cada bipe soma 1"], ["definir", "Digitar a quantidade"]] as const).map(([m, rot]) => (
            <Pressable
              key={m}
              onPress={() => { setModo(m); setPedindo(null); }}
              testID={"modo-" + m}
              accessibilityRole="radio"
              accessibilityState={{ checked: modo === m }}
              style={[ce.chip, { paddingVertical: 7, paddingHorizontal: 12 }, modo === m && { backgroundColor: Colors.violet, borderColor: Colors.violet }]}
            >
              <Text style={[ce.chipTexto, modo === m && { color: "#fff" }]}>{rot}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={ce.nota}>
          {modo === "somar"
            ? "Bipou o mesmo item de novo? Soma 1. Toque no número da linha para digitar a quantidade."
            : "Depois de bipar ou escolher o item, digite quantas peças você contou."}
        </Text>

        {sugestoes.length > 0 && (
          <View style={{ gap: 6 }} testID="sugestoes">
            {sugestoes.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => escolherProduto(p)}
                testID={"sugestao-" + p.id}
                style={{ padding: 10, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg4 }}
              >
                <Text style={{ fontSize: 14, fontWeight: "600", color: Colors.ink }}>{p.name}</Text>
                <Text style={ce.nota}>{p.has_variants ? "Escolher cor e tamanho" : (p.code && p.code !== "---" ? p.code : p.barcode || "Sem código")}</Text>
              </Pressable>
            ))}
          </View>
        )}
        {nadaCom && <Text style={ce.nota} testID="nada-com">{"Não achei nada com “" + nadaCom + "”. Tente outra palavra ou bipe o código."}</Text>}
      </View>

      {escolha && (
        <View style={ce.card} testID="escolher-variante">
          <Text style={ce.cardTitulo}>{"Qual de " + escolha.produto.name + "?"}</Text>
          {!escolha.variantes && !escolha.erro && <ActivityIndicator color={Colors.violet3} />}
          {escolha.erro && <Text style={ce.erroTexto}>{escolha.erro}</Text>}
          {escolha.variantes && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {escolha.variantes.map((v) => (
                <Pressable
                  key={v.id}
                  onPress={() => contarAlvo(alvoDe(escolha.produto, v))}
                  testID={"variante-" + v.id}
                  style={[ce.btnFantasma, ce.btnPequeno]}
                >
                  <Text style={ce.btnFantasmaTexto}>{rotuloDaVariante(v)}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <View style={ce.linha}>
            <Pressable onPress={() => setEscolha(null)} testID="variante-cancelar">
              <Text style={{ color: Colors.ink3, fontWeight: "600", fontSize: 13 }}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      )}

      {pedindo && (
        <View style={ce.card} testID="pedir-quantidade">
          <Text style={ce.cardTitulo}>{pedindo.nome + (pedindo.variante ? " · " + pedindo.variante : "")}</Text>
          <Text style={ce.nota}>Quantas você contou?</Text>
          <View style={[ce.linha, { flexWrap: "nowrap" }]}>
            <TextInput
              value={qtdTexto}
              onChangeText={setQtdTexto}
              onSubmitEditing={confirmarQuantidade}
              keyboardType="decimal-pad"
              autoFocus
              placeholder="0"
              placeholderTextColor={Colors.ink3}
              style={[ce.input, ce.espaco]}
              testID="quantidade-campo"
            />
            <Pressable onPress={confirmarQuantidade} style={ce.btn} testID="quantidade-ok">
              <Text style={ce.btnTexto}>Salvar</Text>
            </Pressable>
          </View>
          <Pressable onPress={() => setPedindo(null)}>
            <Text style={{ color: Colors.ink3, fontWeight: "600", fontSize: 13 }}>Cancelar</Text>
          </Pressable>
        </View>
      )}

      {c.aviso && (
        <View style={ce.aviso} testID="aviso-recusado">
          <Text style={ce.avisoTexto}>{c.aviso.nome + ": " + c.aviso.mensagem}</Text>
          <Pressable onPress={c.fecharAviso}>
            <Text style={{ color: Colors.violet3, fontWeight: "700", fontSize: 13 }}>Entendi</Text>
          </Pressable>
        </View>
      )}

      <View style={{ gap: 8 }} testID="linhas">
        {c.linhas.length === 0 && <Text style={ce.nota}>Nada contado ainda. Bipe o primeiro item.</Text>}
        {c.linhas.map((l) => (
          <LinhaDaContagem
            key={l.chave}
            linha={l}
            destaque={c.ultima === l.chave}
            asCegas={asCegas}
            semConexao={fila.semConexao || fila.emPreparo}
            onMais={() => c.ajustar(l.chave, 1)}
            onMenos={() => c.ajustar(l.chave, -1)}
            onDefinir={(n) => c.definir(l.chave, n)}
            onRemover={() => c.remover(l.chave)}
          />
        ))}
      </View>

      {c.semCadastro.length > 0 && (
        <View style={ce.card} testID="sem-cadastro">
          <Text style={ce.cardTitulo}>{"Sem cadastro (" + c.semCadastro.length + ")"}</Text>
          <Text style={ce.nota}>Código que a Aura não conhece. Fica guardado neste aparelho para você cadastrar depois; não trava a contagem.</Text>
          {c.semCadastro.map((s) => (
            <View key={s.codigo} style={ce.linha}>
              <Text style={[{ fontSize: 14, color: Colors.ink, fontWeight: "600" }, ce.espaco]}>
                {s.codigo}{s.vezes > 1 ? " · " + mostrarQuantidade(s.vezes) + " bipes" : ""}
              </Text>
              <Pressable onPress={() => c.tirarCodigo(s.codigo)} testID={"tirar-codigo-" + s.codigo}>
                <Text style={{ color: Colors.ink3, fontSize: 12.5, fontWeight: "600" }}>Tirar da lista</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {fila.pendentes > 0 && (
        <Text style={ce.nota} testID="aguardando-envio">
          {"Ainda há " + plural(fila.pendentes, "item", "itens") + " a caminho do servidor. As diferenças aparecem quando tudo chegar."}
        </Text>
      )}
      <View style={ce.linha}>
        <Pressable onPress={() => router.push(ROTA_CONFERENCIA as any)} style={ce.btnFantasma} testID="pausar">
          <Text style={ce.btnFantasmaTexto}>Pausar</Text>
        </Pressable>
        <View style={ce.espaco} />
        <Pressable
          onPress={() => { if (fila.pendentes === 0 && contados > 0) router.push((rotaDaContagem(countId) + "/diferencas") as any); }}
          disabled={fila.pendentes > 0 || contados === 0}
          style={[ce.btn, (fila.pendentes > 0 || contados === 0) && ce.desligado]}
          testID="ver-diferencas"
        >
          <Text style={ce.btnTexto}>Terminar e ver diferenças</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
